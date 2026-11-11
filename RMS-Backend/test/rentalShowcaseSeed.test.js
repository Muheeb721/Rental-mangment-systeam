import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDatabase, connectDatabase } from '../src/config/database.js';
import Property from '../src/models/Property.js';
import { ensureRentalShowcaseProperties } from '../scripts/seed-rental-showcase.js';

await connectDatabase({ ephemeral: true });

after(async () => {
  await closeDatabase();
});

test('rental showcase seeder tops up each category without replacing existing properties', async () => {
  const existingHouse = await Property.create({
    title: 'Keep this house',
    propertyType: 'House',
    type: 'House',
    category: 'House',
    listingType: 'rent',
    transactionType: 'Rent',
    purpose: 'Rent',
    price: 90000,
    rent: 90000,
    images: [{ url: 'data:image/svg+xml,existing-house' }],
    image: 'data:image/svg+xml,existing-house',
  });
  await Property.create({
    title: 'Sale listing should not count',
    propertyType: 'Flat',
    type: 'Flat',
    category: 'Flat',
    listingType: 'sale',
    transactionType: 'Sale',
  });

  const seeded = await ensureRentalShowcaseProperties();
  assert.deepEqual(seeded.house, { existing: 1, created: 4 });
  assert.deepEqual(seeded.flat, { existing: 0, created: 5 });

  const houses = await Property.find({ propertyType: 'House', listingType: 'rent' }).lean();
  const flats = await Property.find({ propertyType: 'Flat', listingType: 'rent' }).lean();
  assert.equal(houses.length, 5);
  assert.equal(flats.length, 5);
  assert.ok(houses.some((property) => String(property._id) === String(existingHouse._id)));
  assert.equal(new Set(houses.map((property) => property.image)).size, 5);
  assert.equal(new Set(flats.map((property) => property.image)).size, 5);
  assert.ok([...houses, ...flats].every((property) => property.salePrice === 0));

  const secondRun = await ensureRentalShowcaseProperties();
  assert.deepEqual(secondRun.house, { existing: 5, created: 0 });
  assert.deepEqual(secondRun.flat, { existing: 5, created: 0 });
});
