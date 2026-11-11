import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function AdminRoute() {
  const location = useLocation();
  const { isAuthenticated, isAdmin, user } = useAuth();

  if (!isAuthenticated) {
    const target = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/admin/login?redirect=${target}`} replace />;
  }

  if (!isAdmin && user?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;
