/**
 * Hermes Holographic Reduced Representations (HRR) — pure JS implementation.
 *
 * Phase vectors: each concept is encoded as a vector of angles in [0, 2π).
 * Operations:
 *   bind   — circular convolution (phase addition)  — associates two concepts
 *   unbind — circular correlation (phase subtraction) — retrieves bound value
 *   bundle — superposition (circular mean)           — merges concepts
 *
 * Atoms are generated deterministically from SHA-256 so representations
 * are identical across processes and machines.
 *
 * Reference: Plate (1995) — Holographic Reduced Representations
 */

import { createHash } from 'node:crypto'

const TWO_PI = 2.0 * Math.PI

/**
 * Create a phase vector of given dimension, all zeros.
 * @param {number} dim - vector dimension (default 1024).
 * @returns {Float64Array} zeroed phase vector.
 */
export function zeroVector(dim = 1024) {
  return new Float64Array(dim)
}

/**
 * Deterministic phase vector via SHA-256 counter blocks.
 * Mirrors Hermes' encode_atom(): SHA-256 + struct.unpack → uint16 → scale to [0, 2π).
 * @param {string} word - the concept to encode.
 * @param {number} dim - vector dimension (default 1024).
 * @returns {Float64Array} phase vector.
 */
export function encodeAtom(word, dim = 1024) {
  const valuesPerBlock = 16 // 32 bytes = 16 uint16 values
  const blocksNeeded = Math.ceil(dim / valuesPerBlock)
  const values = []

  for (let i = 0; i < blocksNeeded; i++) {
    const digest = createHash('sha256').update(`${word}:${i}`).digest()
    // Each digest is 32 bytes, interpret as 16 uint16 little-endian values
    for (let j = 0; j < 16; j++) {
      values.push((digest[j * 2] | (digest[j * 2 + 1] << 8)) & 0xFFFF)
    }
  }

  const v = new Float64Array(dim)
  for (let i = 0; i < dim; i++) {
    v[i] = (values[i] / 65536.0) * TWO_PI
  }
  return v
}

/**
 * Bind two vectors: element-wise phase addition (circular convolution).
 * @param {Float64Array} a - first vector.
 * @param {Float64Array} b - second vector.
 * @returns {Float64Array} bound vector.
 */
export function bind(a, b) {
  const dim = a.length
  const result = new Float64Array(dim)
  for (let i = 0; i < dim; i++) {
    result[i] = (a[i] + b[i]) % TWO_PI
  }
  return result
}

/**
 * Unbind: element-wise phase subtraction (circular correlation).
 * unbind(bind(a, b), a) ≈ b (up to superposition noise).
 * @param {Float64Array} memory - the memory vector.
 * @param {Float64Array} key - the key vector.
 * @returns {Float64Array} unbound vector.
 */
export function unbind(memory, key) {
  const dim = memory.length
  const result = new Float64Array(dim)
  for (let i = 0; i < dim; i++) {
    result[i] = ((memory[i] - key[i]) % TWO_PI + TWO_PI) % TWO_PI
  }
  return result
}

/**
 * Bundle multiple vectors: circular mean of complex exponentials.
 * The result can hold O(sqrt(dim)) items before similarity degrades.
 * @param {...Float64Array} vectors - vectors to bundle.
 * @returns {Float64Array} bundled vector.
 */
export function bundle(...vectors) {
  if (vectors.length === 0) return new Float64Array(0)
  const dim = vectors[0].length
  const sumReal = new Float64Array(dim)
  const sumImag = new Float64Array(dim)

  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      sumReal[i] += Math.cos(v[i])
      sumImag[i] += Math.sin(v[i])
    }
  }

  const result = new Float64Array(dim)
  for (let i = 0; i < dim; i++) {
    result[i] = ((Math.atan2(sumImag[i], sumReal[i]) % TWO_PI) + TWO_PI) % TWO_PI
  }
  return result
}

/**
 * Phase cosine similarity between two vectors. Range [-1, 1].
 * 1.0 = identical, 0.0 = random (unrelated), -1.0 = anti-correlated.
 * @param {Float64Array} a - first vector.
 * @param {Float64Array} b - second vector.
 * @returns {number} similarity score.
 */
export function similarity(a, b) {
  const dim = a.length
  let sum = 0
  for (let i = 0; i < dim; i++) {
    sum += Math.cos(a[i] - b[i])
  }
  return sum / dim
}

/**
 * Tokenize text for bag-of-words encoding: lowercase, split, strip punctuation.
 * @param {string} text - input text.
 * @returns {string[]} tokens.
 */
function tokenizeText(text) {
  return (text ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/^[.,!?;:"'()\[\]{}]+|[.,!?;:"'()\[\]{}]+$/g, ''))
    .filter(t => t.length > 0)
}

/**
 * Encode text as a bag-of-words: bundle of atom vectors for each token.
 * @param {string} text - the text to encode.
 * @param {number} dim - vector dimension (default 1024).
 * @returns {Float64Array} bundled phase vector.
 */
export function encodeText(text, dim = 1024) {
  const tokens = tokenizeText(text)
  if (tokens.length === 0) return encodeAtom('__hrr_empty__', dim)
  const atomVectors = tokens.map(t => encodeAtom(t, dim))
  return bundle(...atomVectors)
}

/**
 * Encode a fact: content bound to ROLE_CONTENT, each entity bound to ROLE_ENTITY, all bundled.
 * @param {string} content - the fact content.
 * @param {string[]} entities - entity names associated with this fact.
 * @param {number} dim - vector dimension (default 1024).
 * @returns {Float64Array} structured fact vector.
 */
export function encodeFact(content, entities, dim = 1024) {
  const roleContent = encodeAtom('__hrr_role_content__', dim)
  const roleEntity = encodeAtom('__hrr_role_entity__', dim)
  const components = [bind(encodeText(content, dim), roleContent)]
  for (const entity of entities) {
    components.push(bind(encodeAtom(entity.toLowerCase(), dim), roleEntity))
  }
  return bundle(...components)
}

/**
 * Serialize phase vector to bytes (Float64Array → Buffer).
 * At dim=1024, this is 8 KB.
 * @param {Float64Array} phases - the phase vector.
 * @returns {Buffer} serialized bytes.
 */
export function phasesToBytes(phases) {
  return Buffer.from(phases.buffer, phases.byteOffset, phases.byteLength)
}

/**
 * Deserialize bytes back to phase vector.
 * @param {Buffer|Uint8Array} data - serialized bytes.
 * @returns {Float64Array} phase vector.
 */
export function bytesToPhases(data) {
  return new Float64Array(data.buffer, data.byteOffset, data.byteLength / 8)
}

/**
 * Estimate signal-to-noise ratio for holographic storage.
 * SNR = sqrt(dim / n_items) when n_items > 0, else Inf.
 * Falls below 2.0 when n_items > dim / 4 (retrieval errors become likely).
 * @param {number} dim - vector dimension.
 * @param {number} nItems - number of items stored.
 * @returns {number} SNR estimate.
 */
export function snrEstimate(dim, nItems) {
  if (nItems <= 0) return Infinity
  return Math.sqrt(dim / nItems)
}

/**
 * Reason: find facts that are structurally related to ALL given entities.
 * Given multiple entities, this finds facts where each entity plays a
 * structural role (AND semantics via min similarity).
 * @param {string[]} entities - entity names.
 * @param {Function} scoreFn - function(entity, factVec) => similarity score.
 * @param {number} dim - vector dimension.
 * @returns {Function} pass this to a scoring pipeline.
 */
export function makeReasonScorer(entities, dim = 1024) {
  const roleEntity = encodeAtom('__hrr_role_entity__', dim)
  const roleContent = encodeAtom('__hrr_role_content__', dim)
  const probeKeys = entities.map(e => {
    const entityVec = encodeAtom(e.toLowerCase(), dim)
    return bind(entityVec, roleEntity)
  })
  return (factVec) => {
    const scores = []
    for (const key of probeKeys) {
      const residual = unbind(factVec, key)
      scores.push(similarity(residual, roleContent))
    }
    const minScore = Math.min(...scores)
    return (minScore + 1.0) / 2.0 // normalize to [0, 1]
  }
}

/**
 * Contradiction score: high entity overlap + low content similarity.
 * @param {Float64Array} vecA - first fact vector.
 * @param {Float64Array} vecB - second fact vector.
 * @param {number} entityOverlap - Jaccard overlap of entity sets (0..1).
 * @returns {number} contradiction score (0..1), higher = more contradictory.
 */
export function contradictionScore(vecA, vecB, entityOverlap) {
  const contentSim = (similarity(vecA, vecB) + 1.0) / 2.0
  return entityOverlap * (1.0 - contentSim)
}