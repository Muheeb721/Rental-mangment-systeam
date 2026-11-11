import { Link } from 'react-router-dom';
import { LuClock, LuMail, LuMapPin, LuPhone } from 'react-icons/lu';
import Logo from './Logo';
import SITE from '../../config/site';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="r-footer">
      <div className="r-container">
        <div className="r-footer__grid">
          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <Logo />
            <p style={{ maxWidth: 320, lineHeight: 1.7, fontSize: 14.5 }}>
              Verified homes for rent and sale across Lahore — with online applications, rent tracking and maintenance support for every tenant.
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link to="/properties">All properties</Link></li>
              <li><Link to="/properties?type=House">Houses for rent</Link></li>
              <li><Link to="/properties?type=Apartment">Apartments</Link></li>
              <li><Link to="/properties?type=Flat">Flats</Link></li>
              <li><Link to="/areas">Lahore area guides</Link></li>
              <li><Link to="/compare">Compare homes</Link></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/faq">FAQs</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4>Leasing office</h4>
            <ul>
              <li style={{ display: 'flex', gap: 10 }}><LuMapPin size={16} style={{ marginTop: 4, flex: 'none' }} /> {SITE.address}</li>
              <li><a href={SITE.phoneHref} style={{ display: 'flex', gap: 10 }}><LuPhone size={16} style={{ marginTop: 4 }} /> {SITE.phone}</a></li>
              <li><a href={SITE.emailHref} style={{ display: 'flex', gap: 10, wordBreak: 'break-all' }}><LuMail size={16} style={{ marginTop: 4, flex: 'none' }} /> {SITE.email}</a></li>
              <li style={{ display: 'flex', gap: 10 }}><LuClock size={16} style={{ marginTop: 4, flex: 'none' }} /> {SITE.hours}</li>
            </ul>
          </div>
        </div>
        <div className="r-footer__bottom">
          <span>© {year} RMS — Residential Management System. All rights reserved.</span>
          <span style={{ display: 'flex', gap: 20 }}>
            <Link to="/faq">Help centre</Link>
            <Link to="/contact">Report a listing</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
