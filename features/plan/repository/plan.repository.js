const Plan = require('../model/Plan.model');

class PlanRepository {
  static async create(data){ return Plan.create(data); }
  static async updateById(id, data){ return Plan.findByIdAndUpdate(id, data, { new: true }); }
  static async getById(id){ return Plan.findById(id).lean(); }
  static async getByName(name){ return Plan.findOne({ name }).lean(); }
  static async deleteById(id){ return Plan.findByIdAndDelete(id); }
  static async search({ q, status, type, page=1, limit=20, sort='createdAt', order='desc' }){
    const filter = {};
    if (q) filter.name = { $regex: q, $options: 'i' };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (Number(page)-1) * Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    const [items, count] = await Promise.all([
      Plan.find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Plan.countDocuments(filter)
    ]);

    return { items, count, page: Number(page), limit: Number(limit) };
  }
}

module.exports = PlanRepository;
