import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: 'IoT Device',
  },
  zone: {
    type: String,
    default: 'Zone-A',
  },
  ipAddress: {
    type: String,
    required: true,
  },
  ip_address: {
    type: String,
  },
  macAddress: {
    type: String,
    required: true,
  },
  mac_address: {
    type: String,
  },
  status: {
    type: String,
    enum: ['active', 'isolated', 'online', 'offline', 'quarantined'],
    default: 'active',
  },
  risk_score: {
    type: Number,
    default: 0,
  },
  api_key: {
    type: String,
  },
  baseline_metrics: {
    bytes_per_second_max: { type: Number, default: 25000 },
    connection_rate_max: { type: Number, default: 20 },
  },
  firmware_version: {
    type: String,
  },
  hardware_model: {
    type: String,
  },
  node_type: {
    type: String,
    enum: ['gateway', 'controller', 'chip', 'sensor', 'actuator'],
    default: 'sensor',
  },
  parent_id: {
    type: String,
    default: null,
  },
  icon_path: {
    type: String,
    default: 'Cpu',
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  _id: false, // Use our custom String _id
});

// Middleware to keep ipAddress/ip_address and macAddress/mac_address synced
deviceSchema.pre('save', function (next) {
  if (this.ipAddress && !this.ip_address) this.ip_address = this.ipAddress;
  if (this.ip_address && !this.ipAddress) this.ipAddress = this.ip_address;
  if (this.macAddress && !this.mac_address) this.mac_address = this.macAddress;
  if (this.mac_address && !this.macAddress) this.macAddress = this.mac_address;
  next();
});

const Device = mongoose.model('Device', deviceSchema);

export default Device;
