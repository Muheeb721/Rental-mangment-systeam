import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X } from 'lucide-react';

const LAHORE = [31.5, 74.34];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Searchable picker over every Lahore area. */
export function AreaPicker({ areas, value, onPick, id = 'area-picker' }) {
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); setText(value || ''); }
  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const parentName = (a) => (a.parent ? areas.find((p) => p.slug === a.parent)?.name || '' : '');
  const results = useMemo(() => {
    const q = norm(text === value ? '' : text);
    const scored = areas.map((a) => {
      if (!q) return { a, s: a.parent ? 1 : 2 };
      const names = [a.name, ...(a.aliases || []), parentName(a) ? `${parentName(a)} ${a.name}` : ''].map(norm);
      let s = 0;
      for (const n of names) {
        if (!n) continue;
        if (n.startsWith(q)) s = Math.max(s, 3);
        else if (n.split(' ').some((w) => w.startsWith(q))) s = Math.max(s, 2);
        else if (q.split(' ').every((w) => n.includes(w))) s = Math.max(s, 1);
      }
      return { a, s };
    }).filter((x) => x.s > 0);
    scored.sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name, undefined, { numeric: true }));
    return scored.slice(0, 40).map((x) => x.a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, text, value]);

  const pick = (a) => { setOpen(false); setText(a.name); onPick(a); };

  return (
    <div className="area-picker" ref={ref}>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        placeholder={areas.length ? 'Search any Lahore area, e.g. Johar Town, DHA Phase 6' : 'Loading areas…'}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); pick(results[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {text ? <button type="button" className="area-picker__clear" aria-label="Clear" onClick={() => { setText(''); setOpen(true); }}><X size={14} /></button> : null}
      {open && (
        <ul className="area-picker__list" role="listbox">
          {results.length ? results.map((a, i) => (
            <li key={a.slug} role="option" aria-selected={i === active} className={i === active ? 'active' : ''} onPointerDown={(e) => e.preventDefault()} onClick={() => pick(a)} onMouseEnter={() => setActive(i)}>
              <MapPin size={14} />
              <span className="area-picker__name">{a.name}</span>
              <span className="area-picker__meta">{parentName(a) || 'Lahore'}{a.tier ? ` · ${a.tier}` : ''}</span>
            </li>
          )) : <li className="area-picker__empty">No matching areas</li>}
        </ul>
      )}
    </div>
  );
}

const pinIcon = L.divIcon({
  className: 'loc-pin-wrap',
  html: '<span class="loc-pin"><span></span></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function ClickToSet({ onChange }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ pos }) {
  const map = useMap();
  const key = pos ? `${pos[0].toFixed(4)},${pos[1].toFixed(4)}` : '';
  useEffect(() => {
    if (!pos) return;
    if (map.getZoom() < 13 || !map.getBounds().pad(-0.2).contains(pos)) map.setView(pos, Math.max(map.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Click or drag the pin to set exact coordinates. */
export function LocationPicker({ latitude, longitude, onChange, height = 320 }) {
  const has = latitude !== '' && latitude != null && longitude !== '' && longitude != null && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const pos = has ? [Number(latitude), Number(longitude)] : null;
  const set = (lat, lng) => onChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
  return (
    <div className="loc-map" style={{ height }}>
      <MapContainer center={pos || LAHORE} zoom={pos ? 15 : 11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        <ClickToSet onChange={set} />
        <Recenter pos={pos} />
        {pos ? (
          <Marker position={pos} icon={pinIcon} draggable eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); set(ll.lat, ll.lng); } }} />
        ) : null}
      </MapContainer>
      <div className="loc-map__hint">{pos ? 'Drag the pin or click the map to adjust' : 'Click the map to drop a pin'}</div>
    </div>
  );
}
