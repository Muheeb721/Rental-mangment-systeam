import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import RentApplication from '../models/RentApplication.js';
import Maintenance from '../models/Maintenance.js';
import ContactRequest from '../models/ContactRequest.js';
import Review from '../models/Review.js';
import Favorite from '../models/Favorite.js';
import RentPayment from '../models/RentPayment.js';
import Tenant from '../models/Tenant.js';
import RentalProfile from '../models/RentalProfile.js';
import SavedSearch from '../models/SavedSearch.js';
import UserNotification from '../models/UserNotification.js';
import AdminActionLog from '../models/AdminActionLog.js';
import { logAdminAction } from '../services/activityService.js';

export const USER_ROLES = ['resident', 'owner', 'admin'];
export const USER_STATUSES = ['Active', 'Blocked'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const lastMonths = (count) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return { key: monthKey(date), label: date.toLocaleString('en-US', { month: 'short', year: '2-digit' }), start: date };
  });
};

const groupCount = async (Model, field, match = {}) => {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  return rows.map((row) => ({ label: row._id || 'Unknown', value: row.count }));
};

const APPROVED_PAYMENT = /^(approved|paid|completed|success)$/i;

/** GET /api/admin/analytics (also /api/admin/dashboard) - real numbers from the database. */
export const getAdminAnalytics = async (req, res) => {
  try {
    const months = lastMonths(6);
    const since = months[0].start;

    const [
      totalProperties, totalUsers, totalBookings, totalApplications,
      propertiesByType, propertiesByStatus, propertiesByPurpose,
      bookingsByStatus, applicationsByStatus, maintenanceByStatus,
      pendingBookings, pendingApplications, pendingPayments, openMaintenance, newMessages, totalReviews,
      totalFavorites, paymentsAgg, rentAgg, revenueByMonthRows, rentCollectedRows, signupRows, bookingRows,
      recentBookings, recentUsers, recentActivity, featuredCount,
    ] = await Promise.all([
      Property.countDocuments({}),
      User.countDocuments({ archived: { $ne: true } }),
      Booking.countDocuments({}),
      RentApplication.countDocuments({}),
      groupCount(Property, 'propertyType'),
      groupCount(Property, 'status'),
      groupCount(Property, 'purpose'),
      groupCount(Booking, 'status'),
      groupCount(RentApplication, 'applicationStatus'),
      groupCount(Maintenance, 'status'),
      Booking.countDocuments({ status: /^pending/i }),
      RentApplication.countDocuments({ applicationStatus: 'pending' }),
      Payment.countDocuments({ status: /^pending/i }),
      Maintenance.countDocuments({ status: { $not: /^(resolved|closed|completed|rejected)$/i } }),
      ContactRequest.countDocuments({ status: /^new$/i }),
      Review.countDocuments({}),
      Favorite.countDocuments({}),
      Payment.aggregate([{ $match: { status: APPROVED_PAYMENT } }, { $group: { _id: null, total: { $sum: { $ifNull: ['$amountPaid', '$amount'] } } } }]),
      RentPayment.aggregate([{ $group: { _id: null, due: { $sum: '$amountDue' }, paid: { $sum: '$amountPaid' } } }]),
      Payment.aggregate([
        { $match: { status: APPROVED_PAYMENT, paymentDate: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } }, total: { $sum: { $ifNull: ['$amountPaid', '$amount'] } } } },
      ]),
      RentPayment.aggregate([
        { $match: { amountPaid: { $gt: 0 } } },
        { $group: { _id: '$month', total: { $sum: '$amountPaid' } } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      Booking.find({}).sort({ createdAt: -1 }).limit(6).lean(),
      User.find({ archived: { $ne: true } }).select('name email role status createdAt').sort({ createdAt: -1 }).limit(6).lean(),
      AdminActionLog.find({ actionType: { $nin: ['USER_LOGIN'] } }).sort({ createdAt: -1 }).limit(10).lean(),
      Property.countDocuments({ isFeatured: true }),
    ]);

    const statusCount = (label) => propertiesByStatus.find((row) => String(row.label).toLowerCase() === label.toLowerCase())?.value || 0;
    const revenueMap = Object.fromEntries(revenueByMonthRows.map((row) => [row._id, row.total]));
    const rentMap = Object.fromEntries(rentCollectedRows.map((row) => [row._id, row.total]));
    const signupMap = Object.fromEntries(signupRows.map((row) => [row._id, row.count]));
    const bookingMap = Object.fromEntries(bookingRows.map((row) => [row._id, row.count]));

    const occupied = statusCount('Booked') + statusCount('Rented');
    const rentableTotal = Math.max(1, totalProperties - statusCount('Inactive') - statusCount('Sold'));

    const summary = {
      totalProperties,
      availableProperties: statusCount('Available'),
      bookedProperties: statusCount('Booked'),
      rentedProperties: statusCount('Rented'),
      soldProperties: statusCount('Sold'),
      inactiveProperties: statusCount('Inactive'),
      featuredProperties: featuredCount,
      occupancyRate: Math.round((occupied / rentableTotal) * 100),
      totalUsers,
      totalBookings,
      totalApplications,
      pendingBookings,
      pendingApplications,
      pendingPayments,
      openMaintenance,
      newMessages,
      totalReviews,
      totalFavorites,
      totalRevenue: paymentsAgg[0]?.total || 0,
      rentDue: rentAgg[0]?.due || 0,
      rentCollected: rentAgg[0]?.paid || 0,
      rentOutstanding: Math.max(0, (rentAgg[0]?.due || 0) - (rentAgg[0]?.paid || 0)),
    };

    return res.json({
      success: true,
      data: {
        summary,
        ...summary,
        charts: {
          revenueByMonth: months.map((month) => ({ label: month.label, month: month.key, payments: revenueMap[month.key] || 0, rent: rentMap[month.key] || 0, value: (revenueMap[month.key] || 0) + (rentMap[month.key] || 0) })),
          signupsByMonth: months.map((month) => ({ label: month.label, value: signupMap[month.key] || 0 })),
          bookingsByMonth: months.map((month) => ({ label: month.label, value: bookingMap[month.key] || 0 })),
          propertiesByType,
          propertiesByStatus,
          propertiesByPurpose,
          bookingsByStatus,
          applicationsByStatus,
          maintenanceByStatus,
        },
        recentBookings,
        recentUsers,
        recentActivity: recentActivity.map((item) => ({
          id: item._id,
          action: item.actionType,
          details: item.message || item.description || '',
          actor: item.adminName,
          timestamp: item.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Admin analytics fetch failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load admin analytics.' });
  }
};

export const getAdminDashboard = getAdminAnalytics;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const safeUser = (user) => {
  if (!user) return null;
  const plain = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete plain.passwordHash;
  return { ...plain, id: String(plain._id) };
};

/** GET /api/admin/users?q=&role=&status=&page=&limit= */
export const getAdminUsers = async (req, res) => {
  try {
    const { q, role, status, includeDeleted } = req.query || {};
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 500, 1), 1000);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const filter = {};
    if (includeDeleted !== 'true') filter.archived = { $ne: true };
    if (q) {
      const regex = new RegExp(escapeRegex(String(q).trim()), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }, { username: regex }];
    }
    if (role && role !== 'all') filter.role = String(role).toLowerCase();
    if (status && status !== 'all') filter.status = new RegExp(`^${escapeRegex(status)}$`, 'i');

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return res.json({ success: true, data: users.map(safeUser), meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error('Admin users fetch failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load users.' });
  }
};

/** GET /api/admin/users/:id - profile plus activity counts. */
export const getAdminUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'User not found.' });
    const user = await User.findById(id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const userId = String(user._id);
    const [bookings, applications, payments, maintenance, favorites, savedSearches, rentalProfile, reviews] = await Promise.all([
      Booking.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
      RentApplication.find({ userId }).sort({ submittedAt: -1 }).limit(20).lean(),
      Payment.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
      Maintenance.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
      Favorite.countDocuments({ userId }),
      SavedSearch.countDocuments({ userId }),
      RentalProfile.findOne({ userId }).lean(),
      Review.countDocuments({ userId }),
    ]);
    return res.json({
      success: true,
      data: { user: safeUser(user), rentalProfile, bookings, applications, payments, maintenance, counts: { favorites, savedSearches, reviews, bookings: bookings.length, applications: applications.length, payments: payments.length } },
    });
  } catch (error) {
    console.error('Admin user detail failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load user.' });
  }
};

const validateUserInput = (body, { partial }) => {
  const errors = {};
  const values = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (name.length < 2) errors.name = 'Name must be at least 2 characters.';
    values.name = name;
  }
  if (!partial || body.email !== undefined) {
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address.';
    values.email = email;
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone || '').trim();
    if (phone && !/^\+?[\d\s-]{7,20}$/.test(phone)) errors.phone = 'Enter a valid phone number.';
    values.phone = phone;
  }
  if (!partial || body.role !== undefined) {
    const role = String(body.role || 'resident').toLowerCase();
    if (!USER_ROLES.includes(role)) errors.role = `Role must be one of: ${USER_ROLES.join(', ')}.`;
    values.role = role;
  }
  if (body.status !== undefined) {
    const status = USER_STATUSES.find((item) => item.toLowerCase() === String(body.status).toLowerCase());
    if (!status) errors.status = `Status must be one of: ${USER_STATUSES.join(', ')}.`;
    values.status = status;
  }
  if (!partial || body.password) {
    if (String(body.password || '').length < 8) errors.password = 'Password must be at least 8 characters.';
  }
  return { values, errors };
};

const firstError = (errors) => Object.values(errors)[0];

export const createAdminUser = async (req, res) => {
  try {
    const body = req.body || {};
    const { values, errors } = validateUserInput(body, { partial: false });
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: firstError(errors), errors });

    const existing = await User.findOne({ email: values.email }).lean();
    if (existing) return res.status(409).json({ success: false, message: 'A user with that email already exists.' });

    const passwordHash = await bcrypt.hash(String(body.password), 10);
    const user = await User.create({
      ...values,
      username: `${values.email.split('@')[0]}-${Date.now().toString(36)}`,
      passwordHash,
      status: values.status || 'Active',
      profile: { name: values.name, email: values.email, phone: values.phone || '' },
      archived: false,
    });
    await logAdminAction({ adminId: req.user.id, adminName: req.user.name, actionType: 'USER_CREATED', entityType: 'USER', entityId: String(user._id), message: `User ${user.email} was created by admin.` });
    return res.status(201).json({ success: true, message: 'User created successfully.', data: safeUser(user) });
  } catch (error) {
    console.error('Create admin user failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create user.' });
  }
};

export const updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'User not found.' });
    const body = req.body || {};
    const { values, errors } = validateUserInput(body, { partial: true });
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: firstError(errors), errors });

    const user = await User.findById(id).select('+passwordHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const isSelf = String(user._id) === String(req.user.id);
    if (isSelf && values.role && values.role !== 'admin') return res.status(400).json({ success: false, message: 'You cannot remove your own admin role.' });
    if (isSelf && values.status === 'Blocked') return res.status(400).json({ success: false, message: 'You cannot block your own account.' });
    if (user.role === 'admin' && ((values.role && values.role !== 'admin') || values.status === 'Blocked')) {
      const otherAdmins = await User.countDocuments({ role: 'admin', status: { $ne: 'Blocked' }, archived: { $ne: true }, _id: { $ne: user._id } });
      if (!otherAdmins) return res.status(400).json({ success: false, message: 'At least one active admin account is required.' });
    }
    if (values.email && values.email !== user.email) {
      const taken = await User.exists({ email: values.email, _id: { $ne: user._id } });
      if (taken) return res.status(409).json({ success: false, message: 'Another user already uses that email.' });
    }

    const previousStatus = user.status;
    const previousRole = user.role;
    user.set(values);
    if (values.name || values.email || values.phone !== undefined) {
      user.profile = { ...(user.profile || {}), name: user.name, email: user.email, phone: user.phone };
    }
    if (body.password) user.passwordHash = await bcrypt.hash(String(body.password), 10);
    await user.save();

    const changes = [];
    if (values.status && values.status !== previousStatus) changes.push(`status ${previousStatus} → ${values.status}`);
    if (values.role && values.role !== previousRole) changes.push(`role ${previousRole} → ${values.role}`);
    await logAdminAction({
      adminId: req.user.id,
      adminName: req.user.name,
      userId: changes.length ? String(user._id) : '',
      userName: user.name,
      actionType: values.status === 'Blocked' ? 'USER_BLOCKED' : values.status === 'Active' && previousStatus !== 'Active' ? 'USER_UNBLOCKED' : 'USER_UPDATED',
      entityType: 'USER',
      entityId: String(user._id),
      previousStatus,
      newStatus: user.status,
      message: changes.length ? `Your account was updated by the admin (${changes.join(', ')}).` : `User ${user.email} was updated.`,
    });
    return res.json({ success: true, message: 'User updated successfully.', data: safeUser(user) });
  } catch (error) {
    console.error('Update admin user failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update user.' });
  }
};

/** DELETE /api/admin/users/:id - permanently deletes the user and their personal records. */
export const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'User not found.' });
    if (String(id) === String(req.user.id)) return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    const user = await User.findById(id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'admin') {
      const otherAdmins = await User.countDocuments({ role: 'admin', archived: { $ne: true }, _id: { $ne: user._id } });
      if (!otherAdmins) return res.status(400).json({ success: false, message: 'At least one admin account is required.' });
    }
    const userId = String(user._id);
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      Favorite.deleteMany({ userId }),
      SavedSearch.deleteMany({ userId }),
      UserNotification.deleteMany({ userId, recipientRole: { $ne: 'admin' } }),
      RentalProfile.deleteMany({ userId }),
    ]);
    await logAdminAction({ adminId: req.user.id, adminName: req.user.name, actionType: 'USER_DELETED', entityType: 'USER', entityId: userId, message: `User ${user.email} was deleted by admin.` });
    return res.json({ success: true, message: 'User deleted.', data: { id: userId } });
  } catch (error) {
    console.error('Delete admin user failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete user.' });
  }
};

// kept for backwards compatibility with older imports
export const archiveAdminUser = deleteAdminUser;

/** GET /api/admin/tenants-overview - tenants with property names (used by rent pages). */
export const listTenantsWithProperties = async (_req, res) => {
  try {
    const tenants = await Tenant.find({}).sort({ createdAt: -1 }).lean();
    const ids = tenants.map((tenant) => tenant.propertyId).filter((id) => mongoose.isValidObjectId(id));
    const properties = await Property.find({ _id: { $in: ids } }).select('title').lean();
    const titles = Object.fromEntries(properties.map((property) => [String(property._id), property.title]));
    return res.json({ success: true, data: tenants.map((tenant) => ({ ...tenant, propertyTitle: titles[tenant.propertyId] || '' })) });
  } catch (error) {
    console.error('List tenants overview failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load tenants.' });
  }
};
