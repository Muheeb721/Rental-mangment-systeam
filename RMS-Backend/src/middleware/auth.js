import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

const BLOCKED_STATUSES = ['blocked', 'suspended', 'deleted'];

const readBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
};

/**
 * Optional development-only session header (x-rms-session). It is disabled unless
 * ALLOW_DEV_SESSION=true is set and the server is not running in production, and it
 * can never grant the admin role.
 */
const resolveDevSession = (req) => {
  if (process.env.ALLOW_DEV_SESSION !== 'true' || process.env.NODE_ENV === 'production') return null;
  const devSession = req.headers['x-rms-session'];
  if (!devSession) return null;
  try {
    const parsed = typeof devSession === 'string' ? JSON.parse(devSession) : devSession;
    const email = parsed?.email || parsed?.userEmail || '';
    const id = parsed?.id || parsed?.userId || parsed?._id || '';
    if (!id && !email) return null;
    return { id: String(id || email), userId: String(id || email), email, name: parsed?.name || '', role: 'resident', devSession: true };
  } catch {
    return null;
  }
};

/**
 * Verifies the JWT and refreshes role/status from the database so that role changes
 * and blocks made by an admin take effect immediately.
 */
const authenticate = async (req) => {
  const token = readBearerToken(req);
  if (!token) {
    const dev = resolveDevSession(req);
    if (dev) return { user: dev };
    return { error: { status: 401, message: 'Authentication required.' } };
  }

  if (!process.env.JWT_SECRET) {
    return { error: { status: 500, message: 'JWT_SECRET is not configured on the server.' } };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { error: { status: 401, message: 'Invalid or expired token. Please sign in again.' } };
  }

  const id = String(decoded.userId || decoded.id || '');
  const user = {
    ...decoded,
    id,
    userId: id,
  };

  if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(id)) {
    const dbUser = await User.findById(id).select('name email role status archived').lean();
    if (!dbUser) return { error: { status: 401, message: 'Your account no longer exists. Please sign in again.' } };
    if (dbUser.archived || BLOCKED_STATUSES.includes(String(dbUser.status || '').toLowerCase())) {
      return { error: { status: 403, message: 'Your account has been blocked. Please contact support.' } };
    }
    user.role = dbUser.role || user.role;
    user.name = dbUser.name || user.name;
    user.email = dbUser.email || user.email;
  }

  return { user };
};

export const requireAuth = async (req, res, next) => {
  try {
    const result = await authenticate(req);
    if (result.error) return res.status(result.error.status).json({ success: false, message: result.error.message });
    req.user = result.user;
    return next();
  } catch (error) {
    console.error('Authentication failed', error);
    return res.status(500).json({ success: false, message: 'Unable to verify your session.' });
  }
};

/** Attaches req.user when a valid token is present, but never rejects the request. */
export const optionalAuth = async (req, _res, next) => {
  try {
    if (readBearerToken(req) || req.headers['x-rms-session']) {
      const result = await authenticate(req);
      if (result.user) req.user = result.user;
    }
  } catch {
    // ignore - treat as anonymous
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  return next();
};
