import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowLeft, LuShieldCheck } from 'react-icons/lu';
import Logo from './Logo';
import './AuthLayout.css';

export default function AuthLayout({ title, subtitle, children, footer, image = '/images/site/living-room-01.jpg', quote }) {
  return (
    <div className="au">
      <div className="au-form">
        <div className="au-form__top">
          <Logo />
          <Link to="/" className="r-btn r-btn--ghost r-btn--sm"><LuArrowLeft size={15} /> Back to site</Link>
        </div>
        <motion.div className="au-form__body" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <h1>{title}</h1>
          {subtitle ? <p className="au-sub">{subtitle}</p> : null}
          {children}
          {footer ? <div className="au-foot">{footer}</div> : null}
        </motion.div>
        <p className="au-legal">© {new Date().getFullYear()} RMS · Homes across Lahore</p>
      </div>
      <div className="au-art" aria-hidden="true">
        <motion.img src={image} alt="" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
        <div className="au-art__shade" />
        <motion.div className="au-art__card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
          <span className="au-art__icon"><LuShieldCheck size={20} /></span>
          <p>{quote || 'Every listing on RMS is reviewed by our leasing team before it goes live — so you only see real homes at real prices.'}</p>
        </motion.div>
      </div>
    </div>
  );
}
