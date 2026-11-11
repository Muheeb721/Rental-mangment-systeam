import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set; aborting.');
  process.exit(2);
}

(async () => {
  try {
    await mongoose.connect(uri, { dbName: undefined });
    const db = mongoose.connection.db;
    const col = db.collection('user_notifications');
    const items = await col.find({ actionType: 'BOOKING_SUBMITTED' }).sort({ createdAt: -1 }).toArray();
    console.log('Found', items.length, 'BOOKING_SUBMITTED notifications.');
    console.log(items.map(i => ({ _id: i._id, userId: i.userId, actionType: i.actionType, title: i.title, createdAt: i.createdAt })));
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Query failed', e.message || e);
    process.exit(1);
  }
})();
