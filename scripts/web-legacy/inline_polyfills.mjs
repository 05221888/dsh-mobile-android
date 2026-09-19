/**
 * Re-inline assets/js/compat-polyfills.js into the served SPA shell
 * (assets/patched/web-frontend-index.html).
 *
 * This is step 3 of scripts/web-legacy/gen_legacy.mjs, split out so a polyfill
 * edit can be re-inlined without running the whole (snapshot + Babel) pipeline.
 * Idempotent: replaces a previous inlined block instead of stacking another one.
 */
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const ASSETS = path.join(REPO, "app", "src", "main", "assets");
const NL = String.fromCharCode(10);
const IDX = path.join(ASSETS, "patched", "web-frontend-index.html");
const POLY = path.join(ASSETS, "js", "compat-polyfills.js");

const poly = fs.readFileSync(POLY, "utf8");
let html = fs.readFileSync(IDX, "utf8");

const BEGIN = "    <!-- dsh-mobile-compat-old-browser";
if (html.includes("dsh-mobile-compat-old-browser")) {
  const a = html.indexOf(BEGIN);
  const sOpen = html.indexOf("<script>", a);
  const sClose = html.indexOf("</script>", sOpen);
  let rest = html.slice(sClose + "</script>".length);
  if (rest.startsWith(NL)) rest = rest.slice(NL.length);
  html = html.slice(0, a) + rest;
}

const at = html.indexOf("    <script>");
if (at < 0) throw new Error("index.html: no <script> anchor for the polyfill");
const banner = [
  BEGIN + ": runtime polyfills for Chromium <93 (Object.hasOwn / Array.at /",
  "         structuredClone / replaceAll / WeakRef ...) + the CSS `inset` shim",
  "         (Chromium <87). Inlined here so it runs BEFORE the module bundle.",
  "         Syntax-level gaps (??= ||= &&=, private class members) cannot be",
  "         polyfilled and are rewritten at build time into assets/patched/ and",
  "         assets/patched-web-legacy/. -->",
].join(NL) + NL;
const block = banner + "    <script>" + NL + poly.trimEnd() + NL + "    </script>" + NL + NL;
html = html.slice(0, at) + block + html.slice(at);
fs.writeFileSync(IDX, html);
console.log("index.html: runtime polyfills inlined (" + html.length + " bytes)");
