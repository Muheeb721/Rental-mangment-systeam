import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, closeDatabase } from '../src/config/database.js';

await connectDatabase({ ephemeral: true });

import Property from '../src/models/Property.js';
import { createProperty, deleteProperty, updateProperty } from '../src/controllers/propertyController.js';
import { addPropertyImages, deletePropertyImage, replacePropertyImage } from '../src/controllers/propertyController.js';
import { seedDemoIfMissing } from '../src/utils/demoSeeder.js';

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const uploadedFile = (name) => {
  const buffer = Buffer.from('test-image-content');
  return {
    originalname: name,
    mimetype: 'image/png',
    size: buffer.length,
    buffer,
  };
};

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../');

after(async () => {
  await closeDatabase();
});

test('property create, edit, image replace/delete, and property delete preserve image lifecycle', async () => {
  const createResponse = makeResponse();
  await createProperty({
    body: {
      title: 'Lifecycle Rental',
      propertyType: 'House',
      category: 'House',
      price: '90000',
      city: 'Lahore',
      location: 'DHA',
      phase: 'Phase 6',
      area: '10',
      areaUnit: 'Marla',
    },
    files: [uploadedFile('first.png'), uploadedFile('second.png')],
  }, createResponse);

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.payload.data;
  assert.equal(created.transactionType, 'Rent');
  assert.equal(created.rent, 90000);
  assert.equal(created.images.length, 2);
  const originalImages = created.images.map((image) => image.url);
  const uploadedPaths = originalImages.map((url) => path.join(backendRoot, 'public', url.replace(/^\//, '')));
  assert.ok(uploadedPaths.every((imagePath) => fs.existsSync(imagePath)));

  const updateResponse = makeResponse();
  await updateProperty({ params: { id: String(created._id) }, body: { title: 'Edited Rental' } }, updateResponse);
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.payload.data.title, 'Edited Rental');
  assert.deepEqual(updateResponse.payload.data.images.map((image) => image.url), originalImages);

  const replaceResponse = makeResponse();
  await replacePropertyImage({
    params: { id: String(created._id), imageId: '0' },
    file: uploadedFile('replacement.png'),
    user: { id: 'test-admin', name: 'Test Admin', role: 'admin' },
  }, replaceResponse);
  assert.equal(replaceResponse.statusCode, 200);
  assert.equal(replaceResponse.payload.data.images.length, 2);
  assert.notEqual(replaceResponse.payload.data.images[0].url, originalImages[0]);
  assert.equal(fs.existsSync(uploadedPaths[0]), false);
  assert.equal(fs.existsSync(uploadedPaths[1]), true);
  const replacementPath = path.join(backendRoot, 'public', replaceResponse.payload.data.images[0].url.replace(/^\//, ''));
  assert.equal(fs.existsSync(replacementPath), true);
  assert.equal(replaceResponse.payload.data.propertyType, 'House');
  assert.equal(replaceResponse.payload.data.images[1].url, originalImages[1]);
  assert.equal(replaceResponse.payload.data.image, replaceResponse.payload.data.images[0].url);

  const deleteImageResponse = makeResponse();
  await deletePropertyImage({
    params: { id: String(created._id), imageId: '1' },
    user: { id: 'test-admin', name: 'Test Admin', role: 'admin' },
  }, deleteImageResponse);
  assert.equal(deleteImageResponse.statusCode, 200);
  assert.equal(deleteImageResponse.payload.data.images.length, 1);
  assert.equal(fs.existsSync(uploadedPaths[1]), false);

  const deleteResponse = makeResponse();
  await deleteProperty({ params: { id: String(created._id) } }, deleteResponse);
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(await Property.findById(created._id), null);
  assert.equal(await Property.countDocuments({ title: 'Edited Rental' }), 0);
});

test('demo seeding preserves existing rental listings instead of replacing their records', async () => {
  const property = await Property.create({
    title: 'Admin-edited demo listing',
    propertyType: 'House',
    ownerId: 'demo-seed',
    images: [{ url: '/uploads/properties/kept-image.png' }],
    image: '/uploads/properties/kept-image.png',
  });

  await seedDemoIfMissing();
  const seeded = await Property.countDocuments({ seedKey: { $exists: true } });
  await seedDemoIfMissing(); // idempotent

  const retained = await Property.findById(property._id).lean();
  assert.ok(retained);
  assert.equal(retained.title, 'Admin-edited demo listing');
  assert.equal(retained.images[0].url, '/uploads/properties/kept-image.png');
  assert.ok(seeded >= 30);
  assert.equal(await Property.countDocuments({ seedKey: { $exists: true } }), seeded);
  const sample = await Property.findOne({ seedKey: { $exists: true } }).lean();
  assert.ok(sample.images.length >= 1 && sample.images.every((image) => image.url.startsWith('/images/demo-photos/')));
});

test('adding an image appends it without changing the existing property cover', async () => {
  const property = await Property.create({
    title: 'Stable cover rental',
    propertyType: 'House',
    category: 'House',
    image: '/images/house-cover.png',
    images: [
      { url: '/images/house-cover.png' },
      { url: '/images/house-interior.png' },
    ],
  });
  const uploadResponse = makeResponse();

  await addPropertyImages({
    params: { id: String(property._id) },
    files: { images: [uploadedFile('gallery.png')] },
    user: { id: 'test-admin', name: 'Test Admin', role: 'admin' },
  }, uploadResponse);

  assert.equal(uploadResponse.statusCode, 201);
  assert.equal(uploadResponse.payload.data.image, '/images/house-cover.png');
  assert.deepEqual(
    uploadResponse.payload.data.images.slice(0, 2).map((image) => image.url),
    ['/images/house-cover.png', '/images/house-interior.png'],
  );
  assert.equal(uploadResponse.payload.data.images.length, 3);

  const deleteResponse = makeResponse();
  await deletePropertyImage({
    params: { id: String(property._id), imageId: '2' },
    user: { id: 'test-admin', name: 'Test Admin', role: 'admin' },
  }, deleteResponse);
  assert.equal(deleteResponse.payload.data.image, '/images/house-cover.png');
  await Property.findByIdAndDelete(property._id);
});
