import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set in environment; aborting.');
  process.exit(2);
}

(async () => {
  try {
    await mongoose.connect(uri, { dbName: undefined });
    console.log('Connected to MongoDB (connection established).');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);
    console.log('Collections:', names.join(', '));

    const toCheck = ['users', 'properties', 'bookings', 'payments', 'favorites', 'saved_searches', 'usernotifications', 'user_notifications', 'user_notifications', 'notifications', 'admin_actions', 'adminactionlogs', 'admin_action_logs', 'adminactionlogs', 'admin_action_logs', 'adminactionlogs'];
    const found = {};
    for (const n of toCheck) {
      if (!names.includes(n)) continue;
      const col = db.collection(n);
      const count = await col.countDocuments();
      const sample = await col.find({}).sort({ createdAt: -1 }).limit(3).project({ _id: 1, createdAt: 1 }).toArray();
      found[n] = { count, sample };
    }

    // Generic fallback: list counts for all collections
    const summary = {};
    for (const c of collections) {
      const col = db.collection(c.name);
      const count = await col.countDocuments();
      summary[c.name] = count;
    }

    console.log('\nFound collection summaries (showing selective counts):');
    console.log(JSON.stringify(found, null, 2));
    console.log('\nAll collection counts:');
    console.log(JSON.stringify(summary, null, 2));

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Mongo audit failed', e.message || e);
    process.exit(1);
  }
})();
