import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SiteHeader from '../components/site/SiteHeader';
import SiteFooter from '../components/site/SiteFooter';

function MainLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const overlay = location.pathname === '/';
  const section = location.pathname.split('/').slice(0, 3).join('/');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <SiteHeader overlay={overlay} />
      <main className="r-main" style={{ flex: 1, marginTop: overlay ? 'calc(var(--header-h) * -1)' : 0 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
      <SiteFooter />
    </div>
  );
}

export default MainLayout;
