// dsh-memory-sync: local file collection rules + plugin manifest scanner.

import fs from 'node:fs';
import path from 'node:path';

// Directory names never synced (machine-local state / big attachments).
const EXCLUDED_DIRS = new Set([
  'notifications',
  'advisor',
  'pending-skills',
  'dsh-memory-evolve',
  'node_modules',
]);
// File names never synced.
const EXCLUDED_FILES = new Set([
  'plugin-state.json',
  'SUGGESTIONS.jsonl',
  // hub repo self-files must never leak into the memories dir
  'README.md', 'README.en.md', 'README.zh.md', 'LICENSE',
]);
const EXCLUDED_SUFFIXES = ['.bak', '~', '.tmp'];

/** Shared exclusion test for a repo-relative path (used by pull too). */
export function isExcludedRel(relPath) {
  const name = relPath.split('/').pop();
  if (EXCLUDED_FILES.has(name)) return true;
  if (EXCLUDED_SUFFIXES.some((s) => name.endsWith(s))) return true;
  if (name.startsWith('.')) return true;
  const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
  return dir.split('/').some((d) => EXCLUDED_DIRS.has(d));
}

/** Walk memoriesRoot and return relative paths of every syncable file. */
export function collectSyncFiles(memoriesRoot) {
  const out = [];
  const walk = (dir, rel) => {
    let items;
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const relPath = rel ? `${rel}/${item.name}` : item.name;
      if (item.isDirectory()) {
        if (EXCLUDED_DIRS.has(item.name)) continue;
        walk(path.join(dir, item.name), relPath);
      } else if (item.isFile()) {
        if (isExcludedRel(relPath)) continue;
        out.push(relPath);
      }
    }
  };
  walk(memoriesRoot, '');
  return out.sort();
}

/**
 * Scan DSH profile node_modules for installed plugins (packages that ship a
 * `dsh` field). Returns [{ profile, name, version, description }] so the
 * other device can discover "what does the desktop have installed?".
 */
export function scanProfiles(profilesDir) {
  const results = [];
  let profiles = [];
  try {
    profiles = fs.readdirSync(profilesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return results;
  }
  for (const profile of profiles) {
    const nm = path.join(profilesDir, profile, 'node_modules');
    const roots = [];
    // scoped + unscoped top-level dirs
    for (const entry of listDirsSafe(nm)) {
      if (entry.startsWith('@')) {
        roots.push(...listDirsSafe(path.join(nm, entry)).map((s) => `${entry}/${s}`));
      } else {
        roots.push(entry);
      }
    }
    for (const root of roots) {
      const pkgPath = path.join(nm, root, 'package.json');
      let pkg;
      try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      } catch {
        continue;
      }
      if (!pkg || typeof pkg !== 'object' || !pkg.dsh) continue; // plugins only
      results.push({
        profile,
        name: pkg.name || root,
        version: pkg.version || '?',
        description: String(pkg.description || '').slice(0, 160),
      });
    }
  }
  return results.sort((a, b) => (a.profile + a.name).localeCompare(b.profile + b.name));
}

function listDirsSafe(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() || d.isSymbolicLink())
      .map((d) => d.name);
  } catch {
    return [];
  }
}
