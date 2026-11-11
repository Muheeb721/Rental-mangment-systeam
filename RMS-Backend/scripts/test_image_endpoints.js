import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_SESSION = { id: 'admin-test', email: 'admin@rms.com', name: 'AdminTester', role: 'admin' };

const headers = { 'x-rms-session': JSON.stringify(ADMIN_SESSION) };

async function run() {
  try {
    console.log('Creating test property...');
    const createRes = await fetch(`${BASE}/api/properties`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Upload Property', propertyType: 'House', price: 100000, city: 'Karachi', location: 'DHA Phase 7', ownerName: 'Owner X', ownerPhone: '+923001234567', ownerEmail: 'owner@example.com' }),
    });
    const createJson = await createRes.json();
    if (!createRes.ok) throw new Error(`Create failed: ${createJson.message || JSON.stringify(createJson)}`);
    const prop = createJson.data;
    console.log('Created property id:', prop._id || prop.id);
    const propId = prop._id || prop.id;

    // upload image
    const imgPath = path.join(process.cwd(), 'public', 'images', 'demos', 'house-001-cover.svg');
    console.log('Uploading image from', imgPath);
    const fd = new FormData();
    fd.append('image', new Blob([await fs.promises.readFile(imgPath)], { type: 'image/png' }), 'house-001-cover.png');
    const upRes = await fetch(`${BASE}/api/properties/${propId}/images`, { method: 'POST', headers, body: fd });
    const upJson = await upRes.json();
    if (!upRes.ok) throw new Error(`Upload failed: ${upJson.message || JSON.stringify(upJson)}`);
    console.log('Upload response:', upJson.data);

    // replace image (index 0) with another file
    const img2Path = path.join(process.cwd(), 'public', 'images', 'demos', 'house-001-img2.svg');
    console.log('Replacing image 0 with', img2Path);
    const fd2 = new FormData();
    fd2.append('image', new Blob([await fs.promises.readFile(img2Path)], { type: 'image/png' }), 'house-001-img2.png');
    const repRes = await fetch(`${BASE}/api/properties/${propId}/images/0`, { method: 'POST', headers, body: fd2 });
    const repJson = await repRes.json();
    if (!repRes.ok) throw new Error(`Replace failed: ${repJson.message || JSON.stringify(repJson)}`);
    console.log('Replace response:', repJson.data);

    // delete image 0
    console.log('Deleting image 0');
    const delRes = await fetch(`${BASE}/api/properties/${propId}/images/0`, { method: 'DELETE', headers });
    const delJson = await delRes.json();
    if (!delRes.ok) throw new Error(`Delete failed: ${delJson.message || JSON.stringify(delJson)}`);
    console.log('Delete response:', delJson.data);

    // cleanup: delete property
    console.log('Cleaning up: deleting property');
    const delPropRes = await fetch(`${BASE}/api/properties/${propId}`, { method: 'DELETE', headers });
    const delPropJson = await delPropRes.json();
    console.log('Property delete response:', delPropJson.success ? 'ok' : delPropJson);

    console.log('All tests completed successfully.');
  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 2;
  }
}

run();
