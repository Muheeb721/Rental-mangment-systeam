import mongoose from 'mongoose';
import Property from '../models/Property.js';
import ImageAsset from '../models/ImageAsset.js';

const IMAGE_CATEGORIES = ['HOME', 'HOUSE', 'FLAT', 'APARTMENT', 'PROPERTY', 'DEMO', 'OTHER'];
const memoryImageCatalog = [];

const normalizeCategory = (value) => {
  const key = String(value || '').trim().toUpperCase();
  return IMAGE_CATEGORIES.includes(key) ? key : 'OTHER';
};

const isValidImageUrl = (value) => {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('/')) return true;
  if (value.startsWith('data:image/')) return true;
  if (value.startsWith('blob:')) return true;

  try {
    new URL(value);
    return true;
  } catch (error) {
    return false;
  }
};

const fallbackCatalog = {
  HOME: [
    { title: 'Home Hero Image', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', page: 'Home Page', section: 'Hero' },
    { title: 'Home Feature Banner', imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80', page: 'Home Page', section: 'Feature Banner' },
    { title: 'Home Showcase', imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', page: 'Home Page', section: 'Showcase' },
    { title: 'Home Houses', imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80', page: 'Home Page', section: 'Houses' },
    { title: 'Home Flats', imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', page: 'Home Page', section: 'Flats' },
    { title: 'Home Apartments', imageUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80', page: 'Home Page', section: 'Apartments' },
  ],
  HOUSE: [
    { title: 'House Cover 1', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Cover' },
    { title: 'House Exterior 2', imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
    { title: 'House Exterior 3', imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
    { title: 'House Exterior 4', imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
    { title: 'House Exterior 5', imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
    { title: 'House Exterior 6', imageUrl: 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
    { title: 'House Exterior 7', imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
    { title: 'House Exterior 8', imageUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
    { title: 'House Exterior 9', imageUrl: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
    { title: 'House Exterior 10', imageUrl: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80', page: 'Houses', section: 'Exterior' },
  ],
  FLAT: [
    { title: 'Flat Interior 1', imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 2', imageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 3', imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 4', imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 5', imageUrl: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 6', imageUrl: 'https://images.unsplash.com/photo-1502005229762-ee1b2b93e0f5?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 7', imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 8', imageUrl: 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 9', imageUrl: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
    { title: 'Flat Interior 10', imageUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80', page: 'Flats', section: 'Interior' },
  ],
  APARTMENT: [
    { title: 'Apartment Building 1', imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 2', imageUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 3', imageUrl: 'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 4', imageUrl: 'https://images.unsplash.com/photo-1515263487990-61b07816b324?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 5', imageUrl: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 6', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 7', imageUrl: 'https://images.unsplash.com/photo-1502005096674-719299666c97?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 8', imageUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 9', imageUrl: 'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
    { title: 'Apartment Building 10', imageUrl: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80', page: 'Apartments', section: 'Building' },
  ],
  PROPERTY: [
    { title: 'Property Gallery 1', imageUrl: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80', page: 'Properties', section: 'Gallery' },
    { title: 'Property Gallery 2', imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80', page: 'Properties', section: 'Gallery' },
    { title: 'Property Gallery 3', imageUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80', page: 'Properties', section: 'Gallery' },
    { title: 'Property Detail Gallery', imageUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80', page: 'Property Details', section: 'Gallery' },
  ],
  DEMO: [
    { title: 'House Demo Cover', imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', page: 'House Demo', section: 'Hero' },
    { title: 'Flat Demo Cover', imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', page: 'Flats Demo', section: 'Hero' },
    { title: 'Apartment Demo Cover', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', page: 'Apartments Demo', section: 'Hero' },
    { title: 'Rooms Demo Cover', imageUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80', page: 'Rooms Demo', section: 'Hero' },
    { title: 'About Hero', imageUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1400&q=80', page: 'About Page', section: 'Hero' },
    { title: 'About Community', imageUrl: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80', page: 'About Page', section: 'Community' },
    { title: 'Contact Hero', imageUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80', page: 'Contact Page', section: 'Hero' },
    { title: 'Services Hero', imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=80', page: 'Services Page', section: 'Hero' },
    { title: 'House Service Card', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', page: 'Services Page', section: 'House' },
    { title: 'Apartment Service Card', imageUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80', page: 'Services Page', section: 'Apartment' },
    { title: 'Hostel Service Card', imageUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80', page: 'Services Page', section: 'Hostel' },
    { title: 'Login Hero', imageUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1400&q=80', page: 'Login Page', section: 'Hero' },
    { title: 'Profile Banner', imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', page: 'Profile Page', section: 'Banner' },
  ],
};

const buildSeedAssets = async () => {
  const assets = [];

  if (mongoose.connection.readyState !== 1) {
    const categoriesToSeed = Object.entries(fallbackCatalog);
    for (const [category, items] of categoriesToSeed) {
      items.forEach((item, index) => {
        assets.push({
          _id: `${category}-${index}`,
          title: item.title,
          imageUrl: item.imageUrl,
          category,
          page: item.page,
          section: item.section,
          propertyId: '',
          propertyType: category,
          displayOrder: index,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    }
    return assets;
  }

  const properties = await Property.find({}).lean();

  for (const property of properties) {
    const propertyType = String(property.propertyType || property.type || property.category || 'PROPERTY').trim();
    const category = normalizeCategory(propertyType);
    const images = Array.isArray(property.images) && property.images.length
      ? property.images
      : property.image
        ? [property.image]
        : [];

    images.forEach((imageUrl, index) => {
      if (!imageUrl) return;
      assets.push({
        _id: `${property._id || property.id || 'prop'}-${index}`,
        title: property.title || `${propertyType} Property`,
        imageUrl,
        category,
        page: propertyType === 'House' ? 'Houses' : propertyType === 'Flat' ? 'Flats' : propertyType === 'Apartment' ? 'Apartments' : 'Properties',
        section: category === 'HOME' ? 'Hero' : 'Gallery',
        propertyId: String(property._id || property.id || ''),
        propertyType,
        displayOrder: index,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }

  const categoriesToSeed = Object.entries(fallbackCatalog);
  for (const [category, items] of categoriesToSeed) {
    for (const item of items) {
      const alreadyExists = assets.some((asset) => asset.category === category && asset.imageUrl === item.imageUrl);
      if (!alreadyExists) {
        assets.push({
          _id: `${category}-${assets.filter((asset) => asset.category === category).length}`,
          title: item.title,
          imageUrl: item.imageUrl,
          category,
          page: item.page,
          section: item.section,
          propertyId: '',
          propertyType: category,
          displayOrder: assets.filter((asset) => asset.category === category).length,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  return assets;
};

export const seedImageCatalogIfMissing = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (memoryImageCatalog.length === 0) {
        const seeded = await buildSeedAssets();
        memoryImageCatalog.push(...seeded);
      }
      return [...memoryImageCatalog];
    }

    const existing = await ImageAsset.countDocuments();
    if (existing > 0) return [];

    const assets = await buildSeedAssets();
    if (assets.length) {
      await ImageAsset.insertMany(assets);
    }

    return assets;
  } catch (error) {
    if (memoryImageCatalog.length === 0) {
      const seeded = await buildSeedAssets().catch(() => []);
      memoryImageCatalog.push(...seeded);
    }
    return [...memoryImageCatalog];
  }
};

const getStoredImageItems = async (filter = {}) => {
  await seedImageCatalogIfMissing();

  if (mongoose.connection.readyState !== 1) {
    const items = [...memoryImageCatalog].filter((item) => {
      let match = true;
      if (filter.category) match = match && item.category === filter.category;
      if (filter.propertyId) match = match && String(item.propertyId || '') === String(filter.propertyId);
      if (filter.isActive !== undefined) match = match && item.isActive === filter.isActive;
      if (filter.page) match = match && new RegExp(String(filter.page), 'i').test(String(item.page || ''));
      return match;
    });
    return items.sort((a, b) => (Number(a.displayOrder || 0) - Number(b.displayOrder || 0)) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  const items = await ImageAsset.find(filter).sort({ category: 1, displayOrder: 1, createdAt: -1 }).lean();
  return items;
};

export const getImagesByCategory = async (category = 'HOME') => {
  const normalized = normalizeCategory(category);
  const items = await getStoredImageItems({ category: normalized, isActive: true });
  return items;
};

export const listImageAssets = async (req, res) => {
  try {
    const filter = {};
    const { category, page, section, propertyId, isActive } = req.query || {};

    if (category) filter.category = normalizeCategory(category);
    if (page) filter.page = new RegExp(String(page), 'i');
    if (section) filter.section = new RegExp(String(section), 'i');
    if (propertyId) filter.propertyId = String(propertyId);
    if (isActive !== undefined) filter.isActive = String(isActive).toLowerCase() === 'true';

    const items = await getStoredImageItems(filter);
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('List image assets failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load image assets.' });
  }
};

export const createImageAsset = async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || 'Untitled Image').trim();
    const imageUrl = String(body.imageUrl || '').trim();
    const category = normalizeCategory(body.category || 'OTHER');

    if (!title || !imageUrl) {
      return res.status(400).json({ success: false, message: 'Image title and URL are required.' });
    }

    if (!isValidImageUrl(imageUrl)) {
      return res.status(400).json({ success: false, message: 'Image URL is invalid.' });
    }

    const item = {
      _id: body._id || `img-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      title,
      imageUrl,
      category,
      page: body.page || 'General',
      section: body.section || '',
      propertyId: body.propertyId || '',
      propertyType: body.propertyType || '',
      displayOrder: Number(body.displayOrder || 0),
      isActive: body.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (mongoose.connection.readyState === 1) {
      const created = await ImageAsset.create(item);
      return res.status(201).json({ success: true, data: created.toObject ? created.toObject() : created });
    }

    memoryImageCatalog.push(item);
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Create image asset failed', error);
    return res.status(500).json({ success: false, message: 'Unable to save image asset.' });
  }
};

export const updateImageAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...(req.body || {}) };
    if (updates.title !== undefined) updates.title = String(updates.title).trim();
    if (updates.imageUrl !== undefined) {
      const nextUrl = String(updates.imageUrl).trim();
      if (!isValidImageUrl(nextUrl)) {
        return res.status(400).json({ success: false, message: 'Image URL is invalid.' });
      }
      updates.imageUrl = nextUrl;
    }
    if (updates.category) updates.category = normalizeCategory(updates.category);
    updates.updatedAt = new Date();

    if (mongoose.connection.readyState === 1) {
      const item = await ImageAsset.findByIdAndUpdate(id, updates, { new: true }).lean();
      if (!item) return res.status(404).json({ success: false, message: 'Image not found.' });
      return res.json({ success: true, data: item });
    }

    const index = memoryImageCatalog.findIndex((item) => String(item._id) === String(id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Image not found.' });

    const merged = { ...memoryImageCatalog[index], ...updates };
    memoryImageCatalog[index] = merged;
    return res.json({ success: true, data: merged });
  } catch (error) {
    console.error('Update image asset failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update image asset.' });
  }
};

export const deleteImageAsset = async (req, res) => {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      const item = await ImageAsset.findByIdAndDelete(id).lean();
      if (!item) return res.status(404).json({ success: false, message: 'Image not found.' });
      return res.json({ success: true, data: item });
    }

    const index = memoryImageCatalog.findIndex((item) => String(item._id) === String(id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Image not found.' });

    const [removed] = memoryImageCatalog.splice(index, 1);
    return res.json({ success: true, data: removed });
  } catch (error) {
    console.error('Delete image asset failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete image asset.' });
  }
};
