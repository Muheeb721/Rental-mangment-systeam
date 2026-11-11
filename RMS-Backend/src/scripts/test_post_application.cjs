const http = require('http');

const data = JSON.stringify({
  propertyId: '000000000000000000000000',
  propertyTitle: 'Test Property',
  rent: 1000,
  userName: 'Dev User',
  userEmail: 'dev@example.com',
  userPhone: '12345',
  cnic: '12345-1234567-1',
  termsAccepted: true,
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/applications',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'x-rms-session': JSON.stringify({ id: 'dev-user-1', email: 'dev@example.com', name: 'Dev User', role: 'user' }),
  },
};

const req = http.request(options, (res) => {
  let body = '';
  console.log('Status:', res.statusCode);
  res.setEncoding('utf8');
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Response body:', body);
  });
});

req.on('error', (e) => { console.error('Request error:', e); });
req.write(data);
req.end();
