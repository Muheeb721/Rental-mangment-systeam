import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Property from '../models/Property.js';
import { createAdminNotification } from '../services/activityService.js';

export const REVIEW_STATUSES = ['Approved', 'Hidden'];
const isAdmin = (user) => String(user?.role || '').toLowerCase() === 'admin';

/** GET /api/reviews?propertyId= - public, approved reviews only. */
export const listReviews = async (req, res) => {
  try {
    const filter = { status: { $ne: 'Hidden' } };
    if (req.query.propertyId) filter.propertyId = String(req.query.propertyId);
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 100, 500);
    const reviews = await Review.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const average = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0;
    return res.json({ success: true, data: reviews, meta: { count: reviews.length, averageRating: Math.round(average * 10) / 10 } });
  } catch (error) {
    console.error('List reviews failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list reviews.' });
  }
};

/** GET /api/reviews/admin/all - admin, includes hidden reviews. */
export const listAllReviewsAdmin = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    const reviews = await Review.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: reviews });
  } catch (error) {
    console.error('List admin reviews failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list reviews.' });
  }
};

/** POST /api/reviews { propertyId?, rating 1-5, comment } - signed-in users; one review per property. */
export const createReview = async (req, res) => {
  try {
    const input = req.body || {};
    const rating = Number(input.rating);
    const comment = String(input.comment || input.message || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be a whole number from 1 to 5.' });
    if (comment.length < 5) return res.status(400).json({ success: false, message: 'Please write a short comment (at least 5 characters).' });

    const propertyId = String(input.propertyId || '').trim();
    let propertyName = String(input.propertyName || input.property || '').trim();
    if (propertyId) {
      if (!mongoose.isValidObjectId(propertyId)) return res.status(400).json({ success: false, message: 'Invalid property.' });
      const property = await Property.findById(propertyId).select('title').lean();
      if (!property) return res.status(404).json({ success: false, message: 'Property not found.' });
      propertyName = property.title;
      const existing = await Review.exists({ userId: String(req.user.id), propertyId });
      if (existing) return res.status(409).json({ success: false, message: 'You have already reviewed this property.' });
    }

    const review = await Review.create({
      userId: String(req.user.id),
      userName: req.user.name || input.userName || 'RMS User',
      propertyId,
      propertyName,
      rating,
      comment: comment.slice(0, 2000),
      status: 'Approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await createAdminNotification({
        actionType: 'REVIEW_SUBMITTED',
        entityType: 'REVIEW',
        entityId: String(review._id),
        userId: review.userId,
        userName: review.userName,
        title: 'New review posted',
        message: `${review.userName} rated ${propertyName || 'RMS'} ${rating}/5.`,
      });
    } catch (error) {
      console.warn('Review notification failed:', error?.message || error);
    }
    return res.status(201).json({ success: true, message: 'Thank you for your review.', data: review });
  } catch (error) {
    console.error('Create review failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create review.' });
  }
};

/** PATCH /api/reviews/:id { status: 'Approved' | 'Hidden', adminReply? } - admin moderation. */
export const updateReviewStatus = async (req, res) => {
  try {
    const updates = { updatedAt: new Date() };
    if (req.body?.status !== undefined) {
      const status = REVIEW_STATUSES.find((item) => item.toLowerCase() === String(req.body.status).toLowerCase());
      if (!status) return res.status(400).json({ success: false, message: 'Status must be Approved or Hidden.' });
      updates.status = status;
    }
    if (req.body?.adminReply !== undefined) updates.adminReply = String(req.body.adminReply || '').slice(0, 1000);
    const review = await Review.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    return res.json({ success: true, message: 'Review updated.', data: review });
  } catch (error) {
    console.error('Update review failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update review.' });
  }
};

/** DELETE /api/reviews/:id - admin or the review author. */
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).lean();
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    if (!isAdmin(req.user) && String(review.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own reviews.' });
    }
    await Review.deleteOne({ _id: review._id });
    return res.json({ success: true, message: 'Review deleted.', data: review });
  } catch (error) {
    console.error('Delete review failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete review.' });
  }
};
