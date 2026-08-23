window.__ModuleLoader__.load({
	id: "@dickpy/dsh-imagegen",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_dom_client = require("react-dom/client");
		let react = require("react");
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region src/protocol.ts
		/** Published package version shared by the host updater and the client UI. */
		const PLUGIN_VERSION = "1.0.5";
		/** Same-origin route family (loopback-only, mirroring the dsh-ssh fence). */
		const SETTINGS_API = {
			describe: "/api/dsh-imagegen/settings/describe",
			mutate: "/api/dsh-imagegen/settings/mutate"
		};
		/** The image-generation proxy route. */
		const GENERATE_API = "/api/dsh-imagegen/generate";
		/** Host-mediated image-generation profile routes. */
		const PROFILES_API = {
			list: "/api/dsh-imagegen/profiles/list",
			save: "/api/dsh-imagegen/profiles/save",
			remove: "/api/dsh-imagegen/profiles/remove"
		};
		/** Host-mediated GitHub Release update routes. */
		const UPDATE_API = {
			check: "/api/dsh-imagegen/update/check",
			apply: "/api/dsh-imagegen/update/apply"
		};
		/**
		* Same-origin route family for the host-persisted generation history. Images
		* live as files under ~/.dsh/dsh-imagegen/images/ and are served back through
		* the `image` prefix route, so list responses carry metadata only (never
		* base64) and the browser loads thumbnails/previews lazily.
		*/
		const HISTORY_API = {
			list: "/api/dsh-imagegen/history/list",
			append: "/api/dsh-imagegen/history/append",
			remove: "/api/dsh-imagegen/history/remove",
			clear: "/api/dsh-imagegen/history/clear",
			image: "/api/dsh-imagegen/history/image"
		};
		//#endregion
		//#region src/client/api.ts
		/**
		* Browser-side API client for the /api/dsh-imagegen route family. The only
		* data access path the panel uses — plain fetch, same origin.
		*/
		/** Error carrying the route's JSON error message. */
		var ImageGenApiError = class extends Error {
			/** Stable wire code from the host. */
			code;
			constructor(message, code = "generate-failed") {
				super(message);
				this.name = "ImageGenApiError";
				this.code = code;
			}
		};
		/** Parse the { ok, ... } envelope or throw an ImageGenApiError. */
		async function readEnvelope(response) {
			let body;
			try {
				body = await response.json();
			} catch {
				throw new ImageGenApiError(`HTTP ${response.status}: invalid JSON response`);
			}
			if (body === null || typeof body !== "object") throw new ImageGenApiError(`HTTP ${response.status}: malformed response`);
			const record = body;
			if (record.ok !== true) throw new ImageGenApiError(typeof record.message === "string" ? record.message : `HTTP ${response.status}`, typeof record.code === "string" ? record.code : "generate-failed");
			return body;
		}
		/** The browser half's data entry point. */
		var ImageGenApi = class {
			/** Ask the host to check the latest stable GitHub Release. */
			async updateCheck() {
				return (await readEnvelope(await fetch(UPDATE_API.check, { method: "POST" }))).update;
			}
			/** Ask the host to install a previously discovered Release. */
			async updateApply(version) {
				const body = await readEnvelope(await fetch(UPDATE_API.apply, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ version })
				}));
				return {
					updatedVersion: body.updatedVersion,
					restartRequired: body.restartRequired
				};
			}
			/** List selectable host-side image profiles. */
			async profilesList() {
				return (await readEnvelope(await fetch(PROFILES_API.list, { method: "POST" }))).profiles;
			}
			/** Save or update one profile. */
			async profileSave(profile) {
				return (await readEnvelope(await fetch(PROFILES_API.save, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ profile })
				}))).profiles;
			}
			/** Remove one profile. */
			async profileRemove(id) {
				return (await readEnvelope(await fetch(PROFILES_API.remove, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ id })
				}))).profiles;
			}
			/** Forward one generate request to the host proxy. */
			async generate(request) {
				const body = await readEnvelope(await fetch(GENERATE_API, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(request)
				}));
				return {
					images: body.images,
					...body.history === void 0 ? {} : { history: body.history },
					...body.historyError === void 0 ? {} : { historyError: body.historyError }
				};
			}
			/** List the host-persisted history (newest first). */
			async historyList() {
				return (await readEnvelope(await fetch(HISTORY_API.list, { method: "POST" }))).entries;
			}
			/** Remove one history entry by id. */
			async historyRemove(id) {
				return (await readEnvelope(await fetch(HISTORY_API.remove, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ id })
				}))).entries;
			}
			/** Clear the entire history. */
			async historyClear() {
				return (await readEnvelope(await fetch(HISTORY_API.clear, { method: "POST" }))).entries;
			}
		};
		//#endregion
		//#region src/client/controller.ts
		/** The panel state owner the sidebar entry toggles and the view renders from. */
		var ImageGenController = class {
			panelOpen = false;
			jobState = "idle";
			listeners = /* @__PURE__ */ new Set();
			getSnapshot() {
				return {
					panelOpen: this.panelOpen,
					jobState: this.jobState
				};
			}
			subscribe(fn) {
				this.listeners.add(fn);
				return () => {
					this.listeners.delete(fn);
				};
			}
			open() {
				const clearReady = this.jobState === "ready" || this.jobState === "error";
				if (this.panelOpen && !clearReady) return;
				this.panelOpen = true;
				if (clearReady) this.jobState = "idle";
				this.notify();
			}
			close() {
				if (!this.panelOpen) return;
				this.panelOpen = false;
				this.notify();
			}
			toggle() {
				if (this.panelOpen) this.close();
				else this.open();
			}
			startJob() {
				if (this.jobState === "generating") return;
				this.jobState = "generating";
				this.notify();
			}
			finishJob(ok) {
				this.jobState = ok ? "ready" : "error";
				this.notify();
			}
			notify() {
				for (const fn of [...this.listeners]) fn();
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/**
		* dsh-imagegen surface copy: zh is the key source, en mirrors every key.
		*/
		const zh = {
			"entry.label": "AI 生图",
			"entry.tooltip": "AI 生图面板（fal-ai/gpt-image-2）",
			"entry.generating": "正在生成",
			"entry.ready": "生成完成",
			"entry.failed": "生成失败",
			"panel.title": "AI 生图",
			"panel.subtitle": "fal-ai/gpt-image-2 图像生成",
			"panel.back": "返回聊天",
			"profile.label": "配置 / 密钥",
			"profile.none": "暂无配置",
			"profile.new": "新增",
			"profile.edit": "编辑",
			"profile.delete": "删除",
			"profile.name": "配置名称",
			"profile.apiUrl": "API 地址",
			"profile.apiKey": "API 密钥",
			"profile.keyKeep": "已设置，留空则保留原密钥",
			"profile.model": "模型名称",
			"profile.save": "保存配置",
			"profile.cancel": "取消",
			"mode.text": "文生图",
			"mode.edit": "图生图",
			"prompt.placeholder": "描述你想要的画面，例如：一只戴着宇航员头盔的橘猫，在月球上举起望远镜，水彩风格，柔和光线…",
			"prompt.required": "请输入提示词",
			"prompt.count": "{count}/2000",
			"params.size": "尺寸",
			"params.quality": "清晰度",
			"params.count": "生成数量",
			"params.detail": "细节",
			"size.auto": "自动",
			"size.square": "1024×1024",
			"size.landscape": "1536×1024",
			"size.portrait": "1024×1536",
			"size.small": "512×512",
			"size.wide": "1792×1024",
			"size.tall": "1024×1792",
			"quality.auto": "自动",
			"quality.low": "低",
			"quality.medium": "中",
			"quality.high": "高",
			"count.one": "1 张",
			"count.two": "2 张",
			"count.three": "3 张",
			"count.four": "4 张",
			"detail.auto": "自动",
			"detail.standard": "标准",
			"detail.high": "高清",
			"detail.hint": "透传参数，部分 gpt-image-2 网关支持；官方接口请保持「自动」",
			"model.label": "模型",
			"model.placeholder": "输入或选择模型名称",
			"generate": "开始生成",
			"generating": "生成中…",
			"edit.upload": "点击或拖拽上传参考图片",
			"edit.uploadHint": "PNG / JPG / WEBP，不超过 10MB",
			"edit.change": "更换图片",
			"edit.remove": "移除",
			"edit.required": "请先上传参考图片",
			"canvas.emptyTitle": "开始你的创作",
			"canvas.emptyHint": "在左侧输入提示词并点击「开始生成」，结果将显示在这里",
			"canvas.error": "生成失败：{error}",
			"canvas.generating": "正在生成图片…",
			"canvas.elapsed": "已用时 {seconds}s",
			"canvas.images": "本次生成 {count} 张",
			"download": "下载",
			"revisedPrompt": "优化提示词：{prompt}",
			"history.title": "历史记录",
			"history.empty": "暂无历史记录，生成图片后会保存在这里",
			"history.clear": "清空",
			"history.restore": "恢复",
			"history.delete": "删除",
			"history.images": "张",
			"history.viewing": "历史 · {time}",
			"preview.title": "图片预览",
			"preview.open": "点击预览",
			"preview.close": "关闭",
			"preview.prev": "上一张",
			"preview.next": "下一张",
			"preview.index": "{index} / {total}",
			"preview.zoomControls": "图片缩放控制",
			"preview.zoomIn": "放大",
			"preview.zoomOut": "缩小",
			"preview.zoomReset": "重置缩放",
			"preview.zoomLevel": "{percent}%",
			"preview.copyPrompt": "复制提示词",
			"preview.copied": "已复制",
			"preview.addToEdit": "添加到图生图",
			"config.missing": "尚未配置 API：请前往「设置 → 插件 → 可配置」为 AI 生图填写 api_url 与 api_key。",
			"config.configured": "已连接 {url}",
			"config.disabled": "插件已停用，请在设置中重新启用。",
			"connection.connected": "已连接",
			"connection.disconnected": "未连接",
			"update.available": "检测到新版本：{version}",
			"update.install": "在线更新",
			"update.installing": "更新中…",
			"update.success": "已更新到 {version}，请重启 DSH",
			"update.failed": "更新失败，请重试",
			"update.release": "查看 Release",
			"settings.title": "AI 生图（dsh-imagegen）",
			"settings.description": "配置图像生成 API 地址与密钥",
			"settings.currentVersion": "当前版本",
			"settings.apiUrl": "API 地址（api_url）",
			"settings.apiUrlHint": "OpenAI 兼容接口基址，如 https://api.openai.com/v1；将自动拼接 /images/generations 与 /images/edits",
			"settings.apiKey": "API 密钥（api_key）",
			"settings.apiKeyHint": "Bearer 密钥，明文存于本机设置文档；界面只显示是否已设置",
			"settings.apiKeySet": "已保存密钥；输入新值可更换，点击「清除」可删除",
			"settings.apiKeyClear": "清除",
			"settings.announceToAgent": "向 Agent 播报本插件",
			"settings.announceToAgentHint": "开启后，本插件的存在与能力会写入每个 Agent 的系统提示词",
			"settings.enabled": "启用插件",
			"settings.enabledHint": "关闭后生图面板不可用（设置卡片始终可用）",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.discard": "放弃修改",
			"settings.unsaved": "有未保存的修改",
			"settings.saveFailed": "保存失败，请重试",
			"settings.readOnly": "当前设置文档为只读，无法保存。",
			"settings.notExposed": "设置命名空间不可用：本部署未提供该插件的设置服务。",
			"settings.expand": "展开",
			"settings.collapse": "收起",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.overridden": "已覆盖",
			"settings.reset": "重置",
			"settings.invalidNumber": "请输入有效数字"
		};
		const en = {
			"entry.label": "AI Image",
			"entry.tooltip": "AI image generation studio (fal-ai/gpt-image-2)",
			"entry.generating": "Generating",
			"entry.ready": "Generation finished",
			"entry.failed": "Generation failed",
			"panel.title": "AI Image",
			"panel.subtitle": "fal-ai/gpt-image-2 image generation",
			"panel.back": "Back to chat",
			"profile.label": "Profile / Key",
			"profile.none": "No profiles",
			"profile.new": "New",
			"profile.edit": "Edit",
			"profile.delete": "Delete",
			"profile.name": "Profile name",
			"profile.apiUrl": "API URL",
			"profile.apiKey": "API key",
			"profile.keyKeep": "Already set; leave blank to keep it",
			"profile.model": "Model name",
			"profile.save": "Save profile",
			"profile.cancel": "Cancel",
			"mode.text": "Text to Image",
			"mode.edit": "Image to Image",
			"prompt.placeholder": "Describe the picture you want, e.g. an orange cat in an astronaut helmet raising a telescope on the moon, watercolor style, soft light…",
			"prompt.required": "Enter a prompt first",
			"prompt.count": "{count}/2000",
			"params.size": "Size",
			"params.quality": "Quality",
			"params.count": "Count",
			"params.detail": "Detail",
			"size.auto": "Auto",
			"size.square": "1024×1024",
			"size.landscape": "1536×1024",
			"size.portrait": "1024×1536",
			"size.small": "512×512",
			"size.wide": "1792×1024",
			"size.tall": "1024×1792",
			"quality.auto": "Auto",
			"quality.low": "Low",
			"quality.medium": "Medium",
			"quality.high": "High",
			"count.one": "1",
			"count.two": "2",
			"count.three": "3",
			"count.four": "4",
			"detail.auto": "Auto",
			"detail.standard": "Standard",
			"detail.high": "High",
			"detail.hint": "Passthrough parameter supported by some gpt-image-2 gateways; keep \"Auto\" for official endpoints",
			"model.label": "Model",
			"model.placeholder": "Type or choose a model",
			"generate": "Generate",
			"generating": "Generating…",
			"edit.upload": "Click or drag to upload a reference image",
			"edit.uploadHint": "PNG / JPG / WEBP, up to 10MB",
			"edit.change": "Change image",
			"edit.remove": "Remove",
			"edit.required": "Upload a reference image first",
			"canvas.emptyTitle": "Start creating",
			"canvas.emptyHint": "Enter a prompt on the left and click \"Generate\"; results appear here",
			"canvas.error": "Generation failed: {error}",
			"canvas.generating": "Generating images…",
			"canvas.elapsed": "Elapsed {seconds}s",
			"canvas.images": "{count} image(s) generated",
			"download": "Download",
			"revisedPrompt": "Refined prompt: {prompt}",
			"history.title": "History",
			"history.empty": "No history yet — generations will be saved here",
			"history.clear": "Clear",
			"history.restore": "Restore",
			"history.delete": "Delete",
			"history.images": "images",
			"history.viewing": "History · {time}",
			"preview.title": "Image preview",
			"preview.open": "Click to preview",
			"preview.close": "Close",
			"preview.prev": "Previous",
			"preview.next": "Next",
			"preview.index": "{index} / {total}",
			"preview.zoomControls": "Image zoom controls",
			"preview.zoomIn": "Zoom in",
			"preview.zoomOut": "Zoom out",
			"preview.zoomReset": "Reset zoom",
			"preview.zoomLevel": "{percent}%",
			"preview.copyPrompt": "Copy prompt",
			"preview.copied": "Copied",
			"preview.addToEdit": "Add to image to image",
			"config.missing": "API not configured: open \"Settings → Plugins → Configurable\" and fill in api_url and api_key for AI Image.",
			"config.configured": "Connected to {url}",
			"config.disabled": "The plugin is disabled — re-enable it in Settings.",
			"connection.connected": "Connected",
			"connection.disconnected": "Disconnected",
			"update.available": "A new version is available: {version}",
			"update.install": "Update online",
			"update.installing": "Updating…",
			"update.success": "Updated to {version}; restart DSH to load it",
			"update.failed": "Update failed; please try again",
			"update.release": "View Release",
			"settings.title": "AI Image (dsh-imagegen)",
			"settings.description": "Configure the image generation API endpoint and key",
			"settings.currentVersion": "Current version",
			"settings.apiUrl": "API URL (api_url)",
			"settings.apiUrlHint": "OpenAI-compatible base URL, e.g. https://api.openai.com/v1; /images/generations and /images/edits are appended",
			"settings.apiKey": "API Key (api_key)",
			"settings.apiKeyHint": "Bearer key, stored in plaintext in the local settings document; the UI only shows whether it is set",
			"settings.apiKeySet": "A key is stored; type a new value to replace it, or click \"Clear\" to remove it",
			"settings.apiKeyClear": "Clear",
			"settings.announceToAgent": "Announce this plugin to agents",
			"settings.announceToAgentHint": "When on, the plugin presence and capabilities are written into every agent system prompt",
			"settings.enabled": "Enable plugin",
			"settings.enabledHint": "When off, the generation studio is unavailable (this card stays available)",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.discard": "Discard",
			"settings.unsaved": "Unsaved changes",
			"settings.saveFailed": "Save failed, please retry",
			"settings.readOnly": "The settings document is read-only; saving is disabled.",
			"settings.notExposed": "Settings namespace unavailable: this deployment does not serve this plugin's settings.",
			"settings.expand": "Expand",
			"settings.collapse": "Collapse",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.overridden": "Overridden",
			"settings.reset": "Reset",
			"settings.invalidNumber": "Enter a valid number"
		};
		//#endregion
		//#region src/client/helpers.ts
		/**
		* Shared panel helpers: the active-dictionary pick (document-language based,
		* dsh-ssh precedent) bound to the dsh-imagegen interpolator, plus a small
		* error-message extractor. All copy stays in the locale dictionaries.
		*/
		/** Active dictionary, picked by the document language at call time. */
		function dictionary() {
			return (typeof document !== "undefined" ? document.documentElement.lang : "zh").toLowerCase().startsWith("en") ? { ...en } : { ...zh };
		}
		/** Translate a key with optional {name} template params (current language). */
		function tt(key, values) {
			const text = dictionary()[key] ?? key;
			if (values === void 0) return text;
			let rendered = text;
			for (const [name, value] of Object.entries(values)) rendered = rendered.replaceAll(`{${name}}`, String(value));
			return rendered;
		}
		/** Human-readable error text from an unknown thrown value. */
		function errorMessage(error) {
			if (error instanceof Error) return error.message;
			return String(error);
		}
		//#endregion
		//#region src/client/notify.ts
		/** Play the same completion chime as dsh-notify-sound, using its saved prefs. */
		async function playNotifySound() {
			try {
				const body = await (await fetch("/notify-sound/api/prefs.get", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: "{}"
				})).json();
				const envelope = body !== null && typeof body === "object" ? body : void 0;
				const view = envelope?.ok === true ? envelope.value : void 0;
				const prefs = view !== null && typeof view === "object" ? view.value : void 0;
				const value = prefs !== null && typeof prefs === "object" ? prefs : void 0;
				if (value?.enabled === false) return;
				const sound = typeof value?.sound === "string" && value.sound !== "" ? value.sound : "staplebops-01.aac";
				const volume = typeof value?.volume === "number" && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : .8;
				const audio = new Audio(`/notify-sound/sounds/${sound}`);
				audio.volume = volume;
				await audio.play().catch(() => {});
			} catch {}
		}
		//#endregion
		//#region \0dsh-css:C:\Users\五五\Desktop\项目\dsh-imagegen\src\client\panel.module.css.mjs
		const css$1 = "/**\n * dsh-imagegen studio styles. Scoped by the plugin's own data attributes so\n * nothing leaks into the rest of the GUI; colors ride the dsh --dsw-* tokens\n * and interactive controls reuse the system primitives (Button / Pill), so\n * the studio follows the active theme (light/dark and skins) by construction.\n * The center-column hide rules are attribute-scoped and must stay in this\n * stylesheet (it is imported by mount.m0hixH_tsx, so the styles load with the\n * plugin).\n */\n\n/* --- center-column takeover (global rules, attribute-scoped) ----------------- */\n\n[data-pane='conversation'] {\n  position: relative;\n}\n\n/* The panel container rides inside the conversation grid item as an extra\n   trailing child; hidden unless the panel is active. */\n[data-dsh-imagegen-view] {\n  position: absolute;\n  inset: 0;\n  display: none;\n  z-index: 60;\n  background: var(--dsw-alias-bg-base);\n}\n\n/* The center column is single-occupant; the :not() guards keep the sibling\n   panels (task board / ssh) from fighting over visibility if both activation\n   attributes ever coexist. */\nhtml[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-dsh-imagegen-view] {\n  display: block;\n}\n\n/* While the panel is active, the conversation content underneath is hidden\n   (it stays mounted and stateful). */\nhtml[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane='conversation'] > :not([data-dsh-imagegen-view]),\nhtml[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*='centerCol'] > :not([data-dsh-imagegen-view]) {\n  display: none !important;\n}\n\n/* --- sidebar entry row ------------------------------------------------------- */\n\n.m0hixH_entry {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  position: relative;\n  width: 100%;\n  height: 32px;\n  padding: 0 12px;\n  background: transparent;\n  border: none;\n  border-radius: 8px;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  font-size: 13px;\n  white-space: nowrap;\n}\n\n.m0hixH_entry:hover {\n  background: var(--dsw-specific-sidebar-nav-item-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.m0hixH_entry[data-active] {\n  background: var(--dsw-specific-sidebar-nav-item-active);\n  color: var(--dsw-alias-label-primary);\n  font-weight: 600;\n}\n\n.m0hixH_entryIcon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  flex: none;\n}\n\n.m0hixH_entryLabel {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.m0hixH_entryDot {\n  width: 8px;\n  height: 8px;\n  margin-left: auto;\n  flex: none;\n  border-radius: 50%;\n  background: var(--dsw-alias-state-success-primary);\n}\n\n.m0hixH_entryDot[data-state='generating'] {\n  background: var(--dsw-alias-brand-primary);\n  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent);\n  animation: imagegen-dot-pulse 1.1s ease-in-out infinite;\n}\n\n.m0hixH_entryDot[data-state='error'] {\n  background: var(--dsw-alias-label-error);\n}\n\n.m0hixH_entryDot[hidden] {\n  display: none;\n}\n\n@keyframes imagegen-dot-pulse {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.35; }\n}\n\n/* Collapsed rail: icon-only, centered, matching the shell's 56px rail. */\n[data-dsh-frame][data-sidebar-collapsed] .m0hixH_entry {\n  justify-content: center;\n  padding: 0;\n  width: 100%;\n}\n\n[data-dsh-frame][data-sidebar-collapsed] .m0hixH_entryLabel {\n  display: none;\n}\n\n[data-dsh-frame][data-sidebar-collapsed] .m0hixH_entryDot {\n  position: absolute;\n  top: 4px;\n  right: 8px;\n  margin-left: 0;\n}\n\n/* --- panel frame -------------------------------------------------------------- */\n\n.m0hixH_view {\n  overflow: hidden;\n}\n\n/* The shell does not ship a global `box-sizing: border-box` reset, so scope\n   one to the panel subtree: without it, `height: 100%` + padding grows past\n   the container and clips the footer off the bottom of the screen. */\n.m0hixH_panel,\n.m0hixH_panel *,\n.m0hixH_panel *::before,\n.m0hixH_panel *::after {\n  box-sizing: border-box;\n}\n\n.m0hixH_panel {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  overflow: hidden;\n  padding: 14px 16px 16px;\n  gap: 10px;\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  font-family: var(--dsw-font-family);\n}\n\n.m0hixH_panelHeader {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  flex: none;\n}\n\n.m0hixH_panelHeading {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-width: 0;\n}\n\n.m0hixH_panelTitle {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 700;\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.m0hixH_backButton {\n  flex: none;\n  border: 1px solid var(--dsw-alias-label-tertiary);\n  border-radius: 7px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  padding: 4px 8px;\n  cursor: pointer;\n  font: inherit;\n  font-size: 12px;\n}\n\n.m0hixH_backButton:hover {\n  color: var(--dsw-alias-label-primary);\n  border-color: var(--dsw-alias-label-primary);\n}\n\n.m0hixH_panelSubtitle {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* --- connection status and update notice -------------------------------------- */\n\n.m0hixH_connectionStatus {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  flex: none;\n  height: 28px;\n  padding: 0 10px;\n  border: 1px solid var(--dsw-alias-label-error);\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-error);\n  font: inherit;\n  font-size: 12px;\n  line-height: 1;\n  white-space: nowrap;\n}\n\n.m0hixH_connectionStatus[data-connected='true'] {\n  border-color: var(--dsw-alias-state-success-primary);\n  color: var(--dsw-alias-state-success-primary);\n}\n\n.m0hixH_connectionDot {\n  width: 6px;\n  height: 6px;\n  border-radius: 50%;\n  background: currentColor;\n}\n\n.m0hixH_updateBanner {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  flex: none;\n  padding: 7px 10px 7px 12px;\n  font-size: 12px;\n  line-height: 1.5;\n  border-radius: 10px;\n  border: 1px solid var(--dsw-alias-state-warn-primary);\n  color: var(--dsw-alias-state-warn-primary);\n  overflow-wrap: anywhere;\n}\n\n.m0hixH_updateBanner[data-kind='ok'] {\n  color: var(--dsw-alias-state-success-primary);\n  border-color: var(--dsw-alias-state-success-primary);\n}\n\n.m0hixH_updateText {\n  min-width: 0;\n}\n\n.m0hixH_updateActions {\n  display: inline-flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.m0hixH_updateRelease {\n  color: inherit;\n  text-decoration: underline;\n  text-underline-offset: 2px;\n  white-space: nowrap;\n}\n\n@media (max-width: 700px) {\n  .m0hixH_panelHeader {\n    align-items: flex-start;\n  }\n\n  .m0hixH_panelHeading {\n    align-items: flex-start;\n    flex-direction: column;\n    gap: 2px;\n  }\n\n  .m0hixH_updateBanner {\n    align-items: flex-start;\n    flex-direction: column;\n  }\n\n  .m0hixH_updateActions {\n    width: 100%;\n    justify-content: space-between;\n  }\n}\n\n/* --- studio split: left config sidebar (narrow) + right canvas (wide) --------- */\n\n.m0hixH_studio {\n  display: flex;\n  gap: 14px;\n  flex: 1;\n  min-height: 0;\n  min-width: 0;\n}\n\n.m0hixH_config {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  flex: none;\n  width: 300px;\n  min-width: 260px;\n  max-width: 340px;\n  height: 100%;\n  min-height: 0;\n  overflow: hidden;\n}\n\n/* The cards scroll in their own scrollport; the footer stays a fixed sibling\n   below, so nothing ever hides underneath it (text and edit modes alike). */\n.m0hixH_configScroll {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  padding-right: 2px;\n  scrollbar-width: thin;\n  scrollbar-color: var(--dsw-alias-border-l2) transparent;\n}\n\n.m0hixH_configScroll::-webkit-scrollbar {\n  width: 8px;\n}\n\n.m0hixH_configScroll::-webkit-scrollbar-thumb {\n  background: var(--dsw-alias-border-l2);\n  border-radius: 999px;\n}\n\n.m0hixH_canvas {\n  position: relative;\n  flex: 1;\n  min-width: 0;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  overflow: hidden;\n}\n\n/* --- history column (far right) ------------------------------------------------ */\n\n.m0hixH_history {\n  display: flex;\n  flex-direction: column;\n  flex: none;\n  width: 240px;\n  min-width: 200px;\n  max-width: 280px;\n  min-height: 0;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  overflow: hidden;\n}\n\n.m0hixH_historyHeader {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 10px 12px;\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\n  flex: none;\n}\n\n.m0hixH_historyTitle {\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n}\n\n.m0hixH_historyClear {\n  padding: 2px 8px;\n  font: inherit;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  background: transparent;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 999px;\n  cursor: pointer;\n}\n\n.m0hixH_historyClear:hover {\n  color: var(--dsw-alias-label-error);\n  border-color: var(--dsw-alias-label-error);\n}\n\n.m0hixH_historyList {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 10px;\n  scrollbar-width: thin;\n  scrollbar-color: var(--dsw-alias-border-l2) transparent;\n}\n\n.m0hixH_historyList::-webkit-scrollbar {\n  width: 8px;\n}\n\n.m0hixH_historyList::-webkit-scrollbar-thumb {\n  background: var(--dsw-alias-border-l2);\n  border-radius: 999px;\n}\n\n.m0hixH_historyEmpty {\n  flex: 1;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 20px;\n  font-size: 12px;\n  line-height: 1.6;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.m0hixH_historyItem {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 8px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-2);\n  flex: none;\n}\n\n.m0hixH_historyItem:hover {\n  border-color: var(--dsw-alias-border-l2);\n}\n\n.m0hixH_historyItem[data-active] {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.m0hixH_historyMain {\n  display: flex;\n  gap: 8px;\n  align-items: flex-start;\n  padding: 0;\n  background: transparent;\n  border: none;\n  font: inherit;\n  color: inherit;\n  text-align: left;\n  cursor: pointer;\n  min-width: 0;\n}\n\n.m0hixH_historyThumb {\n  width: 52px;\n  height: 52px;\n  border-radius: 8px;\n  object-fit: cover;\n  background: var(--dsw-alias-bg-base);\n  flex: none;\n}\n\n.m0hixH_historyThumbPlaceholder {\n  width: 52px;\n  height: 52px;\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-3);\n  flex: none;\n}\n\n.m0hixH_historyInfo {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.m0hixH_historyPrompt {\n  font-size: 12px;\n  line-height: 1.4;\n  color: var(--dsw-alias-label-primary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.m0hixH_historyMeta {\n  font-size: 11px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.m0hixH_historyActions {\n  display: flex;\n  gap: 6px;\n  justify-content: flex-end;\n}\n\n.m0hixH_historyAction {\n  padding: 2px 8px;\n  font: inherit;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-secondary);\n  background: transparent;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 999px;\n  cursor: pointer;\n}\n\n.m0hixH_historyAction:hover {\n  color: var(--dsw-alias-label-primary);\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n.m0hixH_historyAction[data-danger]:hover {\n  color: var(--dsw-alias-label-error);\n  border-color: var(--dsw-alias-label-error);\n}\n\n/* --- cards (system-aligned rounded group chrome) ------------------------------ */\n\n.m0hixH_card {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  flex: none;\n}\n\n/* --- mode tabs (system Pill switcher) ------------------------------------------ */\n\n.m0hixH_modeRow {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n}\n\n.m0hixH_modePill {\n  flex: 1;\n  justify-content: center;\n  height: 28px;\n  font-size: 13px;\n}\n\n/* --- reference image upload (edit mode) ---------------------------------------- */\n\n.m0hixH_uploadBox {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  min-height: 128px;\n  padding: 16px;\n  color: var(--dsw-alias-label-secondary);\n  background: transparent;\n  border: 1.5px dashed var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  cursor: pointer;\n  font: inherit;\n  font-size: 12.5px;\n  text-align: center;\n}\n\n.m0hixH_uploadBox:hover {\n  color: var(--dsw-alias-label-primary);\n  border-color: var(--dsw-alias-label-dimmed);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.m0hixH_uploadBox:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 1px;\n}\n\n.m0hixH_uploadIcon {\n  display: inline-flex;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.m0hixH_uploadHint {\n  font-size: 11px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.m0hixH_reference {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.m0hixH_referenceImage {\n  width: 100%;\n  max-height: 176px;\n  object-fit: contain;\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-base);\n  border: 1px solid var(--dsw-alias-border-l1);\n}\n\n.m0hixH_referenceActions {\n  display: flex;\n  gap: 8px;\n}\n\n.m0hixH_hiddenFile {\n  display: none;\n}\n\n/* --- prompt -------------------------------------------------------------------- */\n\n.m0hixH_prompt {\n  width: 100%;\n  min-height: 120px;\n  padding: 10px 12px;\n  font-size: 13px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-3);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  outline: none;\n  resize: vertical;\n  font-family: inherit;\n  box-sizing: border-box;\n}\n\n.m0hixH_prompt:focus-visible {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.m0hixH_prompt::placeholder {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.m0hixH_promptFooter {\n  display: flex;\n  justify-content: flex-end;\n  margin-top: -6px;\n}\n\n.m0hixH_promptCount {\n  font-size: 11px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n/* --- parameter groups ----------------------------------------------------------- */\n\n.m0hixH_paramGroup {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.m0hixH_paramLabel {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.m0hixH_optionRow {\n  display: flex;\n  gap: 6px;\n  flex-wrap: wrap;\n}\n\n.m0hixH_optionGrid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 6px;\n}\n\n.m0hixH_optionPill {\n  justify-content: center;\n}\n\n.m0hixH_paramHint {\n  font-size: 11px;\n  line-height: 1.45;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* --- footer: model dropdown + generate button (fixed under the scroll) -------- */\n\n.m0hixH_footer {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n  gap: 8px;\n  flex: none;\n  padding: 10px 2px 0 0;\n  border-top: 1px solid var(--dsw-alias-border-l1);\n}\n\n.m0hixH_modelWrap {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n  min-width: 0;\n}\n\n.m0hixH_profileActions,\n.m0hixH_profileEditorActions {\n  display: flex;\n  gap: 6px;\n  flex-wrap: wrap;\n}\n\n.m0hixH_profileEditor {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 8px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.m0hixH_profileInput {\n  width: 100%;\n  min-height: 30px;\n  padding: 5px 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 7px;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 12px;\n}\n\n.m0hixH_modelLabel {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.m0hixH_modelSelect {\n  width: 100%;\n  height: 36px;\n  padding: 0 12px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 18px;\n  outline: none;\n  font-family: inherit;\n  cursor: pointer;\n}\n\n.m0hixH_modelSelect:focus-visible {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.m0hixH_modelSelect:disabled {\n  opacity: 0.55;\n}\n\n.m0hixH_modelDatalistWrap {\n  display: contents;\n}\n\n.m0hixH_modelInput {\n  width: 100%;\n  height: 36px;\n  padding: 0 12px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 18px;\n  outline: none;\n  font-family: inherit;\n}\n\n.m0hixH_modelInput:focus-visible {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.m0hixH_modelInput:disabled {\n  opacity: 0.55;\n}\n\n.m0hixH_generateButton {\n  width: 100%;\n}\n\n.m0hixH_generateInner {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n}\n\n/* --- canvas states --------------------------------------------------------------- */\n\n.m0hixH_canvasState {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  padding: 24px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.m0hixH_canvasStateTitle {\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.m0hixH_canvasStateHint {\n  font-size: 12px;\n  max-width: 380px;\n  line-height: 1.6;\n}\n\n.m0hixH_canvasEmptyIcon {\n  display: inline-flex;\n  margin-bottom: 4px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.m0hixH_canvasError {\n  margin: 14px;\n  padding: 10px 14px;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-error);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-label-error);\n  border-radius: 10px;\n  overflow-wrap: anywhere;\n  flex: none;\n}\n\n.m0hixH_canvasBody {\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  overflow-y: auto;\n  padding: 14px;\n  scrollbar-width: thin;\n  scrollbar-color: var(--dsw-alias-border-l2) transparent;\n}\n\n.m0hixH_canvasBody::-webkit-scrollbar {\n  width: 8px;\n}\n\n.m0hixH_canvasBody::-webkit-scrollbar-thumb {\n  background: var(--dsw-alias-border-l2);\n  border-radius: 999px;\n}\n\n.m0hixH_canvasMeta {\n  flex: none;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.m0hixH_canvasHistoryTag {\n  padding: 1px 8px;\n  font-size: 11px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 999px;\n  white-space: nowrap;\n}\n\n/* --- result grid ----------------------------------------------------------------- */\n\n.m0hixH_grid {\n  display: grid;\n  flex: 1;\n  min-height: 0;\n  gap: 14px;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  grid-template-rows: repeat(2, minmax(0, 1fr));\n}\n\n.m0hixH_grid[data-count='1'] .m0hixH_imageCard {\n  grid-area: 1 / 1 / 3 / 3;\n}\n\n.m0hixH_imageCard {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  margin: 0;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-2);\n  cursor: zoom-in;\n  min-height: 0;\n}\n\n.m0hixH_imageCard:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 1px;\n}\n\n.m0hixH_image {\n  display: block;\n  flex: 1;\n  min-height: 0;\n  width: 100%;\n  object-fit: cover;\n  background: var(--dsw-alias-bg-base);\n}\n\n.m0hixH_imageCaption {\n  padding: 7px 10px;\n  font-size: 11px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  border-top: 1px solid var(--dsw-alias-border-l1);\n}\n\n.m0hixH_download {\n  position: absolute;\n  top: 8px;\n  right: 8px;\n  padding: 2px 10px;\n  font-size: 12px;\n  line-height: 20px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-mask-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 999px;\n  text-decoration: none;\n  opacity: 0;\n  transition: opacity 0.12s;\n  backdrop-filter: blur(4px);\n}\n\n.m0hixH_imageCard:hover .m0hixH_download {\n  opacity: 1;\n}\n\n.m0hixH_download:hover {\n  background: var(--dsw-alias-bg-base);\n}\n\n/* Hover hint for the click-to-zoom behavior. */\n.m0hixH_zoomHint {\n  position: absolute;\n  left: 8px;\n  bottom: 8px;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2px 10px;\n  font-size: 12px;\n  line-height: 20px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-mask-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 999px;\n  opacity: 0;\n  transition: opacity 0.12s;\n  backdrop-filter: blur(4px);\n  pointer-events: none;\n}\n\n.m0hixH_imageCard:hover .m0hixH_zoomHint {\n  opacity: 1;\n}\n\n/* --- spinner --------------------------------------------------------------------- */\n\n.m0hixH_spinner,\n.m0hixH_bigSpinner {\n  display: inline-block;\n  flex: none;\n  border-radius: 50%;\n  border: 2px solid currentColor;\n  border-top-color: transparent;\n  animation: dshImageGenSpin 800ms linear infinite;\n}\n\n.m0hixH_spinner {\n  width: 11px;\n  height: 11px;\n}\n\n.m0hixH_bigSpinner {\n  width: 30px;\n  height: 30px;\n  border-width: 3px;\n  color: var(--dsw-alias-state-business-primary);\n  margin-bottom: 6px;\n}\n\n/* --- full-screen image preview (lightbox) -------------------------------------- */\n\n.m0hixH_lightbox {\n  position: fixed;\n  inset: 0;\n  z-index: 1000;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 24px;\n  background: rgba(0, 0, 0, 0.72);\n  backdrop-filter: blur(6px);\n}\n\n.m0hixH_lightboxClose {\n  position: absolute;\n  top: 16px;\n  right: 16px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 38px;\n  height: 38px;\n  color: #fff;\n  background: rgba(255, 255, 255, 0.14);\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  border-radius: 50%;\n  cursor: pointer;\n}\n\n.m0hixH_lightboxClose:hover {\n  background: rgba(255, 255, 255, 0.26);\n}\n\n.m0hixH_lightboxNav {\n  position: absolute;\n  top: 50%;\n  transform: translateY(-50%);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 42px;\n  height: 42px;\n  color: #fff;\n  background: rgba(255, 255, 255, 0.14);\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  border-radius: 50%;\n  cursor: pointer;\n}\n\n.m0hixH_lightboxNav:hover {\n  background: rgba(255, 255, 255, 0.26);\n}\n\n.m0hixH_lightboxNav[data-dir='prev'] {\n  left: max(20px, calc(50% - 640px));\n}\n\n.m0hixH_lightboxNav[data-dir='next'] {\n  right: max(20px, calc(50% - 640px));\n}\n\n.m0hixH_lightboxFigure {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  margin: 0;\n  max-width: min(1100px, calc(100vw - 160px));\n  width: min(1100px, calc(100vw - 160px));\n  height: min(820px, calc(100vh - 48px));\n  min-height: 0;\n}\n\n.m0hixH_lightboxStage {\n  flex: 1;\n  min-height: 0;\n  position: relative;\n  overflow: auto;\n  border-radius: 10px;\n  background: rgba(255, 255, 255, 0.04);\n}\n\n.m0hixH_lightboxScaleFrame {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 100%;\n  min-height: 100%;\n}\n\n.m0hixH_lightboxImage {\n  display: block;\n  max-width: 100%;\n  max-height: 100%;\n  object-fit: contain;\n  border-radius: 10px;\n  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);\n}\n\n.m0hixH_lightboxTools {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n}\n\n.m0hixH_lightboxTool,\n.m0hixH_lightboxZoomLevel,\n.m0hixH_lightboxCopy {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  color: #fff;\n  background: rgba(255, 255, 255, 0.14);\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  cursor: pointer;\n}\n\n.m0hixH_lightboxTool,\n.m0hixH_lightboxZoomLevel {\n  height: 32px;\n}\n\n.m0hixH_lightboxTool {\n  width: 32px;\n  border-radius: 50%;\n}\n\n.m0hixH_lightboxZoomLevel {\n  min-width: 58px;\n  padding: 0 9px;\n  border-radius: 999px;\n  font: inherit;\n  font-size: 12px;\n  font-variant-numeric: tabular-nums;\n}\n\n.m0hixH_lightboxTool:hover,\n.m0hixH_lightboxZoomLevel:hover,\n.m0hixH_lightboxCopy:hover {\n  background: rgba(255, 255, 255, 0.26);\n}\n\n.m0hixH_lightboxCaptionRow {\n  display: flex;\n  align-items: flex-start;\n  gap: 8px;\n  min-width: 0;\n}\n\n.m0hixH_lightboxCaption {\n  flex: 1;\n  min-width: 0;\n  font-size: 12px;\n  line-height: 1.6;\n  color: rgba(255, 255, 255, 0.9);\n  display: -webkit-box;\n  -webkit-line-clamp: 3;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.m0hixH_lightboxCopy {\n  flex: none;\n  gap: 5px;\n  min-height: 28px;\n  padding: 4px 9px;\n  border-radius: 999px;\n  font: inherit;\n  font-size: 12px;\n  white-space: nowrap;\n}\n\n.m0hixH_lightboxMeta {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.m0hixH_lightboxIndex {\n  font-size: 12px;\n  color: rgba(255, 255, 255, 0.8);\n  font-variant-numeric: tabular-nums;\n}\n\n.m0hixH_lightboxActions {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.m0hixH_lightboxDownload,\n.m0hixH_lightboxEdit {\n  padding: 4px 14px;\n  font: inherit;\n  font-size: 12.5px;\n  font-weight: 500;\n  color: #fff;\n  background: rgba(255, 255, 255, 0.14);\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  border-radius: 999px;\n  text-decoration: none;\n  cursor: pointer;\n}\n\n.m0hixH_lightboxDownload:hover,\n.m0hixH_lightboxEdit:hover {\n  background: rgba(255, 255, 255, 0.26);\n}\n\n.m0hixH_lightboxEdit {\n  color: #fff;\n  background: rgba(255, 255, 255, 0.14);\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  border-radius: 999px;\n}\n\n@media (max-width: 720px) {\n  .m0hixH_lightbox {\n    padding: 16px;\n  }\n\n  .m0hixH_lightboxFigure {\n    width: calc(100vw - 32px);\n    max-width: none;\n  }\n\n  .m0hixH_lightboxNav[data-dir='prev'] {\n    left: 20px;\n  }\n\n  .m0hixH_lightboxNav[data-dir='next'] {\n    right: 20px;\n  }\n\n  .m0hixH_lightboxCaptionRow,\n  .m0hixH_lightboxMeta {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .m0hixH_lightboxCopy,\n  .m0hixH_lightboxActions {\n    align-self: flex-end;\n  }\n}\n\n@keyframes dshImageGenSpin {\n  to { transform: rotate(360deg); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .m0hixH_download, .m0hixH_spinner, .m0hixH_bigSpinner {\n    transition: none;\n    animation-duration: 1.5s;\n  }\n}\n";
		const tagId$1 = "@dickpy/dsh-imagegen/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dickpy/dsh-imagegen";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var panel_module_css_default = {
			"tsx": "m0hixH_tsx",
			"entry": "m0hixH_entry",
			"entryIcon": "m0hixH_entryIcon",
			"entryLabel": "m0hixH_entryLabel",
			"entryDot": "m0hixH_entryDot",
			"view": "m0hixH_view",
			"panel": "m0hixH_panel",
			"panelHeader": "m0hixH_panelHeader",
			"panelHeading": "m0hixH_panelHeading",
			"panelTitle": "m0hixH_panelTitle",
			"backButton": "m0hixH_backButton",
			"panelSubtitle": "m0hixH_panelSubtitle",
			"connectionStatus": "m0hixH_connectionStatus",
			"connectionDot": "m0hixH_connectionDot",
			"updateBanner": "m0hixH_updateBanner",
			"updateText": "m0hixH_updateText",
			"updateActions": "m0hixH_updateActions",
			"updateRelease": "m0hixH_updateRelease",
			"studio": "m0hixH_studio",
			"config": "m0hixH_config",
			"configScroll": "m0hixH_configScroll",
			"canvas": "m0hixH_canvas",
			"history": "m0hixH_history",
			"historyHeader": "m0hixH_historyHeader",
			"historyTitle": "m0hixH_historyTitle",
			"historyClear": "m0hixH_historyClear",
			"historyList": "m0hixH_historyList",
			"historyEmpty": "m0hixH_historyEmpty",
			"historyItem": "m0hixH_historyItem",
			"historyMain": "m0hixH_historyMain",
			"historyThumb": "m0hixH_historyThumb",
			"historyThumbPlaceholder": "m0hixH_historyThumbPlaceholder",
			"historyInfo": "m0hixH_historyInfo",
			"historyPrompt": "m0hixH_historyPrompt",
			"historyMeta": "m0hixH_historyMeta",
			"historyActions": "m0hixH_historyActions",
			"historyAction": "m0hixH_historyAction",
			"card": "m0hixH_card",
			"modeRow": "m0hixH_modeRow",
			"modePill": "m0hixH_modePill",
			"uploadBox": "m0hixH_uploadBox",
			"uploadIcon": "m0hixH_uploadIcon",
			"uploadHint": "m0hixH_uploadHint",
			"reference": "m0hixH_reference",
			"referenceImage": "m0hixH_referenceImage",
			"referenceActions": "m0hixH_referenceActions",
			"hiddenFile": "m0hixH_hiddenFile",
			"prompt": "m0hixH_prompt",
			"promptFooter": "m0hixH_promptFooter",
			"promptCount": "m0hixH_promptCount",
			"paramGroup": "m0hixH_paramGroup",
			"paramLabel": "m0hixH_paramLabel",
			"optionRow": "m0hixH_optionRow",
			"optionGrid": "m0hixH_optionGrid",
			"optionPill": "m0hixH_optionPill",
			"paramHint": "m0hixH_paramHint",
			"footer": "m0hixH_footer",
			"modelWrap": "m0hixH_modelWrap",
			"profileActions": "m0hixH_profileActions",
			"profileEditorActions": "m0hixH_profileEditorActions",
			"profileEditor": "m0hixH_profileEditor",
			"profileInput": "m0hixH_profileInput",
			"modelLabel": "m0hixH_modelLabel",
			"modelSelect": "m0hixH_modelSelect",
			"modelDatalistWrap": "m0hixH_modelDatalistWrap",
			"modelInput": "m0hixH_modelInput",
			"generateButton": "m0hixH_generateButton",
			"generateInner": "m0hixH_generateInner",
			"canvasState": "m0hixH_canvasState",
			"canvasStateTitle": "m0hixH_canvasStateTitle",
			"canvasStateHint": "m0hixH_canvasStateHint",
			"canvasEmptyIcon": "m0hixH_canvasEmptyIcon",
			"canvasError": "m0hixH_canvasError",
			"canvasBody": "m0hixH_canvasBody",
			"canvasMeta": "m0hixH_canvasMeta",
			"canvasHistoryTag": "m0hixH_canvasHistoryTag",
			"grid": "m0hixH_grid",
			"imageCard": "m0hixH_imageCard",
			"image": "m0hixH_image",
			"imageCaption": "m0hixH_imageCaption",
			"download": "m0hixH_download",
			"zoomHint": "m0hixH_zoomHint",
			"spinner": "m0hixH_spinner",
			"bigSpinner": "m0hixH_bigSpinner",
			"lightbox": "m0hixH_lightbox",
			"lightboxClose": "m0hixH_lightboxClose",
			"lightboxNav": "m0hixH_lightboxNav",
			"lightboxFigure": "m0hixH_lightboxFigure",
			"lightboxStage": "m0hixH_lightboxStage",
			"lightboxScaleFrame": "m0hixH_lightboxScaleFrame",
			"lightboxImage": "m0hixH_lightboxImage",
			"lightboxTools": "m0hixH_lightboxTools",
			"lightboxTool": "m0hixH_lightboxTool",
			"lightboxZoomLevel": "m0hixH_lightboxZoomLevel",
			"lightboxCopy": "m0hixH_lightboxCopy",
			"lightboxCaptionRow": "m0hixH_lightboxCaptionRow",
			"lightboxCaption": "m0hixH_lightboxCaption",
			"lightboxMeta": "m0hixH_lightboxMeta",
			"lightboxIndex": "m0hixH_lightboxIndex",
			"lightboxActions": "m0hixH_lightboxActions",
			"lightboxDownload": "m0hixH_lightboxDownload",
			"lightboxEdit": "m0hixH_lightboxEdit"
		};
		//#endregion
		//#region src/client/ImageGenPanel.tsx
		/**
		* The AI 生图 studio: a three-column layout — left, a card-grouped
		* configuration sidebar (mode tabs, prompt with counter, rounded parameter
		* selectors, model dropdown + generate button); center, the result canvas;
		* right, a persistent generation history column.
		*
		* Controls ride the system UI primitives (@deepseek-ai/dsh-client-ui-primitives,
		* a platform module) so the studio matches the dsh shell look by construction.
		*/
		/** Models this machine's relay has already proven for /images/generations. */
		const MODELS = [
			"fal-ai/gpt-image-2",
			"gpt-image-2",
			"gpt-image-2-1k",
			"grok-imagine-image",
			"fal-ai/flux/dev",
			"fal-ai/nano-banana",
			"fal-ai/nano-banana-2",
			"gemini-3.1-flash-image"
		];
		/** All size options for gpt-image-2. */
		const SIZES = [
			"auto",
			"1024x1024",
			"1536x1024",
			"1024x1536",
			"512x512",
			"1792x1024",
			"1024x1792"
		];
		/** Size option keys in the locale dictionary. */
		const SIZE_KEYS = {
			auto: "size.auto",
			"1024x1024": "size.square",
			"1536x1024": "size.landscape",
			"1024x1536": "size.portrait",
			"512x512": "size.small",
			"1792x1024": "size.wide",
			"1024x1792": "size.tall"
		};
		/** Quality options. */
		const QUALITIES = [
			"auto",
			"low",
			"medium",
			"high"
		];
		/** Detail options ('' = omit the passthrough). */
		const DETAILS = [
			"",
			"standard",
			"high"
		];
		const PROMPT_MAX = 2e3;
		const REF_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
		const PREVIEW_SCALE_MIN = .5;
		const PREVIEW_SCALE_MAX = 3;
		const PREVIEW_SCALE_STEP = .25;
		function clampPreviewScale(scale) {
			return Math.min(PREVIEW_SCALE_MAX, Math.max(PREVIEW_SCALE_MIN, scale));
		}
		const SELECTED_PROFILE_KEY = "dsh-imagegen.selectedProfileId";
		function readSelectedProfileId() {
			try {
				return window.localStorage.getItem(SELECTED_PROFILE_KEY) ?? "";
			} catch {
				return "";
			}
		}
		function persistSelectedProfileId(id) {
			try {
				window.localStorage.setItem(SELECTED_PROFILE_KEY, id);
			} catch {}
		}
		/** Read the current config from the settings scope snapshot. */
		function useConfig(scope) {
			const [value, setValue] = (0, react.useState)(scope.getSnapshot().value);
			(0, react.useEffect)(() => scope.subscribe(() => {
				setValue(scope.getSnapshot().value);
			}), [scope]);
			return value;
		}
		/** Track the redacted api-key presence bit exposed by the settings bridge. */
		function useKeySet(scope) {
			const [keySet, setKeySet] = (0, react.useState)(scope.getKeySetSnapshot());
			(0, react.useEffect)(() => scope.subscribeKeySet(() => {
				setKeySet(scope.getKeySetSnapshot());
			}), [scope]);
			return keySet;
		}
		/** Tick a seconds counter while `running`. */
		function useElapsed(running, startedAt) {
			const [elapsed, setElapsed] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				if (!running || startedAt === null) return;
				const timer = window.setInterval(() => {
					setElapsed(Math.max(1, Math.round((Date.now() - startedAt) / 1e3)));
				}, 1e3);
				return () => window.clearInterval(timer);
			}, [running, startedAt]);
			return elapsed;
		}
		/** Data URL for a generated image. */
		function srcOf(image) {
			return `data:${image.mime};base64,${image.b64}`;
		}
		/** Fetch persisted history image refs and decode them back to in-memory
		*  GeneratedImage[] (base64), so the canvas/preview can reuse the same
		*  rendering path as a fresh generation. */
		async function historyImagesToGenerated(refs) {
			return Promise.all(refs.map(async (ref) => {
				const response = await fetch(ref.url);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const blob = await response.blob();
				const dataUrl = await new Promise((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
					reader.onerror = () => reject(/* @__PURE__ */ new Error("image read failed"));
					reader.readAsDataURL(blob);
				});
				const comma = dataUrl.indexOf(",");
				return {
					b64: comma >= 0 ? dataUrl.slice(comma + 1) : "",
					mime: ref.mime,
					...ref.revisedPrompt === void 0 ? {} : { revisedPrompt: ref.revisedPrompt }
				};
			}));
		}
		/** Compact, locale-independent timestamp for history entries. */
		function formatTime(timestamp) {
			const d = new Date(timestamp);
			const pad = (n) => String(n).padStart(2, "0");
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
		}
		/** Render the studio. */
		function ImageGenPanel(props) {
			const { api, scope, controller } = props;
			const onClose = () => {
				controller.close();
			};
			const config = useConfig(scope);
			const enabled = config?.enabled ?? true;
			const apiUrl = config?.apiUrl ?? "";
			const configured = apiUrl.trim() !== "";
			const keySet = useKeySet(scope);
			const [profiles, setProfiles] = (0, react.useState)([]);
			const [selectedProfileId, setSelectedProfileId] = (0, react.useState)(readSelectedProfileId);
			const [mode, setMode] = (0, react.useState)("text");
			const [prompt, setPrompt] = (0, react.useState)("");
			const [size, setSize] = (0, react.useState)("auto");
			const [quality, setQuality] = (0, react.useState)("auto");
			const [count, setCount] = (0, react.useState)(1);
			const [detail, setDetail] = (0, react.useState)("");
			const [profileEditorOpen, setProfileEditorOpen] = (0, react.useState)(false);
			const [profileEditingId, setProfileEditingId] = (0, react.useState)();
			const [profileName, setProfileName] = (0, react.useState)("");
			const [profileApiUrl, setProfileApiUrl] = (0, react.useState)("");
			const [profileApiKey, setProfileApiKey] = (0, react.useState)("");
			const [profileModel, setProfileModel] = (0, react.useState)(MODELS[0]);
			const [profileBusy, setProfileBusy] = (0, react.useState)(false);
			const [model, setModel] = (0, react.useState)(MODELS[0]);
			const [refImage, setRefImage] = (0, react.useState)(null);
			const [images, setImages] = (0, react.useState)([]);
			const [error, setError] = (0, react.useState)(null);
			const [generating, setGenerating] = (0, react.useState)(false);
			const [startedAt, setStartedAt] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)([]);
			const [viewingHistoryId, setViewingHistoryId] = (0, react.useState)(null);
			const [preview, setPreview] = (0, react.useState)(null);
			const [previewScale, setPreviewScale] = (0, react.useState)(1);
			const [promptCopied, setPromptCopied] = (0, react.useState)(false);
			const [update, setUpdate] = (0, react.useState)(null);
			const [updating, setUpdating] = (0, react.useState)(false);
			const [updateMessage, setUpdateMessage] = (0, react.useState)(null);
			const [updateResult, setUpdateResult] = (0, react.useState)(null);
			const fileInput = (0, react.useRef)(null);
			const previewStage = (0, react.useRef)(null);
			const elapsed = useElapsed(generating, startedAt);
			(0, react.useEffect)(() => {
				let disposed = false;
				api.historyList().then((entries) => {
					if (!disposed) setHistory(entries);
				}).catch(() => {});
				return () => {
					disposed = true;
				};
			}, [api]);
			(0, react.useEffect)(() => {
				let disposed = false;
				api.profilesList().then((next) => {
					if (disposed) return;
					setProfiles(next);
					const chosen = next.find((profile) => profile.id === readSelectedProfileId()) ?? next[0];
					if (chosen !== void 0) {
						setSelectedProfileId(chosen.id);
						persistSelectedProfileId(chosen.id);
						setModel((current) => current === MODELS[0] || current === chosen.model ? chosen.model : current);
					}
				}).catch(() => {});
				return () => {
					disposed = true;
				};
			}, [api]);
			const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
			const profileReady = selectedProfile !== void 0 ? selectedProfile.apiUrl.trim() !== "" && selectedProfile.keySet : configured && keySet;
			const connected = enabled && profileReady;
			const modelOptions = [.../* @__PURE__ */ new Set([
				...MODELS,
				model,
				selectedProfile?.model ?? ""
			])].filter((option) => option !== "");
			const beginNewProfile = () => {
				setProfileEditingId(void 0);
				setProfileName("");
				setProfileApiUrl(apiUrl);
				setProfileApiKey("");
				setProfileModel(model);
				setProfileEditorOpen(true);
			};
			const beginEditProfile = () => {
				if (selectedProfile === void 0) return;
				setProfileEditingId(selectedProfile.id);
				setProfileName(selectedProfile.name);
				setProfileApiUrl(selectedProfile.apiUrl);
				setProfileApiKey("");
				setProfileModel(selectedProfile.model);
				setProfileEditorOpen(true);
			};
			const saveCurrentProfile = async () => {
				if (profileBusy || profileName.trim() === "" || profileApiUrl.trim() === "" || profileModel.trim() === "") return;
				setProfileBusy(true);
				try {
					const next = await api.profileSave({
						...profileEditingId === void 0 ? {} : { id: profileEditingId },
						name: profileName,
						apiUrl: profileApiUrl,
						model: profileModel,
						...profileApiKey.trim() === "" ? {} : { apiKey: profileApiKey }
					});
					setProfiles(next);
					const saved = (profileEditingId === void 0 ? void 0 : next.find((profile) => profile.id === profileEditingId)) ?? next.find((profile) => profile.name === profileName.trim() && profile.apiUrl === profileApiUrl.trim() && profile.model === profileModel.trim()) ?? next[next.length - 1];
					if (saved !== void 0) {
						setSelectedProfileId(saved.id);
						persistSelectedProfileId(saved.id);
						setModel(saved.model);
					}
					setProfileEditorOpen(false);
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setProfileBusy(false);
				}
			};
			const deleteSelectedProfile = async () => {
				if (profileBusy || selectedProfile === void 0) return;
				setProfileBusy(true);
				try {
					const next = await api.profileRemove(selectedProfile.id);
					setProfiles(next);
					const first = next[0];
					setSelectedProfileId(first?.id ?? "");
					persistSelectedProfileId(first?.id ?? "");
					setModel(first?.model ?? MODELS[0]);
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setProfileBusy(false);
				}
			};
			(0, react.useEffect)(() => {
				let disposed = false;
				api.updateCheck().then((info) => {
					if (!disposed && info.updateAvailable) setUpdate(info);
				}).catch(() => {});
				return () => {
					disposed = true;
				};
			}, [api]);
			const applyUpdate = async () => {
				if (update === null || updating) return;
				setUpdating(true);
				setUpdateMessage(null);
				setUpdateResult(null);
				try {
					const result = await api.updateApply(update.latestVersion);
					setUpdateMessage(tt("update.success", { version: result.updatedVersion }));
					setUpdateResult("success");
				} catch {
					setUpdateMessage(tt("update.failed"));
					setUpdateResult("failed");
				} finally {
					setUpdating(false);
				}
			};
			/** Read an uploaded reference image into a data URL. */
			const acceptFile = (file) => {
				if (file === void 0) return;
				if (!file.type.startsWith("image/")) {
					setError(tt("edit.uploadHint"));
					return;
				}
				if (file.size > REF_IMAGE_MAX_BYTES) {
					setError(tt("edit.uploadHint"));
					return;
				}
				const reader = new FileReader();
				reader.onload = () => {
					if (typeof reader.result === "string") setRefImage({
						dataUrl: reader.result,
						name: file.name
					});
				};
				reader.onerror = () => {
					setError(tt("edit.uploadHint"));
				};
				reader.readAsDataURL(file);
			};
			/** Run one generation. */
			const handleGenerate = async () => {
				if (generating) return;
				const promptText = prompt.trim();
				if (promptText === "") {
					setError(tt("prompt.required"));
					return;
				}
				if (mode === "edit" && refImage === null) {
					setError(tt("edit.required"));
					return;
				}
				const request = {
					mode,
					...selectedProfileId === "" ? {} : { profileId: selectedProfileId },
					model,
					prompt: promptText,
					size,
					quality,
					n: count,
					detail,
					...mode === "edit" && refImage !== null ? { image: refImage.dataUrl } : {},
					...mode === "edit" && refImage !== null ? { refName: refImage.name } : {}
				};
				setGenerating(true);
				controller.startJob();
				setError(null);
				setImages([]);
				setStartedAt(Date.now());
				let ok = false;
				try {
					const result = await api.generate(request);
					setImages(result.images);
					setViewingHistoryId(null);
					if (result.history !== void 0) setHistory(result.history);
					if (result.historyError !== void 0) setError(result.historyError);
					ok = result.images.length > 0;
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setGenerating(false);
					setStartedAt(null);
					controller.finishJob(ok);
					playNotifySound();
				}
			};
			/** Open the full-screen image preview at a given index. */
			const openPreview = (previewImages, index) => {
				setPreview({
					images: previewImages,
					index
				});
				setPreviewScale(1);
				setPromptCopied(false);
			};
			const closePreview = () => {
				setPreview(null);
				setPreviewScale(1);
				setPromptCopied(false);
			};
			/** Step the preview by ±1, wrapping around. */
			const stepPreview = (delta) => {
				setPreviewScale(1);
				setPromptCopied(false);
				setPreview((current) => {
					if (current === null) return null;
					const total = current.images.length;
					return {
						images: current.images,
						index: (current.index + delta + total) % total
					};
				});
			};
			(0, react.useEffect)(() => {
				if (preview === null) return;
				const onKey = (event) => {
					if (event.key === "Escape") closePreview();
					else if (event.key === "ArrowLeft") stepPreview(-1);
					else if (event.key === "ArrowRight") stepPreview(1);
					else if (event.key === "+" || event.key === "=") setPreviewScale((current) => clampPreviewScale(current + PREVIEW_SCALE_STEP));
					else if (event.key === "-") setPreviewScale((current) => clampPreviewScale(current - PREVIEW_SCALE_STEP));
					else if (event.key === "0") setPreviewScale(1);
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [preview]);
			(0, react.useEffect)(() => {
				if (preview === null) return;
				const frame = window.requestAnimationFrame(() => {
					const stage = previewStage.current;
					if (stage === null) return;
					stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
					stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
				});
				return () => window.cancelAnimationFrame(frame);
			}, [preview, previewScale]);
			/** Load a past generation's images into the canvas. */
			const viewHistoryEntry = async (entry) => {
				try {
					setImages(await historyImagesToGenerated(entry.images));
					setError(null);
					setViewingHistoryId(entry.id);
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			/** Restore a past generation's parameters (and its images) into the form. */
			const restoreHistoryEntry = async (entry) => {
				try {
					const restored = await historyImagesToGenerated(entry.images);
					setMode(entry.mode);
					setPrompt(entry.prompt);
					setSize(SIZES.includes(entry.size) ? entry.size : "auto");
					setQuality(QUALITIES.includes(entry.quality) ? entry.quality : "auto");
					setDetail(DETAILS.includes(entry.detail) ? entry.detail : "");
					setCount(entry.n >= 1 && entry.n <= 4 ? entry.n : 1);
					setModel(MODELS.includes(entry.model) ? entry.model : MODELS[0]);
					setRefImage(null);
					setImages(restored);
					setError(null);
					setViewingHistoryId(entry.id);
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			/** Remove one history entry. */
			const deleteHistoryEntry = async (id) => {
				setHistory(history.filter((entry) => entry.id !== id));
				if (viewingHistoryId === id) setViewingHistoryId(null);
				try {
					setHistory(await api.historyRemove(id));
				} catch {}
			};
			/** Remove all history entries. */
			const clearHistory = async () => {
				setHistory([]);
				setViewingHistoryId(null);
				try {
					setHistory(await api.historyClear());
				} catch {}
			};
			const generateDisabled = generating || !enabled || !profileReady;
			const viewingEntry = viewingHistoryId === null ? null : history.find((entry) => entry.id === viewingHistoryId) ?? null;
			const previewImage = preview === null ? null : preview.images[preview.index] ?? null;
			const previewFrameScale = Math.max(1, previewScale);
			const previewImageScale = previewScale / previewFrameScale;
			const copyPreviewPrompt = async (text) => {
				try {
					if (navigator.clipboard?.writeText !== void 0) await navigator.clipboard.writeText(text);
					else {
						const textarea = document.createElement("textarea");
						textarea.value = text;
						textarea.style.position = "fixed";
						textarea.style.opacity = "0";
						document.body.appendChild(textarea);
						textarea.select();
						const copied = document.execCommand("copy");
						textarea.remove();
						if (!copied) throw new Error("copy failed");
					}
					setPromptCopied(true);
					window.setTimeout(() => {
						setPromptCopied(false);
					}, 1800);
				} catch {
					setPromptCopied(false);
				}
			};
			const addPreviewToEdit = () => {
				if (previewImage === null || preview === null) return;
				setMode("edit");
				setRefImage({
					dataUrl: srcOf(previewImage),
					name: `dsh-image-${preview.index + 1}.${extensionOf(previewImage.mime)}`
				});
				if (prompt.trim() === "" && previewImage.revisedPrompt !== void 0) setPrompt(previewImage.revisedPrompt);
				setError(null);
				closePreview();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.panel,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: panel_module_css_default.panelHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.panelHeading,
							children: [
								onClose !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: panel_module_css_default.backButton,
									onClick: onClose,
									children: tt("panel.back")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: panel_module_css_default.panelTitle,
									children: tt("panel.title")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.panelSubtitle,
									children: tt("panel.subtitle")
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: panel_module_css_default.connectionStatus,
							"data-connected": connected ? "true" : "false",
							"aria-label": tt(connected ? "connection.connected" : "connection.disconnected"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.connectionDot,
								"aria-hidden": "true"
							}), tt(connected ? "connection.connected" : "connection.disconnected")]
						})]
					}),
					update !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.updateBanner,
						"data-kind": updateResult === "success" ? "ok" : "warn",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.updateText,
							children: updateMessage ?? tt("update.available", { version: update.latestVersion })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.updateActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								className: panel_module_css_default.updateRelease,
								href: update.releaseUrl,
								target: "_blank",
								rel: "noreferrer",
								children: tt("update.release")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: updating || updateMessage !== null,
								onClick: () => {
									applyUpdate();
								},
								children: updating ? tt("update.installing") : tt("update.install")
							})]
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.studio,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
								className: panel_module_css_default.config,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.configScroll,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
											className: panel_module_css_default.card,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: panel_module_css_default.modeRow,
												role: "tablist",
												"aria-label": tt("panel.title"),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
													active: mode === "text",
													onClick: () => {
														setMode("text");
													},
													className: panel_module_css_default.modePill,
													children: tt("mode.text")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
													active: mode === "edit",
													onClick: () => {
														setMode("edit");
													},
													className: panel_module_css_default.modePill,
													children: tt("mode.edit")
												})]
											})
										}),
										mode === "edit" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
											className: panel_module_css_default.card,
											children: [refImage === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: panel_module_css_default.uploadBox,
												onClick: () => {
													fileInput.current?.click();
												},
												onDragOver: (event) => {
													event.preventDefault();
												},
												onDrop: (event) => {
													event.preventDefault();
													acceptFile(event.dataTransfer.files?.[0]);
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.uploadIcon,
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
															viewBox: "0 0 16 16",
															width: "18",
															height: "18",
															fill: "none",
															stroke: "currentColor",
															strokeWidth: "1.3",
															strokeLinecap: "round",
															strokeLinejoin: "round",
															"aria-hidden": "true",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 10.5V3" }),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 5.5l3-3 3 3" }),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2.5 9v3.5h11V9" })
															]
														})
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("edit.upload") }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.uploadHint,
														children: tt("edit.uploadHint")
													})
												]
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: panel_module_css_default.reference,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
													className: panel_module_css_default.referenceImage,
													src: refImage.dataUrl,
													alt: refImage.name
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.referenceActions,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														variant: "outline",
														size: "sm",
														onClick: () => {
															fileInput.current?.click();
														},
														children: tt("edit.change")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														variant: "outline",
														size: "sm",
														onClick: () => {
															setRefImage(null);
														},
														children: tt("edit.remove")
													})]
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												ref: fileInput,
												type: "file",
												accept: "image/png,image/jpeg,image/webp,image/gif",
												className: panel_module_css_default.hiddenFile,
												onChange: (event) => {
													acceptFile(event.target.files?.[0]);
													event.target.value = "";
												}
											})]
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
											className: panel_module_css_default.card,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
												className: panel_module_css_default.prompt,
												value: prompt,
												maxLength: PROMPT_MAX,
												placeholder: tt("prompt.placeholder"),
												onChange: (event) => {
													setPrompt(event.target.value);
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.promptFooter,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_default.promptCount,
													children: tt("prompt.count", { count: prompt.length })
												})
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
											className: panel_module_css_default.card,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.paramGroup,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.paramLabel,
														children: tt("params.size")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: panel_module_css_default.optionGrid,
														children: SIZES.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
															active: size === option,
															onClick: () => {
																setSize(option);
															},
															className: panel_module_css_default.optionPill,
															children: tt(SIZE_KEYS[option] ?? "size.auto")
														}, option))
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.paramGroup,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.paramLabel,
														children: tt("params.quality")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: panel_module_css_default.optionRow,
														children: QUALITIES.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
															active: quality === option,
															onClick: () => {
																setQuality(option);
															},
															className: panel_module_css_default.optionPill,
															children: tt(`quality.${option}`)
														}, option))
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.paramGroup,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.paramLabel,
														children: tt("params.count")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: panel_module_css_default.optionRow,
														children: [
															1,
															2,
															3,
															4
														].map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
															active: count === option,
															onClick: () => {
																setCount(option);
															},
															className: panel_module_css_default.optionPill,
															children: tt(`count.${option === 1 ? "one" : option === 2 ? "two" : option === 3 ? "three" : "four"}`)
														}, option))
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.paramGroup,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: panel_module_css_default.paramLabel,
															children: tt("params.detail")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: panel_module_css_default.optionRow,
															children: DETAILS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
																active: detail === option,
																onClick: () => {
																	setDetail(option);
																},
																className: panel_module_css_default.optionPill,
																children: tt(option === "" ? "detail.auto" : option === "standard" ? "detail.standard" : "detail.high")
															}, option === "" ? "auto" : option))
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: panel_module_css_default.paramHint,
															children: tt("detail.hint")
														})
													]
												})
											]
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: panel_module_css_default.footer,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: panel_module_css_default.modelWrap,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.modelLabel,
												children: tt("profile.label")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												className: panel_module_css_default.modelSelect,
												value: selectedProfileId,
												disabled: generating || profileBusy,
												onChange: (event) => {
													const id = event.target.value;
													setSelectedProfileId(id);
													persistSelectedProfileId(id);
													const profile = profiles.find((item) => item.id === id);
													if (profile !== void 0) setModel(profile.model);
												},
												children: [profiles.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "",
													children: tt("profile.none")
												}) : null, profiles.map((profile) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
													value: profile.id,
													children: [
														profile.name,
														" · ",
														profile.model
													]
												}, profile.id))]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: panel_module_css_default.profileActions,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "outline",
													size: "sm",
													disabled: generating || profileBusy,
													onClick: beginNewProfile,
													children: tt("profile.new")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "outline",
													size: "sm",
													disabled: generating || profileBusy || selectedProfile === void 0,
													onClick: beginEditProfile,
													children: tt("profile.edit")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "outline",
													size: "sm",
													disabled: generating || profileBusy || selectedProfile === void 0,
													onClick: () => {
														deleteSelectedProfile();
													},
													children: tt("profile.delete")
												})
											]
										}),
										profileEditorOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: panel_module_css_default.profileEditor,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: panel_module_css_default.profileInput,
													value: profileName,
													placeholder: tt("profile.name"),
													onChange: (event) => {
														setProfileName(event.target.value);
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: panel_module_css_default.profileInput,
													value: profileApiUrl,
													placeholder: tt("profile.apiUrl"),
													onChange: (event) => {
														setProfileApiUrl(event.target.value);
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: panel_module_css_default.profileInput,
													type: "password",
													value: profileApiKey,
													placeholder: profileEditingId !== void 0 && selectedProfile?.id === profileEditingId && selectedProfile.keySet ? tt("profile.keyKeep") : tt("profile.apiKey"),
													onChange: (event) => {
														setProfileApiKey(event.target.value);
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: panel_module_css_default.profileInput,
													value: profileModel,
													placeholder: tt("profile.model"),
													onChange: (event) => {
														setProfileModel(event.target.value);
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.profileEditorActions,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														variant: "primary",
														size: "sm",
														disabled: profileBusy,
														onClick: () => {
															saveCurrentProfile();
														},
														children: tt("profile.save")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														variant: "outline",
														size: "sm",
														disabled: profileBusy,
														onClick: () => {
															setProfileEditorOpen(false);
														},
														children: tt("profile.cancel")
													})]
												})
											]
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: panel_module_css_default.modelWrap,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.modelLabel,
												children: tt("model.label")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: panel_module_css_default.modelDatalistWrap,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: panel_module_css_default.modelInput,
													type: "text",
													value: model,
													disabled: generating,
													placeholder: tt("model.placeholder"),
													list: "dsh-imagegen-model-list",
													onChange: (event) => {
														setModel(event.target.value);
													}
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
													id: "dsh-imagegen-model-list",
													children: modelOptions.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: option }, option))
												})]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											size: "md",
											className: panel_module_css_default.generateButton,
											disabled: generateDisabled,
											onClick: () => {
												handleGenerate();
											},
											children: generating ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: panel_module_css_default.generateInner,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_default.spinner }), tt("generating")]
											}) : tt("generate")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: panel_module_css_default.canvas,
								children: [
									generating ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.canvasState,
										role: "status",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_default.bigSpinner }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasStateTitle,
												children: tt("canvas.generating")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasStateHint,
												children: tt("canvas.elapsed", { seconds: elapsed })
											})
										]
									}) : null,
									!generating && error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.canvasError,
										role: "alert",
										children: tt("canvas.error", { error })
									}) : null,
									!generating && !error && images.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.canvasState,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasEmptyIcon,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
													viewBox: "0 0 24 24",
													width: "34",
													height: "34",
													fill: "none",
													stroke: "currentColor",
													strokeWidth: "1.2",
													strokeLinecap: "round",
													strokeLinejoin: "round",
													"aria-hidden": "true",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
															x: "3",
															y: "3",
															width: "18",
															height: "18",
															rx: "3"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
															cx: "8.5",
															cy: "8.5",
															r: "1.5"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 15l-5-5L5 21" })
													]
												})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasStateTitle,
												children: tt("canvas.emptyTitle")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasStateHint,
												children: tt("canvas.emptyHint")
											})
										]
									}) : null,
									!generating && images.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.canvasBody,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: panel_module_css_default.canvasMeta,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("canvas.images", { count: images.length }) }), viewingEntry !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasHistoryTag,
												children: tt("history.viewing", { time: formatTime(viewingEntry.createdAt) })
											}) : null]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.grid,
											"data-count": images.length,
											children: images.map((image, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
												className: panel_module_css_default.imageCard,
												role: "button",
												tabIndex: 0,
												title: tt("preview.open"),
												onClick: () => {
													openPreview(images, index);
												},
												onKeyDown: (event) => {
													if (event.key === "Enter" || event.key === " ") {
														event.preventDefault();
														openPreview(images, index);
													}
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
														className: panel_module_css_default.image,
														src: srcOf(image),
														alt: image.revisedPrompt ?? `${tt("panel.title")} ${index + 1}`
													}),
													image.revisedPrompt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("figcaption", {
														className: panel_module_css_default.imageCaption,
														title: image.revisedPrompt,
														children: tt("revisedPrompt", { prompt: image.revisedPrompt })
													}) : null,
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: panel_module_css_default.zoomHint,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
															viewBox: "0 0 16 16",
															width: "13",
															height: "13",
															fill: "none",
															stroke: "currentColor",
															strokeWidth: "1.4",
															strokeLinecap: "round",
															strokeLinejoin: "round",
															"aria-hidden": "true",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
																	cx: "7",
																	cy: "7",
																	r: "4"
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13 13l-3.2-3.2" }),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 5.4v3.2M5.4 7h3.2" })
															]
														}), tt("preview.open")]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
														className: panel_module_css_default.download,
														href: srcOf(image),
														download: `dsh-image-${index + 1}.${extensionOf(image.mime)}`,
														onClick: (event) => {
															event.stopPropagation();
														},
														children: tt("download")
													})
												]
											}, index))
										})]
									}) : null
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
								className: panel_module_css_default.history,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
									className: panel_module_css_default.historyHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.historyTitle,
										children: tt("history.title")
									}), history.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: panel_module_css_default.historyClear,
										onClick: () => {
											clearHistory();
										},
										children: tt("history.clear")
									}) : null]
								}), history.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_default.historyEmpty,
									children: tt("history.empty")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_default.historyList,
									children: history.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.historyItem,
										"data-active": entry.id === viewingHistoryId ? "" : void 0,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: panel_module_css_default.historyMain,
											onClick: () => {
												viewHistoryEntry(entry);
											},
											children: [entry.images.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
												className: panel_module_css_default.historyThumb,
												src: entry.images[0].url,
												alt: ""
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_default.historyThumbPlaceholder }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: panel_module_css_default.historyInfo,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_default.historyPrompt,
													children: entry.prompt
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_default.historyMeta,
													children: [
														tt(`mode.${entry.mode === "edit" ? "edit" : "text"}`),
														" · ",
														formatTime(entry.createdAt),
														" · ",
														entry.images.length,
														" ",
														tt("history.images")
													]
												})]
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: panel_module_css_default.historyActions,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: panel_module_css_default.historyAction,
												onClick: () => {
													restoreHistoryEntry(entry);
												},
												children: tt("history.restore")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: panel_module_css_default.historyAction,
												"data-danger": true,
												onClick: () => {
													deleteHistoryEntry(entry.id);
												},
												children: tt("history.delete")
											})]
										})]
									}, entry.id))
								})]
							})
						]
					}),
					preview !== null && previewImage !== null ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.lightbox,
						role: "dialog",
						"aria-modal": "true",
						"aria-label": tt("preview.title"),
						onClick: closePreview,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.lightboxClose,
								"aria-label": tt("preview.close"),
								title: tt("preview.close"),
								onClick: closePreview,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 16 16",
									width: "18",
									height: "18",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.6",
									strokeLinecap: "round",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 4l8 8M12 4l-8 8" })
								})
							}),
							preview.images.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.lightboxNav,
								"data-dir": "prev",
								"aria-label": tt("preview.prev"),
								onClick: (event) => {
									event.stopPropagation();
									stepPreview(-1);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 16 16",
									width: "20",
									height: "20",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.8",
									strokeLinecap: "round",
									strokeLinejoin: "round",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M10 3l-5 5 5 5" })
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.lightboxNav,
								"data-dir": "next",
								"aria-label": tt("preview.next"),
								onClick: (event) => {
									event.stopPropagation();
									stepPreview(1);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 16 16",
									width: "20",
									height: "20",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.8",
									strokeLinecap: "round",
									strokeLinejoin: "round",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 3l5 5-5 5" })
								})
							})] }) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
								className: panel_module_css_default.lightboxFigure,
								onClick: (event) => {
									event.stopPropagation();
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										ref: previewStage,
										className: panel_module_css_default.lightboxStage,
										onWheel: (event) => {
											event.preventDefault();
											setPreviewScale((current) => clampPreviewScale(current + (event.deltaY < 0 ? PREVIEW_SCALE_STEP : -.25)));
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.lightboxScaleFrame,
											style: {
												width: `${previewFrameScale * 100}%`,
												height: `${previewFrameScale * 100}%`
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
												className: panel_module_css_default.lightboxImage,
												style: {
													width: `${previewImageScale * 100}%`,
													height: `${previewImageScale * 100}%`
												},
												src: srcOf(previewImage),
												alt: previewImage.revisedPrompt ?? tt("preview.title")
											})
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.lightboxTools,
										role: "group",
										"aria-label": tt("preview.zoomControls"),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: panel_module_css_default.lightboxTool,
												"aria-label": tt("preview.zoomOut"),
												title: tt("preview.zoomOut"),
												onClick: () => {
													setPreviewScale((current) => clampPreviewScale(current - PREVIEW_SCALE_STEP));
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
													viewBox: "0 0 16 16",
													width: "17",
													height: "17",
													fill: "none",
													stroke: "currentColor",
													strokeWidth: "1.7",
													strokeLinecap: "round",
													"aria-hidden": "true",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
														cx: "7",
														cy: "7",
														r: "4.2"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.8 7h4.4M13 13l-2.8-2.8" })]
												})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: panel_module_css_default.lightboxZoomLevel,
												"aria-label": tt("preview.zoomReset"),
												title: tt("preview.zoomReset"),
												onClick: () => {
													setPreviewScale(1);
												},
												children: tt("preview.zoomLevel", { percent: Math.round(previewScale * 100) })
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: panel_module_css_default.lightboxTool,
												"aria-label": tt("preview.zoomIn"),
												title: tt("preview.zoomIn"),
												onClick: () => {
													setPreviewScale((current) => clampPreviewScale(current + PREVIEW_SCALE_STEP));
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
													viewBox: "0 0 16 16",
													width: "17",
													height: "17",
													fill: "none",
													stroke: "currentColor",
													strokeWidth: "1.7",
													strokeLinecap: "round",
													"aria-hidden": "true",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
														cx: "7",
														cy: "7",
														r: "4.2"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 4.8v4.4M4.8 7h4.4M13 13l-2.8-2.8" })]
												})
											})
										]
									}),
									previewImage.revisedPrompt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.lightboxCaptionRow,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("figcaption", {
											className: panel_module_css_default.lightboxCaption,
											title: previewImage.revisedPrompt,
											children: tt("revisedPrompt", { prompt: previewImage.revisedPrompt })
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: panel_module_css_default.lightboxCopy,
											"aria-label": tt(promptCopied ? "preview.copied" : "preview.copyPrompt"),
											title: tt(promptCopied ? "preview.copied" : "preview.copyPrompt"),
											onClick: () => {
												copyPreviewPrompt(previewImage.revisedPrompt);
											},
											children: [promptCopied ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
												viewBox: "0 0 16 16",
												width: "16",
												height: "16",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "1.8",
												strokeLinecap: "round",
												strokeLinejoin: "round",
												"aria-hidden": "true",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 8l3 3 7-7" })
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
												viewBox: "0 0 16 16",
												width: "16",
												height: "16",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "1.5",
												strokeLinecap: "round",
												strokeLinejoin: "round",
												"aria-hidden": "true",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
													x: "5",
													y: "5",
													width: "7",
													height: "8",
													rx: "1"
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 10V3.8c0-.44.36-.8.8-.8H9" })]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt(promptCopied ? "preview.copied" : "preview.copyPrompt") })]
										})]
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.lightboxMeta,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: panel_module_css_default.lightboxIndex,
											children: tt("preview.index", {
												index: preview.index + 1,
												total: preview.images.length
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: panel_module_css_default.lightboxActions,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: panel_module_css_default.lightboxEdit,
												onClick: addPreviewToEdit,
												children: tt("preview.addToEdit")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
												className: panel_module_css_default.lightboxDownload,
												href: srcOf(previewImage),
												download: `dsh-image-${preview.index + 1}.${extensionOf(previewImage.mime)}`,
												children: tt("download")
											})]
										})]
									})
								]
							})
						]
					}), document.body) : null
				]
			});
		}
		/** File extension for a MIME type (download filenames). */
		function extensionOf(mime) {
			switch (mime.split(";")[0].trim()) {
				case "image/jpeg": return "jpg";
				case "image/webp": return "webp";
				case "image/gif": return "gif";
				default: return "png";
			}
		}
		//#endregion
		//#region src/client/mount.tsx
		/**
		* Panel view mounting.
		*
		* The `conversation` slot is single-occupant (ui-conversation) and external
		* plugins cannot declare slots, so the panel takes over the center column at
		* the DOM level: a container is appended inside the `[data-pane="conversation"]`
		* grid item (an extra trailing child React never manages), and a stylesheet
		* rule hides the conversation content while the panel is active. Toggling is
		* a data attribute on <html> — no React involvement, so the conversation
		* subtree underneath stays mounted and stateful.
		*/
		const CONVERSATION_COLUMN_SELECTOR = "[data-pane=\"conversation\"], [class*=\"centerCol\"]";
		const ACTIVE_ATTR = "data-dsh-imagegen-active";
		/** Sibling panels' activation attributes, removed when this panel opens. */
		const OTHER_ACTIVE_ATTRS = ["data-dsh-taskboard-active", "data-dsh-ssh-active"];
		/** Cross-plugin activation event; detail is the activating panel name. */
		const ACTIVATE_EVENT = "dsh-panel-activate";
		const PANEL_NAME = "imagegen";
		/** Find the center column, or undefined while the frame is not mounted. */
		function conversationColumn() {
			return document.querySelector(CONVERSATION_COLUMN_SELECTOR) ?? void 0;
		}
		/**
		* Mount the panel React tree into the center column and bind its visibility
		* to the controller's panelOpen state.
		* @param controller - the panel controller driving the view.
		* @param api - the image-generation API client the panel operates through.
		* @param scope - the settings scope (config status banner).
		* @returns disposer unmounting the tree and restoring the column.
		*/
		function mountPanel(controller, api, scope) {
			let root;
			let container;
			const ensure = () => {
				if (container !== void 0) {
					if (container.isConnected) return;
					root?.unmount();
					root = void 0;
					container.remove();
					container = void 0;
				}
				const column = conversationColumn();
				if (column === void 0) return;
				container = document.createElement("div");
				container.dataset.dshImagegenView = "";
				container.className = panel_module_css_default.view;
				column.appendChild(container);
				root = (0, react_dom_client.createRoot)(container);
				root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ImageGenPanel, {
					api,
					scope,
					controller
				}));
			};
			const waitObserver = new MutationObserver(() => {
				ensure();
			});
			waitObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const applyActive = () => {
				if (controller.getSnapshot().panelOpen) {
					for (const attr of OTHER_ACTIVE_ATTRS) document.documentElement.removeAttribute(attr);
					document.documentElement.setAttribute(ACTIVE_ATTR, "");
					document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }));
				} else document.documentElement.removeAttribute(ACTIVE_ATTR);
			};
			const onOtherActivate = (event) => {
				const detail = event.detail;
				if ((detail === "ssh" || detail === "taskboard") && controller.getSnapshot().panelOpen) controller.close();
			};
			const SIDEBAR_ROW_SELECTOR = "[class*=\"sessionRow\"], [class*=\"projectRow\"], [class*=\"searchResultRow\"], [class*=\"searchResultWorkspace\"], [class*=\"newSession\"]";
			const onClickSidebarRow = (event) => {
				if (!controller.getSnapshot().panelOpen) return;
				const target = event.target;
				if (target === null) return;
				if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) controller.close();
			};
			document.addEventListener("click", onClickSidebarRow, true);
			document.addEventListener(ACTIVATE_EVENT, onOtherActivate);
			const unsubscribe = controller.subscribe(applyActive);
			applyActive();
			ensure();
			return () => {
				document.removeEventListener("click", onClickSidebarRow, true);
				document.removeEventListener(ACTIVATE_EVENT, onOtherActivate);
				waitObserver.disconnect();
				unsubscribe();
				document.documentElement.removeAttribute(ACTIVE_ATTR);
				root?.unmount();
				root = void 0;
				container?.remove();
				container = void 0;
			};
		}
		//#endregion
		//#region src/client/sidebar-entry.ts
		/** Family entry selectors of sibling plugins (relative placement anchor). */
		const FAMILY_ENTRY_SELECTOR = "[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-imagegen-entry]";
		/** Find the sidebar shell root element, or undefined while not yet mounted. */
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
		function newSessionButton(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
		}
		/** Build the entry row (a detached button; insert once the shell is up). */
		function createEntry(controller, label, tooltip) {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.dataset.dshImagegenEntry = "";
			entry.className = panel_module_css_default.entry;
			entry.setAttribute("aria-label", label);
			entry.setAttribute("title", tooltip);
			entry.innerHTML = "<span class=\"" + panel_module_css_default.entryIcon + "\"><svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2\" y=\"2.5\" width=\"12\" height=\"11\" rx=\"1.5\"/><circle cx=\"5.6\" cy=\"5.8\" r=\"1\"/><path d=\"M2.5 12.5l3.6-3.4 2.4 2.2 3-3 2 2.4\"/></svg></span><span class=\"" + panel_module_css_default.entryLabel + "\">" + label + "</span><span class=\"" + panel_module_css_default.entryDot + "\" data-state=\"idle\" hidden></span>";
			entry.addEventListener("click", () => {
				controller.toggle();
			});
			return entry;
		}
		function syncEntryDot(entry, jobState) {
			const dot = entry.querySelector("[class*=\"entryDot\"]");
			if (dot === null) return;
			if (jobState === "idle") {
				dot.hidden = true;
				dot.dataset.state = "idle";
				return;
			}
			dot.hidden = false;
			dot.dataset.state = jobState;
		}
		/** Re-insert the entry after the family block (task board → ssh → imagegen). */
		function placeEntry(root, entry) {
			const button = newSessionButton(root);
			if (button === void 0) return false;
			if (entry.parentElement !== root) {
				const row = button.closest("[class*=\"logoRow\"]");
				const base = row !== null && row.parentElement === root ? row : button;
				const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches(FAMILY_ENTRY_SELECTOR));
				const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling;
				root.insertBefore(entry, anchor);
			}
			return true;
		}
		/**
		* Mount the sidebar entry, waiting for the shell to render and self-healing
		* on later React re-renders.
		* @param controller - the panel controller the entry toggles.
		* @param label - the entry label (localized).
		* @param tooltip - the entry tooltip (localized).
		* @returns disposer removing the entry and its observers.
		*/
		function mountSidebarEntry(controller, label, tooltip) {
			const entry = createEntry(controller, label, tooltip);
			let root;
			let placed = false;
			const tryPlace = () => {
				if (root !== void 0 && !root.isConnected) {
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				if (placed) {
					if (document.body.contains(entry)) return;
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				root ??= sidebarRoot();
				if (root === void 0) return;
				placed = placeEntry(root, entry);
				if (placed) rootObserver.observe(root, {
					childList: true,
					subtree: true
				});
			};
			const waitObserver = new MutationObserver(() => {
				tryPlace();
			});
			waitObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const rootObserver = new MutationObserver(() => {
				if (root === void 0 || !root.isConnected) {
					placed = false;
					tryPlace();
					return;
				}
				if (!root.contains(entry)) placed = placeEntry(root, entry);
			});
			const syncActive = () => {
				const snapshot = controller.getSnapshot();
				if (snapshot.panelOpen) entry.dataset.active = "true";
				else delete entry.dataset.active;
				syncEntryDot(entry, snapshot.jobState);
				entry.title = snapshot.jobState === "generating" ? `${tooltip} · ${tt("entry.generating")}` : snapshot.jobState === "ready" ? `${tooltip} · ${tt("entry.ready")}` : snapshot.jobState === "error" ? `${tooltip} · ${tt("entry.failed")}` : tooltip;
			};
			const unsubscribe = controller.subscribe(syncActive);
			syncActive();
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver.disconnect();
				unsubscribe();
				entry.remove();
			};
		}
		//#endregion
		//#region src/client/settings-form.ts
		/**
		* Staged form model behind the plugin settings card. A card stages what the
		* user types and writes it only when they save — the settings write is a
		* durable, revision-fenced document mutation, so staging keeps what is on
		* screen exactly what a save would store. Self-contained slice of the same
		* pattern the dsh-web-ui family cards use (this package must not depend on a
		* sibling UI package).
		*/
		/** A free-text field. An empty draft clears the field. */
		function textField(field) {
			return {
				field,
				format: (value) => typeof value === "string" ? value : "",
				parse: (text) => {
					const trimmed = text.trim();
					return trimmed === "" ? { kind: "clear" } : {
						kind: "set",
						value: trimmed
					};
				}
			};
		}
		/** A boolean field, edited through true/false draft text. */
		function booleanField(field) {
			return {
				field,
				format: (value) => typeof value === "boolean" ? String(value) : "",
				parse: (text) => {
					if (text === "true") return {
						kind: "set",
						value: true
					};
					if (text === "false") return {
						kind: "set",
						value: false
					};
				}
			};
		}
		/**
		* A secret field (role('secret') in the namespace schema). The stored value is
		* never rendered or returned by the redacted wire view, so:
		*  - an empty draft means "no change" (typing nothing must never clear an
		*    invisible stored key); the dedicated clear action stages an explicit clear;
		*  - a write's outcome is judged by the namespace's secrets sidecar through
		*    the {@link CardForm} `secretSettled` hook, never by the user layer.
		*/
		function secretField(field) {
			return {
				field,
				secret: true,
				format: () => "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return void 0;
					return {
						kind: "set",
						value: trimmed
					};
				}
			};
		}
		/**
		* Stages one card's edits over one settings scope and writes them on save.
		*
		* The Host is the only authority on whether a value was accepted — its
		* validators own the constraints no schema can express — so the outcome is
		* read back from the section rather than predicted here. A save that did not
		* land keeps its drafts, so the user can correct them instead of retyping.
		*/
		var CardForm = class {
			scope;
			options;
			specs;
			staged = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			saving = false;
			failed = false;
			/**
			* @param scope - the bound settings scope for this card's namespace.
			* @param specs - the fields this card edits.
			* @param options.secretSettled - for secret fields, whether the namespace
			*   currently holds a stored secret (the redacted view never round-trips the
			*   value, so a write's outcome is read from the secrets sidecar instead).
			*/
			constructor(scope, specs, options = {}) {
				this.scope = scope;
				this.options = options;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				scope.subscribe(() => {
					this.publish();
				});
			}
			/** Publish a projection of this form, rebuilt whenever the scope or a draft changes. */
			bind(project) {
				const store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/** Read the card-level state: what the Host serves, and what a save would do. */
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status !== "loading",
					exposed: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === void 0),
					saving: this.saving,
					failed: this.failed
				};
			}
			/** Read one field's state from the effective section and its staged draft. */
			field(field) {
				const spec = this.specOf(field);
				const staged = this.staged.get(field);
				if (staged === void 0) return {
					text: spec.format(this.sectionValue(field)),
					overridden: this.stored(field),
					invalid: false
				};
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === void 0 && !(spec.secret === true && staged.text.trim() === "")
				};
			}
			/** The actions the card's slot registration injects. */
			actions() {
				return {
					edit: (field, text) => {
						this.stage(field, {
							text,
							clear: false
						});
					},
					resetField: (field) => {
						this.stage(field, {
							text: this.specOf(field).format(this.baseValue(field)),
							clear: true
						});
					},
					save: () => {
						this.save();
					},
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.failed = false;
						this.publish();
					}
				};
			}
			/**
			* Write every staged edit, then re-seed from what the Host accepted.
			* @returns settlement after every write and the read-back.
			*/
			async save() {
				const plan = this.plan();
				const writes = plan.flatMap((item) => item.run === void 0 ? [] : [item.run]);
				if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
				this.saving = true;
				this.failed = false;
				this.publish();
				let landed = true;
				for (const write of writes) landed = await write() && landed;
				if (landed) this.staged.clear();
				this.saving = false;
				this.failed = !landed;
				this.publish();
			}
			/**
			* Every staged edit a save would write. An entry whose draft is not a value
			* its field accepts carries no write: the form is still dirty, and the save
			* refuses rather than dropping the edit. A staged edit that matches the
			* effective section is not a write at all.
			*/
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const spec = this.specOf(field);
					if (staged.clear) {
						if (spec.secret === true ? this.options.secretSettled?.(field) ?? false : this.stored(field)) plan.push({
							field,
							run: () => this.clear(field)
						});
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === void 0) plan.push({
						field,
						run: void 0
					});
					else if (write.kind === "clear") plan.push({
						field,
						run: () => this.clear(field)
					});
					else plan.push({
						field,
						run: () => this.store(field, write.value)
					});
				}
				return plan;
			}
			async clear(field) {
				await this.scope.unset(field);
				if (this.specOf(field).secret === true) return !(this.options.secretSettled?.(field) ?? false);
				return !this.stored(field);
			}
			async store(field, value) {
				await this.scope.set(field, value);
				if (this.specOf(field).secret === true) return this.options.secretSettled?.(field) ?? true;
				return this.userLayer()?.[field] === value;
			}
			stage(field, edit) {
				this.staged.set(field, edit);
				this.failed = false;
				this.publish();
			}
			specOf(field) {
				const spec = this.specs.get(field);
				if (spec === void 0) throw new Error(`settings card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			publish() {
				for (const listener of [...this.listeners]) listener();
			}
		};
		//#endregion
		//#region \0dsh-css:C:\Users\五五\Desktop\项目\dsh-imagegen\src\client\settings-card.module.css.mjs
		const css = "/**\n * dsh-imagegen settings card styles. Mirrors the official plugin-config card\n * chrome (@deepseek-ai/dsh-client-ui-settings-plugins PluginCard + fields) so\n * the card reads as a sibling of the bash / agent-loop / web-search cards;\n * colors ride the dsh --dsw-* tokens.\n */\n\n.Wx3sgQ_card {\n  list-style: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-3);\n  transition: border-color 0.16s, background 0.16s;\n}\n\n.Wx3sgQ_card:hover {\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n/* An open card reads as the one being worked on, not merely taller. */\n.Wx3sgQ_card:has(.Wx3sgQ_body) {\n  background: var(--dsw-alias-bg-layer-2);\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n.Wx3sgQ_header {\n  width: 100%;\n  appearance: none;\n  border: 0;\n  background: none;\n  font: inherit;\n  color: inherit;\n  text-align: left;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 14px 16px;\n  border-radius: 12px;\n}\n\n.Wx3sgQ_header:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: -2px;\n}\n\n.Wx3sgQ_headText {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.Wx3sgQ_name {\n  font-size: 15px;\n  font-weight: 600;\n  line-height: 1.4;\n  color: var(--dsw-alias-label-primary);\n}\n\n.Wx3sgQ_description {\n  font-size: 13px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.Wx3sgQ_chevron,\n.Wx3sgQ_chevronOpen {\n  flex: none;\n  color: var(--dsw-alias-label-tertiary);\n  transition: transform 0.16s;\n}\n\n.Wx3sgQ_chevronOpen {\n  transform: rotate(180deg);\n}\n\n/* Carried on the header so a collapsed card still says it holds edits. */\n.Wx3sgQ_pending {\n  flex: none;\n  border-radius: 999px;\n  padding: 1px 8px;\n  font-size: 11px;\n  line-height: 17px;\n  font-weight: 500;\n  white-space: nowrap;\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-secondary);\n}\n\n.Wx3sgQ_body {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n  margin: 0 16px;\n  padding-bottom: 8px;\n}\n\n.Wx3sgQ_versionRow {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 12px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n}\n\n.Wx3sgQ_versionLabel {\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n}\n\n.Wx3sgQ_versionValue {\n  padding: 1px 8px;\n  border-radius: 999px;\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-secondary);\n  font-family: var(--dsw-font-family-mono, monospace);\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n/* --- fields (mirror of the official plugin-config fields) --------------------- */\n\n.Wx3sgQ_field {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 12px 0;\n}\n\n.Wx3sgQ_field + .Wx3sgQ_field {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n}\n\n.Wx3sgQ_head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.Wx3sgQ_label {\n  flex: 1;\n  min-width: 0;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n}\n\n.Wx3sgQ_badges {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.Wx3sgQ_badge {\n  border-radius: 999px;\n  padding: 1px 8px;\n  font-size: 11px;\n  line-height: 17px;\n  white-space: nowrap;\n  font-weight: 500;\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-secondary);\n}\n\n.Wx3sgQ_reset {\n  border: none;\n  background: none;\n  padding: 0;\n  font: inherit;\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n}\n\n.Wx3sgQ_reset:hover:not(:disabled) {\n  color: var(--dsw-alias-label-primary);\n}\n\n.Wx3sgQ_reset:disabled {\n  cursor: default;\n  opacity: 0.5;\n}\n\n.Wx3sgQ_input,\n.Wx3sgQ_select {\n  height: 34px;\n  padding: 0 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-3);\n  font: inherit;\n  font-size: 13px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  outline: none;\n}\n\n.Wx3sgQ_input:focus-visible,\n.Wx3sgQ_select:focus-visible {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.Wx3sgQ_input:disabled,\n.Wx3sgQ_select:disabled {\n  color: var(--dsw-alias-label-tertiary);\n  cursor: default;\n}\n\n.Wx3sgQ_inputInvalid {\n  height: 34px;\n  padding: 0 12px;\n  border: 1px solid var(--dsw-alias-label-error);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-3);\n  font: inherit;\n  font-size: 13px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  outline: none;\n}\n\n.Wx3sgQ_hint,\n.Wx3sgQ_invalid {\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.Wx3sgQ_hint {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.Wx3sgQ_invalid {\n  color: var(--dsw-alias-label-error);\n}\n\n.Wx3sgQ_readOnly,\n.Wx3sgQ_notExposed {\n  margin: 12px 0 0;\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* --- footer (mirror of the official card footer) ------------------------------ */\n\n.Wx3sgQ_footer {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 8px;\n  padding: 12px 0 4px;\n  border-top: 1px solid var(--dsw-alias-border-l2);\n}\n\n.Wx3sgQ_failed {\n  flex: 1;\n  min-width: 0;\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-error);\n}\n\n.Wx3sgQ_discard,\n.Wx3sgQ_save {\n  appearance: none;\n  border: 1px solid transparent;\n  border-radius: 8px;\n  padding: 5px 14px;\n  font: inherit;\n  font-size: 13px;\n  line-height: 1.5;\n  cursor: pointer;\n}\n\n.Wx3sgQ_discard {\n  border-color: var(--dsw-alias-border-l2);\n  background: none;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.Wx3sgQ_discard:hover:not(:disabled) {\n  color: var(--dsw-alias-label-primary);\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n.Wx3sgQ_save {\n  background: var(--dsw-alias-label-primary);\n  color: var(--dsw-alias-bg-layer-3);\n}\n\n.Wx3sgQ_discard:disabled,\n.Wx3sgQ_save:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n\n.Wx3sgQ_discard:focus-visible,\n.Wx3sgQ_save:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 1px;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .Wx3sgQ_card, .Wx3sgQ_chevron, .Wx3sgQ_chevronOpen {\n    transition: none;\n  }\n}\n";
		const tagId = "@dickpy/dsh-imagegen/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dickpy/dsh-imagegen";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"card": "Wx3sgQ_card",
			"body": "Wx3sgQ_body",
			"header": "Wx3sgQ_header",
			"headText": "Wx3sgQ_headText",
			"name": "Wx3sgQ_name",
			"description": "Wx3sgQ_description",
			"chevron": "Wx3sgQ_chevron",
			"chevronOpen": "Wx3sgQ_chevronOpen",
			"pending": "Wx3sgQ_pending",
			"versionRow": "Wx3sgQ_versionRow",
			"versionLabel": "Wx3sgQ_versionLabel",
			"versionValue": "Wx3sgQ_versionValue",
			"field": "Wx3sgQ_field",
			"head": "Wx3sgQ_head",
			"label": "Wx3sgQ_label",
			"badges": "Wx3sgQ_badges",
			"badge": "Wx3sgQ_badge",
			"reset": "Wx3sgQ_reset",
			"input": "Wx3sgQ_input",
			"select": "Wx3sgQ_select",
			"inputInvalid": "Wx3sgQ_inputInvalid",
			"hint": "Wx3sgQ_hint",
			"invalid": "Wx3sgQ_invalid",
			"readOnly": "Wx3sgQ_readOnly",
			"notExposed": "Wx3sgQ_notExposed",
			"footer": "Wx3sgQ_footer",
			"failed": "Wx3sgQ_failed",
			"discard": "Wx3sgQ_discard",
			"save": "Wx3sgQ_save"
		};
		//#endregion
		//#region src/client/SettingsCard.tsx
		/**
		* The dsh-imagegen settings card: api_url, api_key (secret, display-only
		* "set" state), and the plugin switches. Registers into the official
		* `settings.plugin.item` slot (the Settings → Plugins → Configurable tab),
		* independent of the dsh-web-ui family group, bound to the plugin's own
		* bridge settings scope.
		*/
		/** Bridges the imagegen scope onto the card's staged form. */
		var ImageGenSettingsCardController = class {
			scope;
			form;
			/** @param scope - the bound bridge scope for the dsh-imagegen namespace. */
			constructor(scope) {
				this.scope = scope;
				this.form = new CardForm(scope, [
					booleanField("enabled"),
					booleanField("announceToAgent"),
					textField("apiUrl"),
					secretField("apiKey")
				], { secretSettled: () => this.scope.getKeySetSnapshot() });
			}
			projection() {
				return {
					...this.form.shell(),
					enabled: this.form.field("enabled"),
					announceToAgent: this.form.field("announceToAgent"),
					apiUrl: this.form.field("apiUrl"),
					apiKey: this.form.field("apiKey")
				};
			}
			/**
			* Build the face the card's slot registration injects.
			* @returns the card's snapshot, the key-set flag, and the form actions.
			*/
			inject() {
				const cardStore = this.form.bind(() => this.projection());
				const keySetStore = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.scope.getKeySetSnapshot());
				this.scope.subscribeKeySet(() => {
					keySetStore.set(this.scope.getKeySetSnapshot());
				});
				return {
					hooks: {
						imageGenSettingsCard: cardStore,
						imageGenKeySet: keySetStore
					},
					...this.form.actions()
				};
			}
		};
		/**
		* Render the card.
		* @param props - locale copy, the card snapshot, and the form actions.
		* @returns the card, or nothing while the namespace is still loading.
		*/
		function ImageGenSettingsCard(props) {
			const { t } = props;
			const state = props.useImageGenSettingsCard((snapshot) => snapshot);
			const keySet = props.useImageGenKeySet((snapshot) => snapshot);
			const [open, setOpen] = (0, react.useState)(false);
			if (!state.available) return null;
			const title = t("settings.title");
			const blocked = !state.dirty || state.invalid || state.saving;
			const disabled = !state.writable;
			const fieldProps = {
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				disabled
			};
			if (!state.exposed) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: settings_card_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: settings_card_module_css_default.header,
					"aria-expanded": open,
					"aria-label": `${t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: settings_card_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.name,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.description,
							children: t("settings.description")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: open ? settings_card_module_css_default.chevronOpen : settings_card_module_css_default.chevron,
						children: "▾"
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.body,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.notExposed,
						role: "status",
						children: t("settings.notExposed")
					})
				}) : null]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: settings_card_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: settings_card_module_css_default.header,
					"aria-expanded": open,
					"aria-label": `${t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.headText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.name,
								children: title
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.description,
								children: t("settings.description")
							})]
						}),
						state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.pending,
							children: t("settings.unsaved")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: open ? settings_card_module_css_default.chevronOpen : settings_card_module_css_default.chevron,
							children: "▾"
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.readOnly,
							role: "status",
							children: t("settings.readOnly")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.versionRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.versionLabel,
								children: t("settings.currentVersion")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", {
								className: settings_card_module_css_default.versionValue,
								children: ["v", PLUGIN_VERSION]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "dsh-imagegen-settings-apikey",
							label: t("settings.apiKey"),
							hint: keySet ? t("settings.apiKeySet") : t("settings.apiKeyHint"),
							placeholder: "sk-…",
							secret: true,
							...fieldProps,
							...state.apiKey,
							overridden: false,
							onEdit: (text) => {
								props.edit("apiKey", text);
							},
							onReset: () => {
								props.resetField("apiKey");
							},
							clearLabel: t("settings.apiKeyClear"),
							onClear: () => {
								props.resetField("apiKey");
							},
							canClear: keySet
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "dsh-imagegen-settings-apiurl",
							label: t("settings.apiUrl"),
							hint: t("settings.apiUrlHint"),
							placeholder: "https://api.openai.com/v1",
							...fieldProps,
							...state.apiUrl,
							onEdit: (text) => {
								props.edit("apiUrl", text);
							},
							onReset: () => {
								props.resetField("apiUrl");
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
							id: "dsh-imagegen-settings-enabled",
							label: t("settings.enabled"),
							hint: t("settings.enabledHint"),
							inheritLabel: t("settings.inherit"),
							onLabel: t("settings.on"),
							offLabel: t("settings.off"),
							...fieldProps,
							...state.enabled,
							onEdit: (text) => {
								props.edit("enabled", text);
							},
							onReset: () => {
								props.resetField("enabled");
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
							id: "dsh-imagegen-settings-announce",
							label: t("settings.announceToAgent"),
							hint: t("settings.announceToAgentHint"),
							inheritLabel: t("settings.inherit"),
							onLabel: t("settings.on"),
							offLabel: t("settings.off"),
							...fieldProps,
							...state.announceToAgent,
							onEdit: (text) => {
								props.edit("announceToAgent", text);
							},
							onReset: () => {
								props.resetField("announceToAgent");
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: settings_card_module_css_default.failed,
									role: "status",
									children: t("settings.saveFailed")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.discard,
									children: t("settings.discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.save,
									disabled: blocked,
									onClick: props.save,
									children: t(!state.saving ? "settings.save" : "settings.saving")
								})
							]
						})
					]
				}) : null]
			});
		}
		/** A staged value field; `secret` renders a password control. */
		function ValueField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: settings_card_module_css_default.label,
								htmlFor: props.id,
								children: props.label
							}),
							props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: settings_card_module_css_default.badges,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: settings_card_module_css_default.badge,
									children: props.overriddenLabel
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.reset,
									disabled: props.disabled,
									onClick: props.onReset,
									children: props.resetLabel
								})]
							}) : null,
							props.secret === true && props.canClear === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onClear,
								children: props.clearLabel ?? props.resetLabel
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						className: props.invalid ? settings_card_module_css_default.inputInvalid : settings_card_module_css_default.input,
						type: props.secret === true ? "password" : "text",
						autoComplete: props.secret === true ? "off" : void 0,
						...props.invalid ? { "aria-invalid": true } : {},
						value: props.text,
						placeholder: props.placeholder ?? "",
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid ? settings_card_module_css_default.invalid : settings_card_module_css_default.hint,
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		/** A staged boolean field: 继承 / 开 / 关. */
		function BooleanField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						id: props.id,
						className: settings_card_module_css_default.select,
						value: props.text,
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: props.inheritLabel
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "true",
								children: props.onLabel
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "false",
								children: props.offLabel
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region src/client/settings-scope.ts
		/**
		* Browser-side settings scope for the dsh-imagegen namespace, served by the
		* plugin's own loopback bridge routes (/api/dsh-imagegen/settings). The
		* official rc.6 settings scope answers "unavailable" for every third-party
		* namespace (the host-apiproxy allowlist is hard-coded), so this package
		* re-serves its namespace through the host settings seam over a same-origin,
		* loopback-only HTTP pair — the same pattern the dsh-web-ui family bridge
		* uses, self-contained per plugin.
		*/
		/** Settings wire face over the bridge routes (fetch-backed). */
		function createBridgeApi(fetchFn) {
			const post = async (path, body) => {
				try {
					const response = await fetchFn(path, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(body)
					});
					if (!response.ok) return { result: {
						ok: false,
						code: "internal",
						message: `bridge HTTP ${response.status}`
					} };
					return { result: await response.json() };
				} catch {
					return { result: {
						ok: false,
						code: "internal",
						message: "settings bridge unreachable"
					} };
				}
			};
			return { settings: {
				describe: async (payload) => post(SETTINGS_API.describe, payload),
				mutate: async (payload) => post(SETTINGS_API.mutate, payload)
			} };
		}
		/**
		* A SettingsScope over the bridge face: serialized queue, revision-fenced
		* writes, recovery read after a refusal. Mirrors the official controller's
		* ordering but trusts the Host-seam value without re-running the wire-schema
		* validation — the seam already validated it.
		*/
		var BridgeScopeController = class {
			api;
			spec;
			store;
			/** Whether the namespace currently holds a stored secret (e.g. apiKey). */
			keySet;
			tail = Promise.resolve();
			disposed = false;
			constructor(api, spec) {
				this.api = api;
				this.spec = spec;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
					status: "loading",
					value: void 0,
					base: void 0,
					user: void 0,
					revision: void 0,
					writable: false,
					mode: "host"
				});
				this.keySet = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(false);
			}
			getSnapshot() {
				return this.store.getSnapshot();
			}
			/** Whether a stored secret exists (from the redacted view's secrets list). */
			getKeySetSnapshot() {
				return this.keySet.getSnapshot();
			}
			/** Observe the secret-set flag. */
			subscribeKeySet(listener) {
				return this.keySet.subscribe(listener);
			}
			subscribe(listener) {
				return this.store.subscribe(listener);
			}
			/** Queue a bridge refresh. */
			load() {
				return this.enqueue(() => this.read());
			}
			set(field, value) {
				return this.enqueue(() => this.write({
					op: "set",
					path: [field],
					value
				}));
			}
			unset(field) {
				return this.enqueue(() => this.write({
					op: "unset",
					path: [field]
				}));
			}
			async dispose() {
				this.disposed = true;
				await this.tail;
			}
			enqueue(operation) {
				if (this.disposed) return Promise.resolve();
				const task = this.tail.then(async () => {
					if (this.disposed) return;
					await operation();
				});
				this.tail = task.catch(() => {});
				return task;
			}
			async read() {
				let response;
				try {
					response = await this.api.describe({});
				} catch {
					if (!this.disposed) this.store.update((draft) => {
						draft.status = "unavailable";
					});
					return;
				}
				if (!response.result.ok || this.disposed) {
					if (!this.disposed) this.store.update((draft) => {
						draft.status = "unavailable";
					});
					return;
				}
				const { namespaces, writable } = response.result.value;
				const view = namespaces?.find((candidate) => candidate.ns === this.spec.namespace);
				if (view === void 0) {
					this.store.update((draft) => {
						draft.status = "unavailable";
						draft.writable = writable === true;
					});
					this.keySet.set(false);
					return;
				}
				this.accept(view, writable);
			}
			async write(op) {
				const revision = this.getSnapshot().revision;
				let response;
				try {
					response = await this.api.mutate({
						ns: this.spec.namespace,
						ops: [op],
						...revision === void 0 ? {} : { expectedRevision: revision }
					});
				} catch {
					await this.read();
					return;
				}
				if (!response.result.ok || this.disposed) {
					await this.read();
					return;
				}
				this.accept(response.result.value, void 0);
			}
			accept(view, writable) {
				this.store.update((draft) => {
					draft.revision = view.revision;
					draft.base = view.base;
					draft.user = view.user;
					if (writable !== void 0) draft.writable = writable;
					draft.status = "ready";
					draft.value = view.value;
				});
				this.keySet.set(Array.isArray(view.secrets) && view.secrets.some((secret) => secret.set));
			}
		};
		/**
		* Bind the dsh-imagegen settings scope over the bridge routes and start its
		* initial read (the caller mounts nothing until the scope settles).
		* @param fetchFn - the fetch implementation (the global fetch on loopback).
		* @returns the scope; unavailable when the bridge is unreachable.
		*/
		function bindImageGenScope(fetchFn = fetch) {
			const controller = new BridgeScopeController(createBridgeApi(fetchFn).settings, { namespace: "dsh-imagegen" });
			controller.load();
			return controller;
		}
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace this plugin owns. */
		const NS = "dsh-imagegen";
		/** Required services (fiber inject waiting — the runtime must be up first). */
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		/**
		* Mount the studio, its sidebar entry, and the settings card.
		* @param ctx - client root context (services: slots, locale, connection).
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-imagegen: dictionaries");
			const scope = bindImageGenScope(ctx.get("connection")?.isLoopback === true ? (input, init) => fetch(input, init) : () => {
				throw new Error("settings bridge is loopback-only");
			});
			ctx.effect(() => {
				const disposers = [ctx.on("connection/reset", () => {
					scope.load();
				})];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "dsh-imagegen: settings scope invalidation");
			const settingsCard = new ImageGenSettingsCardController(scope);
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				id: "imagegen",
				order: 30,
				locale: NS,
				inject: () => settingsCard.inject()
			}, ImageGenSettingsCard));
			let uiDisposer;
			const mountUi = () => {
				if (uiDisposer !== void 0) return;
				const controller = new ImageGenController();
				const api = new ImageGenApi();
				const disposers = [];
				try {
					disposers.push(mountSidebarEntry(controller, tt("entry.label"), tt("entry.tooltip")));
					disposers.push(mountPanel(controller, api, scope));
				} catch (error) {
					console.warn("[dsh-imagegen] mount failed:", error);
				}
				uiDisposer = () => {
					for (const dispose of disposers.splice(0)) dispose();
					uiDisposer = void 0;
				};
			};
			const syncEnabled = () => {
				const snapshot = scope.getSnapshot();
				if (snapshot.status === "ready" ? snapshot.value?.enabled ?? true : snapshot.status === "unavailable") mountUi();
				else uiDisposer?.();
			};
			scope.subscribe(syncEnabled);
			syncEnabled();
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map