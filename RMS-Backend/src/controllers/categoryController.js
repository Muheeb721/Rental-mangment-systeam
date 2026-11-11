import Category from '../models/Category.js';

export const listCategories = async (req, res) => {
  try {
    const items = await Category.find({}).sort({ displayOrder: 1, name: 1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List categories failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list categories.' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ success: false, message: 'Category name is required.' });
    const item = await Category.create({
      name: String(body.name).trim(),
      slug: body.slug || '',
      description: body.description || '',
      displayOrder: Number(body.displayOrder || 0),
      active: body.active !== undefined ? Boolean(body.active) : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Create category failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create category.' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    updates.updatedAt = new Date();
    const item = await Category.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Category not found.' });
    return res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update category failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update category.' });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Category.findByIdAndDelete(id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Category not found.' });
    return res.json({ success: true, data: item });
  } catch (error) {
    console.error('Delete category failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete category.' });
  }
};

export const toggleCategoryActive = async (req, res) => {
  try {
    const { id } = req.params;
    const rec = await Category.findById(id);
    if (!rec) return res.status(404).json({ success: false, message: 'Category not found.' });
    rec.active = !rec.active;
    rec.updatedAt = new Date();
    await rec.save();
    return res.json({ success: true, data: rec });
  } catch (error) {
    console.error('Toggle category failed', error);
    return res.status(500).json({ success: false, message: 'Unable to toggle category.' });
  }
};
