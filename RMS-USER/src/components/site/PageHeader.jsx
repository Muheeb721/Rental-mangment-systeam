import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function PageHeader({ eyebrow, title, children, crumbs = [] }) {
  return (
    <section className="r-pagehead">
      <div className="r-container">
        <nav className="r-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          {crumbs.map((c) => <span key={c} style={{ display: 'contents' }}><span>/</span><span>{c}</span></span>)}
        </nav>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} style={{ marginTop: 18 }}>
          {eyebrow ? <span className="r-eyebrow">{eyebrow}</span> : null}
          <h1 className="r-h1">{title}</h1>
          {children ? <p className="r-lead">{children}</p> : null}
        </motion.div>
      </div>
    </section>
  );
}
