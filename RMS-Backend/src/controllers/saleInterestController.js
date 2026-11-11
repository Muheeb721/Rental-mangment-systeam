import SaleInterestSubmission from '../models/SaleInterestSubmission.js';
import UserNotification from '../models/UserNotification.js';
import Property from '../models/Property.js';
import { createAdminNotification } from '../services/activityService.js';
import { sendSaleInterestSubmittedEmail } from '../services/emailService.js';

const SALE_TYPES = new Set(['house', 'apartment']);

const normalizeType = (value) => String(value || '').trim().toLowerCase();

export const createSaleInterestSubmission = async (req, res) => {
  try {
    const body = req.body || {};
    const user = req.user || {};
    const userId = String(user.id || user._id || user.userId || '').trim();
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const propertyId = String(body.propertyId || '').trim();
    if (!propertyId) return res.status(400).json({ success: false, message: 'Property ID is required.' });

    const property = await Property.findById(propertyId).lean();
    if (!property) return res.status(404).json({ success: false, message: 'Property not found.' });

    const propertyType = String(property.type || property.propertyType || property.category || '').trim();
    if (!SALE_TYPES.has(normalizeType(propertyType))) {
      return res.status(400).json({ success: false, message: 'Sale interest is available only for Houses and Apartments.' });
    }

    const preferredMoveInDate = new Date(body.preferredMoveInDate);
    if (Number.isNaN(preferredMoveInDate.getTime())) {
      return res.status(400).json({ success: false, message: 'A valid preferred move-in date is required.' });
    }

    const fullName = String(body.fullName || user.name || '').trim();
    const email = String(body.email || user.email || '').trim().toLowerCase();
    const idCardNumber = String(body.idCardNumber || '').trim();
    const phone = String(body.phone || '').trim();
    if (!fullName || !email || !idCardNumber || !phone) {
      return res.status(400).json({ success: false, message: 'All contact fields are required.' });
    }

    const submission = await SaleInterestSubmission.create({
      userId,
      propertyId,
      propertyType,
      propertyTitle: property.title || '',
      fullName,
      email,
      idCardNumber,
      phone,
      preferredMoveInDate,
    });

    await UserNotification.create({
      userId,
      recipientId: userId,
      recipientRole: 'user',
      userName: submission.fullName,
      actorType: 'system',
      actorName: 'RMS',
      entityType: 'SALE_INTEREST',
      entityId: submission._id.toString(),
      actionType: 'SALE_INTEREST_SUBMITTED',
      type: 'sale_interest',
      title: 'Buying interest submitted',
      message: `Your buying-interest form for ${submission.propertyTitle} was submitted successfully.`,
      status: 'New',
      isRead: false,
      createdAt: new Date(),
    });

    try {
      await createAdminNotification({
        actionType: 'SALE_INTEREST_SUBMITTED',
        entityType: 'SALE_INTEREST',
        entityId: submission._id.toString(),
        userId,
        userName: submission.fullName,
        actorName: submission.fullName,
        title: 'New house/apartment buying interest',
        message: `${submission.fullName} submitted buying interest for ${submission.propertyTitle}.`,
      });
    } catch (error) {
      console.warn('Sale interest admin notification failed:', error?.message || error);
    }

    try {
      await sendSaleInterestSubmittedEmail({
        userName: submission.fullName,
        userEmail: submission.email,
        userId,
        propertyName: submission.propertyTitle,
        propertyType: submission.propertyType,
        preferredMoveInDate: submission.preferredMoveInDate.toISOString().slice(0, 10),
        submissionId: submission._id.toString(),
      });
    } catch (error) {
      console.warn('Sale interest confirmation email failed:', error?.message || error);
    }

    return res.status(201).json({ success: true, data: submission });
  } catch (error) {
    console.error('Create sale interest submission failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit buying interest.' });
  }
};
