import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set; aborting.');
  process.exit(2);
}

(async () => {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const col = db.collection('user_notifications');
    const pipeline = [
      { $group: { _id: '$actionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const agg = await col.aggregate(pipeline).toArray();
    console.log('actionType counts:');
    console.log(agg);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Query failed', e.message || e);
    process.exit(1);
  }
})();
