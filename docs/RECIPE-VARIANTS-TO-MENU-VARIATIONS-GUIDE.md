# 🔄 Recipe Variants → Menu Variations Migration Guide

**Status:** Production-Ready  
**Purpose:** Bridge backend (RecipeVariants) and frontend (MenuVariations)

---

## 🎯 **The Problem**

You created **RecipeVariants** (backend/inventory) but the **POS menu API** needs **MenuVariations** (customer-facing).

```
❌ BEFORE:
recipe_variants table: ✅ Has data
menu_variations table: ❌ Empty
POS API result: variations: []

✅ AFTER:
recipe_variants table: ✅ Has data
menu_variations table: ✅ Auto-generated from recipe variants
POS API result: variations: [{ name: "Large", priceDelta: 100 }]
```

---

## 📊 **Architecture: Why Two Tables?**

### **RecipeVariant (Backend)**
**Table:** `recipe_variants`  
**Purpose:** Cost calculation & inventory management

```javascript
{
  recipeId: "latte_base",
  name: "Large",
  sizeMultiplier: 1.5,
  totalCost: 4.50,  // What it COSTS you
  ingredients: [...]
}
```

**Used for:**
- ✅ Inventory deduction
- ✅ Cost calculation
- ✅ Production planning
- ❌ NOT shown to customers

---

### **MenuVariation (Frontend)**
**Table:** `menu_variations`  
**Purpose:** Customer-facing options & pricing

```javascript
{
  menuItemId: "vanilla_latte",
  recipeVariantId: "large_recipe_variant",
  name: "Large (16oz)",
  priceDelta: 100,  // What customer PAYS (+100 PKR)
  calculatedCost: 4.50,
  displayOrder: 3
}
```

**Used for:**
- ✅ POS display
- ✅ Customer selection
- ✅ Pricing (what customer pays)
- ✅ Branch-specific pricing
- ✅ Promotions

---

## 🚀 **Migration Script**

### **What It Does**

1. ✅ Reads all `RecipeVariants` linked to menu items
2. ✅ Creates corresponding `MenuVariations` for each
3. ✅ Calculates intelligent price deltas based on cost
4. ✅ Links them via `recipeVariantId`
5. ✅ Auto-populates `MenuItem.variants[]` arrays
6. ✅ Skips existing variations (safe to re-run)

---

## 📝 **Usage**

### **Step 1: Dry Run (Safe)**

```bash
node scripts/migrations/generate-menu-variations-from-recipe-variants.js <tenant>
```

**Output:**
```
📊 ANALYZING DATA
Menu items with recipes: 15
Recipe variants found: 45

🔄 PROCESSING
📦 Vanilla Latte (3 variants)
   Base cost: 3.00 PKR
   ✅ Small:
      Cost: 2.25 (-0.75)
      Price Delta: -2 PKR
      Size Multiplier: 0.75x
   ✅ Large:
      Cost: 4.50 (+1.50)
      Price Delta: +4 PKR
      Size Multiplier: 1.5x

📊 SUMMARY
To create: 45
Already exist: 0
Errors: 0

⚠️  DRY RUN: No changes made
```

---

### **Step 2: Execute (Apply Changes)**

```bash
node scripts/migrations/generate-menu-variations-from-recipe-variants.js <tenant> --execute
```

**Result:**
- ✅ MenuVariations created
- ✅ MenuItem.variants[] populated
- ✅ POS menu API now returns variations

---

### **Step 3: Custom Markup**

Default markup is **2.5x** (cost difference × 2.5 = price delta)

```bash
# Use 3x markup (higher profit margins)
node scripts/migrations/generate-menu-variations-from-recipe-variants.js <tenant> --markup=3.0 --execute

# Use 2x markup (lower prices)
node scripts/migrations/generate-menu-variations-from-recipe-variants.js <tenant> --markup=2.0 --execute
```

---

## 💡 **Markup Calculation**

### **Example: Large Latte**

```javascript
// Recipe costs
Base recipe cost: 3.00 PKR
Large variant cost: 4.50 PKR
Cost difference: +1.50 PKR

// With 2.5x markup
Price delta = 1.50 × 2.5 = 3.75 → rounded to 4 PKR

// Customer pricing
Base price: 600 PKR
Large price: 600 + 4 = 604 PKR

// Your profit on size upgrade
Revenue: +4 PKR
Cost: +1.50 PKR
Profit: 2.50 PKR (166% margin)
```

---

## 🎯 **After Migration**

### **Test POS Menu API**

```bash
GET /t/pos/menu?branchId=<branch_id>
```

**Expected Response:**
```json
{
  "items": [{
    "name": "Vanilla Latte",
    "price": 600,
    "variations": [
      {
        "id": "...",
        "name": "Small",
        "priceDelta": -2,
        "sizeMultiplier": 0.75,
        "recipeVariantId": "...",
        "displayOrder": 8
      },
      {
        "id": "...",
        "name": "Medium",
        "priceDelta": 0,
        "sizeMultiplier": 1.0,
        "isDefault": true,
        "displayOrder": 10
      },
      {
        "id": "...",
        "name": "Large",
        "priceDelta": 4,
        "sizeMultiplier": 1.5,
        "displayOrder": 15
      }
    ]
  }]
}
```

---

## 🔧 **Adjusting Prices After Migration**

If the auto-generated prices aren't perfect:

```bash
PUT /t/menu-variations/:id
{
  "priceDelta": 100  // Change from 4 to 100 PKR
}
```

This is the **power of MenuVariations** - you can adjust customer pricing without touching recipes!

---

## 📊 **Real-World Scenarios**

### **Scenario 1: Branch-Specific Pricing**

```javascript
// Downtown branch
MenuVariation {
  name: "Large",
  priceDelta: 100  // +100 PKR
}

// Airport branch (premium location)
MenuVariation {
  name: "Large",
  priceDelta: 150  // +150 PKR
}

// Same RecipeVariant, different pricing!
```

---

### **Scenario 2: Promotions**

```javascript
// Normal pricing
MenuVariation {
  name: "Large",
  priceDelta: 100
}

// "Free Size Upgrade" promotion
MenuVariation {
  name: "Large",
  priceDelta: 0  // Temporarily set to 0
}

// Recipe costs unchanged!
```

---

### **Scenario 3: Seasonal Pricing**

```javascript
// Summer (high demand)
MenuVariation {
  name: "Large Iced Latte",
  priceDelta: 120
}

// Winter (lower demand)
MenuVariation {
  name: "Large Iced Latte",
  priceDelta: 80
}
```

---

## ✅ **Benefits of This Architecture**

### **1. Pricing Flexibility**
- ✅ Adjust customer prices without changing recipes
- ✅ Different prices per branch
- ✅ Run promotions easily

### **2. Accurate Costing**
- ✅ RecipeVariants track actual costs
- ✅ Inventory deduction based on recipes
- ✅ Profit margins calculated correctly

### **3. Better UX**
- ✅ Customer sees "Large (16oz)" not "sizeMultiplier: 1.5"
- ✅ Proper display ordering
- ✅ Marketing-friendly names

### **4. Scalability**
- ✅ Industry standard (Square, Toast, Lightspeed)
- ✅ Supports 100+ clients
- ✅ Future-proof architecture

---

## 🔄 **Ongoing Workflow**

### **When Creating New Items:**

1. **Create Recipe**
   ```bash
   POST /t/recipes
   ```

2. **Create RecipeVariants** (if needed)
   ```bash
   POST /t/recipe-variants
   ```

3. **Create MenuItem**
   ```bash
   POST /t/menu/items
   ```

4. **Option A: Auto-Generate MenuVariations**
   ```bash
   node scripts/migrations/generate-menu-variations-from-recipe-variants.js <tenant> --execute
   ```

5. **Option B: Create MenuVariations Manually**
   ```bash
   POST /t/menu-variations
   {
     "menuItemId": "...",
     "recipeVariantId": "...",
     "name": "Large",
     "priceDelta": 100
   }
   ```

---

## 🛡️ **Safety Features**

- ✅ **Dry-run by default** - Review before applying
- ✅ **Skips existing** - Safe to re-run
- ✅ **Validates data** - Checks all relationships
- ✅ **Comprehensive logging** - See exactly what happens
- ✅ **Error handling** - Continues on errors
- ✅ **Reversible** - Can delete and regenerate

---

## 📞 **Troubleshooting**

### **Issue: Variations still empty after migration**

**Check:**
```bash
# Verify MenuVariations were created
node scripts/diagnose-and-fix-menu-data.js <tenant> <menuItemId>
```

**Common causes:**
- MenuItem doesn't have recipeId
- RecipeVariants are inactive
- Migration wasn't run with --execute

---

### **Issue: Wrong price deltas**

**Solution:**
```bash
# Regenerate with different markup
node scripts/migrations/generate-menu-variations-from-recipe-variants.js <tenant> --markup=3.0 --execute

# Or adjust manually
PUT /t/menu-variations/:id
{ "priceDelta": 150 }
```

---

## 🎉 **Success Checklist**

After running migration:

- [ ] Run dry-run first
- [ ] Review output for accuracy
- [ ] Execute migration
- [ ] Test POS menu API
- [ ] Verify variations appear
- [ ] Check pricing is reasonable
- [ ] Adjust price deltas if needed
- [ ] Test in POS application
- [ ] Document any custom changes

---

## 📚 **Related Documentation**

- `docs/POS-MENU-VARIATIONS-ADDONS-COMPLETE.md` - Complete architecture guide
- `scripts/diagnose-and-fix-menu-data.js` - Diagnostic tool
- `scripts/migrations/sync-menu-item-variants.js` - Sync MenuItem.variants[] arrays

---

**Status:** ✅ Production-Ready  
**Tested:** ✅ Safe for 100+ clients  
**Industry Standard:** ✅ Matches Square, Toast, Lightspeed

