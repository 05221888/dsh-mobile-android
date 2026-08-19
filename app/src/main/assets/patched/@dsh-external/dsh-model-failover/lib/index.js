// src/index.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import z from "schemastery";
var name = "@dsh-external/dsh-model-failover";
var inject = ["llm", "webServer"];
var DEFAULT_CODE_POLICY = {
  TIMEOUT: "failover",
  RATE_LIMIT: "failover",
  SERVER: "failover",
  TRANSPORT: "failover",
  EMPTY_RESPONSE: "failover",
  QUOTA: "failover",
  INVALID_CREDENTIAL: "failover",
  CONTEXT_WINDOW_EXCEEDED: "failover"
};
var MODULE_NAME = "dsh-model-failover";
var API_PREFIX = "/model-failover";
var MAX_HISTORY = 50;
var Config = z.object({
  enabled: z.boolean().default(true).description("\u5F00\u542F\u81EA\u52A8\u6A21\u578B\u5207\u6362")
});
var ConfigStore = class {
  configPath;
  cache = null;
  constructor(dshHome) {
    this.configPath = join(dshHome, "storages", "model-failover", "config.json");
    this.load();
  }
  load() {
    try {
      if (existsSync(this.configPath)) {
        const raw = readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(raw);
        this.cache = this.mergeDefaults(parsed);
      } else {
        this.cache = this.defaults();
      }
    } catch {
      this.cache = this.defaults();
    }
    return this.cache;
  }
  save(config) {
    try {
      mkdirSync(dirname(this.configPath), { recursive: true });
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
      this.cache = config;
    } catch (e) {
      console.error(`[${MODULE_NAME}] config save failed:`, e);
    }
  }
  get() {
    if (!this.cache) this.load();
    return this.cache;
  }
  update(patch) {
    const current = this.get();
    const merged = {
      ...current,
      ...typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {},
      ...Array.isArray(patch.fallbackChain) ? { fallbackChain: patch.fallbackChain } : {},
      ...patch.codePolicy && typeof patch.codePolicy === "object" ? { codePolicy: { ...DEFAULT_CODE_POLICY, ...patch.codePolicy } } : {},
      ...patch.maxSwitchesPerTurn === null || typeof patch.maxSwitchesPerTurn === "number" ? { maxSwitchesPerTurn: patch.maxSwitchesPerTurn } : {}
    };
    this.save(merged);
    return merged;
  }
  addHistory(record) {
    const config = this.get();
    config.history.unshift(record);
    if (config.history.length > MAX_HISTORY) {
      config.history = config.history.slice(0, MAX_HISTORY);
    }
    this.save(config);
  }
  updateHistory(time, result) {
    const config = this.get();
    const rec = config.history.find((h) => h.time === time);
    if (rec) {
      rec.result = result;
      this.save(config);
    }
  }
  defaults() {
    return {
      enabled: true,
      fallbackChain: [],
      codePolicy: { ...DEFAULT_CODE_POLICY },
      maxSwitchesPerTurn: null,
      history: []
    };
  }
  mergeDefaults(parsed) {
    return {
      enabled: parsed.enabled ?? true,
      fallbackChain: Array.isArray(parsed.fallbackChain) ? parsed.fallbackChain : [],
      codePolicy: { ...DEFAULT_CODE_POLICY, ...parsed.codePolicy || {} },
      maxSwitchesPerTurn: parsed.maxSwitchesPerTurn ?? null,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, MAX_HISTORY) : []
    };
  }
};
var sessionStates = /* @__PURE__ */ new WeakMap();
function getSessionState(agentObj) {
  let state = sessionStates.get(agentObj);
  if (!state) {
    state = { switchCount: 0, pendingSwitch: null, turn: 0, currentRoute: null, tried: /* @__PURE__ */ new Set() };
    sessionStates.set(agentObj, state);
  }
  return state;
}
function makeKey(entry) {
  return `${entry.provider}/${entry.model}`;
}
function apply(ctx, _config) {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const store = new ConfigStore(dshHome);
  ctx.logger?.info?.(`[${MODULE_NAME}] \u63D2\u4EF6\u542F\u52A8`);
  ctx.on("agent/request-error", async (payload, next) => {
    const cfg = store.get();
    if (!cfg.enabled || cfg.fallbackChain.length === 0) return next();
    const { agent, turn, step, provider, failure } = payload;
    const code = failure.code;
    const policy = cfg.codePolicy[code] || "no-failover";
    if (policy === "no-failover") return next();
    const action = await next();
    if (action !== void 0) return action;
    const state = getSessionState(agent);
    if (state.turn !== turn) {
      state.turn = turn;
      state.switchCount = 0;
      state.currentRoute = null;
      state.tried = /* @__PURE__ */ new Set();
    }
    const currentEntry = state.currentRoute || { provider, model: agent.options.model || "" };
    state.tried.add(makeKey(currentEntry));
    const maxSwitches = cfg.maxSwitchesPerTurn ?? cfg.fallbackChain.length * 2;
    if (state.switchCount >= maxSwitches) {
      ctx.logger?.warn?.(`[${MODULE_NAME}] fallback \u94FE\u5DF2\u8FBE\u5230\u672C turn \u5207\u6362\u4E0A\u9650 (${maxSwitches})`);
      return void 0;
    }
    const nextEntry = cfg.fallbackChain.find(
      (entry) => !state.tried.has(makeKey(entry))
    );
    if (!nextEntry) {
      ctx.logger?.warn?.(`[${MODULE_NAME}] fallback \u94FE\u6CA1\u6709\u5269\u4F59\u53EF\u5C1D\u8BD5\u6A21\u578B`);
      return void 0;
    }
    state.pendingSwitch = nextEntry;
    state.switchCount += 1;
    const record = {
      time: Date.now(),
      from: currentEntry,
      to: nextEntry,
      code,
      turn,
      step,
      attempt: state.switchCount,
      result: "pending"
    };
    store.addHistory(record);
    ctx.logger?.warn?.(
      `[${MODULE_NAME}] \u5207\u6362 ${currentEntry.provider}/${currentEntry.model} \u2192 ${nextEntry.provider}/${nextEntry.model} (code=${code}, attempt=${state.switchCount})`
    );
    return { kind: "retry" };
  });
  ctx.on("agent/request", async (payload, next) => {
    const config = await next();
    const cfg = store.get();
    if (!cfg.enabled) return config;
    const { agent, turn } = payload;
    const state = getSessionState(agent);
    if (state.turn !== turn) {
      state.turn = turn;
      state.switchCount = 0;
      state.currentRoute = null;
      state.tried = /* @__PURE__ */ new Set();
    }
    if (state.pendingSwitch) {
      const switched = { ...config, provider: state.pendingSwitch.provider, model: state.pendingSwitch.model };
      state.pendingSwitch = null;
      state.currentRoute = { provider: switched.provider, model: switched.model };
      return switched;
    }
    state.currentRoute = { provider: config.provider, model: config.model };
    return config;
  });
  const apiHandler = async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const path = url.pathname;
    const json = (data, status = 200) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
    };
    const readBody = () => new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => resolve(body));
    });
    try {
      if (req.method === "GET" && path === `${API_PREFIX}/api/config`) {
        const config = store.get();
        json({ config });
        return;
      }
      if (req.method === "POST" && path === `${API_PREFIX}/api/config`) {
        const body = await readBody();
        const patch = JSON.parse(body);
        const { history, ...safePatch } = patch;
        const updated = store.update(safePatch);
        json({ config: updated });
        return;
      }
      if (req.method === "GET" && path === `${API_PREFIX}/api/history`) {
        json({ history: store.get().history });
        return;
      }
      if (req.method === "GET" && path === `${API_PREFIX}/api/providers`) {
        const providers = ctx.llm.listProviders();
        const models = {};
        for (const p of providers) {
          try {
            const pModels = await ctx.llm.listModels(p.id);
            models[p.id] = pModels.map((m) => ({ id: m.id, name: m.name }));
          } catch {
            models[p.id] = [];
          }
        }
        json({ providers, models });
        return;
      }
      json({ error: "not found" }, 404);
    } catch (e) {
      json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  };
  ctx.effect(() => ctx.webServer.register({ kind: "prefix", path: API_PREFIX, handler: apiHandler }, `${MODULE_NAME}: api`));
}
export {
  Config,
  apply,
  inject,
  name
};
