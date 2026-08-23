// dsh-memory-sync: minimal Gitee OpenAPI v5 client (pure Node fetch, no deps).
//
// Uses the contents API so neither end needs a git binary — important for
// the Android APK engine. Token is passed per-call from local config and
// never leaves the machine except to gitee.com itself.

const API = 'https://gitee.com/api/v5';
const MAX_FILE_BYTES = 900 * 1024; // contents-API friendly ceiling

export class GiteeError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function createGitee({ owner, repo, branch = 'master', token, timeoutMs = 30000 }) {
  if (!owner || !repo || !token) {
    throw new GiteeError('gitee config requires owner/repo/token', 0);
  }
  const authQS = `access_token=${encodeURIComponent(token)}`;

  async function request(path, init = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${API}${path}`, { ...init, signal: ctrl.signal });
      const bodyText = await res.text();
      let body = null;
      try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = bodyText; }
      if (!res.ok) {
        const msg =
          (body && (body.message || JSON.stringify(body))) ||
          `HTTP ${res.status}`;
        throw new GiteeError(`gitee ${init.method || 'GET'} ${path}: ${msg}`, res.status);
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  /** GET one file → { sha, buffer } | null when absent (404). */
  async function getContent(path) {
    const p = path.split('/').map(encodeURIComponent).join('/');
    let data;
    try {
      data = await request(`/repos/${owner}/${repo}/contents/${p}?ref=${branch}&${authQS}`);
    } catch (e) {
      if (e instanceof GiteeError && e.status === 404) return null;
      throw e;
    }
    if (!data || data.type !== 'file') return null;
    const b64 = String(data.content || '').replace(/\s/g, '');
    return { sha: data.sha, size: data.size ?? b64.length, buffer: Buffer.from(b64, 'base64') };
  }

  /** Create-or-update one file. Gitee splits this: POST = create (no sha),
   *  PUT = update (sha required). Returns { sha, path }. */
  async function putContent(path, buffer, message, sha) {
    if (buffer.length > MAX_FILE_BYTES) {
      throw new GiteeError(
        `file ${path} is ${(buffer.length / 1024).toFixed(0)}KB, over ${MAX_FILE_BYTES / 1024}KB contents-API limit`,
        0,
      );
    }
    const p = path.split('/').map(encodeURIComponent).join('/');
    const body = {
      access_token: token,
      content: buffer.toString('base64'),
      message,
      branch,
    };
    const method = sha ? 'PUT' : 'POST';
    if (sha) body.sha = sha;
    const data = await request(`/repos/${owner}/${repo}/contents/${p}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { sha: data?.content?.sha ?? null, path };
  }

  /** GET one dir listing → [{ name, path, type, size, sha }] | null on 404. */
  async function listDir(path = '') {
    const p = path ? path.split('/').map(encodeURIComponent).join('/') : '';
    const qs = `${p ? '/' + p : ''}?ref=${branch}&per_page=100&${authQS}`;
    try {
      return await request(`/repos/${owner}/${repo}/contents${qs}`);
    } catch (e) {
      if (e instanceof GiteeError && e.status === 404) return null;
      throw e;
    }
  }

  return { getContent, putContent, listDir, branch, MAX_FILE_BYTES };
}
