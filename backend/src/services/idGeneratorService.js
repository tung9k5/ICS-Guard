/**
 * IdGeneratorService – Common ID Generator for ICS-Guard Backend
 *
 * Generates human-readable, sequential, unique IDs in the format:
 *   [FIRST_LETTER_OF_COLLECTION][3-DIGIT_ZERO_PADDED_NUMBER]
 *
 * Examples:
 *   users     → U001, U002, U003 …
 *   devices   → D001, D002, D003 …
 *   alerts    → A001, A002, A003 …
 *   incidents → I001, I002, I003 …
 *   rules     → R001, R002, R003 …
 *
 * Safety guarantees:
 *   1. Atomic via MongoDB findOneAndUpdate + $inc  (no race condition)
 *   2. Unique index on `prefix` in id_sequences collection (DB-level guard)
 *   3. Unique index on the generated custom ID field in each target collection
 *   4. Sequence never resets on delete (immutable once issued)
 *   5. Overflow (>999) throws AppError – never wraps around silently
 *
 * Usage:
 *   import idGeneratorService from '../services/idGeneratorService.js';
 *   const id = await idGeneratorService.generate('users');   // → "U001"
 *   const id = await idGeneratorService.generate('devices'); // → "D001"
 */

import IdSequence from '../models/IdSequence.js';
import AppError from '../utils/AppError.js';

// ---------------------------------------------------------------------------
// Prefix Map
// Maps collection name (lowercase, singular or plural) → single uppercase letter
// Add new collections here – never hard-code logic elsewhere.
// ---------------------------------------------------------------------------
export const PREFIX_MAP = {
  // Core entities
  users:     'U',
  user:      'U',

  devices:   'D',
  device:    'D',

  alerts:    'A',
  alert:     'A',

  incidents: 'I',
  incident:  'I',

  rules:     'R',
  rule:      'R',

  // Supporting entities
  audits:       'L',    // L = Log
  auditlogs:    'L',
  auditlog:     'L',

  blockedips:   'B',
  blockedip:    'B',

  settings:     'S',
  setting:      'S',

  refreshtokens: 'T',
  refreshtoken:  'T',

  devicesensors: 'E',   // E = sEnsor
  devicesensor:  'E',

  incidenttimelines: 'N',
  incidenttimeline:  'N',
};

// Maximum value for the 3-digit sequence
const MAX_SEQUENCE = 999;

class IdGeneratorService {
  /**
   * Resolve the prefix character for a given collection name.
   *
   * Strategy:
   *   1. Look up PREFIX_MAP (configurable, explicit)
   *   2. Fallback: use first character of collection name (uppercased)
   *
   * @param {string} collectionName - e.g. "users", "devices", "alerts"
   * @returns {string} - Single uppercase letter, e.g. "U"
   */
  resolvePrefix(collectionName) {
    if (!collectionName || typeof collectionName !== 'string') {
      throw new AppError('collectionName must be a non-empty string', 400);
    }
    const key = collectionName.toLowerCase().trim().replace(/\s+/g, '');
    return PREFIX_MAP[key] ?? collectionName[0].toUpperCase();
  }

  /**
   * Generate the next sequential ID for the given collection.
   *
   * This method is ATOMIC:
   *   - Uses MongoDB findOneAndUpdate with $inc (atomic document-level operation)
   *   - upsert:true creates the sequence document on first call for a prefix
   *   - No external lock needed – MongoDB guarantees atomicity at document level
   *
   * @param {string} collectionName - e.g. "users", "devices", "alerts"
   * @returns {Promise<string>} - e.g. "U001", "D042", "A999"
   * @throws {AppError} - If sequence exceeds 999 (overflow)
   */
  async generate(collectionName) {
    const prefix = this.resolvePrefix(collectionName);

    // -------------------------------------------------------------------
    // ATOMIC INCREMENT
    // findOneAndUpdate with $inc is a single atomic operation in MongoDB.
    // Even with 1000 concurrent requests, each gets a unique number.
    // -------------------------------------------------------------------
    const seq = await IdSequence.findOneAndUpdate(
      { prefix },
      {
        $inc: { current_number: 1 },
        $setOnInsert: {
          collection_name: collectionName.toLowerCase(),
        },
      },
      {
        upsert: true,      // Create sequence document if it doesn't exist
        new: true,         // Return the UPDATED document (after $inc)
        setDefaultsOnInsert: true,
      }
    );

    // -------------------------------------------------------------------
    // OVERFLOW GUARD
    // Sequence starts at 0, $setOnInsert sets to 0, first $inc → 1.
    // If current_number > 999, we've exhausted the 3-digit space.
    // -------------------------------------------------------------------
    if (seq.current_number > MAX_SEQUENCE) {
      // Roll back the increment to avoid poisoning the sequence
      await IdSequence.findOneAndUpdate(
        { prefix },
        { $inc: { current_number: -1 } }
      );
      throw new AppError(
        `ID sequence overflow: prefix "${prefix}" has reached the maximum of ${MAX_SEQUENCE}. ` +
        `Please archive old records or expand the ID format.`,
        500
      );
    }

    // Format: prefix + zero-padded 3-digit number
    const id = `${prefix}${seq.current_number.toString().padStart(3, '0')}`;
    return id;
  }

  /**
   * Peek at the current sequence value without incrementing.
   * Useful for debugging/monitoring only – do NOT use to predict next ID.
   *
   * @param {string} collectionName
   * @returns {Promise<number|null>} current_number or null if sequence not found
   */
  async peek(collectionName) {
    const prefix = this.resolvePrefix(collectionName);
    const seq = await IdSequence.findOne({ prefix }).lean();
    return seq ? seq.current_number : null;
  }

  /**
   * Reset a sequence to a specific number.
   * DANGEROUS – use only in test environments or manual recovery.
   * Requires explicit acknowledgment flag to prevent accidental calls.
   *
   * @param {string} collectionName
   * @param {number} toNumber - The number to reset to (0 = start fresh)
   * @param {boolean} iAmSure - Must be true to execute
   */
  async reset(collectionName, toNumber = 0, iAmSure = false) {
    if (!iAmSure) {
      throw new AppError(
        'reset() requires iAmSure=true. This is a destructive operation.',
        400
      );
    }
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(
        'reset() is disabled in production. Use manual DB intervention with care.',
        403
      );
    }
    const prefix = this.resolvePrefix(collectionName);
    await IdSequence.findOneAndUpdate(
      { prefix },
      { $set: { current_number: toNumber } },
      { upsert: true }
    );
  }

  /**
   * List all current sequences (for debugging/admin dashboard).
   *
   * @returns {Promise<Array>} Array of { prefix, current_number, collection_name }
   */
  async listAll() {
    return IdSequence.find({}, 'prefix current_number collection_name updatedAt')
      .sort({ prefix: 1 })
      .lean();
  }
}

// Export singleton – whole system uses one instance
export default new IdGeneratorService();
