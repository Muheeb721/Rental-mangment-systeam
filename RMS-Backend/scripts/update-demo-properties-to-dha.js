#!/usr/bin/env node
import 'dotenv/config';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import Property from '../src/models/Property.js';

const dhaLocations = [
  { phase: 'DHA Phase 1', block: 'H Block', latitude: 31.4686, longitude: 74.4081, street: 'Street 12' },
  { phase: 'DHA Phase 2', block: 'C Block', latitude: 31.4608, longitude: 74.4126, street: 'Street 8' },
  { phase: 'DHA Phase 3', block: 'Y Block', latitude: 31.4518, longitude: 74.4045, street: 'Street 19' },
  { phase: 'DHA Phase 4', block: 'M Block', latitude: 31.4475, longitude: 74.4149, street: 'Street 6' },
  { phase: 'DHA Phase 5', block: 'K Block', latitude: 31.4578, longitude: 74.3969, street: 'Street 15' },
  { phase: 'DHA Phase 6', block: 'R Block', latitude: 31.4692, longitude: 74.3927, street: 'Street 10' },
  { phase: 'DHA Phase 6', block: 'S Block', latitude: 31.4649, longitude: 74.3878, street: 'Street 22' },
  { phase: 'DHA Phase 7', block: 'B Block', latitude: 31.4877, longitude: 74.3903, street: 'Street 4' },
  { phase: 'DHA Phase 8', block: 'E Block', latitude: 31.4978, longitude: 74.4191, street: 'Street 17' },
  { phase: 'DHA Phase 8', block: 'H Block', latitude: 31.4906, longitude: 74.4282, street: 'Street 9' },
];

const categoryLabels = {
  House: 'House',
  Apartment: 'Apartment',
  Flat: 'Flat',
};

async function run() {
  await connectDatabase();

  const demoProperties = await Property.find({ ownerId: 'demo-seed' })
    .sort({ propertyType: 1, createdAt: 1, _id: 1 });

  let updated = 0;

  for (let index = 0; index < demoProperties.length; index += 1) {
    const property = demoProperties[index];
    const location = dhaLocations[index % dhaLocations.length];
    const type = categoryLabels[property.propertyType] || property.type || 'Property';

    property.title = `${type} for Sale in ${location.phase}, DHA Lahore`;
    property.description =
      `A well-maintained ${type.toLowerCase()} in ${location.block}, ${location.phase}, DHA Lahore, with convenient access to parks, schools, and commercial areas.`;
    property.location = location.phase;
    property.city = 'Lahore';
    property.phase = location.phase;
    property.block = location.block;
    property.address =
      `${((index % 30) + 1) * 3} ${location.street}, ${location.block}, ${location.phase}, DHA Lahore`;
    property.latitude = location.latitude;
    property.longitude = location.longitude;
    property.updatedAt = new Date();

    await property.save();
    updated += 1;
  }

  console.log(`Updated ${updated} demo properties with DHA Lahore locations.`);
  await closeDatabase();
}

run().catch(async (error) => {
  console.error('DHA demo property update failed:', error);
  try {
    await closeDatabase();
  } catch {
    // Preserve the original migration error.
  }
  process.exitCode = 1;
});
