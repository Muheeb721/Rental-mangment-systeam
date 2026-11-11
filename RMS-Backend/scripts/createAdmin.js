import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { closeDatabase, connectDatabase } from '../src/config/database.js';
import User from '../src/models/User.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const email = 'admin@rental.com';
const password = 'Admin@12345';

const main = async () => {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing from RMS-BACKEND/.env.');
  }

  await connectDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const result = await User.updateOne(
    { email },
    {
      $set: { role: 'admin', passwordHash, updatedAt: now },
      $setOnInsert: {
        name: 'System Admin',
        email,
        phone: '',
        profile: { name: 'System Admin', email, phone: '' },
        createdAt: now,
      },
    },
    { upsert: true, runValidators: true },
  );

  console.log(result.upsertedCount
    ? `Created admin account for ${email}.`
    : `Reset admin account for ${email}.`);
};

main()
  .catch((error) => {
    console.error('Unable to create or reset admin account:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
