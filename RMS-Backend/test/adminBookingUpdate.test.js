import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDatabase, connectDatabase } from '../src/config/database.js';
import Booking from '../src/models/Booking.js';
import { updateBooking } from '../src/controllers/bookingController.js';

await connectDatabase({ ephemeral: true });

after(async () => {
  await closeDatabase();
});

test('admin booking edits persist allowed fields without overwriting private fields', async () => {
  const existing = await Booking.create({
    customerName: 'Original renter',
    customerPhone: '03000000000',
    propertyName: 'House A',
    amount: 50000,
    cnic: 'private-cnic',
    bookingStatus: 'Pending',
    status: 'Pending',
  });
  const response = {};
  response.status = (code) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body) => {
    response.body = body;
    return response;
  };

  await updateBooking({
    params: { id: existing._id.toString() },
    body: {
      customerName: 'Updated renter',
      propertyName: 'House B',
      amount: 60000,
      bookingStatus: 'Pending',
      cnic: 'attempted-change',
    },
  }, response);

  assert.equal(response.body.success, true);
  const updated = await Booking.findById(existing._id).lean();
  assert.equal(updated.customerName, 'Updated renter');
  assert.equal(updated.propertyName, 'House B');
  assert.equal(updated.amount, 60000);
  assert.equal(updated.cnic, 'private-cnic');
});
