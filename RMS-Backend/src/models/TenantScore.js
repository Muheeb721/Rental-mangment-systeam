import mongoose from 'mongoose';

const tenantScoreSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
  score: { type: Number, default: 100, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  onTimeRate: { type: Number, default: 0 },
  avgLateDays: { type: Number, default: 0 },
  missedCount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('TenantScore', tenantScoreSchema, 'tenant_scores');
