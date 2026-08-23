// dsh-memory-sync: entry-level markdown merge (pure functions, unit-testable).
//
// DSH memory tracks are append-style lists whose entries start with a
// timestamp marker line like:
//   [2026-08-15] text...
//   - [2026-08-16] [branch:all] text...
//   * [2026-08-17] text...
// A file is treated as "entry style" when it contains >= 2 such markers.
// Entry-style files merge as a UNION of whole entry blocks:
//   local entries stay untouched; remote entries not present locally
//   (exact block-text match after trim) are appended at the end.
// Non-entry files fall back to last-write-wins by the caller.

const ENTRY_RE = /^\s*(?:[-*+]\s*)?\[\d{4}-\d{2}-\d{2}[^\]]*\]/;

/** Split markdown text into { preamble, entries } where each entry keeps its marker line. */
export function splitEntries(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const preamble = [];
  const entries = [];
  let current = null;
  for (const line of lines) {
    if (ENTRY_RE.test(line)) {
      if (current) entries.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) entries.push(current);
  return {
    preamble: preamble.join('\n'),
    entries: entries.map((e) => e.join('\n')),
  };
}

/** True when the file looks like an entry-list memory track. */
export function isEntryStyle(text) {
  const lines = String(text ?? '').split('\n');
  let n = 0;
  for (const line of lines) {
    if (ENTRY_RE.test(line)) {
      n += 1;
      if (n >= 2) return true;
    }
  }
  return false;
}

/**
 * Union-merge remote entries into local entry-style text.
 * Returns { text, addedFromRemote, duplicates } — never mutates or reorders
 * existing local content; new remote blocks are appended at the bottom.
 */
export function unionMerge(localText, remoteText) {
  const localLf = String(localText ?? '').replace(/\r\n/g, '\n');
  const seen = new Set(splitEntries(localText).entries.map((e) => normalize(e)));
  const remoteParsed = splitEntries(remoteText);
  const additions = [];
  let duplicates = 0;
  for (const entry of remoteParsed.entries) {
    const key = normalize(entry);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    additions.push(entry);
  }
  if (additions.length === 0) {
    return { text: localLf, addedFromRemote: 0, duplicates };
  }
  let text = localLf.replace(/\n+$/, '');
  text += '\n' + additions.join('\n') + '\n';
  return { text, addedFromRemote: additions.length, duplicates };
}

function normalize(s) {
  return s.replace(/\r\n/g, '\n').trim();
}
