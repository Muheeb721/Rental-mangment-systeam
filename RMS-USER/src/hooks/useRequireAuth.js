import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

/** Returns a handler that redirects visitors to login before running `fn`. */
export default function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (fn, message = 'Please sign in to continue.') => () => {
    if (!isAuthenticated) {
      toast.info(message);
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    fn();
  };
}
