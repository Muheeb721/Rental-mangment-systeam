import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import ErrorBoundary from '../components/ErrorBoundary';
import { PropertyProvider } from '../contexts/PropertyContext';

const HomePage = lazy(() => import('../pages/HomePage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));
const ServicesPage = lazy(() => import('../pages/ServicesPage'));
const ContactPage = lazy(() => import('../pages/ContactPage'));
const FAQPage = lazy(() => import('../pages/FAQPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const Signup = lazy(() => import('../pages/Signup'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
const PropertyListingsPage = lazy(() => import('../pages/PropertyListingsPage'));
const PropertyDetailsPage = lazy(() => import('../pages/PropertyDetailsPage'));
const AreasPage = lazy(() => import('../pages/AreasPage'));
const AreaGuidePage = lazy(() => import('../pages/AreaGuidePage'));
const DashboardPage = lazy(() => import('../pages/account/DashboardPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

// Legacy admin screens kept for back-compat; the main admin lives in RMS-ADMIN.
const AdminLoginPage = lazy(() => import('../pages/AdminLoginPage'));
const AdminForgotPasswordPage = lazy(() => import('../pages/AdminForgotPasswordPage'));
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage'));
const AdminPaymentsPage = lazy(() => import('../pages/AdminPaymentsPage'));
const AdminRentPage = lazy(() => import('../pages/AdminRentPage'));
const AdminApplicationsPage = lazy(() => import('../pages/AdminApplicationsPage'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const NotificationsErrorBoundary = lazy(() => import('../components/Notifications/NotificationsErrorBoundary'));

function PageFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }} aria-busy="true" aria-label="Loading">
      <div className="r-skel" style={{ width: 44, height: 44, borderRadius: 12 }} />
    </div>
  );
}

const tab = (name) => <Navigate to={`/dashboard?tab=${name}`} replace />;

function LegacyHostelRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/properties/${id}` : '/properties?type=Room'} replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/register" element={<Navigate to="/signup" replace />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />

        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/properties" element={<PropertyListingsPage />} />
          <Route path="/properties/:id" element={<PropertyDetailsPage />} />
          <Route path="/areas" element={<AreasPage />} />
          <Route path="/areas/:slug" element={<AreaGuidePage />} />

          {/* Legacy / demo routes now point at the live listings */}
          <Route path="/demo" element={<Navigate to="/properties" replace />} />
          <Route path="/demo/house" element={<Navigate to="/properties?type=House" replace />} />
          <Route path="/demo/flats" element={<Navigate to="/properties?type=Flat" replace />} />
          <Route path="/demo/apartments" element={<Navigate to="/properties?type=Apartment" replace />} />
          <Route path="/pricing" element={<Navigate to="/services" replace />} />
          <Route path="/hostels" element={<LegacyHostelRedirect />} />
          <Route path="/hostels/:id" element={<LegacyHostelRedirect />} />
          <Route path="/compare" element={<Navigate to="/properties" replace />} />
          <Route path="/ai-recommendations" element={<Navigate to="/properties" replace />} />
          <Route path="/sale-interest" element={<Navigate to="/properties" replace />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="/favorites" element={tab('saved')} />
            <Route path="/saved-searches" element={tab('searches')} />
            <Route path="/bookings" element={tab('applications')} />
            <Route path="/rental-application" element={tab('applications')} />
            <Route path="/payments" element={tab('payments')} />
            <Route path="/my-rent" element={tab('payments')} />
            <Route path="/rent-management" element={tab('payments')} />
            <Route path="/dues" element={tab('payments')} />
            <Route path="/upload-payment-proof" element={tab('payments')} />
            <Route path="/maintenance" element={tab('maintenance')} />
            <Route path="/notifications" element={tab('notifications')} />
            <Route path="/profile" element={tab('profile')} />
            <Route path="/settings" element={tab('profile')} />
            <Route path="/tenant-profile" element={tab('profile')} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<PropertyProvider><AdminRoute /></PropertyProvider>}>
          <Route path="/admin" element={<ErrorBoundary><AdminDashboardPage /></ErrorBoundary>} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin/rent" element={<AdminRentPage />} />
          <Route path="/admin/applications" element={<AdminApplicationsPage />} />
          <Route path="/admin/notifications" element={<NotificationsErrorBoundary><NotificationsPage /></NotificationsErrorBoundary>} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
