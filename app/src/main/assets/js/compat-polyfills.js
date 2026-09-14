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
})();
