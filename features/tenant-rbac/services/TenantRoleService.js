// features/tenant-rbac/services/TenantRoleService.js
const AppError = require('../../../modules/AppError');
const RoleRepo = require('../repository/tenantRole.repository');
const TenantUserRepo = require('../../tenant-auth/repository/tenantUser.repository');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');

const DEFAULT_PERMS = {
  owner:      ['*'],
  admin:      ['dashboard.view','settings.manage','branches.manage','menu.*','inventory.*','orders.*','hr.*','reports.*','billing.*','pos.till.manage'],
  manager:    ['dashboard.view','menu.*','inventory.*','orders.*','hr.*','reports.*','pos.till.manage'],
  cashier:    ['orders.create','orders.read','orders.update','payments.take','customers.read','menu.items.read','pos.till.manage'],
  kitchen:    ['kitchen.read','kitchen.update','orders.read'],
  inventory:  ['inventory.*','menu.read'],
  hr:         ['hr.*'],
  accountant: ['reports.*','billing.*','orders.read'],
  viewer:     ['dashboard.view','reports.view','menu.read','inventory.read','orders.read']
};

// Track which tenants have had default roles seeded in the current process
const SEEDED_TENANTS = new Set();

async function seedDefaultRoles(conn) {
  const Role = RoleRepo.model(conn);

  const defs = [
    { name:'Owner',      key:'owner',      description:'Full control',   scope:'tenant', permissions: DEFAULT_PERMS.owner, isSystem:true },
    { name:'Admin',      key:'admin',      description:'Admin',          scope:'tenant', permissions: DEFAULT_PERMS.admin, isSystem:true },
    { name:'Manager',    key:'manager',    description:'Store manager',  scope:'tenant', permissions: DEFAULT_PERMS.manager, isSystem:false },
    { name:'Cashier',    key:'cashier',    description:'POS cashier',    scope:'branch', permissions: DEFAULT_PERMS.cashier, isSystem:false },
    { name:'Kitchen',    key:'kitchen',    description:'Kitchen staff',  scope:'branch', permissions: DEFAULT_PERMS.kitchen, isSystem:false },
    { name:'Inventory',  key:'inventory',  description:'Inventory',      scope:'branch', permissions: DEFAULT_PERMS.inventory, isSystem:false },
    { name:'HR',         key:'hr',         description:'HR staff',       scope:'tenant', permissions: DEFAULT_PERMS.hr, isSystem:false },
    { name:'Accountant', key:'accountant', description:'Accounts',       scope:'tenant', permissions: DEFAULT_PERMS.accountant, isSystem:false },
    { name:'Viewer',     key:'viewer',     description:'Read-only',      scope:'tenant', permissions: DEFAULT_PERMS.viewer, isSystem:false },
  ];
  for (const def of defs) {
    const existing = await Role.findOne({ key: def.key });
    if (!existing) {
      await Role.create(def);
      continue;
    }

    let changed = false;
    for (const p of def.permissions) {
      if (!existing.permissions.includes(p)) {
        existing.permissions.push(p);
        changed = true;
      }
    }

    if (def.scope && existing.scope !== def.scope) { existing.scope = def.scope; changed = true; }
    if (typeof def.isSystem === 'boolean' && existing.isSystem !== def.isSystem) { existing.isSystem = def.isSystem; changed = true; }

    if (changed) await existing.save();
  }
}

class TenantRoleService {
  static async seedDefaults(conn){ await seedDefaultRoles(conn); }

  static async ensureDefaultsSeeded(conn, tenantSlug=null) {
    const key = tenantSlug || '_no_slug_';
    if (SEEDED_TENANTS.has(key)) return;
    await seedDefaultRoles(conn);
    SEEDED_TENANTS.add(key);
  }

  static async create(conn, d){
    const key = String(d.key || '').toLowerCase();
    if (!key) throw new AppError('key required', 400);
    const exists = await RoleRepo.getByKey(conn, key);
    if (exists) throw new AppError('Role key already exists', 409);
    const doc = await RoleRepo.create(conn, {
      name: d.name, key,
      description: d.description || '',
      scope: d.scope || 'tenant',
      permissions: Array.isArray(d.permissions) ? d.permissions : []
    });
    return { status:200, message:'Role created', result:doc };
  }

  static async update(conn, id, patch){
    if (patch.key) patch.key = String(patch.key).toLowerCase();
    const current = await RoleRepo.getById(conn, id);
    if (!current) throw new AppError('Role not found', 404);
    if (current.isSystem && patch.key && patch.key !== current.key) {
      throw new AppError('System role key cannot be changed', 400);
    }
    const doc = await RoleRepo.updateById(conn, id, patch);
    return { status:200, message:'Role updated', result:doc };
  }

  static async get(conn, id){
    const doc = await RoleRepo.getById(conn, id);
    if (!doc) throw new AppError('Role not found', 404);
    return { status:200, message:'OK', result:doc };
  }

  static async list(conn, q){ const out = await RoleRepo.search(conn, q || {}); return { status:200, message:'OK', ...out }; }

  static async del(conn, id){
    const doc = await RoleRepo.getById(conn, id);
    if (!doc) throw new AppError('Role not found', 404);
    if (doc.isSystem) throw new AppError('Cannot delete a system role', 400);
    await RoleRepo.deleteById(conn, id);
    return { status:200, message:'Role deleted' };
  }

  static async assignRole(conn, { userId, roleKey, branchId=null }) {
    roleKey = String(roleKey || '').toLowerCase();
    const role = await RoleRepo.getByKey(conn, roleKey);
    if (!role) throw new AppError('Role not found', 404);
    if (role.scope === 'branch' && !branchId) throw new AppError('branchId required for branch-scoped roles', 400);

    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(userId);
    if (!userDoc) throw new AppError('User not found', 404);

    if (!userDoc.roles.includes(roleKey)) userDoc.roles.push(roleKey);

    userDoc.roleGrants = userDoc.roleGrants || [];
    const exists = userDoc.roleGrants.find(g => g.roleKey === roleKey && String(g.branchId||'') === String(branchId||''));
    if (!exists) userDoc.roleGrants.push({ roleKey, scope: role.scope, branchId: branchId || null });

    await userDoc.save();
    return { status:200, message:'Role assigned', result:{ userId: userDoc._id, roleKey, branchId } };
  }

  static async unassignRole(conn, { userId, roleKey, branchId=null }) {
    roleKey = String(roleKey || '').toLowerCase();
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(userId);
    if (!userDoc) throw new AppError('User not found', 404);

    userDoc.roles = (userDoc.roles || []).filter(r => r !== roleKey);
    userDoc.roleGrants = (userDoc.roleGrants || []).filter(g => !(g.roleKey === roleKey && String(g.branchId||'') === String(branchId||'')));

    await userDoc.save();
    return { status:200, message:'Role unassigned', result:{ userId: userDoc._id, roleKey, branchId } };
  }
}

module.exports = TenantRoleService;
