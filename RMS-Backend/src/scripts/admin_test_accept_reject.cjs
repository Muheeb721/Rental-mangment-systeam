const http = require('http');

const adminSession = JSON.stringify({ id: 'dev-admin-1', email: 'admin@example.com', name: 'Dev Admin', role: 'admin' });

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { const parsed = JSON.parse(data || '{}'); resolve({ statusCode: res.statusCode, body: parsed }); }
        catch (e) { resolve({ statusCode: res.statusCode, body: data }); }
      });
    });
    req.on('error', (e) => reject(e));
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    console.log('Fetching all applications...');
    const listOpts = { hostname: 'localhost', port: 5000, path: '/api/applications', method: 'GET', headers: { 'x-rms-session': adminSession } };
    const listRes = await request(listOpts);
    console.log('List status:', listRes.statusCode);
    const apps = listRes.body && listRes.body.data ? listRes.body.data : [];
    console.log(`Found ${apps.length} applications`);
    if (!apps.length) return console.log('No applications to process');

    const pending = apps.find(a => (a.applicationStatus || a.status || '').toLowerCase() === 'pending') || apps[0];
    console.log('Selected application:', pending._id || pending.id || pending.bookingId);

    const id = pending._id || pending.id || pending.bookingId;
    console.log('Attempting to accept application', id);
    const acceptOpts = { hostname: 'localhost', port: 5000, path: `/api/applications/${id}/accept`, method: 'PUT', headers: { 'x-rms-session': adminSession } };
    const acceptRes = await request(acceptOpts);
    console.log('Accept status:', acceptRes.statusCode, JSON.stringify(acceptRes.body));

    console.log('Fetching application after accept...');
    const getOpts = { hostname: 'localhost', port: 5000, path: `/api/applications/${id}`, method: 'GET', headers: { 'x-rms-session': adminSession } };
    const getRes = await request(getOpts);
    console.log('Get status:', getRes.statusCode, JSON.stringify(getRes.body));
  } catch (e) {
    console.error('Error during test', e);
  }
}

run();
