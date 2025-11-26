'use strict';

const AppError = require('../../../modules/AppError');
const Repo = require('../repository/menuVariation.repository');
const ItemRepo = require('../repository/menuItem.repository');

class MenuVariationService {
  static async create(conn, d) {
    if (!d.menuItemId) throw new AppError('menuItemId required', 400);
    const mi = await ItemRepo.getById(conn, d.menuItemId);
    if (!mi) throw new AppError('Menu item not found', 404);

    const doc = await Repo.create(conn, {
      menuItemId: d.menuItemId,
      name: String(d.name || '').trim(),
      type: d.type || 'custom',
      priceDelta: Number(d.priceDelta || 0),
      costDelta: Number(d.costDelta || 0),
      sizeMultiplier: Number(d.sizeMultiplier || 1),
      crustType: d.crustType || '',
      flavorTag: d.flavorTag || '',
      ingredients: Array.isArray(d.ingredients) ? d.ingredients : [],
      isDefault: !!d.isDefault,
      isActive: d.isActive !== undefined ? !!d.isActive : true,
      displayOrder: Number(d.displayOrder || 0),
      metadata: d.metadata || {}
    });
    return { status: 200, message: 'Menu variation created', result: doc };
  }

  static async update(conn, id, patch) {
    if (patch.menuItemId) {
      const mi = await ItemRepo.getById(conn, patch.menuItemId);
      if (!mi) throw new AppError('Menu item not found', 404);
    }
    const doc = await Repo.updateById(conn, id, patch);
    if (!doc) throw new AppError('Menu variation not found', 404);
    return { status: 200, message: 'Menu variation updated', result: doc };
  }

  static async get(conn, id) {
    const doc = await Repo.getById(conn, id);
    if (!doc) throw new AppError('Menu variation not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  static async list(conn, q) {
    const out = await Repo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async listByMenuItem(conn, menuItemId, q) {
    const out = await Repo.listByMenuItem(conn, menuItemId, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async del(conn, id) {
    const doc = await Repo.deleteById(conn, id);
    if (!doc) throw new AppError('Menu variation not found', 404);
    return { status: 200, message: 'Menu variation deleted' };
  }
}

module.exports = MenuVariationService;
