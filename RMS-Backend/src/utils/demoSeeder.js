import Property, { applyLocationDefaults } from '../models/Property.js';
import Area from '../models/Area.js';
import { LAHORE_AREAS } from '../data/lahorePlaces.js';
import Tenant from '../models/Tenant.js';
import RentPayment from '../models/RentPayment.js';
import { buildDemoCatalog, DEMO_OWNER_IDS } from './demoCatalog.js';

const isPlaceholderImage = (url) => typeof url === 'string' && (url.startsWith('data:image/svg') || url.includes('source.unsplash.com'));

/**
 * Idempotent demo seeding.
 *  - Creates any catalog listing that does not exist yet (matched by seedKey).
 *  - Converts legacy demo listings (old generated SVG placeholders) into catalog listings in place,
 *    keeping their _id so existing bookings/tenants keep working.
 *  - With { reset: true } every catalog listing is rewritten to the catalog values (admin edits lost).
 * Set SEED_DEMO_DATA=false to disable seeding on server start.
 */
export async function seedDemoProperties({ reset = false, log = console.log } = {}) {
  const catalog = buildDemoCatalog();
  const result = { created: 0, converted: 0, reset: 0, removed: 0, kept: 0 };

  const existingKeyed = await Property.find({ seedKey: { $in: catalog.map((item) => item.seedKey) } }).select('seedKey').lean();
  const keyed = new Set(existingKeyed.map((item) => item.seedKey));

  // legacy demo listings without a seedKey (from the old seeders) or still using placeholder art
  // (listings an admin already gave real photos are left untouched)
  const legacy = await Property.find({
    seedKey: { $exists: false },
    $or: [
      { 'images.url': { $regex: '^data:image/svg' } },
      { image: { $regex: '^data:image/svg' } },
      { ownerId: { $in: DEMO_OWNER_IDS }, 'images.url': { $regex: 'source\.unsplash\.com' } },
    ],
  }).sort({ createdAt: 1 });

  for (const entry of catalog) {
    if (keyed.has(entry.seedKey)) {
      if (reset) {
        // keep the live status (a listing may be Booked/Rented by a real booking)
        const { status: _status, availability: _availability, ...catalogFields } = entry;
        await Property.updateOne({ seedKey: entry.seedKey }, { $set: { ...catalogFields, updatedAt: new Date() } });
        result.reset += 1;
      } else {
        result.kept += 1;
      }
      continue;
    }
    const target = legacy.shift();
    if (target) {
      target.set({ ...entry, status: ['Booked', 'Rented'].includes(target.status) ? target.status : 'Available', updatedAt: new Date() });
      target.availability = target.status;
      await target.save();
      result.converted += 1;
    } else {
      await Property.create({ ...entry, updatedAt: new Date() });
      result.created += 1;
    }
  }

  // any remaining legacy placeholder listings: drop them (they are generated demo data)
  for (const leftover of legacy) {
    await Property.deleteOne({ _id: leftover._id });
    result.removed += 1;
  }

  // safety net: no listing should still show a generated placeholder
  const placeholders = await Property.find({ $or: [{ 'images.url': { $regex: '^data:image/svg' } }, { image: { $regex: '^data:image/svg' } }] });
  for (const property of placeholders) {
    property.images = property.images.filter((image) => !isPlaceholderImage(image.url));
    if (isPlaceholderImage(property.image)) property.image = '';
    if (isPlaceholderImage(property.featuredImage?.url)) property.featuredImage = { url: '', public_id: '' };
    await property.save();
  }

  log(`Demo seeder: ${result.created} created, ${result.converted} converted, ${result.reset} reset, ${result.kept} kept, ${result.removed} removed`);
  return result;
}

/** Sample tenants with six months of rent history (only when no tenants exist yet). */
export async function seedDemoTenants({ log = console.log } = {}) {
  if (await Tenant.countDocuments({})) return 0;
  const rentals = await Property.find({ seedKey: { $exists: true }, purpose: 'Rent', propertyType: { $in: ['House', 'Apartment', 'Flat'] } }).limit(3).lean();
  if (!rentals.length) return 0;
  const people = [
    { name: 'Ali Khan', email: 'ali.khan@example.com', phone: '+923001111111' },
    { name: 'Sara Ahmed', email: 'sara.ahmed@example.com', phone: '+923002222222' },
    { name: 'Bilal Hussain', email: 'bilal.h@example.com', phone: '+923003333333' },
  ];
  const now = new Date();
  for (let i = 0; i < Math.min(people.length, rentals.length); i += 1) {
    const property = rentals[i];
    const tenant = await Tenant.create({
      ...people[i],
      propertyId: String(property._id),
      hostelId: String(property._id),
      monthlyRent: property.rent || property.price,
      securityDeposit: property.rent || property.price,
      dueDay: 5,
      moveInDate: new Date(now.getFullYear(), now.getMonth() - 6, 1),
      status: 'active',
    });
    for (let m = 5; m >= 0; m -= 1) {
      const month = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const dueDate = new Date(month.getFullYear(), month.getMonth(), 5);
      const pattern = (i + m) % 4;
      const paid = m === 0 ? 0 : pattern === 3 ? Math.round(tenant.monthlyRent / 2) : tenant.monthlyRent;
      await RentPayment.create({
        tenantId: tenant._id,
        month: monthKey,
        amountDue: tenant.monthlyRent,
        amountPaid: paid,
        dueDate,
        paidDate: paid ? new Date(dueDate.getTime() + pattern * 86400000) : null,
        status: m === 0 ? 'pending' : pattern === 3 ? 'partial' : pattern === 2 ? 'late' : 'on_time',
        lateDays: pattern === 2 ? 2 : 0,
        lateFee: pattern === 2 ? 200 : 0,
        method: paid ? 'bank' : 'cash',
      });
    }
  }
  log('Demo seeder: created sample tenants with rent history');
  return rentals.length;
}

/** Called on server start. */
export async function seedDemoIfMissing() {
  // reference data + location backfill run even when demo listings are disabled
  try {
    await seedLahoreAreas();
  } catch (error) {
    console.error('Area seeder error', error);
  }
  if (process.env.SEED_DEMO_DATA === 'false') {
    await backfillPropertyLocations().catch((error) => console.error('Location backfill error', error));
    return false;
  }
  try {
    await seedDemoProperties();
    await seedDemoTenants();
    await seedDemoExtras();
    await backfillPropertyLocations();
    return true;
  } catch (error) {
    console.error('Demo seeder error', error);
    return false;
  }
}

/** A few approved reviews and the DHA / Askari areas (only when those collections are empty). */
export async function seedDemoExtras({ log = console.log } = {}) {
  const { default: Review } = await import('../models/Review.js');
  const { default: Area } = await import('../models/Area.js');
  let created = 0;
  if (!(await Review.countDocuments({}))) {
    const picks = await Property.find({ seedKey: { $exists: true }, purpose: 'Rent' }).sort({ createdAt: -1 }).limit(6).lean();
    const samples = [
      ['Hamza Riaz', 5, 'Exactly as shown in the photos. The owner was responsive and the move-in was smooth.'],
      ['Fatima Noor', 4, 'Very peaceful block with a park nearby. Water pressure could be better but overall great value.'],
      ['Usman Tariq', 5, 'Booked through RMS in two days. Clean house, secure area and helpful management.'],
      ['Ayesha Malik', 4, 'Good location close to the commercial area. Maintenance requests were handled quickly.'],
      ['Bilal Ahmed', 5, 'Spacious rooms and proper parking. Rent and dues are easy to track online.'],
      ['Sana Iqbal', 3, 'Nice apartment, though the lift was under maintenance for a week when we moved in.'],
    ];
    const docs = picks.map((property, index) => ({
      userName: samples[index][0], rating: samples[index][1], comment: samples[index][2],
      propertyId: String(property._id), propertyName: property.title, status: 'Approved',
      createdAt: new Date(Date.now() - (index + 2) * 3 * 86400000),
    }));
    if (docs.length) await Review.insertMany(docs);
    created += docs.length;
  }
  if (!(await Area.countDocuments({}))) {
    const areas = ['DHA Phase 1', 'DHA Phase 2', 'DHA Phase 3', 'DHA Phase 4', 'DHA Phase 5', 'DHA Phase 6', 'DHA Phase 7', 'DHA Phase 8', 'Askari 10', 'Askari 11']
      .map((name, index) => ({ name, city: 'Lahore', phase: name, displayOrder: index + 1, active: true }));
    await Area.insertMany(areas);
    created += areas.length;
  }
  if (created) log(`Demo seeder: added ${created} sample reviews/areas`);
  return created;
}

/**
 * Upsert every Lahore area from src/data/lahorePlaces.js into the Area collection (matched by slug,
 * or by name for the older DHA/Askari rows). Admin-controlled fields (name, active, displayOrder)
 * of existing rows are left alone.
 */
export async function seedLahoreAreas({ log = console.log } = {}) {
  const existing = await Area.find({}).select('name slug').lean();
  const bySlug = new Map(existing.filter((a) => a.slug).map((a) => [a.slug, a]));
  const byName = new Map(existing.filter((a) => !a.slug).map((a) => [String(a.name).trim().toLowerCase(), a]));
  const ops = [];
  let created = 0;
  let updated = 0;
  for (const area of LAHORE_AREAS) {
    const data = {
      slug: area.slug,
      aliases: area.aliases,
      parent: area.parent,
      subdivisions: area.subdivisions,
      tier: area.tier,
      description: area.description,
      latitude: area.lat,
      longitude: area.lng,
      center: { lat: area.lat, lng: area.lng },
      city: 'Lahore',
    };
    const match = bySlug.get(area.slug) || byName.get(area.name.toLowerCase());
    if (match) {
      ops.push({ updateOne: { filter: { _id: match._id }, update: { $set: data } } });
      updated += 1;
    } else {
      ops.push({ insertOne: { document: { ...data, name: area.name, phase: area.parent ? area.name : '', displayOrder: area.displayOrder, active: true, createdAt: new Date(), updatedAt: new Date() } } });
      created += 1;
    }
  }
  if (ops.length) await Area.bulkWrite(ops, { ordered: false });
  if (created) log(`Area seeder: ${created} Lahore areas created, ${updated} refreshed`);
  return { created, updated };
}

/** Give every listing an areaSlug and coordinates (area centre + offset, flagged locationApproximate). */
export async function backfillPropertyLocations({ log = console.log } = {}) {
  const docs = await Property.find({
    $or: [{ areaSlug: { $in: ['', null] } }, { areaSlug: { $exists: false } }, { latitude: null }, { longitude: null }],
  }).select('_id title phase society location address block areaSlug latitude longitude locationApproximate').lean();
  let changed = 0;
  for (const doc of docs) {
    const next = applyLocationDefaults({ ...doc });
    const $set = {};
    for (const key of ['areaSlug', 'latitude', 'longitude', 'locationApproximate']) {
      if (next[key] !== undefined && next[key] !== doc[key]) $set[key] = next[key];
    }
    if (Object.keys($set).length) {
      await Property.updateOne({ _id: doc._id }, { $set });
      changed += 1;
    }
  }
  if (changed) log(`Location backfill: updated ${changed} listings`);
  return changed;
}
