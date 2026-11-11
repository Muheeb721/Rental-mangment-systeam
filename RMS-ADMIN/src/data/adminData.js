export const STORAGE_KEY = 'rms-admin-data-v1';
export const AUTH_KEY = 'rms-admin-auth-v1';

export const defaultState = {
  admin: {
    name: 'Ayesha Khan',
    email: 'muheebshahid75@gmail.com',
    phone: '+92 300 1234567',
    role: 'Super Administrator',
    timezone: 'GMT +5',
  },
  houses: [
    { id: 1, name: 'Pearl Residency', location: 'Lahore', units: 18, status: 'Active', price: 75000 },
    { id: 2, name: 'Green Valley Homes', location: 'Islamabad', units: 12, status: 'Occupied', price: 68000 },
  ],
  apartments: [
    { id: 1, name: 'Skyline Apartments', location: 'Karachi', units: 25, status: 'Active', price: 82000 },
    { id: 2, name: 'Cedar Crest', location: 'Faisalabad', units: 10, status: 'Review', price: 61000 },
  ],
  flats: [
    { id: 1, name: 'Ocean View Flat', location: 'Rawalpindi', units: 7, status: 'Available', price: 49000 },
    { id: 2, name: 'Hill Park Flat', location: 'Lahore', units: 9, status: 'Booked', price: 54000 },
  ],
  rooms: [
    { id: 1, name: 'Room A-110', location: 'Hostel City', units: 1, status: 'Available', price: 18000 },
    { id: 2, name: 'Room B-204', location: 'Campus Heights', units: 1, status: 'Occupied', price: 21000 },
  ],
  hostels: [
    { id: 1, name: 'Blue Ridge Hostel', location: 'Peshawar', units: 32, status: 'Active', price: 25000 },
    { id: 2, name: 'City Light Hostel', location: 'Multan', units: 22, status: 'Maintenance', price: 22000 },
  ],
  users: [
    { id: 1, name: 'Ali Rehman', email: 'ali@email.com', role: 'Tenant', status: 'Active', joined: '2025-06-01' },
    { id: 2, name: 'Sara Ahmed', email: 'sara@email.com', role: 'Landlord', status: 'Pending', joined: '2025-07-09' },
    { id: 3, name: 'Hamza Khan', email: 'hamza@email.com', role: 'Tenant', status: 'Active', joined: '2025-03-15' },
  ],
  bookings: [
    { id: 'BK-2048', property: 'Pearl Residency', user: 'Ali Rehman', amount: 75000, status: 'Pending', date: '2026-08-12', note: 'Awaiting admin decision' },
    { id: 'BK-2050', property: 'Skyline Apartments', user: 'Sara Ahmed', amount: 82000, status: 'Approved', date: '2026-08-15', note: 'Payment confirmation received' },
    { id: 'BK-2052', property: 'Blue Ridge Hostel', user: 'Hamza Khan', amount: 25000, status: 'Rejected', date: '2026-08-17', note: 'Unavailable unit' },
  ],
  payments: [
    { id: 'PY-1001', user: 'Ali Rehman', property: 'Pearl Residency', amount: 75000, status: 'Paid', date: '2026-08-13' },
    { id: 'PY-1002', user: 'Sara Ahmed', property: 'Skyline Apartments', amount: 82000, status: 'Pending', date: '2026-08-15' },
  ],
  dues: [
    { id: 'DU-442', user: 'Ali Rehman', property: 'Pearl Residency', amount: 18000, dueDate: '2026-09-01', status: 'Due' },
    { id: 'DU-447', user: 'Hamza Khan', property: 'Blue Ridge Hostel', amount: 12000, dueDate: '2026-09-05', status: 'Paid' },
  ],
  notifications: [
    { id: 1, title: 'Booking request pending', detail: 'New booking request for Pearl Residency needs approval.', time: '5 mins ago' },
    { id: 2, title: 'Payment received', detail: 'PY-1001 has been marked as paid by tenant.', time: '1 hr ago' },
    { id: 3, title: 'Announcement published', detail: 'Utility maintenance notice sent to all residents.', time: '3 hrs ago' },
  ],
  announcements: [
    { id: 1, title: 'Water maintenance notice', audience: 'All occupants', priority: 'Medium', content: 'Water supply will be scheduled for maintenance on Sunday at 10 AM.' },
    { id: 2, title: 'New policy update', audience: 'Tenants', priority: 'High', content: 'Updated rent policies and compliance requirements are now active.' },
  ],
  reviews: [
    { id: 1, user: 'Areeba', property: 'Pearl Residency', rating: 5, comment: 'Excellent location and very responsive team.' },
    { id: 2, user: 'Musa', property: 'Blue Ridge Hostel', rating: 4, comment: 'The room is clean and secure.' },
  ],
  messages: [
    { id: 1, sender: 'Support Desk', subject: 'Repair request', status: 'Open', date: '2026-08-18' },
    { id: 2, sender: 'Tenant Portal', subject: 'Payment inquiry', status: 'Resolved', date: '2026-08-16' },
  ],
  apiConfig: {
    baseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, ''),
    token: import.meta.env.VITE_API_TOKEN || '',
    timeout: Number(import.meta.env.VITE_API_TIMEOUT || 12000),
    mode: import.meta.env.VITE_APP_MODE || 'Production',
  },
  settings: {
    darkMode: true,
    notifications: true,
    autoApprove: false,
    emailAlerts: true,
  },
};

export const navItems = [
  { label: 'Dashboard', path: '/', icon: '⌂' },
  { label: 'Houses', path: '/houses', icon: '▣' },
  { label: 'Apartments', path: '/apartments', icon: '▤' },
  { label: 'Flats', path: '/flats', icon: '▥' },
  { label: 'Rooms', path: '/rooms', icon: '◫' },
  { label: 'Hostels', path: '/hostels', icon: '◨' },
  { label: 'Properties', path: '/properties', icon: '◍' },
  { label: 'Users', path: '/users', icon: '👥' },
  { label: 'Bookings', path: '/bookings', icon: '🗓' },
  { label: 'Payments', path: '/payments', icon: '💳' },
  { label: 'Rent / Dues', path: '/dues', icon: '📄' },
  { label: 'Notifications', path: '/notifications', icon: '🔔' },
  { label: 'Announcements', path: '/announcements', icon: '📢' },
  { label: 'Reviews', path: '/reviews', icon: '⭐' },
  { label: 'Messages', path: '/messages', icon: '✉' },
  { label: 'Reports', path: '/reports', icon: '📊' },
  { label: 'API Panel', path: '/api-panel', icon: '⚙' },
  { label: 'Admin Profile', path: '/profile', icon: '👤' },
  { label: 'Settings', path: '/settings', icon: '🛠' },
];

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);

export const loadInitialState = () => {
  if (typeof window === 'undefined') return defaultState;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : defaultState;
};

export const loadAuthState = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_KEY) === 'true';
};
