import mongoose from 'mongoose';

/**
 * IdSequence – Common Sequence Table for ID Generation
 *
 * Stores the current sequence number per prefix.
 * Example document: { prefix: 'U', current_number: 5 }
 *
 * Used exclusively by IdGeneratorService via atomic findOneAndUpdate + $inc.
 * Do NOT modify current_number directly – always go through IdGeneratorService.
 */
const idSequenceSchema = new mongoose.Schema(
  {
    prefix: {
      type: String,
      required: true,
      unique: true,      // DB-level uniqueness – one document per prefix
      index: true,
      uppercase: true,
      trim: true,
    },
    current_number: {
      type: Number,
      default: 0,        // Starts at 0; first generated ID will be 1 (→ "X001")
      min: 0,
      max: 999,          // Maximum 3-digit number
    },
    // Human-readable source collection (for auditing/debugging)
    collection_name: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'id_sequences', // Explicit collection name
  }
);

const IdSequence = mongoose.model('IdSequence', idSequenceSchema);

export default IdSequence;
