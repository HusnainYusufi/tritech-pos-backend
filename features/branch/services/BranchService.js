// features/branch/services/BranchService.js
const AppError = require('../../../modules/AppError');
const BranchRepo = require('../repository/branch.repository');
const TenantUserRepo = require('../../tenant-auth/repository/tenantUser.repository');

class BranchService {
  static async create(conn, data, createdBy=null){
    const code = String(data.code || '').toLowerCase();
    if (!code) throw new AppError('code required', 400);
    const exists = await BranchRepo.getByCode(conn, code);
    if (exists) throw new AppError('Branch code already exists', 409);

    const total = await BranchRepo.count(conn);
    const doc = await BranchRepo.create(conn, {
      ...data,
      code,
      isDefault: total === 0 ? true : !!data.isDefault,
      createdBy: createdBy || null
    });

    // if they explicitly set isDefault on non-first, ensure only one default
    if (doc.isDefault && total > 0) {
      await BranchRepo.unsetDefault(conn);
      await BranchRepo.updateById(conn, doc._id, { isDefault: true });
    }

    return { status:200, message:'Branch created', result: doc };
  }

  static async update(conn, id, patch){
    if (patch.code) {
      patch.code = String(patch.code).toLowerCase();
      const duplicate = await BranchRepo.getByCode(conn, patch.code);
      if (duplicate && String(duplicate._id) !== String(id)) {
        throw new AppError('Branch code already exists', 409);
      }
    }
    const doc = await BranchRepo.updateById(conn, id, patch);
    if (!doc) throw new AppError('Branch not found', 404);
    return { status:200, message:'Branch updated', result: doc };
  }

  static async setDefault(conn, id){
    const target = await BranchRepo.getById(conn, id);
    if (!target) throw new AppError('Branch not found', 404);
    await BranchRepo.unsetDefault(conn);
    const doc = await BranchRepo.updateById(conn, id, { isDefault: true, status: 'active' });
    return { status:200, message:'Default branch set', result: doc };
  }

  static async get(conn, id){
    const doc = await BranchRepo.getById(conn, id);
    if (!doc) throw new AppError('Branch not found', 404);
    return { status:200, message:'OK', result: doc };
  }

  static async list(conn, q){
    const out = await BranchRepo.search(conn, q || {});
    return { status:200, message:'OK', ...out };
  }

  static async del(conn, id){
    const doc = await BranchRepo.deleteById(conn, id);
    if (!doc) throw new AppError('Branch not found', 404);
    return { status:200, message:'Branch deleted' };
  }

  // Settings helpers (thin wrappers)
  static async getSettings(conn, branchId){
    const b = await BranchRepo.getById(conn, branchId);
    if (!b) throw new AppError('Branch not found', 404);
    return {
      status:200, message:'OK',
      result: { timezone: b.timezone, currency: b.currency, tax: b.tax, posConfig: b.posConfig, printers: b.printers }
    };
  }

  static async updateSettings(conn, branchId, patch){
    const allowed = ['timezone','currency','tax','posConfig','printers'];
    const sanitized = {};
    for (const k of allowed) if (patch[k] !== undefined) sanitized[k] = patch[k];
    const doc = await BranchRepo.updateById(conn, branchId, sanitized);
    if (!doc) throw new AppError('Branch not found', 404);
    return { status:200, message:'Settings updated', result: sanitized };
  }

  // Optional convenience: attach/detach user to branchIds (UI helper)
  static async attachUser(conn, branchId, userId){
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(userId);
    if (!userDoc) throw new AppError('User not found', 404);
    userDoc.branchIds = userDoc.branchIds || [];
    if (!userDoc.branchIds.find(x => String(x) === String(branchId))) {
      userDoc.branchIds.push(branchId);
    }
    await userDoc.save();
    return { status:200, message:'User attached to branch' };
  }

  static async detachUser(conn, branchId, userId){
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(userId);
    if (!userDoc) throw new AppError('User not found', 404);
    userDoc.branchIds = (userDoc.branchIds || []).filter(x => String(x) !== String(branchId));
    await userDoc.save();
    return { status:200, message:'User detached from branch' };
  }

  static async summary(conn, branchId) {
    const branch = await BranchRepo.getById(conn, branchId);
    if (!branch) throw new AppError('Branch not found', 404);

   
    const User = TenantUserRepo.model(conn);
    const activeStaff = await User.countDocuments({ status: 'active', branchIds: branch._id });

   
    const result = {
      branch: {
        _id: branch._id,
        name: branch.name,
        code: branch.code,
        status: branch.status,
        isDefault: branch.isDefault,
        city: branch.address?.city || '',
        timezone: branch.timezone,
        currency: branch.currency
      },

      
      salesToday: 0,         
      ordersToday: 0,          
      avgTicket: 0,           

      pendingKOT: 0,

    
      activeStaff,             
      openShifts: 0,            

     
      lowStockCount: 0,

    
      openTables: 0,

      
      printers: (branch.printers || []).map((p, i) => ({
        idx: i,
        name: p.name,
        type: p.type,
        target: p.target,
        enabled: !!p.enabled
      }))
    };

    return { status: 200, message: 'OK', result };
  }
}

module.exports = BranchService;
