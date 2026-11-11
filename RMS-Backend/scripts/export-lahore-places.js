// Writes public/data/lahore-places.json from src/data/lahorePlaces.js (served at /data/lahore-places.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAHORE_AREAS, LAHORE_LANDMARKS, TIERS, LANDMARK_CATEGORIES } from '../src/data/lahorePlaces.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'data', 'lahore-places.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
const payload = {
  city: 'Lahore',
  note: 'Approximate centre coordinates for distance / travel estimates only.',
  generatedAt: new Date().toISOString(),
  tiers: TIERS,
  categories: LANDMARK_CATEGORIES,
  counts: { areas: LAHORE_AREAS.length, landmarks: LAHORE_LANDMARKS.length },
  areas: LAHORE_AREAS,
  landmarks: LAHORE_LANDMARKS,
};
fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${out} (${LAHORE_AREAS.length} areas, ${LAHORE_LANDMARKS.length} landmarks)`);
