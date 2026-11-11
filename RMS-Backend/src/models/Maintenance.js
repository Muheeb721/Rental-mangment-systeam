import mongoose from 'mongoose';

const maintenanceSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  propertyId: { type: String, default: '' },
  propertyName: { type: String, default: '' },
  title: { type: String, default: 'Maintenance Request' },
  description: { type: String, default: '' },
  category: { type: String, default: 'General' },
  priority: { type: String, default: 'Medium' },
  status: { type: String, default: 'Open' },
  adminNotes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('Maintenance', maintenanceSchema, 'maintenance_requests');
