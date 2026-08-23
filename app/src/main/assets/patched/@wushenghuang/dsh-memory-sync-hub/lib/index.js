// dsh-memory-sync (host half): cross-device memory relay over a private
// Gitee repo. Desktop PC and mobile APK both load this plugin and talk to
// the same repo; neither needs a git binary — pure fetch.
//
// Tools:
//   memory_sync_status — compare local ~/.dsh/memories with the remote repo
//   memory_sync_pull   — download remote changes, entry-merge into local files
//                        (backup first), so mobile can absorb desktop memory
//   memory_sync_push   — merge remote into local then upload everything,
//                        plus the installed-plugin manifest so the other end
//                        can discover "what plugins does that side have?"
//
// Config lives at ~/.dsh/dsh-memory-sync/config.json (git-ignored by design):
// { "gitee": { "owner", "repo", "branch", "token" }, "device": "desktop-pc" }

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';

// NOTE: the "?cachebust=N" query breaks the in-process ESM module cache after
// hot edits (cordis reload clears only the entry URL). Bump N when gitee.js
// or merge.js changes; harmless on normal installs including mobile.
import { createGitee, GiteeError } from './gitee.js?cachebust=4';
import { isEntryStyle, unionMerge } from './merge.js?cachebust=2';
import { collectSyncFiles, isExcludedRel, scanProfiles } from './manifest.js?cachebust=3';
import { inboxPath, parseJsonl, appendMessage, ackMessage, makeMessage, formatInbox } from './mailbox.js?cachebust=1';

const name = 'dsh-memory-sync';
const inject = ['tools'];

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}
function memoriesRoot() {
  return path.join(dshHome(), 'memories');
}
function profilesDir() {
  return path.join(dshHome(), 'profiles');
}
function configPath() {
  return path.join(dshHome(), 'dsh-memory-sync', 'config.json');
}

function readConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `missing config ${p} — create it with:\n` +
      JSON.stringify(
        {
          gitee: { owner: '<your-gitee-user>', repo: 'dsh-memory-hub', branch: 'master', token: '<private token>' },
          device: os.hostname().toLowerCase(),
        },
        null,
        2,
      ),
    );
  }
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!cfg?.gitee?.owner || !cfg?.gitee?.repo || !cfg?.gitee?.token) {
    throw new Error(`incomplete config at ${p}: gitee.owner/repo/token are required`);
  }
  cfg.device ||= os.hostname().toLowerCase();
  cfg.gitee.branch ||= 'master';
  return cfg;
}

/** Resolve relPath inside root; refuse traversal. Returns absolute path or throws. */
function safeJoin(root, relPath) {
  if (!relPath || path.isAbsolute(relPath) || relPath.split(/[\\/]/).includes('..')) {
    throw new Error(`unsafe relative path: ${relPath}`);
  }
  const abs = path.resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`path escapes memories root: ${relPath}`);
  }
  return abs;
}

/** Snapshot every file we are about to overwrite into the backup dir. */
function backupFiles(files) {
  if (files.length === 0) return '';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(dshHome(), 'memories-sync-backup', stamp);
  for (const rel of files) {
    const src = safeJoin(memoriesRoot(), rel);
    const dst = safeJoin(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    try { fs.copyFileSync(src, dst); } catch { /* vanished mid-run */ }
  }
  return dir;
}

async function buildStatus(gitee) {
  const localFiles = collectSyncFiles(memoriesRoot());
  const localSet = new Map();
  for (const rel of localFiles) {
    let mtime = '';
    try { mtime = fs.statSync(safeJoin(memoriesRoot(), rel)).mtime.toISOString().slice(0, 16); } catch {}
    localSet.set(rel, mtime);
  }
  // walk the remote tree (repo root mirrors the memories layout)
  const remoteFiles = new Map();
  const queue = [''];
  while (queue.length > 0) {
    const dir = queue.shift();
    const entries = await gitee.listDir(dir);
    if (!entries) continue;
    for (const e of entries) {
      if (e.type === 'dir') queue.push(e.path);
      else remoteFiles.set(e.path, e.size ?? 0);
    }
  }
  const onlyLocal = [...localSet.keys()].filter((f) => !remoteFiles.has(f));
  const onlyRemote = [...remoteFiles.keys()].filter((f) => !localSet.has(f));
  const bothDiffer = [];
  for (const [rel, mtime] of localSet) {
    if (!remoteFiles.has(rel)) continue;
    const localBuf = fs.readFileSync(safeJoin(memoriesRoot(), rel));
    const remote = await gitee.getContent(rel);
    if (remote && !remote.buffer.equals(localBuf)) bothDiffer.push(rel);
  }
  return { localCount: localSet.size, remoteCount: remoteFiles.size, onlyLocal, onlyRemote, bothDiffer };
}

function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'memory_sync_status',
    description: 'Compare local DSH memories (~/.dsh/memories) with the shared Gitee hub repo: lists files only-local, only-remote, and differing. Read-only.',
    parameters: {},
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }]; } },
    async execute() {
      try {
        const cfg = readConfig();
        const gitee = createGitee(cfg.gitee);
        const s = await buildStatus(gitee);
        const lines = [
          `device=${cfg.device} branch=${cfg.gitee.branch}`,
          `local files: ${s.localCount}, remote files: ${s.remoteCount}`,
        ];
        const list = (title, arr) => lines.push(`${title} (${arr.length}):`, ...(arr.length ? arr.map((x) => `  - ${x}`) : ['  (none)']));
        list('only on this device (push will upload)', s.onlyLocal);
        list('only on the hub (pull will download)', s.onlyRemote);
        list('both sides differ (merge needed)', s.bothDiffer);
        return lines.join('\n');
      } catch (e) {
        return `status failed: ${e.message}`;
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'memory_sync_pull',
    description: 'Pull shared memory from the Gitee hub into this device: downloads remote-only files and entry-level merges differing markdown tracks (backup saved first). Use dryRun to preview.',
    parameters: {
      dryRun: { type: 'boolean', description: 'Preview what would change without writing.' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }]; } },
    async execute(args) {
      const dryRun = Boolean(args?.dryRun);
      try {
        const cfg = readConfig();
        const gitee = createGitee(cfg.gitee);
        const root = memoriesRoot();
        const localFiles = new Set(collectSyncFiles(root));
        const remoteFiles = new Set();
        const queue = [''];
        while (queue.length > 0) {
          const dir = queue.shift();
          const entries = await gitee.listDir(dir);
          if (!entries) continue;
          for (const e of entries) {
            if (e.type === 'dir') queue.push(e.path);
            else remoteFiles.add(e.path);
          }
        }
        const downloaded = [], merged = [], skipped = [];
        const toWrite = [];
        for (const rel of [...remoteFiles].sort()) {
          if (rel.startsWith('manifest/')) continue; // informational only
          if (isExcludedRel(rel)) continue; // hub self-files (README/LICENSE)
          const remote = await gitee.getContent(rel);
          if (!remote || remote.buffer.length === 0) continue;
          const localAbs = safeJoin(root, rel);
          if (!localFiles.has(rel)) {
            downloaded.push(rel);
            toWrite.push([rel, remote.buffer]);
            continue;
          }
          const localBuf = fs.readFileSync(localAbs);
          if (remote.buffer.equals(localBuf)) continue;
          const localText = localBuf.toString('utf8');
          const remoteText = remote.buffer.toString('utf8');
          if (rel.endsWith('.md') && isEntryStyle(localText) && isEntryStyle(remoteText)) {
            const { text, addedFromRemote } = unionMerge(localText, remoteText);
            if (addedFromRemote > 0) {
              merged.push(`${rel} (+${addedFromRemote} entries from hub)`);
              toWrite.push([rel, Buffer.from(text, 'utf8')]);
            }
          } else {
            // non-entry file: hub wins when it is newer content-wise (last-write-wins)
            merged.push(`${rel} (replaced from hub)`);
            toWrite.push([rel, remote.buffer]);
          }
        }
        for (const rel of localFiles) {
          if (!remoteFiles.has(rel)) skipped.push(rel);
        }
        if (dryRun) {
          return [
            `DRY RUN on ${cfg.device}: would download ${downloaded.length}, merge ${merged.length}, keep local-only ${skipped.length}.`,
            ...downloaded.map((x) => `  download: ${x}`),
            ...merged.map((x) => `  merge: ${x}`),
            ...(toWrite.length ? ['no writes performed (dry run).'] : ['nothing to do.']),
          ].join('\n');
        }
        const backupDir = backupFiles(merged.filter(Boolean).map((x) => x.split(' ')[0]));
        for (const [rel, buf] of toWrite) {
          const abs = safeJoin(root, rel);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, buf);
        }
        return [
          `pull complete on ${cfg.device}: downloaded ${downloaded.length}, merged ${merged.length}, local-only kept ${skipped.length}.`,
          ...downloaded.map((x) => `  download: ${x}`),
          ...merged.map((x) => `  merge: ${x}`),
          backupDir ? `backup: ${backupDir}` : '',
        ].filter(Boolean).join('\n');
      } catch (e) {
        return `pull failed: ${e.message}`;
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'memory_sync_push',
    description: 'Push this device\'s memories AND installed-plugin manifest to the Gitee hub (merges hub-side changes in first, so nothing is lost). The other device can then pull your memory and see which plugins you have installed.',
    parameters: {
      dryRun: { type: 'boolean', description: 'Preview uploads without writing to the hub.' },
      includeManifest: { type: 'boolean', description: 'Also upload installed-plugin manifest (default true).' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }]; } },
    async execute(args) {
      const dryRun = Boolean(args?.dryRun);
      const includeManifest = args?.includeManifest !== false;
      try {
        const cfg = readConfig();
        const gitee = createGitee(cfg.gitee);
        // 1. absorb hub-side edits first (union merge keeps both ends' entries)
        const pullNote = [];
        try {
          const localFiles = collectSyncFiles(memoriesRoot());
          let mergesDone = 0;
          for (const rel of localFiles) {
            if (!rel.endsWith('.md')) continue;
            const remote = await gitee.getContent(rel);
            if (!remote) continue;
            const abs = safeJoin(memoriesRoot(), rel);
            const localText = fs.readFileSync(abs, 'utf8');
            const remoteText = remote.buffer.toString('utf8');
            if (isEntryStyle(localText) && isEntryStyle(remoteText)) {
              const { text, addedFromRemote } = unionMerge(localText, remoteText);
              if (addedFromRemote > 0) {
                backupFiles([rel]);
                fs.writeFileSync(abs, text, 'utf8');
                pullNote.push(`${rel} absorbed +${addedFromRemote} hub entries`);
                mergesDone += 1;
              }
            }
          }
          if (!mergesDone) pullNote.push('hub had no unseen entries');
        } catch (e) {
          pullNote.push(`pre-merge skipped: ${e.message}`);
        }
        // 2. upload all local sync files
        const files = collectSyncFiles(memoriesRoot());
        const uploaded = [], failed = [];
        for (const rel of files) {
          try {
            const buf = fs.readFileSync(safeJoin(memoriesRoot(), rel));
            const remote = await gitee.getContent(rel);
            if (remote && remote.buffer.equals(buf)) continue; // unchanged
            if (!dryRun) {
              await gitee.putContent(rel, buf, `[${cfg.device}] sync ${rel}`, remote?.sha);
            }
            uploaded.push(rel);
          } catch (e) {
            failed.push(`${rel}: ${e.message}`);
          }
        }
        // 3. plugin manifest
        let manifestNote = 'manifest skipped';
        if (includeManifest) {
          try {
            const plugins = scanProfiles(profilesDir());
            const manifest = {
              device: cfg.device,
              generatedAt: new Date().toISOString(),
              count: plugins.length,
              plugins,
            };
            const mrel = `manifest/plugins-${cfg.device}.json`;
            if (!dryRun) {
              const existing = await gitee.getContent(mrel);
              await gitee.putContent(mrel, Buffer.from(JSON.stringify(manifest, null, 2)), `[${cfg.device}] plugin manifest`, existing?.sha);
            }
            manifestNote = `${mrel} (${plugins.length} plugins)`;
          } catch (e) {
            manifestNote = `manifest failed: ${e.message}`;
          }
        }
        const head = dryRun ? `DRY RUN push from ${cfg.device}:` : `push complete from ${cfg.device}:`;
        return [
          head,
          `would-upload/uploaded ${uploaded.length} files${failed.length ? `, FAILED ${failed.length}` : ''}`,
          ...failed.slice(0, 10).map((x) => `  FAIL: ${x}`),
          `manifest: ${manifestNote}`,
          `pre-merge: ${pullNote.join('; ')}`,
          ...(dryRun && uploaded.length ? uploaded.slice(0, 40).map((x) => `  upload: ${x}`) : []),
        ].join('\n');
      } catch (e) {
        return `push failed: ${e.message}${e instanceof GiteeError ? ` (HTTP ${e.status})` : ''}`;
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'peer_send',
    description: 'Send a message to the other DSH device via the Gitee mailbox (desktop↔phone). Use kind=lesson to teach the other side how to use a plugin it does not have. Default recipient is phone if this device is desktop-pc, else desktop-pc.',
    parameters: {
      to: { type: 'string', description: 'Recipient device id (default: the other side).' },
      kind: { type: 'string', description: 'chat | lesson | ask (default chat).' },
      subject: { type: 'string', description: 'Short subject line.' },
      body: { type: 'string', description: 'Message body. For lessons: how to use a desktop-only plugin, workarounds on phone, exact commands.' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }]; } },
    async execute(args) {
      try {
        const cfg = readConfig();
        const to = String(args?.to || (cfg.device === 'desktop-pc' ? 'phone' : 'desktop-pc')).trim();
        const msg = makeMessage({
          from: cfg.device,
          to,
          kind: String(args?.kind || 'chat'),
          subject: args?.subject,
          body: args?.body,
        });
        if (!msg.body) return 'peer_send failed: body required';
        const gitee = createGitee(cfg.gitee);
        const rel = inboxPath(to);
        const existing = await gitee.getContent(rel);
        const next = appendMessage(existing ? existing.buffer.toString('utf8') : '', msg);
        await gitee.putContent(rel, Buffer.from(next, 'utf8'), `[${cfg.device}] mail ${msg.id} → ${to}`, existing?.sha);
        return `sent ${msg.id} → ${to} (${msg.kind}) ${msg.subject}\ninbox: ${rel}`;
      } catch (e) {
        return `peer_send failed: ${e.message}`;
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'peer_inbox',
    description: 'Read this device\'s Gitee mailbox. Default shows unread only. After reading a lesson, follow it, then peer_ack the id so the sender knows it was received.',
    parameters: {
      all: { type: 'boolean', description: 'true = include already-acked messages.' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }]; } },
    async execute(args) {
      try {
        const cfg = readConfig();
        const gitee = createGitee(cfg.gitee);
        const rel = inboxPath(cfg.device);
        const existing = await gitee.getContent(rel);
        if (!existing) return `mailbox empty (${rel})`;
        const messages = parseJsonl(existing.buffer.toString('utf8'));
        const unread = messages.filter((m) => !m.acked).length;
        return `${rel}: ${messages.length} total, ${unread} unread\n` + formatInbox(messages, { unreadOnly: !args?.all });
      } catch (e) {
        return `peer_inbox failed: ${e.message}`;
      }
    },
  }));

  ctx.tools.register(defineTool({
    name: 'peer_ack',
    description: 'Mark a mailbox message as read/handled by id (from peer_inbox).',
    parameters: {
      id: { type: 'string', description: 'Message id, e.g. m-xxxx.' },
    },
    output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }]; } },
    async execute(args) {
      const id = String(args?.id || '').trim();
      if (!id) return 'peer_ack failed: id required';
      try {
        const cfg = readConfig();
        const gitee = createGitee(cfg.gitee);
        const rel = inboxPath(cfg.device);
        const existing = await gitee.getContent(rel);
        if (!existing) return 'peer_ack failed: mailbox empty';
        const { text, marked } = ackMessage(existing.buffer.toString('utf8'), id);
        if (!marked) return `peer_ack: ${id} not found or already acked`;
        await gitee.putContent(rel, Buffer.from(text, 'utf8'), `[${cfg.device}] ack ${id}`, existing.sha);
        return `acked ${id}`;
      } catch (e) {
        return `peer_ack failed: ${e.message}`;
      }
    },
  }));
}

export { apply, inject, name };
