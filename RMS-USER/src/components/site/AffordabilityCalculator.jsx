import { useId, useState } from 'react';
import { LuCalculator, LuInfo } from 'react-icons/lu';
import { formatNumber, formatPKR } from '../../utils/property';

/** Standard amortised EMI. rate = annual %, years = tenure. */
export function emi(principal, rate, years) {
  const n = Math.round(years * 12);
  if (!principal || !n) return 0;
  const r = rate / 12 / 100;
  if (!r) return principal / n;
  const f = (1 + r) ** n;
  return (principal * r * f) / (f - 1);
}

export default function AffordabilityCalculator({ price }) {
  const id = useId();
  const [down, setDown] = useState(30);
  const [rate, setRate] = useState(16);
  const [years, setYears] = useState(15);

  const downAmt = Math.round((price * down) / 100);
  const loan = Math.max(0, price - downAmt);
  const monthly = emi(loan, rate, years);
  const total = monthly * years * 12;
  const interest = Math.max(0, total - loan);
  const income = monthly / 0.4; // banks typically cap instalments at ~40% of take-home income

  const slider = ({ label, value, set, min, max, step, fmt }) => (
    <label className="ac-field" htmlFor={`${id}-${label.split(" ")[0]}`}>
      <span className="ac-field__top"><span>{label}</span><strong>{fmt(value)}</strong></span>
      <input id={`${id}-${label.split(" ")[0]}`} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );

  return (
    <section className="pd-section ac" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}><LuCalculator size={20} style={{ verticalAlign: '-3px', marginRight: 8 }} />Home loan calculator</h2>
      <div className="ac-grid">
        <div className="ac-inputs">
          {slider({ label: 'Down payment', value: down, set: setDown, min: 10, max: 90, step: 5, fmt: (v) => `${v}% · ${formatPKR(downAmt)}` })}
          {slider({ label: 'Interest rate (yearly)', value: rate, set: setRate, min: 5, max: 25, step: 0.5, fmt: (v) => `${v}%` })}
          {slider({ label: 'Loan tenure', value: years, set: setYears, min: 1, max: 25, step: 1, fmt: (v) => `${v} year${v > 1 ? 's' : ''}` })}
        </div>
        <div className="ac-out">
          <span className="r-muted r-small">Estimated monthly instalment</span>
          <strong className="ac-emi">PKR {formatNumber(monthly)}</strong>
          <dl>
            <div><dt>Loan amount</dt><dd>{formatPKR(loan)}</dd></div>
            <div><dt>Total interest</dt><dd>{formatPKR(interest)}</dd></div>
            <div><dt>Total payable</dt><dd>{formatPKR(total + downAmt)}</dd></div>
            <div><dt>Suggested monthly income</dt><dd>PKR {formatNumber(income)}+</dd></div>
          </dl>
        </div>
      </div>
      <p className="lc-note"><LuInfo size={13} /> Illustrative estimate only — actual rates, processing fees and eligibility depend on your bank.</p>
    </section>
  );
}
