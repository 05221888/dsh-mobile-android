// dsh-android-control client half — mobile layout for the DSH web GUI.
window.__ModuleLoader__.load({
	id: "dsh-android-control",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const CSS = "@media (max-width: 768px) {\n  .pI_x6G_frame { grid-template-columns: 56px minmax(0, 1fr) !important; }\n  .pI_x6G_sidebarCol {\n    position: relative;\n    width: 56px !important;\n    min-width: 56px !important;\n  }\n  .pI_x6G_frame:not([data-sidebar-collapsed]) { grid-template-columns: minmax(0, 1fr) !important; }\n  .pI_x6G_frame:not([data-sidebar-collapsed]) .pI_x6G_sidebarCol {\n    position: fixed !important;\n    top: 0 !important; left: 0 !important; bottom: 0 !important;\n    width: min(86vw, 340px) !important;\n    min-width: min(86vw, 340px) !important;\n    z-index: 120;\n    box-shadow: 0 0 24px rgba(0,0,0,0.35);\n  }\n  .pI_x6G_detailsCol {\n    position: fixed !important;\n    top: 0 !important; right: 0 !important; bottom: 0 !important;\n    width: 92vw !important;\n    z-index: 110;\n    transform: translateX(103%);\n    transition: transform 0.18s ease;\n    box-shadow: 0 0 24px rgba(0,0,0,0.35);\n  }\n  .pI_x6G_frame:not([data-details-collapsed]) .pI_x6G_detailsCol { transform: translateX(0); }\n  .pI_x6G_centerCol { min-width: 0 !important; width: 100% !important; }\n  /* v0.15.15 设置面板在手机上要能滚到底（原来点开设置划不到底、配不了 API Key）。\n     两个坑叠在一起：\n     ① 移动端抽屉用 transform 位移，而 transform 会让 position:fixed 的后代以\n        抽屉为参照系（fixed 失效）→ 面板被关进 301px 宽的抽屉里。改成用 left 位移。\n     ② dsh 面板 CSS 写的是 position:fixed;inset:0，而 WebView 83（Chromium 83）\n        不支持 inset 简写（Chrome 87 才有）→ 声明被丢弃、面板回落到 static position。\n        运行时展开见 assets/js/compat-polyfills.js 的 inset shim；这里再显式写一遍\n        四个方向，双保险。 */\n  [class*=mobileDrawer] {\n    transform: none !important;\n    left: -100% !important;\n    transition: left var(--ds-transition-duration-slow) var(--ds-ease-in-out) !important;\n  }\n  [class*=mobileDrawer][data-open] { left: 0 !important; }\n  /* settings panel: horizontal top nav + full-width content */\n  .VOzbGW_overlay {\n    padding: 0 !important;\n    top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important;\n  }\n  .VOzbGW_panel {\n    width: 100vw !important;\n    max-width: 100vw !important;\n    flex-direction: column !important;\n  }\n  .VOzbGW_nav {\n    width: 100% !important;\n    min-width: 0 !important;\n    flex: 0 0 auto !important;\n    flex-direction: column !important;\n    padding: 8px 12px !important;\n    border-bottom: 1px solid var(--dsw-alias-border-l1);\n  }\n  .VOzbGW_navTitle { display: none !important; }\n  .VOzbGW_navList {\n    flex-direction: row !important;\n    overflow-x: auto !important;\n    gap: 8px !important;\n    width: 100% !important;\n  }\n  .VOzbGW_navCell {\n    flex: 0 0 auto !important;\n    width: auto !important;\n    padding: 0 14px !important;\n  }\n  .VOzbGW_content {\n    width: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n    flex: 1 1 auto !important;\n    overflow-y: auto !important;\n  }\n  .VOzbGW_options { min-width: 0 !important; min-height: 0 !important; overflow-y: auto !important; }\n}";
		function apply(ctx) {
			const style = document.createElement("style");
			style.setAttribute("data-plugin", "dsh-android-control");
			style.textContent = CSS;
			document.head.appendChild(style);
			return () => { style.remove(); };
		}
		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});