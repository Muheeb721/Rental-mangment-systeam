import RentRecord from '../models/RentRecord.js';

const isAdmin = (user) => String(user?.role || '').toLowerCase() === 'admin';
const statusFor = (amount, paid, dueDate) => {
  if (amount > 0 && paid >= amount) return 'Paid';
  if (paid > 0) return 'Partial';
  if (dueDate && new Date(dueDate) < new Date()) return 'Overdue';
  return 'Pending';
};

/** POST /api/rents - admins create rent/due records for a user; users may log their own. */
export const createRentRecord = async (req, res) => {
  try {
    const user = req.user || {};
    const body = req.body || {};
    const admin = isAdmin(user);
    const amount = Number(body.monthlyRent ?? body.amount ?? 0);
    const paidAmount = Number(body.paid ?? body.paidAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Rent amount must be greater than zero.' });
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > amount) return res.status(400).json({ success: false, message: 'Paid amount must be between 0 and the rent amount.' });
    if (admin && !body.userId) return res.status(400).json({ success: false, message: 'Choose the tenant (user) for this rent record.' });
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date();
    if (Number.isNaN(dueDate.getTime())) return res.status(400).json({ success: false, message: 'Due date is not valid.' });

    const status = statusFor(amount, paidAmount, dueDate);
    const record = await RentRecord.create({
      userId: admin ? String(body.userId) : String(user.id),
      userName: admin ? String(body.userName || '') : user.name || '',
      propertyId: String(body.propertyId || ''),
      propertyName: String(body.propertyName || ''),
      monthlyRent: amount,
      paid: paidAmount,
      remaining: Math.max(0, amount - paidAmount),
      dueDate,
      month: String(body.month || dueDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })),
      status,
      paymentStatus: status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return res.status(201).json({ success: true, message: 'Rent record created.', data: record });
  } catch (error) {
    console.error('Create rent record failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create rent record.' });
  }
};

export const listRentRecords = async (req, res) => {
  try {
    const filter = isAdmin(req.user) ? {} : { userId: String(req.user.id) };
    if (req.query?.status && req.query.status !== 'all') filter.status = req.query.status;
    const items = await RentRecord.find(filter).sort({ dueDate: -1, createdAt: -1 }).lean();
    // keep overdue status current without a cron job
    const now = new Date();
    const data = items.map((item) => (item.status === 'Pending' && item.dueDate && new Date(item.dueDate) < now ? { ...item, status: 'Overdue', paymentStatus: 'Overdue' } : item));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('List rent records failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load rent records.' });
  }
};

/** PUT/PATCH /api/rents/:id - admin; recomputes remaining and status from the amounts. */
export const updateRentRecord = async (req, res) => {
  try {
    const record = await RentRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Rent record not found.' });
    const body = req.body || {};
    if (body.monthlyRent !== undefined || body.amount !== undefined) {
      const amount = Number(body.monthlyRent ?? body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Rent amount must be greater than zero.' });
      record.monthlyRent = amount;
    }
    if (body.paid !== undefined || body.paidAmount !== undefined) {
      const paid = Number(body.paid ?? body.paidAmount);
      if (!Number.isFinite(paid) || paid < 0) return res.status(400).json({ success: false, message: 'Paid amount must be zero or more.' });
      record.paid = Math.min(paid, record.monthlyRent);
    }
    if (body.markPaid) record.paid = record.monthlyRent;
    if (body.dueDate) {
      const dueDate = new Date(body.dueDate);
      if (Number.isNaN(dueDate.getTime())) return res.status(400).json({ success: false, message: 'Due date is not valid.' });
      record.dueDate = dueDate;
    }
    for (const key of ['month', 'propertyName', 'propertyId', 'userName']) {
      if (body[key] !== undefined) record[key] = String(body[key] || '');
    }
    record.remaining = Math.max(0, record.monthlyRent - record.paid);
    record.status = statusFor(record.monthlyRent, record.paid, record.dueDate);
    record.paymentStatus = record.status;
    record.updatedAt = new Date();
    await record.save();
    return res.json({ success: true, message: 'Rent record updated.', data: record });
  } catch (error) {
    console.error('Update rent record failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update rent record.' });
  }
};

export const deleteRentRecord = async (req, res) => {
  try {
    const removed = await RentRecord.findByIdAndDelete(req.params.id).lean();
    if (!removed) return res.status(404).json({ success: false, message: 'Rent record not found.' });
    return res.json({ success: true, message: 'Rent record deleted.', data: removed });
  } catch (error) {
    console.error('Delete rent record failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete rent record.' });
  }
};

/**
 * POST /api/rents/:id/pay - the tenant submits proof of payment for admin verification.
 * JSON { proofImage?, amount?, method?, transactionId? } or multipart with a `proof` image file.
 */
export const submitRentPayment = async (req, res) => {
  try {
    const record = await RentRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Rent record not found.' });
    if (!isAdmin(req.user) && String(record.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You can only pay your own rent.' });
    }
    if (record.status === 'Paid') return res.status(400).json({ success: false, message: 'This rent is already paid.' });

    const body = req.body || {};
    let proofImage = String(body.proofImage || '').trim();
    const file = req.file || (Array.isArray(req.files) ? req.files[0] : null);
    if (file) {
      const { storePropertyImages } = await import('../utils/propertyMedia.js');
      const [stored] = await storePropertyImages([file]);
      proofImage = stored.url;
    }
    const amount = Number(body.amount ?? record.remaining ?? record.monthlyRent);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    if (!proofImage && !body.transactionId) return res.status(400).json({ success: false, message: 'Attach a payment receipt or enter the transaction ID.' });

    record.set({
      proofImage,
      submittedAmount: amount,
      submittedMethod: String(body.method || 'Bank Transfer'),
      transactionId: String(body.transactionId || ''),
      submittedAt: new Date(),
      verification: 'submitted',
      updatedAt: new Date(),
    });
    await record.save();
    try {
      const { createAdminNotification } = await import('../services/activityService.js');
      await createAdminNotification({
        actionType: 'RENT_PAYMENT_SUBMITTED',
        entityType: 'RENT',
        entityId: `${record._id}-${record.submittedAt.getTime()}`,
        userId: record.userId,
        userName: record.userName,
        title: 'Rent payment submitted',
        message: `${record.userName || 'A tenant'} submitted PKR ${amount.toLocaleString('en-PK')} for ${record.month}${record.propertyName ? ` (${record.propertyName})` : ''}.`,
      });
    } catch (error) {
      console.warn('Rent payment notification failed:', error?.message || error);
    }
    return res.json({ success: true, message: 'Payment submitted for verification.', data: record });
  } catch (error) {
    console.error('Submit rent payment failed', error);
    return res.status(500).json({ success: false, message: 'Unable to submit payment.' });
  }
};

/** POST /api/rents/:id/verify { approve: boolean, note? } - admin verifies a submitted payment. */
export const verifyRentRecordPayment = async (req, res) => {
  try {
    const record = await RentRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Rent record not found.' });
    if (record.verification !== 'submitted') return res.status(400).json({ success: false, message: 'There is no submitted payment to verify.' });
    const approve = req.body?.approve !== false && req.body?.approve !== 'false';
    if (approve) {
      record.paid = Math.min(record.monthlyRent, Number(record.paid || 0) + Number(record.submittedAmount || 0));
      record.remaining = Math.max(0, record.monthlyRent - record.paid);
      record.status = statusFor(record.monthlyRent, record.paid, record.dueDate);
      record.paymentStatus = record.status;
    }
    record.verification = approve ? 'verified' : 'rejected';
    record.adminNote = String(req.body?.note || '').slice(0, 1000);
    record.updatedAt = new Date();
    await record.save();
    try {
      const { logAdminAction } = await import('../services/activityService.js');
      await logAdminAction({
        adminId: req.user.id,
        adminName: req.user.name || 'Admin',
        userId: record.userId,
        userName: record.userName,
        actionType: approve ? 'RENT_PAYMENT_CONFIRMED' : 'RENT_PAYMENT_REJECTED',
        entityType: 'RENT',
        entityId: String(record._id),
        newStatus: record.status,
        message: approve
          ? `Your rent payment for ${record.month} was verified. Status: ${record.status}.`
          : `Your rent payment for ${record.month} could not be verified.${record.adminNote ? ` Reason: ${record.adminNote}` : ''}`,
        propertyName: record.propertyName,
      });
    } catch (error) {
      console.warn('Rent verification notification failed:', error?.message || error);
    }
    return res.json({ success: true, message: approve ? 'Payment verified.' : 'Payment rejected.', data: record });
  } catch (error) {
    console.error('Verify rent payment failed', error);
    return res.status(500).json({ success: false, message: 'Unable to verify payment.' });
  }
};
