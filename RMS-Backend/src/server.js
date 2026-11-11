import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import {createRequire } from 'module';
const require = createRequire(import.meta.url);
const morgan = require('morgan');
import bcrypt from 'bcryptjs';
import { connectDatabase } from './config/database.js';
import { seedDemoIfMissing } from './utils/demoSeeder.js';
import startRentAutomation from './utils/rentAutomation.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import User from './models/User.js';
import UserNotification from './models/UserNotification.js';
import { logAdminAction, getUserActivity, getAdminActivity } from './services/activityService.js';
import { createNotification } from './controllers/notificationController.js';
import {aboutRoutes} from './routes/about.js';

// routers
import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import rentRoutes from './routes/rents.js';
import maintenanceRoutes from './routes/maintenance.js';
import favoriteRoutes from './routes/favorites.js';
import savedSearchRoutes from './routes/saved-searches.js';
import notificationRoutes from './routes/notifications.js';
import contactRoutes from './routes/contact.js';
import propertyInquiryRoutes from './routes/property-inquiries.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import reviewsRoutes from './routes/reviews.js';
import propertyVerificationRoutes from './routes/property-verification.js';
import areasRoutes from './routes/areas.js';
import { placesRouter, travelRouter } from './routes/places.js';
import rentalRoutes from './routes/rentals.js';
import imageRoutes from './routes/images.js';
import applicationsRoutes from './routes/applications.js';
import saleInterestRoutes from './routes/sale-interest.js';

import chatbotRoutes from './routes/chatbotroutes.js';
import siteContentRoutes from './routes/site-content.js';
import uploadRoutes from './routes/uploads.js';
import adminRoutes from './routes/admin.js';
import tenantRoutes from './routes/tenants.js';

const app = express();
const httpServer = http.createServer(app);
const DEFAULT_PORT = 5000;
const configuredPort = Number.parseInt(process.env.PORT || '', 10);
const START_PORT = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT;

// Global error handlers to assist in debugging startup crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection at startup:', reason);
});

const ensureDefaultAdmin = async () => {
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@rental.com').trim().toLowerCase();
  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    const bootstrapPassword = randomBytes(48).toString('hex');
    const passwordHash = await bcrypt.hash(bootstrapPassword, 12);
    await User.create({
      name: 'System Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      phone: '',
      profile: { name: 'System Admin', email: adminEmail, phone: '' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Admin account created for ${adminEmail}. Use the admin password reset flow to set its password.`);
    return;
  }

  if (String(existing.role || '').toLowerCase() !== 'admin') {
    existing.role = 'admin';
    existing.updatedAt = new Date();
    await existing.save();
  }
};

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5177',
  'http://127.0.0.1:5178',
  'http://127.0.0.1:4173',
];

// Extra origins for deployments: CLIENT_URL (single) and CLIENT_URLS (comma separated)
const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');
const configuredOrigins = [process.env.CLIENT_URL, process.env.ADMIN_URL, ...(String(process.env.CLIENT_URLS || '').split(','))]
  .map(normalizeOrigin)
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalized) || configuredOrigins.includes(normalized)) return true;

  return /^http:\/\/(localhost|127\.0\.0\.1):(517[3-9]|518\d|4173)$/.test(normalized);
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-rms-session', 'X-Requested-With'],
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Socket CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

globalThis.__rmsSocketServer = io;
app.set('io', io);

io.use((socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const header = socket.handshake.headers?.authorization || '';
    const token = authToken || (header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!token) return next(new Error('Authentication required.'));

    if (!process.env.JWT_SECRET) return next(new Error('Server authentication is not configured.'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = {
      id: decoded.userId || decoded.id,
      role: String(decoded.role || '').toLowerCase(),
      email: decoded.email || '',
      name: decoded.name || '',
    };

    if (!socket.user.id) return next(new Error('Authentication required.'));
    return next();
  } catch (error) {
    return next(new Error('Invalid or expired socket token.'));
  }
});

io.on('connection', (socket) => {
  if (socket.user.role === 'admin') {
    socket.join(`admin:${String(socket.user.id)}`);
  } else {
    socket.join(`user:${String(socket.user.id)}`);
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// Serve uploaded and demo property images from the backend public directory.
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imagesDir = path.join(backendRoot, 'public', 'images');
const uploadsDir = path.join(backendRoot, 'public', 'uploads');
app.use('/images', express.static(imagesDir));
app.use('/uploads', express.static(uploadsDir));
app.use('/data', express.static(path.join(backendRoot, 'public', 'data')));
app.use(morgan('dev'));

// mount api routers
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rents', rentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/property-inquiries', propertyInquiryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', tenantRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/rent', tenantRoutes);
app.use('/api/rent-settings', tenantRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/property-verification', propertyVerificationRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/places', placesRouter);
app.use('/api/travel', travelRouter);
app.use('/api/rental-profiles', rentalRoutes);
app.use('/api/tenant-profile', rentalRoutes);
app.use('/api/tenant-profiles', rentalRoutes);
app.use('/api/rent-bookings', bookingRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/sale-interest', saleInterestRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/uploads', uploadRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'RMS backend is running.' });
});

app.post('/api/admin/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const input = req.body || {};
    const result = await logAdminAction({
      adminId: input.adminId || req.user?.id || 'admin-01',
      adminName: input.adminName || req.user?.name || 'Admin',
      adminEmail: input.adminEmail || req.user?.email || '',
      userId: input.userId || '',
      userName: input.userName || '',
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId || '',
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      message: input.message,
      reason: input.reason,
      description: input.description,
      propertyName: input.propertyName,
    });

    res.status(201).json({
      success: true,
      data: result.logRecord,
      notification: result.notification,
    });
  } catch (error) {
    console.error('Admin activity log failed', error);
    res.status(500).json({ success: false, message: 'Unable to record admin activity.' });
  }
});

app.get('/api/users/me/activity', requireAuth, async (req, res) => {
  try {
    const logs = await getUserActivity(req.user.id || req.user._id || req.user.email || '');
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('User activity fetch failed', error);
    res.status(500).json({ success: false, message: 'Unable to retrieve activity history.' });
  }
});

app.get('/api/admin/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await getAdminActivity();
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Admin activity fetch failed', error);
    res.status(500).json({ success: false, message: 'Unable to retrieve admin activity.' });
  }
});

app.post('/api/admin/message', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, userName, entityType = 'GENERAL', entityId = '', actionType = 'ANNOUNCEMENT', title, message, reason, status = 'Notice' } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, message: 'A target userId is required.' });
    }

    const notification = await UserNotification.create({
      userId,
      userName: userName || '',
      actorType: 'admin',
      actorName: req.user?.name || 'Admin',
      entityType: String(entityType).toUpperCase(),
      entityId: String(entityId || ''),
      actionType: String(actionType).toUpperCase(),
      title: title || 'Admin message',
      message: message || 'A new message from the admin is available.',
      reason: reason || '',
      status,
      isRead: false,
      createdAt: new Date(),
    });

    await logAdminAction({
      adminId: req.user?.id || 'admin-01',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      userId,
      userName,
      actionType: 'ANNOUNCEMENT',
      entityType: String(entityType).toUpperCase(),
      entityId: String(entityId || ''),
      previousStatus: '',
      newStatus: status,
      message: message || 'Admin message sent.',
      reason: reason || 'Admin announcement',
      description: title || 'Admin message sent',
      propertyName: '',
    });

    return res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error('Admin message creation failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to store the admin message.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// JSON error handler (multer upload errors, malformed JSON, unexpected errors)
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error?.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'Each image must be 5MB or smaller.',
      LIMIT_FILE_COUNT: 'You can upload at most 10 images at a time.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Send images in the "images" field.',
    };
    return res.status(400).json({ success: false, message: messages[error.code] || error.message });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON body.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  const status = Number(error?.status || error?.statusCode) || 500;
  if (status >= 500) console.error('Unhandled request error:', error);
  return res.status(status).json({ success: false, message: status >= 500 ? 'Something went wrong on the server.' : error.message });
});

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('Set JWT_SECRET to a random value of at least 32 characters in the backend .env file.');
    }
    await connectDatabase();
    await ensureDefaultAdmin();
    try {
      await seedDemoIfMissing();
    } catch (e) {
      console.warn('Demo seeder failed', e?.message || e);
    }

    try {
      await startRentAutomation();
    } catch (e) {
      console.warn('Rent automation failed to start', e?.message || e);
    }

    const candidatePorts = Array.from({ length: 10 }, (_, index) => START_PORT + index);

    const listenOnPort = (portIndex = 0) => {
      const port = candidatePorts[portIndex];
      const server = httpServer.listen(port, () => {
        console.log(`RMS backend listening on http://localhost:${port}`);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && portIndex < candidatePorts.length - 1) {
          console.warn(`Port ${port} is already in use. Retrying on http://localhost:${candidatePorts[portIndex + 1]}`);
          listenOnPort(portIndex + 1);
          return;
        }

        console.error(`Failed to start backend on port ${port}:`, error.message || error);
        process.exit(1);
      });
    };

    listenOnPort();
  } catch (error) {
    console.error('Failed to start backend:', error);
    process.exit(1);
  }
};

startServer();

