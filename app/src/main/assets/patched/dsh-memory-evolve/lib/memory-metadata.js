/**
 * dsh-memory-evolve — per-entry memory metadata sidecar.
 *
 * Hermes holographic memory stores trust_score / retrieval_count /
 * helpful_count directly on each fact. This plain-text store (files with
 * `\n§\n` entry delimiters) cannot carry those columns without breaking the
 * round-trippable file format, so we keep the same signals in a JSON sidecar
 * keyed by a stable hash of the entry text.
 *
 * Why a hash instead of the entry id?
 *   - Most tracks do not have [id:xxxx] yet (only sync-enabled projects).
 *   - The hash is stable across edits that keep the text identical, and
 *     changes when content changes (replace -> new identity, which is the
 *     desired behavior: a rewritten fact starts fresh).
 *   - stripEntryId removes the id before hashing so two devices with the
 *     same fact (different random ids) share one metadata row.
 *
 * Trust semantics mirror Hermes holographic:
 *   - helpful   -> trust += 0.05
 *   - unhelpful -> trust -= 0.10
 *   - clamped to [0, 1]; default 0.5
 *   - list results can be sorted/weighted by trust so stale/wrong facts sink.
 *
 * Entity recognition (Hermes holographic):
 *   - Auto-extract capitalized multi-word phrases, quoted terms, file/path
 *     tokens, and AKA aliases.
 *   - Stored per entry as an array; used for related-entry lookup and
 *     contradiction detection (same entity, low content overlap).
 *
 * File is tiny; writes are atomic (tmp + rename) under the same lock the
 * memory store uses for the directory.
 *
 * @module dsh-memory-evolve/memory-metadata
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripEntryId } from './sync/entryid.js'
import { encodeText, similarity as hrrSimilarity } from './hermes-hrr.js'

/** Trust adjustment constants (same values as Hermes holographic store.py). */
export const HELPFUL_DELTA = 0.05
export const UNHELPFUL_DELTA = -0.10
export const TRUST_MIN = 0.0
export const TRUST_MAX = 1.0
export const DEFAULT_TRUST = 0.5

/** Half-life used by the time-decay factor in scoring (in days). */
export const TIME_DECAY_HALF_LIFE_DAYS = 90

/**
 * Stable 16-hex hash for one entry (identity for metadata lookup).
 * Strips [id:] before hashing so cross-device copies share metadata.
 * @param {string} entry - the full entry text.
 * @returns {string} the metadata key.
 */
export function entryKey(entry) {
  return createHash('sha256').update(stripEntryId(entry)).digest('hex').slice(0, 16)
}

/** Clamp a trust value to [0, 1]. */
function clampTrust(value) {
  return Math.max(TRUST_MIN, Math.min(TRUST_MAX, value))
}

/**
 * Tokenize a text into a Set of lower-cased words (for Jaccard similarity).
 * @param {string} text - input text.
 * @returns {Set<string>} lower-cased alphanumeric tokens (len >= 2).
 */
export function tokenize(text) {
  const tokens = new Set()
  const cleaned = String(text ?? '')
    // Preserve CJK runs as whole "words": split on non-CJK/non-alphanumeric
    .replace(/[\u4e00-\u9fff]+/g, (m) => ` ${m} `)
    .toLowerCase()
    .match(/[a-z0-9\u4e00-\u9fff]{2,}/g)
  for (const tok of (cleaned ?? [])) tokens.add(tok)
  return tokens
}

/**
 * Jaccard similarity between two texts (0..1).
 * @param {string} a - first text.
 * @param {string} b - second text.
 * @returns {number} similarity score.
 */
export function jaccardSimilarity(a, b) {
  const A = tokenize(a)
  const B = tokenize(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter += 1
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * Build an inverted index from a list of entries.
 * Maps each token → Set of entryKeys that contain it.
 * @param {string[]} entries - the entries to index.
 * @returns {Map<string, Set<string>>} inverted index.
 */
export function buildInvertedIndex(entries) {
  const index = new Map()
  for (const entry of entries) {
    const key = entryKey(entry)
    const tokens = tokenize(entry)
    for (const tok of tokens) {
      if (!index.has(tok)) index.set(tok, new Set())
      index.get(tok).add(key)
    }
  }
  return index
}

/**
 * Keyword search using inverted index: rank entries by query token overlap.
 * @param {string} query - the search query.
 * @param {string[]} entries - candidate entries.
 * @param {Map<string, Set<string>>} [index] - pre-built inverted index (optional, built on demand).
 * @returns {{entry: string, score: number}[]} scored entries, sorted by relevance.
 */
export function keywordSearch(query, entries, index = null) {
  const qTokens = tokenize(query)
  if (qTokens.size === 0) return entries.map(e => ({ entry: e, score: 0 }))
  const idx = index || buildInvertedIndex(entries)
  const keyToEntry = new Map()
  for (const entry of entries) keyToEntry.set(entryKey(entry), entry)
  const scores = new Map()
  for (const tok of qTokens) {
    const matched = idx.get(tok)
    if (!matched) continue
    for (const key of matched) {
      scores.set(key, (scores.get(key) || 0) + 1)
    }
  }
  const maxScore = Math.max(...scores.values(), 1)
  const results = []
  for (const entry of entries) {
    const key = entryKey(entry)
    const score = (scores.get(key) || 0) / maxScore
    // Also apply substring match as a bonus for partial matches
    const textLower = entry.toLowerCase()
    const queryLower = query.toLowerCase()
    const subBonus = textLower.includes(queryLower) ? 0.3 : 0
    results.push({ entry, score: score + subBonus })
  }
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Time-decay factor: `0.5 ^ (age_days / half_life)`.
 * Entries without a parseable date get score 1 (no penalty).
 * @param {string|null|undefined} dateStamp - `YYYY-MM-DD` or null.
 * @returns {number} multiplier in (0, 1].
 */
export function timeDecayFactor(dateStamp, now = new Date()) {
  if (!dateStamp) return 1
  const parsed = new Date(`${dateStamp}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return 1
  const ageMs = now.getTime() - parsed.getTime()
  if (ageMs <= 0) return 1 // future dates are not penalized
  const ageDays = ageMs / 86400000
  return Math.pow(0.5, ageDays / TIME_DECAY_HALF_LIFE_DAYS)
}

/**
 * Extract candidate entities from an entry's content (Hermes-style):
 *   - run-in capitalized phrases (2+ words, e.g. `DeepSeek Harness`)
 *   - quoted terms ("...")
 *   - known project/path tokens (`C:\...`, `/.../`)
 *   - `AKA <alias>` pairs
 * @param {string} entry - full entry text.
 * @returns {string[]} de-duplicated entity names (original casing trimmed).
 */
export function extractEntities(entry) {
  const text = String(entry ?? '')
  const entities = new Set()

  // AKA aliases: `X（AKA Y）`, `X aka Y`, `X (AKA Y)`
  const akaRe = /([A-Za-z\u4e00-\u9fff][\w\u4e00-\u9fff .\-/]{1,60}?)\s*(?:\(|\s)?(?:aka|AKA)(?:\s|\))?\s+([A-Za-z\u4e00-\u9fff][\w\u4e00-\u9fff .\-/]{1,60})/g
  for (const m of text.matchAll(akaRe)) {
    entities.add(m[1].trim().replace(/[()]/g, ''))
    entities.add(m[2].trim().replace(/[()]/g, ''))
  }

  // Quoted terms: "..." (double quotes, Chinese quotes)
  const quoteRe = /["""]([A-Za-z0-9\u4e00-\u9fff][^"""]{1,60})["""]/g
  for (const m of text.matchAll(quoteRe)) {
    const q = m[1].trim()
    if (q.length >= 2) entities.add(q)
  }

  // Path-like tokens: `/.../...`, `C:\...`, `~/.foo`
  const pathRe = /(?:[A-Za-z]:\\|\\|\/|~\/)[A-Za-z0-9_\-./\\\s]{2,80}/g
  for (const m of text.matchAll(pathRe)) {
    const token = m[0].trim()
    if (token.length >= 3 && !token.includes(' ')) entities.add(token)
  }

  // Capitalized multi-word phrases (2-5 words): e.g. "DeepSeek Harness",
  // "Hermes Holographic Memory". Skip generic English stop-ish words.
  const capRe = /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){1,4})\b/g
  const STOP = new Set(['The', 'This', 'That', 'These', 'Those', 'And', 'But', 'For', 'With', 'From'])
  for (const m of text.matchAll(capRe)) {
    const phrase = m[1].trim()
    // One of the words must be non-stop; skip long English sentences
    const words = phrase.split(/\s+/)
    if (words.length >= 2 && words.length <= 5 && words.some(w => !STOP.has(w))) {
      entities.add(phrase)
    }
  }

  return [...entities]
}

/**
 * Per-entry metadata store persisted to `<memoryDir>/memory-metadata.json`.
 *
 * Shape:
 *   {
 *     "version": 2,
 *     "entries": {
 *       "<entryKey>": {
 *         "trust": 0.5,
 *         "retrievalCount": 0,
 *         "helpfulCount": 0,
 *         "unhelpfulCount": 0,
 *         "entities": ["DeepSeek Harness", "Hermes"],
 *         "updatedAt": "2026-08-12T..."
 *       }
 *     }
 *   }
 */
export class MemoryMetadata {
  /**
   * @param {string} dir - the memory directory (created on demand).
   */
  constructor(dir) {
    this.dir = dir
    this.file = join(dir, 'memory-metadata.json')
    this.data = this._load()
  }

  _load() {
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8'))
      if (raw && typeof raw === 'object' && raw.entries && typeof raw.entries === 'object') {
        // Upgrade legacy version-1 rows (no entities) lazily.
        if (raw.version === undefined) raw.version = 2
        return raw
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // Corrupt sidecar: don't crash the plugin, just reset (will be
        // overwritten on next metadata write).
        console.warn(`[dsh-memory-evolve] memory-metadata.json 损坏，已重置：${error.message}`)
      }
    }
    return { version: 2, entries: {} }
  }

  _save() {
    mkdirSync(this.dir, { recursive: true })
    const tmp = `${this.file}.tmp.${process.pid}`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n')
    renameSync(tmp, this.file)
  }

  /**
   * Read the metadata row for one entry; returns a copy with defaults when
   * no row exists.
   * @param {string} entry - the full entry text.
   * @returns {{trust: number, retrievalCount: number, helpfulCount: number, unhelpfulCount: number, entities: string[], updatedAt?: string}}
   */
  get(entry) {
    const key = entryKey(entry)
    const row = this.data.entries[key]
    if (!row) {
      return { trust: DEFAULT_TRUST, retrievalCount: 0, helpfulCount: 0, unhelpfulCount: 0, entities: extractEntities(entry) }
    }
    return {
      trust: clampTrust(typeof row.trust === 'number' ? row.trust : DEFAULT_TRUST),
      retrievalCount: typeof row.retrievalCount === 'number' ? row.retrievalCount : 0,
      helpfulCount: typeof row.helpfulCount === 'number' ? row.helpfulCount : 0,
      unhelpfulCount: typeof row.unhelpfulCount === 'number' ? row.unhelpfulCount : 0,
      entities: Array.isArray(row.entities) ? row.entities : extractEntities(entry),
      updatedAt: row.updatedAt,
    }
  }

  /**
   * Ensure a metadata row exists (used when adding an entry), extracting and
   * persisting entities at write time.
   * @param {string} entry - the full entry text.
   */
  ensure(entry) {
    const key = entryKey(entry)
    if (!this.data.entries[key]) {
      this.data.entries[key] = {
        trust: DEFAULT_TRUST,
        retrievalCount: 0,
        helpfulCount: 0,
        unhelpfulCount: 0,
        entities: extractEntities(entry),
        updatedAt: new Date().toISOString(),
      }
      this._save()
    } else if (!Array.isArray(this.data.entries[key].entities)) {
      // Upgrade legacy row.
      this.data.entries[key].entities = extractEntities(entry)
      this._save()
    }
  }

  /**
   * Increment the retrieval counter for an entry. Used by memory list/query
   * so frequently-referenced facts can be surfaced (safe to call on every
   * read; the file is tiny).
   * @param {string} entry - the full entry text.
   */
  bumpRetrieval(entry) {
    const key = entryKey(entry)
    const row = this.data.entries[key] || {
      trust: DEFAULT_TRUST,
      retrievalCount: 0,
      helpfulCount: 0,
      unhelpfulCount: 0,
      entities: extractEntities(entry),
      updatedAt: new Date().toISOString(),
    }
    row.retrievalCount = (typeof row.retrievalCount === 'number' ? row.retrievalCount : 0) + 1
    row.updatedAt = new Date().toISOString()
    this.data.entries[key] = row
    this._save()
  }

  /**
   * Record user/agent feedback on an entry and adjust trust asymmetrically.
   * @param {string} entry - the full entry text.
   * @param {boolean} helpful - true = helpful, false = unhelpful.
   * @returns {{oldTrust: number, newTrust: number, helpfulCount: number, unhelpfulCount: number}}
   */
  recordFeedback(entry, helpful) {
    const key = entryKey(entry)
    const before = this.get(entry)
    const delta = helpful ? HELPFUL_DELTA : UNHELPFUL_DELTA
    const row = this.data.entries[key] || {
      trust: DEFAULT_TRUST,
      retrievalCount: 0,
      helpfulCount: 0,
      unhelpfulCount: 0,
      entities: extractEntities(entry),
      updatedAt: new Date().toISOString(),
    }
    row.trust = clampTrust((typeof row.trust === 'number' ? row.trust : DEFAULT_TRUST) + delta)
    if (helpful) row.helpfulCount = (typeof row.helpfulCount === 'number' ? row.helpfulCount : 0) + 1
    else row.unhelpfulCount = (typeof row.unhelpfulCount === 'number' ? row.unhelpfulCount : 0) + 1
    row.updatedAt = new Date().toISOString()
    this.data.entries[key] = row
    this._save()
    return {
      oldTrust: before.trust,
      newTrust: row.trust,
      helpfulCount: row.helpfulCount,
      unhelpfulCount: row.unhelpfulCount,
    }
  }

  /**
   * A human-readable trust tag for rendering, e.g. `[信任:0.55]`.
   * Empty string when the entry has no metadata row yet.
   * @param {string} entry - the full entry text.
   * @returns {string}
   */
  trustTag(entry) {
    const row = this.data.entries[entryKey(entry)]
    if (!row) return ''
    return `[信任:${clampTrust(row.trust).toFixed(2)}]`
  }

  /**
   * Entity tags for one entry, e.g. `[实体:DeepSeek Harness, Hermes]`.
   * Empty string when no entities detected / no row yet.
   * @param {string} entry - the full entry text.
   * @returns {string}
   */
  entityTag(entry) {
    const entities = this.get(entry).entities
    if (!entities || entities.length === 0) return ''
    return `[实体:${entities.slice(0, 5).join(', ')}]`
  }

  /**
   * Delete metadata for one entry (used by remove/archive).
   * @param {string} entry - the full entry text.
   */
  delete(entry) {
    const key = entryKey(entry)
    if (this.data.entries[key]) {
      delete this.data.entries[key]
      this._save()
    }
  }

  /**
   * Score one entry against a query: combines substring/Jaccard relevance
   * with trust and time decay — Hermes `relevance * trust_score * decay`.
   * @param {string} entry - full entry text.
   * @param {string} query - user/agent query text.
   * @param {{trustWeight?: number, decay?: boolean}} [opts]
   * @returns {{score: number, jaccard: number, trust: number, decay: number}}
   */
  scoreEntry(entry, query, opts = {}) {
    const trustWeight = opts.trustWeight ?? 1
    const useDecay = opts.decay !== false
    const useHrr = opts.hrr !== false
    const hrrDim = opts.hrrDim ?? 128
    const meta = this.get(entry)
    const q = String(query ?? '').toLowerCase()
    const textLower = String(entry).toLowerCase()
    const substringHit = q !== '' && textLower.includes(q)
    const jaccard = jaccardSimilarity(entry, query)
    const trust = meta.trust
    const decay = useDecay ? timeDecayFactor(extractEntryDateSimple(entry)) : 1
    // HRR 语义相似度（Hermes 权重 0.3）：纯 JS 相位向量，低维提速
    let hrr = 0.5
    if (useHrr) {
      try {
        hrr = (hrrSimilarity(encodeText(q, hrrDim), encodeText(entry, hrrDim)) + 1) / 2
      } catch { /* 向量失败时 HRR 置中性 0.5 */ }
    }
    // Hermes 权重：keyword/子串 0.4 + Jaccard 0.3 + HRR 0.3
    const kwScore = substringHit ? 1 : jaccard
    const relevance = 0.4 * kwScore + 0.3 * jaccard + 0.3 * hrr
    const score = relevance * (trustWeight * trust) * decay
    return { score, jaccard, trust, decay, hrr }
  }

  /**
   * Find entries in a list that share entities with `entry`, ranked by
   * overlap count then trust. Used for related-memory and contradiction
   * detection.
   * @param {string} entry - the source entry.
   * @param {string[]} candidates - all candidate entries.
   * @param {{minOverlap?: number}} [opts]
   * @returns {{entry: string, entities: string[], overlap: number, trust: number}[]}
   */
  related(entry, candidates, opts = {}) {
    const minOverlap = opts.minOverlap ?? 1
    const srcEntities = this.get(entry).entities
    if (srcEntities.length === 0) return []
    const results = []
    for (const cand of candidates) {
      if (cand === entry) continue
      const candEntities = this.get(cand).entities
      if (candEntities.length === 0) continue
      const overlap = srcEntities.filter(e => candEntities.includes(e)).length
      if (overlap >= minOverlap) {
        results.push({
          entry: cand,
          entities: candEntities.filter(e => srcEntities.includes(e)).slice(0, 5),
          overlap,
          trust: this.get(cand).trust,
        })
      }
    }
    return results.sort((a, b) => b.overlap - a.overlap || b.trust - a.trust)
  }

  /**
   * Detect potential contradictions: entries sharing at least `minOverlap`
   * entities but with low content similarity (Jaccard < `maxSimilarity`).
   * @param {string[]} entries - all entries in a track.
   * @param {{minOverlap?: number, maxSimilarity?: number, limit?: number}} [opts]
   * @returns {{left: string, right: string, shared: string[], similarity: number}[]}
   */
  contradictions(entries, opts = {}) {
    const minOverlap = opts.minOverlap ?? 1
    const maxSimilarity = opts.maxSimilarity ?? 0.15
    const limit = opts.limit ?? 20
    const results = []
    for (let i = 0; i < entries.length; i++) {
      const related = this.related(entries[i], entries.slice(i + 1), { minOverlap })
      for (const rel of related) {
        const similarity = jaccardSimilarity(entries[i], rel.entry)
        if (similarity < maxSimilarity) {
          results.push({
            left: entries[i],
            right: rel.entry,
            shared: rel.entities,
            similarity,
          })
          if (results.length >= limit) return results
        }
      }
    }
    return results
  }

  /**
   * Prefetch: rank all entries by relevance to `query`, returning top-N.
   * This is the Hermes `prefetch` equivalent — cheap, deterministic,
   * no background thread needed for our file sizes.
   * @param {string[]} entries - candidate entries.
   * @param {string} query - user message / task context.
   * @param {{limit?: number, trustWeight?: number, decay?: boolean}} [opts]
   * @returns {{entry: string, score: number, trust: number, decay: number}[]}
   */
  prefetch(entries, query, opts = {}) {
    const limit = opts.limit ?? 5
    const scored = entries
      .map(entry => {
        const s = this.scoreEntry(entry, query, opts)
        return { entry, score: s.score, trust: s.trust, decay: s.decay }
      })
      .filter(x => x.score > 0.03)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, limit)
  }
}

/**
 * Extract the leading `YYYY-MM-DD` date from an entry's stamp if present.
 * Mirrors store.extractEntryDate but kept local to avoid a circular dep.
 * @param {string} entry - full entry text.
 * @returns {string|null}
 */
function extractEntryDateSimple(entry) {
  const m = String(entry ?? '').match(/\b(\d{4}-\d{2}-\d{2})\b/)
  return m ? m[1] : null
}