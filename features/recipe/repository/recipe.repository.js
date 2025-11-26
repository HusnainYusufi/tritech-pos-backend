'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const schemaFactory = require('../model/Recipe.schema');

function Recipe(conn) {
  return getTenantModel(conn, 'Recipe', schemaFactory, 'recipes');
}

class RecipeRepository {
  static model(conn) { return Recipe(conn); }

  static async create(conn, d) { return Recipe(conn).create(d); }
  static async updateById(conn, id, d) { return Recipe(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id) { return Recipe(conn).findById(id).lean(); }
  static async getBySlug(conn, slug) { return Recipe(conn).findOne({ slug }).lean(); }
  static async deleteById(conn, id) { return Recipe(conn).findByIdAndDelete(id); }

  static async search(conn, { q, type, isActive, page = 1, limit = 20, sort = 'createdAt', order = 'desc' }) {
    const filter = {};
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { customName: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } },
    ];
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    const [items, count] = await Promise.all([
      Recipe(conn).find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Recipe(conn).countDocuments(filter),
    ]);

    return { items, count, page: Number(page), limit: Number(limit) };
  }
}

module.exports = RecipeRepository;
