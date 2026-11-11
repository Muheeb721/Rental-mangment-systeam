import { useEffect, useMemo, useState } from 'react';
import { LuBike, LuBus, LuFootprints, LuCar, LuCarTaxiFront, LuInfo, LuRoute } from 'react-icons/lu';
import { TbMotorbike } from 'react-icons/tb';
import LocationSearch, { iconFor } from './LocationSearch';
import { NearbyMap } from './PropertyMap';
import { usePlaces } from '../../hooks/usePlaces';
import { fmtKm, fmtMin, getNearbyForProperty, getTravel } from '../../services/locationService';
import { formatNumber } from '../../utils/property';

const TABS = [
  { key: 'university', label: 'Universities' },
  { key: 'hospital', label: 'Hospitals' },
  { key: 'school', label: 'Schools' },
  { key: 'mall', label: 'Shopping' },
  { key: 'transport', label: 'Transport' },
];
const QUICK = ['lums', 'liberty-market', 'allama-iqbal-international-airport', 'university-of-the-punjab', 'emporium-mall'];
const MODE_ICON = { walk: LuFootprints, walking: LuFootprints, bus: LuBus, car: LuCar, bike: TbMotorbike, motorbike: TbMotorbike, rickshaw: LuCarTaxiFront, ride: LuCarTaxiFront, cycle: LuBike };
const WORK_DAYS = 22;

function CommutePlanner({ property, places }) {
  const [to, setTo] = useState(null);
  const [state, setState] = useState({ loading: false, data: null });

  useEffect(() => {
    if (!to) { setState({ loading: false, data: null }); return undefined; }
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    getTravel(property, to).then((data) => { if (active) setState({ loading: false, data }); });
    return () => { active = false; };
  }, [to, property]);

  const quick = useMemo(() => QUICK.map((s) => places.find((p) => p.slug === s)).filter(Boolean).slice(0, 4), [places]);
  const d = state.data;

  return (
    <div className="lc-plan">
      <div className="lc-plan__head">
        <span className="lc-plan__icon"><LuRoute size={18} /></span>
        <div>
          <h3>Plan your commute</h3>
          <p className="r-muted r-small">Pick your office, university or any place in Lahore.</p>
        </div>
      </div>
      <LocationSearch places={places} value={to} onSelect={setTo} placeholder="Where do you go every day?" ariaLabel="Commute destination" />
      {!to && quick.length ? (
        <div className="lc-plan__quick">
          {quick.map((p) => <button key={p.slug} type="button" className="r-chip" onClick={() => setTo(p)}>{p.name}</button>)}
        </div>
      ) : null}
      {to ? (
        <div className="lc-plan__result" aria-live="polite" aria-busy={state.loading}>
          {state.loading && !d ? <div className="r-skel" style={{ height: 140 }} /> : d ? (
            <>
              <p className="lc-plan__dist">About <strong>{fmtKm(d.distanceKm)}</strong> by road to <strong>{to.name}</strong></p>
              <div className="lc-table" role="table" aria-label={`Commute options to ${to.name}`}>
                <div className="lc-table__row lc-table__row--head" role="row">
                  <span role="columnheader">Mode</span>
                  <span role="columnheader">Time</span>
                  <span role="columnheader">Rush hour</span>
                  <span role="columnheader">Per trip</span>
                  <span role="columnheader">Per month*</span>
                </div>
                {d.modes.map((m) => {
                  const Icon = MODE_ICON[m.mode] || LuCar;
                  return (
                    <div className="lc-table__row" role="row" key={m.mode}>
                      <span role="cell" className="lc-mode"><Icon size={16} /> {m.label}</span>
                      <span role="cell" data-label="Time">~{fmtMin(m.minutes)}</span>
                      <span role="cell" data-label="Rush hour">~{fmtMin(m.minutesPeak)}</span>
                      <span role="cell" data-label="Per trip">{m.costPkr ? `PKR ${formatNumber(m.costPkr)}` : '—'}</span>
                      <span role="cell" data-label="Per month">{m.costPkr ? `PKR ${formatNumber(m.costPkr * 2 * WORK_DAYS)}` : '—'}</span>
                    </div>
                  );
                })}
              </div>
              <p className="lc-note"><LuInfo size={13} /> Estimate only. *Monthly cost assumes {WORK_DAYS} working days with a return trip each day. Car and motorbike costs are fuel only; rickshaw and ride-hailing are typical fares.</p>
            </>
          ) : <p className="r-muted">Couldn&apos;t estimate this trip.</p>}
        </div>
      ) : null}
    </div>
  );
}

export default function LocationCommute({ property }) {
  const places = usePlaces();
  const [tab, setTab] = useState('university');
  const [byCat, setByCat] = useState({});
  const [active, setActive] = useState('');

  useEffect(() => { setByCat({}); }, [property.id]);

  useEffect(() => {
    if (byCat[tab]) return undefined;
    let alive = true;
    getNearbyForProperty(property, { category: tab, limit: 5 }).then((list) => {
      if (alive) setByCat((m) => ({ ...m, [tab]: list }));
    }).catch(() => { if (alive) setByCat((m) => ({ ...m, [tab]: [] })); });
    return () => { alive = false; };
  }, [tab, property, byCat]);

  const list = byCat[tab];
  const hasLL = Number.isFinite(property.lat) && Number.isFinite(property.lng);

  return (
    <section className="pd-section lc" id="location">
      <h2>Location &amp; commute</h2>
      <p className="r-muted" style={{ marginBottom: 14 }}>{property.address}</p>
      {property.approximate || property.raw?.locationApproximate ? (
        <div className="lc-approx"><LuInfo size={15} /> Approximate location — the pin shows the area centre. The exact address is shared once your visit is confirmed.</div>
      ) : null}

      {hasLL ? (
        <NearbyMap property={property} items={list || []} activeSlug={active} category={tab} />
      ) : (
        <div className="r-card r-card--pad r-muted">Map location for this listing hasn&apos;t been added yet.</div>
      )}

      {hasLL ? (
        <>
          <div className="lc-tabs" role="tablist" aria-label="Nearby places">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`lc-tab ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          <div className="lc-list" role="tabpanel">
            {!list ? [0, 1, 2].map((i) => <div key={i} className="r-skel" style={{ height: 56 }} />) : list.length ? list.map((n, i) => {
              const Icon = iconFor(n.place);
              return (
                <div key={n.place.slug} className={`lc-item ${active === n.place.slug ? 'is-active' : ''}`} onMouseEnter={() => setActive(n.place.slug)} onMouseLeave={() => setActive('')}>
                  <span className={`lc-item__num ls__icon ls__icon--${n.place.category}`}><Icon size={15} /></span>
                  <div className="lc-item__main">
                    <strong>{n.place.name}</strong>
                    <span>{fmtKm(n.distanceKm)} away{i === 0 ? ' · nearest' : ''}</span>
                  </div>
                  <div className="lc-item__times" aria-label="Estimated travel times">
                    <span title="By car"><LuCar size={14} /> {n.minutes.car} min</span>
                    <span title="By motorbike"><TbMotorbike size={14} /> {n.minutes.bike} min</span>
                    <span title="By rickshaw"><LuCarTaxiFront size={14} /> {n.minutes.rickshaw} min</span>
                  </div>
                </div>
              );
            }) : <p className="r-muted">No {TABS.find((t) => t.key === tab)?.label.toLowerCase()} found nearby.</p>}
          </div>
          <p className="lc-note"><LuInfo size={13} /> Distances are estimated road distances; times assume normal traffic.</p>
          <CommutePlanner property={property} places={places} />
        </>
      ) : null}
    </section>
  );
}
