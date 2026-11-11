import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import { logAdminAction, createAdminNotification } from '../services/activityService.js';

export const PAYMENT_STATUSES = ['Pending', 'Approved', 'Rejected', 'Refunded'];
export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'JazzCash', 'Easypaisa', 'Card', 'Cheque', 'Other'];

const isAdmin = (user) => String(user?.role || '').toLowerCase() === 'admin';

export const normalizePaymentStatus = (value, fallback = 'Pending') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['approved', 'paid', 'success', 'completed', 'verified'].includes(normalized)) return 'Approved';
  if (['rejected', 'failed', 'cancelled', 'canceled', 'declined'].includes(normalized)) return 'Rejected';
  if (['refunded', 'refund'].includes(normalized)) return 'Refunded';
  if (['pending', 'processing', 'submitted'].includes(normalized)) return 'Pending';
  return fallback;
};

const normalizeMethod = (value) => {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!key) return 'Other';
  const map = { cash: 'Cash', bank: 'Bank Transfer', banktransfer: 'Bank Transfer', jazzcash: 'JazzCash', easypaisa: 'Easypaisa', card: 'Card', creditcard: 'Card', debitcard: 'Card', cheque: 'Cheque', check: 'Cheque' };
  return map[key] || PAYMENT_METHODS.find((method) => method.toLowerCase().replace(/[^a-z]/g, '') === key) || 'Other';
};

/** POST /api/payments - users submit a payment for review (always Pending); admins may record one for any user. */
export const createPayment = async (req, res) => {
  try {
    const user = req.user || {};
    const body = req.body || {};
    const admin = isAdmin(user);

    const amount = Number(body.amountPaid ?? body.amount ?? body.totalAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    const totalAmount = Number(body.totalAmount || amount);

    let booking = null;
    if (body.bookingId && mongoose.isValidObjectId(body.bookingId)) {
      booking = await Booking.findById(body.bookingId).lean();
      if (booking && !admin && String(booking.userId) !== String(user.id)) {
        return res.status(403).json({ success: false, message: 'You can only pay for your own bookings.' });
      }
    }
    let propertyName = String(body.propertyName || body.propertyTitle || booking?.propertyTitle || '');
    const propertyId = String(body.propertyId || booking?.propertyId || '');
    if (!propertyName && mongoose.isValidObjectId(propertyId)) {
      propertyName = (await Property.findById(propertyId).select('title').lean())?.title || '';
    }

    const payment = await Payment.create({
      userId: admin && body.userId ? String(body.userId) : String(user.id),
      userName: (admin ? body.userName : '') || booking?.userName || body.userName || user.name || '',
      userEmail: (admin ? body.userEmail : '') || booking?.userEmail || user.email || '',
      userPhone: String(body.userPhone || body.phone || booking?.userPhone || ''),
      bookingId: String(body.bookingId || ''),
      propertyId,
      propertyName,
      propertyType: String(body.propertyType || booking?.propertyType || ''),
      amount,
      totalAmount,
      amountPaid: amount,
      advanceAmount: Number(body.advanceAmount || 0),
      remainingAmount: Math.max(0, totalAmount - amount),
      paymentType: String(body.paymentType || 'Rent'),
      method: normalizeMethod(body.method),
      transactionId: String(body.transactionId || body.reference || ''),
      reference: String(body.reference || body.transactionId || ''),
      status: admin ? normalizePaymentStatus(body.status, 'Approved') : 'Pending',
      notes: String(body.notes || '').slice(0, 2000),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
    });

    if (!admin) {
      try {
        await createAdminNotification({
          actionType: 'PAYMENT_SUBMITTED',
          entityType: 'PAYMENT',
          entityId: payment._id.toString(),
          userId: payment.userId,
          userName: payment.userName,
          title: 'Payment submitted',
          message: `${payment.userName || 'A user'} submitted a payment of PKR ${payment.amount.toLocaleString('en-PK')}${payment.propertyName ? ` for ${payment.propertyName}` : ''}.`,
        });
      } catch (error) {
        console.warn('Payment notification failed:', error?.message || error);
      }
    }
    return res.status(201).json({ success: true, message: admin ? 'Payment recorded.' : 'Payment submitted for review.', data: payment });
  } catch (error) {
    console.error('Create payment failed', error);
    return res.status(500).json({ success: false, message: 'Unable to record payment.' });
  }
};

export const listMyPayments = async (req, res) => {
  try {
    const items = await Payment.find({ userId: String(req.user.id) }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List my payments failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load payments.' });
  }
};

export const listAllPayments = async (req, res) => {
  try {
    const { status } = req.query || {};
    const filter = {};
    if (status && status !== 'all') filter.status = normalizePaymentStatus(status, status);
    const items = await Payment.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List all payments failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list payments.' });
  }
};

const notifyPaymentStatus = async (req, payment, previousStatus) => {
  try {
    await logAdminAction({
      adminId: req.user.id,
      adminName: req.user.name || 'Admin',
      adminEmail: req.user.email || '',
      userId: payment.userId,
      userName: payment.userName,
      actionType: payment.status === 'Approved' ? 'PAYMENT_APPROVED' : payment.status === 'Rejected' ? 'PAYMENT_REJECTED' : 'PAYMENT_STATUS_CHANGED',
      entityType: 'PAYMENT',
      entityId: String(payment._id),
      previousStatus,
      newStatus: payment.status,
      reason: payment.reason || '',
      message: `Your payment of PKR ${Number(payment.amount || 0).toLocaleString('en-PK')}${payment.propertyName ? ` for ${payment.propertyName}` : ''} was ${payment.status.toLowerCase()}.${payment.reason ? ` Reason: ${payment.reason}` : ''}`,
      propertyName: payment.propertyName,
    });
  } catch (error) {
    console.warn('Payment status notification failed:', error?.message || error);
  }
};

/** PUT/PATCH/POST /api/payments/:id/status { status, reason } - admin. */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'Payment not found.' });
    const status = normalizePaymentStatus(req.body?.status, '');
    if (!status) return res.status(400).json({ success: false, message: `Status must be one of: ${PAYMENT_STATUSES.join(', ')}.` });
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });

    const previousStatus = payment.status;
    payment.status = status;
    payment.reason = String(req.body?.reason || '').slice(0, 1000);
    payment.updatedAt = new Date();
    await payment.save();

    if (payment.bookingId && mongoose.isValidObjectId(payment.bookingId)) {
      const paymentStatus = status === 'Approved' ? 'Paid' : status === 'Rejected' ? 'Failed' : status;
      await Booking.updateOne({ _id: payment.bookingId }, { $set: { paymentStatus, updatedAt: new Date() } });
    }
    if (previousStatus !== status) await notifyPaymentStatus(req, payment, previousStatus);
    return res.json({ success: true, message: `Payment marked as ${status}.`, data: payment, previousStatus });
  } catch (error) {
    console.error('Update payment status failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update payment status.' });
  }
};

/** PUT /api/payments/:id - admin edits payment details. */
export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'Payment not found.' });
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    const body = req.body || {};
    const previousStatus = payment.status;

    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
      payment.amount = amount;
      payment.amountPaid = amount;
      payment.remainingAmount = Math.max(0, Number(payment.totalAmount || amount) - amount);
    }
    if (body.method !== undefined) payment.method = normalizeMethod(body.method);
    if (body.status !== undefined) {
      const status = normalizePaymentStatus(body.status, '');
      if (!status) return res.status(400).json({ success: false, message: `Status must be one of: ${PAYMENT_STATUSES.join(', ')}.` });
      payment.status = status;
    }
    for (const key of ['transactionId', 'reference', 'notes', 'reason', 'paymentType', 'propertyName', 'userName']) {
      if (body[key] !== undefined) payment[key] = String(body[key] || '').slice(0, 2000);
    }
    if (body.paymentDate) payment.paymentDate = new Date(body.paymentDate);
    payment.updatedAt = new Date();
    await payment.save();
    if (previousStatus !== payment.status) await notifyPaymentStatus(req, payment, previousStatus);
    return res.json({ success: true, message: 'Payment updated.', data: payment });
  } catch (error) {
    console.error('Update payment failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update payment.' });
  }
};

export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'Payment not found.' });
    const removed = await Payment.findByIdAndDelete(id).lean();
    if (!removed) return res.status(404).json({ success: false, message: 'Payment not found.' });
    return res.json({ success: true, message: 'Payment deleted.', data: removed });
  } catch (error) {
    console.error('Delete payment failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete payment.' });
  }
};
