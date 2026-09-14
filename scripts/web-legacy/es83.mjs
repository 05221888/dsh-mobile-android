/**
 * es83 — downlevel syntax that Chromium 83 (Android 10 MIUI stock WebView)
 * cannot parse, so that the dsh front-end actually boots on such devices.
 *
 * Why build-time and not a polyfill: these are PARSER-level constructs.
 *   ??= ||= &&=        logical assignment      Chrome 85
 *   #private(...)      private class methods   Chrome 84
 *   #field; / this.#f  private class fields    Chrome 74 (fields) / 84 (methods,
 *                                                 private-in, optional-private)
 * A polyfill cannot rescue a file the engine refuses to parse — the whole
 * bundle dies with `Uncaught SyntaxError`, which is exactly the failure we saw
 * (`Unexpected token '='` on 8 bundles, `Unexpected token '('` on ui-responsive).
 *
 * Strategy: logical assignment is rewritten surgically (byte-preserving, only
 * the offending expression changes). Private members are delegated to Babel's
 * dedicated plugins, which need whole-class/scope rewriting to stay correct
 * (WeakMap-based brand checks and `in` semantics cannot be done by splicing).
 *
 * Both paths are semantics-preserving; modern engines are unaffected, so the
 * same file serves every device.
 *
 * Usage:  node es83.mjs <file-or-dir> [...]      (rewrite in place)
 *         node es83.mjs --check <file-or-dir>    (report only; exit 1 if any)
 */
import { parse } from "@babel/parser";
import { transformAsync } from "@babel/core";
import transformPrivateMethods from "@babel/plugin-transform-private-methods";
import transformClassProperties from "@babel/plugin-transform-class-properties";
import transformPrivateIn from "@babel/plugin-transform-private-property-in-object";
import fs from "node:fs";
import path from "node:path";

const OPS = { "??=": "??", "||=": "||", "&&=": "&&" };
export const ES83_MARK = "/* dsh-mobile-es83: syntax downleveled for Chromium<85 (logical assignment / private class members) */\n";
const SKIP = new Set(["loc","start","end","leadingComments","trailingComments","innerComments","extra"]);

function collect(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) collect(n, out); return; }
  if (node.type === "AssignmentExpression" && OPS[node.operator]) out.push(node);
  for (const k in node) { if (SKIP.has(k)) continue; collect(node[k], out); }
}

/**
 * Does this assignment target need its base hoisted?
 * Per spec `a.b OP= rhs` evaluates the base once. Written `a.b OP (a.b = rhs)`
 * the base is read twice — safe only when re-reading is pure:
 *   x            variable read                     -> no hoist
 *   this.x, obj.p   (obj a plain variable)         -> no hoist
 *   obj.a.b, f().x, a[k]  base may be an accessor or a call -> HOIST
 * `computed` always hoists: the key expression can run arbitrary code.
 * (Regression-tested: a getter base fires twice without hoisting.)
 */
function needsHoist(node) {
  if (node.type === "Identifier" || node.type === "ThisExpression") return false;
  if (node.type === "MemberExpression") {
    if (node.computed) return true;
    const obj = node.object;
    return !(obj.type === "Identifier" || obj.type === "ThisExpression");
  }
  return true;
}

function downlevelLogical(src) {
  const ast = parse(src, { sourceType: "unambiguous", allowReturnOutsideFunction: true });
  const nodes = [];
  collect(ast.program, nodes);
  if (!nodes.length) return { code: src, count: 0 };

  let seq = 0;
  const edits = [];
  for (const n of nodes) {
    const lhs = n.left;
    const L = src.slice(lhs.start, lhs.end);
    const R = src.slice(n.right.start, n.right.end);
    const op = OPS[n.operator];
    if (!needsHoist(lhs)) {
      // `a OP (a = (rhs))` — parens mandatory: `a = b, c` binds as `(a = b), c`.
      edits.push({ start: n.start, end: n.end, text: `${L} ${op} (${L} = (${R}))` });
      continue;
    }
    if (lhs.type !== "MemberExpression") {
      throw new Error("unsupported logical-assignment target: " + lhs.type + " in " + L);
    }
    const base = src.slice(lhs.object.start, lhs.object.end);
    const prop = lhs.computed
      ? "[" + src.slice(lhs.property.start, lhs.property.end) + "]"
      : "." + src.slice(lhs.property.start, lhs.property.end);
    const tmp = "__es83_" + (seq++);
    edits.push({ start: n.start, end: n.end,
      text: `(${tmp} = ${base})${prop} ${op} (${tmp}${prop} = (${R}))`, tmp });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  const used = [...new Set(edits.filter((e) => e.tmp).map((e) => e.tmp))];
  if (used.length) out = `var ${used.join(", ")};\n` + out;
  parse(out, { sourceType: "unambiguous" });
  return { code: out, count: edits.length };
}

/**
 * Does this AST actually contain a private class member?
 *
 * A plain regex is not good enough: a CSS colour inside a string (`color:#fff;`)
 * and a `//#region` comment both look like `#ident`, and a false positive here
 * makes Babel rewrite the whole file - tens of thousands of lines of churn for
 * nothing, plus needless review risk. Walk the real AST instead.
 */
function hasPrivateMembers(ast) {
  let found = false;
  (function walk(node) {
    if (found || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) walk(n); return; }
    if (node.type === 'PrivateName' ||
        node.type === 'ClassPrivateProperty' ||
        node.type === 'ClassPrivateMethod') { found = true; return; }
    for (const k in node) { if (SKIP.has(k)) continue; walk(node[k]); }
  })(ast.program);
  return found;
}

async function downlevelPrivate(src) {
  const r = await transformAsync(src, {
    configFile: false, babelrc: false, compact: false, comments: true,
    sourceType: "unambiguous",
    plugins: [transformPrivateMethods, transformClassProperties, transformPrivateIn],
    parserOpts: { allowReturnOutsideFunction: true },
  });
  return r.code;
}

/**
 * Downlevel one source string. Returns { code, count, private }.
 */
export async function downlevel(src, opts = {}) {
  const allowPrivate = opts.privateMembers !== false;
  let code = src, count = 0, priv = false;
  const l = downlevelLogical(src);
  code = l.code; count = l.count;
  // Only invoke Babel when a private class member is actually present: it rewrites
  // more than we need, so keep the byte-preserving path for everything else.
  // Only invoke Babel when a private class member is really present.
  const ast = parse(code, { sourceType: 'unambiguous', allowReturnOutsideFunction: true });
  if (allowPrivate && hasPrivateMembers(ast)) {
    code = await downlevelPrivate(code);
    priv = true;
  }
  if (count || priv) code = ES83_MARK + code;
  return { code, count, private: priv };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.slice(process.platform === "win32" ? 1 : 0));
if (isMain) {
  const args = process.argv.slice(2);
  const checkOnly = args[0] === "--check";
  const targets = checkOnly ? args.slice(1) : args;
  let files = 0, changed = 0, edits = 0, privs = 0, failed = 0;
  const walk = (t, cb) => {
    const st = fs.statSync(t);
    if (st.isFile()) { cb(t); return; }
    for (const e of fs.readdirSync(t, { withFileTypes: true })) {
      const p = path.join(t, e.name);
      if (e.isDirectory()) walk(p, cb); else cb(p);
    }
  };
  const jobs = [];
  for (const t of targets) walk(t, (p) => {
    if (!/\.(js|mjs)$/.test(p)) return;
    files++;
    jobs.push(p);
  });
  for (const p of jobs) {
    const src = fs.readFileSync(p, "utf8");
    if (src.startsWith("/* dsh-mobile-es83")) continue;
    let r;
    try { r = await downlevel(src); }
    catch (e) { console.log("  FAIL " + p + "\n       " + e.message.split("\n")[0].slice(0, 140)); failed++; continue; }
    if (!r.count && !r.private) continue;
    changed++; edits += r.count; if (r.private) privs++;
    console.log(`  ${String(r.count).padStart(3)} logical${r.private ? " + private" : ""}  ${p}`);
    if (!checkOnly) fs.writeFileSync(p, r.code);
  }
  console.log(`scanned=${files} changed=${changed} logical-edits=${edits} private-files=${privs} failed=${failed}`);
  if (checkOnly && changed > 0) process.exit(1);
}
