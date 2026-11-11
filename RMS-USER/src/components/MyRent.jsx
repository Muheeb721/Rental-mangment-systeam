function MyRent({ rentRows = [] }) {
  const rows = rentRows.length
    ? rentRows
    : [
        {
          id: 'MR-101',
          tenant: 'Nadia Raza',
          property: 'Sunset Heights Apartment',
          totalRent: 42000,
          amountPaid: 28000,
          balanceDue: 14000,
          status: 'Partial',
        },
        {
          id: 'MR-102',
          tenant: 'Ali Hassan',
          property: 'Cedar Residency',
          totalRent: 38000,
          amountPaid: 38000,
          balanceDue: 0,
          status: 'Paid',
        },
      ];

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
      <h2 style={{ marginTop: 0, marginBottom: 18 }}>My Rent Ledger</h2>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#334155' }}>
              <th style={thStyle}>Rent Slip</th>
              <th style={thStyle}>Tenant</th>
              <th style={thStyle}>Property</th>
              <th style={thStyle}>Total Rent</th>
              <th style={thStyle}>Amount Paid</th>
              <th style={thStyle}>Balance Due</th>
              <th style={thStyle}>Payment Status</th>
              <th style={thStyle}>Slip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                <td style={tdStyle}>{row.id}</td>
                <td style={tdStyle}>{row.tenant}</td>
                <td style={tdStyle}>{row.property}</td>
                <td style={tdStyle}>PKR {Number(row.totalRent || 0).toLocaleString()}</td>
                <td style={tdStyle}>PKR {Number(row.amountPaid || 0).toLocaleString()}</td>
                <td style={tdStyle}>PKR {Number(row.balanceDue || 0).toLocaleString()}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: row.status === 'Paid' ? '#e7f8ee' : row.status === 'Partial' ? '#fff0d8' : '#ffe4e6',
                      color: row.status === 'Paid' ? '#117a43' : row.status === 'Partial' ? '#b66a00' : '#b42318',
                      fontWeight: 700,
                    }}
                  >
                    {row.status}
                  </span>
                </td>
                <td style={tdStyle}>
                  <button type="button" style={{ border: 'none', background: '#123a70', color: '#fff', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                    View slip
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 10px',
  fontSize: 13,
  fontWeight: 700,
};

const tdStyle = {
  padding: '12px 10px',
  fontSize: 14,
  color: '#334155',
};

export default MyRent;
