/**
 * Generate the Chromium<85 (logical assignment) compatibility patch set.
 *
 * Two kinds of targets:
 *  1. App assets under app/src/main/assets/patched/** — these ARE the source of
 *     truth (applyRuntimePatches copies them onto the engine tree), so downlevel
 *     them in place. The rewrite is semantics-preserving and valid on every
 *     engine, so modern WebViews are unaffected.
 *  2. Files that only exist inside snapshot.tar.xz (which we cannot edit here) —
 *     ship downleveled copies under assets/patched-web-legacy/ plus a manifest
 *     keyed by the ORIGINAL file's sha256, so the app only replaces pristine
 *     files and never clobbers anything else.
 */
import { parse } from "@babel/parser";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const REPO = "C:/Users/五五/Desktop/项目/dsh-mobile-android";
const ASSETS = path.join(REPO, "app/src/main/assets");
const LEGACY = path.join(ASSETS, "patched-web-legacy");
const SNAPSHOT = path.join(ASSETS, "snapshot.tar.xz");

import { downlevel } from "./es83.mjs";

const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
const sha256f = (p) => sha256(fs.readFileSync(p));

// ---- 1. app assets in place -------------------------------------------------
// Which app assets does a browser actually load?
//   * lib/client.js  -- the client entry point cordis fetches over HTTP
//   * dsh-web-frontend/dist/** -- the SPA bundle
// A private-member rewrite makes Babel re-print the WHOLE file, so restrict it to
// these entries; everything else only needs the byte-preserving logical-assign
// rewrite. Verified: none of the client.js bundles import siblings at runtime
// (relative imports = 0), so no dependency gets left un-downleveled.
const isBrowserEntry = (p) => p.endsWith("client.js") || p.includes("dsh-web-frontend"+path.sep+"dist");
const walk = (dir, cb) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "patched-web-legacy") walk(p, cb); }
    else cb(p);
  }
};
let inplace = 0, inplaceEdits = 0;
const inplaceTargets = [];
walk(path.join(ASSETS, "patched"), (p) => inplaceTargets.push(p));
for (const p of inplaceTargets) {
  const ext = path.extname(p);
  if (ext !== ".js" && ext !== ".mjs") continue;
  const src = fs.readFileSync(p, "utf8");
  if (!/\?\?=|\|\|=|&&=/.test(src) && !/#[A-Za-z_$]/.test(src)) continue;
  const r = await downlevel(src, { privateMembers: isBrowserEntry(p) });
  if (!r.count && !r.private) continue;
  fs.writeFileSync(p, r.code);
  inplace++; inplaceEdits += r.count;
  console.log(`  [in-place] ${String(r.count).padStart(3)} logical${r.private ? " + private" : ""}  ${p.slice(ASSETS.length + 1)}`);
}
console.log(`app assets downleveled in place: ${inplace} files / ${inplaceEdits} edits\n`);

// ---- 2. snapshot files -> assets/patched-web-legacy -------------------------
// Targets are (scope, relpath) where scope decides the on-device root.
const SNAP_TARGETS = [
  ["engine", "@deepseek-ai/dsh-api-gateway/lib/client.js"],
  ["engine", "@deepseek-ai/dsh-client-connection/lib/client.js"],
  ["engine", "@deepseek-ai/dsh-client-locale/lib/client.js"],
  ["engine", "@deepseek-ai/dsh-client-ui-cordis/lib/client.js"],
  ["engine", "@deepseek-ai/dsh-client-ui-layout/lib/client.js"],
  ["engine", "@deepseek-ai/dsh-client-ui-theme/lib/client.js"],
  ["engine", "@deepseek-ai/dsh-client-ui-trajectory/lib/client.js"],
  ["engine", "@deepseek-ai/dsh-cordis-client-runner/lib/client.js"],
  ["webprofile", "@dsh-android/dsh-client-ui-responsive/lib/client.js"],
];

// read the snapshot once via tar (WSL/MSYS tar handles xz)
const tmp = path.join(process.env.TEMP || "/tmp", "dsh-snap-extract");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
const prefix = "usr/lib/node_modules/@deepseek-ai/dsh/node_modules/";
const wanted = SNAP_TARGETS.filter(([s]) => s === "engine").map(([, r]) => prefix + r);
const profilePrefix = "home/.dsh/profiles/web/node_modules/";
const wantedProfile = SNAP_TARGETS.filter(([s]) => s === "webprofile").map(([, r]) => profilePrefix + r);
// Python's tarfile handles this xz stream reliably on Windows; MSYS tar does not.
const nix = (x) => x.split(String.fromCharCode(92)).join("/");
execFileSync("python", [path.join(import.meta.dirname, "extract_snap.py"),
  nix(SNAPSHOT), nix(tmp), ...wanted, ...wantedProfile], { stdio: "inherit" });

fs.rmSync(LEGACY, { recursive: true, force: true });
fs.mkdirSync(LEGACY, { recursive: true });
const manifest = {};
let snapFiles = 0, snapEdits = 0;
for (const [scope, rel] of SNAP_TARGETS) {
  if (scope !== "engine" && scope !== "webprofile") continue;
  const srcPath = path.join(tmp, (scope === "engine" ? prefix : profilePrefix) + rel);
  if (!fs.existsSync(srcPath)) { console.log(`  [skip] not in snapshot: ${rel}`); continue; }
  const origBytes = fs.readFileSync(srcPath);
  const r = await downlevel(origBytes.toString("utf8"), { privateMembers: true });
  if (!r.count && !r.private) { console.log(`  [skip] nothing to downlevel: ${rel}`); continue; }
  const key = `${scope}:${rel}`;
  const outPath = path.join(LEGACY, key.replace(":", "/"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, r.code);
  manifest[key] = { sha256_original: sha256(origBytes), edits: r.count, private: r.private };
  snapFiles++; snapEdits += r.count;
  console.log(`  [legacy]   ${String(r.count).padStart(3)} logical${r.private ? " + private" : ""}  ${key}`);
}
// ---- 3. inline the runtime polyfills into the served index.html -------------
// The rewrite above only covers PARSER-level gaps. The remaining gaps are runtime
// APIs (Object.hasOwn, Array.at, structuredClone, String.replaceAll, WeakRef,
// AbortSignal.any ...) that Chromium 83 lacks. onPageStarted-injected JS lands too
// late for a <script type=module> in <head>, so the polyfill must be part of the
// served HTML itself -- dsh serves this file as the SPA shell.
const NL = String.fromCharCode(10);
const IDX = path.join(ASSETS, 'patched', 'web-frontend-index.html');
const POLY = path.join(ASSETS, 'js', 'compat-polyfills.js');
{
  const poly = fs.readFileSync(POLY, 'utf8');
  let html = fs.readFileSync(IDX, 'utf8');
  const BEGIN = '    <!-- dsh-mobile-compat-old-browser';
  if (html.includes('dsh-mobile-compat-old-browser')) {
    const a = html.indexOf(BEGIN);
    const sOpen = html.indexOf('<script>', a);
    const sClose = html.indexOf('</script>', sOpen);
    let rest = html.slice(sClose + '</script>'.length);
    if (rest.startsWith(NL)) rest = rest.slice(NL.length);
    html = html.slice(0, a) + rest;
  }
  const at = html.indexOf('    <script>');
  if (at < 0) throw new Error('index.html: no <script> anchor for the polyfill');
  const banner = [
    BEGIN + ': runtime polyfills for Chromium <93 (Object.hasOwn / Array.at /',
    '         structuredClone / replaceAll / WeakRef ...). Inlined here so it runs',
    '         BEFORE the module bundle. Syntax-level gaps (??= ||= &&=, private',
    '         class members) cannot be polyfilled and are rewritten at build time',
    '         into assets/patched/ and assets/patched-web-legacy/. -->',
  ].join(NL) + NL;
  const block = banner + '    <script>' + NL + poly.trimEnd() + NL + '    </script>' + NL + NL;
  html = html.slice(0, at) + block + html.slice(at);
  fs.writeFileSync(IDX, html);
  console.log('index.html: runtime polyfills inlined (' + html.length + ' bytes)');
}

fs.writeFileSync(path.join(LEGACY, "manifest.json"),
  JSON.stringify({ version: 1, packages: manifest }, null, 2) + "\n");
console.log(`\nsnapshot legacy files: ${snapFiles} / ${snapEdits} edits`);
fs.rmSync(tmp, { recursive: true, force: true });
