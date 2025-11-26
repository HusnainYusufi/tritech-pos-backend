const Announcement = require('../model/Announcement.model');

class AnnouncementRepository {
  static async create(d){ return Announcement.create(d); }
  static async updateById(id,d){ return Announcement.findByIdAndUpdate(id,d,{ new:true }); }
  static async getById(id){ return Announcement.findById(id).lean(); }
  static async deleteById(id){ return Announcement.findByIdAndDelete(id); }
  static async search({ q, status, page=1, limit=20, sort='createdAt', order='desc' }){
    const filter = {};
    if (q) filter.title = { $regex:q,$options:'i' };
    if (status) filter.status = status;
    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order==='asc'?1:-1 };
    const [items, count] = await Promise.all([
      Announcement.find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Announcement.countDocuments(filter)
    ]);
    return { items, count, page:Number(page), limit:Number(limit) };
  }
}
module.exports = AnnouncementRepository;
