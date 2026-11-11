import { Link } from 'react-router-dom';

function DemoLandingPage() {
  return (
    <div className="page-shell" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <div style={{
        width: '100%',
        maxWidth: 760,
        background: '#fff',
        border: '1px solid #e7ebf2',
        borderRadius: 24,
        boxShadow: '0 20px 60px rgba(11, 36, 80, 0.08)',
        padding: '40px 24px',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, color: '#28b463', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 12 }}>
          Property Demo
        </p>
        <h1 style={{ margin: '16px 0 12px', color: '#0b2450', fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
          Choose your demo view
        </h1>
        <p style={{ margin: '0 auto 28px', maxWidth: 560, color: '#687386', lineHeight: 1.7 }}>
          Keep house and hostel management completely separate. Each view opens its own dedicated demo page.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link to="/demo/house" className="btn-primary">House View</Link>
          <Link to="/demo/apartments" className="btn-secondary">Apartment View</Link>
          <Link to="/demo/flats" className="btn-ghost">Flat View</Link>
        </div>
      </div>
    </div>
  );
}

export default DemoLandingPage;
