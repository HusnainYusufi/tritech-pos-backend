'use strict';

const AppError = require('../../../modules/AppError');
const MenuItemRepo = require('../repository/menuItem.repository');
const CatRepo = require('../repository/menuCategory.repository');
const RecipeRepo = require('../../recipe/repository/recipe.repository');

// same helper used elsewhere
function toSlug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

class MenuItemService {
  // Create Menu Item
  static async create(conn, d) {
    const name = String(d.name || '').trim();
    if (!name) throw new AppError('name required', 400);

    // slug: from payload or derived from name
    const slug = d.slug ? toSlug(d.slug) : toSlug(name);

    // enforce unique slug
    const dup = await MenuItemRepo.getBySlug(conn, slug);
    if (dup) throw new AppError('Menu item slug already exists', 409);

    // optional category check
    if (d.categoryId) {
      const cat = await CatRepo.getById(conn, d.categoryId);
      if (!cat) throw new AppError('Category not found', 404);
    }

    // optional recipe check
    if (d.recipeId) {
      const rec = await RecipeRepo.getById(conn, d.recipeId);
      if (!rec) throw new AppError('Recipe not found', 404);
    }

    // Normalize pricing object
    const pricing = {
      basePrice: Number(d.pricing?.basePrice || 0),
      priceIncludesTax: !!d.pricing?.priceIncludesTax,
      currency: String(d.pricing?.currency || 'SAR'),
    };

    // Build document per schema
    const doc = await MenuItemRepo.create(conn, {
      name,
      slug,
      code: d.code || '',
      description: d.description || '',
      categoryId: d.categoryId || null,
      recipeId: d.recipeId || null,
      pricing,
      isActive: d.isActive !== undefined ? !!d.isActive : true,
      displayOrder: Number(d.displayOrder || 0),
      tags: Array.isArray(d.tags) ? d.tags : [],
      media: Array.isArray(d.media) ? d.media : [],
      branchIds: Array.isArray(d.branchIds) ? d.branchIds : [],
      metadata: d.metadata || {}
    });

    return { status: 200, message: 'Menu item created', result: doc };
  }

  // Update Menu Item
  static async update(conn, id, patch) {
    const cur = await MenuItemRepo.getById(conn, id);
    if (!cur) throw new AppError('Menu item not found', 404);

    const upd = { ...patch };

    // handle slug uniqueness
    if (patch.slug) {
      upd.slug = toSlug(patch.slug);
      const dup = await MenuItemRepo.getBySlug(conn, upd.slug);
      if (dup && String(dup._id) !== String(id)) {
        throw new AppError('Slug already exists', 409);
      }
    } else if (patch.name) {
      upd.slug = toSlug(patch.name);
    }

    // validate optional references
    if (patch.categoryId !== undefined && patch.categoryId) {
      const cat = await CatRepo.getById(conn, patch.categoryId);
      if (!cat) throw new AppError('Category not found', 404);
    }
    if (patch.recipeId !== undefined && patch.recipeId) {
      const rec = await RecipeRepo.getById(conn, patch.recipeId);
      if (!rec) throw new AppError('Recipe not found', 404);
    }

    const doc = await MenuItemRepo.updateById(conn, id, upd);
    return { status: 200, message: 'Menu item updated', result: doc };
  }

  // Get Menu Item by ID
  static async get(conn, id) {
    const menuItem = await MenuItemRepo.getById(conn, id);
    if (!menuItem) throw new AppError('Menu item not found', 404);
    return { status: 200, message: 'OK', result: menuItem };
  }

  // List Menu Items
  static async list(conn, query) {
    const items = await MenuItemRepo.search(conn, query || {});
    return { status: 200, message: 'OK', ...items };
  }

  // Delete Menu Item
  static async del(conn, id) {
    const menuItem = await MenuItemRepo.deleteById(conn, id);
    if (!menuItem) throw new AppError('Menu item not found', 404);
    return { status: 200, message: 'Menu item deleted' };
  }
}

module.exports = MenuItemService;
