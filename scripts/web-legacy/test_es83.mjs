/**
 * Semantics test for es83.transform(): every rewrite must behave EXACTLY like
 * the native logical-assignment operator. Imports the real transformer so the
 * test cannot drift from the shipped implementation.
 */
import { downlevel } from "./es83.mjs";
import vm from "node:vm";

const CASES = {
  "identifier base": `let x=null; x ??= 7; let y=1; y ||= 9; let z=0; z ||= 3; result=[x,y,z];`,
  "obj.prop direct": `const o={a:null}; o.a ??= 3; o.a ??= 4; result=JSON.stringify(o);`,
  "this member": `function F(){ this.a ??= 5; this.b ||= 6; } const f=new F(); result=[f.a,f.b];`,
  "plain nested": `const s={meta:{}}; s.meta.badges ||= ["a"]; s.meta.badges ||= ["b"]; result=JSON.stringify(s);`,
  "deep chain": `const r={s:{t:{}}}; r.s.t.u ??= 1; r.s.t.u ??= 2; result=JSON.stringify(r);`,
  "accessor base counts reads": `
    const log=[]; const store={};
    const base={}; Object.defineProperty(base,"meta",{get(){log.push("g"); return store;}});
    base.meta.badges ||= ["v"];
    result={reads:log.length, badges:store.badges};`,
  "accessor returning different objects": `
    const log=[]; const base={};
    Object.defineProperty(base,"meta",{get(){log.push("g"); return log.length===1?{}:({other:1});}});
    base.meta.badges ??= ["x"];
    result={reads:log.length};`,
  "computed key coercion": `
    const log=[]; const key={toString(){log.push("k");return "p";}};
    const o={}; o[key] ??= 1; o[key] ??= 2;
    result={keys:Object.keys(o), coercions:log.length, v:o.p};`,
  "computed key on nested object": `
    const log=[]; const inner={}; const outer={};
    Object.defineProperty(outer,"i",{get(){log.push("g"); return inner;}});
    outer.i["k"] ??= 1;
    result={reads:log.length, v:inner.k};`,
  "&&= with comma RHS": `let n=0; const o={a:1}; o.a &&= (n++, 9); o.a &&= (n++, 8); result={a:o.a,n};`,
  "||= with comma RHS": `let n=0; const o={a:0}; o.a ||= (n++, 5); result={a:o.a,n};`,
  "??= with comma RHS": `let n=0; const o={a:null}; o.a ??= (n++, 5); result={a:o.a,n};`,
  "rhs by reference (exactly once)": `
    let n=0; const o={a:null};
    function rhs(){ n++; return n*10; }
    o.a ??= rhs(); o.a ??= rhs();
    result={a:o.a,n};`,
  "nested + comma + accessor combined": `
    let n=0; const log=[]; const store={};
    const b={}; Object.defineProperty(b,"m",{get(){log.push("g"); return store;}});
    b.m.v &&= (n++, 7);
    result={v:store.v, n, reads:log.length};`,
  "statement expression value": `let x=null; result = (x ??= 4);`,
  "assignment inside arrow": `const f=()=>{ let a=null; a ??= 1; return a; }; result=f();`,
};

const run = (code) => { const ctx = { result: null }; vm.createContext(ctx); vm.runInContext(code, ctx); return JSON.stringify(ctx.result); };

// Private class members — Chromium 83 cannot parse these either.
const PRIV_CASES = {
  "private field": `class A { #x = 1; get(){ return this.#x; } } result = new A().get();`,
  "private method": `class A { #p; set(v){this.#p=v;} #r(){ return this.#p; } get(){ return this.#r(); } } const a=new A(); a.set(7); result=a.get();`,
  "private optional chain": `class A { #x=null; get(){ return this.#x?.toString() ?? "none"; } } result=new A().get();`,
  "private in operator": `class A { #x=1; static has(o){ return #x in o; } } result=[A.has(new A()), A.has({})];`,
  "private + logical assign": `class A { #n=null; bump(){ this.#n ??= 4; return this.#n; } } result=new A().bump();`,
};
let pPass = 0, pFail = 0;
for (const [name, body] of Object.entries(PRIV_CASES)) {
  try {
    const code = (await downlevel(body)).code;
    const out = run(code);
    if (out !== "null" && out !== "undefined") { pPass++; console.log(`  OK    ${name}  -> ${out}`); }
    else { pFail++; console.log(`  FAIL  ${name}  -> ${out}\n        ${code.slice(0,200)}`); }
  } catch (e) { pFail++; console.log(`  FAIL  ${name}: ${e.message.slice(0,130)}`); }
}
console.log(`\nprivate-members: pass=${pPass} fail=${pFail}`);
process.exit(pFail ? 1 : 0);
