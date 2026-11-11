import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ConfirmProvider, Spinner, ToastProvider } from './components/ui';
import Layout from './components/Layout';
import LoginView from './views/LoginView';
import ForgotPasswordView from './views/ForgotPasswordView';
import DashboardView from './views/DashboardView';
import PropertiesView from './views/PropertiesView';
import PropertyFormView from './views/PropertyFormView';
import UsersView from './views/UsersView';
import AreasView from './views/AreasView';
import BookingsView from './views/BookingsView';
import ApplicationsView from './views/ApplicationsView';
import PaymentsView from './views/PaymentsView';
import RentView from './views/RentView';
import MaintenanceView from './views/MaintenanceView';
import MessagesView from './views/MessagesView';
import ReviewsView from './views/ReviewsView';
import NotificationsView from './views/NotificationsView';
import SiteContentView from './views/SiteContentView';
import ProfileView from './views/ProfileView';

const FullPageSpinner = () => <div className="full-center"><Spinner size={28} /></div>;

function ProtectedLayout() {
  const { user, checking } = useAuth();
  if (checking) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function PublicOnly({ children }) {
  const { user, checking } = useAuth();
  if (checking) return <FullPageSpinner />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<PublicOnly><LoginView /></PublicOnly>} />
              <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordView /></PublicOnly>} />
              <Route element={<ProtectedLayout />}>
                <Route index element={<DashboardView />} />
                <Route path="properties" element={<PropertiesView />} />
                <Route path="properties/new" element={<PropertyFormView />} />
                <Route path="properties/:id/edit" element={<PropertyFormView />} />
                <Route path="areas" element={<AreasView />} />
                <Route path="users" element={<UsersView />} />
                <Route path="bookings" element={<BookingsView />} />
                <Route path="applications" element={<ApplicationsView />} />
                <Route path="payments" element={<PaymentsView />} />
                <Route path="rent" element={<RentView />} />
                <Route path="maintenance" element={<MaintenanceView />} />
                <Route path="messages" element={<MessagesView />} />
                <Route path="reviews" element={<ReviewsView />} />
                <Route path="notifications" element={<NotificationsView />} />
                <Route path="site-content" element={<SiteContentView />} />
                <Route path="profile" element={<ProfileView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
