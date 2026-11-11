import { configureStore, createSlice } from '@reduxjs/toolkit';
import { readSessionUser, clearSessionUser } from '../services/notificationService.jsx';

const storedSessionUser = readSessionUser();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedSessionUser || {
      name: '',
      role: 'user',
      isLoggedIn: false,
      email: '',
      loginDate: '',
      loginTime: '',
    },
    theme: 'light',
    notifications: [],
    favorites: [],
  },
  reducers: {
    login: (state, action) => {
      state.user = { ...state.user, ...action.payload, isLoggedIn: true };
      state.favorites = Array.isArray(action.payload?.favorites) ? action.payload.favorites : [];
    },
    setFavorites: (state, action) => {
      state.favorites = Array.isArray(action.payload) ? action.payload : [];
    },
    logout: (state) => {
      state.user = { ...state.user, isLoggedIn: false };
      state.favorites = [];
      clearSessionUser();
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    addFavorite: (state, action) => {
      if (!state.favorites.includes(action.payload)) {
        state.favorites = [...state.favorites, action.payload];
      }
    },
    removeFavorite: (state, action) => {
      state.favorites = state.favorites.filter((favorite) => favorite !== action.payload);
    },
    clearFavorites: (state) => {
      state.favorites = [];
    },
    addNotification: (state, action) => {
      state.notifications = [action.payload, ...state.notifications];
    },
    setNotifications: (state, action) => {
      state.notifications = Array.isArray(action.payload) ? action.payload : [];
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter((item) => item.id !== action.payload);
    },
    markNotificationAsRead: (state, action) => {
      state.notifications = state.notifications.map((item) =>
        item.id === action.payload ? { ...item, unread: false } : item,
      );
    },
    markAllNotificationsAsRead: (state) => {
      state.notifications = state.notifications.map((item) => ({ ...item, unread: false }));
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
  }
});

export const { login, logout, toggleTheme, addFavorite, removeFavorite, clearFavorites, addNotification, removeNotification, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, setFavorites } = authSlice.actions;
export const { setNotifications } = authSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
  },
});
