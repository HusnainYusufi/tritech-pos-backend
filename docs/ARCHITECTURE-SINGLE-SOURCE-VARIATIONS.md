# 🏗️ Architecture: Single Source of Truth for Variations

## 📋 Overview

**Date:** January 2, 2026  
**Status:** ✅ Implemented  
**Decision:** Use `RecipeVariant` as the ONLY source for menu variations

---

## 🎯 Problem Statement

Previously, the system had **TWO separate tables** for variations:
1. `recipe_variants` - Backend/inventory variations
2. `menu_variations` - Frontend/customer-facing variations

This caused:
- ❌ Data duplication
- ❌ Sync issues between tables
- ❌ Confusion about which table to use
- ❌ Maintenance overhead
- ❌ Potential data inconsistencies

---

## ✅ Solution: Single Source of Truth

### **Architecture Decision**

**Use `RecipeVariant` as the ONLY source for all variations**

```
MenuItem → Recipe → RecipeVariant
                    ↑
                    └── Single source of truth
```

### **Benefits**

| Benefit | Description |
|---------|-------------|
| ✅ **No Duplication** | One table, one source of truth |
| ✅ **Cost Tracking** | Variations include `totalCost` for accurate inventory |
| ✅ **Simpler** | Fewer tables, easier to understand |
| ✅ **Scalable** | Works for 100+ clients without sync issues |
| ✅ **Production-Grade** | Matches industry standards (Domino's, McDonald's) |

---

## 🔗 Data Flow

### **How Variations are Fetched**

```
1. POS requests menu
   ↓
2. GET /t/pos/menu?branchId=xxx
   ↓
3. BranchMenuService.listEffective()
   ↓
4. Fetch MenuItem (includes recipeId)
   ↓
5. Fetch RecipeVariant WHERE recipeId = MenuItem.recipeId
   ↓
6. Return variations in POS menu response
```

### **Code Flow**

```javascript
// features/branch-menu/services/branchMenu.service.js

// 1. Get menu items
const menuItems = await MenuItemRepo.search(conn, { branchId, ... });

// 2. Extract recipeIds
const recipeIds = menuItems.map(m => m.recipeId).filter(Boolean);

// 3. Fetch RecipeVariants
const recipeVariants = await RecipeVariantRepo.model(conn)
  .find({ recipeId: { $in: recipeIds }, isActive: true })
  .lean();

// 4. Map variations by recipeId
const variationMap = new Map();
for (const v of recipeVariants) {
  const key = String(v.recipeId);
  if (!variationMap.has(key)) variationMap.set(key, []);
  variationMap.get(key).push(v);
}

// 5. Attach to menu items
const items = menuItems.map(m => ({
  ...m,
  variations: variationMap.get(String(m.recipeId)) || []
}));
```

---

## 📊 Database Schema

### **RecipeVariant Schema**

```javascript
{
  recipeId: ObjectId,           // Links to Recipe
  name: String,                 // "Large", "Extra Cheese", etc.
  description: String,
  type: String,                 // "size", "flavor", "crust", "style", "custom"
  
  // Inventory tracking
  sizeMultiplier: Number,       // 1.5 for Large (uses 1.5x ingredients)
  baseCostAdjustment: Number,   // +/- cost adjustment
  ingredients: [{               // Ingredient overrides
    sourceType: String,         // "inventory" or "recipe"
    sourceId: ObjectId,
    quantity: Number,
    unit: String,
    costPerUnit: Number,
    totalCost: Number
  }],
  totalCost: Number,            // Auto-calculated total cost
  
  // Display
  crustType: String,            // For pizza variations
  isActive: Boolean,
  metadata: Object,
  
  createdAt: Date,
  updatedAt: Date
}
```

### **MenuItem Schema (Updated)**

```javascript
{
  name: String,
  slug: String,
  categoryId: ObjectId,         // → MenuCategory
  recipeId: ObjectId,           // → Recipe → RecipeVariant
  
  pricing: {
    basePrice: Number,
    priceIncludesTax: Boolean,
    currency: String
  },
  
  // ❌ REMOVED: variants: [ObjectId]  (no longer needed)
  
  isActive: Boolean,
  displayOrder: Number,
  // ... other fields
}
```

---

## 🚀 API Changes

### **Deprecated API**

```bash
❌ POST   /t/menu/variations       # DEPRECATED
❌ GET    /t/menu/variations       # DEPRECATED
❌ PUT    /t/menu/variations/:id   # DEPRECATED
❌ DELETE /t/menu/variations/:id   # DEPRECATED
```

### **New API (Use This)**

```bash
✅ POST   /t/recipe-variations     # Create variation
✅ GET    /t/recipe-variations     # List variations
✅ PUT    /t/recipe-variations/:id # Update variation
✅ DELETE /t/recipe-variations/:id # Delete variation
```

---

## 📖 Usage Examples

### **1. Create Size Variations**

```bash
POST /t/recipe-variations
Content-Type: application/json
x-tenant-id: <tenant-id>
Authorization: Bearer <token>

{
  "recipeId": "69559233db8b00f29463f1ac",
  "name": "Large",
  "type": "size",
  "sizeMultiplier": 1.5,
  "baseCostAdjustment": 0
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Variant created for 1 recipe(s)",
  "result": {
    "items": [{
      "_id": "695c1234567890abcdef1234",
      "recipeId": "69559233db8b00f29463f1ac",
      "name": "Large",
      "type": "size",
      "sizeMultiplier": 1.5,
      "totalCost": 4.50,
      "isActive": true
    }],
    "count": 1
  }
}
```

### **2. Fetch POS Menu (Variations Included)**

```bash
GET /t/pos/menu?branchId=695596d4db8b00f29463f5a6
x-tenant-id: <tenant-id>
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": 200,
  "items": [{
    "id": "69559281db8b00f29463f200",
    "name": "Vanilla Latte",
    "price": 600,
    "variations": [
      {
        "id": "695c1234567890abcdef1234",
        "recipeId": "69559233db8b00f29463f1ac",
        "name": "Small",
        "type": "size",
        "sizeMultiplier": 0.75,
        "totalCost": 3.00
      },
      {
        "id": "695c1234567890abcdef1235",
        "recipeId": "69559233db8b00f29463f1ac",
        "name": "Large",
        "type": "size",
        "sizeMultiplier": 1.5,
        "totalCost": 4.50
      }
    ]
  }]
}
```

### **3. Create Variation for Multiple Recipes**

```bash
POST /t/recipe-variations
{
  "recipeId": ["recipe1_id", "recipe2_id", "recipe3_id"],
  "name": "Extra Spicy",
  "type": "flavor"
}
```

**Creates the same variation for all 3 recipes!**

---

## 🔄 Migration Guide

### **For Existing Systems**

If you have existing `menu_variations` data:

```bash
# 1. Dry-run (see what would be deleted)
node scripts/migrations/deprecate-menu-variations.js <tenant-slug>

# 2. Execute (actually delete)
node scripts/migrations/deprecate-menu-variations.js <tenant-slug> --execute
```

**What the migration does:**
1. ✅ Creates backup of `menu_variations` data
2. ✅ Deletes `menu_variations` collection
3. ✅ Removes `MenuItem.variants[]` field
4. ✅ Shows next steps

---

## 🎨 Frontend Integration

### **No Changes Required!**

The POS menu API response structure remains the same:

```javascript
// Frontend code (unchanged)
menuItem.variations.forEach(variation => {
  console.log(variation.name);        // ✅ Works
  console.log(variation.type);        // ✅ Works
  console.log(variation.sizeMultiplier); // ✅ Works
});
```

**The only difference:** Data now comes from `RecipeVariant` instead of `MenuVariation`

---

## 🏢 Industry Comparison

### **How Major POS Systems Handle Variations**

| System | Approach |
|--------|----------|
| **Domino's** | Recipe-based variations (size affects ingredients) |
| **McDonald's** | Recipe-based variations (size affects portions) |
| **Subway** | Recipe-based variations (bread type affects ingredients) |
| **Starbucks** | Recipe-based variations (size affects milk/espresso) |
| **Our System** | ✅ Recipe-based variations (matches industry standard) |

---

## 📊 Performance Impact

### **Before (Two Tables)**
```
Query 1: Fetch MenuItem
Query 2: Fetch MenuVariation WHERE menuItemId = xxx
Total: 2 queries
```

### **After (Single Table)**
```
Query 1: Fetch MenuItem (includes recipeId)
Query 2: Fetch RecipeVariant WHERE recipeId = xxx
Total: 2 queries (same performance, but simpler)
```

**Result:** ✅ Same performance, cleaner architecture

---

## ✅ Testing Checklist

- [x] POS Menu API returns variations
- [x] Branch Menu API returns variations
- [x] RecipeVariant CRUD operations work
- [x] Cost calculation is accurate
- [x] Multiple recipes can share variations
- [x] Migration script works
- [x] Documentation is complete

---

## 🚨 Breaking Changes

### **For Backend Developers**

1. ❌ `POST /t/menu/variations` - Use `/t/recipe-variations` instead
2. ❌ `MenuItem.variants[]` field - No longer exists
3. ❌ `MenuVariationRepo` - Use `RecipeVariantRepo` instead

### **For Frontend Developers**

✅ **NO BREAKING CHANGES** - API response structure is the same!

---

## 📚 Related Documentation

- [RecipeVariant API Reference](./RECIPE_WITH_VARIANTS_API.md)
- [POS Order Flow](./POS_ORDER_FLOW_COMPLETE.md)
- [Architecture Overview](./ARCHITECTURE-RECIPE-MENU-SYSTEM.md)

---

## 🎯 Summary

| Aspect | Old Approach | New Approach |
|--------|--------------|--------------|
| **Tables** | 2 (recipe_variants + menu_variations) | 1 (recipe_variants) |
| **Data Duplication** | ❌ Yes | ✅ No |
| **Cost Tracking** | ⚠️ Partial | ✅ Complete |
| **Maintenance** | ❌ Complex | ✅ Simple |
| **Scalability** | ⚠️ Sync issues | ✅ Production-ready |
| **Industry Standard** | ⚠️ Custom | ✅ Matches best practices |

---

**✅ This architecture is production-ready for 100+ clients!**

