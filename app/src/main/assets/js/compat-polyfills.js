/* dsh-mobile-compat: runtime polyfills for the dsh front-end.
 *
 * Targets Chromium < 93 — notably the stock Android 10 / MIUI WebView 83 that
 * ships on devices like the Xiaomi MIX 2S. dsh's SPA uses APIs newer than that
 * engine, and without these the bundle dies before it can mount:
 *   `Object.hasOwn is not a function` on index-*.js (Chrome 93).
 *
 * PARSER-level gaps are NOT handled here (a polyfill cannot rescue a file the
 * engine refuses to parse). Those are rewritten at build time by
 * scripts/web-legacy/ — logical assignment `??= ||= &&=` (Chrome 85) and
 * private class members (Chrome 84).
 *
 * Injected inline into the served index.html by scripts/web-legacy/gen_legacy.mjs
 * so it runs BEFORE the module bundle (onPageStarted injection lands too late
 * for a <script type="module"> in <head>). Safe to run twice.
 */
(function () {
  if (window.__dshMobileCompat) return;
  window.__dshMobileCompat = true;

  function def(target, name, fn) {
    try {
      Object.defineProperty(target, name, {
        value: fn, writable: true, configurable: true, enumerable: false,
      });
    } catch (e) { /* already present or frozen */ }
  }

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function" && crypto.getRandomValues) {
    def(crypto, "randomUUID", function () {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map.call(bytes, function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    });
  }

  if (typeof Object.hasOwn !== "function") {
    // ES2022 (Chrome 93)
    def(Object, "hasOwn", function hasOwn(target, property) {
      if (target === null || target === undefined) {
        throw new TypeError("Cannot convert undefined or null to object");
      }
      return Object.prototype.hasOwnProperty.call(Object(target), property);
    });
  }

  if (typeof Array.prototype.at !== "function") {
    // ES2022 (Chrome 92)
    def(Array.prototype, "at", function at(index) {
      var len = this.length >>> 0;
      var i = Math.trunc(index) || 0;
      if (i < 0) i += len;
      return (i < 0 || i >= len) ? undefined : this[i];
    });
    def(String.prototype, "at", function at(index) {
      var s = String(this);
      var i = Math.trunc(index) || 0;
      if (i < 0) i += s.length;
      return (i < 0 || i >= s.length) ? undefined : s.charAt(i);
    });
  }

  if (typeof Array.prototype.findLast !== "function") {
    // ES2023 (Chrome 97)
    def(Array.prototype, "findLast", function findLast(predicate, thisArg) {
      if (this == null) throw new TypeError("Array.prototype.findLast called on null or undefined");
      if (typeof predicate !== "function") throw new TypeError("predicate must be a function");
      for (var i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    });
    def(Array.prototype, "findLastIndex", function findLastIndex(predicate, thisArg) {
      if (this == null) throw new TypeError("Array.prototype.findLastIndex called on null or undefined");
      if (typeof predicate !== "function") throw new TypeError("predicate must be a function");
      for (var i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    });
  }

  if (typeof String.prototype.replaceAll !== "function") {
    // ES2021 (Chrome 85)
    def(String.prototype, "replaceAll", function replaceAll(search, replacement) {
      if (search instanceof RegExp) {
        if (!search.global) throw new TypeError("replaceAll must be called with a global RegExp");
        return String(this).replace(search, replacement);
      }
      return String(this).split(String(search)).join(String(replacement));
    });
  }

  if (typeof structuredClone !== "function") {
    // Chrome 98. Covers the JSON-safe shapes the front-end clones
    // (plain objects/arrays/Map/Set/Date) — enough for its state snapshots.
    window.structuredClone = function structuredClone(value) {
      if (value === null || typeof value !== "object") return value;
      if (typeof value === "function") throw new Error("DataCloneError: could not be cloned");
      if (value instanceof Date) return new Date(value.getTime());
      if (value instanceof RegExp) return new RegExp(value.source, value.flags);
      if (value instanceof Map) {
        var m = new Map();
        value.forEach(function (v, k) { m.set(structuredClone(k), structuredClone(v)); });
        return m;
      }
      if (value instanceof Set) {
        var s = new Set();
        value.forEach(function (v) { s.add(structuredClone(v)); });
        return s;
      }
      if (Array.isArray(value)) return value.map(structuredClone);
      var proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        var out = {};
        Object.keys(value).forEach(function (k) { out[k] = structuredClone(value[k]); });
        return out;
      }
      return value;
    };
  }

  if (typeof AggregateError === "undefined") {
    window.AggregateError = function AggregateError(errors, message) {
      var e = new Error(message);
      e.name = "AggregateError";
      e.errors = errors;
      return e;
    };
  }

  if (typeof AbortSignal !== "undefined") {
    if (typeof AbortSignal.timeout !== "function") {
      // Chrome 103
      def(AbortSignal, "timeout", function (ms) {
        var controller = new AbortController();
        setTimeout(function () { controller.abort(); }, ms);
        return controller.signal;
      });
    }
    if (typeof AbortSignal.any !== "function") {
      // Chrome 116
      def(AbortSignal, "any", function (signals) {
        var controller = new AbortController();
        var list = signals || [];
        for (var i = 0; i < list.length; i++) {
          var signal = list[i];
          if (!signal) continue;
          if (signal.aborted) {
            controller.abort(signal.reason);
            return controller.signal;
          }
          signal.addEventListener("abort", function () {
            controller.abort(this.reason);
          }, { once: true });
        }
        return controller.signal;
      });
    }
  }

  if (typeof Promise !== "undefined" && typeof Promise.any !== "function") {
    // Chrome 85
    Promise.any = function (values) {
      return Promise.all(Array.from(values, function (p) {
        return Promise.resolve(p).then(
          function (value) { return Promise.reject(value); },
          function (err) { return Promise.resolve(err); }
        );
      })).then(function (errors) {
        throw new AggregateError(errors, "All promises were rejected");
      }, function (value) {
        return value;
      });
    };
  }

  if (typeof WeakRef === "undefined") {
    // Chrome 84. True weakness cannot be emulated; a strong-hold shim keeps
    // identity and deref() working for the front-end's caches.
    window.WeakRef = function WeakRef(target) { this._ref = { value: target }; };
    window.WeakRef.prototype.deref = function () { return this._ref.value; };
    window.FinalizationRegistry = function FinalizationRegistry() {};
    window.FinalizationRegistry.prototype.register = function () {};
    window.FinalizationRegistry.prototype.unregister = function () {};
    window.FinalizationRegistry.prototype.cleanupSome = function () {};
  }

  if (typeof Symbol.dispose === "undefined") {
    Symbol.dispose = Symbol.for("Symbol.dispose");
  }

  /* ---- CSS `inset` 简写（Chrome 87）---------------------------------------
   * [dsh-mobile-inset-shim] —— 这个字面量是 applyAssetPatch 的补丁代次标记：
   * 老版本铺过的 index.html 不带它，升级后才会被重铺（否则新补丁永远上不去）。
   * 本机 WebView 是 Chromium 83，解析不了 `inset` 简写（Chrome 87 才有）——整条声明
   * 被丢掉，于是 dsh 里所有 `position:fixed; inset:0` 的弹层都回落到 static position：
   *   · 设置面板跑到屏幕外/被裁掉 → 「点开设置划不到底、自定义提供方配不了 API Key」
   *   · 生图弹窗、输入框覆盖层同理（position:absolute; inset:0）
   * CSS 属性没法在运行时 polyfill，但可以在样式文本进引擎之前把简写展开成
   * top/right/bottom/left 四条。只在引擎真的不支持时才装。
   */
  (function () {
    var supportsInset = false;
    try {
      supportsInset = !!(window.CSS && CSS.supports && CSS.supports("inset", "0"));
    } catch (e) { /* 老引擎没有 CSS.supports */ }
    if (supportsInset) return;

    // 只认属性名本身：`--x-inset:` / `inset-inline-start:` / `box-shadow: inset ...`
    // 都不能碰（前者是自定义属性，后两者不是简写）。
    var RE = /(^|[;{\s])inset\s*:\s*([^;{}"']+)/g;

    /** 按顶层空白切分（calc(...) / var(...) 里的空格不算分隔符）。 */
    function splitTop(value) {
      var parts = [], depth = 0, cur = "";
      for (var i = 0; i < value.length; i++) {
        var ch = value.charAt(i);
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        if (depth === 0 && (ch === " " || ch === "\t" || ch === "\n" || ch === "\r")) {
          if (cur) { parts.push(cur); cur = ""; }
          continue;
        }
        cur += ch;
      }
      if (cur) parts.push(cur);
      return parts;
    }

    /** `inset: a [b [c [d]]]` → top/right/bottom/left（含 !important）。 */
    function expand(css) {
      if (!css || css.indexOf("inset") < 0) return css;
      return css.replace(RE, function (all, lead, raw) {
        var value = String(raw), important = "";
        var m = /!\s*important\s*$/i.exec(value);
        if (m) { important = " !important"; value = value.slice(0, m.index); }
        var p = splitTop(value.replace(/^\s+|\s+$/g, ""));
        if (!p.length || p.length > 4) return all;
        var top, right, bottom, left;
        if (p.length === 1) { top = right = bottom = left = p[0]; }
        else if (p.length === 2) { top = bottom = p[0]; right = left = p[1]; }
        else if (p.length === 3) { top = p[0]; right = left = p[1]; bottom = p[2]; }
        else { top = p[0]; right = p[1]; bottom = p[2]; left = p[3]; }
        return lead + "top:" + top + ";right:" + right + ";bottom:" + bottom + ";left:" + left + important;
      });
    }

    /** 处理一个 <style>（已处理过同一份文本就跳过，避免观察者自激）。 */
    function fixStyleEl(el) {
      if (!el || el.nodeType !== 1) return;
      if (el.tagName === "STYLE") {
        var text = el.textContent;
        if (!text || text.indexOf("inset") < 0) return;
        if (el.__dshInsetFixed === text) return;
        var fixed = expand(text);
        el.__dshInsetFixed = fixed;
        if (fixed !== text) el.textContent = fixed;
        return;
      }
      if (el.querySelectorAll) {
        var list = el.querySelectorAll("style");
        for (var i = 0; i < list.length; i++) fixStyleEl(list[i]);
      }
    }

    try {
      var existing = document.querySelectorAll("style");
      for (var i = 0; i < existing.length; i++) fixStyleEl(existing[i]);
    } catch (e) { /* 文档还没就绪 */ }

    try {
      var observer = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var mu = muts[i];
          if (mu.type === "childList") {
            for (var j = 0; j < mu.addedNodes.length; j++) fixStyleEl(mu.addedNodes[j]);
          } else if (mu.type === "characterData" && mu.target.parentNode) {
            fixStyleEl(mu.target.parentNode);
          }
        }
      });
      observer.observe(document.documentElement || document, {
        childList: true, subtree: true, characterData: true,
      });
    } catch (e) { /* 没有 MutationObserver：退化成只处理已有样式 */ }

    if (window.CSSStyleSheet && CSSStyleSheet.prototype) {
      var rawInsert = CSSStyleSheet.prototype.insertRule;
      if (typeof rawInsert === "function") {
        def(CSSStyleSheet.prototype, "insertRule", function (rule, index) {
          return rawInsert.call(this, typeof rule === "string" ? expand(rule) : rule, index);
        });
      }
      var rawReplaceSync = CSSStyleSheet.prototype.replaceSync;
      if (typeof rawReplaceSync === "function") {
        def(CSSStyleSheet.prototype, "replaceSync", function (text) {
          return rawReplaceSync.call(this, typeof text === "string" ? expand(text) : text);
        });
      }
    }
  })();
})();
