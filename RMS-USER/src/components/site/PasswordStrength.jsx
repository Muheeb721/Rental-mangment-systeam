const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['var(--line)', '#e11d48', '#f59e0b', '#14907a', '#0b5d4b'];

function passwordScore(pw = '') {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s += 1;
  return s;
}

export default function PasswordStrength({ value = '' }) {
  if (!value) return null;
  const score = passwordScore(value);
  return (
    <>
      <div className="au-strength" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} style={{ background: i <= score ? COLORS[score] : undefined }} />)}</div>
      <span className="r-hint">Password strength: {LABELS[score]}</span>
    </>
  );
}
