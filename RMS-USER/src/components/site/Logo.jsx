import { Link } from 'react-router-dom';

export function LogoMark({ className = 'r-logo__mark' }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0b5d4b" />
      <path d="M14 31.5 32 17l18 14.5V48a2 2 0 0 1-2 2H38V38H26v12H16a2 2 0 0 1-2-2z" fill="#fff" />
      <circle cx="46" cy="18" r="5" fill="#d4a24c" />
    </svg>
  );
}

export default function Logo({ to = '/', onClick }) {
  return (
    <Link to={to} className="r-logo" onClick={onClick} aria-label="RMS home">
      <LogoMark />
      <span>
        RMS
        <small>Lahore Homes &amp; Rentals</small>
      </span>
    </Link>
  );
}
