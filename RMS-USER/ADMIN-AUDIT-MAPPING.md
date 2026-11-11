Summary mapping (partial) — main pages → API → Route → Controller → Model/Collection

- Home / Featured / Listings:
  - User API: GET /api/properties
  - Route: Backend/src/routes/properties.js -> listProperties
  - Controller: Backend/src/controllers/propertyController.js -> listProperties
  - Model: Backend/src/models/Property.js -> properties

- Property Details:
  - User API: GET /api/properties/:id
  - Controller: propertyController.getProperty
  - Model: Property

- Bookings (User submits):
  - User API: POST /api/bookings
  - Controller: Backend/src/controllers/bookingController.js
  - Model: Backend/src/models/Booking.js (or BookingRequest)

- Admin Bookings:
  - Admin API: GET /api/bookings (admin via bookings router)
  - Admin actions: POST /api/bookings/:id/approve, POST /api/bookings/:id/reject
  - Controller: bookingController
  - Model: Booking

- Payments:
  - User API: POST /api/payments, GET /api/payments
  - Admin APIs: /api/admin/payment/approve (existing controller endpoints used by admin services)
  - Controller: Backend/src/controllers/paymentController.js
  - Model: Backend/src/models/Payment.js -> payments

- Rentals / Rents:
  - APIs: Backend/src/routes/rents.js (e.g., /api/rents, /api/rents/all)
  - Controller: Backend/src/controllers/rentController.js
  - Model: Backend/src/models/RentRecord.js -> rents

- Users / Admin Users:
  - Admin API: GET /api/admin/users, POST /api/admin/users, PUT /api/admin/users/:id, DELETE /api/admin/users/:id
  - Controller: Backend/src/controllers/adminController.js -> getAdminUsers, createAdminUser, updateAdminUser, archiveAdminUser
  - Model: Backend/src/models/User.js -> users

- Notifications / Announcements:
  - User API: GET /api/notifications (requires auth)
  - Admin API: POST /api/notifications/create (requires admin)
  - Controller: Backend/src/controllers/notificationController.js
  - Model: Backend/src/models/UserNotification.js -> usernotifications

- Property Images Management:
  - Admin APIs: POST /api/properties/:id/images (upload), POST /api/properties/:id/images/:imageIndex/replace, DELETE /api/properties/:id/images/:imageIndex
  - Controller: Backend/src/controllers/propertyImagesController.js
  - Model: Property.images array inside Property model

- Areas / Locations (to implement if missing):
  - Currently: Property has `area`, `location`, `city` fields in model
  - Recommendation: add dedicated Areas collection and admin routes (/api/areas) if not already present

Notes:
- Authentication middleware: Backend/src/middleware/auth.js (`requireAuth`, `requireAdmin`) is used across admin routes.
- Admin dashboard/analytics: GET /api/admin/dashboard -> adminController.getAdminDashboard
- Many admin endpoints already exist for properties, users, bookings, payments, rents, notifications.

Next actions:
1. Continue full mapping for all User pages (About, Services, Demo pages, Offers, Contact, Complaints, Maintenance).
2. Identify hardcoded frontend arrays and components to replace with API-driven data.
3. Implement missing Admin APIs (Areas, Categories, Offers management) where absent.
4. Connect Admin UI: finish linking pages (Area management, Property Images UI, Offers UI) to backend endpoints.

Generated: ADMIN-AUDIT-MAPPING.md
