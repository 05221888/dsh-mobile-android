window.__ModuleLoader__.load({id:"dsh-notify-sound",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var API = "/notify-sound/api";
var WS_PATH = "/notify-sound/ws";
var SOUNDS_PATH = "/notify-sound/sounds";
var prefsState = {
  enabled: true,
  sound: "staplebops-01.aac",
  volume: 0.8
};
async function call(method, payload = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || parsed?.ok !== true) {
    throw new Error(parsed?.error?.message ?? `HTTP ${res.status}`);
  }
  return parsed.value;
}
var lastAudio = null;
function playCurrent() {
  const p = prefsState;
  if (!p.enabled) return;
  try {
    if (lastAudio) {
      lastAudio.pause();
      lastAudio = null;
    }
    const audio = new Audio(`${SOUNDS_PATH}/${p.sound}`);
    audio.volume = p.volume;
    lastAudio = audio;
    audio.play().catch(() => {
    });
  } catch {
  }
}
function connectPlayer() {
  let ws = null;
  let stopped = false;
  let timer;
  const connect = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${WS_PATH}`);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg?.type === "turn/end") playCurrent();
      } catch {
      }
    };
    ws.onclose = () => scheduleReconnect();
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
      }
    };
  };
  const scheduleReconnect = () => {
    if (stopped) return;
    timer = window.setTimeout(connect, 3e3);
  };
  connect();
  return () => {
    stopped = true;
    if (timer !== void 0) window.clearTimeout(timer);
    try {
      ws?.close();
    } catch {
    }
  };
}
var rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)"
};
var labelStyle = { fontSize: 13, color: "#e6edf3" };
var descStyle = { fontSize: 12, color: "#9da7b3", marginTop: 2 };
var selectStyle = {
  background: "#1b1b22",
  color: "#e6edf3",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 13,
  minWidth: 180
};
var buttonStyle = {
  background: "rgba(255,255,255,0.08)",
  color: "#e6edf3",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  padding: "6px 14px",
  fontSize: 13,
  cursor: "pointer"
};
function SettingsSection() {
  const [enabled, setEnabled] = (0, import_react.useState)(prefsState.enabled);
  const [sound, setSound] = (0, import_react.useState)(prefsState.sound);
  const [volume, setVolume] = (0, import_react.useState)(prefsState.volume);
  const [sounds, setSounds] = (0, import_react.useState)([]);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [error, setError] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, view] = await Promise.all([
          call("sounds.list"),
          call("prefs.get")
        ]);
        if (cancelled) return;
        const names = list.sounds;
        setSounds(names);
        const v = view?.value;
        if (v && typeof v === "object") {
          if (typeof v.enabled === "boolean") setEnabled(v.enabled);
          if (typeof v.sound === "string" && names.includes(v.sound)) setSound(v.sound);
          if (typeof v.volume === "number") setVolume(v.volume);
        }
        if (!names.includes(sound)) setSound("staplebops-01.aac");
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const persist = async (patch) => {
    try {
      await call("prefs.update", { patch, expectedRevision: void 0 });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const onToggle = (next) => {
    setEnabled(next);
    prefsState.enabled = next;
    void persist({ enabled: next });
  };
  const onSound = (next) => {
    setSound(next);
    prefsState.sound = next;
    void persist({ sound: next });
  };
  const onVolume = (next) => {
    setVolume(next);
    prefsState.volume = next;
    void persist({ volume: next });
  };
  const preview = () => {
    try {
      const audio = new Audio(`${SOUNDS_PATH}/${sound}`);
      audio.volume = volume;
      audio.play().catch(() => {
      });
    } catch {
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "4px 2px" }, children: [
    loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: descStyle, children: "\u52A0\u8F7D\u4E2D\u2026" }),
    error !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...descStyle, color: "#f2a1a1" }, children: error }),
    !loading && error === "" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: rowStyle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: labelStyle, children: "\u56DE\u590D\u5B8C\u6210\u63D0\u793A\u97F3" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: descStyle, children: "AI \u56DE\u590D\u5B8C\u6BD5\u540E\u64AD\u653E\u63D0\u793A\u97F3" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "center", cursor: "pointer", gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked: enabled,
              onChange: (e) => onToggle(e.target.checked),
              style: { width: 15, height: 15, accentColor: "#4f8cff" }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: labelStyle, children: enabled ? "\u5DF2\u5F00\u542F" : "\u5DF2\u5173\u95ED" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: rowStyle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: labelStyle, children: "\u63D0\u793A\u97F3" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: descStyle, children: "\u9009\u62E9\u56DE\u590D\u5B8C\u6210\u65F6\u64AD\u653E\u7684\u97F3\u6548" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: sound, onChange: (e) => onSound(e.target.value), style: selectStyle, children: sounds.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: name, children: name.replace(/\.aac$/, "") }, name)) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: preview, style: buttonStyle, title: "\u8BD5\u542C", children: "\u8BD5\u542C" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: rowStyle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: labelStyle, children: "\u97F3\u91CF" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: descStyle, children: [
            Math.round(volume * 100),
            "%"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "range",
            min: 0,
            max: 1,
            step: 0.05,
            value: volume,
            onChange: (e) => onVolume(Number(e.target.value)),
            style: { width: 180, accentColor: "#4f8cff" }
          }
        )
      ] })
    ] })
  ] });
}
var inject = ["slots", "connection"];
function apply(ctx) {
  ctx.effect(() => {
    call("prefs.get").then((view) => {
      const v = view?.value;
      if (v && typeof v === "object") {
        if (typeof v.enabled === "boolean") prefsState.enabled = v.enabled;
        if (typeof v.sound === "string") prefsState.sound = v.sound;
        if (typeof v.volume === "number") prefsState.volume = v.volume;
      }
    }).catch(() => {
    });
    return connectPlayer();
  }, "dsh-notify-sound: player");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "notify-sound",
    order: 100,
    label: () => "\u63D0\u793A\u97F3",
    inject: () => ({})
  }, SettingsSection));
}
return module.exports;}});
