# Fix: __counters Collection Duplicate Key Error

## Problem

When creating inventory items, you were getting this error:

```
E11000 duplicate key error collection: tenant_extraction-testt.__counters index: key_1 dup key: { key: null }
```

## Root Cause

The issue was caused by **two different counter models** using the same `__counters` collection with different schemas:

1. **`modules/sku.js`** - Uses `_id` as the key (e.g., `_id: "sku:tenantSlug"`)
   - No `key` field in the document
   - Used for generating SKUs per tenant

2. **`modules/sequence.js`** - Uses `key` field with unique index (e.g., `key: "sku"`)
   - Has a unique index on `key` field
   - Used for bulk SKU allocation during imports

**The Conflict:**
- When documents are created by `sku.js` (using `_id`), they don't have a `key` field
- The `sequence.js` model has a unique index on `key`
- MongoDB treats missing fields as `null` for indexing purposes
- Multiple documents without `key` field = multiple `key: null` values = duplicate key error

## Solution

### 1. Made the `key` index Sparse ✅

Updated `modules/sequence.js` to use a **sparse unique index**:
- Sparse indexes allow multiple documents with `key: null` or missing `key` field
- Still enforces uniqueness for non-null `key` values
- This allows both counter models to coexist

```javascript
key: { type: String, required: true, unique: true, sparse: true }
```

### 2. Added Validation ✅

Added validation to prevent `null`/`undefined` values:
- `nextSku()` now validates `tenantSlug` is provided
- `allocateSequence()` now validates `key` is provided
- `InventoryItemService.create()` validates `tenantSlug` before use

### 3. Better Error Handling ✅

Added specific error handling for counter conflicts:
- Catches duplicate key errors (E11000)
- Provides helpful error message with fix instructions
- Logs detailed error information for debugging

### 4. Fix Script for Existing Data ✅

Created `scripts/fix-counters-collection.js` to:
- Drop and recreate the `key_1` index as sparse
- Clean up orphaned documents with `key: null`
- Show summary of counter documents

## How to Fix Existing Data

### For Live Server

Run the fix script on your live server:

```bash
node scripts/fix-counters-collection.js extraction-testt
```

Replace `extraction-testt` with your actual tenant slug.

**What the script does:**
1. Connects to the tenant database
2. Drops the existing non-sparse `key_1` index
3. Recreates it as sparse (allows multiple nulls)
4. Removes orphaned documents with `key: null` that don't have valid `_id` patterns
5. Shows summary of remaining documents

### Manual Fix (Alternative)

If you prefer to fix manually in MongoDB:

```javascript
// Connect to your tenant database
use tenant_extraction-testt;

// Drop the existing index
db.__counters.dropIndex("key_1");

// Recreate as sparse
db.__counters.createIndex({ key: 1 }, { unique: true, sparse: true });

// Remove orphaned documents (optional - be careful!)
// Only remove documents that don't have valid _id pattern (sku:*) and don't have valid key
db.__counters.deleteMany({ 
  key: null, 
  _id: { $not: /^sku:/ } 
});
```

## Code Changes

### Files Modified:

1. **`modules/sku.js`**
   - Added validation for `tenantSlug`
   - Sanitizes `tenantSlug` before use
   - Better error messages

2. **`modules/sequence.js`**
   - Made `key` index sparse
   - Added validation for `key` parameter
   - Better error handling

3. **`features/inventory/services/inventoryItem.service.js`**
   - Added `tenantSlug` validation
   - Added error handling for counter conflicts
   - Better error messages

4. **`scripts/fix-counters-collection.js`** (NEW)
   - Utility script to fix existing corrupted data
   - Drops and recreates index as sparse
   - Cleans up orphaned documents

## Testing

After applying the fix:

1. **Test creating a single inventory item:**
   ```bash
   POST {{baseUrl}}/t/inventory/items
   {
     "name": "Arabica Beans 1kg",
     "type": "stock",
     "categoryId": "{{categoryId}}",
     "baseUnit": "g",
     "purchaseUnit": "kg",
     "conversion": 1000,
     "reorderPoint": 2,
     "isActive": true
   }
   ```

2. **Test bulk import** (uses `allocateSequence`):
   - Import a CSV/Excel file with multiple items
   - Should work without duplicate key errors

3. **Verify counter documents:**
   ```bash
   node scripts/fix-counters-collection.js <tenant-slug>
   ```
   Should show valid counter documents

## Prevention

The fixes ensure:
- ✅ `tenantSlug` is always validated before use
- ✅ `key` parameter is always validated
- ✅ Index is sparse, allowing both counter models to coexist
- ✅ Better error messages help identify issues quickly

## Notes

- The sparse index allows multiple documents with `key: null` or missing `key`
- Documents with `_id` starting with `sku:` are valid (from `sku.js`)
- Documents with valid `key` field are valid (from `sequence.js`)
- Both can coexist in the same collection without conflicts

## Related Files

- `modules/sku.js` - SKU counter implementation
- `modules/sequence.js` - Sequence counter implementation
- `features/inventory/services/inventoryItem.service.js` - Inventory item service
- `features/inventory/services/ImportExportService.js` - Uses `allocateSequence` for bulk imports
- `scripts/fix-counters-collection.js` - Fix script for existing data
