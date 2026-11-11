import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { formatNumber, formatPKR } from '../../utils/property';
import Img from './Img';

const LAHORE = [31.5000, 74.3400];
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const shortPrice = (p) => {
  if (!p.price) return 'Ask';
  if (p.price >= 1000000) return formatPKR(p.price).replace('PKR ', '');
  return `${Math.round(p.price / 1000)}k`;
};

const priceIcon = (p, active) => L.divIcon({
  className: 'r-mapmark-wrap',
  html: `<span class="r-mapmark ${active ? 'is-active' : ''}">${shortPrice(p)}</span>`,
  iconSize: null,
  iconAnchor: [28, 34],
});

const pinIcon = L.divIcon({
  className: 'r-mapmark-wrap',
  html: '<span class="r-mappin"><span></span></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (!points.length) { map.setView(LAHORE, 11); return; }
      if (points.length === 1) { map.setView(points[0], 14); return; }
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    };
    fit();
    // Containers inside animated/grid layouts may get their final size a moment later.
    const t = setTimeout(fit, 350);
    return () => clearTimeout(t);
  }, [map, points]);
  return null;
}

const focusIcon = L.divIcon({
  className: 'r-mapmark-wrap',
  html: '<span class="r-mapfocus"><span></span></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Multi-listing map with price markers. Optional `focus` place (near-mode) with radius ring. */
export function ListingsMap({ items = [], activeId, height = '100%', focus = null, radiusKm = 0 }) {
  const located = useMemo(() => items.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)), [items]);
  // Spread listings that share the same approximate centroid so markers don't stack.
  const placed = useMemo(() => {
    const seen = new Map();
    return located.map((p) => {
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      if (!n) return { p, pos: [p.lat, p.lng] };
      const angle = n * 2.4;
      const r = 0.0042 * Math.sqrt(n);
      return { p, pos: [p.lat + r * Math.cos(angle), p.lng + r * Math.sin(angle)] };
    });
  }, [located]);
  const hasFocus = Number.isFinite(focus?.lat) && Number.isFinite(focus?.lng);
  const points = useMemo(() => [...placed.map((x) => x.pos), ...(hasFocus ? [[focus.lat, focus.lng]] : [])], [placed, hasFocus, focus?.lat, focus?.lng]);

  return (
    <div className="r-map" style={{ height }}>
      <MapContainer center={LAHORE} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <FitBounds points={points} />
        {hasFocus ? (
          <>
            {radiusKm ? <Circle center={[focus.lat, focus.lng]} radius={radiusKm * 1000 / 1.35} pathOptions={{ color: '#c18a2c', fillColor: '#c18a2c', fillOpacity: 0.06, weight: 1.5, dashArray: '6 6' }} /> : null}
            <Marker position={[focus.lat, focus.lng]} icon={focusIcon} zIndexOffset={2000}>
              <Popup closeButton={false}><strong>{focus.name}</strong></Popup>
            </Marker>
          </>
        ) : null}
        {placed.map(({ p, pos }) => (
          <Marker key={p.id} position={pos} icon={priceIcon(p, p.id === activeId)} zIndexOffset={p.id === activeId ? 1000 : 0}>
            <Popup closeButton={false} className="r-mappop">
              <Link to={`/properties/${p.id}`} className="r-mappop__card">
                <div className="r-mappop__img"><Img src={p.cover} alt="" /></div>
                <div style={{ padding: '10px 12px' }}>
                  <strong>{p.isRent ? `PKR ${formatNumber(p.price)}/mo` : formatPKR(p.price)}</strong>
                  <span>{p.title}</span>
                </div>
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {items.length > located.length ? (
        <div className="r-map__note">{items.length - located.length} listing{items.length - located.length > 1 ? 's' : ''} without a map location</div>
      ) : null}
    </div>
  );
}

/** Single-property location map. */
export function LocationMap({ property, height = 340 }) {
  const has = Number.isFinite(property?.lat) && Number.isFinite(property?.lng);
  if (!has) return null;
  const pos = [property.lat, property.lng];
  return (
    <div className="r-map" style={{ height }}>
      <MapContainer center={pos} zoom={property.approximate ? 14 : 15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        {property.approximate ? (
          <Circle center={pos} radius={650} pathOptions={{ color: '#0b5d4b', fillColor: '#14907a', fillOpacity: 0.15, weight: 1.5 }} />
        ) : (
          <Marker position={pos} icon={pinIcon} />
        )}
      </MapContainer>
    </div>
  );
}

export default ListingsMap;

const CAT_COLORS = { university: '#3538cd', hospital: '#b42318', school: '#c11574', mall: '#93370d', transport: '#026aa2', park: '#067647', mosque: '#475467' };
const landIcon = (n, color, active) => L.divIcon({
  className: 'r-mapmark-wrap',
  html: `<span class="r-mapland ${active ? 'is-active' : ''}" style="color:${color}"><b>${n}</b></span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Property pin plus numbered nearby landmarks; fits bounds to all of them. */
export function NearbyMap({ property, items = [], activeSlug = '', category = '', height = 340 }) {
  const pos = [property.lat, property.lng];
  const color = CAT_COLORS[category] || '#0b5d4b';
  const points = useMemo(() => [[property.lat, property.lng], ...items.map((n) => [n.place.lat, n.place.lng])].filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])), [property.lat, property.lng, items]);
  return (
    <div className="r-map" style={{ height }}>
      <MapContainer center={pos} zoom={14} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <FitBounds points={points} />
        {property.approximate ? (
          <Circle center={pos} radius={500} pathOptions={{ color: '#0b5d4b', fillColor: '#14907a', fillOpacity: 0.15, weight: 1.5 }} />
        ) : null}
        <Marker position={pos} icon={pinIcon} zIndexOffset={1500}>
          <Popup closeButton={false}><strong>{property.title}</strong></Popup>
        </Marker>
        {items.filter((n) => Number.isFinite(n.place.lat)).map((n, i) => (
          <Marker key={n.place.slug} position={[n.place.lat, n.place.lng]} icon={landIcon(i + 1, color, n.place.slug === activeSlug)} zIndexOffset={n.place.slug === activeSlug ? 1000 : 0}>
            <Popup closeButton={false}><strong>{n.place.name}</strong><br />{n.distanceKm} km · ~{n.minutes.car} min by car</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
