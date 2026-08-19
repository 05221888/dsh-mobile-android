/* dsh-mobile-compat: inject before DSH bundle. Safe to run twice. */
(function () {
  if (window.__dshMobileCompat) return;
  window.__dshMobileCompat = true;

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function" && crypto.getRandomValues) {
    crypto.randomUUID = function () {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map.call(bytes, function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    };
  }

  if (typeof AbortSignal !== "undefined") {
    if (typeof AbortSignal.timeout !== "function") {
      AbortSignal.timeout = function (ms) {
        var controller = new AbortController();
        setTimeout(function () { controller.abort(); }, ms);
        return controller.signal;
      };
    }
    if (typeof AbortSignal.any !== "function") {
      AbortSignal.any = function (signals) {
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
      };
    }
  }

  if (typeof Promise !== "undefined" && typeof Promise.any !== "function") {
    var AggregateErrorCtor = (typeof AggregateError !== "undefined") ? AggregateError : function (errors, msg) {
      var e = new Error(msg || "All promises were rejected");
      e.name = "AggregateError";
      e.errors = errors;
      return e;
    };
    Promise.any = function (values) {
      return Promise.all(Array.from(values, function (p) {
        return Promise.resolve(p).then(
          function (value) { return Promise.reject(value); },
          function (err) { return Promise.resolve(err); }
        );
      })).then(function (errors) {
        throw new AggregateErrorCtor(errors, "All promises were rejected");
      }, function (value) {
        return value;
      });
    };
  }
})();
