import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDatabase, connectDatabase } from '../src/config/database.js';
import RentRecord from '../src/models/RentRecord.js';
import { createRentRecord, listRentRecords, updateRentRecord } from '../src/controllers/rentController.js';

await connectDatabase({ ephemeral: true });

after(async () => {
  await closeDatabase();
});

const makeResponse = () => {
  const response = {};
  response.status = (code) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body) => {
    response.body = body;
    return response;
  };
  return response;
};

test('admin rent generation persists the selected tenant and monthly rent', async () => {
  const response = makeResponse();
  await createRentRecord({
    user: { id: 'admin-1', name: 'Admin', role: 'admin' },
    body: {
      userId: 'tenant-1',
      userName: 'Rental Tenant',
      propertyId: 'property-1',
      propertyName: 'House 1',
      monthlyRent: 72000,
      paid: 0,
      month: '2026-09',
      status: 'Due',
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  const record = await RentRecord.findById(response.body.data._id).lean();
  assert.equal(record.userId, 'tenant-1');
  assert.equal(record.userName, 'Rental Tenant');
  assert.equal(record.monthlyRent, 72000);
});

test('admin rent list includes tenant records and payment updates persist', async () => {
  const record = await RentRecord.create({
    userId: 'tenant-2',
    userName: 'Another Tenant',
    monthlyRent: 50000,
    paid: 0,
    remaining: 50000,
    month: '2026-09',
  });
  const listResponse = makeResponse();
  await listRentRecords({ user: { id: 'admin-1', role: 'admin' } }, listResponse);
  assert.ok(listResponse.body.data.some((item) => item.userId === 'tenant-2'));

  const updateResponse = makeResponse();
  await updateRentRecord({
    params: { id: record._id.toString() },
    body: { paid: 20000, remaining: 30000, status: 'Partial' },
  }, updateResponse);
  assert.equal(updateResponse.body.success, true);
  const updated = await RentRecord.findById(record._id).lean();
  assert.equal(updated.paid, 20000);
  assert.equal(updated.remaining, 30000);
  assert.equal(updated.status, 'Partial');
});
