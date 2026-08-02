/**
 * autoIdPlugin – Mongoose Schema Plugin for Automatic ID Generation
 *
 * Attach this plugin to any Mongoose schema that needs a custom string _id
 * in the format [PREFIX][001-999].
 *
 * Usage in a Model:
 *   import { autoIdPlugin } from './plugins/autoIdPlugin.js';
 *
 *   const mySchema = new mongoose.Schema({ ... }, { _id: false });
 *   mySchema.plugin(autoIdPlugin, { collection: 'devices' });
 *
 * Or using the collection name from the model:
 *   mySchema.plugin(autoIdPlugin);  // auto-detects from model name
 *
 * The plugin:
 *   1. Adds `_id: { type: String }` to the schema if not already defined
 *   2. Registers a pre-validate hook that calls idGeneratorService.generate()
 *      only when _id is absent (new document without a pre-assigned ID)
 *   3. Does NOT override a manually assigned _id
 */

import idGeneratorService from '../../services/idGeneratorService.js';

/**
 * @param {mongoose.Schema} schema
 * @param {Object} [options]
 * @param {string} [options.collection] - Override collection name for prefix resolution
 */
export function autoIdPlugin(schema, options = {}) {
  // Add _id as String type if the schema doesn't declare it
  if (!schema.paths._id) {
    schema.add({
      _id: {
        type: String,
        required: false, // Will be filled in pre-validate
      },
    });
  }

  /**
   * pre('validate') fires before Mongoose validation.
   * Using validate (not save) ensures _id is set before uniqueness validation.
   */
  schema.pre('validate', async function (next) {
    // Only generate if this is a new document and _id is missing
    if (this.isNew && !this._id) {
      try {
        // Determine collection name:
        //   1. Explicit option  2. Model name (lowercased + pluralized naively)
        const collectionName =
          options.collection ||
          (this.constructor?.modelName
            ? this.constructor.modelName.toLowerCase() + 's'
            : 'unknown');

        this._id = await idGeneratorService.generate(collectionName);
      } catch (err) {
        return next(err);
      }
    }
    next();
  });
}

export default autoIdPlugin;
