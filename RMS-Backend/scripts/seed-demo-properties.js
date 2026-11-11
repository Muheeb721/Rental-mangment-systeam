#!/usr/bin/env node
/**
 * Seeds realistic Lahore (DHA / Askari) demo listings with real photos.
 *
 *   node scripts/seed-demo-properties.js          # idempotent: create missing, convert old placeholder listings
 *   node scripts/seed-demo-properties.js --reset  # also rewrite every demo listing back to the catalog values
 *
 * Photos are served from public/images/demo-photos (see CREDITS.txt there).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { seedDemoProperties, seedDemoTenants } from '../src/utils/demoSeeder.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, '../.env') });

const reset = process.argv.includes('--reset');

try {
  await connectDatabase();
  const result = await seedDemoProperties({ reset });
  await seedDemoTenants();
  console.log('Done:', result);
  await closeDatabase();
  process.exit(0);
} catch (error) {
  console.error('Demo seeding failed:', error);
  process.exit(1);
}
