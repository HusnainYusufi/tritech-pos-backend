const Template = require('../model/Template.model');

class TemplateRepository {
  static async create(d){ return Template.create(d); }
  static async updateById(id,d){ return Template.findByIdAndUpdate(id,d,{ new:true }); }
  static async getById(id){ return Template.findById(id).lean(); }
  static async getByName(name){ return Template.findOne({ name }).lean(); }
  static async deleteById(id){ return Template.findByIdAndDelete(id); }
  static async search({ q, status, channel, page=1, limit=20, sort='createdAt', order='desc' }){
    const filter = {};
    if (q) filter.$or = [{ name: { $regex:q,$options:'i' } }, { subject: { $regex:q,$options:'i' } }];
    if (status) filter.status = status;
    if (channel) filter.channel = channel;
    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order==='asc'?1:-1 };
    const [items, count] = await Promise.all([
      Template.find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Template.countDocuments(filter)
    ]);
    return { items, count, page:Number(page), limit:Number(limit) };
  }
}
module.exports = TemplateRepository;
