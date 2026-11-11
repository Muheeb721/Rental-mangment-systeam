import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDatabase, connectDatabase } from '../src/config/database.js';
import Property from '../src/models/Property.js';
import { updateProperty } from '../src/controllers/propertyController.js';

await connectDatabase({ ephemeral: true });

after(async () => {
  await closeDatabase();
});

test('editing a rental listing synchronizes monthly rent and preserves its images', async () => {
  const image = 'data:image/svg+xml,keep-this-cover';
  const property = await Property.create({
    title: 'Existing rental house',
    propertyType: 'House',
    type: 'House',
    category: 'House',
    listingType: 'rent',
    transactionType: 'Rent',
    purpose: 'Rent',
    price: 80000,
    rent: 80000,
    salePrice: 0,
    image,
    images: [{ url: image, public_id: '' }],
    featuredImage: { url: image, public_id: '' },
  });
  const response = {};
  response.status = (code) => {
    response.code = code;
    return response;
  };
  response.json = (payload) => {
    response.payload = payload;
    return response;
  };

  await updateProperty({
    params: { id: property._id.toString() },
    body: { title: 'Updated rental house', propertyType: 'House', type: 'House', category: 'House', price: 95000 },
  }, response);

  assert.equal(response.code, undefined);
  assert.equal(response.payload.success, true);
  const updated = await Property.findById(property._id).lean();
  assert.equal(updated.price, 95000);
  assert.equal(updated.rent, 95000);
  assert.equal(updated.salePrice, 0);
  assert.equal(updated.listingType, 'rent');
  assert.equal(updated.image, image);
  assert.equal(updated.images[0].url, image);
});
