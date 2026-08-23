// dsh-rtk/src/index.ts
import z from "schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { isAbsolute, resolve as resolvePath } from "node:path";

// dsh-rtk/src/rtk-bridge.ts
import { spawn } from "node:child_process";
function rtkSpawn(bin, args, options = {}) {
  return new Promise((resolve) => {
    const maxBytes = options.maxBytes ?? 1048576;
    const child = spawn(bin, [...args], {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timer = options.timeoutMs !== void 0 && options.timeoutMs > 0 ? setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs) : void 0;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer !== void 0) clearTimeout(timer);
      if (options.signal !== void 0) options.signal.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => {
      child.kill();
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (stdout.length < maxBytes) stdout += chunk.slice(0, maxBytes - stdout.length);
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < maxBytes) stderr += chunk.slice(0, maxBytes - stderr.length);
    });
    child.on("error", (error) => {
      finish({ exitCode: null, stdout, stderr, timedOut, spawnError: error.message });
    });
    child.on("close", (code) => {
      finish({ exitCode: code, stdout, stderr, timedOut, spawnError: null });
    });
    if (options.signal !== void 0) {
      if (options.signal.aborted) child.kill();
      else options.signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
var REWRITE_TIMEOUT_MS = 1e4;
async function rtkRewrite(bin, command, options = {}) {
  const run = await rtkSpawn(bin, ["rewrite", command], {
    signal: options.signal,
    cwd: options.cwd,
    timeoutMs: REWRITE_TIMEOUT_MS,
    maxBytes: 16 * 1024
  });
  if (run.spawnError !== null) {
    return { kind: "passthrough", rewritten: null, exitCode: null, stdout: run.stdout, stderr: run.stderr, spawnError: run.spawnError };
  }
  if (run.exitCode === 0 || run.exitCode === 3) {
    const rewritten = run.stdout.trim();
    if (rewritten !== "") {
      return { kind: "rewrite", rewritten, exitCode: run.exitCode, stdout: run.stdout, stderr: run.stderr, spawnError: null };
    }
  }
  return { kind: "passthrough", rewritten: null, exitCode: run.exitCode, stdout: run.stdout, stderr: run.stderr, spawnError: null };
}

// dsh-rtk/src/index.ts
var name = "rtk";
var inject = ["tools", "systemPrompt"];
var RTK_SETTINGS_NAMESPACE = settingsNamespace("dsh-rtk");
var Config = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(false),
  rtkBin: z.string().default("rtk"),
  askMode: z.union(["rewrite", "passthrough"]).default("rewrite"),
  excludeCommands: z.array(z.string()).default([]),
  interceptedTools: z.array(z.string()).default(["pwsh", "bash", "sh"]),
  defaultTimeoutMs: z.number().default(12e4)
});
var DEFAULT_ANNOUNCE = false;
var SECTION_ORDER = 150;
var RTK_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-rtk \u63D2\u4EF6\uFF1A\u6A21\u578B\u901A\u8FC7 pwsh \u5DE5\u5177\u6267\u884C\u7684\u547D\u4EE4\u4F1A\u81EA\u52A8\u6539\u5199\u4E3A RTK\uFF08Rust Token Killer\uFF09\u8FC7\u6EE4\u7248\u672C\uFF0C\u8F93\u51FA\u88AB\u538B\u7F29\u540E\u518D\u8FD4\u56DE\uFF0C\u65E0\u9700\u663E\u5F0F\u5199 rtk \u547D\u4EE4\u3002\u652F\u6301\u7684\u547D\u4EE4\u65CF\uFF1Agit\uFF08status/log/diff\uFF09\u3001\u76EE\u5F55\u4E0E\u6587\u4EF6\uFF08ls/read/find/grep\uFF09\u3001\u6D4B\u8BD5\uFF08cargo/pytest/jest/vitest/go test\uFF09\u3001\u6784\u5EFA\u4E0E lint\uFF08tsc/ruff/golangci-lint\uFF09\u3001\u5305\u7BA1\u7406\uFF08pnpm/pip\uFF09\u7B49\u3002\u4E0D\u652F\u6301\u7684\u547D\u4EE4\u539F\u6837\u6267\u884C\u3002\u6539\u5199\u540E\u7684\u547D\u4EE4\u4ECD\u7531 DSH \u539F\u751F pwsh \u5DE5\u5177\u6267\u884C\uFF0C\u4FDD\u7559\u5176 sandbox\u3001\u5BA1\u6279\u3001\u8D85\u65F6\u4E0E\u7ED3\u679C\u6E32\u67D3\u3002\u63D2\u4EF6\u914D\u7F6E\u53EF\u8BBE\u7F6E rtkBin \u8DEF\u5F84\u3001askMode\uFF08rewrite/passthrough\uFF09\u3001excludeCommands \u6392\u9664\u524D\u7F00\u4E0E interceptedTools \u62E6\u622A\u8303\u56F4\u3002\u7528\u6237\u63D0\u5230\u300CRTK / token \u8282\u7701 / \u547D\u4EE4\u8F93\u51FA\u538B\u7F29\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\u3002";
function resolveWorkdir(modelWorkdir, exec) {
  const headerCwd = exec.agent?.session?.header?.cwd;
  if (typeof modelWorkdir !== "string") return headerCwd;
  if (headerCwd !== void 0 && !isAbsolute(modelWorkdir)) {
    return resolvePath(headerCwd, modelWorkdir);
  }
  return modelWorkdir;
}
function resolveConfig(config) {
  const value = config ?? {};
  const tools = value.interceptedTools ?? ["pwsh"];
  return {
    enabled: value.enabled ?? true,
    announceToAgent: value.announceToAgent ?? DEFAULT_ANNOUNCE,
    rtkBin: (value.rtkBin ?? "rtk").trim() || "rtk",
    askMode: value.askMode ?? "rewrite",
    excludeCommands: value.excludeCommands ?? [],
    interceptedTools: tools.length > 0 ? tools : ["pwsh"],
    defaultTimeoutMs: value.defaultTimeoutMs ?? 12e4
  };
}
function rewrittenDispatch(exec, args, command, timeoutMs) {
  return {
    callId: `${String(exec.callId)}:rtk`,
    rootCallId: exec.rootCallId,
    name: exec.name,
    arguments: { ...args, command, timeoutMs },
    ...exec.agent !== void 0 ? { agent: exec.agent } : {},
    parent: exec.token,
    signal: exec.signal
  };
}
function apply(ctx, config) {
  let current = () => config ?? {};
  const resolve = () => resolveConfig(current());
  let disposeSection;
  let disposeHook;
  const sync = () => {
    if (disposeSection !== void 0) {
      disposeSection();
      disposeSection = void 0;
    }
    if (disposeHook !== void 0) {
      disposeHook();
      disposeHook = void 0;
    }
    const value = resolve();
    if (!value.enabled) return;
    if (value.announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: "plugin:dsh-rtk",
        order: SECTION_ORDER,
        text: RTK_GUIDANCE
      });
    }
    disposeHook = ctx.on("tools/execute", (exec, next) => rewriteOrPass(ctx, resolve(), exec, next));
  };
  installSettingsSection(ctx, RTK_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => {
      current = source;
      sync();
    },
    onChange: sync
  });
  sync();
}
async function rewriteOrPass(ctx, value, exec, next) {
  if (exec.parent !== void 0) return next();
  if (!value.interceptedTools.includes(exec.name)) return next();
  const args = typeof exec.arguments === "object" && exec.arguments !== null ? exec.arguments : {};
  const command = typeof args.command === "string" ? args.command.trim() : "";
  if (command === "") return next();
  if (args.run_in_background === true) return next();
  if (typeof args.sandbox_permissions === "string" && args.sandbox_permissions !== "") return next();
  for (const prefix of value.excludeCommands) {
    if (prefix !== "" && command.startsWith(prefix)) return next();
  }
  if (exec.signal.aborted) return next();
  const bin = value.rtkBin;
  const workdir = resolveWorkdir(args.workdir, exec);
  const rewrite = await rtkRewrite(bin, command, { signal: exec.signal, cwd: workdir });
  if (rewrite.kind !== "rewrite" || rewrite.rewritten === null) return next();
  if (rewrite.exitCode === 3 && value.askMode === "passthrough") return next();
  const timeoutMs = typeof args.timeoutMs === "number" && args.timeoutMs > 0 ? args.timeoutMs : value.defaultTimeoutMs;
  return ctx.tools.execute(rewrittenDispatch(exec, args, rewrite.rewritten, timeoutMs));
}
export {
  Config,
  RTK_GUIDANCE,
  RTK_SETTINGS_NAMESPACE,
  apply,
  inject,
  name,
  resolveConfig,
  rewriteOrPass,
  rewrittenDispatch
};
