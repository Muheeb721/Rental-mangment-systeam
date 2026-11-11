import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rms-dev';

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  const password = 'Passw0rd!';
  const hash = await bcrypt.hash(password, 10);

  const userData = {
    _id: 'test-user-42',
    name: 'Tester',
    email: 'testuser42@example.com',
    passwordHash: hash,
    role: 'resident',
    phone: '+923001111111',
    profile: { name: 'Tester', email: 'testuser42@example.com', phone: '+923001111111' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const existing = await User.findById(userData._id).lean();
    if (existing) {
      console.log('User already exists:', existing._id);
    } else {
      const user = await User.create(userData);
      console.log('Created user:', user._id);
    }
  } catch (e) {
    console.error('Create user failed', e);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
