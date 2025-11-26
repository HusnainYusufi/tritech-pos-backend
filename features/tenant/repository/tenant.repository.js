const Tenant = require('../model/Tenant.model');

class TenantRepository {
  static async create(data) { return Tenant.create(data); }
  static async updateById(id, data) { return Tenant.findByIdAndUpdate(id, data, { new: true }); }
  static async getById(id) { return Tenant.findById(id).lean(); }
  static async getBySlug(slug) { return Tenant.findOne({ slug }).lean(); }
  static async deleteById(id) { return Tenant.findByIdAndDelete(id); }

  static async search({ q, status, planId, page=1, limit=20, sort='createdAt', order='desc' }) {
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } },
        { 'address.city': { $regex: q, $options: 'i' } },
        { contactEmail: { $regex: q, $options: 'i' } },
      ];
    }
    if (status) filter.status = status;
    if (planId) filter.planId = planId;

    const skip = (Number(page)-1) * Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    const [items, count] = await Promise.all([
      Tenant.find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Tenant.countDocuments(filter)
    ]);

    return { items, count, page: Number(page), limit: Number(limit) };
  }
}

module.exports = TenantRepository;
