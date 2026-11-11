import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import UserNotification from '../models/UserNotification.js';
import Payment from '../models/Payment.js';
import Tenant from '../models/Tenant.js';
import RentPayment from '../models/RentPayment.js';
import RentalProfile from '../models/RentalProfile.js';
import User from '../models/User.js';
import { logAdminAction } from '../services/activityService.js';
import { sendRentalDetailsEmails } from '../services/emailService.js';
import { buildUserNotification } from '../utils/activity.js';

export const createBooking = async (req, res) => {
  let propertyToUnlock = null;
  try {
    const body = req.body || {};
    const user = req.user || {};
    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    const effectiveUserId = String((isAdmin && body.userId) || user.id || user.userId || user._id || '').trim();
    if (!effectiveUserId) return res.status(401).json({ success: false, message: 'Please sign in before booking a rental property.' });
    const propertyId = String(body.propertyId || body.property?.id || body.property?._id || '').trim();
    if (!/^[\da-f]{24}$/i.test(propertyId)) {
      return res.status(400).json({ success: false, message: 'Choose a valid property before submitting the booking.' });
    }

    const [property, existingRentalProfile, dbUser] = await Promise.all([
      Property.findById(propertyId).lean(),
      RentalProfile.findOne({ userId: effectiveUserId }).lean(),
      User.findById(effectiveUserId).select('name email phone profile profileImage').lean(),
    ]);
    if (!property) return res.status(404).json({ success: false, message: 'The selected property could not be found.' });
    let rentalProfile = existingRentalProfile;
    if (!rentalProfile && !isAdmin) {
      // no rental profile yet: build a minimal one from the account and the booking form
      const phone = String(body.phone || body.userPhone || body.customerPhone || dbUser?.phone || '').trim();
      if (!dbUser) return res.status(401).json({ success: false, message: 'Please sign in again before booking.' });
      if (!phone) return res.status(400).json({ success: false, message: 'Add your phone number so the landlord can contact you.' });
      rentalProfile = (await RentalProfile.findOneAndUpdate(
        { userId: effectiveUserId },
        { $setOnInsert: { userId: effectiveUserId, fullName: String(body.fullName || body.userName || dbUser.name || '').trim() || dbUser.email, email: dbUser.email, phone, profileStatus: 'Profile Incomplete' } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )).toObject();
    }

    const currentStatus = String(property.status || property.availability || '').trim();
    const statusKey = currentStatus.toLowerCase();
    if (['booked', 'rented', 'occupied', 'sold', 'reserved'].includes(statusKey)
      || String(property.availability || '').toLowerCase() === 'booked') {
      return res.status(409).json({ success: false, message: 'This property has already been booked and is no longer available.' });
    }
    const listingType = String(property.listingType || '').toLowerCase();
    const transactionType = `${property.transactionType || ''} ${property.purpose || ''}`.toLowerCase();
    const isSaleListing = ['sale', 'buy', 'purchase'].some((term) => listingType.includes(term))
      || (!listingType && ['sale', 'buy', 'purchase'].some((term) => transactionType.includes(term)));
    if (isSaleListing) {
      return res.status(400).json({ success: false, message: 'This property is not available for rent.' });
    }

    const oldPropertyState = { status: property.status, availability: property.availability };
    const reservedProperty = await Property.findOneAndUpdate(
      {
        _id: property._id,
        status: property.status,
        availability: property.availability,
      },
      { $set: { status: 'Booked', availability: 'Booked', updatedAt: new Date() } },
      { new: true },
    ).lean();
    if (!reservedProperty) {
      return res.status(409).json({ success: false, message: 'This property has just been booked by another user.' });
    }
    propertyToUnlock = { id: property._id, oldPropertyState };

    const bookingStatus = 'Pending';
    const paymentStatus = 'Pending';
    const propertyName = String(property.title || property.name || '');
    const propertyTitle = propertyName;
    const propertyType = String(property.propertyType || property.type || property.category || '');
    const amount = Number(property.rent || property.price || 0);
    const userName = String(rentalProfile?.fullName || (isAdmin ? body.customerName || body.userName : dbUser?.name || user.name) || '').trim();
    const userEmail = String(rentalProfile?.email || (isAdmin ? body.userEmail : dbUser?.email || user.email) || '').trim();
    const userPhone = String(rentalProfile?.phone || (isAdmin ? body.customerPhone || body.userPhone : dbUser?.phone) || '').trim();
    if ((!isAdmin && !userEmail) || !userName || !userPhone || !(amount > 0)) {
      await Property.findOneAndUpdate({ _id: property._id, status: 'Booked' }, {
        $set: { ...oldPropertyState, updatedAt: new Date() },
      });
      propertyToUnlock = null;
      return res.status(400).json({ success: false, message: 'Your rental profile or the property rent amount is incomplete.' });
    }

    const booking = await Booking.create({
      userId: effectiveUserId,
      userName,
      userEmail,
      userPhone,
      customerName: userName,
      customerPhone: userPhone,
      propertyId: property._id.toString(),
      propertyName,
      propertyTitle,
      propertyType,
      propertyImage: property.featuredImage?.url || property.image || property.images?.[0]?.url || '',
      amount,
      rent: amount,
      rentFrequency: body.rentFrequency || 'Monthly',
      moveInDate: body.moveInDate ? new Date(body.moveInDate) : null,
      rentalDuration: body.rentalDuration || '1 month',
      occupants: Number(body.occupants || 1),
      message: body.message || body.notes || '',
      notes: body.notes || body.message || '',
      // applicant personal info
      cnic: body.cnic || body.CNIC || '',
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      nationality: body.nationality || '',
      // current address
      addressLine1: body.addressLine1 || body.address1 || '',
      addressLine2: body.addressLine2 || body.address2 || '',
      city: body.city || '',
      province: body.province || body.state || '',
      country: body.country || '',
      // employment
      employmentStatus: body.employmentStatus || '',
      companyName: body.companyName || '',
      jobTitle: body.jobTitle || '',
      monthlyIncome: Number(body.monthlyIncome || 0),
      workAddress: body.workAddress || '',
      yearsExperience: Number(body.yearsExperience || 0),
      // rental details
      reasonForRent: body.reasonForRent || body.reason || '',
      preferredMoveInDate: body.preferredMoveInDate ? new Date(body.preferredMoveInDate) : null,
      // references
      previousLandlordName: body.previousLandlordName || '',
      previousLandlordPhone: body.previousLandlordPhone || '',
      previousLandlordRelationship: body.previousLandlordRelationship || '',
      // terms
      termsAccepted: Boolean(body.termsAccepted || body.terms || false),
      paymentStatus,
      bookingStatus,
      status: bookingStatus,
      bookingDate: body.bookingDate ? new Date(body.bookingDate) : new Date(),
      visitDate: body.visitDate ? new Date(body.visitDate) : null,
      // flow type and uploaded images
      flowType: body.flowType || (propertyType === 'Flat' || String(propertyType).toLowerCase() === 'flat' ? 'rent_application' : 'contact'),
      profileImage: rentalProfile?.profileImage || dbUser?.profileImage || dbUser?.profile?.profileImage || body.profileImage || '',
      cnicImage: rentalProfile?.cnicImage || dbUser?.profile?.cnicImage || body.cnicImage || '',
    });
    propertyToUnlock = null;

    try {
      await logAdminAction({
        adminId: 'system',
        adminName: 'System',
        adminEmail: '',
        userId: booking.userId,
        userName: booking.userName,
        actionType: 'BOOKING_SUBMITTED',
        entityType: 'BOOKING',
        entityId: booking._id.toString(),
        message: `Your booking for ${booking.propertyTitle || 'the property'} has been submitted.`,
        description: `Booking ${booking._id} submitted by user.`,
        newStatus: booking.bookingStatus || booking.status || 'Pending',
        propertyName: booking.propertyTitle || '',
        metadata: {
          bookingId: booking._id.toString(),
          propertyId: booking.propertyId,
          propertyName: booking.propertyTitle || booking.propertyName,
          propertyImage: booking.propertyImage,
          rent: booking.rent || booking.amount,
          bookingDate: booking.bookingDate,
          email: booking.userEmail,
          phone: booking.userPhone,
          profileImage: booking.profileImage,
          cnicImage: booking.cnicImage,
        },
      });
    } catch (e) {
      console.warn('Booking notification create failed via logAdminAction:', e && e.message ? e.message : e);
    }

    try {
      const deliveries = await sendRentalDetailsEmails({
        rental: booking.toObject(),
        status: booking.status,
        eventType: 'submitted',
      });
      deliveries.filter((delivery) => !delivery.success).forEach((delivery) => console.warn('Booking email was not delivered:', delivery.message));
    } catch (emailError) {
      console.warn('Booking email failed:', emailError && emailError.message ? emailError.message : emailError);
    }

    return res.status(201).json({ success: true, data: booking });
  } catch (error) {
    console.error('Create booking failed', error);
    if (propertyToUnlock) {
      try {
        await Property.findOneAndUpdate(
          { _id: propertyToUnlock.id, status: 'Booked' },
          { $set: { ...propertyToUnlock.oldPropertyState, updatedAt: new Date() } },
        );
      } catch (unlockError) {
        console.error('Could not restore property availability after booking failure:', unlockError);
      }
    }
    return res.status(500).json({ success: false, message: 'Unable to create booking.' });
  }
};

export const listMyBookings = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const items = await Booking.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List my bookings failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get bookings.' });
  }
};

export const listAllBookings = async (req, res) => {
  try {
    const items = await Booking.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List bookings failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get bookings.' });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Missing booking id.' });

    const body = req.body || {};
    const editableFields = [
      'customerName',
      'customerPhone',
      'userName',
      'userEmail',
      'userPhone',
      'propertyId',
      'propertyName',
      'propertyTitle',
      'propertyType',
      'bookingDate',
      'visitDate',
      'amount',
      'rent',
      'paymentStatus',
      'bookingStatus',
      'status',
      'notes',
      'message',
    ];
    const updates = Object.fromEntries(
      editableFields
        .filter((field) => Object.hasOwn(body, field))
        .map((field) => [field, body[field]]),
    );
    if (Object.hasOwn(updates, 'bookingStatus')) updates.status = updates.bookingStatus;
    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No booking fields were provided.' });
    }

    updates.updatedAt = new Date();
    const booking = await Booking.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Update booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update booking.' });
  }
};

export const approveBooking = async (req, res) => {
  try {
    const { id } = req.params; // booking id
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const previousStatus = booking.status;
    booking.status = 'Approved';
    booking.bookingStatus = 'Approved';
    booking.paymentStatus = booking.paymentStatus || 'Approved';
    await booking.save();

    // update property status to Booked when a booking is approved
    try {
      if (booking.propertyId) {
        await Property.findOneAndUpdate({ _id: booking.propertyId }, { status: 'Booked', availability: 'Booked' });
      }
    } catch (e) {
      console.warn('Unable to update property status on booking approve', e && e.message ? e.message : e);
    }

    // create an initial payment record (advance) for this approved booking if rent/amount exists
    try {
      const total = Number(booking.rent || booking.amount || 0);
      if (total > 0) {
        const paymentPayload = {
          userId: booking.userId || booking.userI || '',
          userName: booking.userName || booking.customerName || '',
          userEmail: booking.userEmail || '',
          bookingId: booking._id.toString(),
          propertyId: booking.propertyId || '',
          propertyName: booking.propertyTitle || booking.propertyName || '',
          propertyType: booking.propertyType || '',
          totalAmount: total,
          amount: total,
          advanceAmount: 0,
          amountPaid: 0,
          remainingAmount: total,
          paymentType: 'Advance',
          method: 'Pending',
          status: 'Pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          // only one invoice per booking, even if the booking is approved again
          const existingPayment = await Payment.exists({ bookingId: booking._id.toString() });
          if (!existingPayment) await Payment.create(paymentPayload);
        } catch (e) {
          console.warn('Unable to create payment for approved booking', e && e.message ? e.message : e);
        }
      }
    } catch (e) {
      console.warn('Create initial payment failed for booking approve', e && e.message ? e.message : e);
    }

    // If booking approved, ensure a Tenant record exists for this user/property (auto-create)
    try {
      // prefer linking by userId when available
      const userIdentifier = booking.userId || booking.userI || booking.userEmail || booking.userEmail || '';
      const propertyId = booking.propertyId || booking.property || '';
      // find existing tenant for same user and property
      let existingTenant = null;
      if (booking.userId) {
        existingTenant = await Tenant.findOne({ userId: booking.userId, propertyId }).lean();
      }
      if (!existingTenant && booking.userEmail) {
        existingTenant = await Tenant.findOne({ email: booking.userEmail, propertyId }).lean();
      }

      if (!existingTenant) {
        const tenantPayload = {
          userId: booking.userId || null,
          name: booking.userName || booking.customerName || booking.userEmail || 'Tenant',
          phone: booking.userPhone || booking.customerPhone || '',
          email: booking.userEmail || '',
          profileImage: booking.profileImage || '',
          cnicImage: booking.cnicImage || '',
          propertyId: booking.propertyId || '',
          hostelId: booking.propertyId || booking.hostelId || '',
          monthlyRent: Number(booking.rent || booking.amount || 0),
          dueDay: 5,
          moveInDate: booking.moveInDate || new Date(),
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          const createdTenant = await Tenant.create(tenantPayload);

          // create initial rent payment record for current month if rent amount > 0
          if (Number(tenantPayload.monthlyRent) > 0) {
            try {
              const monthKey = new Date().toISOString().slice(0, 7);
              const dueDate = new Date();
              dueDate.setDate(tenantPayload.dueDay || 5);
              dueDate.setHours(0, 0, 0, 0);

              const existing = await RentPayment.findOne({ tenantId: createdTenant._id, month: monthKey }).lean();
              if (!existing) {
                await RentPayment.create({
                  tenantId: createdTenant._id,
                  month: monthKey,
                  amountDue: Number(tenantPayload.monthlyRent || 0),
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
            } catch (e) {
              console.warn('Unable to create initial rent payment for created tenant', e && e.message ? e.message : e);
            }
          }
        } catch (e) {
          // non-fatal
          console.warn('Auto-create tenant failed on booking approve', e && e.message ? e.message : e);
        }
      }
    } catch (e) {
      console.warn('Tenant auto-create check failed', e && e.message ? e.message : e);
    }

    const admin = req.user || {};
    const result = await logAdminAction({
      adminId: admin.id || admin._id || 'admin',
      adminName: admin.name || 'Admin',
      adminEmail: admin.email || '',
      userId: booking.userId,
      userName: booking.userName,
      actionType: 'BOOKING_APPROVED',
      entityType: 'BOOKING',
      entityId: booking._id.toString(),
      previousStatus,
      newStatus: 'Approved',
      message: `Your booking for ${booking.propertyTitle || 'the property'} has been approved.`,
      description: `Admin approved booking ${booking._id}`,
      propertyName: booking.propertyTitle || '',
    });

    try {
      const deliveries = await sendRentalDetailsEmails({ rental: booking.toObject(), status: booking.status, eventType: 'approved' });
      deliveries.filter((delivery) => !delivery.success).forEach((delivery) => console.warn('Booking approval email was not delivered:', delivery.message));
    } catch (emailError) {
      console.warn('Booking approval email failed:', emailError && emailError.message ? emailError.message : emailError);
    }

    return res.json({ success: true, data: booking, audit: result });
  } catch (error) {
    console.error('Approve booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to approve booking.' });
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params; // booking id
    const { reason } = req.body || {};
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const previousStatus = booking.status;
    booking.status = 'Rejected';
    booking.bookingStatus = 'Rejected';
    booking.rejectionReason = String(reason || '').slice(0, 1000);
    booking.paymentStatus = booking.paymentStatus || 'Pending';
    await booking.save();

    // ensure property remains available on rejection
    try {
      if (booking.propertyId) {
        const otherActiveBooking = await Booking.exists({
          _id: { $ne: booking._id },
          propertyId: booking.propertyId,
          status: { $nin: ['Rejected', 'Cancelled', 'Deleted'] },
        });
        if (!otherActiveBooking) {
          await Property.findOneAndUpdate(
            { _id: booking.propertyId, status: 'Booked' },
            { status: 'Available', availability: 'Available' },
          );
        }
      }
    } catch (e) {
      console.warn('Unable to update property status on booking reject', e && e.message ? e.message : e);
    }

    const admin = req.user || {};
    const result = await logAdminAction({
      adminId: admin.id || admin._id || 'admin',
      adminName: admin.name || 'Admin',
      adminEmail: admin.email || '',
      userId: booking.userId,
      userName: booking.userName,
      actionType: 'BOOKING_REJECTED',
      entityType: 'BOOKING',
      entityId: booking._id.toString(),
      previousStatus,
      newStatus: 'Rejected',
      message: `Your booking for ${booking.propertyTitle || 'the property'} has been rejected.`,
      reason: reason || 'No reason provided',
      description: `Admin rejected booking ${booking._id}`,
      propertyName: booking.propertyTitle || '',
    });

    try {
      const deliveries = await sendRentalDetailsEmails({ rental: booking.toObject(), status: booking.status, eventType: 'rejected' });
      deliveries.filter((delivery) => !delivery.success).forEach((delivery) => console.warn('Booking rejection email was not delivered:', delivery.message));
    } catch (emailError) {
      console.warn('Booking rejection email failed:', emailError && emailError.message ? emailError.message : emailError);
    }

    return res.json({ success: true, data: booking, audit: result });
  } catch (error) {
    console.error('Reject booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to reject booking.' });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Missing booking id.' });
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // attempt to restore property availability if this booking reserved it
    try {
      if (booking.propertyId) {
        const otherActiveBooking = await Booking.exists({
          _id: { $ne: booking._id },
          propertyId: booking.propertyId,
          status: { $nin: ['Rejected', 'Cancelled', 'Deleted'] },
        });
        if (!otherActiveBooking) {
          await Property.findOneAndUpdate(
            { _id: booking.propertyId, status: 'Booked' },
            { status: 'Available', availability: 'Available' },
          );
        }
      }
    } catch (e) {
      console.warn('Unable to update property status on booking delete', e && e.message ? e.message : e);
    }

    await Booking.findByIdAndDelete(id);

    const admin = req.user || {};
    try {
      await logAdminAction({
        adminId: admin.id || admin._id || 'admin',
        adminName: admin.name || 'Admin',
        adminEmail: admin.email || '',
        userId: booking.userId,
        userName: booking.userName || booking.customerName || '',
        actionType: 'BOOKING_DELETED',
        entityType: 'BOOKING',
        entityId: id,
        message: `Booking ${id} was deleted by admin.`,
        description: `Admin deleted booking ${id}`,
        propertyName: booking.propertyTitle || booking.propertyName || '',
      });
    } catch (e) {
      console.warn('Log admin action failed for booking delete', e && e.message ? e.message : e);
    }

    return res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete booking.' });
  }
};

/** GET /api/bookings/:id - owner or admin. */
export const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && String(booking.userId) !== String(req.user?.id)) {
      return res.status(403).json({ success: false, message: 'You can only view your own bookings.' });
    }
    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load booking.' });
  }
};

/** POST /api/bookings/:id/cancel - the owner cancels a booking that is still pending. */
export const cancelMyBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && String(booking.userId) !== String(req.user?.id)) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own bookings.' });
    }
    if (!/^pending/i.test(String(booking.status || ''))) {
      return res.status(400).json({ success: false, message: `This booking is already ${String(booking.status).toLowerCase()} and cannot be cancelled.` });
    }
    booking.status = 'Cancelled';
    booking.bookingStatus = 'Cancelled';
    await booking.save();
    if (booking.propertyId) {
      const otherActiveBooking = await Booking.exists({
        _id: { $ne: booking._id },
        propertyId: booking.propertyId,
        status: { $nin: ['Rejected', 'Cancelled', 'Deleted'] },
      });
      if (!otherActiveBooking) {
        await Property.findOneAndUpdate({ _id: booking.propertyId, status: 'Booked' }, { status: 'Available', availability: 'Available' });
      }
    }
    return res.json({ success: true, message: 'Booking cancelled.', data: booking });
  } catch (error) {
    console.error('Cancel booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to cancel booking.' });
  }
};
