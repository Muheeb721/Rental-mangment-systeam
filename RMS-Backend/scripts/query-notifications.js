import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set; aborting.');
  process.exit(2);
}

const USER_ID = process.env.USER_ID || null;
const OUT = 'scripts/logs/notifications-sample.txt';

(async () => {
  try {
    await mongoose.connect(uri, { dbName: undefined });
    const db = mongoose.connection.db;
    const col = db.collection('user_notifications');
    const query = USER_ID ? { userId: USER_ID } : {};
    const docs = await col.find(query).sort({ createdAt: -1 }).limit(20).project({ _id: 1, userId: 1, actorType: 1, actorName: 1, entityType: 1, actionType: 1, title: 1, message: 1, status: 1, isRead: 1, createdAt: 1 }).toArray();
    const out = {
      fetchedAt: new Date().toISOString(),
      userIdQueried: USER_ID,
      count: docs.length,
      docs,
    };

    fs.mkdirSync('scripts/logs', { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
    console.log('Wrote', OUT);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Query failed', e.message || e);
    process.exit(1);
  }
})();
