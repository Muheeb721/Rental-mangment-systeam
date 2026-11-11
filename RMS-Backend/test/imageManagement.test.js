import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePropertyImages } from '../src/models/Property.js';

const makeRes = () => {
  const res = {};
  res.status = (code) => {
    res.code = code;
    return res;
  };
  res.json = (payload) => {
    res.payload = payload;
    return res;
  };
  return res;
};

test('image management catalog seeds and exposes category buckets', async () => {
  const imageController = await import('../src/controllers/imageController.js');

  const res = makeRes();
  await imageController.seedImageCatalogIfMissing();
  await imageController.listImageAssets({ query: {} }, res);

  assert.equal(res.code || 200, 200);
  assert.equal(res.payload.success, true);
  assert.ok(Array.isArray(res.payload.data));
  assert.ok(res.payload.data.length >= 1);

  const categorized = await imageController.getImagesByCategory('HOME');
  assert.ok(Array.isArray(categorized));
});

test('property image normalization converts legacy strings to object metadata', () => {
  const normalized = normalizePropertyImages(
    ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
    'https://example.com/one.jpg'
  );

  assert.equal(Array.isArray(normalized.images), true);
  assert.equal(normalized.images[0].url, 'https://example.com/one.jpg');
  assert.equal(normalized.image, 'https://example.com/one.jpg');
  assert.equal(normalized.featuredImage.url, 'https://example.com/one.jpg');
});
