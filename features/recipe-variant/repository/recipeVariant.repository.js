'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const schemaFactory = require('../model/RecipeVariant.schema');

function RecipeVariant(conn) {
  return getTenantModel(conn, 'RecipeVariant', schemaFactory, 'recipe_variants');
}

class RecipeVariantRepository {
  static model(conn) { return RecipeVariant(conn); }

  static async create(conn, d) { return RecipeVariant(conn).create(d); }
  static async updateById(conn, id, d) { return RecipeVariant(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id) { return RecipeVariant(conn).findById(id).populate('recipeId', 'name slug').lean(); }
  static async deleteById(conn, id) { return RecipeVariant(conn).findByIdAndDelete(id); }

  static async search(conn, { q, recipeId, type, isActive, page = 1, limit = 20, sort = 'createdAt', order = 'desc' }) {
    const filter = {};
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ];
    if (recipeId) filter.recipeId = recipeId;
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    const [items, count] = await Promise.all([
      RecipeVariant(conn).find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      RecipeVariant(conn).countDocuments(filter),
    ]);

    return { items, count, page: Number(page), limit: Number(limit) };
  }
}

module.exports = RecipeVariantRepository;
