// src/index.ts
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import z from "schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";

// src/trust-fence.ts
function header(headers, name2) {
  const value = headers[name2];
  return typeof value === "string" ? value : void 0;
}
function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`);
  } catch {
    return void 0;
  }
}
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
  return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry);
    if (entryUrl === void 0) return false;
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
  });
}
function isTrustedApiRequest(request, trustedHosts) {
  const host = header(request.headers, "host");
  if (host === void 0) return false;
  const hostUrl = parseAuthority(host);
  if (hostUrl === void 0) return false;
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
  if (header(request.headers, "sec-fetch-site") === "cross-site") return false;
  const origin = header(request.headers, "origin");
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}
function trustedHostsOf(ctx) {
  for (const entry of ctx.loader.entries()) {
    if (entry.options.name === "connection") return entry.options.config?.trustedHosts ?? [];
  }
  return [];
}

// src/index.ts
var name = "dsh-notify-sound";
var inject = ["webServer", "loader", "settings"];
var NS = "dsh-notify-sound";
var API_PREFIX = "/notify-sound/api";
var SOUND_PREFIX = "/notify-sound/sounds";
var WS_PATH = "/notify-sound/ws";
var SOUNDS_DIR = fileURLToPath(new URL("../sounds/", import.meta.url));
var SOUND_RE = /^[a-z0-9-]+\.aac$/;
var PrefsSchema = z.object({
  enabled: z.boolean().default(true),
  sound: z.string().default("staplebops-01.aac"),
  volume: z.number().min(0).max(1).default(0.8)
});
function writeJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
function writeOk(res, value) {
  writeJson(res, 200, { ok: true, value });
}
function writeError(res, status, code, message) {
  writeJson(res, status, { ok: false, error: { code, message } });
}
var settingsFace = {
  get: () => ({ value: void 0, revision: void 0 }),
  update: async () => ({ value: void 0, revision: void 0 })
};
function apply(ctx) {
  ctx.inject(["settings"], (sctx) => {
    const ns = settingsNamespace(NS);
    sctx.settings.register(ns, PrefsSchema);
    const viewOf = () => {
      const descriptor = sctx.settings.describe({ redactSecrets: true }).find((c) => c.ns === ns);
      return descriptor === void 0 ? { value: void 0, revision: void 0 } : { value: descriptor.value, revision: descriptor.revision };
    };
    settingsFace = {
      get: viewOf,
      update: async (patch, expectedRevision) => {
        await sctx.settings.update(ns, patch, expectedRevision);
        return viewOf();
      }
    };
  });
  const fence = (req) => isTrustedApiRequest(req, trustedHostsOf(ctx));
  const wss = new WebSocketServer({ noServer: true });
  ctx.effect(() => ctx.webServer.registerUpgrade({
    path: WS_PATH,
    handler: (req, socket, head) => {
      if (!fence(req)) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.on("error", () => {
        });
        ws.on("close", () => {
        });
      });
    }
  }), "dsh-notify-sound: notification WebSocket");
  const broadcast = (payload) => {
    const text = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(text);
    }
  };
  const disposeEvents = ctx.on("session/event", (session, event) => {
    try {
      if (event !== null && typeof event === "object" && event.type === "turn/end") {
        broadcast({ type: "turn/end", at: Date.now() });
      }
    } catch {
    }
  });
  ctx.effect(() => () => {
    disposeEvents();
    wss.close();
  }, "dsh-notify-sound: teardown");
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: API_PREFIX,
    handler: async (req, res) => {
      if (!fence(req)) {
        writeError(res, 403, "forbidden", "forbidden");
        return;
      }
      if (req.method !== "POST") {
        writeError(res, 405, "method-error", "method not allowed");
        return;
      }
      const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
      const method = pathname.startsWith(API_PREFIX + "/") ? pathname.slice(API_PREFIX.length + 1) : void 0;
      try {
        if (method === "sounds.list") {
          const names = (await readdir(SOUNDS_DIR)).filter((n) => SOUND_RE.test(n)).sort();
          writeOk(res, { sounds: names });
          return;
        }
        if (method === "prefs.get") {
          writeOk(res, settingsFace.get());
          return;
        }
        if (method === "prefs.update") {
          const body = await readJsonBody(req);
          const patch = body?.patch;
          if (patch === null || typeof patch !== "object") {
            writeError(res, 400, "bad-request", "patch object required");
            return;
          }
          writeOk(res, await settingsFace.update(patch, body?.expectedRevision));
          return;
        }
        writeError(res, 404, "not-found", "unknown notify-sound API method");
      } catch (error) {
        writeError(res, 500, "internal", error instanceof Error ? error.message : String(error));
      }
    }
  }), "dsh-notify-sound: api routes");
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: SOUND_PREFIX,
    handler: async (req, res) => {
      if (!fence(req)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      const name2 = /^\/notify-sound\/sounds\/([a-z0-9-]+\.aac)$/.exec(new URL(req.url ?? "/", "http://dsh.internal").pathname)?.[1];
      if (name2 === void 0) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      try {
        const info = await stat(join(SOUNDS_DIR, name2));
        if (!info.isFile()) throw new Error("not a file");
        const body = await readFile(join(SOUNDS_DIR, name2));
        res.writeHead(200, {
          "content-type": "audio/aac",
          "cache-control": "public, max-age=86400",
          "content-length": body.length
        });
        if (req.method === "HEAD") res.end();
        else res.end(body);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    }
  }), "dsh-notify-sound: sound files route");
}
async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 1 << 20) throw new Error("request body too large");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return {};
  return JSON.parse(text);
}
export {
  PrefsSchema,
  apply,
  inject,
  name
};
