import RentApplication from '../models/RentApplication.js';
import Property from '../models/Property.js';
import { logAdminAction } from '../services/activityService.js';
import { sendRentalDetailsEmails } from '../services/emailService.js';
import { generateRentalAgreement, getRentalAgreementPath } from '../services/rentalAgreementService.js';
import fs from 'node:fs';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';

const deriveRentalEndDate = (startValue, durationValue) => {
  if (!startValue || !durationValue) return null;
  const startDate = new Date(startValue);
  const duration = String(durationValue).match(/(\d+)\s*(month|year)/i);
  if (Number.isNaN(startDate.getTime()) || !duration) return null;

  const months = Number(duration[1]) * (duration[2].toLowerCase() === 'year' ? 12 : 1);
  const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + months, startDate.getUTCDate()));
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return endDate;
};

export const createApplication = async (req, res) => {
  try {
    const body = req.body || {};
    const user = req.user || {};
    const userId = String(user.id || user.userId || user._id || '').trim();
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please sign in before submitting a rental request.' });
    }

    const propertyId = String(body.propertyId || '').trim();
    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({ success: false, message: 'Choose a valid property before applying.' });
    }
    const property = await Property.findById(propertyId).lean();
    if (!property) return res.status(404).json({ success: false, message: 'The selected property could not be found.' });
    if (['Sold', 'Rented', 'Inactive'].includes(property.status)) {
      return res.status(409).json({ success: false, message: 'This property is not available for rent right now.' });
    }
    const duplicate = await RentApplication.exists({ userId, propertyId, applicationStatus: 'pending' });
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'You already have a pending application for this property.' });
    }

    const startDate = body.preferredMoveInDate || body.fromDate || body.moveInDate || null;
    const suppliedEndDate = body.toDate || body.endDate || body.rentalEndDate || null;
    const application = await RentApplication.create({
      userId,
      userName: body.userName || user.name || '',
      userEmail: body.userEmail || user.email || '',
      userPhone: body.userPhone || '',
      cnic: body.cnic || body.CNIC || '',
      profileImage: body.profileImage || '',
      cnicImage: body.cnicImage || '',
      propertyId,
      propertyTitle: property.title || body.propertyTitle || '',
      propertyType: property.propertyType || body.propertyType || '',
      rent: Number(property.rent || property.price || body.rent || 0),
      moveInDate: startDate
        ? new Date(startDate)
        : null,
      rentalEndDate: suppliedEndDate
        ? new Date(suppliedEndDate)
        : deriveRentalEndDate(startDate, body.rentalDuration || ''),
      rentalDuration: body.rentalDuration || '',
      occupants: Number(body.occupants || 1),
      applicationStatus: 'pending',
      notes: body.notes || '',
      submittedAt: new Date(),
      updatedAt: new Date(),
    });

    let agreementPath = '';
    try {
      const agreement = await generateRentalAgreement(application.toObject());
      application.agreementPath = agreement.relativePath;
      await application.save();
      agreementPath = agreement.absolutePath;
    } catch (agreementError) {
      console.error('Rental agreement generation failed after application save:', agreementError);
    }

    try {
      await logAdminAction({
        adminId: 'system',
        adminName: 'System',
        actionType: 'RENT_APPLICATION_SUBMITTED',
        entityType: 'RENT_APPLICATION',
        entityId: application._id.toString(),
        userId: application.userId,
        userName: application.userName,
        message: `New rent application submitted for ${application.propertyTitle || application.propertyId}`,
        propertyName: application.propertyTitle || '',
        metadata: {
          rentalApplicationId: application._id.toString(),
          agreementUrl: application.agreementPath || '',
          propertyName: application.propertyTitle || application.propertyId,
          userName: application.userName,
          rent: application.rent,
          moveInDate: application.moveInDate,
          rentalEndDate: application.rentalEndDate,
          rentalDuration: application.rentalDuration,
        },
      });
    } catch (e) {
      console.warn('Log admin action failed for rent application', e?.message || e);
    }

    try {
      const deliveries = await sendRentalDetailsEmails({
        rental: application.toObject(),
        status: application.applicationStatus,
        eventType: 'submitted',
        agreementPath,
      });
      deliveries.filter((delivery) => !delivery.success).forEach((delivery) => {
        console.warn('Rental application email was not delivered:', delivery.message);
      });
    } catch (emailError) {
      console.warn('Rental application email failed:', emailError?.message || emailError);
    }

    return res.status(201).json({ success: true, data: application });
  } catch (error) {
    console.error('Create application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create application.' });
  }
};

export const downloadApplicationAgreement = async (req, res) => {
  try {
    const application = await RentApplication.findById(req.params.id).select('userId agreementPath').lean();
    if (!application) return res.status(404).json({ success: false, message: 'Rental application not found.' });

    const userId = String(req.user?.id || req.user?.userId || req.user?._id || '');
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && application.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You are not allowed to download this agreement.' });
    }
    if (!application.agreementPath) {
      return res.status(404).json({ success: false, message: 'The rental agreement is not available.' });
    }

    const agreementPath = getRentalAgreementPath(req.params.id);
    await fs.promises.access(agreementPath, fs.constants.R_OK);
    return res.download(agreementPath, `rental-agreement-${req.params.id}.pdf`);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'The rental agreement file was not found.' });
    }
    console.error('Download rental agreement failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to download the rental agreement.' });
  }
};

export const listUserApplications = async (req, res) => {
  try {
    const user = req.user || {};
    const userId = String(user.id || user._id || user.email || '').trim();
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const items = await RentApplication.find({ userId }).sort({ submittedAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List user applications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list applications.' });
  }
};

export const listAllApplications = async (req, res) => {
  try {
    const items = await RentApplication.find({}).sort({ submittedAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List applications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list applications.' });
  }
};

export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Application id required.' });
    const app = await RentApplication.findById(id).lean();
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && String(app.userId) !== String(req.user?.id)) {
      return res.status(403).json({ success: false, message: 'You can only view your own applications.' });
    }
    return res.json({ success: true, data: app });
  } catch (error) {
    console.error('Get application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get application.' });
  }
};

export const acceptApplication = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Application id required.' });
    const app = await RentApplication.findById(id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    const previousStatus = app.applicationStatus;
    app.applicationStatus = 'accepted';
    app.updatedAt = new Date();
    await app.save();

    // mark property as booked
    try {
      if (app.propertyId) {
        await Property.findOneAndUpdate({ _id: app.propertyId }, { status: 'Booked', availability: 'Booked' });
      }
    } catch (e) {
      console.warn('Unable to update property status on application accept', e?.message || e);
    }

    try {
      await logAdminAction({
        adminId: req.user?.id || req.user?._id || 'admin',
        adminName: req.user?.name || 'Admin',
        actionType: 'RENT_APPLICATION_ACCEPTED',
        entityType: 'RENT_APPLICATION',
        entityId: app._id.toString(),
        userId: app.userId,
        userName: app.userName,
        previousStatus,
        newStatus: 'accepted',
        message: `Rent application ${app._id} accepted`,
        propertyName: app.propertyTitle || '',
      });
    } catch (e) { console.warn('Log admin action failed', e?.message || e); }

    try {
      const deliveries = await sendRentalDetailsEmails({ rental: app.toObject(), status: app.applicationStatus, eventType: 'accepted' });
      deliveries.filter((delivery) => !delivery.success).forEach((delivery) => console.warn('Rental approval email was not delivered:', delivery.message));
    } catch (emailError) { console.warn('Rental approval email failed', emailError?.message || emailError); }

    return res.json({ success: true, data: app });
  } catch (error) {
    console.error('Accept application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to accept application.' });
  }
};

export const rejectApplication = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { reason } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Application id required.' });
    const app = await RentApplication.findById(id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    const previousStatus = app.applicationStatus;
    app.applicationStatus = 'rejected';
    app.rejectionReason = reason || '';
    app.updatedAt = new Date();
    await app.save();

    // ensure property remains available
    try {
      if (app.propertyId) {
        const [otherAccepted, activeBooking] = await Promise.all([
          RentApplication.exists({ _id: { $ne: app._id }, propertyId: app.propertyId, applicationStatus: 'accepted' }),
          Booking.exists({ propertyId: app.propertyId, status: { $in: ['Pending', 'Approved'] } }),
        ]);
        if (!otherAccepted && !activeBooking) {
          await Property.findOneAndUpdate({ _id: app.propertyId, status: 'Booked' }, { status: 'Available', availability: 'Available' });
        }
      }
    } catch (e) { console.warn('Unable to update property status on application reject', e?.message || e); }

    try {
      await logAdminAction({
        adminId: req.user?.id || req.user?._id || 'admin',
        adminName: req.user?.name || 'Admin',
        actionType: 'RENT_APPLICATION_REJECTED',
        entityType: 'RENT_APPLICATION',
        entityId: app._id.toString(),
        userId: app.userId,
        userName: app.userName,
        previousStatus,
        newStatus: 'rejected',
        message: `Rent application ${app._id} rejected`,
        reason: reason || '',
        propertyName: app.propertyTitle || '',
      });
    } catch (e) { console.warn('Log admin action failed', e?.message || e); }

    try {
      const deliveries = await sendRentalDetailsEmails({ rental: app.toObject(), status: app.applicationStatus, eventType: 'rejected' });
      deliveries.filter((delivery) => !delivery.success).forEach((delivery) => console.warn('Rental rejection email was not delivered:', delivery.message));
    } catch (emailError) { console.warn('Rental rejection email failed', emailError?.message || emailError); }

    return res.json({ success: true, data: app });
  } catch (error) {
    console.error('Reject application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to reject application.' });
  }
};

/** DELETE /api/applications/:id - admin, or the applicant while it is still pending. */
export const deleteApplication = async (req, res) => {
  try {
    const app = await RentApplication.findById(req.params.id).lean();
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      if (String(app.userId) !== String(req.user?.id)) return res.status(403).json({ success: false, message: 'You can only withdraw your own applications.' });
      if (app.applicationStatus !== 'pending') return res.status(400).json({ success: false, message: 'Only pending applications can be withdrawn.' });
    }
    await RentApplication.deleteOne({ _id: app._id });
    return res.json({ success: true, message: isAdmin ? 'Application deleted.' : 'Application withdrawn.', data: { id: String(app._id) } });
  } catch (error) {
    console.error('Delete application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete application.' });
  }
};
