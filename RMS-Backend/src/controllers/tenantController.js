import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import RentPayment from '../models/RentPayment.js';
import RentSettings from '../models/RentSettings.js';
import TenantScore from '../models/TenantScore.js';
import User from '../models/User.js';

const asNumber = (value) => Number(value || 0);

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const ensureSettings = async () => {
  const settings = await RentSettings.findOne({}).lean();
  if (settings) return settings;
  return RentSettings.create({
    defaultDueDay: 10,
    gracePeriodDays: 0,
    gracePeriod: 0,
    lateFeePerDay: 0,
    lateFeeFixed: 0,
    lateFeePercent: 0,
    reminderDaysBefore: 3,
    reminderDays: [7, 3, 1],
    autoGenerate: false,
    currency: 'PKR',
  });
};

const computeScore = (payments = []) => {
  const totalPayments = payments.length;
  if (!totalPayments) {
    return { score: 100, riskLevel: 'low', onTimeRate: 0, avgLateDays: 0, missedCount: 0 };
  }

  const onTimePayments = payments.filter((record) => record.status === 'on_time').length;
  const latePayments = payments.filter((record) => record.status === 'late').length;
  const avgLateDays = payments.reduce((sum, record) => sum + (Number(record.lateDays || 0)), 0) / totalPayments;
  const missedCount = payments.filter((record) => ['overdue', 'pending'].includes(record.status)).length;

  const score = Math.max(0, Math.min(100, 100 - (latePayments * 10) - (avgLateDays * 2) - (missedCount * 25)));
  let riskLevel = 'low';
  if (score < 50) riskLevel = 'high';
  else if (score < 80) riskLevel = 'medium';

  return {
    score: Math.round(score),
    riskLevel,
    onTimeRate: totalPayments ? Number(((onTimePayments / totalPayments) * 100).toFixed(2)) : 0,
    avgLateDays: Number(avgLateDays.toFixed(2)),
    missedCount,
  };
};

const recalculateTenantScore = async (tenantId) => {
  const payments = await RentPayment.find({ tenantId }).sort({ createdAt: -1 }).lean();
  const metrics = computeScore(payments);
  const scoreDoc = await TenantScore.findOneAndUpdate(
    { tenantId },
    { ...metrics, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  return scoreDoc;
};

const buildTenantResponse = (tenant) => ({
  ...tenant,
  id: tenant._id?.toString?.() || tenant.id,
  _id: tenant._id?.toString?.() || tenant.id,
  status: normalizeStatus(tenant.status) === 'left' ? 'left' : 'active',
});

export const createTenant = async (req, res) => {
  try {
    const body = req.body || {};
    if (!String(body.name || body.fullName || '').trim()) return res.status(400).json({ success: false, message: 'Tenant name is required.' });
    if (!(asNumber(body.monthlyRent || body.rent) > 0)) return res.status(400).json({ success: false, message: 'Monthly rent must be greater than zero.' });
    const tenant = await Tenant.create({
      userId: body.userId || null,
      name: body.name || body.fullName || 'New Tenant',
      phone: body.phone || '',
      email: body.email || '',
      cnic: body.cnic || '',
      cnicImage: body.cnicImage || '',
      profileImage: body.profileImage || '',
      propertyId: body.propertyId || body.hostelId || '',
      hostelId: body.hostelId || body.propertyId || '',
      roomNo: body.roomNo || '',
      monthlyRent: asNumber(body.monthlyRent || body.rent),
      securityDeposit: asNumber(body.securityDeposit),
      dueDay: Math.min(28, Math.max(1, asNumber(body.dueDay || 5))),
      moveInDate: body.moveInDate ? new Date(body.moveInDate) : null,
      moveOutDate: body.moveOutDate ? new Date(body.moveOutDate) : null,
      status: normalizeStatus(body.status) === 'left' ? 'left' : 'active',
    });

    const tenantDoc = buildTenantResponse(tenant.toObject ? tenant.toObject() : tenant);
    return res.status(201).json({ success: true, data: tenantDoc });
  } catch (error) {
    console.error('Create tenant failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to create tenant.' });
  }
};

export const listTenants = async (req, res) => {
  try {
    const query = {};
    const search = String(req.query?.search || '').trim();
    const status = String(req.query?.status || '').trim();
    const propertyId = String(req.query?.propertyId || '').trim();
    const roomNo = String(req.query?.roomNo || '').trim();

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { roomNo: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) query.status = normalizeStatus(status) === 'left' ? 'left' : 'active';
    if (propertyId) query.$or = [{ propertyId }, { hostelId: propertyId }];
    if (roomNo) query.roomNo = { $regex: roomNo, $options: 'i' };

    const tenants = await Tenant.find(query).sort({ createdAt: -1 }).lean();
    const result = tenants.map(buildTenantResponse);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('List tenants failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load tenants.' });
  }
};

export const getTenantDetail = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).lean();
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const payments = await RentPayment.find({ tenantId: tenant._id }).sort({ month: 1 }).lean();
    const score = await TenantScore.findOne({ tenantId: tenant._id }).lean();

    return res.json({
      success: true,
      data: { ...buildTenantResponse(tenant), paymentHistory: payments, score, payments },
    });
  } catch (error) {
    console.error('Get tenant detail failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load tenant details.' });
  }
};

export const updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const body = req.body || {};
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(body, 'name')) updates.name = body.name;
    if (Object.prototype.hasOwnProperty.call(body, 'phone')) updates.phone = body.phone || '';
    if (Object.prototype.hasOwnProperty.call(body, 'email')) updates.email = body.email || '';
    if (Object.prototype.hasOwnProperty.call(body, 'cnic')) updates.cnic = body.cnic || '';
    if (Object.prototype.hasOwnProperty.call(body, 'cnicImage')) updates.cnicImage = body.cnicImage || tenant.cnicImage || '';
    if (Object.prototype.hasOwnProperty.call(body, 'profileImage')) updates.profileImage = body.profileImage || tenant.profileImage || '';
    if (Object.prototype.hasOwnProperty.call(body, 'propertyId')) updates.propertyId = body.propertyId || '';
    if (Object.prototype.hasOwnProperty.call(body, 'hostelId')) updates.hostelId = body.hostelId || '';
    if (Object.prototype.hasOwnProperty.call(body, 'roomNo')) updates.roomNo = body.roomNo || '';
    if (Object.prototype.hasOwnProperty.call(body, 'monthlyRent')) updates.monthlyRent = asNumber(body.monthlyRent);
    if (Object.prototype.hasOwnProperty.call(body, 'securityDeposit')) updates.securityDeposit = asNumber(body.securityDeposit);
    if (Object.prototype.hasOwnProperty.call(body, 'dueDay')) updates.dueDay = Math.min(28, Math.max(1, asNumber(body.dueDay || tenant.dueDay || 5)));
    if (Object.prototype.hasOwnProperty.call(body, 'moveInDate')) updates.moveInDate = body.moveInDate ? new Date(body.moveInDate) : null;
    if (Object.prototype.hasOwnProperty.call(body, 'moveOutDate')) updates.moveOutDate = body.moveOutDate ? new Date(body.moveOutDate) : null;
    if (Object.prototype.hasOwnProperty.call(body, 'status')) updates.status = normalizeStatus(body.status) === 'left' ? 'left' : 'active';

    Object.assign(tenant, updates);
    await tenant.save();
    return res.json({ success: true, data: buildTenantResponse(tenant.toObject()) });
  } catch (error) {
    console.error('Update tenant failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to update tenant.' });
  }
};

export const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });
    tenant.status = 'left';
    tenant.moveOutDate = tenant.moveOutDate || new Date();
    await tenant.save();
    return res.json({ success: true, data: buildTenantResponse(tenant.toObject()) });
  } catch (error) {
    console.error('Delete tenant failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to mark tenant as left.' });
  }
};

export const generateMonthlyRentRecords = async (req, res) => {
  try {
    const tenants = await Tenant.find({ status: 'active' }).lean();
    const settings = await ensureSettings();
    const created = [];

    for (const tenant of tenants) {
      const monthKey = new Date().toISOString().slice(0, 7);
      const existing = await RentPayment.findOne({ tenantId: tenant._id, month: monthKey }).lean();
      if (existing) continue;

      const dueDate = new Date();
      dueDate.setDate(tenant.dueDay || 5);
      dueDate.setHours(0, 0, 0, 0);

      const payment = await RentPayment.create({
        tenantId: tenant._id,
        month: monthKey,
        amountDue: asNumber(tenant.monthlyRent),
        amountPaid: 0,
        dueDate,
        paidDate: null,
        status: 'pending',
        lateDays: 0,
        lateFee: 0,
        method: 'cash',
        proofImage: '',
        verifiedByAdmin: false,
        notes: '',
      });

      created.push(payment.toObject());
    }

    await Promise.all(tenants.map((tenant) => recalculateTenantScore(tenant._id)));
    return res.json({ success: true, data: { created, settings } });
  } catch (error) {
    console.error('Generate monthly rent records failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to generate rent records.' });
  }
};

export const listRentPayments = async (req, res) => {
  try {
    const query = {};
    const month = String(req.query?.month || '').trim();
    const status = String(req.query?.status || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();

    if (month) query.month = month;
    if (status) query.status = status;
    if (tenantId) query.tenantId = tenantId;

    const records = await RentPayment.find(query).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: records });
  } catch (error) {
    console.error('List rent payments failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to list rent payments.' });
  }
};

export const recordRentPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const record = await RentPayment.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Rent payment record not found.' });

    const amount = asNumber(body.amount || body.amountPaid || 0);
    if (!(amount > 0)) return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    const method = String(body.method || record.method || 'cash').toLowerCase();
    const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
    const settings = await ensureSettings();
    const dueDate = record.dueDate ? new Date(record.dueDate) : new Date();
    const previousAmountPaid = asNumber(record.amountPaid);
    const totalPaid = previousAmountPaid + amount;

    record.amountPaid = totalPaid;
    record.paidDate = paidDate;
    record.method = ['cash', 'bank', 'jazzcash', 'easypaisa'].includes(method) ? method : 'cash';
    record.proofImage = body.proofImage || record.proofImage || '';
    record.notes = body.notes || record.notes || '';
    record.verifiedByAdmin = Boolean(body.verifiedByAdmin || record.verifiedByAdmin || false);

    const diffDays = Math.max(0, Math.ceil((paidDate - dueDate) / (1000 * 60 * 60 * 24)));
    const gracePeriod = Number(settings.gracePeriodDays || 0);
    const isPartial = totalPaid < asNumber(record.amountDue);

    if (isPartial) {
      record.status = 'partial';
    } else if (paidDate <= new Date(dueDate.getTime() + (gracePeriod * 86400000))) {
      record.status = 'on_time';
      record.lateDays = 0;
      record.lateFee = 0;
    } else {
      record.status = 'late';
      record.lateDays = diffDays;
      record.lateFee = Math.max(0, diffDays * Number(settings.lateFeePerDay || 0));
    }

    await record.save();
    await recalculateTenantScore(record.tenantId);
    return res.json({ success: true, data: record.toObject() });
  } catch (error) {
    console.error('Record rent payment failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to record payment.' });
  }
};

export const updateRentPayment = async (req, res) => {
  try {
    const record = await RentPayment.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Rent payment record not found.' });
    const body = req.body || {};

    if (Object.prototype.hasOwnProperty.call(body, 'amountDue')) record.amountDue = asNumber(body.amountDue);
    if (Object.prototype.hasOwnProperty.call(body, 'amountPaid')) record.amountPaid = asNumber(body.amountPaid);
    if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) record.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (Object.prototype.hasOwnProperty.call(body, 'paidDate')) record.paidDate = body.paidDate ? new Date(body.paidDate) : null;
    if (Object.prototype.hasOwnProperty.call(body, 'method')) record.method = body.method || 'cash';
    if (Object.prototype.hasOwnProperty.call(body, 'proofImage')) record.proofImage = body.proofImage || record.proofImage || '';
    if (Object.prototype.hasOwnProperty.call(body, 'verifiedByAdmin')) record.verifiedByAdmin = Boolean(body.verifiedByAdmin);
    if (Object.prototype.hasOwnProperty.call(body, 'status')) record.status = String(body.status).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(body, 'notes')) record.notes = body.notes || '';

    await record.save();
    await recalculateTenantScore(record.tenantId);
    return res.json({ success: true, data: record.toObject() });
  } catch (error) {
    console.error('Update rent payment failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to update rent payment.' });
  }
};

export const verifyRentPayment = async (req, res) => {
  try {
    const record = await RentPayment.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Rent payment record not found.' });
    record.verifiedByAdmin = true;
    await record.save();
    return res.json({ success: true, data: record.toObject() });
  } catch (error) {
    console.error('Verify rent payment failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to verify payment.' });
  }
};

export const getTenantPaymentHistory = async (req, res) => {
  try {
    const records = await RentPayment.find({ tenantId: req.params.tenantId }).sort({ month: 1 }).lean();
    return res.json({ success: true, data: records });
  } catch (error) {
    console.error('Get tenant payment history failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load payment history.' });
  }
};

export const getOverdueRent = async (req, res) => {
  try {
    const today = new Date();
    const records = await RentPayment.find({
      status: { $in: ['overdue', 'pending', 'late'] },
      dueDate: { $lt: today },
    }).lean();
    return res.json({ success: true, data: records });
  } catch (error) {
    console.error('Get overdue rent failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load overdue rent.' });
  }
};

export const getDashboardSummary = async (req, res) => {
  try {
    const [tenants, payments, scores] = await Promise.all([
      Tenant.find({}).lean(),
      RentPayment.find({}).lean(),
      TenantScore.find({}).lean(),
    ]);

    const expectedRent = payments.reduce((sum, record) => sum + asNumber(record.amountDue), 0);
    const collectedRent = payments.reduce((sum, record) => sum + asNumber(record.amountPaid), 0);
    const pendingCount = payments.filter((record) => ['pending', 'partial'].includes(record.status)).length;
    const overdueCount = payments.filter((record) => ['overdue', 'late'].includes(record.status)).length;

    const highRiskTenants = scores
      .filter((score) => score.riskLevel === 'high')
      .slice(0, 10)
      .map((item) => ({ ...item, tenantId: item.tenantId?.toString?.() }));

    return res.json({
      success: true,
      data: {
        expectedRent,
        collectedRent,
        pendingCount,
        overdueCount,
        totalTenants: tenants.length,
        highRiskTenants,
        monthlyCollection: [],
      },
    });
  } catch (error) {
    console.error('Get dashboard summary failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load rent dashboard summary.' });
  }
};

export const listRentSettings = async (req, res) => {
  try {
    const settings = await ensureSettings();
    return res.json({ success: true, data: settings.toObject ? settings.toObject() : settings });
  } catch (error) {
    console.error('List rent settings failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load settings.' });
  }
};

export const updateRentSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    const settings = await ensureSettings();
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'defaultDueDay')) updates.defaultDueDay = Number(payload.defaultDueDay || 10);
    if (Object.prototype.hasOwnProperty.call(payload, 'gracePeriodDays')) updates.gracePeriodDays = Number(payload.gracePeriodDays || 0);
    if (Object.prototype.hasOwnProperty.call(payload, 'gracePeriod')) updates.gracePeriod = Number(payload.gracePeriod || payload.gracePeriodDays || 0);
    if (Object.prototype.hasOwnProperty.call(payload, 'lateFeePerDay')) updates.lateFeePerDay = Number(payload.lateFeePerDay || 0);
    if (Object.prototype.hasOwnProperty.call(payload, 'lateFeeFixed')) updates.lateFeeFixed = Number(payload.lateFeeFixed || 0);
    if (Object.prototype.hasOwnProperty.call(payload, 'lateFeePercent')) updates.lateFeePercent = Number(payload.lateFeePercent || 0);
    if (Object.prototype.hasOwnProperty.call(payload, 'reminderDaysBefore')) updates.reminderDaysBefore = Number(payload.reminderDaysBefore || 3);
    if (Object.prototype.hasOwnProperty.call(payload, 'reminderDays')) {
      const nextReminderDays = Array.isArray(payload.reminderDays)
        ? payload.reminderDays.map((entry) => Number(entry || 0)).filter((entry) => Number.isFinite(entry))
        : [7, 3, 1];
      updates.reminderDays = nextReminderDays.length ? nextReminderDays : [7, 3, 1];
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'autoGenerate')) updates.autoGenerate = Boolean(payload.autoGenerate);
    if (Object.prototype.hasOwnProperty.call(payload, 'currency')) updates.currency = String(payload.currency || 'PKR');

    Object.assign(settings, updates, { updatedAt: new Date() });
    await settings.save();
    return res.json({ success: true, data: settings.toObject ? settings.toObject() : settings });
  } catch (error) {
    console.error('Update rent settings failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to update settings.' });
  }
};

export const getTenantScore = async (req, res) => {
  try {
    const score = await recalculateTenantScore(req.params.id);
    return res.json({ success: true, data: score.toObject ? score.toObject() : score });
  } catch (error) {
    console.error('Get tenant score failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load tenant score.' });
  }
};
