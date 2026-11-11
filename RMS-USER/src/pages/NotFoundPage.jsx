import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowLeft, LuSearch } from 'react-icons/lu';

export default function NotFoundPage() {
  return (
    <section className="r-section">
      <div className="r-container" style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 16, padding: '40px 16px 60px' }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ font: '800 120px/1 var(--font-display)', letterSpacing: '-0.05em', color: 'var(--brand-100)' }}>404</motion.div>
        <h1 className="r-h2">This page has moved out</h1>
        <p className="r-lead" style={{ margin: '0 auto' }}>The page you&apos;re looking for doesn&apos;t exist or is no longer available.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          <Link to="/" className="r-btn"><LuArrowLeft size={16} /> Back home</Link>
          <Link to="/properties" className="r-btn r-btn--primary"><LuSearch size={16} /> Browse properties</Link>
        </div>
      </div>
    </section>
  );
}
