const User = require('../model/User.model');

class UserRepository {
  static async create(data){ return User.create(data); }
  static async getByEmail(email){ return User.findOne({ email }).lean(); }
  static async getDocByEmail(email){ return User.findOne({ email }); }
  static async countAdmins(){ return User.countDocuments({}); } // count any users
  static async updateById(id, patch){ return User.findByIdAndUpdate(id, patch, { new: true }); }
}

module.exports = UserRepository;
