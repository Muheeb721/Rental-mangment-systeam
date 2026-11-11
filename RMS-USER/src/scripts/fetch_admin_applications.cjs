const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5176,
  path: '/admin/applications',
  method: 'GET',
  headers: {
    'Accept': 'text/html',
  },
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    body += chunk;
    if (body.length > 2000) {
      // print first chunk and end
      console.log('Body slice:', body.slice(0, 2000));
      req.destroy();
      process.exit(0);
    }
  });
  res.on('end', () => {
    console.log('Body:', body.slice(0, 2000));
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(2);
});

req.end();
