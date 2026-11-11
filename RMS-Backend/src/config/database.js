import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer = null;

const mongoConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 5000,
  retryWrites: false,
};

export async function connectDatabase({ ephemeral = false } = {}) {
  const mongoUri = process.env.MONGODB_URI?.trim();

  mongoose.set('strictQuery', true);

  if (mongoUri && !ephemeral) {
    try {
      await mongoose.connect(mongoUri, mongoConnectOptions);
      console.log('MongoDB connected');
      return;
    } catch (error) {
      console.warn('Primary MongoDB connection failed; trying persistent local MongoDB.', error?.message || error);

      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
      } catch (disconnectError) {
        console.warn('Mongo disconnect cleanup failed:', disconnectError?.message || disconnectError);
      }
    }
  }

  if (!ephemeral) {
    const localUri = process.env.RMS_LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/rms_local';
    try {
      await mongoose.connect(localUri, mongoConnectOptions);
      console.log('MongoDB connected to persistent local database');
      return;
    } catch (error) {
      console.error('Persistent local MongoDB connection failed:', error?.message || error);
      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
      } catch (disconnectError) {
        console.warn('Mongo disconnect cleanup failed:', disconnectError?.message || disconnectError);
      }
      throw new Error(
        'MongoDB is unavailable. Configure MONGODB_URI or start the local MongoDB service before starting RMS.',
        { cause: error },
      );
    }
  }

  if (!memoryServer) {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'rms_local',
      },
    });
  }

  const fallbackUri = memoryServer.getUri();
  await mongoose.connect(fallbackUri, mongoConnectOptions);
  console.log('MongoDB connected to ephemeral test database');
}

export async function closeDatabase() {
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
