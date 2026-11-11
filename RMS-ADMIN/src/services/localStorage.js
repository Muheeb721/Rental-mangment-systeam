export const STORAGE_KEYS = {
  properties: 'rms_admin_properties',
  users: 'rms_admin_users',
  bookings: 'rms_admin_bookings',
  payments: 'rms_admin_payments',
  dues: 'rms_admin_dues',
  tenants: 'rms_tenants',
  rentRecords: 'rms_rent_records',
  rentPayments: 'rms_rent_payments',
  rentReminders: 'rms_rent_reminders',
  rentSettings: 'rms_rent_settings',
  notifications: 'rms_admin_notifications',
  settings: 'rms_admin_settings',
  profile: 'rms_admin_profile',
  activityLogs: 'rms_admin_activity_logs',
};

export const AUTH_KEY = 'rms_admin_auth';

export const generateId = (prefix = 'id') => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${randomPart}`;
};

export const generateTenantId = (tenants = []) => {
  const next = (tenants.length || 0) + 1;
  return `TEN-${String(next).padStart(3, '0')}`;
};

const monthKey = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const generateRentRecordId = (date, existing = []) => {
  const key = monthKey(date);
  const count = (existing || []).filter((r) => r.id && r.id.includes(`RENT-${key}`)).length + 1;
  return `RENT-${key}-${String(count).padStart(3, '0')}`;
};

export const generateRentPaymentId = (date, existing = []) => {
  const key = monthKey(date);
  const count = (existing || []).filter((p) => p.id && p.id.includes(`RPAY-${key}`)).length + 1;
  return `RPAY-${key}-${String(count).padStart(3, '0')}`;
};

export const generateReminderId = (date, existing = []) => {
  const key = monthKey(date);
  const count = (existing || []).filter((r) => r.id && r.id.includes(`REM-${key}`)).length + 1;
  return `REM-${key}-${String(count).padStart(3, '0')}`;
};

export const calculateRentStatus = (record, settings = {}) => {
  const today = new Date();
  if (!record) return 'Upcoming';
  const due = record.dueDate ? new Date(record.dueDate) : null;
  const rent = Number(record.amount || record.monthlyRent || 0);
  const paid = Number(record.paidAmount || 0);

  if (paid >= rent) return 'Paid';
  if (paid > 0 && paid < rent) return 'Partial';
  if (!due) return 'Upcoming';

  // consider grace period
  const grace = Number((settings && settings.gracePeriod) || 0);
  const dueWithGrace = new Date(due);
  dueWithGrace.setDate(dueWithGrace.getDate() + grace);

  if (today > dueWithGrace) return 'Overdue';
  if (today.toDateString() === dueWithGrace.toDateString() || today <= dueWithGrace) return 'Due';
  return 'Upcoming';
};

const safeParse = (value, fallback) => {
  if (value == null || value === '') return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (error) {
    console.warn('Invalid localStorage value:', error);
    return fallback;
  }
};

export const readStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  return safeParse(window.localStorage.getItem(key), fallback);
};

export const writeStorage = (key, value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const removeStorage = (key) => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
};

export const buildDefaultState = () => ({
  admin: {
    fullName: 'Ayesha Khan',
    name: 'Ayesha Khan',
    email: 'muheebshahid75@gmail.com',
    phone: '+92 300 1234567',
    role: 'Super Administrator',
    profileImage: '',
  },
  properties: [
    {
      id: 'prop-101',
      title: 'Pearl Residency',
      propertyType: 'House',
      category: 'House',
      description: 'Luxury house with landscaped courtyard and security cameras.',
      price: 7500000,
      rent: 180000,
      salePrice: 7500000,
      location: 'Gulshan',
      city: 'Karachi',
      address: 'Street 12, Gulshan-e-Iqbal',
      bedrooms: 4,
      bathrooms: 3,
      area: 2400,
      furnished: 'Fully Furnished',
      ownerName: 'Nadia Haris',
      ownerPhone: '+92 300 1000001',
      ownerEmail: 'nadia@example.com',
      image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80',
      images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80'],
      status: 'Available',
      createdAt: '2025-03-20T10:00:00.000Z',
      updatedAt: '2025-08-01T10:00:00.000Z',
    },
    {
      id: 'prop-102',
      title: 'Skyline Apartments',
      propertyType: 'Apartment',
      category: 'Apartment',
      description: 'Modern apartment block close to public transport and shopping.',
      price: 9300000,
      rent: 220000,
      salePrice: 9300000,
      location: 'Clifton',
      city: 'Karachi',
      address: 'Block 5, Clifton Road',
      bedrooms: 3,
      bathrooms: 2,
      area: 1850,
      furnished: 'Semi Furnished',
      ownerName: 'Zahra Ali',
      ownerPhone: '+92 300 1000002',
      ownerEmail: 'zahra@example.com',
      image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80',
      images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80'],
      status: 'Reserved',
      createdAt: '2025-04-02T10:00:00.000Z',
      updatedAt: '2025-08-10T10:00:00.000Z',
    },
    {
      id: 'prop-103',
      title: 'Oaklane Flat',
      propertyType: 'Flat',
      category: 'Flat',
      description: 'Two-bedroom flat with balcony and access to utility services.',
      price: 6100000,
      rent: 145000,
      salePrice: 6100000,
      location: 'Bahria Town',
      city: 'Rawalpindi',
      address: 'Plot 22, Bahria Phase 8',
      bedrooms: 2,
      bathrooms: 2,
      area: 1400,
      furnished: 'Unfurnished',
      ownerName: 'Bilal Siddiqui',
      ownerPhone: '+92 300 1000003',
      ownerEmail: 'bilal@example.com',
      image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80',
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80'],
      status: 'For Rent',
      createdAt: '2025-05-08T10:00:00.000Z',
      updatedAt: '2025-07-27T10:00:00.000Z',
    },
    {
      id: 'prop-104',
      title: 'City Nest Room',
      propertyType: 'Room',
      category: 'Room',
      description: 'Single room for students with shared kitchen and Wi-Fi.',
      price: 2600000,
      rent: 45000,
      salePrice: 2600000,
      location: 'Johar Town',
      city: 'Lahore',
      address: 'Lane 8, Johar Town',
      bedrooms: 1,
      bathrooms: 1,
      area: 420,
      furnished: 'Fully Furnished',
      ownerName: 'Maira Javed',
      ownerPhone: '+92 300 1000004',
      ownerEmail: 'maira@example.com',
      image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
      images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],
      status: 'Available',
      createdAt: '2025-06-11T10:00:00.000Z',
      updatedAt: '2025-08-08T10:00:00.000Z',
    },
    {
      id: 'prop-105',
      title: 'Hostel Beacon',
      propertyType: 'Hostel',
      category: 'Hostel',
      description: 'Budget-friendly hostel with common lounge and study areas.',
      price: 4800000,
      rent: 85000,
      salePrice: 4800000,
      location: 'Saddar',
      city: 'Peshawar',
      address: 'Opposite bus stand, Saddar',
      bedrooms: 2,
      bathrooms: 2,
      area: 1230,
      furnished: 'Semi Furnished',
      ownerName: 'Usman Ali',
      ownerPhone: '+92 300 1000005',
      ownerEmail: 'usman@example.com',
      image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80',
      images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80'],
      status: 'Sold',
      createdAt: '2025-02-15T10:00:00.000Z',
      updatedAt: '2025-07-25T10:00:00.000Z',
    },
  ],
  users: [
    {
      id: 'usr-1',
      fullName: 'Ali Rehman',
      name: 'Ali Rehman',
      email: 'ali@example.com',
      phone: '+92 300 1112223',
      role: 'Tenant',
      status: 'Active',
      registrationDate: '2024-12-18',
      lastActivity: '2026-08-18T09:30:00.000Z',
    },
    {
      id: 'usr-2',
      fullName: 'Sara Ahmed',
      name: 'Sara Ahmed',
      email: 'sara@example.com',
      phone: '+92 300 2233445',
      role: 'Buyer',
      status: 'Active',
      registrationDate: '2025-01-12',
      lastActivity: '2026-08-20T14:00:00.000Z',
    },
    {
      id: 'usr-3',
      fullName: 'Hamza Khan',
      name: 'Hamza Khan',
      email: 'hamza@example.com',
      phone: '+92 300 7788990',
      role: 'Tenant',
      status: 'Inactive',
      registrationDate: '2024-08-04',
      lastActivity: '2026-08-11T08:15:00.000Z',
    },
  ],
  tenants: [
    {
      id: 'TEN-001',
      fullName: 'Ali Khan',
      email: 'ali.khan@example.com',
      phone: '+92 300 5550001',
      cnic: '42101-1234567-1',
      propertyId: 'prop-101',
      propertyName: 'Pearl Residency',
      unit: 'A-101',
      monthlyRent: 50000,
      securityDeposit: 50000,
      leaseStart: '2026-06-01',
      leaseEnd: '2027-05-31',
      dueDay: 10,
      status: 'Active',
      createdAt: '2026-08-01T09:00:00.000Z',
    },
  ],
  bookings: [
    {
      id: 'bk-1001',
      bookingId: 'bk-1001',
      customerName: 'Ali Rehman',
      customerPhone: '+92 300 1112223',
      propertyId: 'prop-101',
      propertyTitle: 'Pearl Residency',
      propertyType: 'House',
      bookingDate: '2026-08-08',
      visitDate: '2026-08-12',
      amount: 180000,
      paymentStatus: 'Pending',
      bookingStatus: 'Pending',
      notes: 'Interested in viewing the property next weekend.',
      createdAt: '2026-08-08T10:00:00.000Z',
    },
    {
      id: 'bk-1002',
      bookingId: 'bk-1002',
      customerName: 'Sara Ahmed',
      customerPhone: '+92 300 2233445',
      propertyId: 'prop-102',
      propertyTitle: 'Skyline Apartments',
      propertyType: 'Apartment',
      bookingDate: '2026-08-10',
      visitDate: '2026-08-14',
      amount: 220000,
      paymentStatus: 'Paid',
      bookingStatus: 'Approved',
      notes: 'Approved after confirming the payment plan.',
      createdAt: '2026-08-10T11:30:00.000Z',
    },
    {
      id: 'bk-1003',
      bookingId: 'bk-1003',
      customerName: 'Hamza Khan',
      customerPhone: '+92 300 7788990',
      propertyId: 'prop-103',
      propertyTitle: 'Oaklane Flat',
      propertyType: 'Flat',
      bookingDate: '2026-08-15',
      visitDate: '2026-08-18',
      amount: 145000,
      paymentStatus: 'Failed',
      bookingStatus: 'Rejected',
      notes: 'Customer documents were incomplete.',
      createdAt: '2026-08-15T13:45:00.000Z',
    },
  ],
  payments: [
    {
      id: 'pay-2001',
      paymentId: 'pay-2001',
      user: 'Ali Rehman',
      customerName: 'Ali Rehman',
      property: 'Pearl Residency',
      propertyId: 'prop-101',
      propertyTitle: 'Pearl Residency',
      bookingId: 'bk-1001',
      amount: 180000,
      method: 'Bank Transfer',
      paymentMethod: 'Bank Transfer',
      date: '2026-08-16',
      paymentDate: '2026-08-16',
      reference: 'REF-180100',
      status: 'Pending',
      note: 'Awaiting bank payout verification.',
      notes: 'Awaiting bank payout verification.',
    },
    {
      id: 'pay-2002',
      paymentId: 'pay-2002',
      user: 'Sara Ahmed',
      customerName: 'Sara Ahmed',
      property: 'Skyline Apartments',
      propertyId: 'prop-102',
      propertyTitle: 'Skyline Apartments',
      bookingId: 'bk-1002',
      amount: 220000,
      method: 'Card',
      paymentMethod: 'Card',
      date: '2026-08-18',
      paymentDate: '2026-08-18',
      reference: 'REF-220210',
      status: 'Paid',
      note: 'Payment confirmed successfully.',
      notes: 'Payment confirmed successfully.',
    },
  ],
  dues: [
    {
      id: 'due-3001',
      dueId: 'due-3001',
      user: 'Ali Rehman',
      residentName: 'Ali Rehman',
      residentPhone: '+92 300 1112223',
      property: 'Pearl Residency',
      propertyName: 'Pearl Residency',
      room: 'A-104',
      monthlyRent: 180000,
      previousBalance: 0,
      currentCharge: 180000,
      amount: 60000,
      paidAmount: 120000,
      remainingAmount: 60000,
      dueDate: '2026-09-01',
      status: 'Due',
      paymentStatus: 'Partial',
      notes: 'Partial payment received this month.',
      createdAt: '2026-08-01T09:00:00.000Z',
    },
    {
      id: 'due-3002',
      dueId: 'due-3002',
      user: 'Hamza Khan',
      residentName: 'Hamza Khan',
      residentPhone: '+92 300 7788990',
      property: 'Oaklane Flat',
      propertyName: 'Oaklane Flat',
      room: '2B',
      monthlyRent: 145000,
      previousBalance: 15000,
      currentCharge: 145000,
      amount: 160000,
      paidAmount: 0,
      remainingAmount: 160000,
      dueDate: '2026-09-05',
      status: 'Overdue',
      paymentStatus: 'Overdue',
      notes: 'Grace period expired; follow-up required.',
      createdAt: '2026-08-03T09:00:00.000Z',
    },
  ],
  notifications: [
    {
      id: 'notif-1',
      title: 'Booking request pending',
      message: 'A new booking request for Pearl Residency needs admin approval.',
      detail: 'A new booking request for Pearl Residency needs admin approval.',
      type: 'Booking',
      recipient: 'All Admins',
      date: '2026-08-20T08:30:00.000Z',
      time: '8:30 AM',
      read: false,
      priority: 'High',
    },
    {
      id: 'notif-2',
      title: 'Payment received',
      message: 'Payment reference REF-220210 has been successfully processed.',
      detail: 'Payment reference REF-220210 has been successfully processed.',
      type: 'Payment',
      recipient: 'Finance Team',
      date: '2026-08-19T10:45:00.000Z',
      time: '10:45 AM',
      read: true,
      priority: 'Normal',
    },
  ],
  settings: {
    dashboardPreferences: true,
    notificationPreferences: true,
    currency: 'PKR',
    dateFormat: 'DD/MM/YYYY',
    itemsPerPage: 10,
    theme: 'light',
  },
  profile: {
    fullName: 'Ayesha Khan',
    email: 'muheebshahid75@gmail.com',
    phone: '+92 300 1234567',
    profileImage: '',
    role: 'Super Administrator',
  },
  activityLogs: [
    {
      id: 'log-1',
      action: 'Property added',
      details: 'Pearl Residency added to the property catalog.',
      timestamp: '2026-08-20T10:00:00.000Z',
    },
    {
      id: 'log-2',
      action: 'Booking approved',
      details: 'Skyline Apartments booking approved by admin.',
      timestamp: '2026-08-19T14:15:00.000Z',
    },
  ],
});

export const loadAppData = () => {
  if (typeof window === 'undefined') return buildDefaultState();
  // Forcing admin app to use backend as source-of-truth for business data.
  // Keep only minimal defaults for UI so components will fetch from APIs.
  const defaultState = buildDefaultState();
  const nextState = {
    admin: { ...defaultState.admin },
    properties: [],
    users: [],
    bookings: [],
    payments: [],
    dues: [],
    tenants: [],
    rentRecords: [],
    rentPayments: [],
    rentReminders: [],
    rentSettings: defaultState.rentSettings || {},
    notifications: [],
    settings: readStorage(STORAGE_KEYS.settings, defaultState.settings),
    profile: defaultState.profile,
    activityLogs: [],
  };

  // preserve any lightweight UI settings stored earlier
  try {
    const profileData = readStorage(STORAGE_KEYS.profile, null);
    if (profileData) {
      nextState.profile = { ...nextState.profile, ...profileData };
      nextState.admin = { ...nextState.admin, ...profileData };
    }
  } catch {
    // ignore malformed profile in localStorage
  }

  return nextState;
};

export const persistAppData = (appData) => {
  if (typeof window === 'undefined') return;

  // Persist only non-business UI settings. Business data must come from backend.
  const data = appData ?? {};
  if (data.settings) writeStorage(STORAGE_KEYS.settings, data.settings);
  if (data.profile) {
    // allow profile to be stored as lightweight cached view only
    writeStorage(STORAGE_KEYS.profile, data.profile);
    writeStorage('rms_admin_admin', data.profile);
  }
};

const hasValidAdminToken = () => {
  if (typeof window === 'undefined') return false;

  const token = window.localStorage.getItem('rms_admin_token')
    || window.localStorage.getItem('rms_token')
    || window.__RMS_AUTH_TOKEN
    || window.__rms_inmemory_token;

  return Boolean(token && String(token).trim());
};

export const loadAuthState = () => {
  if (typeof window === 'undefined') return false;
  const authFlag = window.localStorage.getItem(AUTH_KEY) === 'true';
  return authFlag && hasValidAdminToken();
};

export const setAuthState = (value) => {
  if (typeof window === 'undefined') return;

  if (value && !hasValidAdminToken()) {
    window.localStorage.removeItem(AUTH_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_KEY, String(Boolean(value)));
};

export const clearAuthState = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem('rms_admin_token');
  window.localStorage.removeItem('rms_token');
  delete window.__RMS_AUTH_TOKEN;
  delete window.__rms_inmemory_token;
};

export const clearLoginCredentials = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('rms_admin_login_credentials');
};

export const clearAllAppStorage = () => {
  if (typeof window === 'undefined') return;

  // Logout must not remove persisted business data or uploaded image references.
  // Keep property/user records intact and clear only auth/session values.
  clearAuthState();
  window.localStorage.removeItem('rms_admin_login_credentials');
  window.localStorage.removeItem('rms_auth_session');
  window.localStorage.removeItem('rms_user_role');
  window.localStorage.removeItem('rms_remembered_email');
  delete window.__RMS_AUTH_TOKEN;
  delete window.__rms_inmemory_token;
};
