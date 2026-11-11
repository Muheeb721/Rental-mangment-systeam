import cron from 'node-cron';
import Tenant from '../models/Tenant.js';
import RentPayment from '../models/RentPayment.js';
import TenantScore from '../models/TenantScore.js';

const asNumber = (value) => Number(value || 0);

const generateMonthlyRentForActiveTenants = async () => {
  try {
    const activeTenants = await Tenant.find({ status: 'active' }).lean();
    const monthKey = new Date().toISOString().slice(0, 7);

    for (const tenant of activeTenants) {
      const existing = await RentPayment.findOne({ tenantId: tenant._id, month: monthKey }).lean();
      if (existing) continue;

      const dueDate = new Date();
      dueDate.setDate(tenant.dueDay || 5);
      dueDate.setHours(0, 0, 0, 0);

      await RentPayment.create({
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
    }
  } catch (error) {
    console.error('Monthly rent generation failed:', error);
  }
};

const runReminderSweep = async () => {
  try {
    const records = await RentPayment.find({
      $or: [
        { status: 'pending' },
        { status: 'partial' },
        { status: 'late' },
      ],
    }).lean();

    for (const record of records) {
      const dueDate = record.dueDate ? new Date(record.dueDate) : null;
      if (!dueDate) continue;

      const daysRemaining = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 3 && daysRemaining >= 0 && record.amountPaid < record.amountDue) {
        await TenantScore.findOneAndUpdate(
          { tenantId: record.tenantId },
          { $set: { reminderSentAt: new Date(), updatedAt: new Date() } },
          { upsert: true, new: true },
        );
      }
    }
  } catch (error) {
    console.error('Reminder sweep failed:', error);
  }
};

const markOverdueRent = async () => {
  try {
    const today = new Date();
    const overdueRecords = await RentPayment.find({
      status: { $in: ['pending', 'partial', 'late'] },
      dueDate: { $lt: today },
    });

    for (const record of overdueRecords) {
      record.status = 'overdue';
      record.lateDays = Math.max(record.lateDays || 0, Math.ceil((today - new Date(record.dueDate)) / (1000 * 60 * 60 * 24)));
      await record.save();
    }
  } catch (error) {
    console.error('Overdue rent marking failed:', error);
  }
};

const recalculateScores = async () => {
  try {
    const allTenants = await Tenant.find({ status: 'active' }).lean();
    for (const tenant of allTenants) {
      const payments = await RentPayment.find({ tenantId: tenant._id }).sort({ createdAt: -1 }).lean();
      const totalPayments = payments.length || 1;
      const onTimePayments = payments.filter((entry) => entry.status === 'on_time').length;
      const latePayments = payments.filter((entry) => entry.status === 'late').length;
      const avgLateDays = payments.reduce((sum, entry) => sum + (Number(entry.lateDays || 0)), 0) / totalPayments;
      const missedCount = payments.filter((entry) => ['overdue', 'pending', 'partial'].includes(entry.status)).length;
      const score = Math.max(0, Math.min(100, 100 - (latePayments * 10) - (avgLateDays * 2) - (missedCount * 25)));
      const riskLevel = score < 50 ? 'high' : score < 80 ? 'medium' : 'low';

      await TenantScore.findOneAndUpdate(
        { tenantId: tenant._id },
        { tenantId: tenant._id, score: Math.round(score), riskLevel, updatedAt: new Date() },
        { upsert: true, new: true },
      );
    }
  } catch (error) {
    console.error('Tenant score recalculation failed:', error);
  }
};

export const startRentAutomation = async () => {
  const registry = globalThis.__rmsRentAutomation || { jobs: new Map(), started: false };
  if (registry.started) return registry;

  registry.started = true;
  globalThis.__rmsRentAutomation = registry;

  const jobs = [
    ['monthlyRent', cron.schedule('0 0 1 * *', async () => { await generateMonthlyRentForActiveTenants(); }, { timezone: 'UTC' })],
    ['reminders', cron.schedule('0 9 * * *', async () => { await runReminderSweep(); }, { timezone: 'UTC' })],
    ['overdue', cron.schedule('0 0 * * *', async () => { await markOverdueRent(); }, { timezone: 'UTC' })],
    ['scores', cron.schedule('0 3 * * *', async () => { await recalculateScores(); }, { timezone: 'UTC' })],
  ];

  jobs.forEach(([name, job]) => {
    registry.jobs.set(name, job);
    job.start();
  });

  await generateMonthlyRentForActiveTenants();
  await runReminderSweep();
  await markOverdueRent();
  await recalculateScores();

  return registry;
};

export default startRentAutomation;
