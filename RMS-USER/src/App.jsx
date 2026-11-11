import { useEffect } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import { MotionConfig } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'antd/dist/reset.css';
import { store, login } from './redux/store';
import AppRoutes from './routes/AppRoutes';
import { saveSessionUser } from './services/notificationService.jsx';
import { AuthProvider } from './contexts/AuthContext';
import SmoothScroll from './components/site/SmoothScroll';
import ChatWidget from './components/site/ChatWidget';

const antdTheme = {
  token: {
    colorPrimary: '#0b5d4b',
    colorInfo: '#0b5d4b',
    colorLink: '#0f7560',
    borderRadius: 12,
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    colorText: '#101828',
    colorBorder: '#e7e5df',
  },
};

function ChatMount() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return null;
  return <ChatWidget />;
}

function SessionHydrator() {
  const dispatch = useDispatch();
  useEffect(() => {
    // Rehydrate the persisted session so pages reading from Redux react immediately.
    try {
      const stored = window.localStorage.getItem('rms_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) {
          saveSessionUser(parsed);
          dispatch(login(parsed));
        }
      }
    } catch {
      // ignore malformed session
    }
  }, [dispatch]);
  return null;
}

function App() {
  return (
    <Provider store={store}>
      <SessionHydrator />
      <AuthProvider>
          <BrowserRouter>
            <ConfigProvider theme={antdTheme}>
              <MotionConfig reducedMotion="user">
                <AntApp>
                  <SmoothScroll />
                  <AppRoutes />
                  <ChatMount />
                  <ToastContainer position="top-right" autoClose={3500} newestOnTop limit={3} />
                </AntApp>
              </MotionConfig>
            </ConfigProvider>
          </BrowserRouter>
      </AuthProvider>
    </Provider>
  );
}

export default App;
