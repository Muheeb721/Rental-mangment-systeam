/* eslint-disable react-refresh/only-export-components */
import { moneyShort } from '../lib/format';

export const PALETTE = ['#1d4ed8', '#0d9488', '#f59e0b', '#7c3aed', '#dc2626', '#0284c7', '#64748b'];

/** Vertical bar chart. series: [{ key, label, color }], data: [{ label, [key]: number }] */
export function BarChart({ data, series, format = (v) => v, height = 200 }) {
  const totals = data.map((row) => series.reduce((sum, s) => sum + Number(row[s.key] || 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <div className="chart">
      <div className="chart-bars" style={{ height }}>
        {data.map((row, index) => (
          <div key={row.label} className="chart-bar-col" title={`${row.label}: ${format(totals[index])}`}>
            <span className="chart-bar-value">{totals[index] ? format(totals[index]) : ''}</span>
            <div className="chart-bar-stack" style={{ height: `${Math.max(1.5, (totals[index] / max) * 100)}%` }}>
              {series.map((s) => (
                <div key={s.key} className="chart-bar" style={{ height: totals[index] ? `${(Number(row[s.key] || 0) / totals[index]) * 100}%` : 0, background: s.color }} />
              ))}
            </div>
            <span className="chart-bar-label">{row.label}</span>
          </div>
        ))}
      </div>
      {series.length > 1 && (
        <div className="legend mt-16">
          {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for category counts: data [{ label, value }] */
export function HBarChart({ data, color = PALETTE[0] }) {
  const max = Math.max(1, ...data.map((row) => row.value));
  if (!data.length) return <p className="muted">No data yet.</p>;
  return (
    <div className="hbar">
      {data.map((row, index) => (
        <div key={row.label} className="hbar-row">
          <span className="truncate">{row.label}</span>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(row.value / max) * 100}%`, background: Array.isArray(color) ? color[index % color.length] : color }} /></div>
          <span className="strong" style={{ textAlign: 'right' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Donut chart: data [{ label, value }] */
export function DonutChart({ data, size = 150, centerLabel }) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Distribution chart">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef2f7" strokeWidth="18" />
        {total > 0 && data.map((row, index) => {
          const length = (row.value / total) * circumference;
          const circle = (
            <circle
              key={row.label}
              cx="70" cy="70" r={radius} fill="none"
              stroke={PALETTE[index % PALETTE.length]} strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += length;
          return circle;
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">{total}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="11" fill="#64748b">{centerLabel}</text>
      </svg>
      <div className="donut-legend">
        {data.map((row, index) => (
          <div key={row.label}><i style={{ background: PALETTE[index % PALETTE.length] }} />{row.label}<b>{row.value}</b></div>
        ))}
        {!data.length && <span className="muted">No data yet.</span>}
      </div>
    </div>
  );
}

export const moneyAxis = (value) => moneyShort(value).replace('PKR ', '');
