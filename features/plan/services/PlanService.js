const PlanRepo = require('../repository/plan.repository');
const AppError = require('../../../modules/AppError');

class PlanService {
  static async create(data){
    const exists = await PlanRepo.getByName(data.name);
    if (exists) throw new AppError('Plan name already exists', 409);
    const doc = await PlanRepo.create(data);
    return { status: 200, message: 'Plan created', result: doc };
  }
  static async update(id, patch){
    const doc = await PlanRepo.updateById(id, patch);
    if (!doc) throw new AppError('Plan not found', 404);
    return { status: 200, message: 'Plan updated', result: doc };
  }
  static async get(id){
    const doc = await PlanRepo.getById(id);
    if (!doc) throw new AppError('Plan not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }
  static async list(q){
    const out = await PlanRepo.search(q);
    return { status: 200, message: 'OK', ...out };
  }
  static async del(id){
    const doc = await PlanRepo.deleteById(id);
    if (!doc) throw new AppError('Plan not found', 404);
    return { status: 200, message: 'Plan deleted' };
  }
}

module.exports = PlanService;
