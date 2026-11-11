import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addFavorite, removeFavorite } from '../redux/store';
import favoriteService from '../services/favoriteService';

export const getFavoriteKey = (item) => {
  if (!item || item.id == null) return '';
  if (item.source) {
    return `${item.source}:${item.id}`;
  }

  const isHostel = Boolean(item.monthlyFee || item.security || item.seats);
  const source = isHostel ? 'hostel' : 'property';
  return `${source}:${item.id}`;
};

export const useFavorites = () => {
  const dispatch = useDispatch();
  const { favorites = [], user = {} } = useSelector((state) => state.auth || {});

  const isFavorited = useCallback(
    (item) => favorites.includes(getFavoriteKey(item)),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (item) => {
      const key = getFavoriteKey(item);
      // optimistic UI update
      if (favorites.includes(key)) {
        dispatch(removeFavorite(key));
        // try remote remove
        try { favoriteService.removeFavorite(item.id).catch(()=>{}); } catch(e) {}
      } else {
        dispatch(addFavorite(key));
        try { favoriteService.addFavorite(item.id).catch(()=>{}); } catch(e) {}
      }
    },
    [dispatch, favorites],
  );

  return {
    favorites,
    user,
    isFavorited,
    toggleFavorite,
  };
};
