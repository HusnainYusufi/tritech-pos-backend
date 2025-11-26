'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const menuItemSchemaFactory = require('../model/MenuItem.schema');

// Also register refs used by populate (category, recipe)
const menuCategorySchemaFactory = require('../model/MenuCategory.schema');
const recipeSchemaFactory = require('../../recipe/model/Recipe.schema');

function MenuItem(conn) {
  // collection name: 'menu_items'
  return getTenantModel(conn, 'MenuItem', menuItemSchemaFactory, 'menu_items');
}

class MenuItemRepository {
  static model(conn) { return MenuItem(conn); }

  static async create(conn, d) {
    return MenuItem(conn).create(d);
  }

  static async updateById(conn, id, d) {
    return MenuItem(conn).findByIdAndUpdate(id, d, { new: true });
  }

  static async getById(conn, id) {
    // Ensure refs are registered before populate
    getTenantModel(conn, 'MenuCategory', menuCategorySchemaFactory, 'menu_categories');
    getTenantModel(conn, 'Recipe', recipeSchemaFactory, 'recipes');

    return MenuItem(conn)
      .findById(id)
      .populate('categoryId', 'name slug')
      .populate('recipeId', 'name slug')
      .lean();
  }

  // ✅ This is the function your service needs
  static async getBySlug(conn, slug) {
    return MenuItem(conn).findOne({ slug }).lean();
  }

  static async deleteById(conn, id) {
    return MenuItem(conn).findByIdAndDelete(id);
  }

  static async search(conn, {
    q,
    categoryId,
    isActive,
    page = 1,
    limit = 20,
    sort = 'displayOrder',
    order = 'asc'
  } = {}) {
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
      ];
    }
    if (categoryId) filter.categoryId = categoryId;
    if (isActive !== undefined) filter.isActive = (isActive === 'true' || isActive === true);

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    // Register category ref for list view too
    getTenantModel(conn, 'MenuCategory', menuCategorySchemaFactory, 'menu_categories');

    const [items, count] = await Promise.all([
      MenuItem(conn)
        .find(filter)
        .populate('categoryId', 'name slug')
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      MenuItem(conn).countDocuments(filter),
    ]);

    return { items, count, page: Number(page), limit: Number(limit) };
  }

  // Optional helper for delete guards elsewhere
  static async existsByCategory(conn, categoryId) {
    return MenuItem(conn).exists({ categoryId });
  }
}

module.exports = MenuItemRepository;
