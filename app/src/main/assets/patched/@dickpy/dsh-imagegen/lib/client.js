/* dsh-mobile-es83: syntax downleveled for Chromium<85 (logical assignment / private class members) */
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
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region src/protocol.ts
		/** Same-origin route family (loopback-only, mirroring the dsh-ssh fence). */
		const SETTINGS_API = {
			describe: "/api/dsh-imagegen/settings/describe",
			mutate: "/api/dsh-imagegen/settings/mutate"
		};
		/** The image-generation proxy route. */
		const GENERATE_API = "/api/dsh-imagegen/generate";
		/** Host-mediated OpenAI-compatible prompt enhancement endpoints. */
		const PROMPT_ENHANCE_API = {
			models: "/api/dsh-imagegen/prompt-enhance/models",
			enhance: "/api/dsh-imagegen/prompt-enhance"
		};
		/** Host-mediated candidate discovery for the configured image API. */
		const IMAGE_MODEL_API = { models: "/api/dsh-imagegen/image-models" };
		/** Host-served built-in provider catalog (channels the user can instantiate). */
		const PRESETS_API = "/api/dsh-imagegen/presets";
		/** Loopback-only image reader for Agent tool-result previews. */
		const AGENT_IMAGE_API = "/api/dsh-imagegen/agent-image";
		/** Store the current composer image for the direct edit_image command. */
		const CONVERSATION_IMAGE_API = "/api/dsh-imagegen/conversation-image";
		/**
		* Host-computed per-channel usage counters (generation-count badges in the
		* settings card): entries are tallied from the persisted history and gallery
		* by channel + model alias.
		*/
		const USAGE_API = "/api/dsh-imagegen/usage";
		/** Host-resident generation queue endpoints. */
		const TASK_API = {
			submit: "/api/dsh-imagegen/tasks/submit",
			list: "/api/dsh-imagegen/tasks/list",
			cancel: "/api/dsh-imagegen/tasks/cancel",
			retry: "/api/dsh-imagegen/tasks/retry"
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
		/**
		* Same-origin route family for the user-curated gallery (favorites). Entries
		* reuse the history wire shape and persist under ~/.dsh/dsh-imagegen/gallery/;
		* unlike history there is no size cap 鈥?the user adds images on purpose.
		*/
		const GALLERY_API = {
			list: "/api/dsh-imagegen/gallery/list",
			append: "/api/dsh-imagegen/gallery/append",
			remove: "/api/dsh-imagegen/gallery/remove",
			clear: "/api/dsh-imagegen/gallery/clear",
			tags: "/api/dsh-imagegen/gallery/tags",
			image: "/api/dsh-imagegen/gallery/image"
		};
		/**
		* Same-origin route family for the bundled prompt-template library
		* (awesome-gpt-image-2 mirror). The case list ships inside the package and is
		* served by the host; reference images are proxied through the `image` prefix
		* route and cached on disk so repeated views never hit the network again.
		*/
		const TEMPLATES_API = {
			list: "/api/dsh-imagegen/templates/list",
			refresh: "/api/dsh-imagegen/templates/refresh",
			image: "/api/dsh-imagegen/templates/image"
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
			/** Ask the configured chat model to expand a concise image prompt. */
			async enhancePrompt(prompt) {
				return (await readEnvelope(await fetch(PROMPT_ENHANCE_API.enhance, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ prompt })
				}))).prompt;
			}
			/** Stage a generated image as a durable reference for `/edit_image`. */
			async attachConversationImage(sessionId, dataUrl, name) {
				await readEnvelope(await fetch(CONVERSATION_IMAGE_API, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						sessionId,
						dataUrl,
						name
					})
				}));
			}
			async taskSubmit(request) {
				return (await readEnvelope(await fetch(TASK_API.submit, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(request)
				}))).task;
			}
			async taskList() {
				return (await readEnvelope(await fetch(TASK_API.list, { method: "POST" }))).tasks;
			}
			async taskCancel(id) {
				return (await readEnvelope(await fetch(TASK_API.cancel, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ id })
				}))).task;
			}
			async taskRetry(id) {
				return (await readEnvelope(await fetch(TASK_API.retry, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ id })
				}))).task;
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
			/** List the host-persisted gallery (newest first). */
			async galleryList() {
				return (await readEnvelope(await fetch(GALLERY_API.list, { method: "POST" }))).entries;
			}
			/** Append one image to the gallery. The host assigns the id and skips the
			*  append when a content-identical image is already in the gallery. */
			async galleryAppend(entry) {
				const body = await readEnvelope(await fetch(GALLERY_API.append, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ entry })
				}));
				return {
					entries: body.entries,
					added: body.added
				};
			}
			/** Remove one gallery entry by id. */
			async galleryRemove(id) {
				return (await readEnvelope(await fetch(GALLERY_API.remove, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ id })
				}))).entries;
			}
			/** Clear the entire gallery. */
			async galleryClear() {
				return (await readEnvelope(await fetch(GALLERY_API.clear, { method: "POST" }))).entries;
			}
			async gallerySetTags(id, tags) {
				return (await readEnvelope(await fetch(GALLERY_API.tags, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						id,
						tags
					})
				}))).entries;
			}
			/** Fetch the prompt-template library (bundled snapshot or refreshed copy). */
			async templatesList() {
				const body = await readEnvelope(await fetch(TEMPLATES_API.list, { method: "POST" }));
				return {
					cases: body.cases,
					total: body.total,
					origin: body.origin,
					repository: body.repository,
					fetchedAt: body.fetchedAt
				};
			}
			/** Re-download the template library from the upstream mirror (host-side). */
			async templatesRefresh() {
				const body = await readEnvelope(await fetch(TEMPLATES_API.refresh, { method: "POST" }));
				return {
					total: body.total,
					fetchedAt: body.fetchedAt
				};
			}
		};
		//#endregion
		//#region src/client/controller.ts
		/** The panel state owner the sidebar entry toggles and the view renders from. */
		var ImageGenController = class {
			panelOpen = false;
			listeners = /* @__PURE__ */ new Set();
			getSnapshot() {
				return { panelOpen: this.panelOpen };
			}
			subscribe(fn) {
				this.listeners.add(fn);
				return () => {
					this.listeners.delete(fn);
				};
			}
			open() {
				if (this.panelOpen) return;
				this.panelOpen = true;
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
			"entry.tooltip": "AI 生图面板（gpt-image-2 / glm-image / grok-imagine-image / nanobanana / seedream 系列）",
			"entry.newSession": "新会话",
			"entry.newSessionTooltip": "创建一个新的 DSH 会话",
			"entry.image": "生图",
			"panel.title": "AI 生图",
			"panel.githubTip": "觉得好用或有建议？欢迎来 GitHub 提 issues、点个 star 支持一下！",
			"conversation.add": "加入对话",
			"conversation.adding": "加入中…",
			"conversation.added": "图片已加入当前对话",
			"conversation.addHint": "加入对话后可使用 /edit_image 修改；命令使用插件图片模型",
			"conversation.noSession": "请先打开一个会话，再加入图片",
			"conversation.unavailable": "当前会话暂不可用",
			"conversation.busy": "当前对话正在发送，请稍后再试",
			"mode.text": "文生图",
			"mode.edit": "图生图",
			"workspace.label": "创作模式",
			"workspace.normal": "普通生图",
			"workspace.ecommerce": "电商模式",
			"chat.expand": "展开右侧对话",
			"chat.collapse": "收起右侧对话",
			"chat.toggle": "对话",
			"config.resizeHint": "拖拽调整参数栏宽度",
			"ecommerce.generation": "生成设置",
			"ecommerce.title": "电商模式",
			"ecommerce.badge": "预览",
			"ecommerce.short": "电商",
			"ecommerce.anchorPending": "已生成主图，其余图片正在自动参考主图生成，保证整套同款…",
			"ecommerce.anchorFailed": "主图生成失败，其余图片已暂停。请重试主图（或整组重新生成）后再继续。",
			"ecommerce.anchorNote": "锚定生成：先出主图，其余图片自动参考主图，保证整套同款",
			"ecommerce.noAssetWarn": "未上传商品图：主图将按文字描述生成并作为锚定基准，建议先上传商品主图获得更高一致性",
			"ecommerce.product": "商品信息",
			"ecommerce.productName": "商品名称（必填）",
			"ecommerce.projectName": "项目名称（可选）",
			"ecommerce.constraints": "卖点与约束",
			"ecommerce.sellingPoints": "商品卖点，例如：防水防污 / 大容量 / 便携",
			"ecommerce.protectedFeatures": "必须保留的特征，例如：颜色、Logo、包装文字、结构",
			"ecommerce.styleHint": "风格补充，例如：高级感 / 写实 / 自然光",
			"ecommerce.setStructure": "套图结构",
			"ecommerce.preview": "生成套图预览",
			"ecommerce.planTitle": "预计生成 {count} 张图片",
			"ecommerce.planSlot": "{count} 张 · {description}",
			"ecommerce.confirm": "确认生成整套图片",
			"ecommerce.uploadRef": "上传商品素材（可选，最多 4 张：主体 / 包装 / 细节 / 风格）",
			"ecommerce.uploadShort": "上传素材",
			"ecommerce.sellingTitle": "商品卖点",
			"ecommerce.advanced": "高级选项（项目 / 平台 / 约束）",
			"ecommerce.params": "参数选择",
			"ecommerce.platformLabel": "平台",
			"ecommerce.languageLabel": "文案语言",
			"ecommerce.ratioLabel": "比例",
			"ecommerce.categoryLabel": "类目",
			"ecommerce.multiSelect": "可多选",
			"ecommerce.countHint": "点击调整数量（1-4）",
			"ecommerce.refSettings": "参考图设置（可选）",
			"ecommerce.styleTitle": "风格 / 补充提示",
			"ecommerce.protectedLabel": "必须保留的特征（可选）",
			"ecommerce.assetsFull": "最多上传 4 张素材",
			"ecommerce.refSelect": "该用途使用的参考图",
			"ecommerce.refNone": "不使用参考图",
			"ecommerce.role.product": "商品主体",
			"ecommerce.role.packaging": "包装",
			"ecommerce.role.detail": "细节/角度",
			"ecommerce.role.style": "风格参考",
			"ecommerce.footerReady": "将生成 {count} 张套图",
			"ecommerce.footerEmpty": "请选择套图结构",
			"ecommerce.results.title": "套图结果",
			"ecommerce.results.progress": "{done}/{total} 已完成",
			"ecommerce.results.failed": "{count} 张失败",
			"ecommerce.results.empty": "确认生成后，每张图片的任务状态和结果会按用途显示在这里",
			"ecommerce.results.regenerate": "重新生成",
			"ecommerce.results.export": "导出清单",
			"ecommerce.results.newProduct": "新商品",
			"prompt.placeholder": "描述你想要的画面，例如：一只戴着宇航员头盔的橘猫，在月球上举起望远镜，水彩风格，柔和光线…",
			"prompt.required": "请输入提示词",
			"prompt.count": "{count}",
			"prompt.enhance": "增强",
			"prompt.enhancing": "增强中…",
			"prompt.enhanceHint": "使用已配置的对话模型扩写提示词",
			"prompt.configTitle": "请先配置提示词增强模型",
			"prompt.configHint": "已打开设置。进入「插件 → AI 生图」，填写或复用 API 地址和密钥，选择对话模型并保存。",
			"tasks.title": "生成任务",
			"tasks.queued": "排队中",
			"tasks.running": "生成中",
			"tasks.completed": "已完成",
			"tasks.failed": "失败",
			"tasks.cancelled": "已取消",
			"tasks.cancel": "取消",
			"tasks.retry": "重试",
			"params.size": "尺寸",
			"params.quality": "清晰度",
			"params.count": "生成数量",
			"params.detail": "细节",
			"size.auto": "自动",
			"size.square": "1:1 方图",
			"size.portrait34": "3:4 标准竖图",
			"size.landscape43": "4:3 标准横图",
			"size.portrait916": "9:16 竖屏",
			"size.portrait23": "2:3 竖图",
			"size.landscape32": "3:2 横图",
			"size.wide169": "16:9 宽屏",
			"size.ultrawide21": "21:9 超宽屏",
			"quality.auto": "自动",
			"quality.1k": "1K",
			"quality.2k": "2K",
			"quality.4k": "4K",
			"count.one": "1 张",
			"count.two": "2 张",
			"count.three": "3 张",
			"count.four": "4 张",
			"detail.auto": "自动",
			"detail.standard": "标准",
			"detail.high": "高清",
			"detail.hint": "透传参数，部分 gpt-image-2 网关支持；官方接口请保持「自动」",
			"model.label": "模型",
			"model.noEditModels": "当前模式暂无可用模型",
			"compare.enable": "多模型对比",
			"compare.models": "参与对比的模型",
			"compare.title": "多模型结果对比",
			"compare.fullscreen": "全屏对比",
			"compare.selectRequired": "请至少选择一个对比模型",
			"generate": "开始生成",
			"generating": "生成中…",
			"edit.upload": "点击或拖拽上传参考图片",
			"edit.uploadHint": "PNG / JPG / WEBP，不超过 10MB",
			"edit.change": "更换图片",
			"edit.remove": "移除",
			"edit.required": "请先上传参考图片",
			"canvas.emptyTitle": "开始你的创作",
			"canvas.emptyHint": "在左侧输入提示词并点击「开始生成」，结果将显示在这里",
			"canvas.new": "新建作图",
			"canvas.newHint": "开始新的作图并清空预览",
			"canvas.error": "生成失败：{error}",
			"canvas.submitting": "正在加入生成队列…",
			"canvas.queued": "已加入生成队列",
			"canvas.queueHint": "当前有 {count} 个任务等待处理",
			"canvas.generating": "正在生成图片…",
			"canvas.elapsed": "已用时 {seconds}s",
			"canvas.images": "本次生成 {count} 张",
			"download": "下载",
			"revisedPrompt": "优化提示词：{prompt}",
			"history.title": "历史记录",
			"history.empty": "暂无历史记录，生成图片后会保存在这里",
			"history.clear": "清空",
			"history.clearConfirm": "确定要清空全部历史记录吗？此操作不可撤销。",
			"history.restore": "恢复",
			"history.delete": "删除",
			"history.images": "张",
			"history.viewing": "历史 · {time}",
			"history.search": "搜索提示词或模型…",
			"history.model": "模型筛选",
			"history.ratio": "比例筛选",
			"history.allModels": "全部模型",
			"history.allRatios": "全部比例",
			"gallery.title": "画廊",
			"gallery.categories": "分类",
			"gallery.all": "全部作品",
			"gallery.gpt": "gpt-image-2",
			"gallery.grok": "grok-imagine-image",
			"gallery.ratio": "画面比例",
			"gallery.tags": "标签",
			"gallery.filterHint": "按生成模式、模型和比例筛选画廊",
			"gallery.count": "· 共 {count} 幅",
			"gallery.viewMode": "视图模式",
			"gallery.masonry": "瀑布流",
			"gallery.grid": "整齐网格",
			"gallery.sort": "排序",
			"gallery.newest": "最新发布",
			"gallery.oldest": "最早发布",
			"gallery.untitled": "未命名作品",
			"gallery.search": "搜索作品或模型…",
			"gallery.tagsPlaceholder": "标签，用逗号分隔",
			"gallery.tagsApply": "添加标签",
			"gallery.editTags": "编辑标签",
			"gallery.tagsEditShort": "编辑",
			"gallery.tagsSave": "保存",
			"gallery.tagsCancel": "取消",
			"gallery.selected": "已选 {count} 项",
			"gallery.selectionDone": "完成选择",
			"gallery.selectionClear": "取消选择",
			"gallery.downloadSelected": "下载所选",
			"gallery.exportJson": "导出 JSON",
			"gallery.select": "选择作品",
			"gallery.add": "加入画廊",
			"gallery.added": "已加入画廊",
			"gallery.already": "已在画廊中",
			"gallery.delete": "移出画廊",
			"gallery.clear": "清空画廊",
			"gallery.clearConfirm": "确定要清空整个画廊吗？此操作不可撤销。",
			"gallery.empty": "画廊还是空的，把喜欢的图片加入进来吧",
			"gallery.viewing": "画廊 · {time}",
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
			"config.generationTitle": "请先配置生图 API",
			"config.generationHint": "已自动打开 DSH「设置 → 插件 → AI 生图」。填写生图 API 地址与 API 密钥，保存后即可开始生成。",
			"config.enhancementTitle": "请先配置提示词增强模型",
			"config.enhancementHint": "已自动打开 DSH「设置 → 插件 → AI 生图」。填写或复用对话 API 地址和密钥，选择对话模型并保存。",
			"config.disabledTitle": "AI 生图插件已停用",
			"config.disabledHint": "已自动打开 DSH「设置 → 插件 → AI 生图」。开启「启用插件」后即可生成图片。",
			"config.configured": "已连接 {url}",
			"config.disabled": "插件已停用，请在设置中重新启用。",
			"connection.connected": "已连接",
			"connection.disconnected": "未连接",
			"panel.collapseConfig": "收起参数栏",
			"panel.expandConfig": "展开参数栏",
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
			"settings.imageModelsTitle": "生图模型",
			"settings.imageModelsHint": "保存 API 地址和密钥后检测候选模型；请只选择实际支持生图的项。",
			"settings.imageModels": "允许使用的生图模型",
			"settings.imageModelsManualHint": "一行一个模型；API 未提供 /models 时可手动填写。面板和 Agent 只能使用此列表。",
			"settings.imageModelsFetch": "检测可用模型",
			"settings.imageModelsLoading": "检测中…",
			"settings.imageModelsCandidates": "检测到的候选模型（勾选后保存）",
			"settings.addModel": "+ 手动添加",
			"settings.cancelAddModel": "收起添加",
			"settings.addModelPlaceholder": "输入模型名称，例如 qwen-image",
			"settings.addModelConfirm": "添加",
			"settings.removeModel": "移除模型",
			"settings.optional": "可选",
			"settings.moreOptions": "更多设置",
			"settings.promptEnhanceTitle": "提示词增强模型",
			"settings.promptEnhanceHint": "用于将简短描述扩写为更完整的生图提示词；留空的地址和密钥会复用生图配置。",
			"settings.promptApiUrl": "对话 API 地址（可选）",
			"settings.promptApiUrlHint": "OpenAI 兼容基址；留空则复用图像 API 地址。",
			"settings.promptApiKey": "对话 API 密钥（可选）",
			"settings.promptApiKeyHint": "留空则复用图像 API 密钥。",
			"settings.promptModel": "对话模型",
			"settings.promptModelHint": "选择或填写支持 /chat/completions 的模型。",
			"settings.promptModelDetectionHint": "默认复用生图 API；检测后点选一个模型即可。",
			"settings.promptModelsFetch": "获取可用模型",
			"settings.promptModelsLoading": "正在获取…",
			"settings.promptModelsSelect": "选择一个模型",
			"settings.promptModelsCandidates": "检测到的候选对话模型",
			"settings.addPromptModelPlaceholder": "输入对话模型名称，例如 gpt-4.1-mini",
			"settings.promptApiAdvanced": "使用独立对话 API（可选）",
			"settings.announceToAgent": "向 Agent 播报本插件",
			"settings.announceToAgentHint": "开启后，本插件的存在与能力会写入每个 Agent 的系统提示词",
			"settings.allowAgentImageGeneration": "允许 Agent 调用生图",
			"settings.allowAgentImageGenerationHint": "默认开启。关闭后，Agent 无法提交、查询或取消生图任务；侧边栏工作台不受影响。",
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
			"settings.invalidNumber": "请输入有效数字",
			"templates.open": "模板库",
			"templates.title": "提示词模板库",
			"templates.meta": "共 {count} 个模板 · {origin}",
			"templates.origin.bundled": "内置快照",
			"templates.origin.refreshed": "在线刷新",
			"templates.search": "搜索模板标题或提示词…",
			"templates.all": "全部",
			"templates.close": "关闭",
			"templates.back": "返回列表",
			"templates.use": "使用此提示词",
			"templates.copy": "复制提示词",
			"templates.copied": "已复制",
			"templates.refresh": "刷新模板库",
			"templates.refreshing": "刷新中…",
			"templates.refreshed": "已刷新，共 {count} 个模板",
			"templates.refreshFailed": "刷新失败：{error}",
			"templates.cacheAll": "缓存全部图片",
			"templates.cacheAllHint": "通过本机代理把全部参考图缓存到本地磁盘，之后离线也能浏览",
			"templates.caching": "缓存中 {done}/{total}…",
			"templates.cached": "图片已全部缓存",
			"templates.empty": "没有匹配的模板",
			"templates.loading": "正在加载模板库…",
			"templates.loadFailed": "模板库加载失败：{error}",
			"templates.retry": "重试",
			"templates.attribution": "模板与图片来自 awesome-gpt-image-2 项目，作者链接见各模板详情",
			"templates.source": "来源：vibeui.top",
			"templates.featured": "精选",
			"channels.title": "渠道",
			"channels.hint": "填写各渠道的 API 地址与密钥即可使用对应模型",
			"channels.empty": "尚无渠道，点击下方按钮添加",
			"channels.addProvider": "添加提供方",
			"channels.addCustom": "添加自定义渠道",
			"channels.untitled": "未命名渠道",
			"channels.keySet": "密钥已设置",
			"channels.keyMissing": "未设置密钥",
			"channels.modelCount": "{n} 个模型",
			"channels.noModels": "未配置模型",
			"channels.defaultLabel": "默认",
			"channels.statusReady": "可用",
			"channels.statusIncomplete": "配置未完成",
			"channels.edit": "编辑",
			"channels.delete": "删除",
			"channels.deleteConfirmTitle": "删除渠道「{name}」？该渠道的密钥将被移除；历史与画廊中的记录仍会保留。",
			"channels.confirm": "确认删除",
			"channels.cancel": "取消",
			"channels.editorTitle": "渠道",
			"channels.editorSaveNote": "改动将随卡片底部「保存」一起生效",
			"channels.displayName": "显示名称",
			"channels.apiUrl": "API 地址",
			"channels.apiKey": "API 密钥",
			"channels.keyReplaceHint": "已配置 — 输入新值可替换",
			"channels.keyMissingHint": "填写密钥",
			"channels.keyClear": "清除密钥",
			"channels.modelCatalogTitle": "模型目录",
			"channels.noModelsHint": "暂无模型：点击「检测」拉取候选，或手动添加；别名（显示名）默认等于上游模型 id，可自行修改。",
			"channels.detect": "重新检测",
			"channels.detecting": "检测中…",
			"channels.detectSuccess": "连通 ✓ · {n} 个候选",
			"channels.detectFailed": "检测失败：{error}",
			"channels.detectOk": "已连接该 API",
			"channels.modelAliasLabel": "显示名（别名）",
			"channels.modelIdLabel": "上游模型 id",
			"channels.generated": "已生成 {n} 次",
			"channels.unknownProtocol": "未知协议，按通用 OpenAI 协议尝试",
			"channels.removeModel": "移除模型",
			"channels.manualAddPlaceholder": "输入模型 id，例如 qwen-image",
			"channels.addModelConfirm": "添加",
			"channels.copyFrom": "从其他渠道复制…",
			"channels.copyApply": "复制",
			"channels.candidatesTitle": "图片模型候选（点击加入）",
			"channels.deleteThisChannel": "删除此渠道",
			"channels.setDefault": "设为默认渠道",
			"channels.presetPickerTitle": "添加提供方",
			"channels.presetPickerHint": "选择一个内置提供方，仅需填写 API 密钥",
			"channels.presetCustomHint": "自行填写 API 地址、密钥与模型目录",
			"channels.presetLoadFailed": "加载提供方失败：{error}"
		};
		const en = {
			"entry.label": "AI Image",
			"entry.tooltip": "AI image generation studio (gpt-image-2 / glm-image / grok-imagine-image / nanobanana / seedream family)",
			"entry.newSession": "New session",
			"entry.newSessionTooltip": "Create a new DSH session",
			"entry.image": "Image",
			"panel.title": "AI Image",
			"panel.githubTip": "Like it or have suggestions? Head to GitHub to open issues and star us!",
			"conversation.add": "Add to chat",
			"conversation.adding": "Adding…",
			"conversation.added": "Image added to the current chat",
			"conversation.addHint": "After adding to chat, use /edit_image to modify it; the command uses the plugin image model",
			"conversation.noSession": "Open a session before adding an image",
			"conversation.unavailable": "The current session is unavailable",
			"conversation.busy": "The chat is sending a message; try again shortly",
			"mode.text": "Text to Image",
			"mode.edit": "Image to Image",
			"workspace.label": "Workspace",
			"workspace.normal": "Standard",
			"workspace.ecommerce": "E-commerce",
			"chat.expand": "Expand the conversation pane",
			"chat.collapse": "Collapse the conversation pane",
			"chat.toggle": "Chat",
			"config.resizeHint": "Drag to resize the parameter panel",
			"ecommerce.generation": "Generation settings",
			"ecommerce.title": "E-commerce Mode",
			"ecommerce.badge": "Beta",
			"ecommerce.short": "Store",
			"ecommerce.anchorPending": "Main image generated — remaining images are being generated with the main image as reference to keep the set consistent…",
			"ecommerce.anchorFailed": "Main image failed; remaining images are paused. Retry the main image or regenerate the set.",
			"ecommerce.anchorNote": "Anchored: main image first, remaining images reference it automatically for a consistent set",
			"ecommerce.noAssetWarn": "No product image uploaded: the main image will be generated from text as the anchor. Upload one for higher consistency.",
			"ecommerce.product": "Product details",
			"ecommerce.productName": "Product name (required)",
			"ecommerce.projectName": "Project name (optional)",
			"ecommerce.constraints": "Selling points & constraints",
			"ecommerce.sellingPoints": "Selling points, e.g. waterproof / large capacity / portable",
			"ecommerce.protectedFeatures": "Features to preserve: color, logo, packaging text, structure",
			"ecommerce.styleHint": "Style hint, e.g. premium / realistic / natural light",
			"ecommerce.setStructure": "Image set structure",
			"ecommerce.preview": "Preview product set",
			"ecommerce.planTitle": "Plan to generate {count} images",
			"ecommerce.planSlot": "{count} images · {description}",
			"ecommerce.confirm": "Confirm and generate set",
			"ecommerce.uploadRef": "Upload product assets (optional, up to 4: product / packaging / detail / style)",
			"ecommerce.uploadShort": "Upload",
			"ecommerce.sellingTitle": "Selling points",
			"ecommerce.advanced": "Advanced (project / platform / constraints)",
			"ecommerce.params": "Parameters",
			"ecommerce.platformLabel": "Platform",
			"ecommerce.languageLabel": "Copy language",
			"ecommerce.ratioLabel": "Aspect ratio",
			"ecommerce.categoryLabel": "Category",
			"ecommerce.multiSelect": "multi-select",
			"ecommerce.countHint": "Click to adjust count (1-4)",
			"ecommerce.refSettings": "Reference images (optional)",
			"ecommerce.styleTitle": "Style / extra hints",
			"ecommerce.protectedLabel": "Features to preserve (optional)",
			"ecommerce.assetsFull": "Up to 4 assets",
			"ecommerce.refSelect": "Reference image for this slot",
			"ecommerce.refNone": "No reference",
			"ecommerce.role.product": "Product",
			"ecommerce.role.packaging": "Packaging",
			"ecommerce.role.detail": "Detail / angle",
			"ecommerce.role.style": "Style",
			"ecommerce.footerReady": "{count} images in this set",
			"ecommerce.footerEmpty": "Select the image set structure",
			"ecommerce.results.title": "Product set results",
			"ecommerce.results.progress": "{done}/{total} completed",
			"ecommerce.results.failed": "{count} failed",
			"ecommerce.results.empty": "After confirming, each image task and result will show here grouped by purpose",
			"ecommerce.results.regenerate": "Regenerate",
			"ecommerce.results.export": "Export manifest",
			"ecommerce.results.newProduct": "New product",
			"prompt.placeholder": "Describe the picture you want, e.g. an orange cat in an astronaut helmet raising a telescope on the moon, watercolor style, soft light…",
			"prompt.required": "Enter a prompt first",
			"prompt.count": "{count}",
			"prompt.enhance": "Enhance",
			"prompt.enhancing": "Enhancing…",
			"prompt.enhanceHint": "Expand the prompt with the configured chat model",
			"prompt.configTitle": "Configure a prompt enhancement model first",
			"prompt.configHint": "Settings has opened. Go to Plugins → AI Image, configure or reuse an API URL and key, choose a chat model, then save.",
			"tasks.title": "Generation tasks",
			"tasks.queued": "Queued",
			"tasks.running": "Generating",
			"tasks.completed": "Completed",
			"tasks.failed": "Failed",
			"tasks.cancelled": "Cancelled",
			"tasks.cancel": "Cancel",
			"tasks.retry": "Retry",
			"params.size": "Size",
			"params.quality": "Quality",
			"params.count": "Count",
			"params.detail": "Detail",
			"size.auto": "Auto",
			"size.square": "1:1 Square",
			"size.portrait34": "3:4 Portrait",
			"size.landscape43": "4:3 Landscape",
			"size.portrait916": "9:16 Vertical",
			"size.portrait23": "2:3 Portrait",
			"size.landscape32": "3:2 Landscape",
			"size.wide169": "16:9 Widescreen",
			"size.ultrawide21": "21:9 Ultrawide",
			"quality.auto": "Auto",
			"quality.1k": "1K",
			"quality.2k": "2K",
			"quality.4k": "4K",
			"count.one": "1",
			"count.two": "2",
			"count.three": "3",
			"count.four": "4",
			"detail.auto": "Auto",
			"detail.standard": "Standard",
			"detail.high": "High",
			"detail.hint": "Passthrough parameter supported by some gpt-image-2 gateways; keep \"Auto\" for official endpoints",
			"model.label": "Model",
			"model.noEditModels": "No model is available for this mode",
			"compare.enable": "Multi-model comparison",
			"compare.models": "Models to compare",
			"compare.title": "Multi-model comparison",
			"compare.fullscreen": "Fullscreen comparison",
			"compare.selectRequired": "Select at least one model",
			"generate": "Generate",
			"generating": "Generating…",
			"edit.upload": "Click or drag to upload a reference image",
			"edit.uploadHint": "PNG / JPG / WEBP, up to 10MB",
			"edit.change": "Change image",
			"edit.remove": "Remove",
			"edit.required": "Upload a reference image first",
			"canvas.emptyTitle": "Start creating",
			"canvas.emptyHint": "Enter a prompt on the left and click \"Generate\"; results appear here",
			"canvas.new": "New creation",
			"canvas.newHint": "Start a new creation and clear the preview",
			"canvas.error": "Generation failed: {error}",
			"canvas.submitting": "Adding to the generation queue…",
			"canvas.queued": "Added to the generation queue",
			"canvas.queueHint": "{count} task(s) waiting or generating",
			"canvas.generating": "Generating images…",
			"canvas.elapsed": "Elapsed {seconds}s",
			"canvas.images": "{count} image(s) generated",
			"download": "Download",
			"revisedPrompt": "Refined prompt: {prompt}",
			"history.title": "History",
			"history.empty": "No history yet — generations will be saved here",
			"history.clear": "Clear",
			"history.clearConfirm": "Clear all history? This action cannot be undone.",
			"history.restore": "Restore",
			"history.delete": "Delete",
			"history.images": "images",
			"history.viewing": "History · {time}",
			"history.search": "Search prompt or model…",
			"history.model": "Model filter",
			"history.ratio": "Ratio filter",
			"history.allModels": "All models",
			"history.allRatios": "All ratios",
			"gallery.title": "Gallery",
			"gallery.categories": "Categories",
			"gallery.all": "All works",
			"gallery.gpt": "gpt-image-2",
			"gallery.grok": "grok-imagine-image",
			"gallery.ratio": "Aspect ratio",
			"gallery.tags": "Tags",
			"gallery.filterHint": "Filter by mode, model, and aspect ratio",
			"gallery.count": "· {count} works",
			"gallery.viewMode": "View mode",
			"gallery.masonry": "Masonry",
			"gallery.grid": "Grid",
			"gallery.sort": "Sort",
			"gallery.newest": "Newest",
			"gallery.oldest": "Oldest",
			"gallery.untitled": "Untitled work",
			"gallery.search": "Search works or models…",
			"gallery.tagsPlaceholder": "Tags, comma separated",
			"gallery.tagsApply": "Add tags",
			"gallery.editTags": "Edit tags",
			"gallery.tagsEditShort": "Edit",
			"gallery.tagsSave": "Save",
			"gallery.tagsCancel": "Cancel",
			"gallery.selected": "{count} selected",
			"gallery.selectionDone": "Done selecting",
			"gallery.selectionClear": "Clear selection",
			"gallery.downloadSelected": "Download selected",
			"gallery.exportJson": "Export JSON",
			"gallery.select": "Select work",
			"gallery.add": "Add to gallery",
			"gallery.added": "Added to gallery",
			"gallery.already": "Already in gallery",
			"gallery.delete": "Remove",
			"gallery.clear": "Clear gallery",
			"gallery.clearConfirm": "Clear the entire gallery? This action cannot be undone.",
			"gallery.empty": "The gallery is empty — add images you like here",
			"gallery.viewing": "Gallery · {time}",
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
			"config.generationTitle": "Configure the image API first",
			"config.generationHint": "DSH Settings → Plugins → AI Image has opened. Enter the image API URL and API key, then save before generating.",
			"config.enhancementTitle": "Configure a prompt enhancement model first",
			"config.enhancementHint": "DSH Settings → Plugins → AI Image has opened. Configure or reuse a chat API URL and key, choose a chat model, then save.",
			"config.disabledTitle": "The AI Image plugin is disabled",
			"config.disabledHint": "DSH Settings → Plugins → AI Image has opened. Enable the plugin, then generate images.",
			"config.configured": "Connected to {url}",
			"config.disabled": "The plugin is disabled — re-enable it in Settings.",
			"connection.connected": "Connected",
			"connection.disconnected": "Disconnected",
			"panel.collapseConfig": "Collapse settings panel",
			"panel.expandConfig": "Expand settings panel",
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
			"settings.imageModelsTitle": "Image generation models",
			"settings.imageModelsHint": "Save the API URL and key, then detect candidate models. Select only models that actually support image generation.",
			"settings.imageModels": "Allowed image models",
			"settings.imageModelsManualHint": "One model per line. Add models manually when the API does not provide /models. The panel and Agent can use only this list.",
			"settings.imageModelsFetch": "Detect available models",
			"settings.imageModelsLoading": "Detecting…",
			"settings.imageModelsCandidates": "Detected candidate models (select, then save)",
			"settings.addModel": "+ Add manually",
			"settings.cancelAddModel": "Hide add",
			"settings.addModelPlaceholder": "Enter a model name, e.g. qwen-image",
			"settings.addModelConfirm": "Add",
			"settings.removeModel": "Remove model",
			"settings.optional": "Optional",
			"settings.moreOptions": "More settings",
			"settings.promptEnhanceTitle": "Prompt enhancement model",
			"settings.promptEnhanceHint": "Expands short requests into complete image prompts. Blank URL and key reuse the image API configuration.",
			"settings.promptApiUrl": "Chat API URL (optional)",
			"settings.promptApiUrlHint": "OpenAI-compatible base URL. Leave blank to reuse the image API URL.",
			"settings.promptApiKey": "Chat API key (optional)",
			"settings.promptApiKeyHint": "Leave blank to reuse the image API key.",
			"settings.promptModel": "Chat model",
			"settings.promptModelHint": "Select or enter a model supporting /chat/completions.",
			"settings.promptModelDetectionHint": "Uses the image API by default. Detect and select one model.",
			"settings.promptModelsFetch": "Fetch available models",
			"settings.promptModelsLoading": "Fetching…",
			"settings.promptModelsSelect": "Select a model",
			"settings.promptModelsCandidates": "Detected chat model candidates",
			"settings.addPromptModelPlaceholder": "Enter a chat model name, e.g. gpt-4.1-mini",
			"settings.promptApiAdvanced": "Use a separate chat API (optional)",
			"settings.announceToAgent": "Announce this plugin to agents",
			"settings.announceToAgentHint": "When on, the plugin presence and capabilities are written into every agent system prompt",
			"settings.allowAgentImageGeneration": "Allow agents to generate images",
			"settings.allowAgentImageGenerationHint": "On by default. When off, agents cannot submit, query, or cancel image tasks; the sidebar studio remains available.",
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
			"settings.invalidNumber": "Enter a valid number",
			"templates.open": "Templates",
			"templates.title": "Prompt Template Library",
			"templates.meta": "{count} templates · {origin}",
			"templates.origin.bundled": "bundled snapshot",
			"templates.origin.refreshed": "refreshed online",
			"templates.search": "Search template titles or prompts…",
			"templates.all": "All",
			"templates.close": "Close",
			"templates.back": "Back to list",
			"templates.use": "Use this prompt",
			"templates.copy": "Copy prompt",
			"templates.copied": "Copied",
			"templates.refresh": "Refresh library",
			"templates.refreshing": "Refreshing…",
			"templates.refreshed": "Refreshed — {count} templates",
			"templates.refreshFailed": "Refresh failed: {error}",
			"templates.cacheAll": "Cache all images",
			"templates.cacheAllHint": "Mirror every reference image to local disk through the host proxy, for offline browsing",
			"templates.caching": "Caching {done}/{total}…",
			"templates.cached": "All images cached",
			"templates.empty": "No matching templates",
			"templates.loading": "Loading the template library…",
			"templates.loadFailed": "Failed to load the library: {error}",
			"templates.retry": "Retry",
			"templates.attribution": "Templates and images come from the awesome-gpt-image-2 project; author links are on each template",
			"templates.source": "Source: vibeui.top",
			"templates.featured": "Featured",
			"channels.title": "Channels",
			"channels.hint": "Fill in each channel's API URL and key to use its models",
			"channels.empty": "No channels yet — add one below",
			"channels.addProvider": "Add provider",
			"channels.addCustom": "Add custom channel",
			"channels.untitled": "Untitled channel",
			"channels.keySet": "Key set",
			"channels.keyMissing": "Key missing",
			"channels.modelCount": "{n} model(s)",
			"channels.noModels": "No models",
			"channels.defaultLabel": "Default",
			"channels.statusReady": "Ready",
			"channels.statusIncomplete": "Config incomplete",
			"channels.edit": "Edit",
			"channels.delete": "Delete",
			"channels.deleteConfirmTitle": "Delete channel \"{name}\"? Its key will be removed; history and gallery records are kept.",
			"channels.confirm": "Delete",
			"channels.cancel": "Cancel",
			"channels.editorTitle": "Channel",
			"channels.editorSaveNote": "Changes take effect with the card's \"Save\" button",
			"channels.displayName": "Display name",
			"channels.apiUrl": "API URL",
			"channels.apiKey": "API key",
			"channels.keyReplaceHint": "Configured — type a new value to replace it",
			"channels.keyMissingHint": "Enter a key",
			"channels.keyClear": "Clear key",
			"channels.modelCatalogTitle": "Model catalog",
			"channels.noModelsHint": "No models yet: run \"Detect\" to pull candidates, or add one manually; the alias (display name) defaults to the upstream model id and can be renamed.",
			"channels.detect": "Re-detect",
			"channels.detecting": "Detecting…",
			"channels.detectSuccess": "Connected ✓ · {n} candidates",
			"channels.detectFailed": "Detection failed: {error}",
			"channels.detectOk": "Connected to this API",
			"channels.modelAliasLabel": "Display name (alias)",
			"channels.modelIdLabel": "Upstream model id",
			"channels.generated": "Generated {n} time(s)",
			"channels.unknownProtocol": "Unknown protocol — best-effort OpenAI",
			"channels.removeModel": "Remove model",
			"channels.manualAddPlaceholder": "Enter a model id, e.g. qwen-image",
			"channels.addModelConfirm": "Add",
			"channels.copyFrom": "Copy from another channel…",
			"channels.copyApply": "Copy",
			"channels.candidatesTitle": "Image model candidates (click to add)",
			"channels.deleteThisChannel": "Delete this channel",
			"channels.setDefault": "Set as default channel",
			"channels.presetPickerTitle": "Add provider",
			"channels.presetPickerHint": "Pick a built-in provider — only the API key is needed",
			"channels.presetCustomHint": "Configure the API URL, key, and model catalog yourself",
			"channels.presetLoadFailed": "Failed to load providers: {error}"
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
		//#region \0dsh-css:E:\dsh-plugin\src\client\templates.module.css.mjs
		const css$3 = ".o0mAxG_overlay,.o0mAxG_overlay *,.o0mAxG_overlay :before,.o0mAxG_overlay :after{box-sizing:border-box}.o0mAxG_overlay{z-index:130;background:var(--dsw-alias-bg-mask-1);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);justify-content:center;align-items:center;padding:28px;display:flex;position:fixed;inset:0}.o0mAxG_shell{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:14px;flex-direction:column;width:min(1180px,100%);height:100%;max-height:100%;display:flex;overflow:hidden;box-shadow:0 18px 60px #00000047}.o0mAxG_header{flex:none;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px 10px;display:flex}.o0mAxG_heading{align-items:baseline;gap:10px;min-width:0;display:flex}.o0mAxG_title{margin:0;font-size:15px;font-weight:650}.o0mAxG_meta{color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-size:12px}.o0mAxG_headerActions{flex:none;align-items:center;gap:8px;display:inline-flex}.o0mAxG_close{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;display:inline-flex}.o0mAxG_close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.o0mAxG_toolbar{flex-direction:column;flex:none;gap:10px;padding:0 18px 12px;display:flex}.o0mAxG_search{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);width:100%;height:34px;color:var(--dsw-alias-label-primary);border-radius:9px;outline:none;padding:0 12px;font-family:inherit;font-size:13px}.o0mAxG_search:focus{border-color:var(--dsw-alias-brand-primary)}.o0mAxG_search::placeholder{color:var(--dsw-alias-label-dimmed)}.o0mAxG_categoryRow{flex-wrap:wrap;gap:6px;max-height:64px;display:flex;overflow-y:auto}.o0mAxG_categoryPill{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);height:26px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;border-radius:999px;padding:0 11px;font-family:inherit;font-size:12px}.o0mAxG_categoryPill:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.o0mAxG_categoryPill[data-active]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}.o0mAxG_notice{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:9px;flex:none;margin:0 18px 10px;padding:8px 12px;font-size:12px}.o0mAxG_body{flex:1;min-height:0;padding:2px 18px 14px;overflow-y:auto}.o0mAxG_state{height:100%;min-height:220px;color:var(--dsw-alias-label-tertiary);flex-direction:column;justify-content:center;align-items:center;gap:12px;font-size:13px;display:flex}.o0mAxG_spinner{border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;width:26px;height:26px;animation:.9s linear infinite o0mAxG_dsh-imagegen-templates-spin}@keyframes o0mAxG_dsh-imagegen-templates-spin{to{transform:rotate(360deg)}}.o0mAxG_grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;display:grid}.o0mAxG_card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);cursor:pointer;text-align:left;color:var(--dsw-alias-label-primary);border-radius:11px;flex-direction:column;gap:0;padding:0;font-family:inherit;transition:border-color .15s,transform .15s;display:flex;overflow:hidden}.o0mAxG_card:hover{border-color:var(--dsw-alias-brand-primary);transform:translateY(-1px)}.o0mAxG_thumbWrap{aspect-ratio:1;background:var(--dsw-alias-bg-layer-2);width:100%;display:block;position:relative}.o0mAxG_thumb{object-fit:cover;width:100%;height:100%;display:block}.o0mAxG_thumbPlaceholder{width:100%;height:100%;color:var(--dsw-alias-label-dimmed);justify-content:center;align-items:center;display:flex}.o0mAxG_featuredBadge{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;position:absolute;top:8px;left:8px}.o0mAxG_cardBody{flex-direction:column;gap:4px;min-width:0;padding:9px 11px 10px;display:flex}.o0mAxG_cardTitle{-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12.5px;font-weight:600;line-height:1.35;display:-webkit-box;overflow:hidden}.o0mAxG_cardMeta{min-width:0;color:var(--dsw-alias-label-tertiary);align-items:center;gap:6px;font-size:11px;display:flex}.o0mAxG_cardCategory{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 7px}.o0mAxG_cardSource{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.o0mAxG_footer{border-top:1px solid var(--dsw-alias-border-l1);flex:none;justify-content:space-between;align-items:center;gap:10px;padding:9px 18px;display:flex}.o0mAxG_attribution{color:var(--dsw-alias-label-dimmed);min-width:0;font-size:11.5px}.o0mAxG_sourceLink{color:var(--dsw-alias-brand-primary);white-space:nowrap;flex:none;font-size:11.5px;font-weight:600;text-decoration:none}.o0mAxG_sourceLink:hover{text-decoration:underline}.o0mAxG_detailOverlay{background:var(--dsw-alias-bg-mask-1);justify-content:center;align-items:center;padding:34px;display:flex;position:absolute;inset:0}.o0mAxG_detail{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:14px;grid-template-rows:minmax(0,1fr);grid-template-columns:minmax(0,5fr) minmax(0,4fr);gap:0;width:min(980px,100%);max-height:100%;display:grid;overflow:hidden;box-shadow:0 18px 60px #00000052}.o0mAxG_detailMedia{background:var(--dsw-alias-bg-layer-2);justify-content:center;align-items:center;min-height:0;display:flex;overflow:hidden}.o0mAxG_detailImage{object-fit:contain;width:100%;height:100%;display:block}.o0mAxG_detailInfo{flex-direction:column;gap:10px;min-height:0;padding:18px;display:flex;overflow-y:auto}.o0mAxG_detailTitle{margin:0;font-size:15px;font-weight:650;line-height:1.4}.o0mAxG_detailMeta{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;display:flex}.o0mAxG_detailLink{color:var(--dsw-alias-brand-primary);text-overflow:ellipsis;white-space:nowrap;text-decoration:none;overflow:hidden}.o0mAxG_detailLink:hover{text-decoration:underline}.o0mAxG_detailPrompt{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-height:0;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;user-select:text;border-radius:10px;flex:1;margin:0;padding:12px;font-family:inherit;font-size:12.5px;line-height:1.6;overflow-y:auto}.o0mAxG_detailActions{background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l1);flex:none;gap:8px;margin:0 -18px -18px;padding:12px 18px;display:flex;position:sticky;bottom:0}@media (width<=760px){.o0mAxG_detail{grid-template-rows:minmax(0,3fr) minmax(0,4fr);grid-template-columns:1fr}}";
		const tagId$3 = "@dickpy/dsh-imagegen/templates.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dickpy/dsh-imagegen";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var templates_module_css_default = {
			"categoryRow": "o0mAxG_categoryRow",
			"headerActions": "o0mAxG_headerActions",
			"state": "o0mAxG_state",
			"detailLink": "o0mAxG_detailLink",
			"toolbar": "o0mAxG_toolbar",
			"card": "o0mAxG_card",
			"cardCategory": "o0mAxG_cardCategory",
			"categoryPill": "o0mAxG_categoryPill",
			"thumbPlaceholder": "o0mAxG_thumbPlaceholder",
			"spinner": "o0mAxG_spinner",
			"thumbWrap": "o0mAxG_thumbWrap",
			"sourceLink": "o0mAxG_sourceLink",
			"featuredBadge": "o0mAxG_featuredBadge",
			"footer": "o0mAxG_footer",
			"search": "o0mAxG_search",
			"cardBody": "o0mAxG_cardBody",
			"cardSource": "o0mAxG_cardSource",
			"detailOverlay": "o0mAxG_detailOverlay",
			"detailInfo": "o0mAxG_detailInfo",
			"detailTitle": "o0mAxG_detailTitle",
			"detailActions": "o0mAxG_detailActions",
			"body": "o0mAxG_body",
			"attribution": "o0mAxG_attribution",
			"cardMeta": "o0mAxG_cardMeta",
			"heading": "o0mAxG_heading",
			"thumb": "o0mAxG_thumb",
			"detailPrompt": "o0mAxG_detailPrompt",
			"grid": "o0mAxG_grid",
			"shell": "o0mAxG_shell",
			"overlay": "o0mAxG_overlay",
			"header": "o0mAxG_header",
			"meta": "o0mAxG_meta",
			"close": "o0mAxG_close",
			"cardTitle": "o0mAxG_cardTitle",
			"notice": "o0mAxG_notice",
			"detailImage": "o0mAxG_detailImage",
			"title": "o0mAxG_title",
			"dsh-imagegen-templates-spin": "o0mAxG_dsh-imagegen-templates-spin",
			"detailMedia": "o0mAxG_detailMedia",
			"detail": "o0mAxG_detail",
			"detailMeta": "o0mAxG_detailMeta"
		};
		//#endregion
		//#region src/client/TemplateLibrary.tsx
		/**
		* Prompt-template library overlay: a searchable, category-filtered gallery of
		* the bundled awesome-gpt-image-2 cases. The case list is served by the host
		* (bundled snapshot, optionally refreshed online); reference images load
		* lazily through the host's caching proxy, so browsing progressively mirrors
		* the gallery onto the local disk. Picking a template hands its prompt back
		* to the studio form.
		*/
		/** Concurrent image downloads while caching the whole gallery offline. */
		const CACHE_ALL_CONCURRENCY = 4;
		/** Same-origin URL of one case's reference image (host caching proxy). */
		function imageUrlOf(item) {
			return `${TEMPLATES_API.image}/${encodeURIComponent(item.image)}`;
		}
		/** A card thumbnail that falls back to a placeholder when the proxy 404s. */
		function TemplateThumb(props) {
			const [failed, setFailed] = (0, react.useState)(false);
			if (props.item.image === "" || failed) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: templates_module_css_default.thumbPlaceholder,
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 24 24",
					width: "26",
					height: "26",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.2",
					strokeLinecap: "round",
					strokeLinejoin: "round",
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
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				className: templates_module_css_default.thumb,
				src: imageUrlOf(props.item),
				alt: props.item.title,
				loading: "lazy",
				onError: () => {
					setFailed(true);
				}
			});
		}
		/** The template-library modal. Rendered through a portal above the studio. */
		function TemplateLibrary(props) {
			const { api, onUse, onClose } = props;
			const [list, setList] = (0, react.useState)(null);
			const [loadError, setLoadError] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const [category, setCategory] = (0, react.useState)("");
			const [selected, setSelected] = (0, react.useState)(null);
			const [copied, setCopied] = (0, react.useState)(false);
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			const [cacheAll, setCacheAll] = (0, react.useState)({
				running: false,
				done: 0,
				total: 0
			});
			const searchRef = (0, react.useRef)(null);
			const load = () => {
				api.templatesList().then((result) => {
					setList(result);
					setLoadError(null);
				}).catch((caught) => {
					setLoadError(errorMessage(caught));
				});
			};
			(0, react.useEffect)(() => {
				load();
				searchRef.current?.focus();
			}, []);
			const categories = (0, react.useMemo)(() => {
				if (list === null) return [];
				const counts = /* @__PURE__ */ new Map();
				for (const item of list.cases) {
					const entry = counts.get(item.category) ?? {
						label: item.categoryZh || item.category,
						count: 0
					};
					entry.count += 1;
					counts.set(item.category, entry);
				}
				return [...counts.entries()].map(([key, value]) => ({
					key,
					label: value.label,
					count: value.count
				}));
			}, [list]);
			const filtered = (0, react.useMemo)(() => {
				if (list === null) return [];
				const needle = query.trim().toLowerCase();
				return list.cases.filter((item) => {
					if (category !== "" && item.category !== category) return false;
					if (needle === "") return true;
					return item.title.toLowerCase().includes(needle) || item.prompt.toLowerCase().includes(needle) || item.sourceLabel.toLowerCase().includes(needle);
				});
			}, [
				list,
				query,
				category
			]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key !== "Escape") return;
					event.stopPropagation();
					if (selected !== null) setSelected(null);
					else onClose();
				};
				window.addEventListener("keydown", onKey, true);
				return () => window.removeEventListener("keydown", onKey, true);
			}, [selected, onClose]);
			const refresh = async () => {
				if (refreshing) return;
				setRefreshing(true);
				setNotice(null);
				try {
					const result = await api.templatesRefresh();
					const reloaded = await api.templatesList();
					setList(reloaded);
					setLoadError(null);
					setNotice(tt("templates.refreshed", { count: result.total }));
				} catch (caught) {
					setNotice(tt("templates.refreshFailed", { error: errorMessage(caught) }));
				} finally {
					setRefreshing(false);
				}
			};
			/** Mirror every reference image through the host cache (offline browsing). */
			const cacheAllImages = async () => {
				if (cacheAll.running || list === null) return;
				const files = [...new Set(list.cases.map((item) => item.image).filter((name) => name !== ""))];
				setCacheAll({
					running: true,
					done: 0,
					total: files.length
				});
				let index = 0;
				const worker = async () => {
					while (index < files.length) {
						const file = files[index];
						index += 1;
						try {
							await fetch(`${TEMPLATES_API.image}/${encodeURIComponent(file)}`);
						} catch {}
						setCacheAll((current) => ({
							...current,
							done: current.done + 1
						}));
					}
				};
				await Promise.all(Array.from({ length: CACHE_ALL_CONCURRENCY }, () => worker()));
				setCacheAll({
					running: false,
					done: files.length,
					total: files.length
				});
			};
			const copyPrompt = async (text) => {
				try {
					if (navigator.clipboard?.writeText !== void 0) await navigator.clipboard.writeText(text);
					else {
						const textarea = document.createElement("textarea");
						textarea.value = text;
						textarea.style.position = "fixed";
						textarea.style.opacity = "0";
						document.body.appendChild(textarea);
						textarea.select();
						const copiedOk = document.execCommand("copy");
						textarea.remove();
						if (!copiedOk) throw new Error("copy failed");
					}
					setCopied(true);
					window.setTimeout(() => {
						setCopied(false);
					}, 1800);
				} catch {
					setCopied(false);
				}
			};
			const originLabel = list === null ? "" : tt(list.origin === "refreshed" ? "templates.origin.refreshed" : "templates.origin.bundled");
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: templates_module_css_default.overlay,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": tt("templates.title"),
				onClick: onClose,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: templates_module_css_default.shell,
					onClick: (event) => {
						event.stopPropagation();
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: templates_module_css_default.header,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: templates_module_css_default.heading,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: templates_module_css_default.title,
									children: tt("templates.title")
								}), list !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: templates_module_css_default.meta,
									children: tt("templates.meta", {
										count: list.total,
										origin: originLabel
									})
								}) : null]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: templates_module_css_default.headerActions,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										disabled: refreshing || cacheAll.running,
										onClick: () => {
											refresh();
										},
										children: refreshing ? tt("templates.refreshing") : tt("templates.refresh")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										disabled: list === null || cacheAll.running,
										title: tt("templates.cacheAllHint"),
										onClick: () => {
											cacheAllImages();
										},
										children: cacheAll.running ? tt("templates.caching", {
											done: cacheAll.done,
											total: cacheAll.total
										}) : cacheAll.total > 0 && cacheAll.done === cacheAll.total ? tt("templates.cached") : tt("templates.cacheAll")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: templates_module_css_default.close,
										"aria-label": tt("templates.close"),
										title: tt("templates.close"),
										onClick: onClose,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
											viewBox: "0 0 16 16",
											width: "16",
											height: "16",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "1.6",
											strokeLinecap: "round",
											"aria-hidden": "true",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 4l8 8M12 4l-8 8" })
										})
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: templates_module_css_default.toolbar,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: searchRef,
								type: "search",
								className: templates_module_css_default.search,
								placeholder: tt("templates.search"),
								value: query,
								onChange: (event) => {
									setQuery(event.target.value);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: templates_module_css_default.categoryRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: templates_module_css_default.categoryPill,
									"data-active": category === "" ? "" : void 0,
									onClick: () => {
										setCategory("");
									},
									children: [tt("templates.all"), list !== null ? ` ${list.total}` : ""]
								}), categories.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: templates_module_css_default.categoryPill,
									"data-active": category === entry.key ? "" : void 0,
									onClick: () => {
										setCategory(entry.key);
									},
									children: [
										entry.label,
										" ",
										entry.count
									]
								}, entry.key))]
							})]
						}),
						notice !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: templates_module_css_default.notice,
							role: "status",
							children: notice
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: templates_module_css_default.body,
							children: [
								list === null && loadError === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: templates_module_css_default.state,
									role: "status",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: templates_module_css_default.spinner }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("templates.loading") })]
								}) : null,
								loadError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: templates_module_css_default.state,
									role: "alert",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("templates.loadFailed", { error: loadError }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										onClick: () => {
											setLoadError(null);
											setList(null);
											load();
										},
										children: tt("templates.retry")
									})]
								}) : null,
								list !== null && filtered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: templates_module_css_default.state,
									children: tt("templates.empty")
								}) : null,
								list !== null && filtered.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: templates_module_css_default.grid,
									children: filtered.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: templates_module_css_default.card,
										onClick: () => {
											setSelected(item);
											setCopied(false);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: templates_module_css_default.thumbWrap,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TemplateThumb, { item }), item.featured ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: templates_module_css_default.featuredBadge,
												children: tt("templates.featured")
											}) : null]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: templates_module_css_default.cardBody,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: templates_module_css_default.cardTitle,
												children: item.title
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: templates_module_css_default.cardMeta,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: templates_module_css_default.cardCategory,
													children: item.categoryZh || item.category
												}), item.sourceLabel !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: templates_module_css_default.cardSource,
													children: item.sourceLabel
												}) : null]
											})]
										})]
									}, item.id))
								}) : null
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
							className: templates_module_css_default.footer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: templates_module_css_default.attribution,
								children: tt("templates.attribution")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								className: templates_module_css_default.sourceLink,
								href: "https://vibeui.top/",
								target: "_blank",
								rel: "noreferrer",
								children: tt("templates.source")
							})]
						})
					]
				}), selected !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: templates_module_css_default.detailOverlay,
					onClick: () => {
						setSelected(null);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: templates_module_css_default.detail,
						onClick: (event) => {
							event.stopPropagation();
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: templates_module_css_default.detailMedia,
							children: selected.image !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								className: templates_module_css_default.detailImage,
								src: imageUrlOf(selected),
								alt: selected.title
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: templates_module_css_default.thumbPlaceholder,
								"aria-hidden": "true"
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: templates_module_css_default.detailInfo,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
									className: templates_module_css_default.detailTitle,
									children: selected.title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: templates_module_css_default.detailMeta,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: templates_module_css_default.cardCategory,
											children: selected.categoryZh || selected.category
										}),
										selected.sourceUrl !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											className: templates_module_css_default.detailLink,
											href: selected.sourceUrl,
											target: "_blank",
											rel: "noreferrer",
											children: selected.sourceLabel || selected.sourceUrl
										}) : null,
										selected.githubUrl !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											className: templates_module_css_default.detailLink,
											href: selected.githubUrl,
											target: "_blank",
											rel: "noreferrer",
											children: "GitHub"
										}) : null
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
									className: templates_module_css_default.detailPrompt,
									children: selected.prompt
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: templates_module_css_default.detailActions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											size: "md",
											onClick: () => {
												onUse(selected.prompt);
											},
											children: tt("templates.use")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "md",
											onClick: () => {
												copyPrompt(selected.prompt);
											},
											children: copied ? tt("templates.copied") : tt("templates.copy")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "md",
											onClick: () => {
												setSelected(null);
											},
											children: tt("templates.back")
										})
									]
								})
							]
						})]
					})
				}) : null]
			}), document.body);
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
			/** Individual secret presence bits, keyed by the settings field name. */
			secretSets;
			tail = Promise.resolve();
			disposed = false;
			constructor(api, spec) {
				this.api = api;
				this.spec = spec;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					status: "loading",
					value: void 0,
					base: void 0,
					user: void 0,
					revision: void 0,
					writable: false,
					mode: "host"
				});
				this.keySet = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(false);
				this.secretSets = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({});
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
			/** Whether a specific secret field currently has a stored value. */
			getSecretSetSnapshot(field) {
				return this.secretSets.getSnapshot()[field] === true;
			}
			/** Observe changes to individual secret-field presence bits. */
			subscribeSecretSets(listener) {
				return this.secretSets.subscribe(listener);
			}
			subscribe(listener) {
				return this.store.subscribe(listener);
			}
			/** Queue a bridge refresh. */
			load() {
				return this.enqueue(() => this.read());
			}
			set(field, value) {
				return this.enqueue(() => this.writeOps([{
					op: "set",
					path: [field],
					value
				}]));
			}
			unset(field) {
				return this.enqueue(() => this.writeOps([{
					op: "unset",
					path: [field]
				}]));
			}
			mutate(ops, expectedRevision) {
				return this.enqueue(() => this.writeOps([...ops], expectedRevision));
			}
			/** Apply several path ops in one revision-fenced mutate call (atomic save).
			*  Path ops may address plain-object fields (e.g. `channelSecrets.<id>`),
			*  but never navigate *inside* arrays — write array fields wholesale. */
			mutateOps(ops) {
				return this.enqueue(() => this.writeOps(ops));
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
					this.secretSets.set({});
					return;
				}
				this.accept(view, writable);
			}
			async writeOps(ops, expectedRevision) {
				const revision = expectedRevision ?? this.getSnapshot().revision;
				let response;
				try {
					response = await this.api.mutate({
						ns: this.spec.namespace,
						ops,
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
				const secretSets = Object.fromEntries((view.secrets ?? []).map((secret) => [secret.path.join("."), secret.set]));
				this.keySet.set(Object.values(secretSets).some(Boolean));
				this.secretSets.set(secretSets);
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
		/**
		* Flatten the configured channels into the model options the panel lists
		* (aliases; the default channel's models first) plus the default channel id.
		* Falls back to the legacy flat allow-list while no channels exist (upgrade
		* path). Pure projection — no host calls.
		*/
		function imageModelOptions(config) {
			const channels = config?.channels ?? [];
			if (channels.length === 0) return { models: Array.isArray(config?.imageModels) ? config.imageModels.filter((model) => typeof model === "string" && model.trim() !== "") : [] };
			const defaultId = config?.defaultChannelId !== void 0 && channels.some((channel) => channel.id === config.defaultChannelId) ? config.defaultChannelId : channels[0].id;
			const ordered = [defaultId, ...channels.filter((channel) => channel.id !== defaultId).map((channel) => channel.id)];
			const models = [];
			for (const id of ordered) {
				const channel = channels.find((candidate) => candidate.id === id);
				for (const model of channel.models) if (model.alias !== "" && !models.includes(model.alias)) models.push(model.alias);
			}
			return models.length > 0 ? {
				models,
				defaultChannelId: defaultId
			} : {
				models: [],
				defaultChannelId: defaultId
			};
		}
		//#endregion
		//#region src/image-models.ts
		/**
		* Image-model configuration shared by the host, panel, and Agent tools.
		* `/models` exposes candidates only: the configured list is the explicit
		* allow-list because OpenAI-compatible gateways rarely advertise modalities.
		*/
		const DEFAULT_IMAGE_MODELS = [
			"gpt-image-2",
			"grok-imagine-image",
			"nanobanana2",
			"nanobanana2-lite",
			"nanobanana-pro",
			"seedream-5.0-pro",
			"glm-image"
		];
		/** Normalize user-entered model identifiers and retain a usable legacy default. */
		function normalizeImageModels(value) {
			const candidates = Array.isArray(value) ? value : [];
			const unique = /* @__PURE__ */ new Set();
			for (const candidate of candidates) {
				if (typeof candidate !== "string") continue;
				const model = candidate.trim();
				if (model !== "") unique.add(model);
			}
			return unique.size > 0 ? [...unique] : [...DEFAULT_IMAGE_MODELS];
		}
		//#endregion
		//#region src/model-catalog.ts
		const ENTRIES = {
			"gpt-image": {
				label: "gpt-image",
				labelZh: "GPT 图像",
				known: true,
				supportsEdit: true,
				supportsAspectRatio: false,
				qualityTiers: [
					"1K",
					"2K",
					"4K"
				]
			},
			"dall-e": {
				label: "DALL·E",
				labelZh: "DALL·E",
				known: true,
				supportsEdit: true,
				supportsAspectRatio: false,
				qualityTiers: ["auto"]
			},
			grok: {
				label: "grok",
				labelZh: "Grok",
				known: true,
				supportsEdit: true,
				supportsAspectRatio: true,
				qualityTiers: ["1K", "2K"]
			},
			nanobanana: {
				label: "nanobanana",
				labelZh: "Nano Banana",
				known: true,
				supportsEdit: true,
				supportsAspectRatio: true,
				qualityTiers: [
					"1K",
					"2K",
					"4K"
				]
			},
			seedream: {
				label: "seedream",
				labelZh: "Seedream",
				known: true,
				supportsEdit: true,
				supportsAspectRatio: true,
				qualityTiers: ["1K", "2K"]
			},
			zhipu: {
				label: "GLM-Image",
				labelZh: "智谱图像",
				known: true,
				supportsEdit: false,
				supportsAspectRatio: false,
				qualityTiers: ["HD"]
			}
		};
		/** Official Gemini image ids served by Nano Banana gateways. */
		const NANOBANANA_GEMINI_IDS = /* @__PURE__ */ new Set([
			"gemini-3-pro-image",
			"gemini-3-pro-image-preview",
			"gemini-3.1-flash-image",
			"gemini-3.1-flash-image-preview",
			"gemini-3.1-flash-lite-image",
			"gemini-2.5-flash-image"
		]);
		/** Classify one upstream model id into its request-shaping family. */
		function describeModel(model) {
			const id = model.trim();
			if (/^gpt-image/i.test(id)) return {
				family: "gpt-image",
				...ENTRIES["gpt-image"]
			};
			if (/^dall-e/i.test(id)) return {
				family: "dall-e",
				...ENTRIES["dall-e"]
			};
			if (/^grok-imagine(?:-|$)/.test(id)) return {
				family: "grok",
				...ENTRIES.grok
			};
			if (/^nanobanana/i.test(id) || NANOBANANA_GEMINI_IDS.has(id)) return {
				family: "nanobanana",
				...ENTRIES.nanobanana
			};
			if (/^(?:doubao-)?seedream/i.test(id)) return {
				family: "seedream",
				...ENTRIES.seedream
			};
			if (/^(?:glm-image|cogview(?:-|$))/i.test(id)) return {
				family: "zhipu",
				...ENTRIES.zhipu
			};
			return {
				family: "unknown",
				label: "unknown",
				labelZh: "未知协议",
				known: false,
				supportsEdit: true,
				supportsAspectRatio: false,
				qualityTiers: []
			};
		}
		//#endregion
		//#region src/client/conversation-sync.ts
		/** Document event used to bridge chat tool results into the image workspace. */
		const CHAT_IMAGE_EVENT = "dsh-imagegen:chat-images";
		//#endregion
		//#region \0dsh-css:E:\dsh-plugin\src\client\panel.module.css.mjs
		const css$2 = "[data-pane=conversation],[class*=centerCol]{min-width:0;min-height:0;position:relative}[data-dsh-imagegen-view]{z-index:60;background:var(--dsw-alias-bg-base);grid-area:1/1;min-width:0;min-height:0;display:none;position:relative}html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane=conversation],html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*=centerCol]{grid-template-columns:minmax(0, 1fr) 8px minmax(320px, clamp(320px, var(--dsh-imagegen-chat-width,36%), 70%));background:var(--dsw-alias-border-l1);grid-template-rows:minmax(0,1fr);gap:1px;overflow:hidden;display:grid!important}html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-dsh-imagegen-view]{display:block}html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-slot=conversation]{background:var(--dsw-alias-bg-base);grid-area:1/3;align-items:stretch;width:auto;min-width:0;min-height:0;overflow:hidden;display:flex!important}html[data-dsh-imagegen-active] [data-slot=conversation]>[data-phase]{flex:auto;align-self:stretch;width:100%;min-width:0;max-width:none}html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-dsh-imagegen-chat-resizer]{grid-area:1/2}.Yvqh9W_chatResizer{z-index:70;width:8px;min-width:8px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-border-l1);cursor:col-resize;touch-action:none;justify-content:center;align-items:center;display:none;position:relative}.Yvqh9W_chatResizer:before{content:\"\";opacity:.55;background:currentColor;border-radius:3px;width:3px;height:36px}.Yvqh9W_chatResizer:hover,.Yvqh9W_chatResizer:focus-visible{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);outline:none}html[data-dsh-imagegen-active] [data-dsh-imagegen-chat-resizer]{display:flex!important}html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane=conversation]>:not([data-dsh-imagegen-view]):not([data-slot=conversation]):not([data-dsh-imagegen-chat-resizer]),html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*=centerCol]>:not([data-dsh-imagegen-view]):not([data-slot=conversation]):not([data-dsh-imagegen-chat-resizer]),html[data-dsh-imagegen-active] [data-dsh-imagegen-sidebar-root]>:not([data-dsh-imagegen-session-tabs]):not([class*=logoRow]):not([class*=regionArea]):not([class*=footArea]){display:none!important}@media (width<=760px){html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane=conversation],html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*=centerCol]{grid-template-rows:minmax(0,1fr) minmax(340px,.9fr);grid-template-columns:minmax(0,1fr);overflow-y:auto}html[data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-slot=conversation]{grid-area:2/1}html[data-dsh-imagegen-active] [data-dsh-imagegen-chat-resizer]{display:none!important}}.Yvqh9W_entry{width:100%;height:32px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 12px;font-size:13px;display:flex}.Yvqh9W_entry:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary)}.Yvqh9W_entry[data-active]{background:var(--dsw-specific-sidebar-nav-item-active);color:var(--dsw-alias-label-primary);font-weight:600}.Yvqh9W_entryIcon{flex:none;justify-content:center;align-items:center;display:inline-flex}.Yvqh9W_entryLabel{text-overflow:ellipsis;overflow:hidden}.Yvqh9W_sessionTabs{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:9px;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2px;width:100%;min-width:0;padding:3px;display:grid}.Yvqh9W_sessionTab{min-width:0;height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;white-space:nowrap;background:0 0;border:0;border-radius:7px;justify-content:center;align-items:center;gap:6px;padding:0 8px;font-size:12px;display:inline-flex}[data-sidebar-collapsed] .Yvqh9W_sessionTabs{background:0 0;border:none;border-radius:0;flex-direction:column;gap:6px;width:auto;padding:0;display:flex}[data-sidebar-collapsed] .Yvqh9W_sessionTab{border-radius:9px;width:34px;height:34px;padding:0;font-size:0}[data-sidebar-collapsed] .Yvqh9W_sessionTabLabel{display:none}.Yvqh9W_sessionTab:hover,.Yvqh9W_sessionTab[data-active]{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-sidebar-nav-item-active)}.Yvqh9W_sessionTabIcon{flex:none;justify-content:center;align-items:center;display:inline-flex}.Yvqh9W_sessionTabLabel{text-overflow:ellipsis;min-width:0;overflow:hidden}[class*=regionArea]{min-height:0;position:relative}.Yvqh9W_sidebarHistoryHost{z-index:30;background:var(--dsw-alias-bg-base);min-width:0;min-height:0;padding:6px 4px;display:none;position:absolute;inset:0;overflow:hidden}html[data-dsh-imagegen-active] .Yvqh9W_sidebarHistoryHost{display:flex}.Yvqh9W_sidebarHistoryHost .Yvqh9W_history{background:0 0;border:0;border-radius:8px;width:100%;height:100%}[data-dsh-frame][data-sidebar-collapsed] .Yvqh9W_sidebarHistoryHost{display:none}[data-dsh-frame][data-sidebar-collapsed] .Yvqh9W_entry{justify-content:center;width:100%;padding:0}[data-dsh-frame][data-sidebar-collapsed] .Yvqh9W_entryLabel{display:none}.Yvqh9W_view{width:100%;min-width:0;min-height:0;overflow:hidden}.Yvqh9W_panel,.Yvqh9W_panel *,.Yvqh9W_panel :before,.Yvqh9W_panel :after{box-sizing:border-box}.Yvqh9W_panel{background:var(--dsw-alias-bg-base);min-width:0;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);flex-direction:column;gap:10px;padding:14px 16px 16px;display:flex;position:relative;overflow:hidden}.Yvqh9W_panelHeader{flex:none;justify-content:space-between;align-items:center;gap:12px;display:flex;position:relative}.Yvqh9W_panelHeading{align-items:baseline;gap:10px;min-width:0;display:flex}.Yvqh9W_panelTitle{color:var(--dsw-alias-label-primary);white-space:nowrap;margin:0;font-size:16px;font-weight:700}.Yvqh9W_githubLink{width:22px;height:22px;color:var(--dsw-alias-label-secondary);border-radius:6px;flex:none;justify-content:center;align-items:center;text-decoration:none;transition:color .12s,background .12s;display:inline-flex}.Yvqh9W_githubLink:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}.Yvqh9W_connectionStatus{border:1px solid var(--dsw-alias-label-error);height:28px;color:var(--dsw-alias-label-error);font:inherit;white-space:nowrap;background:0 0;border-radius:8px;flex:none;align-items:center;gap:6px;padding:0 10px;font-size:12px;line-height:1;display:inline-flex}.Yvqh9W_connectionStatus[data-connected=true]{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}.Yvqh9W_connectionDot{background:currentColor;border-radius:50%;width:6px;height:6px}.Yvqh9W_updateBanner{border:1px solid var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);overflow-wrap:anywhere;border-radius:10px;flex:none;justify-content:space-between;align-items:center;gap:12px;padding:7px 10px 7px 12px;font-size:12px;line-height:1.5;display:flex}.Yvqh9W_updateBanner[data-kind=ok]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}.Yvqh9W_updateText{min-width:0}.Yvqh9W_updateActions{flex:none;align-items:center;gap:10px;display:inline-flex}.Yvqh9W_updateRelease{color:inherit;text-underline-offset:2px;white-space:nowrap;text-decoration:underline}@media (width<=700px){.Yvqh9W_panelHeader{align-items:flex-start}.Yvqh9W_panelHeading{flex-direction:column;align-items:flex-start;gap:2px}.Yvqh9W_updateBanner{flex-direction:column;align-items:flex-start}.Yvqh9W_updateActions{justify-content:space-between;width:100%}}.Yvqh9W_studio{flex:1;min-width:0;min-height:0;display:flex}.Yvqh9W_generation{gap:14px;width:100%;min-width:0;min-height:0;display:flex}.Yvqh9W_config{width:clamp(240px, var(--dsh-imagegen-config-width,300px), 480px);flex-direction:column;flex:none;gap:12px;min-width:240px;max-width:480px;height:100%;min-height:0;display:flex;position:relative;overflow:hidden}.Yvqh9W_configHeader{flex:none;justify-content:flex-end;min-height:28px;display:flex}.Yvqh9W_configToggle{border:1px solid var(--dsw-alias-border-l1);width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;border-radius:7px;justify-content:center;align-items:center;padding:0;display:inline-flex}.Yvqh9W_configToggle:hover,.Yvqh9W_configToggle:focus-visible{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);outline:none}.Yvqh9W_config[data-collapsed=true]{gap:0;width:38px;min-width:38px;max-width:38px}.Yvqh9W_config[data-collapsed=true] .Yvqh9W_configHeader{justify-content:center}.Yvqh9W_config[data-collapsed=true]>:not(.Yvqh9W_configHeader){display:none}.Yvqh9W_configScroll{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent;flex-direction:column;flex:1;gap:12px;min-height:0;padding-right:2px;display:flex;overflow-y:auto}.Yvqh9W_configScroll::-webkit-scrollbar{width:8px}.Yvqh9W_configScroll::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:999px}.Yvqh9W_canvas{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;position:relative;overflow:hidden}.Yvqh9W_taskTray{z-index:6;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, transparent);backdrop-filter:blur(10px);border-radius:9px;flex-direction:column;width:min(360px,100% - 24px);max-height:calc(100% - 24px);display:flex;position:absolute;top:12px;right:12px;overflow:hidden;box-shadow:0 8px 24px #0000001f}.Yvqh9W_taskTray[data-open=false]{width:auto;max-width:calc(100% - 24px)}.Yvqh9W_taskTrayHeader{min-height:34px;color:var(--dsw-alias-label-primary);border-bottom:1px solid var(--dsw-alias-border-l1);align-items:stretch;font-size:12px;font-weight:600;display:flex}.Yvqh9W_taskTray[data-open=false] .Yvqh9W_taskTrayHeader{border-bottom:0}.Yvqh9W_taskTrayToggle{min-width:0;color:inherit;cursor:pointer;font:inherit;font-size:inherit;font-weight:inherit;text-align:left;background:0 0;border:0;flex:1;align-items:center;gap:8px;padding:8px 10px;display:flex}.Yvqh9W_taskTrayToggle:hover{background:var(--dsw-alias-bg-layer-2)}.Yvqh9W_taskTrayCount{min-width:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);text-align:center;border-radius:999px;padding:1px 5px;font-size:11px;font-weight:500}.Yvqh9W_taskTrayChevron{color:var(--dsw-alias-label-tertiary);margin-left:auto;font-size:12px;font-weight:400}.Yvqh9W_taskTrayClose{border:0;border-left:1px solid var(--dsw-alias-border-l1);width:32px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;background:0 0;font-size:17px}.Yvqh9W_taskTrayClose:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}.Yvqh9W_taskTray[data-open=false] .Yvqh9W_taskTrayToggle{min-height:34px}.Yvqh9W_taskRows{min-height:0;overflow-y:auto}.Yvqh9W_taskTray[data-open=false] .Yvqh9W_taskRows{display:none}.Yvqh9W_taskRow{border-top:1px solid var(--dsw-alias-border-l1);grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px 10px;display:grid}.Yvqh9W_taskRow:first-of-type{border-top:0}.Yvqh9W_taskStatus{color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-size:11px}.Yvqh9W_taskRow[data-status=running] .Yvqh9W_taskStatus{color:var(--dsw-alias-brand-primary)}.Yvqh9W_taskRow[data-status=failed] .Yvqh9W_taskStatus{color:var(--dsw-alias-label-error)}.Yvqh9W_taskPrompt{color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;font-size:11px;overflow:hidden}.Yvqh9W_taskRow button{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);cursor:pointer;font:inherit;border:0;border-radius:5px;padding:2px 7px;font-size:11px}.Yvqh9W_taskRow button:hover{color:var(--dsw-alias-brand-primary)}.Yvqh9W_configGuide{z-index:1100;background:#00000059;place-items:center;padding:20px;display:grid;position:fixed;inset:0}.Yvqh9W_configGuideBody{border:1px solid var(--dsw-alias-border-l2);width:min(360px,100%);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-direction:column;gap:12px;padding:18px;display:flex;box-shadow:0 14px 40px #0003}.Yvqh9W_configGuideBody span{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.55}.Yvqh9W_configGuideBody button{min-height:30px;color:var(--dsw-alias-bg-layer-1);background:var(--dsw-alias-brand-primary);cursor:pointer;font:inherit;border:0;border-radius:7px;align-self:flex-end;padding:0 12px;font-size:12px}.Yvqh9W_history{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;width:auto;min-width:0;max-width:none;min-height:0;display:flex;overflow:hidden}.Yvqh9W_historyHeader{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;display:flex}.Yvqh9W_historyHeaderActions{flex:none;align-items:center;gap:6px;display:flex}.Yvqh9W_historyFilters{border-bottom:1px solid var(--dsw-alias-border-l1);grid-template-columns:1fr 1fr;gap:6px;padding:8px 10px;display:grid}.Yvqh9W_historySearch,.Yvqh9W_historyFilters select,.Yvqh9W_gallerySearch{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);min-width:0;min-height:29px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font:inherit;border-radius:7px;padding:0 8px;font-size:11px}.Yvqh9W_historySearch{grid-column:1/-1}.Yvqh9W_gallerySearch{width:156px}.Yvqh9W_galleryTagInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:130px;min-height:29px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font:inherit;border-radius:7px;padding:0 8px;font-size:11px}.Yvqh9W_galleryBulkButton{border:1px solid var(--dsw-alias-border-l2);min-height:29px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;font:inherit;border-radius:7px;padding:0 8px;font-size:11px}.Yvqh9W_galleryBulkButton:hover:not(:disabled){color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.Yvqh9W_galleryBulkButton:disabled{opacity:.45;cursor:default}.Yvqh9W_historyTitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}.Yvqh9W_historyNew{width:26px;height:26px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);cursor:pointer;background:0 0;border-radius:7px;justify-content:center;align-items:center;padding:0;display:inline-flex}.Yvqh9W_historyNew:hover{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.Yvqh9W_historyClear{font:inherit;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);cursor:pointer;background:0 0;border-radius:999px;padding:2px 8px;font-size:11.5px}.Yvqh9W_historyClear:hover{color:var(--dsw-alias-label-error);border-color:var(--dsw-alias-label-error)}.Yvqh9W_historyList{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent;flex-direction:column;flex:1;gap:8px;min-height:0;padding:10px;display:flex;overflow-y:auto}.Yvqh9W_historyList::-webkit-scrollbar{width:8px}.Yvqh9W_historyList::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:999px}.Yvqh9W_historyEmpty{text-align:center;color:var(--dsw-alias-label-tertiary);flex:1;justify-content:center;align-items:center;padding:20px;font-size:12px;line-height:1.6;display:flex}.Yvqh9W_historyItem{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;flex:none;gap:6px;padding:8px;display:flex}.Yvqh9W_historyItem:hover{border-color:var(--dsw-alias-border-l2)}.Yvqh9W_historyItem[data-active]{border-color:var(--dsw-alias-brand-primary)}.Yvqh9W_historyMain{font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;align-items:flex-start;gap:8px;min-width:0;padding:0;display:flex}.Yvqh9W_historyThumb{object-fit:cover;background:var(--dsw-alias-bg-base);border-radius:8px;flex:none;width:52px;height:52px}.Yvqh9W_historyThumbPlaceholder{background:var(--dsw-alias-bg-layer-3);border-radius:8px;flex:none;width:52px;height:52px}.Yvqh9W_historyInfo{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.Yvqh9W_historyPrompt{color:var(--dsw-alias-label-primary);-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:1.4;display:-webkit-box;overflow:hidden}.Yvqh9W_historyMeta{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;font-size:11px;overflow:hidden}.Yvqh9W_historyActions{justify-content:flex-end;gap:6px;display:flex}.Yvqh9W_historyAction{font:inherit;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);cursor:pointer;background:0 0;border-radius:999px;padding:2px 8px;font-size:11.5px}.Yvqh9W_historyAction:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.Yvqh9W_historyAction[data-danger]:hover{color:var(--dsw-alias-label-error);border-color:var(--dsw-alias-label-error)}.Yvqh9W_card{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;flex-direction:column;flex:none;gap:10px;padding:12px;display:flex}.Yvqh9W_ecommerceWorkspace{flex-direction:column;gap:16px;max-width:720px;margin:0 auto;padding:6px 2px 12px;display:flex}.Yvqh9W_ecommerceSection{background:0 0;border:none;border-radius:0;flex-direction:column;gap:8px;padding:0;display:flex}.Yvqh9W_ecommerceSection h3{align-items:baseline;gap:6px;margin:0;font-size:13.5px;font-weight:600;display:flex}.Yvqh9W_ecommerceSectionHint{color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:400}.Yvqh9W_ecommerceSection input:not([type=checkbox]),.Yvqh9W_ecommerceSection select,.Yvqh9W_ecommerceSection textarea{box-sizing:border-box;width:100%;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);font:inherit;border-radius:8px;padding:8px 10px}.Yvqh9W_ecommerceSection textarea{resize:vertical;min-height:60px}.Yvqh9W_ecommerceField{flex-direction:column;gap:4px;min-width:0;display:flex}.Yvqh9W_ecommerceFieldLabel{color:var(--dsw-alias-label-secondary);font-size:11.5px}.Yvqh9W_ecommerceParamGrid{grid-template-columns:1fr 1fr;gap:10px 8px;display:grid}.Yvqh9W_ecommerceUploadHero{border:1.5px dashed var(--dsw-alias-border-l2);min-height:78px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;text-align:center;background:0 0;border-radius:10px;flex-direction:column;justify-content:center;align-items:center;gap:4px;padding:12px;display:flex}.Yvqh9W_ecommerceUploadHero:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:var(--dsw-alias-interactive-bg-hover)}.Yvqh9W_ecommerceUploadHero span{font-size:12px}.Yvqh9W_ecommerceUploadHero small{color:var(--dsw-alias-label-tertiary);font-size:10.5px}.Yvqh9W_ecommerceStructureGrid{grid-template-columns:repeat(3,1fr);gap:6px;display:grid}.Yvqh9W_ecommerceSlotCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;white-space:nowrap;border-radius:8px;justify-content:center;align-items:center;font-size:12px;display:flex;position:relative}.Yvqh9W_ecommerceSlotCard:hover{border-color:var(--dsw-alias-label-dimmed)}.Yvqh9W_ecommerceSlotCard[data-active]{background:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);font-weight:600}.Yvqh9W_ecommerceSlotCount{background:var(--dsw-alias-brand-primary);color:#fff;text-align:center;border-radius:8px;min-width:16px;height:16px;padding:0 4px;font-size:10px;font-weight:600;line-height:16px;position:absolute;top:-6px;right:-6px}.Yvqh9W_ecommerceRefRow{grid-template-columns:64px 1fr;align-items:center;gap:8px;display:grid}.Yvqh9W_ecommerceRefRow>span{color:var(--dsw-alias-label-secondary);font-size:12px}.Yvqh9W_ecommercePrimaryAction{border-radius:999px;width:100%;height:38px;font-size:13.5px}.Yvqh9W_previewBadge{background:var(--dsw-alias-brand-primary);color:#fff;letter-spacing:.02em;border-radius:4px;margin-left:5px;padding:0 4px;font-size:9px;font-weight:700;line-height:13px}.Yvqh9W_ecommercePlanNote{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5}.Yvqh9W_ecommercePlanWarn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:6px;padding:6px 8px;font-size:11.5px;line-height:1.5}.Yvqh9W_ecommerceAssets{grid-template-columns:repeat(3,1fr);gap:6px;display:grid}.Yvqh9W_ecommerceAsset{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:8px;flex-direction:column;gap:3px;padding:4px;display:flex;position:relative}.Yvqh9W_ecommerceAsset img{object-fit:cover;border-radius:5px;width:100%;height:44px}.Yvqh9W_ecommerceAsset select{width:100%;min-width:0;padding:2px;font-size:10px}.Yvqh9W_ecommerceAsset button{color:#fff;cursor:pointer;text-align:center;background:#0000008c;border:none;border-radius:50%;width:16px;height:16px;padding:0;font-size:11px;line-height:15px;position:absolute;top:7px;right:7px}.Yvqh9W_ecommerceAsset button:hover{background:#000c}.Yvqh9W_ecommerceAssetAdd{border:1.5px dashed var(--dsw-alias-border-l2);min-height:78px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;background:0 0;border-radius:8px;flex-direction:column;justify-content:center;align-items:center;gap:2px;display:flex}.Yvqh9W_ecommerceAssetAdd:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.Yvqh9W_ecommerceAssetAdd span{font-size:16px;line-height:1}.Yvqh9W_ecommerceAssetAdd small{font-size:10px}.Yvqh9W_ecommerceAdvancedToggle{width:100%;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;background:0 0;border:none;justify-content:space-between;align-items:center;padding:0;font-size:12.5px;display:flex}.Yvqh9W_ecommerceAdvancedToggle:hover{color:var(--dsw-alias-label-primary)}.Yvqh9W_ecommerceAdvancedChevron{font-size:11px}.Yvqh9W_ecommerceAdvancedBody{flex-direction:column;gap:8px;margin-top:8px;display:flex}.Yvqh9W_ecommerceFooterBody{flex-direction:column;gap:8px;display:flex}.Yvqh9W_ecommercePlanMini{border:1px solid var(--dsw-alias-brand-primary);border-radius:10px;flex-direction:column;gap:6px;padding:10px;display:flex}.Yvqh9W_ecommercePlanMini>strong{font-size:12.5px}.Yvqh9W_ecommercePlanList{flex-direction:column;gap:3px;max-height:116px;display:flex;overflow-y:auto}.Yvqh9W_ecommercePlanList>div{color:var(--dsw-alias-label-secondary);justify-content:space-between;gap:12px;font-size:11.5px;display:flex}.Yvqh9W_ecommercePlanBack{color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;background:0 0;border:none;padding:0;font-size:12px}.Yvqh9W_ecommercePlanBack:hover{color:var(--dsw-alias-label-primary)}.Yvqh9W_ecommerceFooterHint{color:var(--dsw-alias-label-secondary);font-size:12px}.Yvqh9W_ecommerceResults{flex-direction:column;gap:14px;width:100%;margin:0 auto;padding:16px 18px;display:flex;overflow-y:auto}.Yvqh9W_ecommerceResultsHeader{justify-content:space-between;align-items:center;gap:12px;display:flex}.Yvqh9W_ecommerceResultsHeader h3{margin:0;font-size:15px}.Yvqh9W_ecommerceResultsHeader>div:first-child{align-items:baseline;gap:10px;display:flex}.Yvqh9W_ecommerceResultsHeader span{color:var(--dsw-alias-label-secondary);font-size:12px}.Yvqh9W_ecommerceResultsActions{gap:8px;display:flex}.Yvqh9W_ecommerceResultsEmpty{color:var(--dsw-alias-label-tertiary);text-align:center;border:1.5px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:32px 16px;font-size:13px}.Yvqh9W_ecommerceGroups{flex-direction:column;gap:16px;display:flex}.Yvqh9W_ecommerceGroup{background:0 0;border:none;border-radius:0;flex-direction:column;gap:8px;padding:0;display:flex}.Yvqh9W_ecommerceGroup>header{align-items:center;gap:10px;font-size:13px;display:flex}.Yvqh9W_ecommerceGroup>header strong{font-size:13px}.Yvqh9W_ecommerceGroup>header span{color:var(--dsw-alias-label-secondary);font-size:12px}.Yvqh9W_ecommerceGroup>header button{margin-left:auto}.Yvqh9W_ecommerceGroupGrid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;display:grid}.Yvqh9W_ecommerceTaskCard{aspect-ratio:1;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:10px;justify-content:center;align-items:center;width:100%;min-height:0;padding:0;display:flex;position:relative;overflow:hidden}.Yvqh9W_ecommerceTaskCard[data-status=failed],.Yvqh9W_ecommerceTaskCard[data-status=cancelled]{color:var(--dsw-alias-label-tertiary);font-size:12px}.Yvqh9W_ecommerceTaskCard .Yvqh9W_imageCard{border:none;border-radius:0;width:100%;height:100%;margin:0}.Yvqh9W_ecommerceTaskCard .Yvqh9W_image{object-fit:cover;width:100%;height:100%}.Yvqh9W_ecommerceResultBadge{color:#fff;pointer-events:none;background:#0000008c;border-radius:999px;padding:0 7px;font-size:10px;line-height:16px;position:absolute;top:6px;left:6px}.Yvqh9W_ecommerceTaskActions{opacity:0;background:linear-gradient(#0000,#0000008c);justify-content:center;gap:4px;padding:10px 4px 5px;transition:opacity .12s;display:flex;position:absolute;bottom:0;left:0;right:0}.Yvqh9W_ecommerceTaskCard:hover .Yvqh9W_ecommerceTaskActions{opacity:1}.Yvqh9W_ecommerceActionChip{color:#111;cursor:pointer;white-space:nowrap;background:#ffffffeb;border:none;border-radius:6px;padding:0 6px;font-size:10px;font-weight:500;line-height:18px;text-decoration:none}.Yvqh9W_ecommerceActionChip:hover{background:#fff}.Yvqh9W_ecommerceActionChip:disabled{opacity:.5;cursor:default}.Yvqh9W_ecommerceTaskState{color:var(--dsw-alias-label-secondary);text-align:center;word-break:break-all;flex-direction:column;gap:3px;padding:10px 8px;font-size:11px;display:flex}.Yvqh9W_ecommerceTaskState b{color:var(--dsw-alias-label-primary);font-size:12px}.Yvqh9W_topNav{flex:none;justify-content:center;align-items:center;gap:2px;display:flex;position:absolute;left:50%;transform:translate(-50%)}.Yvqh9W_topNavItem{height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;background:0 0;border:none;border-radius:999px;align-items:center;gap:4px;padding:0 14px;font-size:13px;display:inline-flex}.Yvqh9W_topNavItem,.Yvqh9W_topNavItem span{white-space:nowrap}.Yvqh9W_topNavItem:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.Yvqh9W_topNavItem[data-active]{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);font-weight:600}.Yvqh9W_topNavDivider{background:var(--dsw-alias-border-l2);width:1px;height:16px;margin:0 8px}.Yvqh9W_panelHeaderActions{align-items:center;gap:10px;display:inline-flex}.Yvqh9W_chatToggle{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:26px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;border-radius:999px;align-items:center;gap:5px;padding:0 10px;font-size:12px;display:inline-flex}.Yvqh9W_chatToggle:hover{color:var(--dsw-alias-label-primary)}.Yvqh9W_chatToggle[data-open=true]{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}html[data-dsh-imagegen-chat-collapsed][data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane=conversation],html[data-dsh-imagegen-chat-collapsed][data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*=centerCol]{grid-template-columns:minmax(0,1fr)}html[data-dsh-imagegen-chat-collapsed][data-dsh-imagegen-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-slot=conversation],html[data-dsh-imagegen-chat-collapsed] [data-dsh-imagegen-chat-resizer]{display:none!important}.Yvqh9W_configResizer{cursor:col-resize;z-index:6;width:6px;height:100%;position:absolute;top:0;right:0}.Yvqh9W_configResizer:hover{background:linear-gradient(90deg, transparent, var(--dsw-alias-border-l2))}.Yvqh9W_config[data-collapsed=true] .Yvqh9W_configResizer{display:none}.Yvqh9W_modeRow{align-items:center;gap:8px;display:flex}.Yvqh9W_modePill{flex:1;justify-content:center;height:28px;font-size:12.5px}.Yvqh9W_modePill,.Yvqh9W_modePill span,.Yvqh9W_modePill div{white-space:nowrap;min-width:0}.Yvqh9W_uploadBox{min-height:128px;color:var(--dsw-alias-label-secondary);border:1.5px dashed var(--dsw-alias-border-l2);cursor:pointer;font:inherit;text-align:center;background:0 0;border-radius:12px;flex-direction:column;justify-content:center;align-items:center;gap:6px;padding:16px;font-size:12.5px;display:flex}.Yvqh9W_uploadBox:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:var(--dsw-alias-interactive-bg-hover)}.Yvqh9W_uploadBox:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.Yvqh9W_uploadIcon{color:var(--dsw-alias-label-tertiary);display:inline-flex}.Yvqh9W_uploadHint{color:var(--dsw-alias-label-tertiary);font-size:11px}.Yvqh9W_reference{flex-direction:column;gap:8px;display:flex}.Yvqh9W_referenceImage{object-fit:contain;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;width:100%;max-height:176px}.Yvqh9W_referenceActions{gap:8px;display:flex}.Yvqh9W_hiddenFile{display:none}.Yvqh9W_prompt{width:100%;min-height:120px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);resize:vertical;box-sizing:border-box;border-radius:10px;outline:none;padding:10px 12px;font-family:inherit;font-size:13px;line-height:1.6}.Yvqh9W_prompt:focus-visible{border-color:var(--dsw-alias-brand-primary)}.Yvqh9W_prompt::placeholder{color:var(--dsw-alias-label-tertiary)}.Yvqh9W_promptFooter{justify-content:space-between;align-items:center;gap:8px;margin-top:-6px;display:flex}.Yvqh9W_templatesButton{border:1px solid var(--dsw-alias-brand-primary);background:linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent), color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent));height:26px;color:var(--dsw-alias-brand-primary);cursor:pointer;box-shadow:0 1px 0 color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);border-radius:999px;align-items:center;gap:6px;padding:0 12px;font-family:inherit;font-size:12px;font-weight:600;transition:transform .12s,box-shadow .12s,background .12s;display:inline-flex}.Yvqh9W_templatesButton svg{flex:none}.Yvqh9W_templatesButton:hover{background:linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent), color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent));color:var(--dsw-alias-brand-primary);box-shadow:0 2px 6px color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);transform:translateY(-1px)}.Yvqh9W_templatesButton:active{transform:translateY(0)}.Yvqh9W_enhanceButton{border:1px solid var(--dsw-alias-border-l2);height:26px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);font:inherit;cursor:pointer;border-radius:999px;margin-left:auto;padding:0 11px;font-size:12px}.Yvqh9W_enhanceButton:hover:not(:disabled){color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.Yvqh9W_enhanceButton:disabled{opacity:.5;cursor:default}.Yvqh9W_promptCount{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:11px}.Yvqh9W_paramGroup{flex-direction:column;gap:8px;display:flex}.Yvqh9W_paramLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}.Yvqh9W_optionRow{flex-wrap:wrap;gap:6px;display:flex}.Yvqh9W_optionGrid{grid-template-columns:repeat(3,1fr);gap:6px;display:grid}.Yvqh9W_optionPill{justify-content:center}.Yvqh9W_paramHint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.45}.Yvqh9W_footer{border-top:1px solid var(--dsw-alias-border-l1);flex-direction:column;flex:none;align-items:stretch;gap:8px;padding:10px 2px 0 0;display:flex}.Yvqh9W_modelWrap{flex-direction:column;gap:5px;min-width:0;display:flex}.Yvqh9W_modelLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}.Yvqh9W_modelSelect{width:100%;height:36px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);cursor:pointer;text-align:left;border-radius:18px;outline:none;justify-content:space-between;align-items:center;gap:8px;padding:0 12px;font-family:inherit;font-size:13px;display:flex}.Yvqh9W_modelSelect:focus-visible{border-color:var(--dsw-alias-brand-primary)}.Yvqh9W_modelSelect:disabled{opacity:.55;cursor:default}.Yvqh9W_modelMenu{min-width:0;display:block;position:relative}.Yvqh9W_modelMenuList{z-index:40;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 6px);left:0;right:0;overflow:hidden;box-shadow:0 -8px 24px #0000002e}.Yvqh9W_modelMenuItem{width:100%;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;white-space:nowrap;text-overflow:ellipsis;background:0 0;border:none;border-radius:8px;padding:7px 10px;font-size:13px;display:block;overflow:hidden}.Yvqh9W_modelMenuItem:hover{background:var(--dsw-alias-bg-hover)}.Yvqh9W_modelMenuItem[data-selected]{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1);font-weight:600}.Yvqh9W_generateButton{width:100%}.Yvqh9W_generateInner{align-items:center;gap:7px;display:inline-flex}.Yvqh9W_canvasState{text-align:center;color:var(--dsw-alias-label-tertiary);flex-direction:column;flex:1;justify-content:center;align-items:center;gap:8px;padding:24px;display:flex}.Yvqh9W_canvasStateTitle{color:var(--dsw-alias-label-secondary);font-size:14px;font-weight:600}.Yvqh9W_canvasStateHint{max-width:380px;font-size:12px;line-height:1.6}.Yvqh9W_canvasEmptyIcon{color:var(--dsw-alias-label-tertiary);margin-bottom:4px;display:inline-flex}.Yvqh9W_canvasError{color:var(--dsw-alias-label-error);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-label-error);overflow-wrap:anywhere;border-radius:10px;flex:none;margin:14px;padding:10px 14px;font-size:12.5px;line-height:1.6}.Yvqh9W_canvasBody{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent;flex-direction:column;flex:1;gap:10px;min-height:0;padding:14px;display:flex;overflow-y:auto}.Yvqh9W_canvasBody::-webkit-scrollbar{width:8px}.Yvqh9W_canvasBody::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:999px}.Yvqh9W_canvasMeta{color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:8px;font-size:12px;display:flex}.Yvqh9W_canvasHistoryTag{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px}.Yvqh9W_grid{flex:1;grid-template-rows:repeat(2,minmax(0,1fr));grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;min-height:0;display:grid}.Yvqh9W_grid[data-count=\"1\"] .Yvqh9W_imageCard{grid-area:1/1/3/3}.Yvqh9W_imageCard{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);cursor:zoom-in;border-radius:12px;flex-direction:column;min-height:0;margin:0;display:flex;position:relative;overflow:hidden}.Yvqh9W_imageCard:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.Yvqh9W_image{object-fit:cover;background:var(--dsw-alias-bg-base);flex:1;width:100%;min-height:0;display:block}.Yvqh9W_imageCaption{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;border-top:1px solid var(--dsw-alias-border-l1);padding:7px 10px;font-size:11px;line-height:1.5;overflow:hidden}.Yvqh9W_download{color:#fff;opacity:0;backdrop-filter:blur(4px);background:#0f1218d1;border:1px solid #ffffff9e;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:500;line-height:20px;text-decoration:none;transition:opacity .12s;position:absolute;top:8px;right:8px;box-shadow:0 2px 8px #00000047}.Yvqh9W_imageCard:hover .Yvqh9W_download{opacity:1}.Yvqh9W_download:hover{background:#0f1218f0}.Yvqh9W_download:focus-visible{opacity:1;outline-offset:2px;outline:2px solid #fff}.Yvqh9W_galleryAdd{font:inherit;color:#fff;cursor:pointer;opacity:0;backdrop-filter:blur(4px);background:#0f1218d1;border:1px solid #ffffff9e;border-radius:999px;align-items:center;gap:5px;padding:2px 10px;font-size:12px;font-weight:500;line-height:20px;transition:opacity .12s;display:inline-flex;position:absolute;top:8px;left:8px;box-shadow:0 2px 8px #00000047}.Yvqh9W_imageCard:hover .Yvqh9W_galleryAdd{opacity:1}.Yvqh9W_galleryAdd:hover{background:#0f1218f0}.Yvqh9W_galleryAdd:focus-visible{opacity:1;outline-offset:2px;outline:2px solid #fff}.Yvqh9W_galleryAdd:disabled{opacity:.4;cursor:default}.Yvqh9W_conversationAdd{color:#fff;cursor:pointer;font:inherit;opacity:0;backdrop-filter:blur(4px);background:#0f1218d1;border:1px solid #ffffff9e;border-radius:999px;align-items:center;gap:5px;padding:2px 10px;font-size:12px;font-weight:500;line-height:20px;transition:opacity .12s;display:inline-flex;position:absolute;top:38px;left:8px;box-shadow:0 2px 8px #00000047}.Yvqh9W_imageCard:hover .Yvqh9W_conversationAdd,.Yvqh9W_conversationAdd:focus-visible{opacity:1}.Yvqh9W_conversationAdd:hover{background:#0f1218f0}.Yvqh9W_conversationAdd:focus-visible{opacity:1;outline-offset:2px;outline:2px solid #fff}.Yvqh9W_conversationAdd:disabled{opacity:.4;cursor:default}.Yvqh9W_zoomHint{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-mask-1);border:1px solid var(--dsw-alias-border-l2);opacity:0;backdrop-filter:blur(4px);pointer-events:none;border-radius:999px;align-items:center;gap:5px;padding:2px 10px;font-size:12px;font-weight:500;line-height:20px;transition:opacity .12s;display:inline-flex;position:absolute;bottom:8px;left:8px}.Yvqh9W_imageCard:hover .Yvqh9W_zoomHint{opacity:1}.Yvqh9W_spinner,.Yvqh9W_bigSpinner{border:2px solid;border-top-color:#0000;border-radius:50%;flex:none;animation:.8s linear infinite Yvqh9W_dshImageGenSpin;display:inline-block}.Yvqh9W_spinner{width:11px;height:11px}.Yvqh9W_bigSpinner{width:30px;height:30px;color:var(--dsw-alias-state-business-primary);border-width:3px;margin-bottom:6px}.Yvqh9W_lightbox{z-index:1000;backdrop-filter:blur(6px);background:#000000b8;justify-content:center;align-items:center;padding:24px;display:flex;position:fixed;inset:0}.Yvqh9W_lightboxClose{color:#fff;cursor:pointer;background:#ffffff24;border:1px solid #ffffff47;border-radius:50%;justify-content:center;align-items:center;width:38px;height:38px;display:inline-flex;position:absolute;top:16px;right:16px}.Yvqh9W_lightboxClose:hover{background:#ffffff42}.Yvqh9W_lightboxNav{color:#fff;cursor:pointer;background:#ffffff24;border:1px solid #ffffff47;border-radius:50%;justify-content:center;align-items:center;width:42px;height:42px;display:inline-flex;position:absolute;top:50%;transform:translateY(-50%)}.Yvqh9W_lightboxNav:hover{background:#ffffff42}.Yvqh9W_lightboxNav[data-dir=prev]{left:max(20px,50% - 640px)}.Yvqh9W_lightboxNav[data-dir=next]{right:max(20px,50% - 640px)}.Yvqh9W_lightboxFigure{flex-direction:column;gap:10px;width:min(1100px,100vw - 160px);max-width:min(1100px,100vw - 160px);height:min(820px,100vh - 48px);min-height:0;margin:0;display:flex}.Yvqh9W_lightboxStage{background:#ffffff0a;border-radius:10px;flex:1;min-height:0;position:relative;overflow:auto}.Yvqh9W_lightboxScaleFrame{justify-content:center;align-items:center;min-width:100%;min-height:100%;display:flex}.Yvqh9W_lightboxImage{object-fit:contain;border-radius:10px;max-width:100%;max-height:100%;display:block;box-shadow:0 24px 80px #00000080}.Yvqh9W_lightboxTools{justify-content:center;align-items:center;gap:6px;display:flex}.Yvqh9W_lightboxTool,.Yvqh9W_lightboxZoomLevel,.Yvqh9W_lightboxCopy{color:#fff;cursor:pointer;background:#ffffff24;border:1px solid #ffffff47;justify-content:center;align-items:center;display:inline-flex}.Yvqh9W_lightboxTool,.Yvqh9W_lightboxZoomLevel{height:32px}.Yvqh9W_lightboxTool{border-radius:50%;width:32px}.Yvqh9W_lightboxZoomLevel{min-width:58px;font:inherit;font-variant-numeric:tabular-nums;border-radius:999px;padding:0 9px;font-size:12px}.Yvqh9W_lightboxTool:hover,.Yvqh9W_lightboxZoomLevel:hover,.Yvqh9W_lightboxCopy:hover{background:#ffffff42}.Yvqh9W_lightboxCaptionRow{align-items:flex-start;gap:8px;min-width:0;display:flex}.Yvqh9W_lightboxCaption{color:#ffffffe6;-webkit-line-clamp:3;-webkit-box-orient:vertical;flex:1;min-width:0;font-size:12px;line-height:1.6;display:-webkit-box;overflow:hidden}.Yvqh9W_lightboxCopy{min-height:28px;font:inherit;white-space:nowrap;border-radius:999px;flex:none;gap:5px;padding:4px 9px;font-size:12px}.Yvqh9W_lightboxMeta{justify-content:space-between;align-items:center;gap:12px;display:flex}.Yvqh9W_lightboxIndex{color:#fffc;font-variant-numeric:tabular-nums;font-size:12px}.Yvqh9W_lightboxActions{align-items:center;gap:8px;display:inline-flex}.Yvqh9W_lightboxDownload,.Yvqh9W_lightboxEdit{font:inherit;color:#fff;cursor:pointer;background:#ffffff24;border:1px solid #ffffff47;border-radius:999px;padding:4px 14px;font-size:12.5px;font-weight:500;text-decoration:none}.Yvqh9W_lightboxDownload:hover,.Yvqh9W_lightboxEdit:hover{background:#ffffff42}.Yvqh9W_lightboxEdit{color:#fff;background:#ffffff24;border:1px solid #ffffff47;border-radius:999px}@media (width<=720px){.Yvqh9W_lightbox{padding:16px}.Yvqh9W_lightboxFigure{width:calc(100vw - 32px);max-width:none}.Yvqh9W_lightboxNav[data-dir=prev]{left:20px}.Yvqh9W_lightboxNav[data-dir=next]{right:20px}.Yvqh9W_lightboxCaptionRow,.Yvqh9W_lightboxMeta{flex-direction:column;align-items:stretch}.Yvqh9W_lightboxCopy,.Yvqh9W_lightboxActions{align-self:flex-end}}@keyframes Yvqh9W_dshImageGenSpin{to{transform:rotate(360deg)}}.Yvqh9W_galleryToast{z-index:30;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-mask-1);border:1px solid var(--dsw-alias-border-l2);backdrop-filter:blur(6px);pointer-events:none;border-radius:999px;align-items:center;gap:7px;padding:6px 16px;font-size:13px;font-weight:500;animation:.16s ease-out Yvqh9W_dshImageGenToastIn;display:inline-flex;position:absolute;bottom:24px;left:50%;transform:translate(-50%);box-shadow:0 8px 24px #00000038}@keyframes Yvqh9W_dshImageGenToastIn{0%{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%)}}.Yvqh9W_conversationToast{z-index:30;border:1px solid var(--dsw-alias-border-l2);max-width:calc(100% - 32px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-mask-1);pointer-events:none;backdrop-filter:blur(6px);border-radius:999px;align-items:center;gap:7px;padding:6px 16px;font-size:13px;font-weight:500;animation:.16s ease-out Yvqh9W_dshImageGenToastIn;display:inline-flex;position:absolute;bottom:24px;left:50%;transform:translate(-50%);box-shadow:0 8px 24px #00000038}@media (prefers-reduced-motion:reduce){.Yvqh9W_download,.Yvqh9W_spinner,.Yvqh9W_bigSpinner{transition:none;animation-duration:1.5s}}.Yvqh9W_config[data-gallery=true] .Yvqh9W_configScroll>:not(:first-child),.Yvqh9W_config[data-gallery=true] .Yvqh9W_footer,.Yvqh9W_canvas[data-gallery=true]>.Yvqh9W_canvasState,.Yvqh9W_canvas[data-gallery=true]>.Yvqh9W_canvasError,.Yvqh9W_canvas[data-gallery=true]>.Yvqh9W_canvasBody,.Yvqh9W_studio:has(.Yvqh9W_config[data-gallery=true])>.Yvqh9W_history{display:none}.Yvqh9W_config[data-gallery=true] .Yvqh9W_configScroll{flex:none;order:1;display:flex;overflow:visible}.Yvqh9W_config[data-gallery=true] .Yvqh9W_galleryFilters{flex:1;order:2;min-height:0}.Yvqh9W_galleryFilters{padding:18px 14px;overflow:hidden auto}.Yvqh9W_galleryFilterHeading{color:var(--dsw-alias-label-tertiary);margin:0 4px 10px;font-size:12px;font-weight:600}.Yvqh9W_galleryFilter{width:100%;min-height:34px;color:var(--dsw-alias-label-secondary);cursor:pointer;text-align:left;background:0 0;border:0;border-radius:9px;justify-content:space-between;align-items:center;padding:0 10px;display:flex}.Yvqh9W_galleryFilter:hover,.Yvqh9W_galleryFilter[data-active]{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent)}.Yvqh9W_galleryFilterCount{min-width:20px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);text-align:center;border-radius:999px;padding:1px 6px;font-size:11px}.Yvqh9W_galleryFilterDivider{background:var(--dsw-alias-border-l1);height:1px;margin:18px 4px}.Yvqh9W_galleryRatioList{flex-wrap:wrap;gap:6px;display:flex}.Yvqh9W_galleryRatio{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);cursor:pointer;border:0;border-radius:999px;padding:6px 10px;font-size:12px}.Yvqh9W_galleryRatio[data-active]{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent)}.Yvqh9W_galleryTagFilterList{flex-wrap:wrap;gap:6px;display:flex}.Yvqh9W_galleryTagFilter{border:1px solid var(--dsw-alias-border-l1);min-width:0;max-width:100%;min-height:27px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);cursor:pointer;font:inherit;border-radius:6px;align-items:center;gap:5px;padding:0 8px;font-size:11px;display:inline-flex}.Yvqh9W_galleryTagFilter span:first-child{text-overflow:ellipsis;white-space:nowrap;max-width:112px;overflow:hidden}.Yvqh9W_galleryTagFilter span:last-child{color:var(--dsw-alias-label-tertiary);font-size:10px}.Yvqh9W_galleryTagFilter:hover,.Yvqh9W_galleryTagFilter[data-active]{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent)}.Yvqh9W_galleryFilterNote{color:var(--dsw-alias-label-quaternary);margin:20px 4px 0;font-size:11px;line-height:1.5}.Yvqh9W_galleryWorkspace{box-sizing:border-box;flex-direction:column;width:100%;min-width:0;height:100%;min-height:0;padding:22px 24px 26px;display:flex;position:absolute;inset:0;overflow:hidden}.Yvqh9W_galleryToolbar{flex:none;justify-content:space-between;align-items:center;gap:16px;min-width:0;margin-bottom:18px;display:flex}.Yvqh9W_galleryHeading{color:var(--dsw-alias-label-primary);margin:0;font-size:20px;font-weight:700;display:inline}.Yvqh9W_galleryCount{color:var(--dsw-alias-label-tertiary);margin-left:8px;font-size:13px}.Yvqh9W_galleryToolbarActions{flex-wrap:wrap;align-items:center;gap:10px;min-width:0;display:flex}.Yvqh9W_gallerySelectMode,.Yvqh9W_galleryBulkButton,.Yvqh9W_gallerySelectionClear{border:1px solid var(--dsw-alias-border-l1);min-height:30px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;font:inherit;border-radius:7px;padding:0 10px;font-size:12px}.Yvqh9W_gallerySelectMode:hover,.Yvqh9W_gallerySelectMode[data-active],.Yvqh9W_galleryBulkButton:hover:not(:disabled){color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 38%, var(--dsw-alias-border-l1));background:color-mix(in srgb, var(--dsw-alias-brand-primary) 11%, transparent)}.Yvqh9W_galleryBulkButton:disabled{cursor:not-allowed;opacity:.45}.Yvqh9W_gallerySelectionBar{border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l1));background:color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, var(--dsw-alias-bg-layer-1));border-radius:9px;flex:none;align-items:center;gap:10px;min-width:0;margin:-4px 0 16px;padding:10px 12px;display:flex}.Yvqh9W_gallerySelectionBar strong{color:var(--dsw-alias-brand-primary);flex:none;font-size:12px}.Yvqh9W_gallerySelectionClear{margin-left:auto}.Yvqh9W_gallerySelectionClear:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}.Yvqh9W_galleryTagInput,.Yvqh9W_gallerySearch{border:1px solid var(--dsw-alias-border-l1);min-width:0;height:30px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:inherit;border-radius:7px;outline:none;padding:0 10px;font-size:12px}.Yvqh9W_galleryTagInput{flex:190px}.Yvqh9W_galleryTagInput:focus,.Yvqh9W_gallerySearch:focus{border-color:var(--dsw-alias-brand-primary)}.Yvqh9W_galleryViewToggle{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:9px;padding:3px;display:flex}.Yvqh9W_galleryViewToggle button,.Yvqh9W_gallerySort,.Yvqh9W_galleryClear{min-height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;background:0 0;border:0;border-radius:7px;padding:0 10px;font-size:12px}.Yvqh9W_galleryViewToggle button[data-active],.Yvqh9W_galleryViewToggle button:hover,.Yvqh9W_gallerySort:hover,.Yvqh9W_galleryClear:hover{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 11%, transparent)}.Yvqh9W_gallerySort{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}.Yvqh9W_galleryClear{border:1px solid var(--dsw-alias-border-l1)}.Yvqh9W_compareControl{flex-direction:column;gap:6px;margin:0 0 10px;display:flex}.Yvqh9W_compareToggle,.Yvqh9W_compareModelChoices label{color:var(--dsw-alias-label-secondary);cursor:pointer;align-items:center;gap:6px;font-size:12px;display:flex}.Yvqh9W_compareToggle input,.Yvqh9W_compareModelChoices input{accent-color:var(--dsw-alias-brand-primary)}.Yvqh9W_compareModelChoices{flex-wrap:wrap;gap:6px;display:flex}.Yvqh9W_compareModelChoices label{border:1px solid var(--dsw-alias-border-l1);border-radius:5px;padding:4px 6px;font-size:10px}.Yvqh9W_comparisonBoard{z-index:4;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex-direction:column;display:flex;position:absolute;inset:14px;overflow:hidden;box-shadow:0 8px 24px #0000001f}.Yvqh9W_comparisonBoard>header{border-bottom:1px solid var(--dsw-alias-border-l1);justify-content:space-between;align-items:center;padding:10px 12px;display:flex}.Yvqh9W_comparisonBoard>header div{align-items:baseline;gap:7px;display:flex}.Yvqh9W_comparisonBoard>header strong{color:var(--dsw-alias-label-primary);font-size:13px}.Yvqh9W_comparisonBoard>header span{color:var(--dsw-alias-label-tertiary);font-size:11px}.Yvqh9W_comparisonBoard>header button{border:1px solid var(--dsw-alias-border-l1);min-height:28px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);cursor:pointer;font:inherit;border-radius:5px;padding:0 9px;font-size:11px}.Yvqh9W_comparisonGrid{flex:1;grid-template-rows:minmax(0,1fr);grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;min-height:0;padding:12px;display:grid;overflow:auto}.Yvqh9W_comparisonGrid article{flex-direction:column;gap:7px;min-width:0;height:100%;min-height:0;display:flex}.Yvqh9W_comparisonGrid article>strong{color:var(--dsw-alias-label-primary);font-size:12px}.Yvqh9W_comparisonImageButton{cursor:zoom-in;background:var(--dsw-alias-bg-base);border:0;flex:1;width:100%;min-height:0;padding:0;display:flex;overflow:hidden}.Yvqh9W_comparisonImageButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.Yvqh9W_comparisonGrid article>span{min-height:0;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);flex:1;place-items:center;font-size:12px;display:grid}.Yvqh9W_comparisonGrid img{object-fit:contain;background:var(--dsw-alias-bg-base);flex:1;width:100%;height:100%;min-height:0;max-height:none;display:block}.Yvqh9W_comparisonFullscreen{z-index:1200;background:#000000eb;padding:54px 24px 24px;position:fixed;inset:0;overflow:auto}.Yvqh9W_comparisonFullscreenGrid{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start;gap:18px;min-height:100%;display:grid}.Yvqh9W_comparisonFullscreen figure{min-width:0;margin:0}.Yvqh9W_comparisonFullscreen figcaption{color:#fff;margin-bottom:8px;font-size:13px;font-weight:600}.Yvqh9W_comparisonFullscreen img{background:#111;width:100%;margin-bottom:10px;display:block}.Yvqh9W_historyItem[data-comparison]{border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l1))}.Yvqh9W_galleryMasonry{box-sizing:border-box;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent;flex:auto;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:max-content;align-content:start;gap:16px;width:100%;min-width:0;max-width:100%;height:0;min-height:0;padding:2px 8px 16px 2px;display:grid;overflow:hidden scroll}.Yvqh9W_galleryMasonry::-webkit-scrollbar{width:8px}.Yvqh9W_galleryMasonry::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:999px}.Yvqh9W_galleryCard{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:14px;width:100%;margin:0;display:block;position:relative;overflow:hidden;box-shadow:0 5px 18px #18203612}.Yvqh9W_galleryCard[data-selected]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent), 0 5px 18px #18203612}.Yvqh9W_gallerySelect{z-index:2;cursor:pointer;background:#00000094;border:1px solid #ffffffbf;border-radius:7px;place-items:center;width:26px;height:26px;display:grid;position:absolute;top:9px;right:9px}.Yvqh9W_gallerySelect input{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;margin:0}.Yvqh9W_galleryImageButton{background:var(--dsw-alias-bg-base);cursor:zoom-in;border:0;width:100%;padding:0;display:block;position:relative}.Yvqh9W_galleryImageButton[data-selecting]{cursor:pointer}.Yvqh9W_galleryImage{aspect-ratio:4/3;object-fit:cover;width:100%;display:block}.Yvqh9W_galleryMasonry[data-view=masonry] .Yvqh9W_galleryCard:nth-child(3n+1) .Yvqh9W_galleryImage{aspect-ratio:4/5}.Yvqh9W_galleryMasonry[data-view=masonry] .Yvqh9W_galleryCard:nth-child(3n+2) .Yvqh9W_galleryImage{aspect-ratio:4/3}.Yvqh9W_galleryMasonry[data-view=masonry] .Yvqh9W_galleryCard:nth-child(3n) .Yvqh9W_galleryImage{aspect-ratio:3/4}.Yvqh9W_galleryBadge{color:#fff;backdrop-filter:blur(4px);background:#121724c2;border-radius:999px;padding:4px 9px;font-size:11px;position:absolute;top:10px;left:10px}.Yvqh9W_galleryCardActions{padding:8px 12px 0;display:flex}.Yvqh9W_galleryCardAction{border:1px solid var(--dsw-alias-border-l2);width:100%;min-width:0;min-height:28px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);cursor:pointer;font:inherit;white-space:nowrap;border-radius:7px;justify-content:center;align-items:center;gap:4px;padding:0 4px;font-size:10px;font-weight:500;display:inline-flex}.Yvqh9W_galleryCardAction:hover,.Yvqh9W_galleryCardAction:focus-visible{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);outline:none}.Yvqh9W_galleryCardAction:disabled{cursor:wait;opacity:.55}.Yvqh9W_galleryCardFooter{align-items:center;gap:9px;min-width:0;padding:10px 12px;display:flex}.Yvqh9W_galleryAvatar{color:#fff;background:var(--dsw-alias-brand-primary);border-radius:50%;flex:none;place-items:center;width:27px;height:27px;font-size:12px;font-weight:700;display:grid}.Yvqh9W_galleryCardInfo{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.Yvqh9W_galleryCardInfo strong,.Yvqh9W_galleryCardInfo small{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.Yvqh9W_galleryCardInfo strong{color:var(--dsw-alias-label-primary);font-size:12px}.Yvqh9W_galleryCardInfo small{color:var(--dsw-alias-label-tertiary);font-size:10px}.Yvqh9W_galleryTags{flex-wrap:wrap;gap:4px;margin-top:4px;display:flex}.Yvqh9W_galleryTags button{max-width:96px;min-height:19px;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);cursor:pointer;font:inherit;text-overflow:ellipsis;white-space:nowrap;border:0;border-radius:4px;padding:1px 6px;font-size:10px;line-height:1.35;overflow:hidden}.Yvqh9W_galleryTags button:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 17%, transparent)}.Yvqh9W_galleryTags .Yvqh9W_galleryTagEdit{color:var(--dsw-alias-label-tertiary);background:0 0;flex:none}.Yvqh9W_galleryTagEditor{align-items:center;gap:6px;padding:0 12px 10px 48px;display:flex}.Yvqh9W_galleryTagEditor input{border:1px solid var(--dsw-alias-border-l2);min-width:0;height:27px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font:inherit;border-radius:6px;outline:none;flex:1;padding:0 8px;font-size:11px}.Yvqh9W_galleryTagEditor input:focus{border-color:var(--dsw-alias-brand-primary)}.Yvqh9W_galleryTagEditor button{border:1px solid var(--dsw-alias-border-l2);height:27px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;font:inherit;border-radius:6px;padding:0 8px;font-size:11px}.Yvqh9W_galleryTagEditor button[type=submit]{color:var(--dsw-alias-brand-primary)}.Yvqh9W_galleryRemove{width:24px;height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;padding:0;font-size:18px}.Yvqh9W_galleryRemove:hover{color:var(--dsw-alias-state-error);background:var(--dsw-alias-bg-layer-2)}@media (width<=1100px){.Yvqh9W_galleryMasonry{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (width<=760px){.Yvqh9W_studio{grid-template-rows:minmax(220px,36%) minmax(0,1fr);grid-template-columns:minmax(0,1fr);overflow-y:auto}.Yvqh9W_history{grid-area:1/1;min-height:220px}.Yvqh9W_generation{flex-direction:column;grid-area:2/1;min-height:0}.Yvqh9W_config{width:auto;max-width:none;height:auto;min-height:0}.Yvqh9W_config[data-gallery=true]{flex:none}.Yvqh9W_canvas{min-height:560px}.Yvqh9W_galleryToolbar{flex-direction:column;align-items:flex-start}.Yvqh9W_galleryToolbarActions{flex-wrap:wrap;width:100%}.Yvqh9W_galleryMasonry{grid-template-columns:1fr}}";
		const tagId$2 = "@dickpy/dsh-imagegen/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dickpy/dsh-imagegen";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var panel_module_css_default = {
			"galleryAdd": "Yvqh9W_galleryAdd",
			"ecommerceResultsHeader": "Yvqh9W_ecommerceResultsHeader",
			"lightboxCopy": "Yvqh9W_lightboxCopy",
			"galleryToolbar": "Yvqh9W_galleryToolbar",
			"ecommerceAdvancedChevron": "Yvqh9W_ecommerceAdvancedChevron",
			"bigSpinner": "Yvqh9W_bigSpinner",
			"lightboxScaleFrame": "Yvqh9W_lightboxScaleFrame",
			"galleryViewToggle": "Yvqh9W_galleryViewToggle",
			"compareControl": "Yvqh9W_compareControl",
			"galleryCardInfo": "Yvqh9W_galleryCardInfo",
			"studio": "Yvqh9W_studio",
			"ecommerceFooterHint": "Yvqh9W_ecommerceFooterHint",
			"download": "Yvqh9W_download",
			"galleryFilterHeading": "Yvqh9W_galleryFilterHeading",
			"dshImageGenSpin": "Yvqh9W_dshImageGenSpin",
			"galleryRatioList": "Yvqh9W_galleryRatioList",
			"configHeader": "Yvqh9W_configHeader",
			"configGuideBody": "Yvqh9W_configGuideBody",
			"view": "Yvqh9W_view",
			"historyPrompt": "Yvqh9W_historyPrompt",
			"ecommerceGroups": "Yvqh9W_ecommerceGroups",
			"galleryTags": "Yvqh9W_galleryTags",
			"modelMenuList": "Yvqh9W_modelMenuList",
			"topNav": "Yvqh9W_topNav",
			"galleryWorkspace": "Yvqh9W_galleryWorkspace",
			"gallerySelectMode": "Yvqh9W_gallerySelectMode",
			"referenceImage": "Yvqh9W_referenceImage",
			"ecommerceSlotCard": "Yvqh9W_ecommerceSlotCard",
			"configScroll": "Yvqh9W_configScroll",
			"galleryTagInput": "Yvqh9W_galleryTagInput",
			"ecommercePlanBack": "Yvqh9W_ecommercePlanBack",
			"modelMenu": "Yvqh9W_modelMenu",
			"ecommerceTaskCard": "Yvqh9W_ecommerceTaskCard",
			"chatResizer": "Yvqh9W_chatResizer",
			"canvasMeta": "Yvqh9W_canvasMeta",
			"card": "Yvqh9W_card",
			"ecommerceAdvancedToggle": "Yvqh9W_ecommerceAdvancedToggle",
			"optionPill": "Yvqh9W_optionPill",
			"lightbox": "Yvqh9W_lightbox",
			"galleryFilter": "Yvqh9W_galleryFilter",
			"spinner": "Yvqh9W_spinner",
			"historyMeta": "Yvqh9W_historyMeta",
			"canvasError": "Yvqh9W_canvasError",
			"ecommerceUploadHero": "Yvqh9W_ecommerceUploadHero",
			"canvasHistoryTag": "Yvqh9W_canvasHistoryTag",
			"lightboxClose": "Yvqh9W_lightboxClose",
			"galleryFilterDivider": "Yvqh9W_galleryFilterDivider",
			"galleryHeading": "Yvqh9W_galleryHeading",
			"galleryAvatar": "Yvqh9W_galleryAvatar",
			"taskStatus": "Yvqh9W_taskStatus",
			"taskTrayToggle": "Yvqh9W_taskTrayToggle",
			"taskRows": "Yvqh9W_taskRows",
			"panelHeaderActions": "Yvqh9W_panelHeaderActions",
			"sessionTabLabel": "Yvqh9W_sessionTabLabel",
			"ecommerceFooterBody": "Yvqh9W_ecommerceFooterBody",
			"panelHeading": "Yvqh9W_panelHeading",
			"entryIcon": "Yvqh9W_entryIcon",
			"configToggle": "Yvqh9W_configToggle",
			"historyEmpty": "Yvqh9W_historyEmpty",
			"ecommercePlanWarn": "Yvqh9W_ecommercePlanWarn",
			"ecommerceResultBadge": "Yvqh9W_ecommerceResultBadge",
			"chatToggle": "Yvqh9W_chatToggle",
			"promptFooter": "Yvqh9W_promptFooter",
			"ecommerceFieldLabel": "Yvqh9W_ecommerceFieldLabel",
			"enhanceButton": "Yvqh9W_enhanceButton",
			"footer": "Yvqh9W_footer",
			"taskTrayChevron": "Yvqh9W_taskTrayChevron",
			"lightboxCaptionRow": "Yvqh9W_lightboxCaptionRow",
			"lightboxCaption": "Yvqh9W_lightboxCaption",
			"taskTrayClose": "Yvqh9W_taskTrayClose",
			"lightboxDownload": "Yvqh9W_lightboxDownload",
			"reference": "Yvqh9W_reference",
			"taskTray": "Yvqh9W_taskTray",
			"ecommerceGroup": "Yvqh9W_ecommerceGroup",
			"ecommerceAssets": "Yvqh9W_ecommerceAssets",
			"lightboxEdit": "Yvqh9W_lightboxEdit",
			"ecommerceAssetAdd": "Yvqh9W_ecommerceAssetAdd",
			"historyHeader": "Yvqh9W_historyHeader",
			"ecommerceResultsEmpty": "Yvqh9W_ecommerceResultsEmpty",
			"sessionTab": "Yvqh9W_sessionTab",
			"generateInner": "Yvqh9W_generateInner",
			"dshImageGenToastIn": "Yvqh9W_dshImageGenToastIn",
			"galleryTagFilterList": "Yvqh9W_galleryTagFilterList",
			"generateButton": "Yvqh9W_generateButton",
			"imageCaption": "Yvqh9W_imageCaption",
			"ecommerceAdvancedBody": "Yvqh9W_ecommerceAdvancedBody",
			"ecommerceWorkspace": "Yvqh9W_ecommerceWorkspace",
			"ecommerceTaskActions": "Yvqh9W_ecommerceTaskActions",
			"gallerySelect": "Yvqh9W_gallerySelect",
			"galleryTagEdit": "Yvqh9W_galleryTagEdit",
			"ecommerceGroupGrid": "Yvqh9W_ecommerceGroupGrid",
			"historyClear": "Yvqh9W_historyClear",
			"galleryTagEditor": "Yvqh9W_galleryTagEditor",
			"uploadHint": "Yvqh9W_uploadHint",
			"referenceActions": "Yvqh9W_referenceActions",
			"gallerySort": "Yvqh9W_gallerySort",
			"compareToggle": "Yvqh9W_compareToggle",
			"sidebarHistoryHost": "Yvqh9W_sidebarHistoryHost",
			"ecommercePlanList": "Yvqh9W_ecommercePlanList",
			"ecommercePrimaryAction": "Yvqh9W_ecommercePrimaryAction",
			"updateActions": "Yvqh9W_updateActions",
			"configGuide": "Yvqh9W_configGuide",
			"galleryFilterCount": "Yvqh9W_galleryFilterCount",
			"ecommerceField": "Yvqh9W_ecommerceField",
			"lightboxFigure": "Yvqh9W_lightboxFigure",
			"gallerySelectionClear": "Yvqh9W_gallerySelectionClear",
			"modeRow": "Yvqh9W_modeRow",
			"galleryCardFooter": "Yvqh9W_galleryCardFooter",
			"topNavDivider": "Yvqh9W_topNavDivider",
			"comparisonFullscreen": "Yvqh9W_comparisonFullscreen",
			"galleryRatio": "Yvqh9W_galleryRatio",
			"ecommercePlanMini": "Yvqh9W_ecommercePlanMini",
			"ecommerceResults": "Yvqh9W_ecommerceResults",
			"paramLabel": "Yvqh9W_paramLabel",
			"lightboxMeta": "Yvqh9W_lightboxMeta",
			"comparisonImageButton": "Yvqh9W_comparisonImageButton",
			"taskPrompt": "Yvqh9W_taskPrompt",
			"gallerySearch": "Yvqh9W_gallerySearch",
			"ecommerceActionChip": "Yvqh9W_ecommerceActionChip",
			"historyFilters": "Yvqh9W_historyFilters",
			"canvasBody": "Yvqh9W_canvasBody",
			"lightboxNav": "Yvqh9W_lightboxNav",
			"historyNew": "Yvqh9W_historyNew",
			"imageCard": "Yvqh9W_imageCard",
			"updateBanner": "Yvqh9W_updateBanner",
			"updateText": "Yvqh9W_updateText",
			"ecommerceParamGrid": "Yvqh9W_ecommerceParamGrid",
			"historyThumbPlaceholder": "Yvqh9W_historyThumbPlaceholder",
			"modelMenuItem": "Yvqh9W_modelMenuItem",
			"connectionDot": "Yvqh9W_connectionDot",
			"lightboxImage": "Yvqh9W_lightboxImage",
			"galleryClear": "Yvqh9W_galleryClear",
			"updateRelease": "Yvqh9W_updateRelease",
			"historyItem": "Yvqh9W_historyItem",
			"uploadIcon": "Yvqh9W_uploadIcon",
			"modelWrap": "Yvqh9W_modelWrap",
			"galleryToast": "Yvqh9W_galleryToast",
			"grid": "Yvqh9W_grid",
			"lightboxStage": "Yvqh9W_lightboxStage",
			"galleryImageButton": "Yvqh9W_galleryImageButton",
			"galleryRemove": "Yvqh9W_galleryRemove",
			"galleryBadge": "Yvqh9W_galleryBadge",
			"optionRow": "Yvqh9W_optionRow",
			"modePill": "Yvqh9W_modePill",
			"historySearch": "Yvqh9W_historySearch",
			"compareModelChoices": "Yvqh9W_compareModelChoices",
			"topNavItem": "Yvqh9W_topNavItem",
			"sessionTabIcon": "Yvqh9W_sessionTabIcon",
			"ecommercePlanNote": "Yvqh9W_ecommercePlanNote",
			"galleryCardAction": "Yvqh9W_galleryCardAction",
			"prompt": "Yvqh9W_prompt",
			"ecommerceSection": "Yvqh9W_ecommerceSection",
			"historyMain": "Yvqh9W_historyMain",
			"optionGrid": "Yvqh9W_optionGrid",
			"conversationToast": "Yvqh9W_conversationToast",
			"galleryCard": "Yvqh9W_galleryCard",
			"conversationAdd": "Yvqh9W_conversationAdd",
			"ecommerceSectionHint": "Yvqh9W_ecommerceSectionHint",
			"entryLabel": "Yvqh9W_entryLabel",
			"taskTrayCount": "Yvqh9W_taskTrayCount",
			"connectionStatus": "Yvqh9W_connectionStatus",
			"historyThumb": "Yvqh9W_historyThumb",
			"ecommerceRefRow": "Yvqh9W_ecommerceRefRow",
			"lightboxTool": "Yvqh9W_lightboxTool",
			"galleryToolbarActions": "Yvqh9W_galleryToolbarActions",
			"comparisonGrid": "Yvqh9W_comparisonGrid",
			"hiddenFile": "Yvqh9W_hiddenFile",
			"canvasState": "Yvqh9W_canvasState",
			"previewBadge": "Yvqh9W_previewBadge",
			"ecommerceTaskState": "Yvqh9W_ecommerceTaskState",
			"canvasStateTitle": "Yvqh9W_canvasStateTitle",
			"canvasStateHint": "Yvqh9W_canvasStateHint",
			"githubLink": "Yvqh9W_githubLink",
			"lightboxTools": "Yvqh9W_lightboxTools",
			"galleryTagFilter": "Yvqh9W_galleryTagFilter",
			"galleryFilterNote": "Yvqh9W_galleryFilterNote",
			"galleryImage": "Yvqh9W_galleryImage",
			"taskTrayHeader": "Yvqh9W_taskTrayHeader",
			"galleryCount": "Yvqh9W_galleryCount",
			"galleryCardActions": "Yvqh9W_galleryCardActions",
			"historyActions": "Yvqh9W_historyActions",
			"sessionTabs": "Yvqh9W_sessionTabs",
			"entry": "Yvqh9W_entry",
			"lightboxIndex": "Yvqh9W_lightboxIndex",
			"lightboxActions": "Yvqh9W_lightboxActions",
			"history": "Yvqh9W_history",
			"comparisonBoard": "Yvqh9W_comparisonBoard",
			"galleryBulkButton": "Yvqh9W_galleryBulkButton",
			"historyList": "Yvqh9W_historyList",
			"config": "Yvqh9W_config",
			"ecommerceStructureGrid": "Yvqh9W_ecommerceStructureGrid",
			"ecommerceSlotCount": "Yvqh9W_ecommerceSlotCount",
			"ecommerceAsset": "Yvqh9W_ecommerceAsset",
			"historyInfo": "Yvqh9W_historyInfo",
			"promptCount": "Yvqh9W_promptCount",
			"templatesButton": "Yvqh9W_templatesButton",
			"paramHint": "Yvqh9W_paramHint",
			"configResizer": "Yvqh9W_configResizer",
			"paramGroup": "Yvqh9W_paramGroup",
			"modelLabel": "Yvqh9W_modelLabel",
			"canvasEmptyIcon": "Yvqh9W_canvasEmptyIcon",
			"lightboxZoomLevel": "Yvqh9W_lightboxZoomLevel",
			"comparisonFullscreenGrid": "Yvqh9W_comparisonFullscreenGrid",
			"gallerySelectionBar": "Yvqh9W_gallerySelectionBar",
			"canvas": "Yvqh9W_canvas",
			"galleryMasonry": "Yvqh9W_galleryMasonry",
			"taskRow": "Yvqh9W_taskRow",
			"image": "Yvqh9W_image",
			"uploadBox": "Yvqh9W_uploadBox",
			"panelHeader": "Yvqh9W_panelHeader",
			"panelTitle": "Yvqh9W_panelTitle",
			"historyAction": "Yvqh9W_historyAction",
			"zoomHint": "Yvqh9W_zoomHint",
			"galleryFilters": "Yvqh9W_galleryFilters",
			"generation": "Yvqh9W_generation",
			"panel": "Yvqh9W_panel",
			"historyTitle": "Yvqh9W_historyTitle",
			"historyHeaderActions": "Yvqh9W_historyHeaderActions",
			"ecommerceResultsActions": "Yvqh9W_ecommerceResultsActions",
			"modelSelect": "Yvqh9W_modelSelect"
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
		/** Size options, presented as aspect ratios (auto = let the model decide).
		*  The host maps each ratio onto the model's own vocabulary: aspect_ratio for
		*  Grok Imagine, the closest pixel size for OpenAI-compatible endpoints. */
		const SIZES = [
			"auto",
			"1:1",
			"3:4",
			"4:3",
			"9:16",
			"2:3",
			"3:2",
			"16:9",
			"21:9"
		];
		/** Size option keys in the locale dictionary. */
		const SIZE_KEYS = {
			auto: "size.auto",
			"1:1": "size.square",
			"3:4": "size.portrait34",
			"4:3": "size.landscape43",
			"9:16": "size.portrait916",
			"2:3": "size.portrait23",
			"3:2": "size.landscape32",
			"16:9": "size.wide169",
			"21:9": "size.ultrawide21"
		};
		/** Quality options, shown as output-resolution tiers (auto = let the model
		*  decide). The host maps them: resolution for Grok, quality level for
		*  OpenAI-compatible endpoints (1k→low, 2k→medium, 4k→high). */
		const QUALITIES = [
			"auto",
			"1k",
			"2k",
			"4k"
		];
		/** Detail options ('' = omit the passthrough). */
		const DETAILS = [
			"",
			"standard",
			"high"
		];
		const REF_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
		const CONVERSATION_IMAGE_MAX_DIMENSION = 2e3;
		const CONVERSATION_IMAGE_JPEG_QUALITY = .9;
		const PREVIEW_SCALE_MIN = .5;
		const PREVIEW_SCALE_MAX = 3;
		const PREVIEW_SCALE_STEP = .25;
		const CONFIG_COLLAPSED_STORAGE_KEY = "dsh-imagegen-config-collapsed";
		const ECOMMERCE_DRAFT_STORAGE_KEY = "dsh-imagegen-ecommerce-draft";
		/** Reference roles an uploaded product asset can play (slot selections can
		*  also pick 'none'). */
		const ECOMMERCE_ASSET_ROLES = [
			"product",
			"packaging",
			"detail",
			"style"
		];
		const MAX_ECOMMERCE_ASSETS = 4;
		const ECOMMERCE_ROLE_PROMPT_LABELS = {
			product: "商品主体",
			packaging: "包装",
			detail: "细节/角度",
			style: "风格参考"
		};
		const PRODUCT_SET_SLOTS = [
			{
				key: "main",
				label: "主图",
				description: "干净背景，突出商品主体",
				count: 1,
				enabled: true,
				refRole: "product"
			},
			{
				key: "selling-point",
				label: "卖点图",
				description: "用画面展示商品核心卖点",
				count: 2,
				enabled: true,
				refRole: "product"
			},
			{
				key: "scene",
				label: "场景图",
				description: "真实生活或使用场景",
				count: 2,
				enabled: true,
				refRole: "product"
			},
			{
				key: "detail",
				label: "细节图",
				description: "材质、结构或工艺特写",
				count: 1,
				enabled: true,
				refRole: "detail"
			},
			{
				key: "spec",
				label: "规格图",
				description: "尺寸、容量或参数展示",
				count: 1,
				enabled: false,
				refRole: "product"
			},
			{
				key: "model",
				label: "使用图",
				description: "人物上手或穿戴效果",
				count: 1,
				enabled: false,
				refRole: "product"
			}
		];
		/** Legacy pixel sizes saved by older versions, mapped onto the current
		*  aspect-ratio vocabulary so restoring old history entries still works. */
		const LEGACY_SIZE_TO_RATIO = {
			"512x512": "1:1",
			"1024x1024": "1:1",
			"1536x1024": "3:2",
			"1024x1536": "2:3",
			"1792x1024": "16:9",
			"1024x1792": "9:16"
		};
		/** Legacy quality levels saved by older versions, mapped onto resolution. */
		const LEGACY_QUALITY_TO_RES = {
			low: "1k",
			medium: "2k",
			high: "4k"
		};
		/** Normalize a saved size value into a current dropdown option. */
		function normalizeSize(value) {
			if (SIZES.includes(value)) return value;
			return LEGACY_SIZE_TO_RATIO[value] ?? "auto";
		}
		/** Normalize a saved quality value into a current dropdown option. */
		function normalizeQuality(value) {
			if (QUALITIES.includes(value)) return value;
			return LEGACY_QUALITY_TO_RES[value] ?? "auto";
		}
		function clampPreviewScale(scale) {
			return Math.min(PREVIEW_SCALE_MAX, Math.max(PREVIEW_SCALE_MIN, scale));
		}
		/** Keep the image canvas preference across panel remounts without making it
		* part of the host settings document. */
		function readConfigCollapsed() {
			try {
				return window.localStorage.getItem(CONFIG_COLLAPSED_STORAGE_KEY) === "true";
			} catch {
				return false;
			}
		}
		const CHAT_COLLAPSED_STORAGE_KEY = "dsh-imagegen:chat-collapsed";
		const CONFIG_WIDTH_STORAGE_KEY = "dsh-imagegen:config-width";
		const CONFIG_WIDTH_MIN = 260;
		const CONFIG_WIDTH_MAX = 480;
		const CONFIG_WIDTH_DEFAULT = 300;
		/** The chat pane starts collapsed unless the user explicitly opened it. */
		function readChatOpen() {
			try {
				return window.localStorage.getItem(CHAT_COLLAPSED_STORAGE_KEY) === "open";
			} catch {
				return false;
			}
		}
		function readConfigWidth() {
			try {
				const raw = window.localStorage.getItem(CONFIG_WIDTH_STORAGE_KEY);
				if (raw === null) return CONFIG_WIDTH_DEFAULT;
				const value = Number(raw);
				if (Number.isFinite(value) && value > 0) return Math.min(CONFIG_WIDTH_MAX, Math.max(CONFIG_WIDTH_MIN, Math.round(value)));
			} catch {}
			return CONFIG_WIDTH_DEFAULT;
		}
		/** Read the current config from the settings scope snapshot. */
		function useConfig(scope) {
			const [value, setValue] = (0, react.useState)(scope.getSnapshot().value);
			(0, react.useEffect)(() => scope.subscribe(() => {
				setValue(scope.getSnapshot().value);
			}), [scope]);
			return value;
		}
		/** Track one redacted secret field without exposing its value to the panel. */
		function useSecretSet(scope, field) {
			const [isSet, setIsSet] = (0, react.useState)(scope.getSecretSetSnapshot(field));
			(0, react.useEffect)(() => scope.subscribeSecretSets(() => {
				setIsSet(scope.getSecretSetSnapshot(field));
			}), [field, scope]);
			return isSet;
		}
		/** Tick a seconds counter while `running`. */
		function useElapsed(running, startedAt) {
			const [elapsed, setElapsed] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				if (!running || startedAt === null) {
					setElapsed(0);
					return;
				}
				const update = () => {
					setElapsed(Math.max(1, Math.round((Date.now() - startedAt) / 1e3)));
				};
				update();
				const timer = window.setInterval(update, 1e3);
				return () => window.clearInterval(timer);
			}, [running, startedAt]);
			return elapsed;
		}
		/** Data URL for a generated image. */
		function srcOf(image) {
			return `data:${image.mime};base64,${image.b64}`;
		}
		/** Decode one durable conversation attachment into the panel's image shape. */
		async function attachmentToGenerated(ref) {
			const query = new URLSearchParams({
				attachment_id: String(ref.attachmentId),
				media_type: ref.mediaType,
				bytes: String(ref.bytes),
				width: String(ref.width),
				height: String(ref.height)
			});
			const response = await fetch(`${AGENT_IMAGE_API}?${query.toString()}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const blob = await response.blob();
			const dataUrl = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
				reader.onerror = () => reject(/* @__PURE__ */ new Error("image read failed"));
				reader.readAsDataURL(blob);
			});
			const comma = dataUrl.indexOf(",");
			if (comma < 0) throw new Error("image decode failed");
			return {
				b64: dataUrl.slice(comma + 1),
				mime: ref.mediaType
			};
		}
		/** Convert a generated image into the browser-owned draft format. */
		function generatedImageToFile(image, index) {
			const binary = atob(image.b64);
			const bytes = new Uint8Array(binary.length);
			for (let offset = 0; offset < binary.length; offset += 1) bytes[offset] = binary.charCodeAt(offset);
			return new File([bytes], `dsh-image-${index + 1}.${extensionOf(image.mime)}`, { type: image.mime });
		}
		/** Decode a data URL into a browser File for the native composer. */
		function dataUrlToFile(dataUrl, name) {
			const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.*)$/su.exec(dataUrl);
			if (match === null || match[1] === void 0 || match[2] === void 0) throw new Error("image processing returned an invalid data URL");
			const binary = atob(match[2]);
			const bytes = new Uint8Array(binary.length);
			for (let offset = 0; offset < binary.length; offset += 1) bytes[offset] = binary.charCodeAt(offset);
			return new File([bytes], name, { type: match[1] });
		}
		/** Read intrinsic dimensions without changing the original preview. */
		function imageDimensions(dataUrl) {
			return new Promise((resolve, reject) => {
				const image = new Image();
				image.onload = () => {
					const width = image.naturalWidth || image.width;
					const height = image.naturalHeight || image.height;
					if (width < 1 || height < 1) reject(/* @__PURE__ */ new Error("image dimensions are unavailable"));
					else resolve({
						width,
						height
					});
				};
				image.onerror = () => reject(/* @__PURE__ */ new Error("image decode failed"));
				image.src = dataUrl;
			});
		}
		/** Prepare the smaller conversation copy required by the host attachment policy. */
		async function prepareConversationImage(image, index) {
			const dataUrl = srcOf(image);
			const { width, height } = await imageDimensions(dataUrl);
			const longestSide = Math.max(width, height);
			if (longestSide <= CONVERSATION_IMAGE_MAX_DIMENSION) return {
				file: generatedImageToFile(image, index),
				dataUrl
			};
			const scale = CONVERSATION_IMAGE_MAX_DIMENSION / longestSide;
			const targetWidth = Math.max(1, Math.round(width * scale));
			const targetHeight = Math.max(1, Math.round(height * scale));
			const canvas = document.createElement("canvas");
			canvas.width = targetWidth;
			canvas.height = targetHeight;
			const context = canvas.getContext("2d");
			if (context === null) throw new Error("image resize is unavailable in this browser");
			const source = await new Promise((resolve, reject) => {
				const sourceImage = new Image();
				sourceImage.onload = () => resolve(sourceImage);
				sourceImage.onerror = () => reject(/* @__PURE__ */ new Error("image decode failed"));
				sourceImage.src = dataUrl;
			});
			context.drawImage(source, 0, 0, targetWidth, targetHeight);
			const resizedDataUrl = canvas.toDataURL("image/jpeg", CONVERSATION_IMAGE_JPEG_QUALITY);
			return {
				dataUrl: resizedDataUrl,
				file: dataUrlToFile(resizedDataUrl, `dsh-image-${index + 1}.jpg`)
			};
		}
		/** Follow the native session selection while the image panel stays mounted. */
		function useCurrentSessionId(sessions) {
			const [sessionId, setSessionId] = (0, react.useState)(() => sessions?.list.getSnapshot().current);
			(0, react.useEffect)(() => {
				if (sessions === void 0) {
					setSessionId(void 0);
					return;
				}
				const sync = () => {
					setSessionId(sessions.list.getSnapshot().current);
				};
				sync();
				return sessions.list.subscribe(sync);
			}, [sessions]);
			return sessionId;
		}
		/** Find the host mounted in the shell's left navigation region. */
		function useSidebarHistoryHost() {
			const [host, setHost] = (0, react.useState)(() => document.querySelector("[data-dsh-imagegen-history-host]"));
			(0, react.useEffect)(() => {
				const sync = () => {
					setHost(document.querySelector("[data-dsh-imagegen-history-host]"));
				};
				sync();
				const observer = new MutationObserver(sync);
				observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				return () => observer.disconnect();
			}, []);
			return host;
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
		function defaultEcommerceDraft() {
			return {
				projectId: "",
				projectName: "",
				category: "通用商品",
				platform: "通用",
				language: "中文",
				size: "1:1",
				productName: "",
				sellingPoints: "",
				protectedFeatures: "",
				styleHint: "",
				slots: PRODUCT_SET_SLOTS.map((slot) => ({ ...slot }))
			};
		}
		function ecommercePrompt(draft, slot) {
			const points = draft.sellingPoints.trim() || "突出商品真实材质、结构和核心价值";
			const protectedFeatures = draft.protectedFeatures.trim() || "保持商品颜色、形状、Logo、包装文字和结构真实，不添加不存在的配件";
			const refClause = slot.refRole !== void 0 && slot.refRole !== "none" ? `本图以上传的${ECOMMERCE_ROLE_PROMPT_LABELS[slot.refRole]}图片为参考，商品与风格必须与参考图保持一致；` : "";
			return `电商${slot.label}：为${draft.productName.trim() || "该商品"}制作${slot.description}。商品品类：${draft.category}；平台：${draft.platform}；语言：${draft.language}。商品卖点：${points}。必须遵守：${protectedFeatures}。${refClause}整体要求：商品主体清晰、比例真实、光线自然、画面干净、适合电商发布；${draft.styleHint.trim()}`;
		}
		/** Consistency prefix for slots generated after the main image exists. */
		function withAnchorNote(prompt) {
			return "商品套图一致性约束：附件是本套商品的主图，图中商品（外形、颜色、材质、Logo、包装文字）必须与附件完全一致，不得重新发明商品。" + prompt;
		}
		function modelsOfHistoryEntry(entry) {
			return entry.comparisonModels?.length !== void 0 && entry.comparisonModels.length > 1 ? entry.comparisonModels : [entry.model];
		}
		/** Comparison runs collapse by comparisonId, product sets by projectId. */
		function historyGroupKey(entry) {
			if (entry.comparisonId !== void 0) return entry.comparisonId;
			if (entry.workflow === "ecommerce" && entry.projectId !== void 0) return `project:${entry.projectId}`;
			return entry.id;
		}
		/** Collapse the per-model history rows that belong to one comparison run. */
		function groupHistoryEntries(entries) {
			const groups = /* @__PURE__ */ new Map();
			for (const entry of entries) {
				const key = historyGroupKey(entry);
				const existing = groups.get(key);
				if (existing === void 0) groups.set(key, {
					key,
					entries: [entry],
					models: modelsOfHistoryEntry(entry)
				});
				else {
					existing.entries.push(entry);
					existing.models = [.../* @__PURE__ */ new Set([...existing.models, ...modelsOfHistoryEntry(entry)])];
				}
			}
			return [...groups.values()];
		}
		function newComparisonId() {
			const cryptoApi = globalThis.crypto;
			if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
			return `comparison-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		}
		/** Render the studio. */
		function ImageGenPanel(props) {
			const { api, scope, sessions, conversation } = props;
			const config = useConfig(scope);
			const enabled = config?.enabled ?? true;
			const modelOptions = imageModelOptions(config);
			const imageModels = (config?.channels ?? []).length > 0 ? modelOptions.models : normalizeImageModels(config?.imageModels);
			const defaultChannelId = modelOptions.defaultChannelId;
			const configured = (defaultChannelId !== void 0 && (config?.channels ?? []).length > 0 ? config.channels.find((channel) => channel.id === defaultChannelId)?.apiUrl ?? "" : config?.apiUrl ?? "").trim() !== "";
			const legacyKeySet = useSecretSet(scope, "apiKey");
			const promptKeySet = useSecretSet(scope, "promptApiKey");
			const channelKeySet = (config?.channels ?? []).some((channel) => scope.getSecretSetSnapshot(`channelSecrets.${channel.id}`));
			const apiKeySet = (config?.channels ?? []).length > 0 ? channelKeySet : legacyKeySet;
			const connected = enabled && configured && apiKeySet;
			const [tab, setTab] = (0, react.useState)("text");
			const [workspace, setWorkspace] = (0, react.useState)("normal");
			/** Switch to a normal-generation tab, leaving any task workspace. */
			const openTab = (next) => {
				setWorkspace("normal");
				setTab(next);
			};
			const [prompt, setPrompt] = (0, react.useState)("");
			const [size, setSize] = (0, react.useState)("auto");
			const [quality, setQuality] = (0, react.useState)("auto");
			const [count, setCount] = (0, react.useState)(1);
			const [detail, setDetail] = (0, react.useState)("");
			const [model, setModel] = (0, react.useState)("");
			const [compareEnabled, setCompareEnabled] = (0, react.useState)(false);
			const [compareModels, setCompareModels] = (0, react.useState)([]);
			const [modelOpen, setModelOpen] = (0, react.useState)(false);
			const [refImage, setRefImage] = (0, react.useState)(null);
			const [images, setImages] = (0, react.useState)([]);
			const [addingToConversation, setAddingToConversation] = (0, react.useState)(null);
			const [galleryConversationAddingId, setGalleryConversationAddingId] = (0, react.useState)(null);
			const [conversationMessage, setConversationMessage] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [submitting, setSubmitting] = (0, react.useState)(false);
			const [enhancing, setEnhancing] = (0, react.useState)(false);
			const [configGuide, setConfigGuide] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)([]);
			const [viewingHistoryId, setViewingHistoryId] = (0, react.useState)(null);
			const [gallery, setGallery] = (0, react.useState)([]);
			const [galleryViewingId, setGalleryViewingId] = (0, react.useState)(null);
			const [galleryAdding, setGalleryAdding] = (0, react.useState)(false);
			const [galleryMessage, setGalleryMessage] = (0, react.useState)(null);
			const [galleryFilter, setGalleryFilter] = (0, react.useState)("all");
			const [galleryRatio, setGalleryRatio] = (0, react.useState)("all");
			const [galleryTagFilter, setGalleryTagFilter] = (0, react.useState)(null);
			const [galleryView, setGalleryView] = (0, react.useState)("masonry");
			const [gallerySort, setGallerySort] = (0, react.useState)("newest");
			const [galleryQuery, setGalleryQuery] = (0, react.useState)("");
			const [galleryTagInput, setGalleryTagInput] = (0, react.useState)("");
			const [editingGalleryTagsId, setEditingGalleryTagsId] = (0, react.useState)(null);
			const [galleryTagEditInput, setGalleryTagEditInput] = (0, react.useState)("");
			const [selectedGalleryIds, setSelectedGalleryIds] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [gallerySelecting, setGallerySelecting] = (0, react.useState)(false);
			const [historyQuery, setHistoryQuery] = (0, react.useState)("");
			const [historyModelFilter, setHistoryModelFilter] = (0, react.useState)("all");
			const [historyRatioFilter, setHistoryRatioFilter] = (0, react.useState)("all");
			const [preview, setPreview] = (0, react.useState)(null);
			const [previewScale, setPreviewScale] = (0, react.useState)(1);
			const [promptCopied, setPromptCopied] = (0, react.useState)(false);
			const [update, setUpdate] = (0, react.useState)(null);
			const [updating, setUpdating] = (0, react.useState)(false);
			const [updateMessage, setUpdateMessage] = (0, react.useState)(null);
			const [updateResult, setUpdateResult] = (0, react.useState)(null);
			const [libraryOpen, setLibraryOpen] = (0, react.useState)(false);
			const [tasks, setTasks] = (0, react.useState)([]);
			const tasksRef = (0, react.useRef)([]);
			const [taskTrayOpen, setTaskTrayOpen] = (0, react.useState)(false);
			const [comparison, setComparison] = (0, react.useState)(null);
			const [comparisonFullscreen, setComparisonFullscreen] = (0, react.useState)(false);
			const [ecommerce, setEcommerce] = (0, react.useState)(() => {
				try {
					const saved = window.localStorage.getItem(ECOMMERCE_DRAFT_STORAGE_KEY);
					if (saved !== null) {
						const merged = {
							...defaultEcommerceDraft(),
							...JSON.parse(saved)
						};
						if (Array.isArray(merged.slots)) merged.slots = merged.slots.map((slot) => ({
							...slot,
							refRole: slot.refRole ?? "product"
						}));
						return merged;
					}
				} catch {}
				return defaultEcommerceDraft();
			});
			const [ecommercePreview, setEcommercePreview] = (0, react.useState)(false);
			const [ecommerceGenerating, setEcommerceGenerating] = (0, react.useState)(false);
			const [ecommerceProjectId, setEcommerceProjectId] = (0, react.useState)(null);
			const [ecommerceAssets, setEcommerceAssets] = (0, react.useState)([]);
			/** History-restored product set currently shown in the results canvas. */
			const [ecommerceRestored, setEcommerceRestored] = (0, react.useState)(null);
			/** Pending main-image anchor: the main image task is in flight; once it
			*  completes, the remaining slots are resubmitted with it as their shared
			*  reference so every image in the set shows the same product. */
			const [ecommerceAnchor, setEcommerceAnchor] = (0, react.useState)(null);
			const [ecommerceRefOpen, setEcommerceRefOpen] = (0, react.useState)(false);
			const [configCollapsed, setConfigCollapsed] = (0, react.useState)(readConfigCollapsed);
			const [chatOpen, setChatOpen] = (0, react.useState)(readChatOpen);
			const [configWidth, setConfigWidth] = (0, react.useState)(readConfigWidth);
			const configAsideRef = (0, react.useRef)(null);
			const currentSessionId = useCurrentSessionId(sessions);
			const sidebarHistoryHost = useSidebarHistoryHost();
			const modeModels = tab === "edit" ? imageModels.filter((candidate) => describeModel(candidate).supportsEdit) : imageModels;
			const fileInput = (0, react.useRef)(null);
			const previewStage = (0, react.useRef)(null);
			const activeTasks = tasks.filter((task) => task.status === "queued" || task.status === "running");
			const activeTask = activeTasks.find((task) => task.status === "running") ?? activeTasks[0];
			const generating = submitting || activeTasks.length > 0;
			const elapsed = useElapsed(generating, activeTask?.startedAt ?? activeTask?.createdAt ?? null);
			(0, react.useEffect)(() => {
				try {
					window.localStorage.setItem(ECOMMERCE_DRAFT_STORAGE_KEY, JSON.stringify(ecommerce));
				} catch {}
			}, [ecommerce]);
			(0, react.useEffect)(() => {
				try {
					window.localStorage.setItem(CONFIG_COLLAPSED_STORAGE_KEY, String(configCollapsed));
				} catch {}
			}, [configCollapsed]);
			(0, react.useEffect)(() => {
				if (chatOpen) delete document.documentElement.dataset.dshImagegenChatCollapsed;
				else document.documentElement.dataset.dshImagegenChatCollapsed = "1";
				try {
					window.localStorage.setItem(CHAT_COLLAPSED_STORAGE_KEY, chatOpen ? "open" : "collapsed");
				} catch {}
			}, [chatOpen]);
			(0, react.useEffect)(() => () => {
				delete document.documentElement.dataset.dshImagegenChatCollapsed;
			}, []);
			(0, react.useEffect)(() => {
				if (ecommerceAnchor === null) return;
				const anchor = ecommerceAnchor;
				const mains = tasks.filter((task) => anchor.mainTaskIds.includes(task.id));
				if (mains.length === 0) return;
				if (mains.every((task) => task.status === "failed" || task.status === "cancelled")) {
					setEcommerceAnchor(null);
					setError(tt("ecommerce.anchorFailed"));
					return;
				}
				const done = mains.find((task) => task.status === "completed" && task.result !== void 0 && task.result.images.length > 0);
				if (done === void 0) return;
				setEcommerceAnchor(null);
				const dataUrl = srcOf(done.result.images[0]);
				const requests = anchor.remaining.map((request) => ({
					...request,
					mode: "edit",
					image: dataUrl,
					refName: "set-main-anchor",
					prompt: withAnchorNote(request.prompt)
				}));
				Promise.all(requests.map((request) => api.taskSubmit(request))).then((submitted) => {
					setTasks((previous) => [...submitted, ...previous]);
				}).catch((caught) => {
					setError(errorMessage(caught));
				});
			}, [
				api,
				tasks,
				ecommerceAnchor
			]);
			(0, react.useEffect)(() => {
				setModel((previous) => modeModels.includes(previous) ? previous : modeModels[0] ?? "");
				setCompareModels((previous) => {
					const retained = previous.filter((candidate) => modeModels.includes(candidate));
					return retained.length > 0 ? retained : modeModels[0] === void 0 ? [] : [modeModels[0]];
				});
			}, [modeModels.join("\0")]);
			const filteredGallery = gallery.filter((entry) => {
				if (galleryFilter === "all") return true;
				if (galleryFilter === "text" || galleryFilter === "edit") return entry.mode === galleryFilter;
				return entry.model === galleryFilter;
			}).filter((entry) => galleryRatio === "all" || normalizeSize(entry.size) === galleryRatio).filter((entry) => galleryTagFilter === null || (entry.tags ?? []).includes(galleryTagFilter)).filter((entry) => galleryQuery.trim() === "" || `${entry.prompt} ${entry.model} ${(entry.tags ?? []).join(" ")}`.toLocaleLowerCase().includes(galleryQuery.trim().toLocaleLowerCase())).slice().sort((a, b) => gallerySort === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
			const galleryTagOptions = [...new Set(gallery.flatMap((entry) => entry.tags ?? []))].sort((a, b) => a.localeCompare(b));
			const galleryModels = [.../* @__PURE__ */ new Set([...imageModels, ...gallery.map((entry) => entry.model)])];
			const filteredHistory = groupHistoryEntries(history).filter((group) => group.entries.some((entry) => {
				const query = historyQuery.trim().toLocaleLowerCase();
				const models = modelsOfHistoryEntry(entry);
				return (query === "" || `${entry.prompt} ${models.join(" ")}`.toLocaleLowerCase().includes(query)) && (historyModelFilter === "all" || models.includes(historyModelFilter)) && (historyRatioFilter === "all" || normalizeSize(entry.size) === historyRatioFilter);
			}));
			(0, react.useEffect)(() => {
				let disposed = false;
				api.historyList().then((entries) => {
					if (!disposed) setHistory(entries);
				}).catch(() => {});
				api.galleryList().then((entries) => {
					if (!disposed) setGallery(entries);
				}).catch(() => {});
				return () => {
					disposed = true;
				};
			}, [api]);
			(0, react.useEffect)(() => {
				const onChatImages = (event) => {
					const detail = event.detail;
					if (detail === void 0 || currentSessionId === void 0 || detail.sessionId !== currentSessionId) return;
					Promise.all(detail.refs.map(attachmentToGenerated)).then((next) => {
						openTab("text");
						setImages(next);
						setComparison(null);
						setViewingHistoryId(null);
						setGalleryViewingId(null);
						setError(null);
					}).catch((caught) => {
						setError(errorMessage(caught));
					});
				};
				document.addEventListener(CHAT_IMAGE_EVENT, onChatImages);
				return () => document.removeEventListener(CHAT_IMAGE_EVENT, onChatImages);
			}, [currentSessionId]);
			(0, react.useEffect)(() => {
				let disposed = false;
				const refresh = () => {
					api.taskList().then((next) => {
						if (disposed) return;
						const newlyCompleted = next.filter((task) => task.status === "completed" && task.result !== void 0 && !tasksRef.current.some((old) => old.id === task.id && old.status === "completed"));
						tasksRef.current = next;
						setTasks((previous) => {
							const completed = next.find((task) => task.status === "completed" && !previous.some((old) => old.id === task.id && old.status === "completed") && !comparison?.taskIds.includes(task.id));
							if (completed?.result !== void 0) {
								setImages(completed.result.images);
								if (completed.result.history !== void 0) setHistory(completed.result.history);
								setError(completed.result.historyError ?? null);
							}
							return next;
						});
						if (newlyCompleted.length > 0) api.historyList().then((entries) => {
							if (!disposed) setHistory(entries);
						}).catch(() => {});
					}).catch(() => {});
				};
				refresh();
				const timer = window.setInterval(refresh, 1500);
				return () => {
					disposed = true;
					window.clearInterval(timer);
				};
			}, [api, comparison]);
			const modelMenuRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!modelOpen) return;
				const onPointer = (event) => {
					const target = event.target;
					if (target instanceof Node && modelMenuRef.current?.contains(target)) return;
					setModelOpen(false);
				};
				document.addEventListener("mousedown", onPointer);
				document.addEventListener("focusin", onPointer);
				return () => {
					document.removeEventListener("mousedown", onPointer);
					document.removeEventListener("focusin", onPointer);
				};
			}, [modelOpen]);
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
			const openSettingsGuide = (kind) => {
				setConfigGuide(kind);
				const openPluginSettings = () => {
					Array.from(document.querySelectorAll("button")).find((button) => /^(插件|Plugins)$/.test(button.textContent?.trim() ?? ""))?.click();
					window.setTimeout(() => {
						const imageGenButton = Array.from(document.querySelectorAll("button")).find((button) => /dsh-imagegen/i.test(button.textContent ?? ""));
						if (imageGenButton?.getAttribute("aria-expanded") !== "true") imageGenButton?.click();
					}, 0);
				};
				const settingsButton = Array.from(document.querySelectorAll("button")).find((button) => /^(设置|Settings)$/.test(button.textContent?.trim() ?? ""));
				if (settingsButton?.getAttribute("aria-expanded") !== "true") settingsButton?.click();
				window.setTimeout(openPluginSettings, 0);
			};
			const enhanceCurrentPrompt = async () => {
				if (prompt.trim() === "" || enhancing) return;
				const promptEndpointConfigured = (config?.promptApiUrl ?? "").trim() !== "" || configured;
				if ((config?.promptModel ?? "").trim() === "" || !promptEndpointConfigured || !promptKeySet && !apiKeySet) {
					openSettingsGuide("enhancement");
					return;
				}
				setEnhancing(true);
				setError(null);
				try {
					setPrompt(await api.enhancePrompt(prompt));
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setEnhancing(false);
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
			/** Read uploaded product assets into session-only data-URL chips, capped at
			*  MAX_ECOMMERCE_ASSETS. Each starts as the product-role reference. */
			const acceptEcommerceFiles = (files) => {
				if (files === void 0) return;
				const incoming = Array.from(files).filter((file) => file.type.startsWith("image/") && file.size <= REF_IMAGE_MAX_BYTES);
				if (incoming.length === 0) {
					setError(tt("edit.uploadHint"));
					return;
				}
				for (const file of incoming) {
					const reader = new FileReader();
					reader.onload = () => {
						if (typeof reader.result !== "string") return;
						const dataUrl = reader.result;
						setEcommerceAssets((previous) => {
							if (previous.length >= MAX_ECOMMERCE_ASSETS) {
								setError(tt("ecommerce.assetsFull"));
								return previous;
							}
							return [...previous, {
								id: newComparisonId(),
								dataUrl,
								name: file.name,
								role: "product"
							}];
						});
					};
					reader.onerror = () => {
						setError(tt("edit.uploadHint"));
					};
					reader.readAsDataURL(file);
				}
			};
			/** Run one generation. */
			const handleGenerate = async () => {
				if (submitting) return;
				if (!enabled) {
					openSettingsGuide("disabled");
					return;
				}
				if (!configured || !apiKeySet) {
					openSettingsGuide("generation");
					return;
				}
				const promptText = prompt.trim();
				if (promptText === "") {
					setError(tt("prompt.required"));
					return;
				}
				if (tab === "edit" && refImage === null) {
					setError(tt("edit.required"));
					return;
				}
				const request = {
					mode: tab === "edit" ? "edit" : "text",
					model: modeModels.includes(model) ? model : modeModels[0] ?? "",
					prompt: promptText,
					size,
					quality,
					n: count,
					detail,
					...defaultChannelId !== void 0 ? { channelId: defaultChannelId } : {},
					...tab === "edit" && refImage !== null ? { image: refImage.dataUrl } : {},
					...tab === "edit" && refImage !== null ? { refName: refImage.name } : {}
				};
				setError(null);
				setSubmitting(true);
				try {
					const targetModels = (compareEnabled ? compareModels : [request.model]).filter((candidate) => modeModels.includes(candidate));
					if (targetModels.length === 0) {
						setError(tt("compare.selectRequired"));
						return;
					}
					const comparisonId = targetModels.length > 1 ? newComparisonId() : void 0;
					const comparisonFields = comparisonId === void 0 ? {} : {
						comparisonId,
						comparisonModels: targetModels
					};
					const submitted = await Promise.all(targetModels.map((targetModel) => api.taskSubmit({
						...request,
						model: targetModel,
						...comparisonFields
					})));
					setTasks((previous) => [...submitted, ...previous.filter((item) => !submitted.some((task) => task.id === item.id))]);
					setComparison(comparisonId === void 0 ? null : {
						taskIds: submitted.map((task) => task.id),
						prompt: promptText,
						comparisonId
					});
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setSubmitting(false);
				}
			};
			const handleEcommerceGenerate = async () => {
				if (ecommerceGenerateDisabled) return;
				if (!enabled || !configured || !apiKeySet) {
					openSettingsGuide("generation");
					return;
				}
				const projectId = ecommerce.projectId || newComparisonId();
				const buildRequest = (slot, index) => {
					const refRole = slot.refRole ?? "product";
					const asset = refRole === "none" ? void 0 : ecommerceAssets.find((item) => item.role === refRole);
					return {
						mode: asset !== void 0 ? "edit" : "text",
						model: modeModels.includes(model) ? model : modeModels[0] ?? "",
						prompt: ecommercePrompt(ecommerce, slot),
						size: ecommerce.size,
						quality,
						n: 1,
						detail,
						...defaultChannelId !== void 0 ? { channelId: defaultChannelId } : {},
						...asset !== void 0 ? {
							image: asset.dataUrl,
							refName: asset.name
						} : {},
						workflow: "ecommerce",
						projectId,
						projectName: ecommerce.projectName.trim() || ecommerce.productName.trim(),
						slotKey: `${slot.key}-${index + 1}`,
						slotLabel: slot.label
					};
				};
				const mainSlots = ecommerceSlots.filter((slot) => slot.key === "main");
				const otherSlots = ecommerceSlots.filter((slot) => slot.key !== "main");
				const anchorChain = mainSlots.length > 0 && otherSlots.length > 0;
				const requests = (anchorChain ? mainSlots : ecommerceSlots).flatMap((slot) => Array.from({ length: slot.count }, (_, index) => buildRequest(slot, index)));
				const remaining = anchorChain ? otherSlots.flatMap((slot) => Array.from({ length: slot.count }, (_, index) => {
					const { image: _image, refName: _refName, ...rest } = buildRequest(slot, index);
					return rest;
				})) : [];
				setEcommerceGenerating(true);
				setSubmitting(true);
				setError(null);
				setEcommerceProjectId(projectId);
				setEcommerceRestored(null);
				setEcommerceAnchor(null);
				try {
					const submitted = await Promise.all(requests.map((request) => api.taskSubmit(request)));
					setTasks((previous) => [...submitted, ...previous]);
					setEcommercePreview(false);
					if (anchorChain) setEcommerceAnchor({
						projectId,
						mainTaskIds: submitted.map((task) => task.id),
						remaining
					});
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setSubmitting(false);
					setEcommerceGenerating(false);
				}
			};
			/** Start over with a fresh product draft (the old results stay in history). */
			const newEcommerceProduct = () => {
				setEcommerce(defaultEcommerceDraft());
				setEcommercePreview(false);
				setEcommerceProjectId(null);
				setEcommerceRestored(null);
				setEcommerceAnchor(null);
				setEcommerceAssets([]);
				setRefImage(null);
				setError(null);
			};
			/** Re-run every image of one slot with its original request. */
			const regenerateEcommerceSlot = async (label) => {
				if (ecommerceGenerating) return;
				const group = ecommerceMergedItems.filter((item) => item.label === label);
				if (group.length === 0) return;
				setEcommerceGenerating(true);
				setError(null);
				try {
					const submitted = await Promise.all(group.map((item) => api.taskSubmit({ ...item.source })));
					setTasks((previous) => [...submitted, ...previous]);
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setEcommerceGenerating(false);
				}
			};
			/** Open one persisted product set from history: rebuild the grouped results
			*  canvas from its entries. Reference images are not persisted, so restored
			*  edit-mode slots regenerate as text-to-image. */
			const viewEcommerceProject = async (group) => {
				const entry = group.entries[0];
				if (entry === void 0 || entry.projectId === void 0) return;
				try {
					const items = await Promise.all(group.entries.map(async (item) => ({
						id: item.id,
						label: item.slotLabel ?? "",
						slotKey: item.slotKey ?? "",
						status: "completed",
						model: item.model,
						prompt: item.prompt,
						images: await historyImagesToGenerated(item.images),
						source: {
							mode: item.mode === "edit" ? "text" : item.mode,
							model: item.model,
							prompt: item.prompt,
							size: item.size,
							quality: item.quality,
							detail: item.detail,
							n: 1,
							...item.channelId !== void 0 ? { channelId: item.channelId } : {},
							workflow: "ecommerce",
							projectId: entry.projectId,
							projectName: entry.projectName ?? "",
							slotKey: item.slotKey ?? "",
							slotLabel: item.slotLabel ?? ""
						}
					})));
					setWorkspace("ecommerce");
					setEcommerceRestored({
						projectId: entry.projectId,
						projectName: entry.projectName ?? "",
						items
					});
					setEcommerceProjectId(entry.projectId);
					setEcommercePreview(false);
					setError(null);
					setViewingHistoryId(entry.id);
					setGalleryViewingId(null);
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			/** Download a JSON manifest describing the whole product set (prompts,
			*  slots and task outcomes) so results stay reproducible outside the panel. */
			const exportEcommerceManifest = () => {
				const manifest = {
					project: {
						id: ecommerceProjectId,
						name: ecommerce.projectName || ecommerce.productName,
						productName: ecommerce.productName,
						category: ecommerce.category,
						platform: ecommerce.platform,
						language: ecommerce.language,
						size: ecommerce.size,
						sellingPoints: ecommerce.sellingPoints,
						protectedFeatures: ecommerce.protectedFeatures,
						styleHint: ecommerce.styleHint
					},
					generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
					images: ecommerceMergedItems.map((item) => ({
						slotKey: item.slotKey,
						slotLabel: item.label,
						status: item.status,
						model: item.model,
						prompt: item.prompt,
						error: item.error
					}))
				};
				const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.download = `dsh-product-set-${(ecommerce.projectName || ecommerce.productName || "set").replace(/[^\w-]+/g, "-")}.json`;
				anchor.click();
				URL.revokeObjectURL(url);
			};
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
			const loadHistoryGroup = async (group) => {
				return (await Promise.all(group.entries.map((entry) => historyImagesToGenerated(entry.images)))).flat();
			};
			/** View every model result from one comparison as one canvas result set. */
			const viewHistoryGroup = async (group) => {
				const entry = group.entries[0];
				if (entry === void 0) return;
				if (entry.workflow === "ecommerce" && entry.projectId !== void 0) {
					await viewEcommerceProject(group);
					return;
				}
				openTab("text");
				try {
					setImages(await loadHistoryGroup(group));
					setComparison(null);
					setError(null);
					setViewingHistoryId(entry.id);
					setGalleryViewingId(null);
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			/** Restore one comparison group, including its selected model set. */
			const restoreHistoryGroup = async (group) => {
				const entry = group.entries[0];
				if (entry === void 0) return;
				if (entry.workflow === "ecommerce" && entry.projectId !== void 0) {
					await viewEcommerceProject(group);
					return;
				}
				try {
					const restored = await loadHistoryGroup(group);
					openTab(entry.mode);
					setPrompt(entry.prompt);
					setSize(normalizeSize(entry.size));
					setQuality(normalizeQuality(entry.quality));
					setDetail(DETAILS.includes(entry.detail) ? entry.detail : "");
					setCount(entry.n >= 1 && entry.n <= 4 ? entry.n : 1);
					setModel(imageModels.includes(entry.model) ? entry.model : imageModels[0]);
					setCompareModels(group.models.filter((candidate) => imageModels.includes(candidate)));
					setCompareEnabled(group.models.filter((candidate) => imageModels.includes(candidate)).length > 1);
					setRefImage(null);
					setImages(restored);
					setComparison(null);
					setError(null);
					setViewingHistoryId(entry.id);
					setGalleryViewingId(null);
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			/** Remove every persisted row belonging to one comparison group. */
			const deleteHistoryGroup = async (group) => {
				const ids = new Set(group.entries.map((entry) => entry.id));
				setHistory((previous) => previous.filter((entry) => !ids.has(entry.id)));
				if (viewingHistoryId !== null && ids.has(viewingHistoryId)) setViewingHistoryId(null);
				if (ecommerceRestored !== null && group.entries.some((entry) => entry.projectId === ecommerceRestored.projectId)) {
					setEcommerceRestored(null);
					setEcommerceProjectId(null);
					setEcommerceAnchor(null);
				}
				try {
					let next = history;
					for (const id of ids) next = await api.historyRemove(id);
					setHistory(next);
				} catch {}
			};
			/** Reset the workspace for a fresh image-generation run. */
			const startNewCreation = () => {
				openTab("text");
				setPrompt("");
				setRefImage(null);
				setImages([]);
				setPreview(null);
				setPreviewScale(1);
				setPromptCopied(false);
				setViewingHistoryId(null);
				setGalleryViewingId(null);
				setGallerySelecting(false);
				setSelectedGalleryIds(/* @__PURE__ */ new Set());
				setComparison(null);
				setComparisonFullscreen(false);
				setEcommerceRestored(null);
				setError(null);
				setConversationMessage(null);
				setGalleryMessage(null);
			};
			/** Remove all history entries. */
			const clearHistory = async () => {
				if (!window.confirm(tt("history.clearConfirm"))) return;
				setHistory([]);
				setViewingHistoryId(null);
				try {
					setHistory(await api.historyClear());
				} catch {}
			};
			/** Add one generated image to the gallery (host deduplicates by content).
			*  `entry` makes the action available from a history/gallery list item (its
			*  metadata + first image are saved); otherwise the current form state is
			*  used. */
			const addToGallery = async (image, entry) => {
				if (galleryAdding || workspace === "normal" && tab === "gallery") return;
				const source = entry ?? viewingEntry ?? {
					mode: tab === "edit" ? "edit" : "text",
					model,
					prompt: prompt.trim(),
					size,
					quality,
					detail,
					...refImage !== null ? { refName: refImage.name } : {}
				};
				setGalleryAdding(true);
				try {
					const result = await api.galleryAppend({
						id: "",
						createdAt: Date.now(),
						mode: source.mode,
						model: source.model,
						prompt: source.prompt,
						size: source.size,
						quality: source.quality,
						detail: source.detail,
						n: 1,
						images: [image],
						...source.refName === void 0 ? {} : { refName: source.refName }
					});
					setGallery(result.entries);
					setGalleryMessage(result.added ? tt("gallery.added") : tt("gallery.already"));
					window.setTimeout(() => {
						setGalleryMessage(null);
					}, 2200);
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setGalleryAdding(false);
				}
			};
			/** Put a generated image into the native conversation composer. */
			const addImageToConversation = async (image, index, actionKey = index) => {
				if (addingToConversation !== null) return;
				if (conversation === void 0 || sessions === void 0 || currentSessionId === void 0) {
					setError(tt("conversation.noSession"));
					return;
				}
				const sessionScope = sessions.scope(currentSessionId);
				if (sessionScope === void 0) {
					setError(tt("conversation.unavailable"));
					return;
				}
				setAddingToConversation(actionKey);
				let attachments = [];
				let added = false;
				try {
					const prepared = await prepareConversationImage(image, index);
					const file = prepared.file;
					attachments = conversation.createDraftImages([file]);
					const input = conversation.input.for(sessionScope);
					if (!input.addImages(attachments.map((attachment) => attachment.id))) throw new Error(tt("conversation.busy"));
					added = true;
					try {
						await api.attachConversationImage(String(currentSessionId), prepared.dataUrl, file.name);
					} catch (caught) {
						for (const attachment of attachments) input.removeImage(attachment.id);
						added = false;
						throw caught;
					}
					if (input.state.getSnapshot().draft.trim() === "" && prompt.trim() !== "") input.setDraft(prompt.trim());
					setConversationMessage(tt("conversation.added"));
					window.setTimeout(() => {
						setConversationMessage(null);
					}, 2200);
				} catch (caught) {
					if (!added) conversation.releaseDraftImages(attachments);
					setError(errorMessage(caught));
				} finally {
					setAddingToConversation(null);
				}
			};
			/** Add one history entry's first image to the gallery (fetches it from the
			*  history image route, then delegates to addToGallery). */
			const addHistoryEntryToGallery = async (entry) => {
				if (galleryAdding || entry.images.length === 0) return;
				try {
					const [image] = await historyImagesToGenerated(entry.images.slice(0, 1));
					if (image === void 0) return;
					await addToGallery(image, entry);
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			/** Load a persisted gallery image and add it to the current chat draft. */
			const addGalleryEntryToConversation = async (entry) => {
				if (galleryConversationAddingId !== null || addingToConversation !== null || entry.images.length === 0) return;
				setGalleryConversationAddingId(entry.id);
				try {
					const [image] = await historyImagesToGenerated(entry.images.slice(0, 1));
					if (image === void 0) return;
					await addImageToConversation(image, 0, `gallery:${entry.id}`);
				} catch (caught) {
					setError(errorMessage(caught));
				} finally {
					setGalleryConversationAddingId(null);
				}
			};
			/** View a gallery image in the canvas. */
			const viewGalleryEntry = async (entry) => {
				try {
					const restored = await historyImagesToGenerated(entry.images);
					setImages(restored);
					setError(null);
					setViewingHistoryId(null);
					setGalleryViewingId(entry.id);
					if (restored.length > 0) openPreview(restored, 0);
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			/** Remove one gallery entry. */
			const deleteGalleryEntry = async (id) => {
				setGallery(gallery.filter((entry) => entry.id !== id));
				if (galleryViewingId === id) setGalleryViewingId(null);
				try {
					setGallery(await api.galleryRemove(id));
				} catch {}
			};
			/** Remove every gallery entry. */
			const clearGalleryAll = async () => {
				if (!window.confirm(tt("gallery.clearConfirm"))) return;
				setGallery([]);
				setGalleryViewingId(null);
				try {
					setGallery(await api.galleryClear());
				} catch {}
			};
			const applyGalleryTags = async () => {
				const tags = galleryTagInput.split(",").map((tag) => tag.trim()).filter(Boolean);
				if (tags.length === 0 || selectedGalleryIds.size === 0) return;
				try {
					let next = gallery;
					for (const id of selectedGalleryIds) {
						const existing = next.find((entry) => entry.id === id)?.tags ?? [];
						next = await api.gallerySetTags(id, [...existing, ...tags]);
					}
					setGallery(next);
					setGalleryTagInput("");
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			const startEditingGalleryTags = (entry) => {
				setEditingGalleryTagsId(entry.id);
				setGalleryTagEditInput((entry.tags ?? []).join(", "));
			};
			const saveGalleryTags = async (id) => {
				const tags = galleryTagEditInput.split(",").map((tag) => tag.trim()).filter(Boolean);
				try {
					setGallery(await api.gallerySetTags(id, tags));
					setEditingGalleryTagsId(null);
					setGalleryTagEditInput("");
				} catch (caught) {
					setError(errorMessage(caught));
				}
			};
			const toggleGallerySelection = (id) => {
				setSelectedGalleryIds((previous) => {
					const next = new Set(previous);
					if (next.has(id)) next.delete(id);
					else next.add(id);
					return next;
				});
			};
			const clearGallerySelection = () => {
				setSelectedGalleryIds(/* @__PURE__ */ new Set());
				setGallerySelecting(false);
			};
			const exportGalleryJson = () => {
				const entries = gallery.filter((entry) => selectedGalleryIds.has(entry.id));
				const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.download = `dsh-imagegen-gallery-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
				anchor.click();
				URL.revokeObjectURL(url);
			};
			const downloadGalleryImages = () => {
				gallery.filter((entry) => selectedGalleryIds.has(entry.id)).forEach((entry, index) => {
					const image = entry.images[0];
					if (image === void 0) return;
					const anchor = document.createElement("a");
					anchor.href = image.url;
					anchor.download = `dsh-gallery-${index + 1}.${extensionOf(image.mime)}`;
					anchor.click();
				});
			};
			const generateDisabled = submitting || modeModels.length === 0;
			const ecommerceSlots = ecommerce.slots.filter((slot) => slot.enabled && slot.count > 0);
			const ecommerceTotal = ecommerceSlots.reduce((total, slot) => total + slot.count, 0);
			const ecommerceGenerateDisabled = submitting || ecommerceGenerating || ecommerceSlots.length === 0 || ecommerce.productName.trim() === "";
			const ecommerceFileInput = (0, react.useRef)(null);
			const ecommerceProjectTasks = ecommerceProjectId === null ? [] : tasks.filter((task) => task.request.workflow === "ecommerce" && task.request.projectId === ecommerceProjectId);
			const liveSlotKeys = new Set(ecommerceProjectTasks.map((task) => task.request.slotKey ?? task.id));
			const ecommerceMergedItems = [...ecommerceProjectTasks.map((task) => ({
				id: task.id,
				label: task.request.slotLabel ?? "",
				slotKey: task.request.slotKey ?? "",
				status: task.status,
				model: task.request.model,
				prompt: task.request.prompt,
				...task.error !== void 0 ? { error: task.error } : {},
				images: task.result?.images ?? [],
				source: task.request
			})), ...ecommerceRestored !== null && ecommerceRestored.projectId === ecommerceProjectId ? ecommerceRestored.items.filter((item) => !liveSlotKeys.has(item.slotKey)) : []];
			const ecommerceDoneCount = ecommerceMergedItems.filter((item) => item.status === "completed").length;
			const ecommerceFailedCount = ecommerceMergedItems.filter((item) => item.status === "failed" || item.status === "cancelled").length;
			const ecommerceResultGroups = [...new Set(ecommerceMergedItems.map((item) => item.label))].filter((label) => label !== "").map((label) => ({
				label,
				items: ecommerceMergedItems.filter((item) => item.label === label)
			}));
			const conversationBusy = addingToConversation !== null || galleryConversationAddingId !== null;
			const viewingEntry = viewingHistoryId === null ? null : history.find((entry) => entry.id === viewingHistoryId) ?? null;
			const viewingGalleryEntry = galleryViewingId === null ? null : gallery.find((entry) => entry.id === galleryViewingId) ?? null;
			const previewImage = preview === null ? null : preview.images[preview.index] ?? null;
			const comparisonTasks = comparison === null ? [] : comparison.taskIds.map((id) => tasks.find((task) => task.id === id)).filter((task) => task !== void 0);
			const comparisonResults = comparisonTasks.filter((task) => task.status === "completed" && task.result !== void 0);
			const previewFrameScale = Math.max(1, previewScale);
			const previewImageScale = previewScale / previewFrameScale;
			/** Drag the config panel's right edge to resize it (persisted per browser). */
			const onConfigResizeStart = (event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				const aside = configAsideRef.current;
				if (aside === null) return;
				const left = aside.getBoundingClientRect().left;
				const onMove = (move) => {
					const width = Math.round(Math.min(CONFIG_WIDTH_MAX, Math.max(CONFIG_WIDTH_MIN, move.clientX - left)));
					setConfigWidth(width);
					try {
						window.localStorage.setItem(CONFIG_WIDTH_STORAGE_KEY, String(width));
					} catch {}
				};
				const onUp = () => {
					window.removeEventListener("pointermove", onMove);
					document.documentElement.style.removeProperty("cursor");
					document.documentElement.style.removeProperty("user-select");
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onUp, { once: true });
				document.documentElement.style.setProperty("cursor", "col-resize");
				document.documentElement.style.setProperty("user-select", "none");
			};
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
				openTab("edit");
				setRefImage({
					dataUrl: srcOf(previewImage),
					name: `dsh-image-${preview.index + 1}.${extensionOf(previewImage.mime)}`
				});
				if (prompt.trim() === "" && previewImage.revisedPrompt !== void 0) setPrompt(previewImage.revisedPrompt);
				setError(null);
				closePreview();
			};
			const historyPanel = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
				className: panel_module_css_default.history,
				"data-dsh-imagegen-history": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: panel_module_css_default.historyHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.historyTitle,
							children: tt("history.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.historyHeaderActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.historyNew,
								"data-history-new": "",
								"aria-label": tt("canvas.new"),
								title: tt("canvas.newHint"),
								onClick: startNewCreation,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 16 16",
									width: "15",
									height: "15",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.7",
									strokeLinecap: "round",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 3v10M3 8h10" })
								})
							}), history.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.historyClear,
								"data-history-clear": "",
								onClick: () => {
									clearHistory();
								},
								children: tt("history.clear")
							}) : null]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.historyFilters,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: panel_module_css_default.historySearch,
								value: historyQuery,
								onChange: (event) => {
									setHistoryQuery(event.target.value);
								},
								placeholder: tt("history.search"),
								"aria-label": tt("history.search")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: historyModelFilter,
								onChange: (event) => {
									setHistoryModelFilter(event.target.value);
								},
								"aria-label": tt("history.model"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "all",
									children: tt("history.allModels")
								}), [...new Set(history.flatMap((entry) => modelsOfHistoryEntry(entry)))].map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: option,
									children: option
								}, option))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: historyRatioFilter,
								onChange: (event) => {
									setHistoryRatioFilter(event.target.value);
								},
								"aria-label": tt("history.ratio"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "all",
									children: tt("history.allRatios")
								}), [...new Set(history.map((entry) => normalizeSize(entry.size)))].map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: option,
									children: option
								}, option))]
							})
						]
					}),
					filteredHistory.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.historyEmpty,
						children: tt("history.empty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.historyList,
						children: filteredHistory.map((group) => {
							const entry = group.entries[0];
							const isComparison = group.models.length > 1;
							const imageCount = group.entries.reduce((total, item) => total + item.images.length, 0);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.historyItem,
								"data-active": group.entries.some((item) => item.id === viewingHistoryId) ? "" : void 0,
								"data-comparison": isComparison ? "" : void 0,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: panel_module_css_default.historyMain,
									"data-dsh-imagegen-history-main": "",
									onClick: () => {
										viewHistoryGroup(group);
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
												isComparison ? tt("compare.title") : entry.workflow === "ecommerce" ? `${tt("ecommerce.short")}${entry.projectName !== void 0 && entry.projectName !== "" ? ` · ${entry.projectName}` : ""}` : tt(`mode.${entry.mode === "edit" ? "edit" : "text"}`),
												" · ",
												isComparison ? group.models.join(" · ") : entry.model,
												" · ",
												formatTime(entry.createdAt),
												" · ",
												imageCount,
												" ",
												tt("history.images")
											]
										})]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: panel_module_css_default.historyActions,
									children: [
										entry.images.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_default.historyAction,
											disabled: galleryAdding,
											title: tt("gallery.add"),
											onClick: () => {
												addHistoryEntryToGallery(entry);
											},
											children: tt("gallery.add")
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_default.historyAction,
											onClick: () => {
												restoreHistoryGroup(group);
											},
											children: tt("history.restore")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_default.historyAction,
											"data-danger": true,
											onClick: () => {
												deleteHistoryGroup(group);
											},
											children: tt("history.delete")
										})
									]
								})]
							}, group.key);
						})
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.panel,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: panel_module_css_default.panelHeader,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: panel_module_css_default.panelHeading,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: panel_module_css_default.panelTitle,
									children: tt("panel.title")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: panel_module_css_default.githubLink,
									href: "https://github.com/dickpy/dsh-imagegen",
									target: "_blank",
									rel: "noreferrer",
									title: tt("panel.githubTip"),
									"aria-label": tt("panel.githubTip"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
										viewBox: "0 0 16 16",
										width: "15",
										height: "15",
										fill: "currentColor",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" })
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
								className: panel_module_css_default.topNav,
								role: "tablist",
								"aria-label": tt("workspace.label"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: panel_module_css_default.topNavItem,
										"data-active": workspace === "normal" && tab !== "gallery" ? "" : void 0,
										onClick: () => {
											if (workspace !== "normal" || tab === "gallery") openTab("text");
										},
										children: tt("workspace.normal")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: panel_module_css_default.topNavItem,
										"data-active": workspace === "normal" && tab === "gallery" ? "" : void 0,
										onClick: () => {
											openTab("gallery");
										},
										children: tt("gallery.title")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.topNavDivider,
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: panel_module_css_default.topNavItem,
										"data-active": workspace === "ecommerce" ? "" : void 0,
										onClick: () => {
											setWorkspace("ecommerce");
										},
										children: [tt("workspace.ecommerce"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: panel_module_css_default.previewBadge,
											children: tt("ecommerce.badge")
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: panel_module_css_default.panelHeaderActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: panel_module_css_default.chatToggle,
									"data-open": chatOpen ? "true" : "false",
									"aria-pressed": chatOpen,
									title: chatOpen ? tt("chat.collapse") : tt("chat.expand"),
									onClick: () => {
										setChatOpen((open) => !open);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
										viewBox: "0 0 16 16",
										width: "13",
										height: "13",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "1.4",
										strokeLinecap: "round",
										strokeLinejoin: "round",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2.5 3.5h11v7.5H6.8L3.8 13.6v-2.6H2.5z" })
									}), tt("chat.toggle")]
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
							})
						]
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.studio,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.generation,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
								ref: configAsideRef,
								className: panel_module_css_default.config,
								style: { "--dsh-imagegen-config-width": `${configWidth}px` },
								"data-collapsed": configCollapsed ? "true" : "false",
								"data-gallery": workspace === "normal" && tab === "gallery" ? "true" : void 0,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.configResizer,
										title: tt("config.resizeHint"),
										onPointerDown: onConfigResizeStart
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.configHeader,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_default.configToggle,
											"aria-expanded": !configCollapsed,
											"aria-label": tt(configCollapsed ? "panel.expandConfig" : "panel.collapseConfig"),
											title: tt(configCollapsed ? "panel.expandConfig" : "panel.collapseConfig"),
											onClick: () => {
												setConfigCollapsed((previous) => !previous);
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
												viewBox: "0 0 16 16",
												width: "16",
												height: "16",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "1.6",
												strokeLinecap: "round",
												strokeLinejoin: "round",
												"aria-hidden": "true",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: configCollapsed ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5" })
											})
										})
									}),
									workspace === "normal" && tab === "gallery" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.galleryFilters,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.galleryFilterHeading,
												children: tt("gallery.categories")
											}),
											[
												["all", tt("gallery.all")],
												["text", tt("mode.text")],
												["edit", tt("mode.edit")],
												...galleryModels.map((value) => [value, value])
											].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: panel_module_css_default.galleryFilter,
												"data-active": galleryFilter === value ? "" : void 0,
												onClick: () => {
													setGalleryFilter(value);
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_default.galleryFilterCount,
													children: gallery.filter((entry) => value === "all" || value === "text" || value === "edit" ? value === "all" ? true : entry.mode === value : entry.model === value).length
												})]
											}, value)),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: panel_module_css_default.galleryFilterDivider }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.galleryFilterHeading,
												children: tt("gallery.ratio")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.galleryRatioList,
												children: [
													"all",
													"1:1",
													"3:4",
													"4:3",
													"16:9"
												].map((ratio) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.galleryRatio,
													"data-active": galleryRatio === ratio ? "" : void 0,
													onClick: () => {
														setGalleryRatio(ratio);
													},
													children: ratio === "all" ? tt("gallery.all") : ratio
												}, ratio))
											}),
											galleryTagOptions.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: panel_module_css_default.galleryFilterDivider }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: panel_module_css_default.galleryFilterHeading,
													children: tt("gallery.tags")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: panel_module_css_default.galleryTagFilterList,
													children: galleryTagOptions.map((tag) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: panel_module_css_default.galleryTagFilter,
														"data-active": galleryTagFilter === tag ? "" : void 0,
														onClick: () => {
															setGalleryTagFilter((previous) => previous === tag ? null : tag);
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tag }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: gallery.filter((entry) => (entry.tags ?? []).includes(tag)).length })]
													}, tag))
												})
											] }) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.galleryFilterNote,
												children: tt("gallery.filterHint")
											})
										]
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.configScroll,
										children: [
											workspace === "normal" && tab !== "gallery" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
												className: panel_module_css_default.card,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.modeRow,
													role: "tablist",
													"aria-label": tt("panel.title"),
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
														active: tab === "text",
														onClick: () => {
															setTab("text");
														},
														className: panel_module_css_default.modePill,
														children: tt("mode.text")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
														active: tab === "edit",
														onClick: () => {
															setTab("edit");
														},
														className: panel_module_css_default.modePill,
														children: tt("mode.edit")
													})]
												})
											}) : null,
											workspace === "ecommerce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												className: panel_module_css_default.ecommerceWorkspace,
												"data-ecommerce-workspace": "",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: panel_module_css_default.ecommerceSection,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: tt("ecommerce.product") }),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																className: panel_module_css_default.ecommerceField,
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: panel_module_css_default.ecommerceFieldLabel,
																	children: tt("ecommerce.productName")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	value: ecommerce.productName,
																	placeholder: tt("ecommerce.productName"),
																	onChange: (event) => setEcommerce((previous) => ({
																		...previous,
																		productName: event.target.value
																	}))
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																className: panel_module_css_default.ecommerceField,
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: panel_module_css_default.ecommerceFieldLabel,
																	children: tt("ecommerce.projectName")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	value: ecommerce.projectName,
																	placeholder: tt("ecommerce.projectName"),
																	onChange: (event) => setEcommerce((previous) => ({
																		...previous,
																		projectName: event.target.value
																	}))
																})]
															}),
															ecommerceAssets.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: panel_module_css_default.ecommerceUploadHero,
																"data-ecommerce-upload": "",
																onClick: () => {
																	ecommerceFileInput.current?.click();
																},
																onDragOver: (event) => {
																	event.preventDefault();
																},
																onDrop: (event) => {
																	event.preventDefault();
																	acceptEcommerceFiles(event.dataTransfer.files ?? void 0);
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
																		viewBox: "0 0 16 16",
																		width: "15",
																		height: "15",
																		fill: "none",
																		stroke: "currentColor",
																		strokeWidth: "1.3",
																		strokeLinecap: "round",
																		strokeLinejoin: "round",
																		"aria-hidden": "true",
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 10V3.5" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5.5 5.5L8 3l2.5 2.5" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 9.5V12a1.5 1.5 0 001.5 1.5h7A1.5 1.5 0 0013 12V9.5" })
																		]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("ecommerce.uploadRef") }),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: tt("edit.uploadHint") })
																]
															}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: panel_module_css_default.ecommerceAssets,
																children: [ecommerceAssets.map((asset) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: panel_module_css_default.ecommerceAsset,
																	"data-ecommerce-asset": "",
																	children: [
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
																			src: asset.dataUrl,
																			alt: asset.name
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
																			value: asset.role,
																			"data-ecommerce-asset-role": "",
																			"aria-label": tt("ecommerce.refSelect"),
																			onChange: (event) => setEcommerceAssets((previous) => previous.map((item) => item.id === asset.id ? {
																				...item,
																				role: event.target.value
																			} : item)),
																			children: ECOMMERCE_ASSET_ROLES.map((role) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																				value: role,
																				children: tt(`ecommerce.role.${role}`)
																			}, role))
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																			type: "button",
																			"aria-label": tt("edit.remove"),
																			onClick: () => {
																				setEcommerceAssets((previous) => previous.filter((item) => item.id !== asset.id));
																			},
																			children: "×"
																		})
																	]
																}, asset.id)), ecommerceAssets.length < MAX_ECOMMERCE_ASSETS ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																	type: "button",
																	className: panel_module_css_default.ecommerceAssetAdd,
																	"data-ecommerce-upload": "",
																	title: tt("ecommerce.uploadRef"),
																	onClick: () => {
																		ecommerceFileInput.current?.click();
																	},
																	onDragOver: (event) => {
																		event.preventDefault();
																	},
																	onDrop: (event) => {
																		event.preventDefault();
																		acceptEcommerceFiles(event.dataTransfer.files ?? void 0);
																	},
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		"aria-hidden": "true",
																		children: "＋"
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: tt("ecommerce.uploadShort") })]
																}) : null]
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: panel_module_css_default.ecommerceSection,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: tt("ecommerce.params") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: panel_module_css_default.ecommerceParamGrid,
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: panel_module_css_default.ecommerceField,
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: panel_module_css_default.ecommerceFieldLabel,
																		children: tt("ecommerce.platformLabel")
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																		value: ecommerce.platform,
																		onChange: (event) => setEcommerce((previous) => ({
																			...previous,
																			platform: event.target.value
																		})),
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "通用" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "淘宝 / 京东" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "Amazon" })
																		]
																	})]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: panel_module_css_default.ecommerceField,
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: panel_module_css_default.ecommerceFieldLabel,
																		children: tt("ecommerce.languageLabel")
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																		value: ecommerce.language,
																		onChange: (event) => setEcommerce((previous) => ({
																			...previous,
																			language: event.target.value
																		})),
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "中文" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "English" })]
																	})]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: panel_module_css_default.ecommerceField,
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: panel_module_css_default.ecommerceFieldLabel,
																		children: tt("ecommerce.ratioLabel")
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
																		value: ecommerce.size,
																		onChange: (event) => setEcommerce((previous) => ({
																			...previous,
																			size: event.target.value
																		})),
																		children: SIZES.filter((size) => size !== "auto").map((size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: size }, size))
																	})]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: panel_module_css_default.ecommerceField,
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: panel_module_css_default.ecommerceFieldLabel,
																		children: tt("ecommerce.categoryLabel")
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																		value: ecommerce.category,
																		onChange: (event) => setEcommerce((previous) => ({
																			...previous,
																			category: event.target.value
																		})),
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "通用商品" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "食品饮料" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "美妆个护" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "服装配饰" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "家居用品" }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: "3C 数码" })
																		]
																	})]
																})
															]
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: panel_module_css_default.ecommerceSection,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: tt("ecommerce.sellingTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
															value: ecommerce.sellingPoints,
															placeholder: tt("ecommerce.sellingPoints"),
															onChange: (event) => setEcommerce((previous) => ({
																...previous,
																sellingPoints: event.target.value
															}))
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: panel_module_css_default.ecommerceSection,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [tt("ecommerce.setStructure"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
																className: panel_module_css_default.ecommerceSectionHint,
																children: tt("ecommerce.multiSelect")
															})] }),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: panel_module_css_default.ecommerceStructureGrid,
																children: ecommerce.slots.map((slot) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																	type: "button",
																	className: panel_module_css_default.ecommerceSlotCard,
																	"data-active": slot.enabled ? "" : void 0,
																	title: `${slot.label}：${slot.description}`,
																	onClick: () => setEcommerce((previous) => ({
																		...previous,
																		slots: previous.slots.map((item) => item.key === slot.key ? {
																			...item,
																			enabled: !item.enabled
																		} : item)
																	})),
																	children: [slot.label, slot.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: panel_module_css_default.ecommerceSlotCount,
																		title: tt("ecommerce.countHint"),
																		onClick: (event) => {
																			event.stopPropagation();
																			setEcommerce((previous) => ({
																				...previous,
																				slots: previous.slots.map((item) => item.key === slot.key ? {
																					...item,
																					count: item.count >= 4 ? 1 : item.count + 1
																				} : item)
																			}));
																		},
																		children: slot.count
																	}) : null]
																}, slot.key))
															}),
															ecommerceSlots.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: panel_module_css_default.ecommerceAdvancedToggle,
																"aria-expanded": ecommerceRefOpen,
																onClick: () => {
																	setEcommerceRefOpen((open) => !open);
																},
																children: [tt("ecommerce.refSettings"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: panel_module_css_default.ecommerceAdvancedChevron,
																	"aria-hidden": "true",
																	children: ecommerceRefOpen ? "⌃" : "⌄"
																})]
															}), ecommerceRefOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: panel_module_css_default.ecommerceAdvancedBody,
																children: ecommerceSlots.map((slot) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: panel_module_css_default.ecommerceRefRow,
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: slot.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																		value: slot.refRole ?? "product",
																		"data-ecommerce-ref-select": "",
																		"aria-label": `${tt("ecommerce.refSelect")} · ${slot.label}`,
																		onChange: (event) => setEcommerce((previous) => ({
																			...previous,
																			slots: previous.slots.map((item) => item.key === slot.key ? {
																				...item,
																				refRole: event.target.value
																			} : item)
																		})),
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																			value: "none",
																			children: tt("ecommerce.refNone")
																		}), ECOMMERCE_ASSET_ROLES.map((role) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																			value: role,
																			children: tt(`ecommerce.role.${role}`)
																		}, role))]
																	})]
																}, slot.key))
															}) : null] }) : null
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: panel_module_css_default.ecommerceSection,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: tt("ecommerce.generation") }),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
																value: modeModels.includes(model) ? model : modeModels[0] ?? "",
																"aria-label": tt("model.label"),
																onChange: (event) => setModel(event.target.value),
																children: modeModels.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: option,
																	children: option
																}, option))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: panel_module_css_default.optionRow,
																children: QUALITIES.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
																	active: quality === option,
																	onClick: () => {
																		setQuality(option);
																	},
																	className: panel_module_css_default.optionPill,
																	children: tt(`quality.${option}`)
																}, option))
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: panel_module_css_default.ecommerceSection,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: tt("ecommerce.styleTitle") }),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
																value: ecommerce.styleHint,
																placeholder: tt("ecommerce.styleHint"),
																onChange: (event) => setEcommerce((previous) => ({
																	...previous,
																	styleHint: event.target.value
																}))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: panel_module_css_default.ecommerceFieldLabel,
																children: tt("ecommerce.protectedLabel")
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
																value: ecommerce.protectedFeatures,
																placeholder: tt("ecommerce.protectedFeatures"),
																onChange: (event) => setEcommerce((previous) => ({
																	...previous,
																	protectedFeatures: event.target.value
																}))
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														ref: ecommerceFileInput,
														type: "file",
														multiple: true,
														accept: "image/png,image/jpeg,image/webp,image/gif",
														className: panel_module_css_default.hiddenFile,
														onChange: (event) => {
															acceptEcommerceFiles(event.target.files ?? void 0);
															event.target.value = "";
														}
													})
												]
											}) : null,
											tab === "edit" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
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
											workspace === "normal" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												className: panel_module_css_default.card,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
													className: panel_module_css_default.prompt,
													value: prompt,
													placeholder: tt("prompt.placeholder"),
													onChange: (event) => {
														setPrompt(event.target.value);
													}
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.promptFooter,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															type: "button",
															className: panel_module_css_default.templatesButton,
															title: tt("templates.title"),
															onClick: () => {
																setLibraryOpen(true);
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
																viewBox: "0 0 16 16",
																width: "12",
																height: "12",
																fill: "none",
																stroke: "currentColor",
																strokeWidth: "1.4",
																strokeLinecap: "round",
																strokeLinejoin: "round",
																"aria-hidden": "true",
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2.5 3.5h11M2.5 8h11M2.5 12.5h7" })
															}), tt("templates.open")]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: panel_module_css_default.enhanceButton,
															disabled: prompt.trim() === "" || enhancing,
															title: tt("prompt.enhanceHint"),
															onClick: () => {
																enhanceCurrentPrompt();
															},
															children: enhancing ? tt("prompt.enhancing") : tt("prompt.enhance")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: panel_module_css_default.promptCount,
															children: tt("prompt.count", { count: prompt.length })
														})
													]
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
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
											})] }) : null
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: panel_module_css_default.footer,
										children: [
											workspace === "ecommerce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.ecommerceFooterBody,
												children: ecommercePreview ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: panel_module_css_default.ecommercePlanMini,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: tt("ecommerce.planTitle", { count: ecommerceTotal }) }),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: panel_module_css_default.ecommercePlanList,
																children: ecommerceSlots.map((slot) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: slot.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["×", slot.count] })] }, slot.key))
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: panel_module_css_default.ecommercePlanNote,
																children: tt("ecommerce.anchorNote")
															}),
															ecommerceAssets.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: panel_module_css_default.ecommercePlanWarn,
																children: tt("ecommerce.noAssetWarn")
															}) : null
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
														variant: "primary",
														size: "md",
														className: panel_module_css_default.ecommercePrimaryAction,
														disabled: ecommerceGenerateDisabled,
														onClick: () => {
															handleEcommerceGenerate();
														},
														children: ecommerceGenerating ? tt("generating") : tt("ecommerce.confirm")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: panel_module_css_default.ecommercePlanBack,
														onClick: () => {
															setEcommercePreview(false);
														},
														children: tt("gallery.tagsCancel")
													})
												] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_default.ecommerceFooterHint,
													children: ecommerceTotal > 0 ? tt("ecommerce.footerReady", { count: ecommerceTotal }) : tt("ecommerce.footerEmpty")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "primary",
													size: "md",
													className: panel_module_css_default.ecommercePrimaryAction,
													disabled: ecommerce.productName.trim() === "" || ecommerceTotal === 0,
													onClick: () => setEcommercePreview(true),
													children: tt("ecommerce.preview")
												})] })
											}) : null,
											workspace === "ecommerce" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: panel_module_css_default.modelWrap,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_default.modelLabel,
													children: tt("model.label")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													ref: modelMenuRef,
													className: panel_module_css_default.modelMenu,
													"data-open": modelOpen ? "true" : "false",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: panel_module_css_default.modelSelect,
														disabled: submitting,
														"aria-haspopup": "listbox",
														"aria-expanded": modelOpen,
														onClick: () => {
															setModelOpen((open) => !open);
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model || tt("model.noEditModels") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
															viewBox: "0 0 16 16",
															width: "12",
															height: "12",
															fill: "none",
															stroke: "currentColor",
															strokeWidth: "1.6",
															strokeLinecap: "round",
															strokeLinejoin: "round",
															"aria-hidden": "true",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 10.5L4 6h8z" })
														})]
													}), modelOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: panel_module_css_default.modelMenuList,
														role: "listbox",
														"aria-label": tt("model.label"),
														children: modeModels.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															role: "option",
															"aria-selected": model === option,
															className: panel_module_css_default.modelMenuItem,
															"data-selected": model === option ? "" : void 0,
															onClick: () => {
																setModel(option);
																setModelOpen(false);
															},
															children: option
														}, option))
													}) : null]
												})]
											}),
											workspace !== "ecommerce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: panel_module_css_default.compareControl,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: panel_module_css_default.compareToggle,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: compareEnabled,
														onChange: (event) => {
															setCompareEnabled(event.target.checked);
														}
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("compare.enable") })]
												}), compareEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: panel_module_css_default.compareModelChoices,
													role: "group",
													"aria-label": tt("compare.models"),
													children: modeModels.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: compareModels.includes(option),
														onChange: () => {
															setCompareModels((previous) => previous.includes(option) ? previous.filter((value) => value !== option) : [...previous, option]);
														}
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: option })] }, option))
												}) : null]
											}) : null,
											workspace !== "ecommerce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
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
											}) : null
										]
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: panel_module_css_default.canvas,
								"data-gallery": workspace === "normal" && tab === "gallery" ? "true" : void 0,
								children: [
									workspace === "normal" && tab === "gallery" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.galleryWorkspace,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
												className: panel_module_css_default.galleryToolbar,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
													className: panel_module_css_default.galleryHeading,
													children: tt("gallery.all")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_default.galleryCount,
													children: tt("gallery.count", { count: filteredGallery.length })
												})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: panel_module_css_default.galleryToolbarActions,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															className: panel_module_css_default.gallerySearch,
															value: galleryQuery,
															onChange: (event) => {
																setGalleryQuery(event.target.value);
															},
															placeholder: tt("gallery.search"),
															"aria-label": tt("gallery.search")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: panel_module_css_default.gallerySelectMode,
															"data-active": gallerySelecting ? "" : void 0,
															"aria-pressed": gallerySelecting,
															onClick: () => {
																setGallerySelecting((previous) => !previous);
															},
															children: gallerySelecting ? tt("gallery.selectionDone") : tt("gallery.select")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: panel_module_css_default.galleryViewToggle,
															role: "group",
															"aria-label": tt("gallery.viewMode"),
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																"data-active": galleryView === "masonry" ? "" : void 0,
																onClick: () => {
																	setGalleryView("masonry");
																},
																title: tt("gallery.masonry"),
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		"aria-hidden": "true",
																		children: "▦"
																	}),
																	" ",
																	tt("gallery.masonry")
																]
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																"data-active": galleryView === "grid" ? "" : void 0,
																onClick: () => {
																	setGalleryView("grid");
																},
																title: tt("gallery.grid"),
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		"aria-hidden": "true",
																		children: "▤"
																	}),
																	" ",
																	tt("gallery.grid")
																]
															})]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															className: panel_module_css_default.gallerySort,
															value: gallerySort,
															onChange: (event) => {
																setGallerySort(event.target.value);
															},
															"aria-label": tt("gallery.sort"),
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: "newest",
																children: tt("gallery.newest")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: "oldest",
																children: tt("gallery.oldest")
															})]
														}),
														gallery.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: panel_module_css_default.galleryClear,
															"data-gallery-clear": "",
															onClick: () => {
																clearGalleryAll();
															},
															children: tt("gallery.clear")
														}) : null
													]
												})]
											}),
											selectedGalleryIds.size > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												className: panel_module_css_default.gallerySelectionBar,
												"aria-label": tt("gallery.selected", { count: selectedGalleryIds.size }),
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: tt("gallery.selected", { count: selectedGalleryIds.size }) }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														className: panel_module_css_default.galleryTagInput,
														value: galleryTagInput,
														onChange: (event) => {
															setGalleryTagInput(event.target.value);
														},
														placeholder: tt("gallery.tagsPlaceholder"),
														"aria-label": tt("gallery.tagsPlaceholder")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: panel_module_css_default.galleryBulkButton,
														disabled: galleryTagInput.trim() === "",
														onClick: () => {
															applyGalleryTags();
														},
														children: tt("gallery.tagsApply")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: panel_module_css_default.galleryBulkButton,
														onClick: downloadGalleryImages,
														children: tt("gallery.downloadSelected")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: panel_module_css_default.galleryBulkButton,
														onClick: exportGalleryJson,
														children: tt("gallery.exportJson")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: panel_module_css_default.gallerySelectionClear,
														onClick: clearGallerySelection,
														children: tt("gallery.selectionClear")
													})
												]
											}) : null,
											filteredGallery.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.historyEmpty,
												children: tt("gallery.empty")
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.galleryMasonry,
												"data-view": galleryView,
												children: filteredGallery.map((entry) => {
													const image = entry.images[0];
													if (image === void 0) return null;
													return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
														className: panel_module_css_default.galleryCard,
														"data-selected": selectedGalleryIds.has(entry.id) ? "" : void 0,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
																className: panel_module_css_default.gallerySelect,
																title: tt("gallery.select"),
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	type: "checkbox",
																	checked: selectedGalleryIds.has(entry.id),
																	onChange: () => {
																		setGallerySelecting(true);
																		toggleGallerySelection(entry.id);
																	}
																})
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: panel_module_css_default.galleryImageButton,
																"data-selecting": gallerySelecting ? "" : void 0,
																onClick: () => {
																	if (gallerySelecting) toggleGallerySelection(entry.id);
																	else viewGalleryEntry(entry);
																},
																title: gallerySelecting ? tt("gallery.select") : tt("preview.open"),
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
																	className: panel_module_css_default.galleryImage,
																	src: image.url,
																	alt: entry.prompt
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: panel_module_css_default.galleryBadge,
																	children: entry.mode === "edit" ? tt("mode.edit") : tt("mode.text")
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: panel_module_css_default.galleryCardActions,
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																	type: "button",
																	className: panel_module_css_default.galleryCardAction,
																	"data-gallery-add-conversation": "",
																	disabled: conversationBusy,
																	title: tt("conversation.addHint"),
																	onClick: (event) => {
																		event.stopPropagation();
																		addGalleryEntryToConversation(entry);
																	},
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
																		viewBox: "0 0 16 16",
																		width: "13",
																		height: "13",
																		fill: "none",
																		stroke: "currentColor",
																		strokeWidth: "1.5",
																		strokeLinecap: "round",
																		strokeLinejoin: "round",
																		"aria-hidden": "true",
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 4.5h10v7H3z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5.5 2.5h5M8 6v4M6 8h4" })]
																	}), galleryConversationAddingId === entry.id || addingToConversation === `gallery:${entry.id}` ? tt("conversation.adding") : tt("conversation.add")]
																})
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: panel_module_css_default.galleryCardFooter,
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: panel_module_css_default.galleryAvatar,
																		children: entry.model.toLowerCase().startsWith("nanobanana") ? "N" : entry.model.toLowerCase().startsWith("seedream") ? "S" : entry.model.startsWith("grok") ? "G" : "D"
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: panel_module_css_default.galleryCardInfo,
																		children: [
																			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: entry.prompt || tt("gallery.untitled") }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
																				entry.model,
																				" · ",
																				normalizeSize(entry.size),
																				" · ",
																				formatTime(entry.createdAt)
																			] }),
																			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																				className: panel_module_css_default.galleryTags,
																				children: [(entry.tags ?? []).map((tag) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																					type: "button",
																					onClick: () => {
																						setGalleryTagFilter(tag);
																					},
																					children: tag
																				}, tag)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																					type: "button",
																					className: panel_module_css_default.galleryTagEdit,
																					onClick: () => {
																						startEditingGalleryTags(entry);
																					},
																					title: tt("gallery.editTags"),
																					children: tt("gallery.tagsEditShort")
																				})]
																			})
																		]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: panel_module_css_default.galleryRemove,
																		onClick: () => {
																			deleteGalleryEntry(entry.id);
																		},
																		title: tt("gallery.delete"),
																		children: "×"
																	})
																]
															}),
															editingGalleryTagsId === entry.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
																className: panel_module_css_default.galleryTagEditor,
																onSubmit: (event) => {
																	event.preventDefault();
																	saveGalleryTags(entry.id);
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		value: galleryTagEditInput,
																		onChange: (event) => {
																			setGalleryTagEditInput(event.target.value);
																		},
																		placeholder: tt("gallery.tagsPlaceholder"),
																		"aria-label": tt("gallery.tagsPlaceholder"),
																		autoFocus: true
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "submit",
																		children: tt("gallery.tagsSave")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		onClick: () => {
																			setEditingGalleryTagsId(null);
																			setGalleryTagEditInput("");
																		},
																		children: tt("gallery.tagsCancel")
																	})
																]
															}) : null
														]
													}, entry.id);
												})
											})
										]
									}) : null,
									workspace === "ecommerce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.ecommerceResults,
										"data-ecommerce-results": "",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
											className: panel_module_css_default.ecommerceResultsHeader,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: tt("ecommerce.results.title") }),
												ecommerceRestored !== null && ecommerceRestored.projectId === ecommerceProjectId && ecommerceRestored.projectName !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: ecommerceRestored.projectName }) : null,
												ecommerceMergedItems.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [tt("ecommerce.results.progress", {
													done: ecommerceDoneCount,
													total: ecommerceMergedItems.length
												}), ecommerceFailedCount > 0 ? ` · ${tt("ecommerce.results.failed", { count: ecommerceFailedCount })}` : ""] }) : null,
												ecommerceAnchor !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													"data-ecommerce-anchor": "",
													children: tt("ecommerce.anchorPending")
												}) : null
											] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: panel_module_css_default.ecommerceResultsActions,
												children: [ecommerceMergedItems.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.galleryBulkButton,
													"data-ecommerce-export": "",
													onClick: exportEcommerceManifest,
													children: tt("ecommerce.results.export")
												}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.galleryBulkButton,
													"data-ecommerce-new": "",
													onClick: newEcommerceProduct,
													children: tt("ecommerce.results.newProduct")
												})]
											})]
										}), ecommerceMergedItems.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.ecommerceResultsEmpty,
											children: tt("ecommerce.results.empty")
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.ecommerceGroups,
											children: ecommerceResultGroups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												className: panel_module_css_default.ecommerceGroup,
												"data-ecommerce-group": group.label,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: group.label }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														group.items.filter((item) => item.status === "completed").length,
														"/",
														group.items.length
													] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: panel_module_css_default.galleryBulkButton,
														disabled: ecommerceGenerating,
														onClick: () => {
															regenerateEcommerceSlot(group.label);
														},
														children: tt("ecommerce.results.regenerate")
													})
												] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: panel_module_css_default.ecommerceGroupGrid,
													children: group.items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: panel_module_css_default.ecommerceTaskCard,
														"data-status": item.status,
														children: item.status === "completed" && item.images.length > 0 ? item.images.map((image, imageIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
															className: panel_module_css_default.imageCard,
															role: "button",
															tabIndex: 0,
															title: tt("preview.open"),
															onClick: () => {
																openPreview(item.images, imageIndex);
															},
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
																	className: panel_module_css_default.image,
																	src: srcOf(image),
																	alt: `${group.label} ${imageIndex + 1}`
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: panel_module_css_default.ecommerceResultBadge,
																	children: group.label
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	className: panel_module_css_default.ecommerceTaskActions,
																	onClick: (event) => event.stopPropagation(),
																	children: [
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
																			className: panel_module_css_default.ecommerceActionChip,
																			href: srcOf(image),
																			download: `product-${item.slotKey || item.id}-${imageIndex + 1}.${extensionOf(image.mime)}`,
																			children: tt("download")
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																			type: "button",
																			className: panel_module_css_default.ecommerceActionChip,
																			disabled: galleryAdding,
																			onClick: () => {
																				addToGallery(image);
																			},
																			children: tt("gallery.add")
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																			type: "button",
																			className: panel_module_css_default.ecommerceActionChip,
																			disabled: conversationBusy,
																			onClick: () => {
																				addImageToConversation(image, imageIndex, `${item.id}:${imageIndex}`);
																			},
																			children: addingToConversation === `${item.id}:${imageIndex}` ? tt("conversation.adding") : tt("conversation.add")
																		})
																	]
																})
															]
														}, imageIndex)) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: panel_module_css_default.ecommerceTaskState,
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: group.label }),
																tt(`tasks.${item.status}`),
																item.error !== void 0 ? ` · ${item.error}` : ""
															]
														})
													}, item.id))
												})]
											}, group.label))
										})]
									}) : null,
									(workspace === "ecommerce" || tab !== "gallery") && tasks.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: panel_module_css_default.taskTray,
										"data-open": taskTrayOpen ? "true" : "false",
										"aria-label": tt("tasks.title"),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
											className: panel_module_css_default.taskTrayHeader,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: panel_module_css_default.taskTrayToggle,
												"aria-expanded": taskTrayOpen,
												onClick: () => {
													setTaskTrayOpen((open) => !open);
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("tasks.title") }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.taskTrayCount,
														children: activeTasks.length
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.taskTrayChevron,
														"aria-hidden": "true",
														children: taskTrayOpen ? "⌃" : "⌄"
													})
												]
											}), taskTrayOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: panel_module_css_default.taskTrayClose,
												"aria-label": tt("preview.close"),
												onClick: () => {
													setTaskTrayOpen(false);
												},
												children: "×"
											}) : null]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.taskRows,
											children: tasks.slice(0, 5).map((task) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: panel_module_css_default.taskRow,
												"data-status": task.status,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.taskStatus,
														children: tt(`tasks.${task.status}`)
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.taskPrompt,
														children: task.request.prompt
													}),
													task.status === "queued" || task.status === "running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => {
															api.taskCancel(task.id);
														},
														children: tt("tasks.cancel")
													}) : null,
													task.status === "failed" || task.status === "cancelled" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => {
															api.taskRetry(task.id);
														},
														children: tt("tasks.retry")
													}) : null
												]
											}, task.id))
										})]
									}) : null,
									workspace === "normal" && tab !== "gallery" && comparison !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: panel_module_css_default.comparisonBoard,
										"aria-label": tt("compare.title"),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: tt("compare.title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											comparisonResults.length,
											" / ",
											comparisonTasks.length,
											generating ? ` · ${tt("canvas.elapsed", { seconds: elapsed })}` : ""
										] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: comparisonResults.length === 0,
											onClick: () => {
												setComparisonFullscreen(true);
											},
											children: tt("compare.fullscreen")
										})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.comparisonGrid,
											children: comparisonTasks.map((task) => {
												const taskImages = task.result?.images ?? [];
												const image = taskImages[0];
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: task.request.model }), image !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.comparisonImageButton,
													title: tt("preview.open"),
													onClick: () => {
														openPreview(taskImages, 0);
													},
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
														src: srcOf(image),
														alt: task.request.model
													})
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt(`tasks.${task.status}`) })] }, task.id);
											})
										})]
									}) : null,
									generating && comparison === null && workspace !== "ecommerce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.canvasState,
										"data-generation-state": activeTask?.status ?? "submitting",
										role: "status",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_default.bigSpinner }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasStateTitle,
												children: submitting && activeTask === void 0 ? tt("canvas.submitting") : activeTask?.status === "queued" ? tt("canvas.queued") : tt("canvas.generating")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasStateHint,
												children: activeTask?.status === "queued" ? tt("canvas.queueHint", { count: activeTasks.length }) : tt("canvas.elapsed", { seconds: elapsed })
											})
										]
									}) : null,
									!generating && error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.canvasError,
										role: "alert",
										children: tt("canvas.error", { error })
									}) : null,
									!generating && !error && images.length === 0 && workspace !== "ecommerce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
									!generating && images.length > 0 && workspace !== "ecommerce" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.canvasBody,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: panel_module_css_default.canvasMeta,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("canvas.images", { count: images.length }) }), viewingEntry !== null || viewingGalleryEntry !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.canvasHistoryTag,
												children: viewingEntry !== null ? tt("history.viewing", { time: formatTime(viewingEntry.createdAt) }) : tt("gallery.viewing", { time: formatTime(viewingGalleryEntry.createdAt) })
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
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: panel_module_css_default.galleryAdd,
														title: tt("gallery.add"),
														disabled: galleryAdding,
														onClick: (event) => {
															event.stopPropagation();
															addToGallery(image);
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
															viewBox: "0 0 16 16",
															width: "12",
															height: "12",
															fill: "none",
															stroke: "currentColor",
															strokeWidth: "1.6",
															strokeLinecap: "round",
															strokeLinejoin: "round",
															"aria-hidden": "true",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
																x: "2.5",
																y: "3",
																width: "11",
																height: "10",
																rx: "1.5"
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 5.8v4.4M5.8 8h4.4" })]
														}), tt("gallery.add")]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: panel_module_css_default.conversationAdd,
														title: tt("conversation.add"),
														disabled: conversationBusy,
														onClick: (event) => {
															event.stopPropagation();
															addImageToConversation(image, index);
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
															viewBox: "0 0 16 16",
															width: "12",
															height: "12",
															fill: "none",
															stroke: "currentColor",
															strokeWidth: "1.5",
															strokeLinecap: "round",
															strokeLinejoin: "round",
															"aria-hidden": "true",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 4.5h10v7H3z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5.5 2.5h5M8 6v4M6 8h4" })]
														}), addingToConversation === index ? tt("conversation.adding") : tt("conversation.add")]
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
							})]
						})
					}),
					sidebarHistoryHost !== null && historyPanel !== null ? (0, react_dom.createPortal)(historyPanel, sidebarHistoryHost) : null,
					libraryOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TemplateLibrary, {
						api,
						onClose: () => {
							setLibraryOpen(false);
						},
						onUse: (text) => {
							openTab("text");
							setPrompt(text);
							setError(null);
							setLibraryOpen(false);
						}
					}) : null,
					configGuide !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.configGuide,
						role: "dialog",
						"aria-modal": "true",
						"aria-label": tt(`config.${configGuide}Title`),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.configGuideBody,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: tt(`config.${configGuide}Title`) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt(`config.${configGuide}Hint`) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										setConfigGuide(null);
									},
									children: tt("preview.close")
								})
							]
						})
					}) : null,
					comparisonFullscreen && comparison !== null ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.comparisonFullscreen,
						role: "dialog",
						"aria-modal": "true",
						"aria-label": tt("compare.title"),
						onClick: () => {
							setComparisonFullscreen(false);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: panel_module_css_default.lightboxClose,
							"aria-label": tt("preview.close"),
							onClick: () => {
								setComparisonFullscreen(false);
							},
							children: "×"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_default.comparisonFullscreenGrid,
							onClick: (event) => {
								event.stopPropagation();
							},
							children: comparisonResults.map((task) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("figcaption", { children: task.request.model }), task.result.images.map((image, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								src: srcOf(image),
								alt: task.request.model
							}, index))] }, task.id))
						})]
					}), document.body) : null,
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
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.lightboxEdit,
													disabled: conversationBusy,
													title: tt("conversation.addHint"),
													onClick: () => {
														addImageToConversation(previewImage, preview.index);
													},
													children: addingToConversation === preview.index ? tt("conversation.adding") : tt("conversation.add")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.lightboxEdit,
													disabled: galleryAdding,
													onClick: () => {
														addToGallery(previewImage);
													},
													children: tt("gallery.add")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.lightboxEdit,
													onClick: addPreviewToEdit,
													children: tt("preview.addToEdit")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
													className: panel_module_css_default.lightboxDownload,
													href: srcOf(previewImage),
													download: `dsh-image-${preview.index + 1}.${extensionOf(previewImage.mime)}`,
													children: tt("download")
												})
											]
										})]
									})
								]
							})
						]
					}), document.body) : null,
					galleryMessage !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.galleryToast,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 16 16",
							width: "14",
							height: "14",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.6",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
								x: "2.5",
								y: "3",
								width: "11",
								height: "10",
								rx: "1.5"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 5.8v4.4M5.8 8h4.4" })]
						}), galleryMessage]
					}) : null,
					conversationMessage !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.conversationToast,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 16 16",
							width: "14",
							height: "14",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.5",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 4.5h10v7H3z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5.5 2.5h5M8 6v4M6 8h4" })]
						}), conversationMessage]
					}) : null
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
		const CONVERSATION_COLUMN_SELECTOR = "[data-pane=\"conversation\"], [class*=\"centerCol\"]";
		const ACTIVE_ATTR = "data-dsh-imagegen-active";
		const RESIZER_SELECTOR = "[data-dsh-imagegen-chat-resizer]";
		const CHAT_WIDTH_STORAGE_KEY = "dsh-imagegen:chat-width";
		const CHAT_MIN_WIDTH = 320;
		/** Sibling panels' activation attributes, removed when this panel opens. */
		const OTHER_ACTIVE_ATTRS = ["data-dsh-taskboard-active", "data-dsh-ssh-active"];
		/** Cross-plugin activation event; detail is the activating panel name. */
		const ACTIVATE_EVENT = "dsh-panel-activate";
		const PANEL_NAME = "imagegen";
		/** Find the center column, or undefined while the frame is not mounted. */
		function conversationColumn() {
			return document.querySelector(CONVERSATION_COLUMN_SELECTOR) ?? void 0;
		}
		function readChatWidth() {
			try {
				const raw = window.localStorage.getItem(CHAT_WIDTH_STORAGE_KEY);
				if (raw === null) return void 0;
				const value = Number(raw);
				return Number.isFinite(value) && value >= CHAT_MIN_WIDTH ? value : void 0;
			} catch {
				return;
			}
		}
		function writeChatWidth(value) {
			try {
				window.localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(Math.round(value)));
			} catch {}
		}
		function applyChatWidth(column, clientX) {
			const bounds = column.getBoundingClientRect();
			const max = Math.max(CHAT_MIN_WIDTH, bounds.width * .7);
			const width = Math.min(max, Math.max(CHAT_MIN_WIDTH, bounds.right - clientX));
			column.style.setProperty("--dsh-imagegen-chat-width", `${Math.round(width)}px`);
			writeChatWidth(width);
		}
		/** Create the visible handle that separates the image workspace and chat. */
		function createChatResizer(column) {
			const resizer = document.createElement("div");
			resizer.dataset.dshImagegenChatResizer = "";
			resizer.className = panel_module_css_default.chatResizer;
			resizer.setAttribute("role", "separator");
			resizer.setAttribute("aria-orientation", "vertical");
			resizer.setAttribute("aria-label", "调整对话区域宽度");
			resizer.tabIndex = 0;
			const saved = readChatWidth();
			if (saved !== void 0) column.style.setProperty("--dsh-imagegen-chat-width", `${saved}px`);
			const onPointerDown = (event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				resizer.setPointerCapture?.(event.pointerId);
				const onMove = (move) => {
					applyChatWidth(column, move.clientX);
				};
				const onUp = () => {
					window.removeEventListener("pointermove", onMove);
					window.removeEventListener("pointerup", onUp);
					window.removeEventListener("pointercancel", onUp);
					resizer.releasePointerCapture?.(event.pointerId);
					document.documentElement.style.removeProperty("cursor");
					document.documentElement.style.removeProperty("user-select");
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onUp);
				window.addEventListener("pointercancel", onUp);
				document.documentElement.style.setProperty("cursor", "col-resize");
				document.documentElement.style.setProperty("user-select", "none");
			};
			const onKeyDown = (event) => {
				if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
				event.preventDefault();
				const bounds = column.getBoundingClientRect();
				const current = column.style.getPropertyValue("--dsh-imagegen-chat-width");
				const currentWidth = Number.parseFloat(current) || bounds.width * .36;
				const delta = event.key === "ArrowLeft" ? -24 : 24;
				applyChatWidth(column, bounds.right - currentWidth - delta);
			};
			resizer.addEventListener("pointerdown", onPointerDown);
			resizer.addEventListener("keydown", onKeyDown);
			return resizer;
		}
		/**
		* Mount the panel React tree into the center column and bind its visibility
		* to the controller's panelOpen state.
		* @param controller - the panel controller driving the view.
		* @param api - the image-generation API client the panel operates through.
		* @param scope - the settings scope (config status banner).
		* @returns disposer unmounting the tree and restoring the column.
		*/
		function mountPanel(controller, api, scope, services = {}) {
			let root;
			let container;
			let resizer;
			const ensure = () => {
				if (container !== void 0) {
					if (container.isConnected) return;
					root?.unmount();
					root = void 0;
					container.remove();
					container = void 0;
					resizer?.remove();
					resizer = void 0;
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
					...services
				}));
				resizer = column.querySelector(RESIZER_SELECTOR) ?? createChatResizer(column);
				if (resizer.parentElement !== column) column.appendChild(resizer);
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
				resizer?.remove();
				resizer = void 0;
			};
		}
		//#endregion
		//#region src/client/sidebar-entry.ts
		/** Stable selector for the injected two-tab host. */
		const ENTRY_SELECTOR = "[data-dsh-imagegen-session-tabs]";
		/** Stable selector for the history surface in the shell region area. */
		const HISTORY_HOST_SELECTOR = "[data-dsh-imagegen-history-host]";
		/** Inline picture glyph kept deliberately small for the sidebar rail. */
		const IMAGE_ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2\" y=\"2.5\" width=\"12\" height=\"11\" rx=\"1.5\"/><circle cx=\"5.6\" cy=\"5.8\" r=\"1\"/><path d=\"M2.5 12.5l3.6-3.4 2.4 2.2 3-3 2 2.4\"/></svg>";
		/** Inline plus glyph for the new-session tab. */
		const NEW_SESSION_ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M8 3v10M3 8h10\"/></svg>";
		/** Find the sidebar shell root, or undefined while it is not mounted. */
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		/** The shell-owned New Session button across current and legacy shells. */
		function newSessionButton(root) {
			return root.querySelector("button[data-dsh-part=\"new-session\"], button[class*=\"newSession\"]") ?? Array.from(root.children).find((child) => child instanceof HTMLElement && child.tagName === "BUTTON");
		}
		/** Locate the shell region that normally contains workspaces and sessions. */
		function regionArea(root) {
			return root.querySelector("[class*=\"regionArea\"]") ?? void 0;
		}
		function makeTab(label, tooltip, icon, onClick) {
			const tab = document.createElement("button");
			tab.type = "button";
			tab.className = panel_module_css_default.sessionTab;
			tab.setAttribute("aria-label", label);
			tab.setAttribute("title", tooltip);
			tab.innerHTML = `<span class="${panel_module_css_default.sessionTabIcon}">${icon}</span><span class="${panel_module_css_default.sessionTabLabel}">${label}</span>`;
			tab.addEventListener("click", onClick);
			return tab;
		}
		function hideShellButton(button) {
			button.dataset.dshImagegenOriginal = "";
			button.setAttribute("aria-hidden", "true");
			button.tabIndex = -1;
			button.style.display = "none";
		}
		function restoreShellButton(button) {
			button.style.removeProperty("display");
			button.removeAttribute("aria-hidden");
			button.removeAttribute("tabindex");
			delete button.dataset.dshImagegenOriginal;
		}
		/** Mount or repair the two-tab host at the shell's New Session position. */
		function placeTabs(root, controller, newSessionLabel, newSessionTooltip, imageLabel, imageTooltip) {
			const button = newSessionButton(root);
			if (button === void 0) return void 0;
			const existing = root.querySelector(ENTRY_SELECTOR);
			if (existing !== null && existing.parentElement === button.parentElement) {
				hideShellButton(button);
				return existing;
			}
			existing?.remove();
			const tabs = document.createElement("div");
			tabs.dataset.dshImagegenSessionTabs = "";
			tabs.className = panel_module_css_default.sessionTabs;
			tabs.setAttribute("role", "tablist");
			tabs.setAttribute("aria-label", imageTooltip);
			const newSessionTab = makeTab(newSessionLabel, newSessionTooltip, NEW_SESSION_ICON, () => {
				controller.close();
				button.click();
			});
			const imageTab = makeTab(imageLabel, imageTooltip, IMAGE_ICON, () => {
				controller.open();
			});
			newSessionTab.dataset.dshImagegenTab = "new-session";
			imageTab.dataset.dshImagegenTab = "image";
			tabs.append(newSessionTab, imageTab);
			button.parentElement?.insertBefore(tabs, button);
			hideShellButton(button);
			return tabs;
		}
		/** Mount an overlay host over the workspace/session tree for image history. */
		function placeHistoryHost(root) {
			const region = regionArea(root);
			if (region === void 0) return void 0;
			const existing = region.querySelector(HISTORY_HOST_SELECTOR);
			if (existing !== null) return existing;
			const host = document.createElement("div");
			host.dataset.dshImagegenHistoryHost = "";
			host.className = panel_module_css_default.sidebarHistoryHost;
			region.append(host);
			return host;
		}
		/**
		* Mount the two tabs and self-heal after React rebuilds the sidebar. The
		* shell-owned button is restored by the disposer so unloading the plugin
		* leaves the host unchanged.
		*/
		function mountSidebarEntry(controller, newSessionLabel, newSessionTooltip, imageLabel, imageTooltip) {
			let root;
			let tabs;
			let historyHost;
			let originalButton;
			const syncActive = () => {
				if (tabs === void 0) return;
				const newTab = tabs.querySelector("[data-dsh-imagegen-tab=\"new-session\"]");
				const imageTab = tabs.querySelector("[data-dsh-imagegen-tab=\"image\"]");
				if (controller.getSnapshot().panelOpen) {
					if (newTab !== null) delete newTab.dataset.active;
					if (imageTab !== null) imageTab.dataset.active = "";
				} else {
					if (newTab !== null) newTab.dataset.active = "";
					if (imageTab !== null) delete imageTab.dataset.active;
				}
			};
			const ensure = () => {
				if (root !== void 0 && !root.isConnected) {
					root = void 0;
					tabs = void 0;
					historyHost = void 0;
					originalButton = void 0;
				}
				root ?? (root = (sidebarRoot()));
				if (root === void 0) return;
				root.dataset.dshImagegenSidebarRoot = "";
				const button = newSessionButton(root);
				if (button === void 0) return;
				originalButton ?? (originalButton = (button));
				tabs = placeTabs(root, controller, newSessionLabel, newSessionTooltip, imageLabel, imageTooltip);
				historyHost = placeHistoryHost(root);
				syncActive();
			};
			const bodyObserver = new MutationObserver(ensure);
			bodyObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const unsubscribe = controller.subscribe(syncActive);
			ensure();
			return () => {
				bodyObserver.disconnect();
				unsubscribe();
				tabs?.remove();
				historyHost?.remove();
				if (originalButton !== void 0 && originalButton.isConnected) restoreShellButton(originalButton);
				if (root !== void 0) delete root.dataset.dshImagegenSidebarRoot;
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
				const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(project());
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
		//#region src/client/channels-form.ts
		/**
		* Staged form model for the channel list of the settings card. Mirrors the
		* CardForm staging pattern (dirty → one save) but for a structured value, so
		* the card can edit N channels, per-channel keys, and the default-channel
		* flag, then persist everything in one revision-fenced mutate call.
		*
		* Storage rules (dictated by dsh-settings semantics):
		*  - the whole `channels` array is written wholesale via `path: ['channels']`;
		*  - every channel's API key lives at `channelSecrets.<channelId>` (a secret
		*    dict), written per-key so untouched keys are never clobbered by a save
		*    the reader could not see (keys are redacted out of the wire view);
		*  - path ops never navigate *inside* the channels array.
		*/
		/** Deep equality over JSON-compatible data (the change predicate). */
		function deepEqualJson(a, b) {
			if (a === b) return true;
			if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
			if (Array.isArray(a) || Array.isArray(b)) {
				if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
				return a.every((entry, index) => deepEqualJson(entry, b[index]));
			}
			const left = a;
			const right = b;
			const keys = Object.keys(left);
			if (keys.length !== Object.keys(right).length) return false;
			return keys.every((key) => key in right && deepEqualJson(left[key], right[key]));
		}
		/** Trim and normalize a draft channel (models never carry empty aliases). */
		function stripChannel(channel) {
			const models = channel.models.map((model) => ({
				alias: model.alias.trim(),
				id: model.id.trim() === "" ? model.alias.trim() : model.id.trim()
			})).filter((model) => model.alias !== "");
			return {
				id: channel.id,
				preset: channel.preset,
				name: channel.name.trim(),
				apiUrl: channel.apiUrl.trim(),
				models: [...new Map(models.map((model) => [model.alias, model])).values()]
			};
		}
		var ChannelsForm = class {
			scope;
			stagedChannels = null;
			stagedKeys = /* @__PURE__ */ new Map();
			stagedDefault = null;
			listeners = /* @__PURE__ */ new Set();
			saving = false;
			failed = false;
			constructor(scope) {
				this.scope = scope;
				scope.subscribe(() => {
					this.publish();
				});
				scope.subscribeSecretSets(() => {
					this.publish();
				});
			}
			/** Publish a projection of this form, rebuilt on every scope or draft change. */
			bind(project) {
				const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/** Subscribe to staged and persisted channel changes. */
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			/** The staged channel list, or the scope value when nothing is staged. */
			channelsValue() {
				const view = this.scope.getSnapshot().value;
				return this.stagedChannels ?? (Array.isArray(view?.channels) ? view.channels.map(toDraft) : []);
			}
			/** Whether a channel currently holds a stored or staged secret. */
			keyHeld(id) {
				const edit = this.stagedKeys.get(id);
				if (edit !== void 0) return edit.kind === "set" && edit.value !== "";
				return this.scope.getSecretSetSnapshot(`channelSecrets.${id}`);
			}
			defaultValue() {
				if (this.stagedDefault !== null) return this.stagedDefault;
				const view = this.scope.getSnapshot().value;
				const channels = this.channelsValue();
				if (view?.defaultChannelId !== void 0 && channels.some((channel) => channel.id === view.defaultChannelId)) return view.defaultChannelId;
				return channels[0]?.id ?? "";
			}
			dirtyValue() {
				const channels = this.channelsValue();
				const stagedChanged = this.stagedChannels !== null && !deepEqualJson(this.stagedChannels, scopeChannelsOf(this.scope));
				const scopeDefault = this.scope.getSnapshot().value?.defaultChannelId ?? channels[0]?.id ?? "";
				const defaultChanged = this.stagedDefault !== null && this.stagedDefault !== scopeDefault;
				return stagedChanged || defaultChanged || this.stagedKeys.size > 0;
			}
			/** The card-facing snapshot. */
			snapshot() {
				const channels = this.channelsValue();
				const keySet = {};
				for (const channel of channels) keySet[channel.id] = this.keyHeld(channel.id);
				return {
					channels,
					keySet,
					defaultChannelId: this.defaultValue(),
					dirty: this.dirtyValue(),
					writable: this.scope.getSnapshot().writable !== false,
					saving: this.saving,
					failed: this.failed
				};
			}
			/** The actions the card's slot registration injects. */
			actions() {
				return {
					setChannels: (channels) => {
						this.stageChannels(channels);
					},
					setChannelKey: (id, value) => {
						this.stageKey(id, value);
					},
					setDefaultChannel: (id) => {
						this.stagedDefault = id;
						this.failed = false;
						this.publish();
					},
					commit: () => this.commit(),
					discard: () => {
						if (this.stagedChannels === null && this.stagedKeys.size === 0 && this.stagedDefault === null && !this.failed) return;
						this.stagedChannels = null;
						this.stagedKeys.clear();
						this.stagedDefault = null;
						this.failed = false;
						this.publish();
					}
				};
			}
			stageChannels(channels) {
				const cleaned = channels.map(stripChannel);
				this.stagedChannels = cleaned;
				this.failed = false;
				this.publish();
			}
			stageKey(id, value) {
				if (value === void 0 || value.trim() === "") {
					if (this.keyHeld(id)) this.stagedKeys.set(id, { kind: "clear" });
				} else this.stagedKeys.set(id, {
					kind: "set",
					value: value.trim()
				});
				this.failed = false;
				this.publish();
			}
			/** Build the single batch of path ops a save performs. */
			planOps() {
				const ops = [];
				if (this.stagedChannels !== null) {
					ops.push({
						op: "set",
						path: ["channels"],
						value: this.stagedChannels
					});
					ops.push({
						op: "unset",
						path: ["apiUrl"]
					});
					ops.push({
						op: "unset",
						path: ["apiKey"]
					});
					ops.push({
						op: "unset",
						path: ["imageModels"]
					});
				}
				for (const [id, edit] of this.stagedKeys) if (edit.kind === "set") ops.push({
					op: "set",
					path: ["channelSecrets", id],
					value: edit.value
				});
				else ops.push({
					op: "unset",
					path: ["channelSecrets", id]
				});
				if (this.stagedDefault !== null) ops.push({
					op: "set",
					path: ["defaultChannelId"],
					value: this.stagedDefault
				});
				return ops;
			}
			/**
			* Write every staged edit, then re-seed from what the Host accepted.
			* @returns settlement after the write settles.
			*/
			async commit() {
				if (this.saving) return;
				const ops = this.planOps();
				if (ops.length === 0) return;
				this.saving = true;
				this.failed = false;
				this.publish();
				try {
					await this.scope.mutateOps(ops);
					this.stagedChannels = null;
					this.stagedKeys.clear();
					this.stagedDefault = null;
					this.failed = false;
				} catch {
					this.failed = true;
				} finally {
					this.saving = false;
					this.publish();
				}
			}
			publish() {
				for (const listener of [...this.listeners]) listener();
			}
		};
		/** Project a stored channel into a draft (secrets never travel in channels). */
		function toDraft(channel) {
			return {
				id: channel.id,
				preset: channel.preset,
				name: channel.name,
				apiUrl: channel.apiUrl,
				models: channel.models.map((model) => ({ ...model }))
			};
		}
		/** The scope's current channels value (a plain array), for change detection. */
		function scopeChannelsOf(scope) {
			const view = scope.getSnapshot().value;
			return Array.isArray(view?.channels) ? view.channels : [];
		}
		//#endregion
		//#region \0dsh-css:E:\dsh-plugin\src\client\settings-card.module.css.mjs
		const css$1 = ".i1cc5G_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.i1cc5G_card:hover{border-color:var(--dsw-alias-label-dimmed)}.i1cc5G_card:has(.i1cc5G_body){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.i1cc5G_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.i1cc5G_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.i1cc5G_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.i1cc5G_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.i1cc5G_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.i1cc5G_chevron,.i1cc5G_chevronOpen{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.i1cc5G_chevronOpen{transform:rotate(180deg)}.i1cc5G_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.i1cc5G_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.i1cc5G_versionRow{border-bottom:1px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:12px;padding:12px 0;display:flex}.i1cc5G_versionLabel{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:1.5}.i1cc5G_versionValue{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-family-mono,monospace);border-radius:999px;padding:1px 8px;font-size:12px;line-height:1.5}.i1cc5G_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.i1cc5G_field+.i1cc5G_field{border-top:1px solid var(--dsw-alias-border-l2)}.i1cc5G_head{align-items:center;gap:8px;display:flex}.i1cc5G_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.i1cc5G_badges{align-items:center;gap:8px;display:inline-flex}.i1cc5G_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.i1cc5G_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.i1cc5G_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.i1cc5G_reset:disabled{cursor:default;opacity:.5}.i1cc5G_input,.i1cc5G_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;outline:none;padding:0 12px;font-size:13px;line-height:1.5}.i1cc5G_input:focus-visible,.i1cc5G_select:focus-visible{border-color:var(--dsw-alias-brand-primary)}.i1cc5G_input:disabled,.i1cc5G_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.i1cc5G_inputInvalid{border:1px solid var(--dsw-alias-label-error);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;outline:none;padding:0 12px;font-size:13px;line-height:1.5}.i1cc5G_textarea,.i1cc5G_textareaInvalid{resize:vertical;background:var(--dsw-alias-bg-layer-3);min-height:70px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;outline:none;padding:8px 12px;font-size:13px;line-height:1.5}.i1cc5G_textarea{border:1px solid var(--dsw-alias-border-l2)}.i1cc5G_textareaInvalid{border:1px solid var(--dsw-alias-label-error)}.i1cc5G_textarea:focus-visible{border-color:var(--dsw-alias-brand-primary)}.i1cc5G_textarea:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.i1cc5G_hint,.i1cc5G_invalid{margin:0;font-size:12px;line-height:1.5}.i1cc5G_hint{color:var(--dsw-alias-label-tertiary)}.i1cc5G_invalid{color:var(--dsw-alias-label-error)}.i1cc5G_readOnly,.i1cc5G_notExposed{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.i1cc5G_sectionDivider{background:var(--dsw-alias-border-l2);height:1px;margin:18px 0 14px}.i1cc5G_sectionTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:14px;line-height:1.4}.i1cc5G_sectionHint{color:var(--dsw-alias-label-tertiary);margin:-4px 0 2px;font-size:12px;line-height:1.5}.i1cc5G_modelSection{padding:2px 0 14px}.i1cc5G_sectionHeader{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.i1cc5G_sectionHeader .i1cc5G_sectionHint{max-width:430px}.i1cc5G_modelSummary{flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px;display:flex}.i1cc5G_modelChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-width:100%;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family-mono,monospace);border-radius:6px;align-items:center;gap:5px;padding:3px 5px 3px 8px;font-size:12px;line-height:1.5;display:inline-flex}.i1cc5G_modelChip>span{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.i1cc5G_modelChip button{appearance:none;width:18px;height:18px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:4px;padding:0;line-height:18px}.i1cc5G_modelChip button:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform)}.i1cc5G_modelChip button:disabled{cursor:default;opacity:.45}.i1cc5G_addModel{appearance:none;border:1px dashed var(--dsw-alias-border-l2);min-height:28px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:0 9px;font-size:12px}.i1cc5G_addModel:hover:not(:disabled){color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.i1cc5G_addModel:disabled{opacity:.45;cursor:default}.i1cc5G_manualModelRow{gap:8px;margin-top:10px;display:flex}.i1cc5G_manualModelRow .i1cc5G_input{flex:1;min-width:0}.i1cc5G_disclosure{appearance:none;border:0;border-top:1px solid var(--dsw-alias-border-l2);width:100%;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;background:0 0;align-items:center;gap:8px;padding:13px 0;font-size:13px;font-weight:500;display:flex}.i1cc5G_disclosure>span:nth-child(2){color:var(--dsw-alias-label-tertiary);margin-left:auto;font-size:12px;font-weight:400}.i1cc5G_disclosure>span:last-child{color:var(--dsw-alias-label-tertiary)}.i1cc5G_disclosure:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.i1cc5G_optionalContent{padding:0 0 8px}.i1cc5G_inlineDisclosure{appearance:none;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;align-items:center;gap:6px;margin-top:12px;padding:0;font-size:12px;display:inline-flex}.i1cc5G_inlineDisclosure:hover{color:var(--dsw-alias-label-primary)}.i1cc5G_modelFetchRow{align-items:center;gap:8px;display:flex}.i1cc5G_modelFetch,.i1cc5G_modelChoices{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);min-height:32px;color:var(--dsw-alias-label-secondary);font:inherit;border-radius:7px;font-size:12px}.i1cc5G_modelFetch{cursor:pointer;padding:0 10px}.i1cc5G_modelFetch:hover:not(:disabled){color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.i1cc5G_modelFetch:disabled{opacity:.5;cursor:default}.i1cc5G_modelChoices{flex:1;min-width:0;padding:0 8px}.i1cc5G_modelCandidateList{flex-wrap:wrap;gap:6px 10px;margin-top:10px;display:flex}.i1cc5G_modelCandidateLabel{width:100%;color:var(--dsw-alias-label-tertiary);font-size:12px}.i1cc5G_modelCandidate{appearance:none;min-width:0;color:var(--dsw-alias-label-secondary);cursor:pointer;background:var(--dsw-alias-bg-layer-3);font-size:12px;line-height:1.5;font:inherit;border:1px solid #0000;border-radius:5px;align-items:center;gap:5px;padding:3px 6px;display:inline-flex}.i1cc5G_modelCandidate input{margin:0}.i1cc5G_modelCandidate[data-selected]{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}.i1cc5G_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.i1cc5G_failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}.i1cc5G_discard,.i1cc5G_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.i1cc5G_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.i1cc5G_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.i1cc5G_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.i1cc5G_discard:disabled,.i1cc5G_save:disabled{opacity:.4;cursor:default}.i1cc5G_discard:focus-visible,.i1cc5G_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}@media (prefers-reduced-motion:reduce){.i1cc5G_card,.i1cc5G_chevron,.i1cc5G_chevronOpen{transition:none}}.i1cc5G_channelSection{padding:6px 0 2px}.i1cc5G_channelEmpty{color:var(--dsw-alias-label-tertiary);margin:10px 0 0;font-size:12px;line-height:1.5}.i1cc5G_channelList{flex-direction:column;gap:6px;margin:10px 0 0;padding:0;list-style:none;display:flex}.i1cc5G_channelRow{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;align-items:center;gap:10px;padding:8px 10px;display:flex}.i1cc5G_channelRow[data-action]{flex-wrap:wrap}.i1cc5G_channelDotReady,.i1cc5G_channelDotWarn{border-radius:50%;flex:none;width:9px;height:9px}.i1cc5G_channelDotReady{background:var(--dsw-color-success,#2fbf71)}.i1cc5G_channelDotWarn{background:var(--dsw-color-danger,#e5484d)}.i1cc5G_channelMain{appearance:none;min-width:0;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex-direction:column;flex:1;gap:3px;padding:0;display:flex}.i1cc5G_channelName{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;line-height:1.4;overflow:hidden}.i1cc5G_channelMeta{flex-wrap:wrap;align-items:center;gap:4px 8px;display:flex}.i1cc5G_channelHost{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;font-family:var(--dsw-font-family-mono,monospace);text-overflow:ellipsis;white-space:nowrap;max-width:180px;overflow:hidden}.i1cc5G_channelBadge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:0 7px;font-size:11px;font-weight:500;line-height:17px}.i1cc5G_channelBadge[data-warn]{color:var(--dsw-alias-label-error)}.i1cc5G_channelBadge[data-default]{background:var(--dsw-alias-bg-module-poped,var(--dsw-alias-bg-module-platform));color:var(--dsw-alias-brand-primary)}.i1cc5G_channelAction{appearance:none;font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;flex:none;padding:4px 8px;font-size:12px;line-height:1.5}.i1cc5G_channelAction:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform)}.i1cc5G_channelAction[data-danger]{color:var(--dsw-alias-label-error)}.i1cc5G_channelAction:disabled{opacity:.45;cursor:default}.i1cc5G_channelDanger{appearance:none;border:1px solid var(--dsw-alias-label-error);color:var(--dsw-alias-label-error);font:inherit;cursor:pointer;background:0 0;border-radius:6px;flex:none;padding:3px 10px;font-size:12px}.i1cc5G_channelDanger:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-label-error) 12%, transparent)}.i1cc5G_channelDanger:disabled{opacity:.45;cursor:default}.i1cc5G_deleteConfirmText{min-width:0;color:var(--dsw-alias-label-error);flex:1;font-size:12px;line-height:1.5}.i1cc5G_channelAddRow{gap:8px;margin-top:10px;display:flex}.i1cc5G_channelAdd{appearance:none;border:1px dashed var(--dsw-alias-border-l2);min-height:30px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:8px;padding:0 12px;font-size:12px}.i1cc5G_channelAdd:hover:not(:disabled){color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.i1cc5G_channelAdd:disabled{opacity:.45;cursor:default}.i1cc5G_spacer{flex:1}.i1cc5G_editorBackdrop{z-index:120;background:color-mix(in srgb, var(--dsw-alias-bg-layer-1,#000) 45%, transparent);justify-content:center;align-items:flex-start;padding:9vh 16px 16px;display:flex;position:fixed;inset:0}.i1cc5G_editorPanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:14px;width:min(560px,100%);max-height:82vh;padding:16px;overflow-y:auto;box-shadow:0 18px 50px #00000059}.i1cc5G_editorHeader{border-bottom:1px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:10px;display:flex}.i1cc5G_editorClose{appearance:none;width:26px;height:26px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:6px;flex:none;font-size:16px;line-height:26px}.i1cc5G_editorClose:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform)}.i1cc5G_editorField{flex-direction:column;gap:6px;padding:12px 0 0;display:flex}.i1cc5G_editorDivider{background:var(--dsw-alias-border-l2);height:1px;margin:14px 0 4px}.i1cc5G_editorSectionHeader{justify-content:space-between;align-items:center;gap:12px;padding:10px 0 4px;display:flex}.i1cc5G_editorSectionHeader .i1cc5G_label{flex:1}.i1cc5G_editorTools{flex-direction:column;gap:8px;margin-top:10px;display:flex}.i1cc5G_editorFooter{border-top:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding-top:12px;display:flex}.i1cc5G_detectOk{color:var(--dsw-color-success,var(--dsw-alias-label-secondary));margin:0;font-size:12px;line-height:1.5}.i1cc5G_modelRows{flex-direction:column;gap:8px;margin:8px 0 0;padding:0;list-style:none;display:flex}.i1cc5G_modelRow{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;display:flex}.i1cc5G_modelRowInputs{flex:1;align-items:center;gap:6px;min-width:0;display:flex}.i1cc5G_modelRowInputs .i1cc5G_input{flex:1;min-width:0}.i1cc5G_modelArrow{color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px}.i1cc5G_modelRowBadges{flex:none;align-items:center;gap:6px;display:flex}.i1cc5G_modelBadge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:0 7px;font-size:11px;line-height:17px}.i1cc5G_modelBadge[data-verified]{color:var(--dsw-color-success,var(--dsw-alias-label-secondary))}.i1cc5G_modelBadge[data-warn]{color:var(--dsw-alias-label-error)}.i1cc5G_modelRowRemove{appearance:none;width:20px;height:20px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:4px;flex:none;padding:0;line-height:20px}.i1cc5G_modelRowRemove:hover:not(:disabled){color:var(--dsw-alias-label-error);background:var(--dsw-alias-bg-module-platform)}.i1cc5G_modelRowRemove:disabled{opacity:.45;cursor:default}.i1cc5G_modelCandidate>.i1cc5G_modelBadge{flex:none}.i1cc5G_channelControls{position:relative}.i1cc5G_presetInline{z-index:10;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;width:min(420px,100vw - 48px);max-height:min(440px,60vh);margin:0;padding:12px;position:absolute;bottom:calc(100% + 8px);left:0;overflow-y:auto;box-shadow:0 12px 30px #0000004d}.i1cc5G_presetInlineHeader{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.i1cc5G_presetList{flex-direction:column;gap:8px;margin-top:12px;display:flex}.i1cc5G_presetRow{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:10px;flex-direction:column;align-items:flex-start;gap:3px;padding:10px 12px;display:flex}.i1cc5G_presetRow:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}.i1cc5G_presetRow[data-custom]{border-style:dashed}.i1cc5G_presetRow:disabled{opacity:.5;cursor:default}.i1cc5G_presetName{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.4}.i1cc5G_presetMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;font-family:var(--dsw-font-family-mono,monospace)}.i1cc5G_presetHint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}";
		const tagId$1 = "@dickpy/dsh-imagegen/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dickpy/dsh-imagegen";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"textareaInvalid": "i1cc5G_textareaInvalid",
			"readOnly": "i1cc5G_readOnly",
			"badge": "i1cc5G_badge",
			"channelName": "i1cc5G_channelName",
			"channelAdd": "i1cc5G_channelAdd",
			"save": "i1cc5G_save",
			"channelBadge": "i1cc5G_channelBadge",
			"detectOk": "i1cc5G_detectOk",
			"modelRowBadges": "i1cc5G_modelRowBadges",
			"modelBadge": "i1cc5G_modelBadge",
			"label": "i1cc5G_label",
			"inputInvalid": "i1cc5G_inputInvalid",
			"channelDotWarn": "i1cc5G_channelDotWarn",
			"presetName": "i1cc5G_presetName",
			"presetHint": "i1cc5G_presetHint",
			"modelRow": "i1cc5G_modelRow",
			"select": "i1cc5G_select",
			"input": "i1cc5G_input",
			"badges": "i1cc5G_badges",
			"channelList": "i1cc5G_channelList",
			"editorTools": "i1cc5G_editorTools",
			"channelMeta": "i1cc5G_channelMeta",
			"modelRowRemove": "i1cc5G_modelRowRemove",
			"channelHost": "i1cc5G_channelHost",
			"chevronOpen": "i1cc5G_chevronOpen",
			"sectionTitle": "i1cc5G_sectionTitle",
			"sectionHeader": "i1cc5G_sectionHeader",
			"editorField": "i1cc5G_editorField",
			"editorSectionHeader": "i1cc5G_editorSectionHeader",
			"editorHeader": "i1cc5G_editorHeader",
			"editorClose": "i1cc5G_editorClose",
			"modelFetchRow": "i1cc5G_modelFetchRow",
			"failed": "i1cc5G_failed",
			"editorDivider": "i1cc5G_editorDivider",
			"discard": "i1cc5G_discard",
			"name": "i1cc5G_name",
			"channelAddRow": "i1cc5G_channelAddRow",
			"editorBackdrop": "i1cc5G_editorBackdrop",
			"channelDotReady": "i1cc5G_channelDotReady",
			"headText": "i1cc5G_headText",
			"versionValue": "i1cc5G_versionValue",
			"editorPanel": "i1cc5G_editorPanel",
			"presetList": "i1cc5G_presetList",
			"modelCandidate": "i1cc5G_modelCandidate",
			"optionalContent": "i1cc5G_optionalContent",
			"modelRows": "i1cc5G_modelRows",
			"modelRowInputs": "i1cc5G_modelRowInputs",
			"addModel": "i1cc5G_addModel",
			"channelSection": "i1cc5G_channelSection",
			"presetRow": "i1cc5G_presetRow",
			"modelCandidateLabel": "i1cc5G_modelCandidateLabel",
			"channelDanger": "i1cc5G_channelDanger",
			"presetMeta": "i1cc5G_presetMeta",
			"field": "i1cc5G_field",
			"hint": "i1cc5G_hint",
			"versionLabel": "i1cc5G_versionLabel",
			"body": "i1cc5G_body",
			"manualModelRow": "i1cc5G_manualModelRow",
			"pending": "i1cc5G_pending",
			"notExposed": "i1cc5G_notExposed",
			"modelCandidateList": "i1cc5G_modelCandidateList",
			"modelArrow": "i1cc5G_modelArrow",
			"chevron": "i1cc5G_chevron",
			"modelChoices": "i1cc5G_modelChoices",
			"head": "i1cc5G_head",
			"inlineDisclosure": "i1cc5G_inlineDisclosure",
			"disclosure": "i1cc5G_disclosure",
			"channelRow": "i1cc5G_channelRow",
			"card": "i1cc5G_card",
			"description": "i1cc5G_description",
			"modelFetch": "i1cc5G_modelFetch",
			"channelMain": "i1cc5G_channelMain",
			"header": "i1cc5G_header",
			"modelSummary": "i1cc5G_modelSummary",
			"versionRow": "i1cc5G_versionRow",
			"channelAction": "i1cc5G_channelAction",
			"sectionDivider": "i1cc5G_sectionDivider",
			"channelControls": "i1cc5G_channelControls",
			"presetInlineHeader": "i1cc5G_presetInlineHeader",
			"presetInline": "i1cc5G_presetInline",
			"deleteConfirmText": "i1cc5G_deleteConfirmText",
			"textarea": "i1cc5G_textarea",
			"modelChip": "i1cc5G_modelChip",
			"spacer": "i1cc5G_spacer",
			"editorFooter": "i1cc5G_editorFooter",
			"reset": "i1cc5G_reset",
			"channelEmpty": "i1cc5G_channelEmpty",
			"invalid": "i1cc5G_invalid",
			"modelSection": "i1cc5G_modelSection",
			"footer": "i1cc5G_footer",
			"sectionHint": "i1cc5G_sectionHint"
		};
		//#endregion
		//#region src/client/SettingsCard.tsx
		/**
		* The dsh-imagegen settings card: channel management (list rows with status
		* dots, an editor dialog with the model-catalog alias → upstream mapping, and
		* built-in provider presets), plus the prompt-enhancement model and the plugin
		* switches. Registers into the official `settings.plugin.item` slot (the
		* Settings → Plugins → Configurable tab), independent of the dsh-web-ui family
		* group, bound to the plugin's own bridge settings scope.
		*
		* The interaction mirrors the host's model-provider page: one row per channel
		* (status dot + edit/delete), two add buttons (built-in provider / custom),
		* and an editor holding API key, display name, API URL, and the model catalog
		* with detection.
		*/
		/** Bridges the imagegen scope onto the card's staged forms. */
		var ImageGenSettingsCardController = class {
			scope;
			form;
			channelsForm;
			/** @param scope - the bound bridge scope for the dsh-imagegen namespace. */
			constructor(scope) {
				this.scope = scope;
				this.form = new CardForm(scope, [
					booleanField("enabled"),
					booleanField("announceToAgent"),
					booleanField("allowAgentImageGeneration"),
					textField("promptApiUrl"),
					secretField("promptApiKey"),
					textField("promptModel")
				], { secretSettled: () => this.scope.getSecretSetSnapshot("promptApiKey") });
				this.channelsForm = new ChannelsForm(scope);
			}
			projection() {
				const shell = this.form.shell();
				return {
					...shell,
					dirty: shell.dirty || this.channelsForm.snapshot().dirty,
					channels: this.channelsForm.snapshot(),
					enabled: this.form.field("enabled"),
					announceToAgent: this.form.field("announceToAgent"),
					allowAgentImageGeneration: this.form.field("allowAgentImageGeneration"),
					promptApiUrl: this.form.field("promptApiUrl"),
					promptApiKey: this.form.field("promptApiKey"),
					promptModel: this.form.field("promptModel")
				};
			}
			/**
			* Build the face the card's slot registration injects.
			* @returns the card's snapshot and the form/channel actions.
			*/
			inject() {
				const cardStore = this.form.bind(() => this.projection());
				this.channelsForm.subscribe(() => {
					cardStore.set(this.projection());
				});
				return {
					hooks: { imageGenSettingsCard: cardStore },
					channels: this.channelsForm.actions(),
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
			const [open, setOpen] = (0, react.useState)(false);
			const [promptModels, setPromptModels] = (0, react.useState)([]);
			const [loadingPromptModels, setLoadingPromptModels] = (0, react.useState)(false);
			const [promptModelsError, setPromptModelsError] = (0, react.useState)(null);
			const [manualPromptModelOpen, setManualPromptModelOpen] = (0, react.useState)(false);
			const [manualPromptModel, setManualPromptModel] = (0, react.useState)("");
			const [enhancementOpen, setEnhancementOpen] = (0, react.useState)(false);
			const [promptApiOpen, setPromptApiOpen] = (0, react.useState)(false);
			const [moreOpen, setMoreOpen] = (0, react.useState)(false);
			const [editingId, setEditingId] = (0, react.useState)(null);
			const [presetPickerOpen, setPresetPickerOpen] = (0, react.useState)(false);
			const [presets, setPresets] = (0, react.useState)([]);
			const [presetError, setPresetError] = (0, react.useState)(null);
			const [usage, setUsage] = (0, react.useState)(null);
			const [confirmDeleteId, setConfirmDeleteId] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!state.exposed) return;
				let alive = true;
				fetch(USAGE_API, { method: "POST" }).then(async (response) => {
					const body = await response.json();
					if (alive && body.ok === true && body.usage !== void 0) setUsage(body.usage);
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, [state.exposed]);
			if (!state.available) return null;
			const title = t("settings.title");
			const blocked = !state.dirty || state.invalid || state.saving || state.channels.saving;
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
			const channels = state.channels.channels;
			const editing = editingId === null ? void 0 : channels.find((channel) => channel.id === editingId);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: settings_card_module_css_default.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
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
					}),
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.body,
						children: [
							!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: settings_card_module_css_default.readOnly,
								role: "status",
								children: t("settings.readOnly")
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: settings_card_module_css_default.channelSection,
								"aria-label": t("channels.title"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: settings_card_module_css_default.sectionHeader,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
											className: settings_card_module_css_default.sectionTitle,
											children: t("channels.title")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: settings_card_module_css_default.sectionHint,
											children: t("channels.hint")
										})] })
									}),
									channels.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: settings_card_module_css_default.channelEmpty,
										children: t("channels.empty")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
										className: settings_card_module_css_default.channelList,
										children: channels.map((channel) => {
											const keyHeld = state.channels.keySet[channel.id] === true;
											const ready = keyHeld && channel.models.length > 0;
											const isDefault = channel.id === state.channels.defaultChannelId;
											if (confirmDeleteId === channel.id) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
												className: settings_card_module_css_default.channelRow,
												"data-action": true,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: settings_card_module_css_default.deleteConfirmText,
														children: t("channels.deleteConfirmTitle", { name: channel.name || t("channels.untitled") })
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: settings_card_module_css_default.channelDanger,
														disabled,
														onClick: () => {
															props.channels.setChannels(channels.filter((candidate) => candidate.id !== channel.id));
															if (isDefault && channels.length > 1) {
																const next = channels.find((candidate) => candidate.id !== channel.id);
																if (next !== void 0) props.channels.setDefaultChannel(next.id);
															}
															setConfirmDeleteId(null);
															if (editingId === channel.id) setEditingId(null);
														},
														children: t("channels.confirm")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: settings_card_module_css_default.channelAction,
														disabled,
														onClick: () => {
															setConfirmDeleteId(null);
														},
														children: t("channels.cancel")
													})
												]
											}, channel.id);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
												className: settings_card_module_css_default.channelRow,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: ready ? settings_card_module_css_default.channelDotReady : settings_card_module_css_default.channelDotWarn,
														"aria-hidden": "true",
														title: t(ready ? "channels.statusReady" : "channels.statusIncomplete")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: settings_card_module_css_default.channelMain,
														disabled,
														onClick: () => {
															setEditingId(channel.id);
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: settings_card_module_css_default.channelName,
															children: isDefault ? `★ ${channel.name || t("channels.untitled")}` : channel.name || t("channels.untitled")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: settings_card_module_css_default.channelMeta,
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: settings_card_module_css_default.channelBadge,
																"data-warn": !keyHeld || channel.models.length === 0 ? "" : void 0,
																children: [
																	keyHeld ? t("channels.keySet") : t("channels.keyMissing"),
																	" · ",
																	channel.models.length > 0 ? t("channels.modelCount", { n: channel.models.length }) : t("channels.noModels")
																]
															})
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: settings_card_module_css_default.channelAction,
														onClick: () => {
															setEditingId(channel.id);
														},
														children: t("channels.edit")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: settings_card_module_css_default.channelAction,
														"data-danger": true,
														onClick: () => {
															setConfirmDeleteId(channel.id);
														},
														children: t("channels.delete")
													})
												]
											}, channel.id);
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.channelControls,
										children: [open && presetPickerOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PresetPicker, {
											t,
											presets,
											error: presetError,
											disabled: state.writable === false,
											onLoad: () => {
												setPresetError(null);
												fetch(PRESETS_API, { method: "POST" }).then(async (response) => {
													const body = await response.json();
													if (!response.ok || body.ok !== true || body.presets === void 0) throw new Error(body.message ?? `HTTP ${response.status}`);
													setPresets(body.presets);
												}).catch((error) => {
													setPresetError(error instanceof Error ? error.message : String(error));
												});
											},
											onPick: (preset) => {
												const draft = newChannelDraft(preset);
												props.channels.setChannels([...channels, draft]);
												setPresetPickerOpen(false);
												setEditingId(draft.id);
											},
											onCustom: () => {
												const draft = newChannelDraft(void 0);
												props.channels.setChannels([...channels, draft]);
												setPresetPickerOpen(false);
												setEditingId(draft.id);
											},
											onClose: () => {
												setPresetPickerOpen(false);
											}
										}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: settings_card_module_css_default.channelAddRow,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: settings_card_module_css_default.channelAdd,
												disabled,
												onClick: () => {
													setPresetError(null);
													setPresetPickerOpen(true);
												},
												children: ["+ ", t("channels.addProvider")]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: settings_card_module_css_default.channelAdd,
												disabled,
												onClick: () => {
													addCustomChannel(channels, props.channels, setEditingId);
												},
												children: ["+ ", t("channels.addCustom")]
											})]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: settings_card_module_css_default.disclosure,
								"aria-expanded": enhancementOpen,
								onClick: () => {
									setEnhancementOpen((open) => !open);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.promptEnhanceTitle") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.optional") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										children: enhancementOpen ? "⌃" : "⌄"
									})
								]
							}),
							enhancementOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: settings_card_module_css_default.optionalContent,
								"aria-label": t("settings.promptEnhanceTitle"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: settings_card_module_css_default.sectionHint,
										children: t("settings.promptEnhanceHint")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.sectionHeader,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
											className: settings_card_module_css_default.sectionTitle,
											children: t("settings.promptModel")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: settings_card_module_css_default.sectionHint,
											children: t("settings.promptModelDetectionHint")
										})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: settings_card_module_css_default.modelFetch,
											disabled: disabled || loadingPromptModels,
											onClick: () => {
												setLoadingPromptModels(true);
												setPromptModelsError(null);
												fetch(PROMPT_ENHANCE_API.models, { method: "POST" }).then(async (response) => {
													const body = await response.json();
													if (!response.ok || body.ok !== true) throw new Error(body.message ?? `HTTP ${response.status}`);
													setPromptModels(body.models ?? []);
												}).catch((error) => {
													setPromptModelsError(error instanceof Error ? error.message : String(error));
												}).finally(() => {
													setLoadingPromptModels(false);
												});
											},
											children: loadingPromptModels ? t("settings.promptModelsLoading") : t("settings.promptModelsFetch")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.modelSummary,
										children: [state.promptModel.text.trim() !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: settings_card_module_css_default.modelChip,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: state.promptModel.text }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												disabled,
												"aria-label": `${t("settings.removeModel")}: ${state.promptModel.text}`,
												onClick: () => {
													props.edit("promptModel", "");
												},
												children: "×"
											})]
										}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: settings_card_module_css_default.addModel,
											disabled,
											onClick: () => {
												setManualPromptModelOpen((open) => !open);
												setEnhancementOpen(true);
											},
											children: manualPromptModelOpen ? t("settings.cancelAddModel") : t("settings.addModel")
										})]
									}),
									manualPromptModelOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.manualModelRow,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: settings_card_module_css_default.input,
											value: manualPromptModel,
											placeholder: t("settings.addPromptModelPlaceholder"),
											disabled,
											onChange: (event) => {
												setManualPromptModel(event.target.value);
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: settings_card_module_css_default.addModel,
											disabled: disabled || manualPromptModel.trim() === "",
											onClick: () => {
												props.edit("promptModel", manualPromptModel);
												setManualPromptModel("");
											},
											children: t("settings.addModelConfirm")
										})]
									}) : null,
									promptModels.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.modelCandidateList,
										role: "radiogroup",
										"aria-label": t("settings.promptModelsCandidates"),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: settings_card_module_css_default.modelCandidateLabel,
											children: t("settings.promptModelsCandidates")
										}), promptModels.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											role: "radio",
											className: settings_card_module_css_default.modelCandidate,
											"aria-checked": state.promptModel.text === candidate,
											"data-selected": state.promptModel.text === candidate ? "" : void 0,
											disabled,
											onClick: () => {
												props.edit("promptModel", candidate);
											},
											children: candidate
										}, candidate))]
									}) : null,
									promptModelsError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: settings_card_module_css_default.failed,
										role: "status",
										children: promptModelsError
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: settings_card_module_css_default.inlineDisclosure,
										"aria-expanded": promptApiOpen,
										onClick: () => {
											setPromptApiOpen((open) => !open);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.promptApiAdvanced") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											"aria-hidden": "true",
											children: promptApiOpen ? "⌃" : "⌄"
										})]
									}),
									promptApiOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.optionalContent,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
											id: "dsh-imagegen-settings-prompt-apiurl",
											label: t("settings.promptApiUrl"),
											hint: t("settings.promptApiUrlHint"),
											placeholder: "https://api.openai.com/v1",
											...fieldProps,
											...state.promptApiUrl,
											onEdit: (text) => {
												props.edit("promptApiUrl", text);
											},
											onReset: () => {
												props.resetField("promptApiUrl");
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
											id: "dsh-imagegen-settings-prompt-apikey",
											label: t("settings.promptApiKey"),
											hint: t("settings.promptApiKeyHint"),
											placeholder: "sk-…",
											secret: true,
											...fieldProps,
											...state.promptApiKey,
											overridden: false,
											onEdit: (text) => {
												props.edit("promptApiKey", text);
											},
											onReset: () => {
												props.resetField("promptApiKey");
											}
										})]
									}) : null
								]
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: settings_card_module_css_default.disclosure,
								"aria-expanded": moreOpen,
								onClick: () => {
									setMoreOpen((open) => !open);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.moreOptions") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									children: moreOpen ? "⌃" : "⌄"
								})]
							}),
							moreOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.optionalContent,
								children: [
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
										id: "dsh-imagegen-settings-agent-generation",
										label: t("settings.allowAgentImageGeneration"),
										hint: t("settings.allowAgentImageGenerationHint"),
										inheritLabel: t("settings.inherit"),
										onLabel: t("settings.on"),
										offLabel: t("settings.off"),
										...fieldProps,
										...state.allowAgentImageGeneration,
										onEdit: (text) => {
											props.edit("allowAgentImageGeneration", text);
										},
										onReset: () => {
											props.resetField("allowAgentImageGeneration");
										}
									})
								]
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.footer,
								children: [
									state.failed || state.channels.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: settings_card_module_css_default.failed,
										role: "status",
										children: t("settings.saveFailed")
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: settings_card_module_css_default.discard,
										disabled: !state.dirty || state.saving || state.channels.saving,
										onClick: () => {
											props.discard();
											props.channels.discard();
										},
										children: t("settings.discard")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: settings_card_module_css_default.save,
										disabled: blocked,
										onClick: () => {
											props.channels.commit();
											props.save();
										},
										children: t(!state.saving && !state.channels.saving ? "settings.save" : "settings.saving")
									})
								]
							})
						]
					}) : null,
					open && editing !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChannelEditor, {
						t,
						channel: editing,
						keyHeld: state.channels.keySet[editing.id] === true,
						usage,
						otherChannels: channels.filter((channel) => channel.id !== editing.id),
						isDefault: editing.id === state.channels.defaultChannelId,
						writable: state.writable,
						onPatch: (patch) => {
							replaceChannel(channels, editing.id, patch, props.channels);
						},
						onSetModels: (models) => {
							props.channels.setChannels(channels.map((channel) => channel.id === editing.id ? {
								...channel,
								models
							} : channel));
						},
						onSetKey: (value) => {
							props.channels.setChannelKey(editing.id, value);
						},
						onSetDefault: () => {
							props.channels.setDefaultChannel(editing.id);
						},
						onRemove: () => {
							props.channels.setChannels(channels.filter((channel) => channel.id !== editing.id));
							if (editing.id === state.channels.defaultChannelId && channels.length > 1) {
								const next = channels.find((channel) => channel.id !== editing.id);
								if (next !== void 0) props.channels.setDefaultChannel(next.id);
							}
							setEditingId(null);
						},
						onClose: () => {
							setEditingId(null);
						}
					}, editing.id) : null
				]
			});
		}
		/** Channel row + dialog helpers -------------------------------------------------- */
		function newChannelDraft(preset) {
			return {
				id: clientId(),
				preset: preset?.id ?? "",
				name: preset?.name ?? "",
				apiUrl: preset?.apiUrl ?? "",
				models: (preset?.models ?? []).map((model) => ({ ...model }))
			};
		}
		function addCustomChannel(channels, form, openEditor) {
			const draft = newChannelDraft(void 0);
			form.setChannels([...channels, draft]);
			openEditor(draft.id);
		}
		/** Patch one field (or models) of one staged channel. */
		function replaceChannel(channels, id, patch, form) {
			form.setChannels(channels.map((channel) => channel.id === id ? {
				...channel,
				...patch
			} : channel));
		}
		function clientId() {
			return (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : void 0) ?? `ch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		}
		/** Built-in provider picker, expanded inside the settings card. */
		function PresetPicker(props) {
			const { t } = props;
			const loadedRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (loadedRef.current) return;
				loadedRef.current = true;
				props.onLoad();
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: settings_card_module_css_default.presetInline,
				"aria-label": t("channels.presetPickerTitle"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: settings_card_module_css_default.presetInlineHeader,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: settings_card_module_css_default.sectionTitle,
						children: t("channels.presetPickerTitle")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.sectionHint,
						children: t("channels.presetPickerHint")
					})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: settings_card_module_css_default.editorClose,
						"aria-label": t("preview.close"),
						onClick: props.onClose,
						children: "×"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.presetList,
					children: [
						props.presets.map((preset) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: settings_card_module_css_default.presetRow,
							disabled: props.disabled,
							onClick: () => {
								props.onPick(preset);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.presetName,
								children: preset.name
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.presetMeta,
								children: preset.models.map((model) => model.alias).join(" · ")
							})]
						}, preset.id)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: settings_card_module_css_default.presetRow,
							"data-custom": true,
							disabled: props.disabled,
							onClick: props.onCustom,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: settings_card_module_css_default.presetName,
								children: ["+ ", t("channels.addCustom")]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.presetHint,
								children: t("channels.presetCustomHint")
							})]
						}),
						props.error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.failed,
							role: "status",
							children: t("channels.presetLoadFailed", { error: props.error })
						}) : null
					]
				})]
			});
		}
		/** Channel editor (modal): key, display name, API URL, model catalog. */
		function ChannelEditor(props) {
			const { t, channel } = props;
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const [candidates, setCandidates] = (0, react.useState)(null);
			const [detecting, setDetecting] = (0, react.useState)(false);
			const [detectError, setDetectError] = (0, react.useState)(null);
			const [manualId, setManualId] = (0, react.useState)("");
			const [removeOpen, setRemoveOpen] = (0, react.useState)(false);
			const [copyFrom, setCopyFrom] = (0, react.useState)("");
			const generatedCount = (alias) => {
				if (props.usage === null) return 0;
				return (props.usage.byChannel[channel.id] ?? props.usage.byChannel[`name:${channel.name}`] ?? {})[alias] ?? props.usage.totals[alias] ?? 0;
			};
			const detect = () => {
				setDetecting(true);
				setDetectError(null);
				const payload = { channelId: channel.id };
				if (channel.apiUrl.trim() !== "") payload.apiUrl = channel.apiUrl.trim();
				if (keyDraft.trim() !== "") payload.apiKey = keyDraft.trim();
				fetch(IMAGE_MODEL_API.models, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				}).then(async (response) => {
					const body = await response.json();
					if (!response.ok || body.ok !== true) throw new Error(body.message ?? `HTTP ${response.status}`);
					setCandidates(body.models ?? []);
				}).catch((error) => {
					setDetectError(error instanceof Error ? error.message : String(error));
				}).finally(() => {
					setDetecting(false);
				});
			};
			const autoDetected = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (autoDetected.current) return;
				autoDetected.current = true;
				if (channel.apiUrl.trim() !== "" && (props.keyHeld || keyDraft.trim() !== "")) detect();
			}, []);
			const addManual = () => {
				const id = manualId.trim();
				if (id === "") return;
				const next = [...channel.models];
				const alias = id;
				if (!next.some((model) => model.alias === alias)) next.push({
					alias,
					id
				});
				props.onSetModels(next);
				setManualId("");
			};
			const copyFromChannel = () => {
				const source = props.otherChannels.find((chance) => chance.id === copyFrom);
				if (source === void 0) return;
				const merged = [...channel.models];
				for (const model of source.models) {
					const alias = model.alias;
					let unique = alias;
					let suffix = 2;
					while (merged.some((entry) => entry.alias === unique)) unique = `${alias} (${suffix++})`;
					merged.push({
						alias: unique,
						id: model.id
					});
				}
				props.onSetModels(merged);
				setCopyFrom("");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.editorBackdrop,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": `${t("channels.editorTitle")} · ${channel.name || t("channels.untitled")}`,
				onClick: props.onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.editorPanel,
					onClick: (event) => {
						event.stopPropagation();
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: settings_card_module_css_default.editorHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
								className: settings_card_module_css_default.sectionTitle,
								children: [
									t("channels.editorTitle"),
									" · ",
									channel.name || t("channels.untitled")
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: settings_card_module_css_default.sectionHint,
								children: t("channels.editorSaveNote")
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.editorClose,
								"aria-label": t("preview.close"),
								onClick: props.onClose,
								children: "×"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.editorField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: settings_card_module_css_default.label,
								htmlFor: "dsh-imagegen-channel-name",
								children: t("channels.displayName")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: "dsh-imagegen-channel-name",
								className: settings_card_module_css_default.input,
								value: channel.name,
								placeholder: t("channels.untitled"),
								disabled: !props.writable,
								onChange: (event) => {
									props.onPatch({ name: event.target.value });
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.editorField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: settings_card_module_css_default.label,
								htmlFor: "dsh-imagegen-channel-url",
								children: t("channels.apiUrl")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: "dsh-imagegen-channel-url",
								className: settings_card_module_css_default.input,
								value: channel.apiUrl,
								placeholder: "https://api.example.com/v1",
								disabled: !props.writable,
								onChange: (event) => {
									props.onPatch({ apiUrl: event.target.value });
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.editorField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.head,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: settings_card_module_css_default.label,
									htmlFor: "dsh-imagegen-channel-key",
									children: t("channels.apiKey")
								}), props.keyHeld || keyDraft !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.reset,
									disabled: !props.writable,
									onClick: () => {
										setKeyDraft("");
										props.onSetKey(void 0);
									},
									children: t("channels.keyClear")
								}) : null]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: "dsh-imagegen-channel-key",
								className: settings_card_module_css_default.input,
								type: "password",
								autoComplete: "off",
								value: keyDraft,
								placeholder: props.keyHeld ? t("channels.keyReplaceHint") : t("channels.keyMissingHint"),
								disabled: !props.writable,
								onChange: (event) => {
									const value = event.target.value;
									setKeyDraft(value);
									props.onSetKey(value === "" ? void 0 : value);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: settings_card_module_css_default.editorDivider }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.editorSectionHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
								className: settings_card_module_css_default.label,
								children: t("channels.modelCatalogTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.modelFetch,
								disabled: !props.writable || detecting,
								onClick: detect,
								children: detecting ? t("channels.detecting") : t("channels.detect")
							})]
						}),
						detectError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.failed,
							role: "status",
							children: t("channels.detectFailed", { error: detectError })
						}) : null,
						candidates !== null && detectError === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.detectOk,
							role: "status",
							children: t("channels.detectSuccess", { n: candidates.length })
						}) : null,
						channel.models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.sectionHint,
							children: t("channels.noModelsHint")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: settings_card_module_css_default.modelRows,
							children: channel.models.map((model, index) => {
								const entry = describeModel(model.id || model.alias);
								const generated = generatedCount(model.alias);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
									className: settings_card_module_css_default.modelRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.modelRowInputs,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: settings_card_module_css_default.input,
												value: model.alias,
												"aria-label": t("channels.modelAliasLabel"),
												disabled: !props.writable,
												onChange: (event) => {
													const next = [...channel.models];
													next[index] = {
														...model,
														alias: event.target.value
													};
													props.onSetModels(next);
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: settings_card_module_css_default.modelArrow,
												children: "→"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: settings_card_module_css_default.input,
												value: model.id,
												"aria-label": t("channels.modelIdLabel"),
												disabled: !props.writable,
												onChange: (event) => {
													const next = [...channel.models];
													next[index] = {
														...model,
														id: event.target.value
													};
													props.onSetModels(next);
												}
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.modelRowBadges,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: settings_card_module_css_default.modelBadge,
												children: [entry.labelZh, entry.known ? "" : ` · ${t("channels.unknownProtocol")}`]
											}),
											generated > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: settings_card_module_css_default.modelBadge,
												"data-verified": true,
												children: t("channels.generated", { n: generated })
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: settings_card_module_css_default.modelRowRemove,
												disabled: !props.writable,
												"aria-label": `${t("channels.removeModel")}: ${model.alias}`,
												onClick: () => {
													props.onSetModels(channel.models.filter((_, i) => i !== index));
												},
												children: "×"
											})
										]
									})]
								}, `${model.alias}-${index}`);
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.editorTools,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.manualModelRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: settings_card_module_css_default.input,
									value: manualId,
									placeholder: t("channels.manualAddPlaceholder"),
									disabled: !props.writable,
									onChange: (event) => {
										setManualId(event.target.value);
									},
									onKeyDown: (event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											addManual();
										}
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.addModel,
									disabled: !props.writable || manualId.trim() === "",
									onClick: addManual,
									children: t("channels.addModelConfirm")
								})]
							}), props.otherChannels.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.manualModelRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: settings_card_module_css_default.modelChoices,
									value: copyFrom,
									disabled: !props.writable,
									onChange: (event) => {
										setCopyFrom(event.target.value);
									},
									"aria-label": t("channels.copyFrom"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("channels.copyFrom")
									}), props.otherChannels.map((other) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: other.id,
										children: other.name || t("channels.untitled")
									}, other.id))]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.addModel,
									disabled: !props.writable || copyFrom === "",
									onClick: copyFromChannel,
									children: t("channels.copyApply")
								})]
							}) : null]
						}),
						candidates !== null && candidates.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.modelCandidateList,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.modelCandidateLabel,
								children: t("channels.candidatesTitle")
							}), candidates.map((candidate) => {
								const selected = channel.models.some((model) => model.alias === candidate);
								const entry = describeModel(candidate);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: settings_card_module_css_default.modelCandidate,
									"data-selected": selected ? "" : void 0,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: selected,
											disabled: !props.writable,
											onChange: () => {
												const merged = selected ? channel.models.filter((model) => model.alias !== candidate) : [...channel.models, {
													alias: candidate,
													id: candidate
												}];
												props.onSetModels(merged);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: candidate }),
										!entry.known ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: settings_card_module_css_default.modelBadge,
											"data-warn": true,
											children: t("channels.unknownProtocol")
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: settings_card_module_css_default.modelBadge,
											children: entry.labelZh
										})
									]
								}, candidate);
							})]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: settings_card_module_css_default.editorDivider }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.editorFooter,
							children: [
								props.isDefault ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: settings_card_module_css_default.channelBadge,
									"data-default": true,
									children: t("channels.defaultLabel")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.inlineDisclosure,
									disabled: !props.writable,
									onClick: props.onSetDefault,
									children: t("channels.setDefault")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: settings_card_module_css_default.spacer }),
								removeOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.channelDanger,
									disabled: !props.writable,
									onClick: props.onRemove,
									children: t("channels.confirm")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.channelAction,
									onClick: () => {
										setRemoveOpen(false);
									},
									children: t("channels.cancel")
								})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.channelAction,
									"data-danger": true,
									onClick: () => {
										setRemoveOpen(true);
									},
									children: t("channels.deleteThisChannel")
								})
							]
						})
					]
				})
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
		//#region \0dsh-css:E:\dsh-plugin\src\client\image-toolview.module.css.mjs
		const css = "._3eGrYG_root{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex-direction:column;gap:7px;margin:4px 0;padding:8px 10px 10px;display:flex}._3eGrYG_header{min-height:20px;color:var(--dsw-alias-label-secondary);align-items:center;gap:7px;font-size:12px;display:flex}._3eGrYG_icon{color:var(--dsw-alias-brand-primary);font-size:15px;line-height:1}._3eGrYG_status{color:var(--dsw-alias-label-tertiary);margin-left:auto;font-size:11px}._3eGrYG_message,._3eGrYG_loading,._3eGrYG_error{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;margin:0;font-size:12px;line-height:1.5}._3eGrYG_images{flex-wrap:wrap;gap:8px;display:flex}._3eGrYG_imageLink{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:6px;max-width:min(280px,100%);display:block;overflow:hidden}._3eGrYG_imageLink:hover{border-color:var(--dsw-alias-brand-primary)}._3eGrYG_image{object-fit:contain;width:auto;max-width:280px;height:auto;max-height:220px;display:block}._3eGrYG_error{color:var(--dsw-alias-state-error-primary)}";
		const tagId = "@dickpy/dsh-imagegen/image-toolview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dickpy/dsh-imagegen";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var image_toolview_module_css_default = {
			"imageLink": "_3eGrYG_imageLink",
			"error": "_3eGrYG_error",
			"root": "_3eGrYG_root",
			"loading": "_3eGrYG_loading",
			"images": "_3eGrYG_images",
			"header": "_3eGrYG_header",
			"image": "_3eGrYG_image",
			"status": "_3eGrYG_status",
			"icon": "_3eGrYG_icon",
			"message": "_3eGrYG_message"
		};
		//#endregion
		//#region src/client/image-toolview.tsx
		function isSettled(block) {
			return "kind" in block;
		}
		function imageRefsOf(block) {
			if (!isSettled(block)) return [];
			return block.content.flatMap((content) => content.type === "image" ? [content.attachment] : []);
		}
		function textOf(block) {
			if (!isSettled(block)) return "";
			return block.content.filter((content) => content.type === "text").map((content) => content.text).join("\n");
		}
		function resultInfo(block) {
			if (!isSettled(block)) return {
				status: "running",
				message: "正在生成图片…"
			};
			const text = textOf(block);
			try {
				const parsed = JSON.parse(text);
				return {
					status: typeof parsed.status === "string" ? parsed.status : block.isError ? "failed" : "completed",
					message: typeof parsed.message === "string" ? parsed.message : ""
				};
			} catch {
				return {
					status: block.isError ? "failed" : "completed",
					message: text
				};
			}
		}
		function statusLabel(status) {
			if (status === "running" || status === "queued") return "生成中";
			if (status === "failed") return "生成失败";
			if (status === "cancelled") return "已取消";
			return "图片结果";
		}
		function useAttachmentImages(sessionId, refs, load) {
			const key = (0, react.useMemo)(() => refs.map((ref) => String(ref.attachmentId)).join("|"), [refs]);
			const [images, setImages] = (0, react.useState)([]);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let disposed = false;
				const urls = [];
				const revoke = () => {
					for (const url of urls) URL.revokeObjectURL(url);
					urls.length = 0;
				};
				setImages([]);
				setError(null);
				if (refs.length === 0) return () => {};
				Promise.all(refs.map(async (ref) => {
					const src = await load(sessionId, ref);
					urls.push(src);
					return {
						ref,
						src
					};
				})).then((next) => {
					if (!disposed) setImages(next);
				}).catch((errorValue) => {
					revoke();
					if (!disposed) setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
				});
				return () => {
					disposed = true;
					revoke();
				};
			}, [
				key,
				load,
				refs,
				sessionId
			]);
			return {
				images,
				error
			};
		}
		/** Register the inline image result view for all image-generation result tools. */
		function registerImageToolviews(ctx) {
			const load = async (_sessionId, ref) => {
				const query = new URLSearchParams({
					attachment_id: String(ref.attachmentId),
					media_type: ref.mediaType,
					bytes: String(ref.bytes),
					width: String(ref.width),
					height: String(ref.height)
				});
				const response = await fetch(`${AGENT_IMAGE_API}?${query.toString()}`);
				if (!response.ok) throw new Error(`无法读取图片附件（HTTP ${response.status}）。`);
				const blob = await response.blob();
				return URL.createObjectURL(blob);
			};
			const ImageToolView = (props) => {
				const refs = (0, react.useMemo)(() => imageRefsOf(props.block), [props.block]);
				const { status, message } = resultInfo(props.block);
				const { images, error } = useAttachmentImages(props.sessionId, refs, load);
				(0, react.useEffect)(() => {
					if (images.length === 0) return;
					document.dispatchEvent(new CustomEvent(CHAT_IMAGE_EVENT, { detail: {
						sessionId: props.sessionId,
						refs: images.map((image) => image.ref)
					} }));
				}, [images, props.sessionId]);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: image_toolview_module_css_default.root,
					"data-state": status,
					"data-tool": props.toolName,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: image_toolview_module_css_default.header,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: image_toolview_module_css_default.icon,
									"aria-hidden": "true",
									children: "▧"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: props.toolName }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: image_toolview_module_css_default.status,
									children: statusLabel(status)
								})
							]
						}),
						message !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: image_toolview_module_css_default.message,
							children: message
						}),
						images.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: image_toolview_module_css_default.images,
							children: images.map((image) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								className: image_toolview_module_css_default.imageLink,
								href: image.src,
								rel: "noreferrer",
								target: "_blank",
								title: "打开原图",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									className: image_toolview_module_css_default.image,
									src: image.src,
									alt: image.ref.name ?? "生成图片"
								})
							}, String(image.ref.attachmentId)))
						}),
						refs.length > 0 && images.length === 0 && error === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: image_toolview_module_css_default.loading,
							children: "正在加载图片…"
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: image_toolview_module_css_default.error,
							children: error
						})
					]
				});
			};
			ctx.slots.inject("tool.call.toolview", function* () {
				for (const key of [
					"generate_image",
					"edit_image",
					"get_image_generation_task"
				]) yield ctx.slots.register({
					name: "tool.call.toolview",
					key,
					inject: (sessionId) => ({ sessionId })
				}, ImageToolView);
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace this plugin owns. */
		const NS = "dsh-imagegen";
		/** Required services (fiber inject waiting — the runtime must be up first). */
		const inject = [
			"slots",
			"locale",
			"connection",
			"sessions",
			"conversation"
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
			registerImageToolviews(ctx);
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
				key: "dsh-imagegen",
				locale: NS,
				inject: () => settingsCard.inject()
			}, ImageGenSettingsCard));
			let uiDisposer;
			const mountUi = () => {
				if (uiDisposer !== void 0) return;
				const controller = new ImageGenController();
				const api = new ImageGenApi();
				const sessions = ctx.get("sessions");
				const conversation = ctx.get("conversation");
				const disposers = [];
				try {
					disposers.push(mountSidebarEntry(controller, tt("entry.newSession"), tt("entry.newSessionTooltip"), tt("entry.image"), tt("entry.tooltip")));
					disposers.push(mountPanel(controller, api, scope, {
						sessions,
						conversation
					}));
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