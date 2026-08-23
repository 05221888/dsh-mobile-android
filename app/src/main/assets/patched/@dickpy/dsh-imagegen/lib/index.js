import { SettingsConflictError, installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "schemastery";
import { randomUUID } from "node:crypto";
import { promises } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
//#region src/protocol.ts
/**
* Wire contract shared by the host and client halves of dsh-imagegen: the
* settings namespace, the route paths, and the generate payload/result shapes.
* Pure types + constants — safe for the client bundle to inline.
*/
/** Settings namespace this plugin owns (host settings seam + bridge). */
const IMAGEGEN_SETTINGS_NAMESPACE = "dsh-imagegen";
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
//#region src/engine.ts
/** A generation failure with a user-presentable message. */
var ImageGenError = class extends Error {
	/** Stable wire code. */
	code;
	constructor(message, code = "generate-failed") {
		super(message);
		this.name = "ImageGenError";
		this.code = code;
	}
};
/** Total budget for the upstream generation call (image models are slow). */
const UPSTREAM_TIMEOUT_MS = 24e4;
/** Budget for downloading one result image URL. */
const IMAGE_FETCH_TIMEOUT_MS = 6e4;
/** Cap on the reference image payload (edit mode), in bytes. */
const MAX_EDIT_IMAGE_BYTES = 10 * 1024 * 1024;
/** Sizes dall-e-3 accepts; anything else falls back to its square default. */
const DALLE3_SIZES = /* @__PURE__ */ new Set([
	"1024x1024",
	"1792x1024",
	"1024x1792"
]);
/** Content-type extension hints for URL-fetched images. */
function mimeOfExtension(path) {
	const match = /\.([a-z0-9]+)$/i.exec(path);
	if (match === null) return void 0;
	switch (match[1].toLowerCase()) {
		case "png": return "image/png";
		case "jpg":
		case "jpeg": return "image/jpeg";
		case "webp": return "image/webp";
		case "gif": return "image/gif";
		default: return;
	}
}
/** Parse `data:<mime>;base64,<payload>` into its parts; undefined when malformed. */
function parseDataUrl(dataUrl) {
	const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl.trim());
	if (match === null || match[3] === void 0) return void 0;
	if (match[2] === void 0) return;
	return {
		mime: match[1] ?? "application/octet-stream",
		base64: match[3]
	};
}
/** Strip a data: prefix from an upstream b64 payload if a gateway added one. */
function bareBase64(value) {
	const parsed = parseDataUrl(value);
	return parsed !== void 0 && parsed.base64 !== void 0 ? parsed.base64 : value;
}
/** Clamp the requested image count into the API-accepted range. */
function clampCount(n) {
	if (!Number.isFinite(n)) return 1;
	return Math.min(4, Math.max(1, Math.round(n)));
}
/** Pick the effective per-model request parameters. Never includes `n`: the
*  batch parameter is rejected by Responses-API-based gateways (tools[0].n),
*  so the count is satisfied by parallel single-image requests instead. */
function effectiveParams(request) {
	const model = request.model.trim() === "" ? "fal-ai/gpt-image-2" : request.model.trim();
	if (model === "dall-e-3") return {
		model,
		size: DALLE3_SIZES.has(request.size) ? request.size : "1024x1024"
	};
	return {
		model,
		...request.size !== "" && request.size !== "auto" ? { size: request.size } : {},
		...request.quality !== "" && request.quality !== "auto" ? { quality: request.quality } : {},
		...request.detail !== "" ? { detail: request.detail } : {}
	};
}
/** How many single-image requests to issue for the requested image count. */
function effectiveCount(request) {
	if ((request.model.trim() === "" ? "fal-ai/gpt-image-2" : request.model.trim()) === "dall-e-3") return 1;
	return clampCount(request.n);
}
/** Normalize one upstream data item into a base64 image. */
async function normalizeItem(item, upstream) {
	const revisedPrompt = typeof item.revised_prompt === "string" ? item.revised_prompt : void 0;
	if (typeof item.b64_json === "string") return {
		b64: bareBase64(item.b64_json),
		mime: "image/png",
		revisedPrompt
	};
	if (typeof item.url !== "string" || item.url === "") throw new ImageGenError("upstream image item has neither b64_json nor url");
	const url = item.url;
	if (url.startsWith("data:")) {
		const parsed = parseDataUrl(url);
		if (parsed === void 0) throw new ImageGenError("upstream returned a malformed data: url");
		return {
			b64: parsed.base64,
			mime: parsed.mime,
			revisedPrompt
		};
	}
	let response;
	try {
		response = await fetch(url, {
			headers: { ...upstream.apiKey === "" ? {} : { authorization: `Bearer ${upstream.apiKey}` } },
			signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS)
		});
	} catch (error) {
		throw new ImageGenError(`failed to fetch the generated image url: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!response.ok) throw new ImageGenError(`failed to fetch the generated image url: HTTP ${response.status}`);
	const buffer = Buffer.from(await response.arrayBuffer());
	const contentType = response.headers.get("content-type");
	const mime = contentType !== null && contentType !== "" ? contentType.split(";")[0].trim() : mimeOfExtension(url) ?? "image/png";
	return {
		b64: buffer.toString("base64"),
		mime,
		revisedPrompt
	};
}
/**
* Issue one single-image request (never sends `n`). The response is kept as a
* list so a gateway that happens to return several images per call still works.
*/
async function requestOneImage(baseUrl, upstream, request, params) {
	const headers = { authorization: `Bearer ${upstream.apiKey.trim()}` };
	let body;
	if (request.mode === "edit") {
		if (typeof request.image !== "string" || request.image === "") throw new ImageGenError("图生图需要上传参考图片", "edit-image-missing");
		const parsed = parseDataUrl(request.image);
		if (parsed === void 0) throw new ImageGenError("参考图片格式无效", "edit-image-invalid");
		let bytes;
		try {
			bytes = Buffer.from(parsed.base64, "base64");
		} catch {
			throw new ImageGenError("参考图片数据无法解码", "edit-image-invalid");
		}
		if (bytes.byteLength > MAX_EDIT_IMAGE_BYTES) throw new ImageGenError("参考图片超过 10MB 上限", "edit-image-too-large");
		const form = new FormData();
		form.append("image", new Blob([bytes], { type: parsed.mime }), `reference.${extensionOf$1(parsed.mime)}`);
		form.append("prompt", request.prompt);
		form.append("model", params.model);
		if (params.size !== void 0) form.append("size", params.size);
		if (params.quality !== void 0) form.append("quality", params.quality);
		if (params.detail !== void 0) form.append("detail", params.detail);
		body = form;
	} else {
		headers["content-type"] = "application/json";
		body = JSON.stringify({
			prompt: request.prompt,
			...params
		});
	}
	let response;
	try {
		response = await fetch(`${baseUrl}/images/${request.mode === "edit" ? "edits" : "generations"}`, {
			method: "POST",
			headers,
			body,
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (/aborter/i.test(message) || /timeout/i.test(message)) throw new ImageGenError("上游接口响应超时（240 秒）", "upstream-timeout");
		throw new ImageGenError(`无法连接上游接口：${message}`, "upstream-unreachable");
	}
	let payload;
	try {
		payload = await response.json();
	} catch {
		throw new ImageGenError(`上游接口返回了非 JSON 响应（HTTP ${response.status}）`, "upstream-invalid");
	}
	if (!response.ok || payload === null || typeof payload !== "object") throw new ImageGenError(upstreamMessage(payload, response.status), "upstream-rejected");
	const record = payload;
	const data = Array.isArray(record.data) ? record.data : Array.isArray(record.images) ? record.images : Array.isArray(record.output) ? record.output : void 0;
	if (data === void 0) throw new ImageGenError("上游响应缺少 data 数组", "upstream-invalid");
	if (data.length === 0) throw new ImageGenError("上游返回了 0 张图片", "upstream-empty");
	return Promise.all(data.map(async (entry) => {
		if (entry === null || typeof entry !== "object") throw new ImageGenError("上游响应包含无效的图片条目", "upstream-invalid");
		return normalizeItem(entry, upstream);
	}));
}
/**
* Forward one generate request to the configured endpoint. The requested image
* count is satisfied with N parallel single-image requests (the `n` batch
* parameter is never sent, because Responses-API-based gateways reject it as
* `tools[0].n`), then the results are flattened in order.
*/
async function generateImage(upstream, request) {
	const baseUrl = upstream.apiUrl.trim().replace(/\/+$/, "");
	if (baseUrl === "") throw new ImageGenError("api_url 未配置：请先在「设置 → 插件 → 可配置」中填写", "config-missing");
	if (upstream.apiKey.trim() === "") throw new ImageGenError("api_key 未配置：请先在「设置 → 插件 → 可配置」中填写", "config-missing");
	const params = effectiveParams(request);
	const count = effectiveCount(request);
	return { images: (await Promise.all(Array.from({ length: count }, () => requestOneImage(baseUrl, upstream, request, params)))).flat() };
}
/** Human-readable failure message from an upstream error payload. */
function upstreamMessage(payload, status) {
	if (payload !== null && typeof payload === "object") {
		const record = payload;
		const error = record.error;
		if (error !== null && typeof error === "object") {
			const message = error.message;
			if (typeof message === "string" && message !== "") return message;
		}
		if (typeof record.message === "string" && record.message !== "") return record.message;
		if (typeof record.error === "string" && record.error !== "") return record.error;
	}
	return `上游接口拒绝请求（HTTP ${status}）`;
}
/** File extension for a MIME type (multipart reference image). */
function extensionOf$1(mime) {
	switch (mime.split(";")[0].trim()) {
		case "image/jpeg": return "jpg";
		case "image/webp": return "webp";
		case "image/gif": return "gif";
		default: return "png";
	}
}
//#endregion
//#region src/history-store.ts
/**
* Host-persisted generation history: images are stored as individual files
* under ~/.dsh/dsh-imagegen/images/ and an index.json keeps the metadata +
* file names. This makes the history survive across browsers/devices that
* connect to the same DSH host, and keeps list responses small (the browser
* loads image bytes lazily through the history image route).
*
* Framework-free (node:fs only) so the route layer can drive it directly.
*/
const HISTORY_DIR = path.join(homedir(), ".dsh", "dsh-imagegen");
const INDEX_PATH = path.join(HISTORY_DIR, "index.json");
const IMAGES_DIR = path.join(HISTORY_DIR, "images");
let pendingMutation = Promise.resolve();
function mutateHistory(operation) {
	const next = pendingMutation.then(operation, operation);
	pendingMutation = next.then(() => void 0, () => void 0);
	return next;
}
/** File extension for a MIME type (image file names). */
function extensionOf(mime) {
	switch (mime.split(";")[0].trim()) {
		case "image/jpeg": return "jpg";
		case "image/webp": return "webp";
		case "image/gif": return "gif";
		default: return "png";
	}
}
/** MIME type for a stored image file name (image route responses). */
function mimeOfFile(file) {
	switch (path.extname(file).toLowerCase()) {
		case ".jpg":
		case ".jpeg": return "image/jpeg";
		case ".webp": return "image/webp";
		case ".gif": return "image/gif";
		default: return "image/png";
	}
}
/** Sanitize an entry id for use as a file-name prefix. */
function safeId(id) {
	const cleaned = id.replace(/[^a-zA-Z0-9-]/g, "-");
	return cleaned === "" ? "entry" : cleaned;
}
/** Ensure the storage directories exist. */
async function ensureDirs() {
	await promises.mkdir(IMAGES_DIR, { recursive: true });
}
/** Read the index, tolerating a missing/corrupt file. */
async function readIndex() {
	try {
		const raw = await promises.readFile(INDEX_PATH, "utf8");
		const parsed = JSON.parse(raw);
		if (parsed === null || typeof parsed !== "object") return [];
		const entries = parsed.entries;
		if (!Array.isArray(entries)) return [];
		return entries.filter(isStoredEntry);
	} catch {
		return [];
	}
}
/** Persist the index. */
async function writeIndex(entries) {
	await ensureDirs();
	const payload = { entries };
	const tmp = `${INDEX_PATH}.tmp-${process.pid}`;
	await promises.writeFile(tmp, JSON.stringify(payload), "utf8");
	await promises.rename(tmp, INDEX_PATH);
}
/** Structural guard for a stored entry. */
function isStoredEntry(value) {
	if (value === null || typeof value !== "object") return false;
	const entry = value;
	return typeof entry.id === "string" && typeof entry.createdAt === "number" && (entry.mode === "text" || entry.mode === "edit") && typeof entry.prompt === "string" && Array.isArray(entry.images) && entry.images.every((image) => {
		if (image === null || typeof image !== "object") return false;
		const record = image;
		return typeof record.file === "string" && typeof record.mime === "string";
	});
}
/** Remove one entry's image files (best effort). */
async function removeEntryFiles(entry) {
	for (const image of entry.images) try {
		await promises.rm(path.join(IMAGES_DIR, image.file), { force: true });
	} catch {}
}
/** Project a stored entry onto the wire shape (image URLs). */
function toWire(entry) {
	return {
		id: entry.id,
		createdAt: entry.createdAt,
		mode: entry.mode,
		model: entry.model,
		prompt: entry.prompt,
		size: entry.size,
		quality: entry.quality,
		detail: entry.detail,
		n: entry.n,
		images: entry.images.map((image) => ({
			url: `/api/dsh-imagegen/history/image/${image.file}`,
			mime: image.mime,
			...image.revisedPrompt === void 0 ? {} : { revisedPrompt: image.revisedPrompt }
		})),
		...entry.refName === void 0 ? {} : { refName: entry.refName }
	};
}
/** List the persisted history, newest first, as wire entries. */
async function listHistory() {
	return (await readIndex()).map(toWire);
}
/** Append one generation, evicting the oldest beyond HISTORY_MAX. */
async function appendHistory(input) {
	return mutateHistory(async () => {
		await ensureDirs();
		const prefix = safeId(input.id);
		const storedImages = [];
		try {
			for (let index = 0; index < input.images.length; index++) {
				const image = input.images[index];
				const file = `${prefix}-${index}.${extensionOf(image.mime)}`;
				await promises.writeFile(path.join(IMAGES_DIR, file), Buffer.from(image.b64, "base64"));
				storedImages.push({
					file,
					mime: image.mime,
					...image.revisedPrompt === void 0 ? {} : { revisedPrompt: image.revisedPrompt }
				});
			}
		} catch (error) {
			await removeEntryFiles({ images: storedImages });
			throw error;
		}
		const merged = [{
			id: input.id,
			createdAt: input.createdAt,
			mode: input.mode,
			model: input.model,
			prompt: input.prompt,
			size: input.size,
			quality: input.quality,
			detail: input.detail,
			n: input.n,
			images: storedImages,
			...input.refName === void 0 ? {} : { refName: input.refName }
		}, ...await readIndex()];
		const kept = merged.slice(0, 50);
		for (const dropped of merged.slice(50)) await removeEntryFiles(dropped);
		await writeIndex(kept);
		return kept.map(toWire);
	});
}
/** Remove one entry (and its image files). */
async function removeHistory(id) {
	return mutateHistory(async () => {
		const previous = await readIndex();
		const target = previous.find((entry) => entry.id === id);
		if (target !== void 0) await removeEntryFiles(target);
		const kept = previous.filter((entry) => entry.id !== id);
		await writeIndex(kept);
		return kept.map(toWire);
	});
}
/** Remove every entry (and all image files). */
async function clearHistory() {
	return mutateHistory(async () => {
		const previous = await readIndex();
		for (const entry of previous) await removeEntryFiles(entry);
		await writeIndex([]);
		return [];
	});
}
/** Read one stored image file by its (validated) file name. */
async function readHistoryImage(file) {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*-[0-9]+\.(png|jpg|jpeg|webp|gif)$/.test(file)) return void 0;
	try {
		return {
			data: await promises.readFile(path.join(IMAGES_DIR, file)),
			mime: mimeOfFile(file)
		};
	} catch {
		return;
	}
}
//#endregion
//#region src/updater.ts
/** GitHub Release discovery and explicit, user-triggered plugin updates. */
/** Keep this in sync with package.json for each published release. */
const CURRENT_VERSION = PLUGIN_VERSION;
const PACKAGE_NAME = "@dickpy/dsh-imagegen";
const RELEASES_URL = "https://api.github.com/repos/dickpy/dsh-imagegen/releases/latest";
const CHECK_TIMEOUT_MS = 1e4;
const CACHE_TTL_MS = 15 * 6e4;
let cached;
/** Compare stable semver triples; returns positive when `left` is newer. */
function compareVersions(left, right) {
	const parse = (value) => {
		const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
		if (match === null) return [
			0,
			0,
			0
		];
		return [
			Number(match[1]),
			Number(match[2]),
			Number(match[3])
		];
	};
	const a = parse(left);
	const b = parse(right);
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
function normalizedReleaseVersion(tag) {
	if (typeof tag !== "string" || !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag.trim())) return void 0;
	return tag.trim().replace(/^v/, "");
}
/** Read the latest stable GitHub Release, with a short host-side cache. */
async function checkForUpdate(fetchFn = fetch, now = Date.now()) {
	if (cached !== void 0 && cached.expiresAt > now) return cached.value;
	const response = await fetchFn(RELEASES_URL, {
		headers: {
			accept: "application/vnd.github+json",
			"user-agent": "dsh-imagegen-update-check"
		},
		signal: AbortSignal.timeout(CHECK_TIMEOUT_MS)
	});
	if (!response.ok) throw new Error(`GitHub Releases returned HTTP ${response.status}`);
	const payload = await response.json();
	if (payload === null || typeof payload !== "object") throw new Error("GitHub Releases returned malformed JSON");
	const release = payload;
	if (release.draft === true || release.prerelease === true) throw new Error("latest GitHub Release is not stable");
	const latestVersion = normalizedReleaseVersion(release.tag_name);
	if (latestVersion === void 0) throw new Error("latest GitHub Release has an invalid version tag");
	const releaseUrl = typeof release.html_url === "string" ? release.html_url : "https://github.com/dickpy/dsh-imagegen/releases";
	const value = {
		currentVersion: CURRENT_VERSION,
		latestVersion,
		updateAvailable: compareVersions(latestVersion, CURRENT_VERSION) > 0,
		releaseUrl,
		...typeof release.published_at === "string" ? { publishedAt: release.published_at } : {}
	};
	cached = {
		expiresAt: now + CACHE_TTL_MS,
		value
	};
	return value;
}
/** Resolve the profile that launched the current DSH process. */
function profileFromProcess(argv = process.argv, env = process.env) {
	const envProfile = env.DSH_PROFILE?.trim();
	if (envProfile !== void 0 && /^[a-zA-Z0-9_-]+$/.test(envProfile)) return envProfile;
	const profileIndex = argv.indexOf("--profile");
	const explicit = profileIndex >= 0 ? argv[profileIndex + 1]?.trim() : void 0;
	if (explicit !== void 0 && /^[a-zA-Z0-9_-]+$/.test(explicit)) return explicit;
	if (argv.includes("web")) return "web";
	return "web";
}
/** Run the same official command documented for plugin installation. */
function installUpdate(version, spawnFn = spawn, argv = process.argv, env = process.env) {
	if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) return Promise.reject(/* @__PURE__ */ new Error("invalid update version"));
	const profile = profileFromProcess(argv, env);
	const child = spawnFn(process.platform === "win32" ? "dsh.cmd" : "dsh", [
		"plugin",
		"--profile",
		profile,
		"add",
		`${PACKAGE_NAME}@${version}`
	], {
		shell: process.platform === "win32",
		stdio: "ignore"
	});
	return new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) resolve();
			else reject(/* @__PURE__ */ new Error(signal === null ? `plugin update exited with code ${code ?? "unknown"}` : `plugin update terminated by ${signal}`));
		});
	});
}
/** Test helper: clear the host-side Release cache. */
function clearUpdateCache() {
	cached = void 0;
}
//#endregion
//#region src/profiles-store.ts
/** Host-side persistence for selectable image-generation profiles. */
const DIR = path.join(homedir(), ".dsh", "dsh-imagegen");
const FILE = path.join(DIR, "profiles.json");
let tail = Promise.resolve();
function serialize(operation) {
	const next = tail.then(operation, operation);
	tail = next.then(() => void 0, () => void 0);
	return next;
}
function valid(value) {
	if (value === null || typeof value !== "object") return false;
	const p = value;
	return typeof p.id === "string" && typeof p.name === "string" && typeof p.apiUrl === "string" && typeof p.model === "string" && typeof p.apiKey === "string";
}
async function readAll() {
	try {
		const parsed = JSON.parse(await promises.readFile(FILE, "utf8"));
		return parsed !== null && typeof parsed === "object" && Array.isArray(parsed.profiles) ? parsed.profiles.filter(valid) : [];
	} catch {
		return [];
	}
}
async function writeAll(profiles) {
	await promises.mkdir(DIR, { recursive: true });
	await promises.writeFile(FILE, JSON.stringify({ profiles }, null, 2), "utf8");
}
function publicProfile(profile) {
	return {
		id: profile.id,
		name: profile.name,
		apiUrl: profile.apiUrl,
		model: profile.model,
		keySet: profile.apiKey.trim() !== ""
	};
}
/** Migrate the old single endpoint/key into one selectable profile once. */
async function ensureLegacyProfile(legacy) {
	return serialize(async () => {
		let profiles = await readAll();
		if (profiles.length === 0 && (legacy.apiUrl.trim() !== "" || legacy.apiKey.trim() !== "")) {
			profiles = [{
				id: "legacy-default",
				name: "默认配置",
				apiUrl: legacy.apiUrl.trim(),
				model: "fal-ai/gpt-image-2",
				apiKey: legacy.apiKey
			}];
			await writeAll(profiles);
		}
		return profiles.map(publicProfile);
	});
}
async function saveProfile(input, legacy) {
	return serialize(async () => {
		let profiles = await readAll();
		const id = input.id?.trim() || randomUUID();
		const existing = profiles.find((profile) => profile.id === id);
		const apiKey = input.apiKey?.trim() || existing?.apiKey || (profiles.length === 0 ? legacy?.apiKey ?? "" : "");
		const profile = {
			id,
			name: input.name.trim() || "默认配置",
			apiUrl: input.apiUrl.trim(),
			model: input.model.trim() || "fal-ai/gpt-image-2",
			apiKey
		};
		profiles = existing === void 0 ? [...profiles, profile] : profiles.map((item) => item.id === id ? profile : item);
		await writeAll(profiles);
		return profiles.map(publicProfile);
	});
}
async function removeProfile(id) {
	return serialize(async () => {
		const profiles = (await readAll()).filter((profile) => profile.id !== id);
		await writeAll(profiles);
		return profiles.map(publicProfile);
	});
}
async function resolveProfile(id, legacy) {
	const profiles = await readAll();
	const selected = id === void 0 ? void 0 : profiles.find((profile) => profile.id === id);
	if (selected !== void 0) return {
		apiUrl: selected.apiUrl,
		apiKey: selected.apiKey,
		model: selected.model
	};
	return legacy;
}
//#endregion
//#region src/routes.ts
/** Cap on JSON request bodies (settings ops and generate payloads are small). */
const MAX_JSON_BODY_BYTES = 24 * 1024 * 1024;
/** Cap on history append bodies (base64 result images can be much larger). */
const MAX_HISTORY_BODY_BYTES = 64 * 1024 * 1024;
/** Loopback literal check plus browser same-origin markers (mirrors dsh-ssh). */
function isLoopbackRequest(request) {
	const address = request.socket.remoteAddress;
	if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL(`http://${host}`);
	} catch {
		return false;
	}
	if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** One JSON response. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(payload);
}
/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > maxBytes) return void 0;
		chunks.push(buffer);
	}
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		return typeof parsed === "object" && parsed !== null ? parsed : void 0;
	} catch {
		return;
	}
}
/** Human-readable text from an unknown thrown value. */
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
/** Validate a submitted history entry (images carry base64). */
function parseHistoryEntryInput(body) {
	const raw = body.entry;
	if (raw === null || typeof raw !== "object") return void 0;
	const entry = raw;
	if (typeof entry.id !== "string" || typeof entry.createdAt !== "number") return void 0;
	if (entry.mode !== "text" && entry.mode !== "edit") return void 0;
	if (typeof entry.model !== "string" || typeof entry.prompt !== "string") return void 0;
	if (typeof entry.size !== "string" || typeof entry.quality !== "string" || typeof entry.detail !== "string") return void 0;
	if (typeof entry.n !== "number") return void 0;
	if (!Array.isArray(entry.images)) return void 0;
	const images = [];
	for (const item of entry.images) {
		if (item === null || typeof item !== "object") return void 0;
		const image = item;
		if (typeof image.b64 !== "string" || typeof image.mime !== "string") return void 0;
		images.push({
			b64: image.b64,
			mime: image.mime,
			...typeof image.revisedPrompt === "string" ? { revisedPrompt: image.revisedPrompt } : {}
		});
	}
	return {
		id: entry.id,
		createdAt: entry.createdAt,
		mode: entry.mode,
		model: entry.model,
		prompt: entry.prompt,
		size: entry.size,
		quality: entry.quality,
		detail: entry.detail,
		n: entry.n,
		images,
		...typeof entry.refName === "string" ? { refName: entry.refName } : {}
	};
}
/** Extract the image file name from a history-image request URL. */
function imageFileFrom(rawUrl, basePath) {
	if (rawUrl === void 0) return void 0;
	let pathname;
	try {
		pathname = new URL(rawUrl, "http://localhost").pathname;
	} catch {
		return;
	}
	if (!pathname.startsWith(`${basePath}/`)) return void 0;
	return decodeURIComponent(pathname.slice(basePath.length + 1));
}
/** Project one settings descriptor onto the bridge wire view. */
function toView(descriptor) {
	return {
		ns: String(descriptor.ns),
		schema: descriptor.schema,
		value: descriptor.value,
		...descriptor.base === void 0 ? {} : { base: descriptor.base },
		...descriptor.user === void 0 ? {} : { user: descriptor.user },
		...descriptor.secrets === void 0 ? {} : { secrets: descriptor.secrets.map((secret) => ({
			path: [...secret.path],
			set: secret.set
		})) },
		revision: descriptor.revision
	};
}
/** Map a seam failure onto the bridge refusal envelope. */
function failureOf(error) {
	if (error instanceof SettingsConflictError) return {
		ok: false,
		code: "settings-conflict",
		message: error.message
	};
	return {
		ok: false,
		code: "settings-rejected",
		message: error instanceof Error ? error.message : String(error)
	};
}
/**
* Build every /api/dsh-imagegen route.
* @param deps - settings seam + config resolver.
* @returns the route registrations.
*/
function makeRoutes(deps) {
	const history = deps.history ?? {
		list: listHistory,
		append: appendHistory,
		remove: removeHistory,
		clear: clearHistory,
		readImage: readHistoryImage
	};
	const guard = (req, res, method) => {
		if (!isLoopbackRequest(req)) {
			writeJson(res, 403, { error: "forbidden: loopback-only" });
			return false;
		}
		if (req.method !== method) {
			writeJson(res, 405, { error: `method not allowed: ${req.method}` });
			return false;
		}
		return true;
	};
	return [
		{
			kind: "exact",
			path: PROFILES_API.list,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				try {
					writeJson(res, 200, {
						ok: true,
						profiles: await ensureLegacyProfile(deps.resolve())
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "profiles-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: PROFILES_API.save,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const raw = (await readJsonBody(req))?.profile;
				if (raw === null || typeof raw !== "object") {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "profile is required"
					});
					return;
				}
				const value = raw;
				const input = {
					...typeof value.id === "string" ? { id: value.id } : {},
					name: typeof value.name === "string" ? value.name : "",
					apiUrl: typeof value.apiUrl === "string" ? value.apiUrl : "",
					model: typeof value.model === "string" ? value.model : "",
					...typeof value.apiKey === "string" ? { apiKey: value.apiKey } : {}
				};
				if (input.name.trim() === "" || input.apiUrl.trim() === "" || input.model.trim() === "") {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "name, apiUrl and model are required"
					});
					return;
				}
				try {
					writeJson(res, 200, {
						ok: true,
						profiles: await saveProfile(input, deps.resolve())
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "profiles-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: PROFILES_API.remove,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = typeof body?.id === "string" ? body.id.trim() : "";
				if (id === "") {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "profile id is required"
					});
					return;
				}
				try {
					writeJson(res, 200, {
						ok: true,
						profiles: await removeProfile(id)
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "profiles-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: SETTINGS_API.describe,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const descriptor = deps.settings.describe({ redactSecrets: true }).find((candidate) => String(candidate.ns) === IMAGEGEN_SETTINGS_NAMESPACE);
				writeJson(res, 200, {
					ok: true,
					value: {
						namespaces: descriptor === void 0 ? [] : [toView(descriptor)],
						writable: deps.settings.writable !== false
					}
				});
			}
		},
		{
			kind: "exact",
			path: SETTINGS_API.mutate,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				if (body === void 0) {
					writeJson(res, 200, {
						ok: false,
						code: "settings-rejected",
						message: "unreadable JSON body"
					});
					return;
				}
				const ns = typeof body.ns === "string" ? body.ns : "";
				if (ns !== "dsh-imagegen" || !Array.isArray(body.ops)) {
					writeJson(res, 200, {
						ok: false,
						code: "settings-rejected",
						message: "malformed bridge settings request"
					});
					return;
				}
				const expectedRevision = typeof body.expectedRevision === "number" ? body.expectedRevision : void 0;
				try {
					await deps.settings.mutate(settingsNamespace(ns), body.ops, expectedRevision);
				} catch (error) {
					writeJson(res, 200, failureOf(error));
					return;
				}
				const descriptor = deps.settings.describe({ redactSecrets: true }).find((candidate) => String(candidate.ns) === ns);
				if (descriptor === void 0) {
					writeJson(res, 200, {
						ok: false,
						code: "internal",
						message: `settings namespace "${ns}" was disposed after the mutate`
					});
					return;
				}
				writeJson(res, 200, {
					ok: true,
					value: toView(descriptor)
				});
			}
		},
		{
			kind: "exact",
			path: GENERATE_API,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				if (body === void 0) {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "unreadable JSON body"
					});
					return;
				}
				const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
				if (prompt === "") {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "prompt is required"
					});
					return;
				}
				if (prompt.length > 2e3) {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "prompt exceeds 2000 characters"
					});
					return;
				}
				const profileId = typeof body.profileId === "string" ? body.profileId.trim() : void 0;
				const request = {
					mode: body.mode === "edit" ? "edit" : "text",
					...profileId === void 0 || profileId === "" ? {} : { profileId },
					model: typeof body.model === "string" ? body.model : "fal-ai/gpt-image-2",
					prompt,
					size: typeof body.size === "string" ? body.size : "auto",
					quality: typeof body.quality === "string" ? body.quality : "auto",
					n: typeof body.n === "number" ? body.n : 1,
					detail: typeof body.detail === "string" ? body.detail : "",
					...typeof body.image === "string" && body.image !== "" ? { image: body.image } : {},
					...typeof body.refName === "string" && body.refName !== "" ? { refName: body.refName } : {}
				};
				try {
					const upstream = await resolveProfile(request.profileId, deps.resolve());
					if (upstream.model !== void 0 && (typeof body.model !== "string" || body.model.trim() === "")) request.model = upstream.model;
					const result = await generateImage(upstream, request);
					try {
						const entries = await history.append({
							id: randomUUID(),
							createdAt: Date.now(),
							mode: request.mode,
							model: request.model,
							prompt: request.prompt,
							size: request.size,
							quality: request.quality,
							detail: request.detail,
							n: request.n,
							images: result.images,
							...request.refName === void 0 ? {} : { refName: request.refName }
						});
						writeJson(res, 200, {
							ok: true,
							...result,
							history: entries
						});
					} catch (error) {
						writeJson(res, 200, {
							ok: true,
							...result,
							historyError: messageOf(error)
						});
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					writeJson(res, 200, {
						ok: false,
						code: error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "generate-failed",
						message
					});
				}
			}
		},
		{
			kind: "exact",
			path: UPDATE_API.check,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				try {
					writeJson(res, 200, {
						ok: true,
						update: await checkForUpdate()
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "update-check-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: UPDATE_API.apply,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const version = body !== void 0 && typeof body.version === "string" ? body.version.trim() : "";
				if (version === "") {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "update version is required"
					});
					return;
				}
				try {
					const latest = await checkForUpdate();
					if (!latest.updateAvailable || latest.latestVersion !== version) {
						writeJson(res, 200, {
							ok: false,
							code: "update-not-available",
							message: `version ${version} is not the latest available release`
						});
						return;
					}
					await installUpdate(version);
					writeJson(res, 200, {
						ok: true,
						currentVersion: CURRENT_VERSION,
						updatedVersion: version,
						restartRequired: true
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "update-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: HISTORY_API.list,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				try {
					writeJson(res, 200, {
						ok: true,
						entries: await history.list()
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "history-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: HISTORY_API.append,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req, MAX_HISTORY_BODY_BYTES);
				if (body === void 0) {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "unreadable JSON body"
					});
					return;
				}
				const entry = parseHistoryEntryInput(body);
				if (entry === void 0) {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "malformed history entry"
					});
					return;
				}
				try {
					writeJson(res, 200, {
						ok: true,
						entries: await history.append(entry)
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "history-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: HISTORY_API.remove,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body !== void 0 && typeof body.id === "string" ? body.id : "";
				if (id === "") {
					writeJson(res, 200, {
						ok: false,
						code: "bad-request",
						message: "history id is required"
					});
					return;
				}
				try {
					writeJson(res, 200, {
						ok: true,
						entries: await history.remove(id)
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "history-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: HISTORY_API.clear,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				try {
					writeJson(res, 200, {
						ok: true,
						entries: await history.clear()
					});
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "history-failed",
						message: messageOf(error)
					});
				}
			}
		},
		{
			kind: "prefix",
			path: HISTORY_API.image,
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, { error: "forbidden: loopback-only" });
					return;
				}
				if (req.method !== "GET") {
					writeJson(res, 405, { error: `method not allowed: ${req.method}` });
					return;
				}
				const file = imageFileFrom(req.url, HISTORY_API.image);
				if (file === void 0) {
					writeJson(res, 404, { error: "not found" });
					return;
				}
				const found = await history.readImage(file);
				if (found === void 0) {
					writeJson(res, 404, { error: "not found" });
					return;
				}
				res.writeHead(200, {
					"content-type": found.mime,
					"content-length": found.data.length,
					"cache-control": "private, max-age=3600"
				});
				res.end(found.data);
			}
		}
	];
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name. */
const name = "imagegen";
/** Services required before the surfaces can mount. */
const inject = ["webServer", "systemPrompt"];
/** The branded settings namespace of this plugin (the card edits it). */
const ImageGenSettingsNamespace = settingsNamespace(IMAGEGEN_SETTINGS_NAMESPACE);
const Config = z.object({
	enabled: z.boolean().default(true),
	announceToAgent: z.boolean().default(true),
	apiUrl: z.string().default(""),
	apiKey: z.string().role("secret").default("")
});
/** Schema defaults, re-read for hand-built contexts (the loader applies them normally). */
const DEFAULT_ENABLED = true;
const DEFAULT_ANNOUNCE = true;
/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150;
/** Model-facing announcement: plugin presence, capabilities, and limits. */
const IMAGEGEN_GUIDANCE = "本机已安装 dsh-imagegen 插件（DSH AI 生图）：侧边栏「AI 生图」入口。能力：对接 OpenAI 兼容图像生成 API（模型 gpt-image-2），支持文生图（/images/generations）与图生图（/images/edits，上传参考图）；API 地址与密钥在 GUI「设置 → 插件 → 可配置」中配置，密钥仅存于本机设置文档；生成请求由本地宿主代理转发，结果以 base64 返回面板，可预览与下载。限制：生成消耗上游 API 额度；图片内容由上游模型生成，可能不符合预期或包含不适宜内容；api_key 以明文存储在设置文档中；参考图会发送至所配置的 API 服务。用户提到「生图 / 绘画 / 生成图片 / gpt-image-2 / 文生图 / 图生图」时即指本插件，请据此协作。";
/**
* Mount the settings section, routes, and announcement.
* @param ctx - host plugin context carrying webServer/systemPrompt.
* @param config - resolved plugin config (schema defaults applied by the loader).
*/
function apply(ctx, config) {
	let current = () => config ?? {};
	const resolve = () => {
		const value = current();
		return {
			enabled: value.enabled ?? DEFAULT_ENABLED,
			announceToAgent: value.announceToAgent ?? DEFAULT_ANNOUNCE,
			apiUrl: value.apiUrl ?? "",
			apiKey: value.apiKey ?? ""
		};
	};
	ctx.inject(["settings"], (sctx) => {
		const seam = sctx.get("settings");
		sctx.effect(() => {
			const disposers = makeRoutes({
				settings: seam,
				resolve: () => {
					const value = resolve();
					return {
						apiUrl: value.apiUrl,
						apiKey: value.apiKey
					};
				}
			}).map((route) => ctx.webServer.register(route));
			return () => {
				for (const dispose of disposers) dispose();
			};
		}, "dsh-imagegen: routes");
	});
	let disposeSection;
	const sync = () => {
		if (disposeSection !== void 0) {
			disposeSection();
			disposeSection = void 0;
		}
		const value = resolve();
		if (!value.enabled || !value.announceToAgent) return;
		disposeSection = ctx.systemPrompt.section({
			name: "plugin:dsh-imagegen",
			order: SECTION_ORDER,
			text: IMAGEGEN_GUIDANCE
		});
	};
	installSettingsSection(ctx, ImageGenSettingsNamespace, Config, config ?? {}, {
		setSource: (source) => {
			current = source;
			sync();
		},
		onChange: sync
	});
	sync();
}
//#endregion
export { CURRENT_VERSION, Config, IMAGEGEN_GUIDANCE, ImageGenError, ImageGenSettingsNamespace, apply, checkForUpdate, clearUpdateCache, compareVersions, generateImage, inject, installUpdate, makeRoutes, name, profileFromProcess };

//# sourceMappingURL=index.js.map