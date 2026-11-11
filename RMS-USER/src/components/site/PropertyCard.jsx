import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuBath, LuBedDouble, LuCamera, LuCar, LuMapPin, LuRuler } from 'react-icons/lu';
import Img from './Img';
import FavoriteButton from './FavoriteButton';
import { formatPKR, formatPrice, pricePerMarla } from '../../utils/property';
import { fmtKm } from '../../services/locationService';

export function PropertyCardSkeleton({ layout = 'grid' }) {
  return (
    <div className={`r-pcard ${layout === 'list' ? 'r-pcard--row' : ''}`} aria-hidden="true">
      <div className="r-pcard__media r-skel" style={{ borderRadius: 0 }} />
      <div className="r-pcard__body">
        <div className="r-skel" style={{ height: 22, width: '55%' }} />
        <div className="r-skel" style={{ height: 14, width: '85%' }} />
        <div className="r-skel" style={{ height: 14, width: '60%' }} />
        <div className="r-skel" style={{ height: 14, width: '70%', marginTop: 14 }} />
      </div>
    </div>
  );
}

export default function PropertyCard({ property: p, layout = 'grid', onHover }) {
  const { amount, suffix } = formatPrice(p);
  const perMarla = pricePerMarla(p);
  return (
    <motion.article
      className={`r-pcard ${layout === 'list' ? 'r-pcard--row' : ''}`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => onHover?.(p.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Link to={`/properties/${p.id}`} className="r-pcard__media" aria-label={p.title}>
        <Img src={p.cover} alt={p.title} />
        <div className="r-pcard__badges">
          <span className={`r-badge ${p.isRent ? 'r-badge--glass' : 'r-badge--dark'}`}>For {p.purpose}</span>
          {p.featured ? <span className="r-badge r-badge--accent">Featured</span> : null}
          {p.statusKey === 'reserved' ? <span className="r-badge r-badge--warning">Reserved</span> : !p.available ? <span className="r-badge r-badge--danger">{p.statusLabel}</span> : null}
        </div>
        {p.images.length > 1 ? <span className="r-badge r-badge--dark r-pcard__count"><LuCamera size={13} /> {p.images.length}</span> : null}
      </Link>
      <div className="r-pcard__fav"><FavoriteButton id={p.id} /></div>
      <Link to={`/properties/${p.id}`} className="r-pcard__body">
        <div className="r-pcard__price">{amount} {suffix ? <small>{suffix}</small> : null}{perMarla ? <small className="r-pcard__pm">{formatPKR(perMarla)}/marla</small> : null}</div>
        <div className="r-pcard__title">{p.title}</div>
        <div className="r-pcard__loc"><LuMapPin size={14} /><span>{p.locationLabel}</span></div>
        {p.nearInfo ? (
          <div className="r-pcard__near" title="Estimated road distance and drive time in normal traffic">
            <LuCar size={14} /><span>{fmtKm(p.nearInfo.km)} · ~{p.nearInfo.minutes} min to {p.nearInfo.to}</span>
          </div>
        ) : null}
        {layout === 'list' && p.description ? <p className="r-pcard__desc">{p.description}</p> : null}
        <div className="r-pcard__facts">
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.type}</span>
          {p.bedrooms ? <span><LuBedDouble size={15} /> {p.bedrooms} Bed{p.bedrooms > 1 ? 's' : ''}</span> : null}
          {p.bathrooms ? <span><LuBath size={15} /> {p.bathrooms} Bath{p.bathrooms > 1 ? 's' : ''}</span> : null}
          {p.areaLabel ? <span><LuRuler size={15} /> {p.areaLabel}</span> : null}
        </div>
      </Link>
    </motion.article>
  );
}
