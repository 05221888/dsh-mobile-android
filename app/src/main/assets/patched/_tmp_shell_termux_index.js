/**
 * Android/Termux service provider for the bash capability seam.
 *
 * Extends the local bash executor with the Termux execution world:
 * - every spawn carries an explicit, self-contained Termux environment
 *   (PATH/LD_LIBRARY_PATH/HOME/PREFIX/TERMUX_VERSION/SHELL), so execution
 *   never depends on the ambient environment being accidentally correct;
 * - run/start hand an explicit bashPath to the inherited subprocess
 *   mechanics (process-group SIGTERM→SIGKILL, output caps + spill, grace),
 *   reusing LocalBashExecutor's budgets and lifecycle unchanged;
 * - the sandbox declaration is honest: enforcement is the Android app domain
 *   (SELinux u0_aXXX) plus the approval flow, not a path-level confiner, so
 *   results report `enforcement: 'partial'` and the default mode stays
 *   `workspace-write` (same as the desktop default) for permission presets;
 * - probe() reports bash presence/version and the toolchain the model-facing
 *   tools rely on; misconfigured bash fails loudly with repair guidance.
 *
 * Mount only on Android (patch row `disabled: !!js process.platform !== 'android'`).
 * @module @dsh-android/dsh-shell-termux
 */
import { accessSync, constants } from 'node:fs';
import { LocalBashExecutor } from '@deepseek-ai/dsh-bash-local';
/** The declared sandbox mode this executor applies by default. */
const DECLARED_MODE = 'workspace-write';
/** Default grace period passed to probe spawns. */
const PROBE_GRACE_MS = 3_000;
/** Tools the dsh tool surface relies on beyond bash itself (pkg names). */
const REQUIRED_TOOLCHAIN = ['bash', 'coreutils', 'findutils', 'grep', 'ripgrep'];
/** Executables probed under `$PREFIX/bin` (coreutils/findutils/grep basics). */
const PROBE_BINARIES = ['bash', 'ls', 'cat', 'grep', 'find', 'sed', 'cp', 'mv', 'rm', 'mkdir', 'rg'];
/**
 * Termux bash executor over the inherited subprocess mechanics. Registers as
 * `ctx.shell` in place of the local/sandbox executors on Android; the tool
 * layer and approval flow are unchanged consumers.
 */
export class TermuxBashExecutor extends LocalBashExecutor {
    // No own Config: the inherited knobs' schema (with defaults) is inherited
    // verbatim — schemastery preserves unknown keys (verified), so the Termux
    // coordinates arrive in the raw config and are validated in the constructor.
    bashPath;
    prefix;
    home;
    termuxVersion;
    extraPath;
    constructor(ctx, config) {
        super(ctx, config);
        const entry = config;
        for (const [name, value] of [['bashPath', entry.bashPath], ['prefix', entry.prefix], ['home', entry.home]]) {
            if (typeof value !== 'string' || !value.startsWith('/')) {
                throw new Error(`shell-termux: ${name} must be an absolute path, got ${String(value)}`);
            }
        }
        this.bashPath = entry.bashPath;
        this.prefix = entry.prefix;
        this.home = entry.home;
        this.termuxVersion = entry.termuxVersion ?? '0.118.3';
        this.extraPath = entry.extraPath ?? [];
    }
    /**
     * The declared default mode — the capability fact the tool layer and
     * permission presets read. Enforcement is the Android app domain, not a
     * path-level confiner; per-process facts report that honestly.
     */
    get sandboxMode() {
        return DECLARED_MODE;
    }
    /**
     * Self-contained Termux environment, merged under the caller's own env so a
     * trusted caller may still override (same philosophy as ENV_OVERRIDES).
     */
    termuxEnv() {
        return {
            PATH: [...this.extraPath, `${this.prefix}/bin`, '/system/bin'].join(':'),
            LD_LIBRARY_PATH: `${this.prefix}/lib`,
            HOME: this.home,
            PREFIX: this.prefix,
            TERMUX_VERSION: this.termuxVersion,
            SHELL: this.bashPath,
        };
    }
    /** Stamp the controlled Termux environment onto every request. */
    resolve(request) {
        return super.resolve({ ...request, env: { ...this.termuxEnv(), ...request.env } });
    }
    /** Reject with repair guidance when the configured bash is not executable. */
    assertBash() {
        try {
            accessSync(this.bashPath, constants.X_OK);
        }
        catch {
            throw new Error(`shell-termux: ${this.bashPath} is not executable; run 'pkg install bash' in Termux or fix bashPath/prefix in the shell-termux plugin config`);
        }
    }
    /** The executor's shell argv for one command. */
    bashArgv(command) {
        return [this.bashPath, '-c', command];
    }
    async run(spec) {
        this.assertBash();
        const result = await this.runArgv(spec, this.bashArgv(spec.command));
        return { ...result, sandbox: { mode: DECLARED_MODE, denied: false, enforcement: 'partial' } };
    }
    start(spec) {
        this.assertBash();
        const proc = this.startArgv(spec, this.bashArgv(spec.command));
        // Background processes never confine; the app-domain fact is fixed at spawn.
        proc.sandbox = { mode: DECLARED_MODE, denied: false, enforcement: 'partial' };
        return proc;
    }
    /**
     * Probe the Termux execution world: bash presence/version plus the
     * model-tool toolchain. Never throws; unusable states are structured data.
     */
    async probe() {
        const missing = new Set();
        for (const tool of PROBE_BINARIES) {
            const path = tool === 'bash' ? this.bashPath : `${this.prefix}/bin/${tool}`;
            try {
                accessSync(path, constants.X_OK);
            }
            catch {
                missing.add(tool);
            }
        }
        if (missing.has('bash')) {
            return { status: 'unusable', bash: this.bashPath, missing: [...REQUIRED_TOOLCHAIN] };
        }
        const bashVersion = await this.readBashVersion();
        // Map toolchain packages to their probed representative binary.
        const missingPkgs = REQUIRED_TOOLCHAIN.filter((pkg) => {
            const binary = pkg === 'coreutils' ? 'ls' : pkg === 'findutils' ? 'find' : pkg === 'grep' ? 'grep' : pkg === 'ripgrep' ? 'rg' : 'bash';
            return missing.has(binary);
        });
        return {
            status: missingPkgs.length === 0 ? 'full' : 'partial',
            bash: this.bashPath,
            ...bashVersion !== undefined ? { bashVersion } : {},
            missing: missingPkgs,
        };
    }
    /** First line of `bash --version`, or undefined when bash cannot report it. */
    async readBashVersion() {
        const spawnSpec = {
            argv: [this.bashPath, '--version'],
            cwd: this.home,
            stdio: {
                stdin: 'ignore',
                stdout: { maxBytes: 4096, spill: { maxBytes: 0 } },
                stderr: { maxBytes: 4096, spill: { maxBytes: 0 } },
            },
            graceMs: PROBE_GRACE_MS,
            env: { ...this.termuxEnv() },
        };
        const handle = this.ctx.subprocess.spawn(spawnSpec);
        const outcome = await handle.done;
        const text = handle.collected.stdout?.readFrom(0).text ?? '';
        if (outcome.exitCode !== 0)
            return undefined;
        return text.split('\n')[0] || undefined;
    }
}
export default TermuxBashExecutor;
