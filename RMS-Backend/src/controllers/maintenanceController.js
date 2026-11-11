import mongoose from 'mongoose';
import Maintenance from '../models/Maintenance.js';
import Property from '../models/Property.js';
import { createAdminNotification, logAdminAction } from '../services/activityService.js';

export const MAINTENANCE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
export const MAINTENANCE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const MAINTENANCE_CATEGORIES = ['General', 'Plumbing', 'Electrical', 'Appliances', 'HVAC', 'Painting', 'Carpentry', 'Pest Control', 'Cleaning', 'Security', 'Other'];

const pick = (list, value, fallback) => list.find((item) => item.toLowerCase() === String(value || '').trim().toLowerCase()) || fallback;
const isAdmin = (user) => String(user?.role || '').toLowerCase() === 'admin';

export const createMaintenanceRequest = async (req, res) => {
  try {
    const user = req.user || {};
    const body = req.body || {};
    // accepts { title, description } or the older { issue } shape
    const description = String(body.description || body.issue || '').trim();
    const title = String(body.title || '').trim() || (description ? description.split(/[.\n]/)[0].slice(0, 80) : '');
    if (description.length < 5) return res.status(400).json({ success: false, message: 'Please describe the issue (at least 5 characters).' });
    if (title.length < 3) return res.status(400).json({ success: false, message: 'Please give the request a short title (at least 3 characters).' });

    let propertyName = String(body.propertyName || '').trim();
    const propertyId = String(body.propertyId || '').trim();
    if (propertyId && mongoose.isValidObjectId(propertyId) && !propertyName) {
      const property = await Property.findById(propertyId).select('title').lean();
      propertyName = property?.title || '';
    }

    const request = await Maintenance.create({
      userId: String(user.id),
      userName: user.name || body.userName || '',
      propertyId,
      propertyName,
      title: title.slice(0, 200),
      description: description.slice(0, 5000),
      category: pick(MAINTENANCE_CATEGORIES, body.category, 'General'),
      priority: pick(MAINTENANCE_PRIORITIES, body.priority, 'Medium'),
      status: 'Open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await createAdminNotification({
        actionType: 'MAINTENANCE_SUBMITTED',
        entityType: 'MAINTENANCE',
        entityId: request._id.toString(),
        userId: request.userId,
        userName: request.userName,
        title: 'Maintenance request submitted',
        message: `${request.userName || 'A user'} reported "${request.title}"${request.propertyName ? ` at ${request.propertyName}` : ''}.`,
      });
    } catch (error) {
      console.warn('Maintenance admin notification failed:', error?.message || error);
    }
    return res.status(201).json({ success: true, message: 'Maintenance request submitted.', data: request });
  } catch (error) {
    console.error('Create maintenance request failed', error);
    return res.status(500).json({ success: false, message: 'Unable to submit the maintenance request.' });
  }
};

/** GET /api/maintenance - own requests (users) or all requests (admins); GET /api/maintenance/all - admin. */
export const listMaintenanceRequests = async (req, res) => {
  try {
    const { status, priority } = req.query || {};
    const filter = isAdmin(req.user) ? {} : { userId: String(req.user.id) };
    if (status && status !== 'all') filter.status = pick(MAINTENANCE_STATUSES, status, status);
    if (priority && priority !== 'all') filter.priority = pick(MAINTENANCE_PRIORITIES, priority, priority);
    const items = await Maintenance.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List maintenance requests failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load maintenance requests.' });
  }
};

/** PUT/PATCH /api/maintenance/:id - admin updates status, priority, category or notes. */
export const updateMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'Maintenance request not found.' });
    const request = await Maintenance.findById(id);
    if (!request) return res.status(404).json({ success: false, message: 'Maintenance request not found.' });

    const body = req.body || {};
    const updates = {};
    if (body.status !== undefined) {
      const status = pick(MAINTENANCE_STATUSES, body.status, '');
      if (!status) return res.status(400).json({ success: false, message: `Status must be one of: ${MAINTENANCE_STATUSES.join(', ')}.` });
      updates.status = status;
    }
    if (body.priority !== undefined) {
      const priority = pick(MAINTENANCE_PRIORITIES, body.priority, '');
      if (!priority) return res.status(400).json({ success: false, message: `Priority must be one of: ${MAINTENANCE_PRIORITIES.join(', ')}.` });
      updates.priority = priority;
    }
    if (body.category !== undefined) updates.category = pick(MAINTENANCE_CATEGORIES, body.category, 'Other');
    if (body.adminNotes !== undefined) updates.adminNotes = String(body.adminNotes || '').slice(0, 2000);
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'Nothing to update.' });

    const previousStatus = request.status;
    request.set({ ...updates, updatedAt: new Date() });
    await request.save();

    if (updates.status && updates.status !== previousStatus) {
      try {
        await logAdminAction({
          adminId: req.user.id,
          adminName: req.user.name || 'Admin',
          adminEmail: req.user.email || '',
          userId: request.userId,
          userName: request.userName,
          actionType: updates.status === 'Resolved' ? 'MAINTENANCE_RESOLVED' : updates.status === 'Rejected' ? 'MAINTENANCE_REJECTED' : 'MAINTENANCE_STATUS_CHANGED',
          entityType: 'MAINTENANCE',
          entityId: String(request._id),
          previousStatus,
          newStatus: updates.status,
          message: `Your maintenance request "${request.title}" is now ${updates.status}.${request.adminNotes ? ` Note: ${request.adminNotes}` : ''}`,
          propertyName: request.propertyName,
        });
      } catch (error) {
        console.warn('Maintenance status notification failed:', error?.message || error);
      }
    }
    return res.json({ success: true, message: 'Maintenance request updated.', data: request.toObject() });
  } catch (error) {
    console.error('Update maintenance request failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update maintenance request.' });
  }
};

/** DELETE /api/maintenance/:id - admin, or the owner while the request is still Open. */
export const deleteMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'Maintenance request not found.' });
    const request = await Maintenance.findById(id).lean();
    if (!request) return res.status(404).json({ success: false, message: 'Maintenance request not found.' });
    if (!isAdmin(req.user)) {
      if (String(request.userId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'You can only delete your own requests.' });
      if (request.status !== 'Open') return res.status(400).json({ success: false, message: 'Only open requests can be cancelled.' });
    }
    await Maintenance.deleteOne({ _id: id });
    return res.json({ success: true, message: 'Maintenance request deleted.', data: { id } });
  } catch (error) {
    console.error('Delete maintenance request failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete maintenance request.' });
  }
};
