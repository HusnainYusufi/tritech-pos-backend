'use strict';

const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { allocateSequence } = require('../../../modules/sequence');
const AppError = require('../../../modules/AppError');

const CategoryRepo = require('../../inventory-category/repository/inventoryCategory.repository');
const ItemRepo = require('../repository/inventoryItem.repository');

/** Shared columns for template + parser */
const HEADERS = [
  'Item Name',        // string (required)
  'Type',             // one of: stock, nonstock, service
  'SKU',              // optional; if blank -> auto-generate
  'Category Name',    // required (match by name; case-insensitive)
  'Base Unit',        // required (e.g., g, ml, pc)
  'Purchase Unit',    // optional (e.g., kg, L, box)
  'Conversion',       // number (how many base units in 1 purchase unit); default 1
  'Reorder Point',    // integer default 0
  'Quantity',         // ✅ newly added column
  'Is Active'         // true/false; default true
];

/** Create a CSV string with only headers; optionally with a sample row */
function buildTemplateCsv({ withSample = false } = {}) {
  const header = HEADERS.join(',');
  if (!withSample) return header + '\n';
  const sample = [
    'Arabica Beans 1kg',
    'stock',
    '',                 // (auto SKU)
    'Coffee Beans',
    'g',
    'kg',
    '1000',
    '5',
    '120',              // ✅ quantity example
    'true'
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  return header + '\n' + sample + '\n';
}

function bufferToRows(buf, originalName) {
  if (originalName.endsWith('.xlsx')) {
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  }
  // CSV
  const text = buf.toString('utf8');
  const rows = parse(text, { skip_empty_lines: true });
  return rows;
}

function normalizeBool(v, def = true) {
  if (v === undefined || v === null || v === '') return def;
  const s = String(v).trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(s);
}
function normalizeNumber(v, def = 0) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Build a SKU prefix from tenantSlug, like EXTR-000123 */
function makeSkuPrefix(tenantSlug) {
  return String(tenantSlug || 'TENANT').slice(0, 4).toUpperCase();
}

async function ensureCategoriesMap(conn) {
  const cats = await CategoryRepo.listAll(conn); // should return [{_id,name,slug,isActive},...]
  const map = new Map();
  for (const c of cats) map.set(String(c.name).toLowerCase(), c);
  return map;
}

/** Returns { report, insertedIds } */
async function importItems(conn, tenant, file, opts) {
  if (!file?.buffer || !file.originalname) throw new AppError('File required', 400);

  // 1) Read rows
  const rows = bufferToRows(file.buffer, file.originalname);
  if (!rows.length) throw new AppError('No rows found', 400);

  // 2) Validate headers
  const header = rows[0].map(h => String(h).trim());
  const missing = HEADERS.filter(h => !header.includes(h));
  if (missing.length) {
    throw new AppError(`Missing header(s): ${missing.join(', ')}`, 400);
  }
  const colIndex = Object.fromEntries(HEADERS.map(h => [h, header.indexOf(h)]));

  // 3) Build Category map once
  let catMap = await ensureCategoriesMap(conn);

  // 4) Prepare batch
  const dataRows = rows.slice(1);
  const toInsert = [];
  const errors = [];
  const prefix = makeSkuPrefix(tenant.slug);

  const seenSku = new Set();
  const seenNames = new Set();

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    if (!r || r.every(cell => String(cell || '').trim() === '')) continue;

    const rowNum = i + 2; // +1 for header, +1 to make it 1-based for users
    const get = (key) => r[colIndex[key]] ?? '';

    const name = String(get('Item Name')).trim();
    const type = String(get('Type')).trim().toLowerCase() || 'stock';
    const sku = String(get('SKU')).trim();
    const categoryName = String(get('Category Name')).trim();
    const baseUnit = String(get('Base Unit')).trim();
    const purchaseUnit = String(get('Purchase Unit')).trim();
    const conversion = normalizeNumber(get('Conversion'), 1);
    const reorderPoint = Math.max(0, Math.trunc(normalizeNumber(get('Reorder Point'), 0)));
    const quantity = Math.max(0, Math.trunc(normalizeNumber(get('Quantity'), 0))); // ✅ quantity support
    const isActive = normalizeBool(get('Is Active'), true);

    // Basic validation
    const localErrs = [];
    if (!name) localErrs.push('Item Name is required');
    if (!['stock', 'nonstock', 'service'].includes(type)) localErrs.push('Type must be stock|nonstock|service');
    if (!categoryName) localErrs.push('Category Name is required');
    if (!baseUnit) localErrs.push('Base Unit is required');
    if (conversion <= 0) localErrs.push('Conversion must be > 0');

    // Category lookup
    let cat = categoryName ? catMap.get(categoryName.toLowerCase()) : null;
    if (!cat) localErrs.push(`Category "${categoryName}" not found`);

    // dedupe within same file
    if (sku) {
      const normalizedSku = `${prefix}-${sku.replace(/^([A-Z]{3,5}-)?/, '')}`;
      if (seenSku.has(normalizedSku)) localErrs.push(`Duplicate SKU in file: ${normalizedSku}`);
      else seenSku.add(normalizedSku);
    }
    if (name) {
      const key = name.toLowerCase();
      if (seenNames.has(key)) localErrs.push(`Duplicate Item Name in file: ${name}`);
      else seenNames.add(key);
    }

    if (localErrs.length) {
      errors.push({ row: rowNum, errors: localErrs });
      continue;
    }

    toInsert.push({
      name,
      type,
      _skuRequested: sku || null,
      categoryId: cat?._id,
      baseUnit,
      purchaseUnit: purchaseUnit || baseUnit,
      conversion,
      reorderPoint,
      quantity,     // ✅ new field included
      isActive
    });
  }

  // 5) Allocate SKUs for missing ones
  const needingAuto = toInsert.filter(x => !x._skuRequested);
  if (needingAuto.length) {
    const block = await allocateSequence(conn, 'sku', needingAuto.length);
    let n = block.start;
    for (const row of needingAuto) {
      row.sku = `${prefix}-${String(n).padStart(6, '0')}`;
      n++;
    }
  }

  // Normalize SKUs for provided
  for (const row of toInsert) {
    if (!row.sku && row._skuRequested) {
      const raw = row._skuRequested;
      const normalized =
        /^\d+$/.test(raw)
          ? `${prefix}-${String(raw).padStart(6, '0')}`
          : (raw.match(/^[A-Z]{3,8}-\d{1,}$/i)
            ? raw.toUpperCase()
            : `${prefix}-${raw}`.toUpperCase());
      row.sku = normalized;
    }
    delete row._skuRequested;
  }

  // 6) Insert / Upsert in bulk
  const bulkOps = toInsert.map(doc => ({
    updateOne: {
      filter: { sku: doc.sku },
      update: { $setOnInsert: { ...doc }, $set: {} },
      upsert: true
    }
  }));

  if (opts?.duplicatePolicy === 'update') {
    for (const op of bulkOps) {
      const d = op.updateOne.update.$setOnInsert;
      op.updateOne.update.$set = {
        name: d.name,
        type: d.type,
        categoryId: d.categoryId,
        baseUnit: d.baseUnit,
        purchaseUnit: d.purchaseUnit,
        conversion: d.conversion,
        reorderPoint: d.reorderPoint,
        quantity: d.quantity, // ✅ include quantity in update
        isActive: d.isActive
      };
    }
  }

  const bulkRes = await ItemRepo.bulkWrite(conn, bulkOps, { ordered: false });

  const inserted = bulkRes.upsertedCount || 0;
  const matched = bulkRes.matchedCount || 0;
  const modified = bulkRes.modifiedCount || 0;

  return {
    report: {
      totalRows: rows.length - 1,
      acceptedRows: toInsert.length,
      inserted,
      matched,
      modified,
      errors
    }
  };
}

async function exportTemplateCsv(_conn, _tenant, withSample = false) {
  return buildTemplateCsv({ withSample });
}

async function exportItemsCsv(conn, { q, categoryId } = {}) {
  const { items } = await ItemRepo.search(conn, { q, categoryId, page: 1, limit: 100000, sort: 'createdAt', order: 'asc' });
  const lines = [];
  lines.push(HEADERS.join(','));
  for (const it of items) {
    const row = [
      it.name || '',
      it.type || 'stock',
      it.sku || '',
      it.category?.name || it.categoryName || '',
      it.baseUnit || '',
      it.purchaseUnit || '',
      it.conversion ?? 1,
      it.reorderPoint ?? 0,
      it.quantity ?? 0,    // ✅ include quantity in export
      (it.isActive === false ? 'false' : 'true')
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    lines.push(row);
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  HEADERS,
  exportTemplateCsv,
  exportItemsCsv,
  importItems
};
