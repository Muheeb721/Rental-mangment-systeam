import express from 'express';
import { signup, login, me, changePassword } from '../controllers/authController.js';
import {
  sendAdminPasswordResetOtp,
  verifyAdminPasswordResetOtp,
  resetAdminPassword,
} from '../controllers/adminPasswordResetController.js';
import { requireAuth } from '../middleware/auth.js';
import { forgotPassword, resetPassword } from '../controllers/userPasswordResetController.js';

const router = express.Router();

router.post('/register', signup);
router.post('/signup', signup);
router.post('/login', login);
router.post('/admin/forgot-password', sendAdminPasswordResetOtp);
router.post('/admin/verify-otp', verifyAdminPasswordResetOtp);
router.post('/admin/reset-password', resetAdminPassword);
router.get('/me', requireAuth, me);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/change-password', requireAuth, changePassword);
router.post('/change-password', requireAuth, changePassword);

export default router;
