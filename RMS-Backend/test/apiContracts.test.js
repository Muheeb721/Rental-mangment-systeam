import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { closeDatabase, connectDatabase } from '../src/config/database.js';

// Controller tests use an isolated database and never write to the persistent development store.
await connectDatabase({ ephemeral: true });

after(async () => {
  await closeDatabase();
});

import { createRentRecord, listRentRecords } from '../src/controllers/rentController.js';
import { createMaintenanceRequest, listMaintenanceRequests } from '../src/controllers/maintenanceController.js';
import { updatePaymentStatus } from '../src/controllers/paymentController.js';
import { createRentalProfile } from '../src/controllers/rentalController.js';
import { createBooking } from '../src/controllers/bookingController.js';
import { createNotification } from '../src/controllers/notificationController.js';
import { login, signup } from '../src/controllers/authController.js';
import { verifyAdminPasswordResetOtp, resetAdminPassword } from '../src/controllers/adminPasswordResetController.js';
import { sendAdminPasswordResetOtp } from '../src/controllers/adminPasswordResetController.js';
import { sendRentalDetailsEmails } from '../src/services/emailService.js';
import { getRentalAgreementPath } from '../src/services/rentalAgreementService.js';
import AdminPasswordReset from '../src/models/AdminPasswordReset.js';
import User from '../src/models/User.js';
import Property from '../src/models/Property.js';
import RentalProfile from '../src/models/RentalProfile.js';
import RentApplication from '../src/models/RentApplication.js';
import bcrypt from 'bcryptjs';
import authRoutes from '../src/routes/auth.js';
import applicationRoutes from '../src/routes/applications.js';
import rentalRoutes from '../src/routes/rentals.js';
import notificationRoutes from '../src/routes/notifications.js';

const makeRes = () => {
  const res = {};
  res.status = (code) => {
    res.code = code;
    return res;
  };
  res.json = (payload) => {
    res.payload = payload;
    return res;
  };
  return res;
};

test('rent API contract includes record creation and listing support', async () => {
  const req = {
    user: { id: 'u-1', name: 'User One', email: 'user@example.com' },
    body: { propertyId: 'p-1', propertyName: 'DHA Villa', monthlyRent: 50000, paid: 30000, dueDate: '2026-09-05', month: 'September 2026' },
  };

  const res = makeRes();
  await createRentRecord(req, res);

  assert.equal(res.code, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.userId, 'u-1');

  const listRes = makeRes();
  await listRentRecords({ user: { id: 'u-1' }, query: {} }, listRes);
  assert.equal(listRes.payload.success, true);
  assert.ok(Array.isArray(listRes.payload.data));
});

test('maintenance API contract includes creation and listing support', async () => {
  const req = {
    user: { id: 'u-1', name: 'User One', email: 'user@example.com' },
    body: { propertyId: 'p-1', propertyName: 'DHA Villa', title: 'Leakage', description: 'Kitchen sink leak', category: 'Plumbing' },
  };

  const res = makeRes();
  await createMaintenanceRequest(req, res);

  assert.equal(res.code, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.userId, 'u-1');

  const listRes = makeRes();
  await listMaintenanceRequests({ user: { id: 'u-1' }, query: {} }, listRes);
  assert.equal(listRes.payload.success, true);
  assert.ok(Array.isArray(listRes.payload.data));
});

test('payment status updates support approve and reject actions', async () => {
  const { default: Payment } = await import('../src/models/Payment.js');
  const payment = await Payment.create({ userId: 'user-1', amount: 5000, status: 'Pending' });
  const admin = { id: 'admin-1', role: 'admin', name: 'Admin' };

  const res = makeRes();
  await updatePaymentStatus({ user: admin, params: { id: String(payment._id) }, body: { status: 'Approved', reason: 'verified' } }, res);
  assert.equal(res.code ?? 200, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.status, 'Approved');

  const rejectRes = makeRes();
  await updatePaymentStatus({ user: admin, params: { id: String(payment._id) }, body: { status: 'Rejected', reason: 'bounced' } }, rejectRes);
  assert.equal(rejectRes.payload.data.status, 'Rejected');

  const missing = makeRes();
  await updatePaymentStatus({ user: admin, params: { id: 'payment-1' }, body: { status: 'Approved' } }, missing);
  assert.equal(missing.code, 404);
});

test('tenant profiles can be created without a profile image when core tenant data is present', async () => {
  const req = {
    user: { id: 'u-rental-1', name: 'Rental User', email: 'rent@example.com' },
    body: {
      fullName: 'Rental User',
      email: 'rent@example.com',
      phone: '+923001234567',
      currentAddress: 'Block A, Gulshan, Karachi',
      city: 'Karachi',
      occupation: 'Software Engineer',
      emergencyContactName: 'Ali User',
      emergencyContactPhone: '+923001234568',
      propertyId: 'p-rent-1',
      propertyName: 'Sky Residences',
      propertyType: 'Apartment',
      status: 'Pending',
      profileStatus: 'Profile Complete',
    },
  };

  const res = makeRes();
  await createRentalProfile(req, res);

  assert.equal(res.code, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.userId, 'u-rental-1');
  assert.equal(res.payload.data.profileStatus, 'Profile Complete');
});

test('booking and payment payloads keep the real frontend fields required by RMS', async () => {
  const bookingUser = await User.create({
    name: 'Jane Doe',
    email: 'jane@example.com',
    passwordHash: 'test-hash',
    phone: '+923001234567',
    role: 'resident',
  });
  const rentalProperty = await Property.create({
    title: 'Garden Residency',
    propertyType: 'Apartment',
    listingType: 'rent',
    transactionType: 'Rent',
    purpose: 'Rent',
    rent: 35000,
    status: 'Available',
    availability: 'Available',
  });
  await RentalProfile.create({
    userId: bookingUser._id.toString(),
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+923001234567',
    currentAddress: 'Test address',
    city: 'Karachi',
  });
  const bookingReq = {
    user: { id: bookingUser._id.toString(), name: 'Jane Doe', email: 'jane@example.com' },
    body: {
      propertyId: rentalProperty._id.toString(),
      propertyTitle: 'Garden Residency',
      customerName: 'Jane Doe',
      customerPhone: '+923001234567',
      bookingDate: '2026-09-10',
      visitDate: '2026-09-12',
      amount: 35000,
      notes: 'Need a 2-bedroom family flat',
      bookingStatus: 'Pending',
      paymentStatus: 'Pending',
    },
  };

  const bookingRes = makeRes();
  await createRentRecord({
    user: bookingReq.user,
    body: { propertyId: 'p-10', propertyName: 'Garden Residency', monthlyRent: 35000, paid: 0, dueDate: '2026-09-10', month: 'September 2026' },
  }, makeRes());

  await createBooking(bookingReq, bookingRes);

  assert.equal(bookingRes.code, 201);
  assert.equal(bookingRes.payload.success, true);
  assert.equal(bookingRes.payload.data.propertyTitle, 'Garden Residency');
  assert.equal(bookingRes.payload.data.customerName, 'Jane Doe');
  assert.equal(bookingRes.payload.data.paymentStatus, 'Pending');
  assert.equal(bookingRes.payload.data.userEmail, 'jane@example.com');
  assert.equal((await Property.findById(rentalProperty._id)).status, 'Booked');

  const duplicateBookingRes = makeRes();
  await createBooking({ user: { id: bookingUser._id.toString() }, body: { propertyId: rentalProperty._id.toString() } }, duplicateBookingRes);
  assert.equal(duplicateBookingRes.code, 409);
  assert.match(duplicateBookingRes.payload.message, /already been booked/i);

  const manualProperty = await Property.create({
    title: 'Admin Manual Booking Listing',
    propertyType: 'House',
    listingType: 'rent',
    rent: 42000,
    status: 'Available',
    availability: 'Available',
  });
  const adminUser = await User.create({
    name: 'Manual Booking Admin',
    email: 'manual-booking-admin@example.com',
    passwordHash: 'test-hash',
    role: 'admin',
  });
  const manualBookingRes = makeRes();
  await createBooking({
    user: { id: adminUser._id.toString(), role: 'admin', name: adminUser.name },
    body: { propertyId: manualProperty._id.toString(), customerName: 'Walk-in Customer', customerPhone: '+923001112233' },
  }, manualBookingRes);
  assert.equal(manualBookingRes.code, 201);
  assert.equal(manualBookingRes.payload.data.userName, 'Walk-in Customer');

  const paymentReq = {
    user: { id: bookingUser._id.toString(), name: 'Jane Doe', email: 'jane@example.com' },
    body: {
      bookingId: 'bk-2026-001',
      propertyId: 'p-10',
      propertyName: 'Garden Residency',
      amount: 12000,
      paymentType: 'Advance',
      transactionId: 'TXN-001',
      status: 'Approved',
    },
  };

  const paymentRes = makeRes();
  const { createPayment } = await import('../src/controllers/paymentController.js');
  await createPayment(paymentReq, paymentRes);

  assert.equal(paymentRes.code, 201);
  assert.equal(paymentRes.payload.success, true);
  assert.equal(paymentRes.payload.data.propertyName, 'Garden Residency');
  // users can never approve their own payment; it waits for admin review
  assert.equal(paymentRes.payload.data.status, 'Pending');
});

test('authenticated users can create notifications without sending a userId in the payload', async () => {
  const req = {
    user: { id: 'user-portal-1', name: 'Portal User', email: 'portal@example.com' },
    body: {
      title: 'Booking Confirmed',
      message: 'Your booking has been confirmed.',
      entityType: 'BOOKING',
      actionType: 'BOOKING_CONFIRMED',
      status: 'Notice',
    },
  };

  const res = makeRes();
  await createNotification(req, res);

  assert.equal(res.code, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.userId, 'user-portal-1');
  assert.equal(res.payload.data.userName, 'Portal User');
  assert.equal(res.payload.data.title, 'Booking Confirmed');
});

test('admin reset OTP is emailed, hashed, expires after ten minutes, and respects resend cooldown', async (t) => {
    const email = `otp-flow-${Date.now()}@example.com`;
    const envKeys = ['ADMIN_EMAIL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'SMTP_SECURE'];
    const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      ADMIN_EMAIL: email,
      SMTP_HOST: 'smtp.test.local',
      SMTP_PORT: '587',
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-password',
      MAIL_FROM: 'noreply@example.com',
    });
    delete process.env.SMTP_SECURE;
    t.after(() => {
      for (const key of envKeys) {
        if (previousEnv[key] === undefined) delete process.env[key];
        else process.env[key] = previousEnv[key];
      }
    });

    await User.create({
      name: 'OTP Test Admin',
      email,
      passwordHash: await bcrypt.hash('old-password', 4),
      role: 'admin',
    });

    let deliveredMessage;
    t.mock.method(nodemailer, 'createTransport', () => ({
      sendMail: async (message) => {
        deliveredMessage = message;
        return { messageId: 'otp-test-message' };
      },
    }));

    const sendRes = makeRes();
    await sendAdminPasswordResetOtp({ body: { email } }, sendRes);
    assert.equal(sendRes.payload.success, true);
    assert.equal(deliveredMessage.to, email);
    const otp = deliveredMessage.text.match(/\b\d{6}\b/)?.[0];
    assert.ok(otp, 'the email should contain a six-digit OTP');

    const reset = await AdminPasswordReset.findOne({ email }).select('+otpHash');
    assert.ok(reset);
    assert.notEqual(reset.otpHash, otp);
    assert.equal(await bcrypt.compare(otp, reset.otpHash), true);
    assert.ok(Math.abs(reset.expiresAt.getTime() - reset.createdAt.getTime() - 10 * 60 * 1000) < 1000);

    const cooldownRes = makeRes();
    await sendAdminPasswordResetOtp({ body: { email } }, cooldownRes);
    assert.equal(cooldownRes.code, 429);
});

test('rental email sends details to both the user and configured admin', async (t) => {
    const userEmail = `rental-email-user-${Date.now()}@example.com`;
    const adminEmail = `rental-email-admin-${Date.now()}@example.com`;
    const envKeys = ['ADMIN_EMAIL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
    const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      ADMIN_EMAIL: adminEmail,
      SMTP_HOST: 'smtp.test.local',
      SMTP_PORT: '587',
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-password',
      MAIL_FROM: 'noreply@example.com',
    });
    t.after(() => {
      for (const key of envKeys) {
        if (previousEnv[key] === undefined) delete process.env[key];
        else process.env[key] = previousEnv[key];
      }
    });

    const deliveredMessages = [];
    t.mock.method(nodemailer, 'createTransport', () => ({
      sendMail: async (message) => {
        deliveredMessages.push(message);
        return { messageId: 'rental-test-message' };
      },
    }));
    const deliveries = await sendRentalDetailsEmails({
      rental: {
        _id: `rental-${Date.now()}`,
        userId: 'rental-user-id',
        userName: 'Rental Email User',
        userEmail,
        propertyTitle: 'Test Residence',
        propertyType: 'Apartment',
        moveInDate: new Date('2026-10-01T00:00:00.000Z'),
        rent: 45000,
      },
      status: 'approved',
      eventType: 'approved',
    });

    assert.equal(deliveries.length, 2);
    assert.ok(deliveries.every((delivery) => delivery.success));
    assert.deepEqual(new Set(deliveredMessages.map((message) => message.to)), new Set([userEmail, adminEmail]));
    for (const message of deliveredMessages) {
      assert.match(message.text, /Test Residence/);
      assert.match(message.text, /Rental Email User/);
      assert.match(message.text, /2026-10-01/);
      assert.match(message.text, /45,000/);
      assert.match(message.text, /approved/);
    }
});

test('admin OTP verification limits attempts, expires, resets the password, and permits login', async (t) => {
  const email = `admin-reset-${Date.now()}@example.com`;
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const originalSecret = process.env.JWT_SECRET;
  process.env.ADMIN_EMAIL = email;
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
  t.after(() => {
    if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalAdminEmail;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });
  const admin = await User.create({
    name: 'RMS Reset Admin',
    email,
    passwordHash: await bcrypt.hash('old-password', 4),
    role: 'admin',
    profileImage: '/uploads/admin-profile.jpg',
  });
  const failedReset = await AdminPasswordReset.create({
    email,
    otpHash: await bcrypt.hash('123456', 4),
    expiresAt: new Date(Date.now() + 60_000),
    resendAfter: new Date(Date.now() + 30_000),
  });

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const failedRes = makeRes();
    await verifyAdminPasswordResetOtp({ body: { email, otp: '999999' } }, failedRes);
    assert.equal(failedRes.code, 400);
    assert.match(failedRes.payload.message, new RegExp(`${5 - attempt} attempt`));
  }
  const lockedRes = makeRes();
  await verifyAdminPasswordResetOtp({ body: { email, otp: '999999' } }, lockedRes);
  assert.equal(lockedRes.code, 400);
  assert.equal(await AdminPasswordReset.findById(failedReset._id), null);

  const validReset = await AdminPasswordReset.create({
    email,
    otpHash: await bcrypt.hash('123456', 4),
    expiresAt: new Date(Date.now() + 60_000),
    resendAfter: new Date(Date.now() + 30_000),
  });
  const verifyRes = makeRes();
  await verifyAdminPasswordResetOtp({ body: { email, otp: '123456' } }, verifyRes);
  assert.equal(verifyRes.payload.success, true);
  assert.equal((await AdminPasswordReset.findById(validReset._id).select('+otpHash')).otpHash, '');

  const resetRes = makeRes();
  await resetAdminPassword({
    body: { email, resetToken: verifyRes.payload.resetToken, password: 'new-password', confirmPassword: 'new-password' },
  }, resetRes);
  assert.equal(resetRes.payload.success, true);
  assert.equal(await AdminPasswordReset.findById(validReset._id), null);

  const loginRes = makeRes();
  await login({ body: { email, password: 'new-password' } }, loginRes);
  assert.equal(loginRes.payload.success, true);
  assert.equal(loginRes.payload.user.role, 'admin');
  assert.equal(loginRes.payload.user.profileImage, '/uploads/admin-profile.jpg');

  const expiredRes = makeRes();
  await AdminPasswordReset.create({
    email,
    otpHash: await bcrypt.hash('123456', 4),
    expiresAt: new Date(Date.now() - 1000),
    resendAfter: new Date(Date.now() - 1000),
  });
  await verifyAdminPasswordResetOtp({ body: { email, otp: '123456' } }, expiredRes);
  assert.equal(expiredRes.code, 400);
  assert.match(expiredRes.payload.message, /expired/i);
  assert.equal(await User.findById(admin._id).select('+passwordHash').then((record) => record.comparePassword('new-password')), true);
});

test('rental API creates user and admin notifications through application status changes', async (t) => {
    const originalSecret = process.env.JWT_SECRET;
    const originalAdminEmail = process.env.ADMIN_EMAIL;
    const mailEnvKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
    const originalMailEnv = Object.fromEntries(mailEnvKeys.map((key) => [key, process.env[key]]));
    const secret = 'test-secret-with-more-than-thirty-two-characters';
    const adminEmail = `notification-admin-${Date.now()}@example.com`;
    process.env.JWT_SECRET = secret;
    process.env.ADMIN_EMAIL = adminEmail;
    Object.assign(process.env, {
      SMTP_HOST: 'smtp.test.local',
      SMTP_PORT: '587',
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-password',
      MAIL_FROM: 'noreply@example.com',
    });
    t.after(() => {
      if (originalSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalSecret;
      if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = originalAdminEmail;
      for (const key of mailEnvKeys) {
        if (originalMailEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalMailEnv[key];
      }
    });
    const sentMessages = [];
    t.mock.method(nodemailer, 'createTransport', () => ({
      sendMail: async (message) => {
        sentMessages.push(message);
        return { messageId: 'e2e-rental-message' };
      },
    }));

    const admin = await User.create({
      name: 'Notification Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash('admin-password', 4),
      role: 'admin',
    });
    const adminToken = jwt.sign({
      userId: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: 'admin',
    }, secret);

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/rentals', rentalRoutes);
    app.use('/api/applications', applicationRoutes);
    app.use('/api/notifications', notificationRoutes);
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const api = async (path, { token, method = 'GET', body } = {}) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    };

    const email = `notification-user-${Date.now()}@example.com`;
    const signupResponse = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Notification User', email, phone: '+923009876543', password: 'secure-test-password' },
    });
    assert.equal(signupResponse.status, 201);
    const userToken = signupResponse.data.token;
    const userId = signupResponse.data.user.id;
    const primaryProperty = await Property.create({
      title: 'Notification Residence',
      propertyType: 'Apartment',
      listingType: 'rent',
      transactionType: 'Rent',
      purpose: 'Rent',
      rent: 45000,
      status: 'Available',
      availability: 'Available',
    });
    const secondProperty = await Property.create({
      title: 'Second Residence',
      propertyType: 'Apartment',
      listingType: 'rent',
      transactionType: 'Rent',
      purpose: 'Rent',
      rent: 50000,
      status: 'Available',
      availability: 'Available',
    });

    const profileResponse = await api('/rentals', {
      method: 'POST',
      token: userToken,
      body: {
        fullName: 'Notification User',
        email,
        phone: '+923009876543',
        currentAddress: '10 Test Avenue',
        city: 'Karachi',
        occupation: 'Engineer',
        emergencyContactName: 'Test Contact',
        propertyId: primaryProperty._id.toString(),
        propertyName: 'Notification Residence',
      },
    });
    assert.equal(profileResponse.status, 201);

    const submitted = await api('/applications', {
      method: 'POST',
      token: userToken,
      body: {
        propertyId: primaryProperty._id.toString(),
        propertyTitle: 'Notification Residence',
        propertyType: 'Apartment',
        rent: 45000,
        cnic: '42101-1234567-1',
        preferredMoveInDate: '2026-10-01',
        toDate: '2027-09-30',
        rentalDuration: '12 months',
        occupants: 2,
      },
    });
    assert.equal(submitted.status, 201);
    assert.equal(submitted.data.data.userId, userId);
    assert.equal(submitted.data.data.cnic, '42101-1234567-1');
    assert.equal(submitted.data.data.rentalEndDate, '2027-09-30T00:00:00.000Z');
    assert.match(submitted.data.data.agreementPath, /^\/applications\/.+\/agreement$/);
    const savedApplication = await RentApplication.findById(submitted.data.data._id);
    assert.equal(savedApplication.agreementPath, submitted.data.data.agreementPath);
    const agreementPath = getRentalAgreementPath(savedApplication._id);
    t.after(() => fs.promises.rm(agreementPath, { force: true }));
    assert.equal(await fs.promises.readFile(agreementPath).then((pdf) => pdf.subarray(0, 4).toString()), '%PDF');
    const attachedMessages = sentMessages.filter((message) => message.attachments?.some((attachment) => attachment.contentType === 'application/pdf'));
    assert.equal(attachedMessages.length, 2);
    assert.deepEqual(new Set(attachedMessages.map((message) => message.to)), new Set([email, adminEmail]));
    assert.ok(attachedMessages.every((message) => message.attachments[0].path === agreementPath));
    assert.ok(attachedMessages.every((message) => (
      message.text.includes('Notification Residence')
      && message.text.includes('Notification User')
      && message.text.includes('42101-1234567-1')
      && message.text.includes('2026-10-01')
      && message.text.includes('2027-09-30')
      && message.text.includes('45,000')
    )), attachedMessages.map((message) => message.text).join('\n--- EMAIL ---\n'));

    const agreementResponse = await fetch(`${baseUrl}${savedApplication.agreementPath}`, {
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(agreementResponse.status, 200, await agreementResponse.clone().text());
    assert.match(agreementResponse.headers.get('content-type'), /application\/pdf/);
    assert.equal((await agreementResponse.arrayBuffer()).byteLength > 500, true);
    const anonymousAgreementResponse = await fetch(`${baseUrl}${savedApplication.agreementPath}`);
    assert.equal(anonymousAgreementResponse.status, 401);
    const adminAgreementResponse = await fetch(`${baseUrl}${savedApplication.agreementPath}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminAgreementResponse.status, 200);

    const userNotifications = await api('/notifications', { token: userToken });
    const userSubmissionNotification = userNotifications.data.data.find((item) => item.actionType === 'RENT_APPLICATION_SUBMITTED');
    assert.ok(userSubmissionNotification);
    assert.equal(userSubmissionNotification.metadata.agreementUrl, savedApplication.agreementPath);
    const adminNotifications = await api('/notifications/admin/all', { token: adminToken });
    const adminSubmissionNotification = adminNotifications.data.data.find((item) => item.actionType === 'RENT_APPLICATION_SUBMITTED');
    assert.ok(adminSubmissionNotification);
    assert.equal(adminSubmissionNotification.metadata.rentalApplicationId, savedApplication._id.toString());

    const accepted = await api(`/applications/${submitted.data.data._id}/accept`, {
      method: 'PUT',
      token: adminToken,
    });
    assert.equal(accepted.status, 200);
    assert.equal((await Property.findById(primaryProperty._id)).status, 'Booked');
    const rejectedApplication = await api('/applications', {
      method: 'POST',
      token: userToken,
      body: { propertyId: secondProperty._id.toString(), propertyTitle: 'Second Residence', rent: 50000 },
    });
    assert.equal(rejectedApplication.status, 201);
    const rejected = await api(`/applications/${rejectedApplication.data.data._id}/reject`, {
      method: 'PUT',
      token: adminToken,
      body: { reason: 'The property is no longer available.' },
    });
    assert.equal(rejected.status, 200);
    assert.equal((await Property.findById(secondProperty._id)).status, 'Available');

    const statusChanged = await api(`/rentals/${profileResponse.data.data._id}/status`, {
      method: 'POST',
      token: adminToken,
      body: { status: 'Approved' },
    });
    assert.equal(statusChanged.status, 200);
    const updatedNotifications = await api('/notifications', { token: userToken });
    const actions = updatedNotifications.data.data.map((item) => item.actionType);
    assert.ok(actions.includes('RENT_APPLICATION_ACCEPTED'));
    assert.ok(actions.includes('RENT_APPLICATION_REJECTED'));
    assert.ok(actions.includes('RENTAL_STATUS_CHANGED'));

    const unread = await api('/notifications/unread-count', { token: userToken });
    assert.ok(unread.data.data.count >= 4);
    const markAll = await api('/notifications/mark-all-read', { method: 'POST', token: userToken });
    assert.equal(markAll.data.success, true);
    const readCount = await api('/notifications/unread-count', { token: userToken });
    assert.equal(readCount.data.data.count, 0);
});

test('new resident can sign up, complete rental profile, and book the selected rental listing', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
  const signupRes = makeRes();
  const email = `rent-flow-${Date.now()}@example.com`;
  try {
    await signup({
      body: { name: 'Rental Flow User', email, phone: '+923009876543', password: 'secure-test-password', role: 'admin' },
    }, signupRes);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }

  assert.equal(signupRes.code, 201);
  assert.equal(signupRes.payload.user.role, 'resident');
  assert.ok(signupRes.payload.token);

  const property = await Property.create({
    title: 'New Resident Rental',
    propertyType: 'House',
    listingType: 'rent',
    transactionType: 'Rent',
    purpose: 'Rent',
    rent: 60000,
    status: 'Available',
    availability: 'Available',
  });
  const user = signupRes.payload.user;
  const requestBooking = () => ({
    user: { id: user.id, userId: user.id, name: user.name, email: user.email },
    body: { propertyId: property._id.toString(), userId: 'not-the-authenticated-user', rent: 1 },
  });

  // bookings no longer require a rental profile first (a minimal one is auto-created), so go straight to the profile

  const profileRes = makeRes();
  await createRentalProfile({
    user: { id: user.id, name: user.name, email: user.email },
    body: {
      fullName: user.name,
      email: user.email,
      phone: '+923009876543',
      currentAddress: '12 Test Street',
      city: 'Karachi',
      occupation: 'Engineer',
      emergencyContactName: 'Test Contact',
      profileImage: '/uploads/rent-flow-profile.jpg',
      cnicImage: '/uploads/rent-flow-cnic.jpg',
    },
  }, profileRes);
  assert.equal(profileRes.code, 201);

  const profileUpdateRes = makeRes();
  await createRentalProfile({
    user: { id: user.id, name: user.name, email: user.email },
    body: {
      fullName: user.name,
      email: user.email,
      phone: '+923009876543',
      currentAddress: '12 Test Street',
      city: 'Karachi',
      occupation: 'Engineer',
      emergencyContactName: 'Test Contact',
    },
  }, profileUpdateRes);
  assert.equal(profileUpdateRes.code, 200);
  assert.equal(profileUpdateRes.payload.data.profileImage, '/uploads/rent-flow-profile.jpg');
  assert.equal(profileUpdateRes.payload.data.cnicImage, '/uploads/rent-flow-cnic.jpg');

  const bookingRes = makeRes();
  await createBooking(requestBooking(), bookingRes);
  assert.equal(bookingRes.code, 201);
  assert.equal(bookingRes.payload.data.userId.toString(), String(user.id));
  assert.equal(bookingRes.payload.data.rent, 60000);
  assert.equal(bookingRes.payload.data.profileImage, '/uploads/rent-flow-profile.jpg');
  assert.equal(bookingRes.payload.data.cnicImage, '/uploads/rent-flow-cnic.jpg');
  assert.equal((await Property.findById(property._id)).status, 'Booked');
  assert.equal((await User.findById(user.id)).hasRentalProfile, true);
});
