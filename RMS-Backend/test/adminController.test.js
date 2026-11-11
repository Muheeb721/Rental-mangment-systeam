import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyValues, normalizePropertyStatus, normalizePropertyType } from '../src/controllers/propertyController.js';
import { USER_ROLES, USER_STATUSES } from '../src/controllers/adminController.js';

test('property payload validation reports every missing required field', () => {
  const { errors } = buildPropertyValues({ title: 'abc' });
  assert.ok(errors.title);
  assert.ok(errors.price);
  assert.ok(errors.area);
  assert.ok(errors.address);
});

test('property payload normalises purpose, type, price mirrors and units', () => {
  const { values, errors } = buildPropertyValues({
    title: '10 Marla House for Sale', purpose: 'for sale', propertyType: 'villa', price: '45000000',
    city: 'Lahore', phase: 'DHA Phase 5', area: '10', areaUnit: 'marla', amenities: '["Lawn","Lawn","Car Porch"]', isFeatured: 'true',
  });
  assert.deepEqual(errors, {});
  assert.equal(values.purpose, 'Sale');
  assert.equal(values.listingType, 'sale');
  assert.equal(values.propertyType, 'House');
  assert.equal(values.salePrice, 45000000);
  assert.equal(values.rent, 0);
  assert.equal(values.areaUnit, 'Marla');
  assert.deepEqual(values.amenities, ['Lawn', 'Car Porch']);
  assert.equal(values.isFeatured, true);
});

test('area sent as text with a unit ("1 Kanal") is split into number + unit', () => {
  const { values, errors } = buildPropertyValues({ title: 'Kanal House for Rent', propertyType: 'House', price: 1, city: 'Lahore', phase: 'X', area: '1 Kanal' });
  assert.deepEqual(errors, {});
  assert.equal(values.area, 1);
  assert.equal(values.areaUnit, 'Kanal');
});

test('status and type aliases map to canonical values', () => {
  assert.equal(normalizePropertyStatus('For Rent'), 'Available');
  assert.equal(normalizePropertyStatus('occupied'), 'Rented');
  assert.equal(normalizePropertyType('shop'), 'Commercial');
  assert.ok(USER_ROLES.includes('admin'));
  assert.deepEqual(USER_STATUSES, ['Active', 'Blocked']);
});
