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
export {
  rtkRewrite,
  rtkSpawn
};
