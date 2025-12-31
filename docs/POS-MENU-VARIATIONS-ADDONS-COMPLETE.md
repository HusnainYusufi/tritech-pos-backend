# 🍔 POS Menu System - Variations & Add-Ons (Production Guide)

**For:** Food Chain POS Systems  
**Status:** ✅ Production-Ready  
**Architecture:** Enterprise-Grade

---

## 🎯 System Architecture

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ INVENTORY LAYER                                              │
│ ┌──────────────┐                                            │
│ │ Inventory    │  Raw materials (flour, cheese, etc.)       │
│ │ Items        │                                            │
│ └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
         ↓ sourceType: 'inventory', sourceId
┌─────────────────────────────────────────────────────────────┐
│ RECIPE LAYER                                                 │
│ ┌──────────────┐         ┌──────────────────┐              │
│ │   Recipe     │────────→│ RecipeVariant    │              │
│ │ (Base Pizza) │         │ (Small/Med/Lrg)  │              │
│ │ - ingredients│         │ - recipeId       │              │
│ │ - totalCost  │         │ - sizeMultiplier │              │
│ └──────────────┘         │ - totalCost      │              │
│                          └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
         ↓ recipeId                    ↓ recipeVariantId
┌─────────────────────────────────────────────────────────────┐
│ MENU LAYER (Customer-Facing)                                │
│ ┌──────────────┐         ┌──────────────────┐              │
│ │  MenuItem    │←────────│ MenuVariation    │              │
│ │ (Pizza)      │         │ (Large +$3)      │              │
│ │ - categoryId │         │ - menuItemId     │              │
│ │ - recipeId   │         │ - recipeVariantId│              │
│ │ - basePrice  │         │ - priceDelta     │              │
│ │ - variants[] │ ✅ AUTO │ - type (size)    │              │
│ └──────────────┘  SYNC  └──────────────────┘              │
│         ↓                                                    │
│ ┌──────────────┐                                            │
│ │ MenuCategory │                                            │
│ │ (PIZZA)      │                                            │
│ └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
         ↓ categoryId
┌─────────────────────────────────────────────────────────────┐
│ ADD-ONS LAYER (Category-Based - Industry Standard)          │
│ ┌──────────────┐         ┌──────────────────┐              │
│ │ AddOnGroup   │────────→│  AddOnItem       │              │
│ │ (TOPPINGS)   │         │  (Extra Cheese)  │              │
│ │ - categoryId │         │  - groupId       │              │
│ │ - name       │         │  - categoryId    │              │
│ └──────────────┘         │  - sourceId      │              │
│                          │  - price         │              │
│                          └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
         ↓ branchId + menuItemId
┌─────────────────────────────────────────────────────────────┐
│ BRANCH LAYER                                                 │
│ ┌──────────────┐         ┌──────────────────┐              │
│ │   Branch     │         │  BranchMenu      │              │
│ │ (Downtown)   │         │  (Config)        │              │
│ │ - currency   │         │  - branchId      │              │
│ │ - tax        │         │  - menuItemId    │              │
│ └──────────────┘         │  - sellingPrice  │              │
│                          │  - isAvailable   │              │
│                          └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
         ↓ GET /t/pos/menu?branchId=xxx
┌─────────────────────────────────────────────────────────────┐
│ POS DISPLAY                                                  │
│ {                                                            │
│   items: [{                                                  │
│     name: "Pizza",                                           │
│     price: 10.00,                                            │
│     variations: [{ name: "Large", priceDelta: 3 }],         │
│     addOns: [{ name: "TOPPINGS", items: [...] }]            │
│   }]                                                         │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 Linking Relationships (Bulletproof)

### 1. **Recipe → MenuItem** (1:1)
```javascript
MenuItem.recipeId → Recipe._id
```
- ✅ Validated at creation
- ✅ Cannot create menu item with invalid recipe

### 2. **RecipeVariant → MenuVariation** (1:1)
```javascript
MenuVariation.recipeVariantId → RecipeVariant._id
RecipeVariant.recipeId → Recipe._id
```
- ✅ Validated: Recipe variant must belong to menu item's recipe
- ✅ Cost auto-calculated from recipe variant

### 3. **MenuItem ↔ MenuVariation** (1:N Bidirectional) ✅ FIXED
```javascript
MenuVariation.menuItemId → MenuItem._id
MenuItem.variants[] ← MenuVariation._id (AUTO-SYNCED)
```
- ✅ **AUTO-POPULATED** when creating variation
- ✅ **AUTO-REMOVED** when deleting variation
- ✅ Bidirectional sync maintained

### 4. **Category → AddOnGroup** (1:N)
```javascript
AddOnGroup.categoryId → MenuCategory._id
```
- ✅ Validated at creation
- ✅ Cannot create group without valid category

### 5. **AddOnGroup → AddOnItem** (1:N)
```javascript
AddOnItem.groupId → AddOnGroup._id
AddOnItem.categoryId → MenuCategory._id (must match group)
```
- ✅ Validated: Item category must match group category
- ✅ Cannot create item without valid group

### 6. **MenuItem → AddOns** (via Category)
```javascript
MenuItem.categoryId → MenuCategory._id → AddOnGroup.categoryId
```
- ✅ Category-based (industry standard)
- ✅ All items in category share add-ons

### 7. **Branch → MenuItem** (N:N)
```javascript
BranchMenu.branchId → Branch._id
BranchMenu.menuItemId → MenuItem._id
```
- ✅ Branch-specific pricing/availability
- ✅ Validated at assignment

---

## 🛡️ Data Integrity Guarantees

### ✅ Variations
1. **Cannot create** variation without valid menu item
2. **Cannot create** variation without recipe (if item has recipe)
3. **Cannot create** duplicate variation names for same item
4. **Auto-syncs** MenuItem.variants[] on create/delete
5. **Validates** recipe variant belongs to correct recipe

### ✅ Add-Ons
1. **Cannot create** group without valid category
2. **Cannot create** item without valid group
3. **Cannot create** item with mismatched category
4. **Cannot delete** group if it has items
5. **Validates** source (inventory/recipe) exists

### ✅ Menu Items
1. **Cannot create** with invalid category
2. **Cannot create** with invalid recipe
3. **Enforces** unique slugs
4. **Validates** pricing structure

---

## 📊 POS Menu API Response

### Endpoint
```
GET /t/pos/menu?branchId=<BRANCH_ID>
```

### Response Structure
```json
{
  "status": 200,
  "message": "POS menu fetched",
  "result": {
    "branch": {
      "id": "branch_id",
      "name": "Downtown Riyadh",
      "currency": "SAR",
      "tax": { "rate": 15, "mode": "exclusive" }
    },
    "categories": [
      {
        "id": "category_id",
        "name": "PIZZA",
        "slug": "pizza",
        "displayOrder": 1,
        "items": [
          {
            "id": "menu_item_id",
            "name": "Margherita Pizza",
            "slug": "margherita-pizza",
            "description": "Classic Italian pizza",
            "categoryId": "category_id",
            "categoryName": "PIZZA",
            "price": 10.00,
            "priceIncludesTax": false,
            "isAvailable": true,
            "isVisibleInPOS": true,
            
            "variations": [
              {
                "id": "variation_id_1",
                "name": "Small",
                "type": "size",
                "priceDelta": -2.00,
                "sizeMultiplier": 0.75,
                "recipeVariantId": "recipe_variant_id",
                "isDefault": false,
                "displayOrder": 1
              },
              {
                "id": "variation_id_2",
                "name": "Large",
                "type": "size",
                "priceDelta": 3.00,
                "sizeMultiplier": 1.5,
                "recipeVariantId": "recipe_variant_id",
                "isDefault": false,
                "displayOrder": 3
              }
            ],
            
            "addOns": [
              {
                "id": "group_id_1",
                "name": "TOPPINGS",
                "description": "Extra toppings",
                "displayOrder": 1,
                "items": [
                  {
                    "id": "item_id_1",
                    "name": "Extra Cheese",
                    "price": 2.50,
                    "unit": "portion",
                    "isRequired": false,
                    "displayOrder": 1
                  },
                  {
                    "id": "item_id_2",
                    "name": "Pepperoni",
                    "price": 3.00,
                    "unit": "portion",
                    "isRequired": false,
                    "displayOrder": 2
                  }
                ]
              },
              {
                "id": "group_id_2",
                "name": "SAUCES",
                "description": "Dipping sauces",
                "displayOrder": 2,
                "items": [
                  {
                    "id": "item_id_3",
                    "name": "BBQ Sauce",
                    "price": 1.00,
                    "unit": "unit",
                    "isRequired": false,
                    "displayOrder": 1
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "items": [ /* Same items, flat array */ ],
    "page": 1,
    "limit": 50,
    "total": 28,
    "count": 6
  }
}
```

---

## 🚀 Complete Setup Flow

### Step 1: Create Inventory Items
```bash
POST /t/inventory/items
{
  "name": "Mozzarella Cheese",
  "sku": "CHEESE-001",
  "baseUnit": "g",
  "costPerUnit": 0.02
}
```

### Step 2: Create Recipe
```bash
POST /t/recipes
{
  "name": "Pizza Base",
  "ingredients": [
    {
      "sourceType": "inventory",
      "sourceId": "<cheese_id>",
      "quantity": 200,
      "unit": "g"
    }
  ]
}
```

### Step 3: Create Recipe Variants
```bash
POST /t/recipe-variants
{
  "recipeId": "<recipe_id>",
  "name": "Large",
  "type": "size",
  "sizeMultiplier": 1.5
}
```

### Step 4: Create Menu Category
```bash
POST /t/menu/categories
{
  "name": "PIZZA",
  "slug": "pizza"
}
```

### Step 5: Create Menu Item
```bash
POST /t/menu/items
{
  "name": "Margherita Pizza",
  "categoryId": "<category_id>",
  "recipeId": "<recipe_id>",
  "pricing": {
    "basePrice": 10.00,
    "currency": "SAR"
  }
}
```

### Step 6: Create Menu Variations
```bash
POST /t/menu-variations
{
  "menuItemId": "<menu_item_id>",
  "recipeVariantId": "<recipe_variant_id>",
  "name": "Large",
  "type": "size",
  "priceDelta": 3.00
}
```
**✅ Result:** `MenuItem.variants[]` automatically populated!

### Step 7: Create Add-On Group
```bash
POST /t/addons/groups
{
  "categoryId": "<category_id>",
  "name": "TOPPINGS",
  "description": "Pizza toppings"
}
```

### Step 8: Create Add-On Items
```bash
POST /t/addons/items
{
  "groupId": "<group_id>",
  "categoryId": "<category_id>",
  "sourceType": "inventory",
  "sourceId": "<cheese_id>",
  "nameSnapshot": "Extra Cheese",
  "price": 2.50
}
```

### Step 9: Assign to Branch
```bash
POST /t/branch-menu
{
  "branchId": "<branch_id>",
  "menuItemId": "<menu_item_id>",
  "isAvailable": true,
  "isVisibleInPOS": true,
  "sellingPrice": 10.00
}
```

### Step 10: Fetch in POS
```bash
GET /t/pos/menu?branchId=<branch_id>
```
**✅ Result:** Complete menu with variations and add-ons!

---

## 🔧 Migration & Maintenance

### Sync Existing Data
```bash
# Check current state
node scripts/migrations/sync-menu-item-variants.js <tenant>

# Apply fixes
node scripts/migrations/sync-menu-item-variants.js <tenant> --execute
```

---

## ✅ Production Checklist

### Before Launch:
- [ ] All menu items have recipes (if using variations)
- [ ] All variations linked to recipe variants
- [ ] Add-on groups created for categories
- [ ] Add-on items assigned to groups
- [ ] Branch menu configured for all branches
- [ ] Run sync script to fix existing data
- [ ] Test POS menu API response

### Data Integrity:
- [ ] No orphaned variations (run audit)
- [ ] No orphaned add-on items (run audit)
- [ ] All MenuItem.variants[] arrays synced
- [ ] All add-on items have valid groups

### Performance:
- [ ] Consider caching POS menu response
- [ ] Monitor query performance
- [ ] Index optimization if needed

---

## 🎯 Key Features

### ✅ Automatic Linking
- MenuItem.variants[] auto-updated on create/delete
- No manual maintenance required
- Bidirectional sync guaranteed

### ✅ Category-Based Add-Ons
- Industry standard (McDonald's, Domino's)
- All items in category share add-ons
- Efficient management

### ✅ Data Integrity
- Validation at every step
- Cannot create orphaned data
- Graceful error handling

### ✅ Production-Ready
- Comprehensive logging
- Non-fatal error handling
- Migration tools included
- Zero breaking changes

---

## 📞 Support

For issues or questions:
1. Run audit: `node scripts/migrations/sync-menu-item-variants.js <tenant>`
2. Check logs for linking errors
3. Verify data structure matches this guide

---

**Status:** ✅ PRODUCTION-READY FOR FOOD CHAINS  
**Last Updated:** 2026-01-01

