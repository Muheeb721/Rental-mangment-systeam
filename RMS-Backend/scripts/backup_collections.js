#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';

const outDir = path.join(process.cwd(), 'Backend', 'backups');

async function dumpCollections() {
  try {
    await connectDatabase();
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      try {
        const name = col.name;
        const docs = await mongoose.connection.db.collection(name).find({}).toArray();
        const filePath = path.join(outDir, `${name}-${Date.now()}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
        console.log(`Exported ${docs.length} docs from ${name} -> ${filePath}`);
      } catch (e) {
        console.warn(`Failed to export collection ${col.name}:`, e.message || e);
      }
    }

    console.log('Backup complete. Files created in', outDir);
  } catch (error) {
    console.error('Backup failed:', error?.message || error);
    process.exitCode = 2;
  } finally {
    await closeDatabase();
  }
}

dumpCollections();
