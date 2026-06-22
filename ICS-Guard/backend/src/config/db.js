import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ics_guard';
    console.log(`[Database] Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}...`);
    await mongoose.connect(mongoUri);
    console.log('[Database] MongoDB connected successfully.');
  } catch (error) {
    console.error('[Database] MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
