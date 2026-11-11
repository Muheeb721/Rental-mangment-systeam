import bcrypt from 'bcryptjs';
import { createHash, randomInt, randomBytes, timingSafeEqual } from 'crypto';
import AdminPasswordReset from '../models/AdminPasswordReset.js';
import User from '../models/User.js';
import { sendAdminPasswordResetEmail } from '../services/emailService.js';

const getAdminEmail = () => String(process.env.ADMIN_EMAIL || 'admin@rental.com').trim().toLowerCase();
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_DELAY_MS = 30 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const hashResetToken = (token) => createHash('sha256').update(token).digest('hex');

export const sendAdminPasswordResetOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || getAdminEmail());
    if (email !== getAdminEmail()) {
      return res.status(400).json({ success: false, message: 'Password reset is only available for the configured admin account.' });
    }

    const admin = await User.findOne({ email, role: 'admin' }).select('_id email').lean();
    if (!admin) {
      return res.status(404).json({ success: false, message: 'The admin account was not found. Ask an administrator to configure it.' });
    }

    const existing = await AdminPasswordReset.findOne({ email }).select('+otpHash');
    if (existing && existing.resendAfter > new Date()) {
      return res.status(429).json({ success: false, message: 'Please wait before requesting another code.' });
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otpHash = await bcrypt.hash(otp, 12);
    const now = new Date();
    await AdminPasswordReset.findOneAndUpdate(
      { email },
      {
        email,
        otpHash,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        resendAfter: new Date(now.getTime() + RESEND_DELAY_MS),
        resetTokenHash: '',
        resetTokenExpiresAt: null,
        verifiedAt: null,
        createdAt: now,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    const delivery = await sendAdminPasswordResetEmail({ email, otp });
    if (!delivery.success) {
      await AdminPasswordReset.deleteOne({ email });
      console.error('Admin password reset OTP email could not be delivered:', delivery.message);
      return res.status(503).json({ success: false, message: 'Unable to send the verification email. Check the email configuration and try again.' });
    }

    return res.json({ success: true, message: 'A six-digit verification code has been sent to the admin email.' });
  } catch (error) {
    console.error('Send admin password reset OTP failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to send a verification code.' });
  }
};

export const verifyAdminPasswordResetOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();
    if (email !== getAdminEmail() || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Enter the six-digit code sent to the admin email.' });
    }

    const reset = await AdminPasswordReset.findOne({ email }).select('+otpHash');
    if (!reset) {
      return res.status(400).json({ success: false, message: 'The code is invalid or expired. Request a new code.' });
    }
    if (reset.expiresAt <= new Date()) {
      await AdminPasswordReset.deleteOne({ _id: reset._id });
      return res.status(400).json({ success: false, message: 'The code has expired. Request a new code.' });
    }
    if (reset.verifiedAt || !reset.otpHash) {
      return res.status(400).json({ success: false, message: 'This code has already been used. Request a new code.' });
    }
    if (reset.attempts >= 5) {
      await AdminPasswordReset.deleteOne({ _id: reset._id });
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' });
    }

    const matches = await bcrypt.compare(otp, reset.otpHash);
    if (!matches) {
      reset.attempts += 1;
      if (reset.attempts >= 5) await reset.deleteOne();
      else await reset.save();
      const attemptsRemaining = Math.max(0, 5 - reset.attempts);
      return res.status(400).json({
        success: false,
        message: attemptsRemaining ? `Incorrect code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.` : 'Too many incorrect attempts. Request a new code.',
      });
    }

    const resetToken = randomBytes(32).toString('hex');
    reset.verifiedAt = new Date();
    reset.resetTokenHash = hashResetToken(resetToken);
    reset.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    reset.expiresAt = reset.resetTokenExpiresAt;
    reset.otpHash = '';
    await reset.save();

    return res.json({ success: true, message: 'Code verified.', resetToken });
  } catch (error) {
    console.error('Verify admin password reset OTP failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to verify the code.' });
  }
};

export const resetAdminPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const resetToken = String(req.body?.resetToken || '');
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    if (email !== getAdminEmail() || !resetToken) {
      return res.status(400).json({ success: false, message: 'Verify your email code before setting a new password.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const reset = await AdminPasswordReset.findOne({
      email,
      verifiedAt: { $ne: null },
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+resetTokenHash');
    const suppliedHash = hashResetToken(resetToken);
    const storedHash = reset?.resetTokenHash || '';
    const validToken = reset && storedHash.length === suppliedHash.length
      && timingSafeEqual(Buffer.from(storedHash), Buffer.from(suppliedHash));
    if (!validToken) {
      return res.status(400).json({ success: false, message: 'Password reset session is invalid or expired. Verify a new code.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updatedAdmin = await User.findOneAndUpdate(
      { email, role: 'admin' },
      { passwordHash, updatedAt: new Date() },
      { new: true },
    ).select('_id');
    if (!updatedAdmin) {
      return res.status(404).json({ success: false, message: 'The admin account was not found.' });
    }

    await AdminPasswordReset.deleteOne({ _id: reset._id });
    return res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset admin password failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset the password.' });
  }
};
