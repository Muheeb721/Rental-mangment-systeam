#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const IMAGES_ROOT = path.join(ROOT, 'public', 'images');

const categories = ['houses', 'apartments', 'flats', 'hostels', 'rooms', 'properties', 'home'];

const desiredCountMap = {
  houses: 8,
  apartments: 6,
  flats: 6,
  hostels: 6,
  rooms: 5,
  properties: 6,
};

const isImage = (name) => /\.(jpe?g|png|webp)$/i.test(name);

const hashFile = (filePath) => {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
};

const run = () => {
  const summary = { totalFiles: 0, namingViolations: [], missingByCategory: {}, duplicates: {}, perCategory: {} };

  for (const cat of categories) {
    const folder = path.join(IMAGES_ROOT, cat);
    const exists = fs.existsSync(folder) && fs.statSync(folder).isDirectory();
    summary.perCategory[cat] = { exists, files: 0, ids: {} };
    summary.missingByCategory[cat] = [];
    if (!exists) continue;

    // recursively collect image files (support nested folders like home/*/...)
    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      const res = [];
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) res.push(...walk(full));
        else if (e.isFile() && isImage(e.name)) res.push(full);
      }
      return res;
    };

    const files = walk(folder);
    summary.perCategory[cat].files = files.length;
    summary.totalFiles += files.length;

    for (const full of files) {
      const file = path.basename(full);
      const hash = hashFile(full);

      // duplicates by content
      if (!summary.duplicates[hash]) summary.duplicates[hash] = [];
      summary.duplicates[hash].push(full);

      // For the special 'home' category we don't expect {id}-{index} naming.
      if (cat === 'home') {
        continue;
      }

      const m = file.match(/^(\d+)-(\d+)\.(jpe?g|png|webp)$/i);
      if (!m) {
        summary.namingViolations.push(full);
        continue;
      }
      const id = m[1];
      const idx = Number(m[2]);

      // per-id tracking
      if (!summary.perCategory[cat].ids[id]) summary.perCategory[cat].ids[id] = { files: [], indices: new Set() };
      summary.perCategory[cat].ids[id].files.push({ path: full, index: idx, hash });
      summary.perCategory[cat].ids[id].indices.add(idx);
    }

    // compute missing per id
    for (const id of Object.keys(summary.perCategory[cat].ids)) {
      const info = summary.perCategory[cat].ids[id];
      const desired = desiredCountMap[cat] || 6;
      const missing = [];
      for (let i = 1; i <= desired; i++) if (!info.indices.has(i)) missing.push(i);
      if (missing.length) summary.missingByCategory[cat].push({ id, missing });
    }
  }

  // filter duplicate groups with more than one path
  const dupGroups = Object.entries(summary.duplicates).filter(([, arr]) => arr.length > 1).map(([h, arr]) => ({ hash: h, paths: arr }));
  summary.duplicateGroups = dupGroups;

  // output a concise report
  console.log('\nImage Checker Report');
  console.log('====================');
  console.log(`Images root: ${IMAGES_ROOT}`);
  console.log(`Total image files scanned: ${summary.totalFiles}`);
  console.log('');

  if (summary.namingViolations.length) {
    console.log('Files with invalid naming (expected {id}-{index}.jpg):');
    summary.namingViolations.forEach((p) => console.log('  -', p));
    console.log('');
  }

  for (const cat of categories) {
    if (!summary.perCategory[cat].exists) {
      console.log(`Category folder missing: /images/${cat} (no folder)`);
      continue;
    }
    console.log(`Category: ${cat} — ${summary.perCategory[cat].files} files`);
    if (summary.missingByCategory[cat].length) {
      console.log('  Properties with missing image indices (recommended count: ' + (desiredCountMap[cat] || 6) + '):');
      summary.missingByCategory[cat].forEach((m) => console.log(`    - id ${m.id}: missing indices ${m.missing.join(', ')}`));
    }
  }

  if (summary.duplicateGroups.length) {
    console.log('\nPotential duplicate images (identical content found in multiple paths):');
    summary.duplicateGroups.forEach((g) => {
      console.log(`  - Hash ${g.hash}:`);
      g.paths.forEach((p) => console.log('      ', p));
    });
  } else {
    console.log('\nNo duplicate image files detected by content hash.');
  }

  console.log('\nQuick fixes:');
  console.log(' - Add missing files for each property using the naming convention {id}-{index}.jpg');
  console.log(' - Replace duplicate files with distinct ones if they represent different properties');
  console.log(' - For files flagged above, re-check the file format and naming');
  console.log('');
};

if (require.main === module) run();

module.exports = { run };
