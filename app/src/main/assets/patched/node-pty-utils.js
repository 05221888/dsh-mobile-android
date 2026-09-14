"use strict";
/**
 * node-pty lib/utils.js — dsh-mobile-pty-lazy
 *
 * Upstream loadNativeModule() throws when the native binding cannot be loaded.
 * dsh imports node-pty at the top of @deepseek-ai/dsh-subprocess-local, and
 * cordis is fail-loud: that one throw collapses the whole plugin tree, so the
 * engine never binds its port and the UI shows "引擎启动超时" / "运行时更新失败".
 *
 * On this device the binding genuinely cannot load:
 *   pty.node  (Android ABI, aarch64, correct arch) needs `_Unwind_Resume`,
 *   but the Termux-built libc++_shared.so in the snapshot keeps the unwinder
 *   symbols HIDDEN, and it is the ONLY file among the 483 snapshot ELFs that
 *   references that symbol. Nothing in the snapshot provides it, and the
 *   bionic /system/lib64/libc++_shared.so is a different ABI.
 *
 * So: keep the failure, but make it local. loadNativeModule() returns a lazy
 * stub whose members throw when actually used (i.e. only the interactive
 * terminal path, spawnTerminal). Ordinary subprocess execution — dsh-bash-local,
 * dsh-tool-fs-search, ... — uses child_process and is unaffected.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadNativeModule = exports.assign = void 0;
function assign(target) {
    var sources = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sources[_i - 1] = arguments[_i];
    }
    sources.forEach(function (source) { return Object.keys(source).forEach(function (key) { return target[key] = source[key]; }); });
    return target;
}
exports.assign = assign;
function loadNativeModule(name) {
    // Check build, debug, and then prebuilds.
    var dirs = ['build/Release', 'build/Debug', "prebuilds/" + process.platform + "-" + process.arch];
    // Check relative to the parent dir for unbundled and then the current dir for bundled
    var relative = ['..', '.'];
    var lastError;
    for (var _i = 0, dirs_1 = dirs; _i < dirs_1.length; _i++) {
        var d = dirs_1[_i];
        for (var _a = 0, relative_1 = relative; _a < relative_1.length; _a++) {
            var r = relative_1[_a];
            var dir = r + "/" + d + "/";
            try {
                return { dir: dir, module: require(dir + "/" + name + ".node") };
            }
            catch (e) {
                lastError = e;
            }
        }
    }
    // dsh-mobile-pty-lazy: report, then degrade instead of killing the plugin tree.
    try {
        console.error("[dsh-mobile] node-pty native module unavailable, continuing without interactive terminals: " + lastError);
    } catch (_) {
    }
    var unavailable = function (prop) {
        return function () {
            var e = new Error("node-pty native module is unavailable on this device (" + String(prop) + "): " + lastError);
            e.code = "DSH_MOBILE_PTY_UNAVAILABLE";
            throw e;
        };
    };
    var stub = {
        fork: unavailable("fork"),
        open: unavailable("open"),
        process: unavailable("process"),
        spawn: unavailable("spawn"),
        resize: unavailable("resize"),
        kill: unavailable("kill"),
        write: unavailable("write"),
        on: unavailable("on"),
        _getSocket: unavailable("_getSocket"),
    };
    return { dir: ".", module: stub, unavailable: true };
}
exports.loadNativeModule = loadNativeModule;
