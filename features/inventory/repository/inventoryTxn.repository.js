// features/inventory/repository/inventoryTxn.repository.js
const { getTenantModel } = require('../../../modules/tenantModels');
const factory = require('../model/InventoryTxn.schema');

function InventoryTxn(conn) { return getTenantModel(conn, 'InventoryTxn', factory, 'inventory_txns'); }

class InventoryTxnRepository {
  static model(conn){ return InventoryTxn(conn); }
  static async create(conn, d, options = {}){ return InventoryTxn(conn).create(d, options); }
  static async insertMany(conn, docs, options = {}){ return InventoryTxn(conn).insertMany(docs, options); }
  static async search(conn, { branchId, itemId, type, dateFrom, dateTo, page=1, limit=50 }){
    const filter = {};
    if (branchId) filter.branchId = branchId;
    if (itemId) filter.itemId = itemId;
    if (type) filter.type = type;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo)   filter.createdAt.$lte = new Date(dateTo);
    }
    const skip = (Number(page)-1)*Number(limit);
    const items = await InventoryTxn(conn).find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const count = await InventoryTxn(conn).countDocuments(filter);
    return { items, count, page:Number(page), limit:Number(limit) };
  }
}
module.exports = InventoryTxnRepository;
