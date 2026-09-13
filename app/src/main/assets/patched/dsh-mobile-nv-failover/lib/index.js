// dsh-mobile-nv-failover (host half)
//
// Goal: let a phone-side DSH session drive NVIDIA NIM
// (https://integrate.api.nvidia.com/v1) chat-completions through a pool of
// up to 64 nvapi- keys, with transparent round-robin + failover. The keys
// NEVER leave the device — they live in
// ~/.dsh/dsh-mobile-nv-failover/keys.json (mode 0600), seeded by the user
// pasting into the settings card. The APK ships zero key material.
//
// Endpoints exposed via @deepseek-ai/dsh-host-webserver:
//   GET  /nv-failover/status    -> { enabled, keyCount, model, stats, ... }
//   POST /nv-failover/settings  -> { keys, baseUrl?, model?, enabled? }
//   POST /nv-failover/proxy     -> OpenAI-compatible chat-completions body
//
// Tools exposed to the agent:
//   nv_failover_status            — read current pool state
//   nv_failover_list_keys         — list key previews (no full keys)
//   nv_failover_replace_keys      — replace the entire pool from text/array

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { defineTool } from '@deepseek-ai/dsh-tools';

export const name = 'dsh-mobile-nv-failover';
export const inject = ['tools', 'host'];

const DEFAULTS = {
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'meta/llama-3.1-70b-instruct',
  enabled: false,
};

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}
function pluginDir() { return path.join(dshHome(), name); }
function keysPath() { return path.join(pluginDir(), 'keys.json'); }
function settingsPath() { return path.join(pluginDir(), 'settings.json'); }
function statsPath() { return path.join(pluginDir(), 'stats.json'); }

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, p);
  try { fs.chmodSync(p, 0o600); } catch { /* Windows / non-POSIX */ }
}

function normalizeKeys(raw) {
  const out = [];
  const seen = new Set();
  for (const line of String(raw || '').split(/\r?\n/)) {
    const k = line.trim();
    if (!k || k.startsWith('#')) continue;
    if (!k.startsWith('nvapi-')) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= 64) break;
  }
  return out;
}

function loadAll() {
  const keys = normalizeKeys(readJson(keysPath(), []));
  const settings = { ...DEFAULTS, ...readJson(settingsPath(), {}) };
  const stats = readJson(statsPath(), {
    totalRequests: 0,
    successRequests: 0,
    failuresByKey: {},
    lastError: null,
    lastSuccessAt: null,
  });
  return { keys, settings, stats };
}

function saveStats(stats) { writeJsonAtomic(statsPath(), stats); }

// Tries every key once per call. Skips on 401/403/404/429/5xx; bails on 400/413.
async function callUpstream({ body, baseUrl, model, keys, signal }) {
  const reqBody = { ...body, model: body.model || model };
  const tried = [];
  const failuresByKey = {};

  for (const key of keys) {
    tried.push(key.slice(0, 12) + '…');
    let res;
    try {
      res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(reqBody),
        signal,
      });
    } catch {
      failuresByKey[key] = (failuresByKey[key] || 0) + 1;
      continue;
    }
    if (res.ok) return { response: res, usedKey: key, tried, failuresByKey };
    failuresByKey[key] = (failuresByKey[key] || 0) + 1;
    if (res.status === 400 || res.status === 413) {
      const text = await res.text();
      const err = new Error(`upstream 4xx (${res.status}): ${text.slice(0, 200)}`);
      err.code = 'BAD_REQUEST';
      throw err;
    }
  }
  const err = new Error(`all ${keys.length} keys failed: ${tried.join(',')}`);
  err.code = 'EXHAUSTED';
  err.triedKeys = tried;
  err.failuresByKey = failuresByKey;
  throw err;
}

export function apply(ctx) {
  // ----- HTTP routes ---------------------------------------------------------
  ctx.host.route('GET', '/nv-failover/status', async (_req, res) => {
    const { keys, settings, stats } = loadAll();
    res.json({
      enabled: !!settings.enabled,
      keyCount: keys.length,
      keys: keys.map((k) => ({ preview: k.slice(0, 12) + '…' + k.slice(-4), length: k.length })),
      baseUrl: settings.baseUrl,
      model: settings.model,
      stats,
      pluginId: name,
    });
  });

  ctx.host.route('POST', '/nv-failover/settings', async (req, res) => {
    let payload = {};
    try { payload = await req.json(); } catch { /* empty body allowed */ }
    const settings = loadAll().settings;
    if (typeof payload.baseUrl === 'string' && payload.baseUrl.trim()) settings.baseUrl = payload.baseUrl.trim();
    if (typeof payload.model === 'string' && payload.model.trim()) settings.model = payload.model.trim();
    if (typeof payload.enabled === 'boolean') settings.enabled = payload.enabled;
    writeJsonAtomic(settingsPath(), settings);
    let keyCount = loadAll().keys.length;
    if (Array.isArray(payload.keys) || typeof payload.keysText === 'string') {
      const raw = Array.isArray(payload.keys) && payload.keys.length ? payload.keys.join('\n') : (payload.keysText || '');
      const keys = normalizeKeys(raw);
      writeJsonAtomic(keysPath(), keys);
      keyCount = keys.length;
    }
    res.json({ ok: true, keyCount, enabled: settings.enabled, model: settings.model });
  });

  ctx.host.route('POST', '/nv-failover/proxy', async (req, res) => {
    let body;
    try { body = await req.json(); } catch { res.status(400).json({ error: 'invalid json' }); return; }
    const { keys, settings, stats } = loadAll();
    if (!settings.enabled) {
      res.status(403).json({ error: 'plugin disabled — toggle in settings', code: 'DISABLED' });
      return;
    }
    stats.totalRequests = (stats.totalRequests || 0) + 1;
    try {
      const { response, usedKey, tried, failuresByKey } = await callUpstream({
        body, baseUrl: settings.baseUrl, model: settings.model, keys,
        signal: AbortSignal.timeout(180_000),
      });
      stats.successRequests = (stats.successRequests || 0) + 1;
      stats.lastSuccessAt = Date.now();
      Object.assign(stats.failuresByKey, failuresByKey);
      saveStats(stats);
      const ct = response.headers.get('content-type') || '';
      res.setHeader('content-type', ct);
      res.setHeader('x-nv-failover-used-key', usedKey.slice(0, 12));
      if (ct.includes('text/event-stream')) {
        const reader = response.body.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) { res.end(); return; }
          if (!res.write(Buffer.from(value))) await new Promise((r) => res.once('drain', r));
        }
      } else {
        const text = await response.text();
        res.status(response.status).send(text);
      }
    } catch (e) {
      stats.lastError = { message: e.message, code: e.code || 'UNKNOWN', at: Date.now(), triedKeys: e.triedKeys };
      Object.assign(stats.failuresByKey, e.failuresByKey || {});
      saveStats(stats);
      const status = e.code === 'NO_KEYS' ? 503 : e.code === 'BAD_REQUEST' ? 400 : 502;
      res.status(status).json({ error: e.message, code: e.code, triedKeys: e.triedKeys });
    }
  });

  // ----- Tools ---------------------------------------------------------------
  const register = (tool) => ctx.plugin(tool);

  register(defineTool({
    name: 'nv_failover_status',
    description: 'Read dsh-mobile-nv-failover status: enabled flag, key count, current model/baseUrl, and aggregate stats (total/success requests, per-key failure count, last error, last success timestamp).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const { keys, settings, stats } = loadAll();
      return { enabled: !!settings.enabled, keyCount: keys.length, baseUrl: settings.baseUrl, model: settings.model, stats };
    },
  }));

  register(defineTool({
    name: 'nv_failover_list_keys',
    description: 'List configured nvapi- keys as previews (first 12 + last 4 chars only — never the full key).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      const { keys } = loadAll();
      return { count: keys.length, keys: keys.map((k) => ({ preview: k.slice(0, 12) + '…' + k.slice(-4) })) };
    },
  }));

  register(defineTool({
    name: 'nv_failover_replace_keys',
    description: 'Replace the entire nvapi- key pool. Accepts `keys` (string array) or `keysText` (newline-separated string). Empty lines and lines not starting with "nvapi-" are ignored. Persists to ~/.dsh/dsh-mobile-nv-failover/keys.json (mode 0600). Optional `enable` toggles the plugin.',
    parameters: {
      type: 'object',
      properties: {
        keys: { type: 'array', items: { type: 'string' } },
        keysText: { type: 'string' },
        enable: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    execute: async ({ keys, keysText, enable } = {}) => {
      const raw = Array.isArray(keys) && keys.length ? keys.join('\n') : (keysText || '');
      const normalized = normalizeKeys(raw);
      writeJsonAtomic(keysPath(), normalized);
      if (typeof enable === 'boolean') {
        const settings = loadAll().settings;
        settings.enabled = enable;
        writeJsonAtomic(settingsPath(), settings);
      }
      return {
        ok: true,
        keyCount: normalized.length,
        enabled: typeof enable === 'boolean' ? enable : loadAll().settings.enabled,
      };
    },
  }));
}
