const AppError = require('../../../modules/AppError');
const Repo = require('../repository/inventoryCategory.repository');

function toSlug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

class InventoryCategoryService {
  static async create(conn, d) {
    const name = String(d.name || '').trim();
    if (!name) throw new AppError('name required', 400);

    const slug = d.slug ? toSlug(d.slug) : toSlug(name);
    const exists = await Repo.getBySlug(conn, slug);
    if (exists) throw new AppError('Category slug already exists', 409);

    let parent = null, path = [];
    if (d.parentId) {
      parent = await Repo.getById(conn, d.parentId);
      if (!parent) throw new AppError('Parent category not found', 404);
      path = [...(parent.path || []), parent._id];
    }

    const doc = await Repo.create(conn, {
      name,
      slug,
      code: d.code || '',
      description: d.description || '',
      parentId: d.parentId || null,
      path,
      isActive: d.isActive !== undefined ? !!d.isActive : true,
      displayOrder: Number(d.displayOrder || 0),
      metadata: d.metadata || {}
    });

    return { status: 200, message: 'Category created', result: doc };
  }

  static async update(conn, id, patch) {
    const cur = await Repo.getById(conn, id);
    if (!cur) throw new AppError('Category not found', 404);

    const upd = { ...patch };
    if (patch.slug) {
      upd.slug = toSlug(patch.slug);
      const dup = await Repo.getBySlug(conn, upd.slug);
      if (dup && String(dup._id) !== String(id)) throw new AppError('Category slug already exists', 409);
    }
    if (patch.name && !patch.slug) upd.slug = toSlug(patch.name);

    if (patch.parentId !== undefined) {
      let parent = null, path = [];
      if (patch.parentId) {
        parent = await Repo.getById(conn, patch.parentId);
        if (!parent) throw new AppError('Parent category not found', 404);
        // Prevent cycles
        const parentPath = [...(parent.path || []), parent._id].map(String);
        if (parentPath.includes(String(id))) throw new AppError('Cannot set child as parent', 400);
        path = parentPath;
      }
      upd.parentId = patch.parentId || null;
      upd.path = path;
    }

    const doc = await Repo.updateById(conn, id, upd);
    return { status: 200, message: 'Category updated', result: doc };
  }

  static async get(conn, id) {
    const doc = await Repo.getById(conn, id);
    if (!doc) throw new AppError('Category not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  static async list(conn, q) {
    const out = await Repo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async del(conn, id, ItemRepo) {
    const cur = await Repo.getById(conn, id);
    if (!cur) throw new AppError('Category not found', 404);

    // Guard: prevent delete if items still use this category
    if (ItemRepo) {
      const inUse = await ItemRepo.countByCategory(conn, id);
      if (inUse > 0) throw new AppError('Category in use by inventory items', 400);
    }

    const doc = await Repo.deleteById(conn, id);
    if (!doc) throw new AppError('Category not found', 404);
    return { status: 200, message: 'Category deleted' };
  }
}

module.exports = InventoryCategoryService;
