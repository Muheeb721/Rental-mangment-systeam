import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';

/** One-time reset tokens for residents/owners (admins use the OTP flow under /api/auth/admin/*). */
const resetSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});
const UserPasswordReset = mongoose.models.UserPasswordReset || mongoose.model('UserPasswordReset', resetSchema, 'user_password_resets');

const TOKEN_TTL_MINUTES = 30;
const GENERIC_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const siteUrl = () => String(process.env.CLIENT_URL || 'http://localhost:5175').split(',')[0].trim().replace(/\/+$/, '');

/** POST /api/auth/forgot-password { email } - always answers with the same generic message. */
export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });

    const user = await User.findOne({ email, archived: { $ne: true } }).lean();
    if (user && String(user.role).toLowerCase() !== 'admin') {
      const recent = await UserPasswordReset.exists({ userId: String(user._id), createdAt: { $gt: new Date(Date.now() - 60 * 1000) } });
      if (!recent) {
        const token = crypto.randomBytes(32).toString('hex');
        await UserPasswordReset.create({ userId: String(user._id), tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000) });
        const link = `${siteUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
        const result = await sendEmail({
          to: email,
          type: 'user_password_reset',
          subject: 'Reset your RMS password',
          text: `Hi ${user.name},\n\nUse this link to reset your RMS password (valid for ${TOKEN_TTL_MINUTES} minutes):\n${link}\n\nIf you did not request this, ignore this email.`,
          html: `<p>Hi ${user.name},</p><p>Use the button below to reset your RMS password. The link is valid for ${TOKEN_TTL_MINUTES} minutes.</p><p><a href="${link}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
          userId: String(user._id),
        }).catch((error) => ({ success: false, message: error.message }));
        if (!result?.success) {
          // development fallback when SMTP is not configured
          console.log(`[password reset] SMTP unavailable - reset link for ${email}: ${link}`);
        }
      }
    }
    return res.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error('Forgot password failed', error);
    return res.status(500).json({ success: false, message: 'Unable to start password reset.' });
  }
};

/** POST /api/auth/reset-password { token, password, confirmPassword? } */
export const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: 'Reset token is missing.' });
    if (String(password || '').length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    if (confirmPassword !== undefined && String(confirmPassword) !== String(password)) return res.status(400).json({ success: false, message: 'Passwords do not match.' });

    const record = await UserPasswordReset.findOne({ tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } });
    if (!record) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Request a new one.' });
    const user = await User.findById(record.userId).select('+passwordHash');
    if (!user) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Request a new one.' });

    user.passwordHash = await bcrypt.hash(String(password), 10);
    await user.save();
    record.usedAt = new Date();
    await record.save();
    await UserPasswordReset.updateMany({ userId: record.userId, usedAt: null }, { $set: { usedAt: new Date() } });
    return res.json({ success: true, message: 'Your password has been reset. You can now sign in.' });
  } catch (error) {
    console.error('Reset password failed', error);
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
};
