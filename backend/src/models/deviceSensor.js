import mongoose from 'mongoose';

const deviceSensorSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    ref: 'Device',
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'OFFLINE', 'ERROR'],
    default: 'ACTIVE',
  },
  config: {
    min: Number,
    max: Number,
    unit: String,
  }
}, {
  timestamps: true,
});

const DeviceSensor = mongoose.model('DeviceSensor', deviceSensorSchema);

export default DeviceSensor;
