import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { addFavorite, removeFavorite, setFavorites } from '../redux/store';
import favoriteService from '../services/favoriteService';
import { useAuth } from '../contexts/AuthContext';

const keyOf = (id) => `property:${id}`;

export async function syncFavorites(dispatch) {
  const res = await favoriteService.listFavorites();
  if (res?.success && Array.isArray(res.data)) {
    dispatch(setFavorites(res.data.map((f) => keyOf(f.propertyId))));
    return res.data;
  }
  return null;
}

export function useFavoriteIds() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const favorites = useSelector((s) => s.auth?.favorites || []);

  const isFavorite = useCallback((id) => favorites.includes(keyOf(id)), [favorites]);

  const toggle = useCallback(async (id) => {
    if (!isAuthenticated) {
      toast.info('Sign in to save properties to your shortlist.');
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    const key = keyOf(id);
    if (favorites.includes(key)) {
      dispatch(removeFavorite(key));
      const res = await favoriteService.removeFavorite(id);
      if (!res?.success) { dispatch(addFavorite(key)); toast.error('Could not update your saved homes.'); }
    } else {
      dispatch(addFavorite(key));
      const res = await favoriteService.addFavorite(id);
      if (!res?.success) { dispatch(removeFavorite(key)); toast.error('Could not save this property.'); }
      else toast.success('Saved to your shortlist');
    }
  }, [dispatch, favorites, isAuthenticated, location.pathname, location.search, navigate]);

  return { favorites, isFavorite, toggle, count: favorites.length };
}
