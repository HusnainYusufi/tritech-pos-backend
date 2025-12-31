# 🔍 Menu System Linking Analysis

## Current Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INVENTORY LAYER                                  │
│  ┌──────────────────┐                                                   │
│  │ Inventory Items  │  (Raw materials: flour, cheese, pepperoni, etc.)  │
│  └──────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ sourceType: 'inventory'
┌─────────────────────────────────────────────────────────────────────────┐
│                         RECIPE LAYER                                     │
│  ┌──────────────────┐         ┌──────────────────────┐                 │
│  │   Recipe         │         │  RecipeVariant       │                 │
│  │  (Base Pizza)    │────────→│  (Small/Med/Large)   │                 │
│  │  - ingredients   │         │  - recipeId          │                 │
│  │  - totalCost     │         │  - sizeMultiplier    │                 │
│  └──────────────────┘         │  - ingredients       │                 │
│                                │  - totalCost         │                 │
│                                └──────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ recipeId
┌─────────────────────────────────────────────────────────────────────────┐
│                         MENU LAYER (Customer-Facing)                     │
│  ┌──────────────────┐         ┌──────────────────────┐                 │
│  │   MenuItem       │         │  MenuVariation       │                 │
│  │  (Pizza Product) │         │  (Size options)      │                 │
│  │  - categoryId    │         │  - menuItemId        │                 │
│  │  - recipeId      │         │  - recipeVariantId   │                 │
│  │  - basePrice     │         │  - priceDelta        │                 │
│  │  - variants[]    │◀────────│  - type (size/etc)   │                 │
│  │  - addOns[]      │         │  - isActive          │                 │
│  └──────────────────┘         └──────────────────────┘                 │
│         ↓                                                                │
│  ┌──────────────────┐                                                   │
│  │  MenuCategory    │                                                   │
│  │  (PIZZA, LATTE)  │                                                   │
│  └──────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ categoryId
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADD-ONS LAYER                                    │
│  ┌──────────────────┐         ┌──────────────────────┐                 │
│  │  AddOnGroup      │         │   AddOnItem          │                 │
│  │  (SAUCES)        │────────→│   (BBQ Sauce)        │                 │
│  │  - categoryId    │         │   - groupId          │                 │
│  │  - isActive      │         │   - categoryId       │                 │
│  └──────────────────┘         │   - sourceType       │                 │
│                                │   - sourceId         │                 │
│                                │   - price            │                 │
│                                └──────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ branchId + menuItemId
┌─────────────────────────────────────────────────────────────────────────┐
│                         BRANCH LAYER                                     │
│  ┌──────────────────┐         ┌──────────────────────┐                 │
│  │   Branch         │         │   BranchMenu         │                 │
│  │  (Downtown)      │         │   (Config)           │                 │
│  │  - name          │         │   - branchId         │                 │
│  │  - currency      │         │   - menuItemId       │                 │
│  │  - tax           │         │   - sellingPrice     │                 │
│  └──────────────────┘         │   - isAvailable      │                 │
│                                │   - isVisibleInPOS   │                 │
│                                └──────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔴 CRITICAL BUGS IDENTIFIED

### Bug #1: MenuItem.variants[] and MenuItem.addOns[] are NEVER POPULATED

**Schema Definition:**
```javascript
// MenuItem.schema.js line 35-36
variants: [{ type: Schema.Types.ObjectId, ref: 'MenuVariation' }],
addOns: [{ type: Schema.Types.ObjectId, ref: 'AddOn' }],
```

**Problem:**
- These arrays exist in the schema but are **NEVER written to** when creating variations/add-ons
- `MenuVariation` has `menuItemId` pointing to MenuItem ✅
- But `MenuItem.variants[]` is never updated with the variation IDs ❌

**Evidence:**
```javascript
// MenuVariationService.create() - Line 133-149
const doc = await Repo.create(conn, {
  menuItemId: d.menuItemId,  // ✅ Links variation → menu item
  recipeVariantId: d.recipeVariantId || null,
  name: variationName,
  // ... creates variation
});
// ❌ NEVER updates MenuItem.variants[] array!
```

**Impact:**
- `MenuItem.variants[]` remains empty `[]`
- `MenuItem.addOns[]` remains empty `[]`
- Cannot populate variations using `.populate('variants')`
- Must always query `MenuVariation.find({ menuItemId })` separately

---

### Bug #2: Add-On Groups Don't Exist (Data Integrity Issue)

**Problem:**
- 51 `AddOnItem` documents exist
- 0 `AddOnGroup` documents exist
- All add-on items are orphaned (referencing non-existent groupIds)

**Root Cause:**
- Groups were deleted OR never created properly
- No foreign key constraints to prevent orphaning
- No cascade delete to clean up items when group is deleted

---

### Bug #3: MenuItem.addOns[] References Wrong Model

**Schema says:**
```javascript
addOns: [{ type: Schema.Types.ObjectId, ref: 'AddOn' }],
```

**But the model is called:**
- `AddOnGroup` (not `AddOn`)
- `AddOnItem` (not `AddOn`)

**There is NO model named 'AddOn'!**

This reference is broken and will fail if you try to populate it.

---

### Bug #4: Category-Based vs Item-Based Add-Ons Confusion

**Current Design:**
- `AddOnGroup.categoryId` → Add-ons belong to **categories**
- `MenuItem.addOns[]` → Suggests add-ons belong to **individual items**

**Conflict:**
- If add-ons are category-wide, why does MenuItem have `addOns[]`?
- If add-ons are per-item, why does AddOnGroup have `categoryId`?

**Current POS Menu Implementation:**
My code assumes category-based (which seems correct for POS systems):
```javascript
// Get add-ons by category
const addOnsForItem = addOnGroupsByCategory.get(String(m.categoryId))
```

---

## ✅ PROPER LINKING DESIGN (Industry Standard)

### Option A: Category-Based Add-Ons (Recommended for POS)

```
MenuCategory (PIZZA)
    ↓
AddOnGroup (SAUCES, TOPPINGS, EXTRAS)
    ↓
AddOnItem (BBQ Sauce, Extra Cheese, Jalapeños)
    ↓ Applied to ALL items in category
MenuItem (Margherita, Pepperoni, Hawaiian)
```

**Pros:**
- Simpler management
- Consistent add-ons across category
- Matches how real POS systems work (e.g., all pizzas get same topping options)

**Cons:**
- Less flexibility per item

---

### Option B: Item-Based Add-Ons (More Flexible)

```
MenuItem (Margherita Pizza)
    ↓ MenuItem.addOns[] = [group1, group2]
AddOnGroup (PIZZA TOPPINGS)
    ↓
AddOnItem (Extra Cheese, Pepperoni)
```

**Pros:**
- Per-item customization
- Different items can have different add-on groups

**Cons:**
- More complex to manage
- Requires updating MenuItem.addOns[] when creating groups

---

## 🛠️ FIXES REQUIRED

### Fix #1: Update MenuItem.variants[] When Creating Variations

**In MenuVariationService.create():**
```javascript
// After creating variation
const doc = await Repo.create(conn, { ... });

// ✅ ADD THIS: Update parent MenuItem.variants[] array
await ItemRepo.model(conn).findByIdAndUpdate(
  d.menuItemId,
  { $addToSet: { variants: doc._id } }
);
```

---

### Fix #2: Fix MenuItem.addOns[] Reference

**Change schema from:**
```javascript
addOns: [{ type: Schema.Types.ObjectId, ref: 'AddOn' }],
```

**To (if category-based):**
```javascript
// Remove this field entirely - add-ons come from category
```

**Or (if item-based):**
```javascript
addOns: [{ type: Schema.Types.ObjectId, ref: 'AddOnGroup' }],
```

---

### Fix #3: Decide on Add-On Strategy

**If Category-Based (Current POS Implementation):**
- Remove `MenuItem.addOns[]` field
- Keep `AddOnGroup.categoryId`
- POS fetches add-ons by category (already implemented)

**If Item-Based:**
- Keep `MenuItem.addOns[]` but fix reference
- Update `MenuItem.addOns[]` when assigning groups
- POS fetches add-ons from `MenuItem.addOns[]`

---

### Fix #4: Clean Up Orphaned Data

```javascript
// Delete orphaned add-on items
await AddOnItem.deleteMany({ groupId: { $nin: existingGroupIds } });
```

---

## 📊 CURRENT STATE SUMMARY

| Component | Status | Issue |
|-----------|--------|-------|
| Recipe → MenuItem | ✅ Working | Linked via `recipeId` |
| RecipeVariant → MenuVariation | ✅ Working | Linked via `recipeVariantId` |
| MenuVariation → MenuItem | ⚠️ One-way | `menuItemId` set, but `MenuItem.variants[]` empty |
| MenuItem → Category | ✅ Working | Linked via `categoryId` |
| AddOnGroup → Category | ✅ Working | Linked via `categoryId` |
| AddOnItem → AddOnGroup | ❌ Broken | 51 orphaned items, 0 groups |
| MenuItem → AddOns | ❌ Broken | References non-existent 'AddOn' model |
| Branch → MenuItem | ✅ Working | Via `BranchMenu` config |

---

## 🎯 RECOMMENDATION

**Adopt Category-Based Add-Ons:**
1. Remove `MenuItem.addOns[]` field from schema
2. Keep current `AddOnGroup.categoryId` design
3. Fix orphaned add-on items by creating proper groups
4. Update `MenuItem.variants[]` when creating variations
5. POS menu already implements category-based lookup ✅

This matches industry standards (McDonald's, Domino's, etc.) where all items in a category share the same add-on options.

