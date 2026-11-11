import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  LuBuilding2, LuBus, LuGraduationCap, LuHospital, LuLandmark, LuMapPin, LuSchool, LuShoppingBag, LuTrees, LuX,
} from 'react-icons/lu';
import { CATEGORY_LABELS, groupPlaces, searchPlaces } from '../../services/locationService';
import './LocationSearch.css';

export const CATEGORY_ICONS = {
  area: LuMapPin,
  university: LuGraduationCap,
  hospital: LuHospital,
  school: LuSchool,
  mall: LuShoppingBag,
  transport: LuBus,
  park: LuTrees,
  mosque: LuLandmark,
};
export const iconFor = (p) => CATEGORY_ICONS[p?.type === 'area' ? 'area' : p?.category] || LuBuilding2;

const POPULAR = ['dha-lahore', 'gulberg', 'johar-town', 'bahria-town', 'model-town', 'lahore-cantt', 'lums', 'university-of-the-punjab', 'shaukat-khanum-hospital'];

/**
 * Accessible combobox over Lahore areas + landmarks, grouped by category, with fuzzy matching.
 * onSelect(place | null)
 */
export default function LocationSearch({
  places = [], value = null, onSelect, placeholder = 'Area, society or landmark', types, className = '', inputClassName = 'r-input', autoFocus = false, ariaLabel = 'Location',
}) {
  const id = useId();
  const [text, setText] = useState(value?.name || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { setText(value?.name || ''); }, [value?.slug, value?.name]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  const query = text && text !== value?.name ? text : '';
  const results = useMemo(() => {
    if (query) return searchPlaces(places, query, { types, limit: 24 });
    const pool = types ? places.filter((p) => types.includes(p.type)) : places;
    const pop = POPULAR.map((s) => pool.find((p) => p.slug === s)).filter(Boolean);
    return pop.length ? pop : pool.slice(0, 8);
  }, [places, query, types]);
  const groups = useMemo(() => groupPlaces(results), [results]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (p) => {
    setText(p ? p.name : '');
    setOpen(false);
    onSelect?.(p);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && flat[active]) { e.preventDefault(); choose(flat[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  let idx = -1;
  return (
    <div className={`ls ${className}`} ref={wrapRef}>
      <input
        className={inputClassName}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && flat[active] ? `${id}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        value={text}
        placeholder={places.length ? placeholder : 'Loading locations…'}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => { setText(e.target.value); setOpen(true); if (!e.target.value && value) onSelect?.(null); }}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onKeyDown={onKey}
      />
      {text ? (
        <button type="button" className="ls__clear" aria-label="Clear location" onClick={() => { choose(null); }}><LuX size={15} /></button>
      ) : null}
      {open && (
        <div className="ls__pop" id={`${id}-list`} role="listbox" ref={listRef} data-lenis-prevent>
          {!query ? <div className="ls__hint">Popular in Lahore</div> : null}
          {flat.length ? groups.map((g) => (
            <div key={g.key} role="group" aria-label={g.label}>
              <div className="ls__group">{query ? g.label : CATEGORY_LABELS[g.key] || g.label}</div>
              {g.items.map((p) => {
                idx += 1;
                const i = idx;
                const Icon = iconFor(p);
                return (
                  <div
                    key={p.slug}
                    id={`${id}-opt-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={i === active}
                    className={`ls__opt ${i === active ? 'is-active' : ''}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => choose(p)}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className={`ls__icon ls__icon--${p.type === 'area' ? 'area' : p.category}`}><Icon size={15} /></span>
                    <span className="ls__name">{p.name}</span>
                    <span className="ls__meta">{p.type === 'area' ? (p.parentName || (p.parent ? places.find((x) => x.slug === p.parent)?.name : '') || 'Lahore') : 'Search nearby'}</span>
                  </div>
                );
              })}
            </div>
          )) : <div className="ls__empty">No areas or landmarks match “{text}”.</div>}
        </div>
      )}
    </div>
  );
}
