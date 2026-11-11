import User from '../models/User.js';
import RentalProfile from '../models/RentalProfile.js';

// helper: resolve user by id or email to support dev sessions that provide email
const resolveUser = async (userRef) => {
  if (!userRef) return null;
  const { id, email } = userRef;
  try {
    if (id) {
      const byId = await User.findById(id).select('-passwordHash').lean();
      if (byId) return byId;
    }
  } catch (e) {
    // ignore cast errors and fallback to email lookup
  }

  if (email) {
    const byEmail = await User.findOne({ email: String(email).trim().toLowerCase() }).select('-passwordHash').lean();
    if (byEmail) return byEmail;
  }

  return null;
};

const normalizeProfileImagePath = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') || trimmed.startsWith('data:') ? trimmed : trimmed;
};

const normalizeAdminProfileRecord = (source = {}, imageUrl = '') => {
  const name = String(source.name || source.fullName || '').trim();
  const fullName = String(source.fullName || source.name || '').trim();
  const email = String(source.email || '').trim();
  const phone = String(source.phone || '').trim();
  const role = String(source.role || 'admin').trim() || 'admin';

  const safeImageUrl = imageUrl || normalizeProfileImagePath(source.profileImage || source.image || '');

  return {
    name: name || source.name || '',
    fullName: fullName || source.fullName || name || '',
    email,
    phone,
    role,
    profileImage: safeImageUrl,
    image: safeImageUrl,
  };
};

export const getProfile = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const user = await resolveUser(req.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get profile failed', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch profile.' });
  }
};

export const updateProfileImage = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const existing = await resolveUser(req.user);
    if (!existing) return res.status(404).json({ success: false, message: 'User not found.' });

    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'No profile image file provided.' });

    const relativeUrl = `/images/admin-profiles/${file.filename}`;
    const nextProfile = {
      ...(existing.profile || {}),
      name: existing.name || existing.profile?.name || '',
      fullName: existing.name || existing.profile?.fullName || '',
      email: existing.email || existing.profile?.email || '',
      phone: existing.phone || existing.profile?.phone || '',
      profileImage: relativeUrl,
      image: relativeUrl,
    };

    const user = await User.findByIdAndUpdate(
      existing._id,
      {
        profileImage: relativeUrl,
        profile: nextProfile,
        name: existing.name || nextProfile.name || '',
        phone: existing.phone || nextProfile.phone || '',
      },
      { new: true },
    ).select('-passwordHash').lean();

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({ success: true, data: user, message: 'Profile image updated successfully.' });
  } catch (error) {
    console.error('Update profile image failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update profile image.' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    const rawBody = req.body || {};
    const updates = typeof rawBody === 'object' && rawBody && rawBody.profile && typeof rawBody.profile === 'object' ? rawBody.profile : rawBody;
    const profileUpdate = { ...(updates || {}) };

    const existing = await resolveUser(req.user);
    if (!existing) return res.status(404).json({ success: false, message: 'User not found.' });

    const files = req.files || {};
    const profileFile = Array.isArray(files.profileImage) ? files.profileImage[0] : null;
    const cnicFile = Array.isArray(files.cnicImage) ? files.cnicImage[0] : null;

    const imageUrl = profileFile
      ? `/images/admin-profiles/${profileFile.filename}`
      : normalizeProfileImagePath(profileUpdate.profileImage || profileUpdate.image || existing.profileImage || existing.profile?.profileImage || existing.profile?.image || '');

    const cnicImageUrl = cnicFile ? `/images/admin-profiles/${cnicFile.filename}` : normalizeProfileImagePath(profileUpdate.cnicImage || existing.profile?.cnicImage || '');

    const updatedName = String(profileUpdate.name || profileUpdate.fullName || existing.name || existing.profile?.name || '').trim();
    const updatedFullName = String(profileUpdate.fullName || profileUpdate.name || existing.profile?.fullName || existing.name || '').trim();
    const updatedEmail = String(profileUpdate.email || existing.email || existing.profile?.email || '').trim();
    const updatedPhone = String(profileUpdate.phone || existing.phone || existing.profile?.phone || '').trim();
    // role can never be changed through the profile endpoint (admins use /api/admin/users/:id)
    const updatedRole = existing.role || 'resident';
    delete profileUpdate.role;
    delete profileUpdate.status;
    delete profileUpdate.archived;
    delete profileUpdate.passwordHash;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatedEmail)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (updatedEmail.toLowerCase() !== String(existing.email || '').toLowerCase()) {
      const taken = await User.exists({ email: updatedEmail.toLowerCase(), _id: { $ne: existing._id } });
      if (taken) return res.status(409).json({ success: false, message: 'Another account already uses that email.' });
    }
    if (updatedPhone && !/^\+?[\d\s-]{7,20}$/.test(updatedPhone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid phone number.' });
    }

    const mergedProfile = normalizeAdminProfileRecord({
      ...(existing.profile || {}),
      name: updatedName || existing.name || '',
      fullName: updatedFullName || updatedName || existing.name || '',
      email: updatedEmail || existing.email || '',
      phone: updatedPhone || existing.phone || '',
      role: updatedRole,
      ...profileUpdate,
    }, imageUrl || existing.profileImage || existing.profile?.profileImage || existing.profile?.image || '');

    const updatePayload = {
      name: updatedName || updatedFullName || existing.name || '',
      email: (updatedEmail || existing.email || '').toLowerCase(),
      phone: updatedPhone || existing.phone || '',
      profileImage: mergedProfile.profileImage || existing.profileImage || '',
      profile: {
        ...mergedProfile,
        profileImage: mergedProfile.profileImage || existing.profileImage || existing.profile?.profileImage || '',
        image: mergedProfile.image || existing.profileImage || existing.profile?.image || '',
        cnicImage: cnicImageUrl || existing.profile?.cnicImage || '',
      },
      updatedAt: new Date(),
    };

    const user = await User.findByIdAndUpdate(existing._id, updatePayload, { new: true }).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const rentalProfileFields = {
      fullName: updatedFullName || updatedName,
      email: updatedEmail,
      phone: updatedPhone,
      profileImage: mergedProfile.profileImage || '',
      cnicImage: cnicImageUrl || '',
      currentAddress: String(profileUpdate.currentAddress || profileUpdate.address || '').trim(),
      city: String(profileUpdate.city || '').trim(),
      occupation: String(profileUpdate.occupation || '').trim(),
      emergencyContactName: String(profileUpdate.emergencyContactName || profileUpdate.emergencyContact || '').trim(),
      emergencyContactPhone: String(profileUpdate.emergencyContactPhone || profileUpdate.emergencyContactNumber || '').trim(),
    };
    if (rentalProfileFields.fullName && rentalProfileFields.email && rentalProfileFields.phone
      && rentalProfileFields.currentAddress && rentalProfileFields.city && rentalProfileFields.occupation
      && rentalProfileFields.emergencyContactName) {
      await RentalProfile.findOneAndUpdate(
        { userId: String(existing._id) },
        { $set: { ...rentalProfileFields, userId: String(existing._id), profileStatus: 'Profile Complete' } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      );
      await User.findByIdAndUpdate(existing._id, { hasRentalProfile: true });
    }

    return res.json({ success: true, data: user, message: 'Profile updated successfully.' });
  } catch (error) {
    console.error('Update profile failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update profile.' });
  }
};
