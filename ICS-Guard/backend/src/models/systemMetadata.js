import mongoose from 'mongoose';

const systemMetadataSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const SystemMetadata = mongoose.model('SystemMetadata', systemMetadataSchema);

export default SystemMetadata;
