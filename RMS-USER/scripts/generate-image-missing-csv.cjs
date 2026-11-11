#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMAGES_ROOT = path.join(ROOT, 'public', 'images');

const categories = ['houses', 'apartments', 'flats', 'hostels', 'rooms', 'properties'];
const desiredCountMap = { houses: 8, apartments: 6, flats: 6, hostels: 6, rooms: 5, properties: 6 };
const isImage = (name) => /\.(jpe?g|png|webp)$/i.test(name);

const collect = () => {
  const rows = [];
  for (const cat of categories) {
    const folder = path.join(IMAGES_ROOT, cat);
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) continue;
    const files = fs.readdirSync(folder).filter(isImage);
    const perId = {};
    for (const file of files) {
      const m = file.match(/^(\d+)-(\d+)\.(jpe?g|png|webp)$/i);
      if (!m) continue;
      const id = m[1];
      const idx = Number(m[2]);
      if (!perId[id]) perId[id] = new Set();
      perId[id].add(idx);
    }

    const desired = desiredCountMap[cat] || 6;
    for (const [id, setIdx] of Object.entries(perId)) {
      const missing = [];
      for (let i = 1; i <= desired; i++) if (!setIdx.has(i)) missing.push(i);
      rows.push({ category: cat, propertyId: id, presentCount: setIdx.size, recommendedCount: desired, missingIndices: missing.join(';') });
    }
  }
  return rows;
};

const writeCsv = (rows) => {
  const outPath = path.join(__dirname, 'image-missing-report.csv');
  const header = 'category,propertyId,presentCount,recommendedCount,missingIndices\n';
  const lines = rows.map(r => `${r.category},${r.propertyId},${r.presentCount},${r.recommendedCount},"${r.missingIndices}"`).join('\n');
  fs.writeFileSync(outPath, header + lines, 'utf8');
  return outPath;
};

if (require.main === module) {
  const rows = collect();
  if (!rows.length) {
    console.log('No property image data found to report.');
    process.exit(0);
  }
  const out = writeCsv(rows);
  console.log('CSV report written to', out);
}

module.exports = { collect, writeCsv };
