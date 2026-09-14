/* dsh-mobile-es83: syntax downleveled for Chromium<85 (logical assignment / private class members) */
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _classPrivateMethodInitSpec(e, a) { _checkPrivateRedeclaration(e, a), a.add(e); }
function _classPrivateFieldInitSpec(e, t, a) { _checkPrivateRedeclaration(e, t), t.set(e, a); }
function _checkPrivateRedeclaration(e, t) { if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object"); }
function _classPrivateFieldGet(s, a) { return s.get(_assertClassBrand(s, a)); }
function _classPrivateFieldSet(s, a, r) { return s.set(_assertClassBrand(s, a), r), r; }
function _assertClassBrand(e, t, n) { if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n; throw new TypeError("Private element is not present on this object"); }
window.__ModuleLoader__.load({
  id: "@dsh-android/dsh-client-ui-responsive",
  factory: require => {
    var _panels, _Class_brand, _ThemePresenter;
    var module = {
      exports: {}
    };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, {
      value: "Module"
    });
    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");
    let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
    /** Viewport width below which the sidebar auto-collapses to the rail (deepsuite
    * LG breakpoint); a manual toggle below it re-expands over the squeezed center
    * (stores.ts narrowExpanded). */
    const SIDEBAR_AUTO_COLLAPSE = 1024;
    /**
    * Clamp a panel width into its contract range.
    * @param px - requested width.
    * @param min - range lower bound.
    * @param max - range upper bound.
    * @returns the clamped width.
    */
    function clampWidth(px, min, max) {
      return Math.min(max, Math.max(min, Math.round(px)));
    }
    /**
    * Solve the three column widths for one viewport frame. Pure: no hysteresis —
    * the output is a function of (viewport, preferences) only, so recovery on
    * re-widening is automatic. Preferences re-clamp here because they cross the
    * store boundary and callers may still supply stale ranges.
    * @param viewport - available frame width in px.
    * @param sidebar - sidebar width preference in px (0 = closed).
    * @param details - details width preference in px (0 = closed).
    * @returns resolved widths; details 0 means visually closed (never unmounted), while a closed sidebar keeps its compact rail.
    */
    function computeColumns(viewport, sidebar, details) {
      const s = sidebar === 0 ? 56 : clampWidth(sidebar, 264, 420);
      const d0 = details === 0 ? 0 : clampWidth(details, 300, 520);
      if (s + d0 + 640 <= viewport) return {
        sidebar: s,
        center: viewport - s - d0,
        details: d0
      };
      const d1 = d0 === 0 ? 0 : Math.max(300, viewport - s - 640);
      if (s + d1 + 640 <= viewport) return {
        sidebar: s,
        center: 640,
        details: d1
      };
      return {
        sidebar: s,
        center: Math.max(0, viewport - s),
        details: 0
      };
    }
    //#endregion
    //#region \0dsh-css:D:\coding\dsh-mobile\dsh-client-ui-responsive\src\client\AppFrame.module.css.mjs
    const css$1 = "._3HOSdG_frame{background:var(--dsw-alias-bg-base);height:100%;transition:grid-template-columns var(--ds-transition-duration-slow) var(--ds-ease-in-out);grid-template-rows:100%;display:grid;position:relative;overflow:hidden}._3HOSdG_frame[data-dragging]{transition:none}@media (prefers-reduced-motion:reduce){._3HOSdG_frame{transition:none}}._3HOSdG_sidebarCol{background:var(--dsw-specific-sidebar-fill);border-right:1px solid var(--dsw-alias-border-l1);min-width:0;overflow:hidden}._3HOSdG_centerCol{flex-direction:column;min-width:0;display:flex;overflow:hidden}._3HOSdG_detailsCol{border-left:1px solid var(--dsw-alias-border-l2);min-width:0;overflow:hidden}._3HOSdG_frame[data-details-collapsed] ._3HOSdG_detailsCol{border-left:none}._3HOSdG_handle{cursor:col-resize;z-index:2;touch-action:none;width:8px;transition:left var(--ds-transition-duration-slow) var(--ds-ease-in-out);margin-left:-4px;position:absolute;top:0;bottom:0}._3HOSdG_frame[data-dragging] ._3HOSdG_handle{transition:none}@media (prefers-reduced-motion:reduce){._3HOSdG_handle{transition:none}}._3HOSdG_handle[data-side=details]:after{content:\"\";box-sizing:border-box;background:var(--dsw-alias-button-floating-fill);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);opacity:0;width:12px;height:32px;transition:opacity var(--ds-transition-duration-slow) var(--ds-ease-in-out), background var(--ds-transition-duration-slow) var(--ds-ease-in-out);border-radius:10px;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}._3HOSdG_detailsCol:hover~._3HOSdG_handle[data-side=details]:after,._3HOSdG_handle[data-side=details]:hover:after,._3HOSdG_handle[data-side=details][data-dragging=true]:after{opacity:1}._3HOSdG_handle[data-side=details]:hover:after,._3HOSdG_handle[data-side=details][data-dragging=true]:after{background:var(--dsw-alias-button-floating-hover);border-color:var(--dsw-alias-border-l3)}._3HOSdG_overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}._3HOSdG_overlayLayer>*{pointer-events:auto}._3HOSdG_mobileFrame{background:var(--dsw-alias-bg-base);flex-direction:column;height:100%;display:flex;position:relative;overflow:hidden}._3HOSdG_mobileTopBar{padding:calc(env(safe-area-inset-top) + 8px) 12px 8px;background:var(--dsw-specific-sidebar-fill);border-bottom:1px solid var(--dsw-alias-border-l1);z-index:3;align-items:center;gap:8px;display:flex}._3HOSdG_mobileHamburger{width:44px;height:44px;color:var(--dsw-alias-text-l1);cursor:pointer;touch-action:manipulation;background:0 0;border:none;border-radius:10px;flex:none;font-size:20px}._3HOSdG_mobileHamburger:active{background:var(--dsw-alias-button-floating-fill)}._3HOSdG_mobileTitle{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-text-l1);font-size:16px;font-weight:600;overflow:hidden}._3HOSdG_mobileBody{flex-direction:column;flex:1;min-height:0;display:flex}._3HOSdG_mobileBody ._3HOSdG_centerCol{flex:1}._3HOSdG_mobileSheet{background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2);z-index:8;max-height:70%;padding-bottom:env(safe-area-inset-bottom);transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out);border-radius:16px 16px 0 0;flex-direction:column;display:flex;position:absolute;bottom:0;left:0;right:0;transform:translateY(100%)}._3HOSdG_mobileSheet[data-open]{transform:translateY(0)}._3HOSdG_mobileSheetGrab{background:var(--dsw-alias-border-l2);cursor:pointer;touch-action:manipulation;border-radius:4px;flex:none;width:44px;height:8px;margin:8px auto 4px}._3HOSdG_mobileSheet>:last-child{min-height:0;overflow:auto}._3HOSdG_mobileMask{background:var(--dsw-alias-overlay-mask);opacity:0;pointer-events:none;z-index:9;transition:opacity var(--ds-transition-duration-slow) var(--ds-ease-in-out);position:absolute;inset:0}._3HOSdG_mobileMask[data-open]{opacity:1;pointer-events:auto}._3HOSdG_mobileDrawer{background:var(--dsw-specific-sidebar-fill);border-right:1px solid var(--dsw-alias-border-l1);z-index:10;width:min(300px,85vw);padding-top:env(safe-area-inset-top);transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out);flex-direction:column;display:flex;position:absolute;top:0;bottom:0;left:0;transform:translate(-100%)}._3HOSdG_mobileDrawer[data-open]{transform:translate(0)}._3HOSdG_mobileDrawer>*{min-height:0;overflow:auto}@media (prefers-reduced-motion:reduce){._3HOSdG_mobileSheet,._3HOSdG_mobileMask,._3HOSdG_mobileDrawer{transition:none}}";
    const tagId$1 = "@dsh-android/dsh-client-ui-responsive/AppFrame.module.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "@dsh-android/dsh-client-ui-responsive";
      tag.dataset.pluginCss = tagId$1;
      tag.textContent = css$1;
      document.head.appendChild(tag);
    }
    var AppFrame_module_css_default = {
      "sidebarCol": "_3HOSdG_sidebarCol",
      "handle": "_3HOSdG_handle",
      "mobileMask": "_3HOSdG_mobileMask",
      "mobileHamburger": "_3HOSdG_mobileHamburger",
      "detailsCol": "_3HOSdG_detailsCol",
      "mobileFrame": "_3HOSdG_mobileFrame",
      "mobileTopBar": "_3HOSdG_mobileTopBar",
      "overlayLayer": "_3HOSdG_overlayLayer",
      "frame": "_3HOSdG_frame",
      "mobileBody": "_3HOSdG_mobileBody",
      "mobileDrawer": "_3HOSdG_mobileDrawer",
      "centerCol": "_3HOSdG_centerCol",
      "mobileSheet": "_3HOSdG_mobileSheet",
      "mobileTitle": "_3HOSdG_mobileTitle",
      "mobileSheetGrab": "_3HOSdG_mobileSheetGrab"
    };
    //#endregion
    //#region src/client/AppFrame.tsx
    /**
    * Three-column shell frame, registered into the built-in 'root' slot (the web
    * shell renders only 'root'). Owns the grid tracks (sidebar | center |
    * details), the drag handles (pointer capture + rAF throttle), the concession
    * chain (columns.ts), and the child-slot render decisions: the sidebar slot
    * renders HERE with live parameters from the concession solve, and the
    * session-aware occupants render in fixed column positions; strict entries
    * gate themselves on current-session availability while session-maybe
    * entries retain identity. Pure component: everything arrives
    * through the three framework shares — zero cordis or framework imports,
    * zero self-made hooks.
    */
    /** Center column grid item (session-body building block). */
    function CenterColumn(props) {
      return /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
        className: AppFrame_module_css_default.centerCol,
        children: props.children
      });
    }
    /** Details column grid item; width 0 keeps the subtree mounted (never unmount on close). */
    function DetailsColumn(props) {
      return /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
        className: AppFrame_module_css_default.detailsCol,
        children: props.children
      });
    }
    /**
    * One drag handle: pointer capture, rAF-throttled dx reports against the drag-start origin.
    * `side` keys the hover-reveal CSS to the owning column.
    */
    function DragHandle(props) {
      const [dragging, setDragging] = (0, react.useState)(false);
      const origin = (0, react.useRef)(0);
      const latest = (0, react.useRef)(0);
      const frame = (0, react.useRef)(null);
      const callbacks = (0, react.useRef)({
        onStart: props.onStart,
        onDrag: props.onDrag,
        onEnd: props.onEnd
      });
      callbacks.current = {
        onStart: props.onStart,
        onDrag: props.onDrag,
        onEnd: props.onEnd
      };
      const onPointerDown = (0, react.useCallback)(e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = e.clientX;
        latest.current = e.clientX;
        callbacks.current.onStart();
        setDragging(true);
      }, []);
      const onPointerMove = (0, react.useCallback)(e => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        latest.current = e.clientX;
        frame.current ?? (frame.current = requestAnimationFrame(() => {
          frame.current = null;
          callbacks.current.onDrag(latest.current - origin.current);
        }));
      }, []);
      const onPointerUp = (0, react.useCallback)(e => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (frame.current !== null) {
          cancelAnimationFrame(frame.current);
          frame.current = null;
        }
        callbacks.current.onDrag(latest.current - origin.current);
        setDragging(false);
        callbacks.current.onEnd();
      }, []);
      return /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
        className: AppFrame_module_css_default.handle,
        style: {
          left: props.left
        },
        "data-side": props.side,
        "data-dragging": dragging || void 0,
        onPointerDown,
        onPointerMove,
        onPointerUp
      });
    }
    /** The three-column frame (see module doc). */
    function AppFrame({
      useStore,
      useSessions,
      actions,
      renderSlot
    }) {
      const panels = useStore(s => s);
      const detailsSession = useSessions(s => {
        const current = s.current;
        return current !== void 0 && s.byId[current]?.blank === false ? current : void 0;
      });
      const frameRef = (0, react.useRef)(null);
      const [viewport, setViewport] = (0, react.useState)(() => window.innerWidth);
      const lastSession = (0, react.useRef)(detailsSession);
      (0, react.useLayoutEffect)(() => {
        if (detailsSession === void 0) return;
        if (lastSession.current !== void 0 && lastSession.current !== detailsSession) actions.closeDetails();
        lastSession.current = detailsSession;
      }, [actions, detailsSession]);
      (0, react.useEffect)(() => {
        const el = frameRef.current;
        /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
        if (el === null) return;
        let raf = null;
        const observer = new ResizeObserver(() => {
          raf ?? (raf = requestAnimationFrame(() => {
            raf = null;
            const width = el.getBoundingClientRect().width;
            if (width > 0) setViewport(width);
          }));
        });
        observer.observe(el);
        return () => {
          observer.disconnect();
          if (raf !== null) cancelAnimationFrame(raf);
        };
      }, []);
      const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
      (0, react.useEffect)(() => {
        actions.setNarrow(narrow);
      }, [actions, narrow]);
      const mobile = viewport < 640;
      (0, react.useEffect)(() => {
        actions.setMobile(mobile);
      }, [actions, mobile]);
      const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0;
      const cols = computeColumns(viewport, sidebarCollapsed ? 0 : panels.sidebar === 0 ? 280 : panels.sidebar, detailsSession === void 0 ? 0 : panels.details);
      const colsRef = (0, react.useRef)(cols);
      colsRef.current = cols;
      const sidebarBase = (0, react.useRef)(0);
      const detailsBase = (0, react.useRef)(0);
      const [dragging, setDragging] = (0, react.useState)(false);
      const onDragEnd = (0, react.useCallback)(() => {
        setDragging(false);
      }, []);
      const onSidebarStart = (0, react.useCallback)(() => {
        sidebarBase.current = colsRef.current.sidebar;
        setDragging(true);
      }, []);
      const onDetailsStart = (0, react.useCallback)(() => {
        detailsBase.current = colsRef.current.details;
        setDragging(true);
      }, []);
      const onSidebarDrag = (0, react.useCallback)(dx => {
        actions.setSidebar(sidebarBase.current + dx);
      }, [actions]);
      const onDetailsDrag = (0, react.useCallback)(dx => {
        actions.setDetails(detailsBase.current - dx);
      }, [actions]);
      if (mobile) {
        const sheetOpen = detailsSession !== void 0 && panels.details > 0;
        return /* @__PURE__ */(0, react_jsx_runtime.jsxs)("div", {
          ref: frameRef,
          className: AppFrame_module_css_default.mobileFrame,
          "data-mobile": true,
          children: [/* @__PURE__ */(0, react_jsx_runtime.jsxs)("div", {
            className: AppFrame_module_css_default.mobileTopBar,
            children: [/* @__PURE__ */(0, react_jsx_runtime.jsx)("button", {
              type: "button",
              className: AppFrame_module_css_default.mobileHamburger,
              "aria-label": "打开导航",
              onClick: () => actions.toggleSidebar(),
              children: "☰"
            }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
              className: AppFrame_module_css_default.mobileTitle,
              children: "DeepSeek Harness"
            })]
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
            className: AppFrame_module_css_default.mobileBody,
            children: /* @__PURE__ */(0, react_jsx_runtime.jsx)(CenterColumn, {
              children: renderSlot("conversation", {})
            })
          }), /* @__PURE__ */(0, react_jsx_runtime.jsxs)("div", {
            className: AppFrame_module_css_default.mobileSheet,
            "data-open": sheetOpen || void 0,
            children: [/* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
              className: AppFrame_module_css_default.mobileSheetGrab,
              onClick: () => actions.closeDetails()
            }), renderSlot("details", {})]
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
            className: AppFrame_module_css_default.mobileMask,
            "data-open": panels.drawerOpen || void 0,
            onClick: () => actions.toggleSidebar()
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
            className: AppFrame_module_css_default.mobileDrawer,
            "data-open": panels.drawerOpen || void 0,
            children: renderSlot("sidebar", {
              collapsed: false,
              width: 300
            })
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
            className: AppFrame_module_css_default.overlayLayer,
            "data-shell-overlay": true,
            children: renderSlot("shell.overlay", {})
          })]
        });
      }
      return /* @__PURE__ */(0, react_jsx_runtime.jsxs)("div", {
        ref: frameRef,
        className: AppFrame_module_css_default.frame,
        style: {
          gridTemplateColumns: `${cols.sidebar}px minmax(0, 1fr) ${cols.details}px`
        },
        "data-sidebar-collapsed": sidebarCollapsed || void 0,
        "data-details-collapsed": cols.details === 0 || void 0,
        "data-dragging": dragging || void 0,
        children: [/* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
          className: AppFrame_module_css_default.sidebarCol,
          children: renderSlot("sidebar", {
            collapsed: sidebarCollapsed,
            width: cols.sidebar
          })
        }), /* @__PURE__ */(0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
          children: [/* @__PURE__ */(0, react_jsx_runtime.jsx)(CenterColumn, {
            children: renderSlot("conversation", {})
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)(DetailsColumn, {
            children: renderSlot("details", {})
          })]
        }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
          className: AppFrame_module_css_default.overlayLayer,
          "data-shell-overlay": true,
          children: renderSlot("shell.overlay", {})
        }), !sidebarCollapsed && /* @__PURE__ */(0, react_jsx_runtime.jsx)(DragHandle, {
          side: "sidebar",
          left: cols.sidebar,
          onStart: onSidebarStart,
          onDrag: onSidebarDrag,
          onEnd: onDragEnd
        }), cols.details > 0 && /* @__PURE__ */(0, react_jsx_runtime.jsx)(DragHandle, {
          side: "details",
          left: viewport - cols.details,
          onStart: onDetailsStart,
          onDrag: onDetailsDrag,
          onEnd: onDragEnd
        })]
      });
    }
    //#endregion
    //#region src/client/stores.ts
    /**
    * The root entry's transient layout store: panel geometry as plain widths in
    * px (0 = closed). Module level exports the factory only — a module-level
    * handle would pin the store's identity in the module
    * cache (a de-facto singleton surviving plugin reloads). register() receives
    * the factory (exclusive use: the framework instantiates per entry), AppFrame
    * derives its PropsStore share from the return type, and the service face
    * receives the bound actions through the registration's inject hook.
    */
    /**
    * Create the layout panel store handle. The preference IS the width, so
    * closing a panel forgets its drag width — reopening restores the contract
    * default. Actions are the complete write set: drag writes clamp
    * into the panel's contract range and never cross the open/closed line;
    * open/close transitions write 0 / the default explicitly. Below the
    * auto-collapse breakpoint (AppFrame feeds setNarrow) the sidebar toggle
    * flips the narrowExpanded override instead of the preference.
    * @returns the store handle (spec + type + identity + factory in one).
    */
    function createLayoutStore() {
      return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
        init: () => ({
          sidebar: 280,
          details: 0,
          narrow: false,
          narrowExpanded: false,
          mobile: false,
          drawerOpen: false
        }),
        actions: {
          setSidebar: (d, px) => {
            d.sidebar = clampWidth(px, 264, 420);
          },
          setDetails: (d, px) => {
            d.details = clampWidth(px, 300, 520);
          },
          toggleSidebar: d => {
            if (d.mobile) d.drawerOpen = !d.drawerOpen;else if (d.narrow) d.narrowExpanded = !d.narrowExpanded;else d.sidebar = d.sidebar === 0 ? 280 : 0;
          },
          setNarrow: (d, narrow) => {
            if (d.narrow === narrow) return;
            d.narrow = narrow;
            d.narrowExpanded = false;
          },
          setMobile: (d, mobile) => {
            if (d.mobile === mobile) return;
            d.mobile = mobile;
            if (mobile) d.drawerOpen = false;
          },
          openDetails: d => {
            if (d.details === 0) d.details = 360;
          },
          closeDetails: d => {
            d.details = 0;
          }
        }
      });
    }
    //#endregion
    //#region src/client/service.ts
    /** Cross-plugin panel-action face (ctx.layout). */
    var LayoutController = (_panels = /*#__PURE__*/new WeakMap(), _Class_brand = /*#__PURE__*/new WeakSet(), class LayoutController {
      constructor() {
        _classPrivateMethodInitSpec(this, _Class_brand);
        _classPrivateFieldInitSpec(this, _panels, void 0);
      }
      /**
      * Adopt the root entry's bound store actions. Called from the root
      * registration's inject hook (a sanctioned assembly side effect), so the
      * face is live from the entry's first render; on entry re-register the
      * fresh actions overwrite the stale set.
      * @param actions - bound actions of the entry's layout store instance.
      */
      attachPanels(actions) {
        _classPrivateFieldSet(_panels, this, actions);
      }
      /** Toggle the sidebar panel (closed ⟷ contract default width). */
      toggleSidebar() {
        _assertClassBrand(_Class_brand, this, _require).call(this).toggleSidebar();
      }
      /** Open the details panel (no-op when already open). */
      openDetails() {
        _assertClassBrand(_Class_brand, this, _require).call(this).openDetails();
      }
      /** Close the details panel. */
      closeDetails() {
        _assertClassBrand(_Class_brand, this, _require).call(this).closeDetails();
      }
    });
    //#endregion
    //#region src/client/theme-presenter.ts
    /** Body attribute selecting the dark base palette in the token stylesheets. */
    function _require() {
      if (_classPrivateFieldGet(_panels, this) === void 0) throw new Error("layout: panel actions not wired (root entry not mounted)");
      return _classPrivateFieldGet(_panels, this);
    }
    const DARK_ATTRIBUTE = "data-ds-dark-theme";
    /** Applies theme snapshots to the document; one instance per plugin fiber. */
    var ThemePresenter = (_ThemePresenter = class ThemePresenter {
      /** Create the presenter-owned metadata node before the first snapshot arrives. */
      constructor() {
        /** 最后写入者标记（L3）：全局写（colorScheme/暗色属性）只由最后 apply 的
        *  实例收回——HMR 双 fiber/多实例并存时，先 dispose 的实例不清掉后写入
        *  者的全局状态。 */
        _defineProperty(this, "uid", "p" + ThemePresenter.nextId++);
        /** Token 变量及其写入值（L3：dispose 只回收"值仍是我写的"变量——
        *  同名 token 被后写入者覆盖时，先 dispose 的实例不得删掉后写入者的值）。 */
        _defineProperty(this, "appliedTokens", /* @__PURE__ */new Map());
        /** The single metadata node this presenter inserts and removes. */
        _defineProperty(this, "themeColorMeta", void 0);
        this.themeColorMeta = document.createElement("meta");
        this.themeColorMeta.name = "theme-color";
      }
      /**
      * Project a snapshot onto the document: set root `color-scheme` and the body
      * palette attribute from `active.colorScheme` (never the id — `system` is
      * resolved upstream), then replace the previously applied token variables
      * with `active.tokens`. Browser theme-color metadata follows the computed
      * body background after those writes, so the rendered palette remains the
      * color authority.
      * @param snapshot - resolved theme snapshot from ctx.theme.
      */
      apply(snapshot) {
        const scheme = snapshot.active.colorScheme;
        document.documentElement.style.colorScheme = scheme;
        const body = document.body;
        if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "");else body.removeAttribute(DARK_ATTRIBUTE);
        document.documentElement.dataset.dshPresenter = this.uid;
        for (const [name, value] of this.appliedTokens) if (body.style.getPropertyValue(name) === value) body.style.removeProperty(name);
        this.appliedTokens.clear();
        for (const [name, value] of Object.entries(snapshot.active.tokens)) {
          body.style.setProperty(name, value);
          this.appliedTokens.set(name, value);
        }
        this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
        if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta);
      }
      /** Retract what this presenter wrote: global fields only when still owned
      *  (last writer), token variables and the owned metadata node always. */
      dispose() {
        if (document.documentElement.dataset.dshPresenter === this.uid) {
          document.documentElement.style.removeProperty("color-scheme");
          document.body.removeAttribute(DARK_ATTRIBUTE);
          delete document.documentElement.dataset.dshPresenter;
        }
        const body = document.body;
        for (const [name, value] of this.appliedTokens) if (body.style.getPropertyValue(name) === value) body.style.removeProperty(name);
        this.appliedTokens.clear();
        this.themeColorMeta.remove();
      }
    }, _defineProperty(_ThemePresenter, "nextId", 0), _ThemePresenter);
    //#endregion
    //#region src/client/theme-bridge.ts
    /**
    * ThemeBridge: make prefers-color-scheme follow the OS dark state on
    * WebViews whose media query does not track the system uiMode (observed on
    * vivo/Android 16: FORCE_DARK_AUTO leaves matchMedia stuck at light).
    *
    * The shell APK watches Configuration changes and pushes the dark flag via
    * window.__dshThemeBridge.setDark(dark). This module hooks matchMedia for the
    * (prefers-color-scheme: dark) query so the upstream ui-theme service
    * (default preference: system) resolves and live-updates through its own
    * listener — zero upstream changes.
    */
    var ThemeBridge = class ThemeBridge {
      constructor() {
        _defineProperty(this, "dark", false);
        _defineProperty(this, "listeners", /* @__PURE__ */new Set());
        _defineProperty(this, "patched", false);
      }
      /** Install the matchMedia hook and the bridge object (idempotent). */
      install() {
        if (this.patched) return;
        this.patched = true;
        const android = window.androidBridge;
        if (window.__dshThemeBridge) return;
        if (!android || typeof android.getSystemDark !== "function") return;
        const self = this;
        const nativeMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = query => {
          if (!query.includes("prefers-color-scheme")) return nativeMatchMedia(query);
          const onChange = () => {
            for (const listener of self.listeners) try {
              listener();
            } catch {}
          };
          return {
            get matches() {
              return self.dark;
            },
            get media() {
              return query;
            },
            get onchange() {
              return null;
            },
            set onchange(_v) {},
            addEventListener: (type, cb) => {
              if (type !== "change" || typeof cb !== "function") return;
              self.listeners.add(cb);
              onChange();
            },
            removeEventListener: (type, cb) => {
              if (type !== "change" || typeof cb !== "function") return;
              self.listeners.delete(cb);
            },
            addListener: cb => {
              self.listeners.add(cb);
            },
            removeListener: cb => {
              self.listeners.delete(cb);
            },
            dispatchEvent: () => false
          };
        };
        const globalObj = window;
        globalObj.__dshThemeBridge = {
          setDark: d => {
            if (self.dark === d) return;
            self.dark = d;
            for (const listener of self.listeners) try {
              listener();
            } catch {}
          }
        };
        try {
          if (android.getSystemDark()) globalObj.__dshThemeBridge.setDark(true);
        } catch {}
      }
    };
    //#endregion
    //#region src/client/enter-guard.ts
    /**
    * EnterGuard: mobile-form Enter-key semantics.
    *
    * On the phone soft keyboard the Enter (newline) key fires a plain keydown
    * Enter — upstream InputBar treats it as submit (keyboard.submit), and there
    * is no Shift to fall back on. This guard, on the mobile form only
    * (viewport < MOBILE_BREAKPOINT), intercepts a plain Enter inside the
    * composer textarea at document capture phase — before React's root listener
    * — and converts it into a newline insertion, leaving the send button as the
    * only send channel.
    *
    * Guards that must stay untouched:
    * - IME composition (isComposing / keyCode 229): the candidate-confirm Enter.
    * - Open command menu ([role=listbox]): Enter picks the highlighted item.
    * - Shift+Enter (external keyboards): upstream native newline.
    * - Desktop/wide viewport: upstream behavior unchanged.
    */
    var EnterGuard = class EnterGuard {
      constructor() {
        _defineProperty(this, "onKeyDown", event => {
          if (event.key !== "Enter" || event.shiftKey) return;
          if (event.isComposing || event.keyCode === 229) return;
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (target.closest("[data-composer-card] textarea") === null) return;
          if (document.querySelector("[role=\"listbox\"]") !== null) return;
          if (window.innerWidth >= 640) return;
          event.stopPropagation();
          event.preventDefault();
          const active = document.activeElement;
          if (active instanceof HTMLTextAreaElement && active === target) try {
            document.execCommand("insertText", false, "\n");
          } catch {}
        });
      }
      attach() {
        document.addEventListener("keydown", this.onKeyDown, {
          capture: true
        });
      }
      detach() {
        document.removeEventListener("keydown", this.onKeyDown, {
          capture: true
        });
      }
    };
    //#endregion
    //#region \0dsh-css:D:\coding\dsh-mobile\dsh-client-ui-responsive\src\client\ExportResultDialog.module.css.mjs
    const css = ".UmLI7a_backdrop{z-index:1;background:var(--dsw-alias-bg-mask-1,#0000003d);justify-content:center;align-items:center;padding:16px;display:flex;position:absolute;inset:0}.UmLI7a_dialog{box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l2,#0000001a);width:min(440px,100%);max-height:70%;color:var(--dsw-alias-label-primary,#0f1115);border-radius:12px;flex-direction:column;gap:12px;padding:16px;display:flex;overflow:auto}.UmLI7a_title{margin:0;font-size:16px;font-weight:600}.UmLI7a_detail{overflow-wrap:anywhere;white-space:pre-wrap;margin:0;font-size:13px;line-height:1.5}.UmLI7a_detail[data-status=success]{color:var(--dsw-alias-state-success-primary)}.UmLI7a_detail[data-status=error]{color:var(--dsw-alias-state-error-primary)}.UmLI7a_actions{justify-content:flex-end;display:flex}.UmLI7a_button{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground,#fff);cursor:pointer;border-radius:8px;padding:8px 14px;font-size:13px}.UmLI7a_button:hover{background:var(--dsw-alias-button-primary-hover)}";
    const tagId = "@dsh-android/dsh-client-ui-responsive/ExportResultDialog.module.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "@dsh-android/dsh-client-ui-responsive";
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }
    var ExportResultDialog_module_css_default = {
      "title": "UmLI7a_title",
      "detail": "UmLI7a_detail",
      "actions": "UmLI7a_actions",
      "dialog": "UmLI7a_dialog",
      "button": "UmLI7a_button",
      "backdrop": "UmLI7a_backdrop"
    };
    //#endregion
    //#region src/client/ExportResultDialog.tsx
    /**
    * Export-result dialog: the `shell.overlay` entry that renders the Android
    * shell's session-export outcome. Pure component: state arrives through the
    * store share, dismissal through the bound action. The markup reuses the
    * web-ui dialog conventions (role=dialog / aria-modal) and the shared design
    * tokens, so the dialog matches the app's modal surfaces.
    */
    /** The single entry component; renders nothing while no result is open. */
    function ExportResultDialog({
      useStore,
      actions
    }) {
      const state = useStore(s => s);
      (0, react.useEffect)(() => {
        if (!state.open) return;
        const onKeyDown = event => {
          if (event.key === "Escape") actions.close();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
          window.removeEventListener("keydown", onKeyDown);
        };
      }, [state.open, actions]);
      if (!state.open) return null;
      return /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
        className: ExportResultDialog_module_css_default.backdrop,
        onClick: () => actions.close(),
        children: /* @__PURE__ */(0, react_jsx_runtime.jsxs)("div", {
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "dsh-export-result-title",
          className: ExportResultDialog_module_css_default.dialog,
          onClick: event => {
            event.stopPropagation();
          },
          children: [/* @__PURE__ */(0, react_jsx_runtime.jsx)("h2", {
            id: "dsh-export-result-title",
            className: ExportResultDialog_module_css_default.title,
            children: state.title
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("p", {
            className: ExportResultDialog_module_css_default.detail,
            "data-status": state.ok ? "success" : "error",
            children: state.detail
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("div", {
            className: ExportResultDialog_module_css_default.actions,
            children: /* @__PURE__ */(0, react_jsx_runtime.jsx)("button", {
              type: "button",
              className: ExportResultDialog_module_css_default.button,
              onClick: () => actions.close(),
              children: "关闭"
            })
          })]
        })
      });
    }
    //#endregion
    //#region src/client/export-result.ts
    /**
    * Export-result dialog store: the single transient in-app feedback surface
    * for the shell's session-export download. The shell pushes the outcome from
    * Kotlin through `window.__dshExportResult`; this store carries it into the
    * `shell.overlay` entry. Module level exports the factory only — a module-level
    * handle would pin store identity across plugin reloads.
    */
    /**
    * Create the export-result store handle. `show` replaces whatever dialog was
    * open, so a second export supersedes a still-open first result; `close` only
    * folds the dialog, never mutates the last result.
    * @returns the store handle (spec + type + identity + factory in one).
    */
    function createExportResultStore() {
      return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
        init: () => ({
          open: false,
          ok: true,
          title: "",
          detail: ""
        }),
        actions: {
          show: (d, result) => {
            d.open = true;
            d.ok = result.ok;
            d.title = result.title;
            d.detail = result.detail;
          },
          close: d => {
            d.open = false;
          }
        }
      });
    }
    //#endregion
    //#region src/client/mobile-settings.css.ts
    /**
    * Mobile settings-panel adaptation (dsh-client-ui-responsive issue #1).
    * The upstream settings modal is a fixed 800px two-column panel (188px nav
    * rail + content). On portrait phones the panel squeezes to the viewport but
    * the rail stays 188px wide, crushing the content to ~160px. Selectors key
    * off the dialog's ARIA attributes because CSS Modules class names are
    * hashed and unreachable from another plugin; scoped to the mobile breakpoint.
    */
    const MOBILE_SETTINGS_CSS = `
@media (max-width: 639px) {
  [role='dialog'][aria-modal='true']:has(> nav) {
    width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    height: min(720px, calc(100vh - 24px));
    flex-direction: column;
  }

  [role='dialog'][aria-modal='true']:has(> nav) > nav {
    width: 100%;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    overflow-x: auto;
    flex: none;
  }

  [role='dialog'][aria-modal='true']:has(> nav) > nav > div:first-child {
    flex: none;
    padding: 0;
    white-space: nowrap;
  }

  [role='dialog'][aria-modal='true']:has(> nav) > nav > div:nth-child(2) {
    flex-direction: row;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }

  /* Content column: flex:1 but min-height:auto would hold the options
     scroll area's full content height and overflow the panel; allow it to
     shrink so the options area scrolls inside. */
  [role='dialog'][aria-modal='true']:has(> nav) > div:nth-child(2) {
    min-height: 0;
  }

  [role='dialog'][aria-modal='true']:has(> nav) > nav > div:nth-child(2) > button {
`;
    //#endregion
    //#region src/client/composer-menu.css.ts
    /**
    * Composer command-menu scroll fix (upstream ui-input-trigger):
    * .viewport (the menu's scroll container) is a flex child without flex:1,
    * so when the candidate list exceeds max-height (320px), the viewport grows
    * past the menu and gets clipped by the menu's overflow:hidden — the
    * scrollbar lands outside the visible area and the list appears unscrollable.
    * Fix: let the viewport fill the menu and scroll inside it.
    */
    const COMPOSER_MENU_CSS = `
[data-composer-card] [role='listbox'] > div {
  flex: 1 1 0%;
  min-height: 0;
}
`;
    //#endregion
    //#region src/client/composer-row.css.ts
    /**
    * Composer control-row narrow-screen fixes:
    * - The model-selection pill is 176px fixed; below ~380px it overlaps the
    *   permission/access pill (device-observed on 360dp phones). Cap its width
    *   and tighten the row gap so both stay tappable.
    */
    const COMPOSER_ROW_CSS = `
@media (max-width: 400px) {
  [data-composer-card] [aria-label*='选择模型'],
  [data-composer-card] [aria-label*='model'] {
    max-width: 118px;
  }
  [data-composer-card] [aria-label*='选择模型'] span,
  [data-composer-card] [aria-label*='model'] span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
`;
    //#endregion
    //#region src/client/session-log-dialog.css.ts
    /**
    * Hide the upstream session-log-export modal on Android shell builds.
    *
    * The shell APK already owns the export result surface: MainActivity pushes
    * the final success/failure through `window.__dshExportResult`, and
    * `ExportResultDialog` renders it in `shell.overlay`. The upstream
    * `session-log-export` modal also opens (preparing → success/error), so two
    * dialogs stack. The upstream CSS Module class names are hashed, so this
    * stylesheet targets the modal's stable ARIA attributes instead.
    */
    const SESSION_LOG_DIALOG_HIDE_CSS = `
[role="presentation"]:has([role="dialog"][aria-label^="正在导出 Session"]),
[role="presentation"]:has([role="dialog"][aria-label^="Session 导出"]),
[role="presentation"]:has([role="dialog"][aria-label^="Exporting Session"]),
[role="presentation"]:has([role="dialog"][aria-label^="Session download"]),
[role="presentation"]:has([role="dialog"][aria-label^="Session export"]) {
  display: none !important;
}
`;
    //#endregion
    //#region src/client/dev-section/DevSection.tsx
    /**
    * 开发者选项设置页（Android 壳设施）：重启引擎 / 刷新界面 / 打开控制台 /
    * 开发者调试日志开关。注册在上游官方 settings.section 扩展点
    * （ui-settings-general 的 nav 自动投影，零上游改动）。
    * 桥调用走 window.androidBridge（MainActivity addJavascriptInterface 注入）。
    */
    /**
    * Render the developer-options section content column.
    * @param props - composed slot props (contract/slots.ts).
    * @returns the section element tree.
    */
    function DevSection(_props) {
      const [devLog, setDevLog] = (0, react.useState)(() => {
        try {
          return window.androidBridge?.getDevLogEnabled?.() ?? false;
        } catch {
          return false;
        }
      });
      const [restarting, setRestarting] = (0, react.useState)(false);
      const [allFiles, setAllFiles] = (0, react.useState)(null);
      (0, react.useEffect)(() => {
        try {
          setAllFiles(window.androidBridge?.hasAllFilesAccess?.() ?? false);
        } catch {
          setAllFiles(false);
        }
      }, []);
      const restart = (0, react.useCallback)(() => {
        setRestarting(true);
        try {
          window.androidBridge?.restartEngine?.();
        } catch {}
        window.setTimeout(() => setRestarting(false), 1500);
      }, []);
      const reload = (0, react.useCallback)(() => {
        try {
          window.androidBridge?.reloadWebUI?.();
        } catch {}
      }, []);
      const openConsole = (0, react.useCallback)(() => {
        try {
          window.androidBridge?.openConsole?.();
        } catch {}
      }, []);
      const toggleLog = (0, react.useCallback)(enabled => {
        setDevLog(enabled);
        try {
          window.androidBridge?.setDevLogEnabled?.(enabled);
        } catch {}
      }, []);
      return /* @__PURE__ */(0, react_jsx_runtime.jsxs)("div", {
        "data-plugin": "dev-section",
        children: [/* @__PURE__ */(0, react_jsx_runtime.jsx)("p", {
          className: "dsh-dev-note",
          children: "Android 壳调试设施：控制台为快照内嵌 Termux bash；日志默认关闭。"
        }), /* @__PURE__ */(0, react_jsx_runtime.jsxs)("div", {
          className: "dsh-dev-row",
          children: [/* @__PURE__ */(0, react_jsx_runtime.jsx)("button", {
            type: "button",
            className: "dsh-dev-btn",
            onClick: restart,
            disabled: restarting,
            children: restarting ? "重启中…" : "重启引擎"
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("button", {
            type: "button",
            className: "dsh-dev-btn",
            onClick: reload,
            children: "刷新界面"
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("button", {
            type: "button",
            className: "dsh-dev-btn",
            onClick: openConsole,
            children: "打开控制台"
          })]
        }), /* @__PURE__ */(0, react_jsx_runtime.jsxs)("label", {
          className: "dsh-dev-row dsh-dev-switch",
          children: [/* @__PURE__ */(0, react_jsx_runtime.jsx)("input", {
            type: "checkbox",
            checked: devLog,
            onChange: e => toggleLog(e.target.checked)
          }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("span", {
            children: "开发者调试日志"
          })]
        }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("p", {
          className: "dsh-dev-hint",
          children: allFiles === false ? "未授予「所有文件访问」：日志将写入应用私有目录，授权后自动切换公共目录。" : "开启后按天写入 Documents/dshdata/log/dsh-<日期>.log。"
        }), /* @__PURE__ */(0, react_jsx_runtime.jsx)("p", {
          className: "dsh-dev-warn",
          children: "日志包含命令与模型内容，仅用于排查，请及时清理。"
        })]
      });
    }
    //#endregion
    //#region src/client/dev-section/dev-section.css.ts
    /**
    * 开发者选项设置页样式：复用 --dsw-* 语义 token（浅/深色自动跟随），
    * 按钮行式布局；窄屏（移动形态）按钮全宽堆叠、行内换行。
    * 注入方式与 mobile-settings.css.ts 一致（data-plugin 选择器，防 class 哈希）。
    */
    const DEV_SECTION_CSS = `
[data-plugin='dev-section'] {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 12px;
}

.dsh-dev-note {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary, #666);
}

.dsh-dev-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.dsh-dev-btn {
  min-height: 36px;
  padding: 6px 14px;
  border: 1px solid var(--dsw-alias-border-strong, #ccc);
  border-radius: 8px;
  background: var(--dsw-alias-bg-elevated, #fff);
  color: var(--dsw-alias-label-primary, #222);
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}

.dsh-dev-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.dsh-dev-switch {
  font-size: 14px;
  color: var(--dsw-alias-label-primary, #222);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.dsh-dev-switch input {
  width: 16px;
  height: 16px;
  margin: 0;
}

.dsh-dev-hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, #666);
}

.dsh-dev-warn {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-danger-fg, #c0392b);
}

@media (max-width: 639px) {
  .dsh-dev-btn {
    flex: 1 1 calc(50% - 5px);
    text-align: center;
  }
}
`;
    //#endregion
    //#region src/client/index.ts
    /** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
    const inject = ["slots", "theme"];
    /**
    * Client plugin body: provide ctx.layout, then one register() call — AppFrame
    * into 'root' with the four child-slot declarations, the layout store seat,
    * and the inject hook that hands the store's bound actions to the service.
    * @param ctx - client root context.
    */
    function apply(ctx) {
      const layout = new LayoutController();
      ctx.effect(() => {
        const disposeService = ctx.reflect.provide("layout", layout);
        const disposeRegistration = ctx.slots.register({
          name: "root",
          children: {
            "sidebar": {
              kind: "single",
              scope: "root"
            },
            "conversation": {
              kind: "single",
              scope: "session-maybe"
            },
            "details": {
              kind: "single",
              scope: "session"
            },
            "shell.overlay": {
              kind: "list",
              scope: "root"
            }
          },
          store: createLayoutStore,
          inject: actions => {
            layout.attachPanels(actions);
            return {};
          }
        }, AppFrame);
        return () => {
          disposeRegistration();
          disposeService();
        };
      }, "ui-layout: service + root registration");
      ctx.effect(() => {
        const style = document.createElement("style");
        style.setAttribute("data-plugin", "mobile-settings");
        style.textContent = MOBILE_SETTINGS_CSS;
        document.head.appendChild(style);
        return () => {
          style.remove();
        };
      }, "ui-layout: mobile settings styles");
      ctx.effect(() => {
        const style = document.createElement("style");
        style.setAttribute("data-plugin", "dev-section");
        style.textContent = DEV_SECTION_CSS;
        document.head.appendChild(style);
        return () => {
          style.remove();
        };
      }, "ui-layout: dev section styles");
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "android-dev",
        order: 99,
        label: () => "开发者选项"
      }, DevSection));
      ctx.effect(() => {
        const style = document.createElement("style");
        style.setAttribute("data-plugin", "composer-row");
        style.textContent = COMPOSER_ROW_CSS;
        document.head.appendChild(style);
        return () => {
          style.remove();
        };
      }, "ui-layout: composer row narrow fix");
      ctx.effect(() => {
        const style = document.createElement("style");
        style.setAttribute("data-plugin", "composer-menu");
        style.textContent = COMPOSER_MENU_CSS;
        document.head.appendChild(style);
        return () => {
          style.remove();
        };
      }, "ui-layout: composer menu scroll fix");
      ctx.effect(() => {
        const style = document.createElement("style");
        style.setAttribute("data-plugin", "session-log-dialog");
        style.textContent = SESSION_LOG_DIALOG_HIDE_CSS;
        document.head.appendChild(style);
        return () => {
          style.remove();
        };
      }, "ui-layout: hide upstream session-log dialog");
      ctx.effect(() => {
        const presenter = new ThemePresenter();
        presenter.apply(ctx.theme.getTheme());
        const off = ctx.on("theme/change", snapshot => {
          presenter.apply(snapshot);
        });
        return () => {
          off();
          presenter.dispose();
        };
      }, "ui-layout: theme presenter");
      ctx.effect(() => {
        const guard = new EnterGuard();
        guard.attach();
        return () => {
          guard.detach();
        };
      }, "ui-layout: mobile enter guard");
      ctx.effect(() => {
        new ThemeBridge().install();
        return () => {};
      }, "ui-layout: theme bridge");
      let exportActions;
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "export-result",
        store: createExportResultStore,
        inject: actions => {
          exportActions = actions;
          return {};
        }
      }, ExportResultDialog));
      ctx.effect(() => {
        const onResult = event => {
          const payload = event.detail;
          if (payload === null || typeof payload !== "object") return;
          if (typeof payload.ok !== "boolean" || typeof payload.title !== "string" || typeof payload.detail !== "string") return;
          exportActions?.show(payload);
        };
        const bridge = payload => {
          window.dispatchEvent(new CustomEvent("dsh:export-result", {
            detail: payload
          }));
        };
        window.__dshExportResult = bridge;
        window.addEventListener("dsh:export-result", onResult);
        return () => {
          window.removeEventListener("dsh:export-result", onResult);
          delete window.__dshExportResult;
        };
      }, "ui-layout: export result dialog bridge");
    }
    //#endregion
    exports.LayoutController = LayoutController;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});