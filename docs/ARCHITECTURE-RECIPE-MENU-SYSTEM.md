# 🏗️ Recipe & Menu Architecture - Production POS Design

## 🚨 CRITICAL PROBLEM IDENTIFIED

You currently have **TWO DISCONNECTED SYSTEMS**:

1. **Recipe System** (`Recipe` + `RecipeVariant`) - for cost calculation
2. **Menu System** (`MenuItem` + `MenuVariation`) - for customer ordering

**This is WRONG and will cause major issues!** Here's why and how to fix it.

---

## 📊 How Production POS Systems Work

### Industry Standard Architecture (Square, Toast, Lightspeed, Clover)

```
┌─────────────────────────────────────────────────────────────┐
│                    INVENTORY LAYER                          │
│  (Raw Materials: Flour, Cheese, Pepperoni, Dough, etc.)    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    RECIPE LAYER                             │
│  (How to make things: Pizza Base, Sauce Mix, etc.)         │
│  - Defines ingredients & quantities                         │
│  - Calculates COGS (Cost of Goods Sold)                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    MENU LAYER                               │
│  (What customers see & order)                               │
│  - Links to Recipe                                          │
│  - Has Price (selling price)                                │
│  - Has Variations (size, flavor, etc.)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ CORRECT APPROACH: How to Add Pizza to the System

### Step 1: Create Inventory Items (Raw Materials)

**Admin Action:** Go to Inventory Management

```javascript
// POST /api/inventory-items
[
  {
    name: "Pizza Dough",
    sku: "INV-001",
    type: "stock",
    categoryId: "dough-category-id",
    baseUnit: "g",
    quantity: 5000,
    metadata: { costPerUnit: 0.005 } // $0.005 per gram
  },
  {
    name: "Tomato Sauce",
    sku: "INV-002",
    type: "stock",
    categoryId: "sauce-category-id",
    baseUnit: "ml",
    quantity: 2000,
    metadata: { costPerUnit: 0.01 } // $0.01 per ml
  },
  {
    name: "Mozzarella Cheese",
    sku: "INV-003",
    type: "stock",
    categoryId: "cheese-category-id",
    baseUnit: "g",
    quantity: 3000,
    metadata: { costPerUnit: 0.015 } // $0.015 per gram
  },
  {
    name: "Pepperoni",
    sku: "INV-004",
    type: "stock",
    categoryId: "meat-category-id",
    baseUnit: "g",
    quantity: 1000,
    metadata: { costPerUnit: 0.02 } // $0.02 per gram
  }
]
```

---

### Step 2: Create Base Recipe (Pizza)

**Admin Action:** Go to Recipe Management → Create Recipe

```javascript
// POST /api/recipes
{
  name: "Pizza Base",
  slug: "pizza-base",
  type: "final",
  description: "Standard pizza with dough, sauce, and cheese",
  ingredients: [
    {
      sourceType: "inventory",
      sourceId: "dough-id",
      quantity: 200,
      unit: "g"
    },
    {
      sourceType: "inventory",
      sourceId: "tomato-sauce-id",
      quantity: 50,
      unit: "ml"
    },
    {
      sourceType: "inventory",
      sourceId: "mozzarella-id",
      quantity: 100,
      unit: "g"
    }
  ]
}

// ✅ System auto-calculates:
// totalCost = (200 × 0.005) + (50 × 0.01) + (100 × 0.015) = $3.00
```

---

### Step 3: Create Recipe Variants (Size Variations)

**Admin Action:** Recipe Management → Select "Pizza Base" → Add Variants

```javascript
// POST /api/recipe-variants
// Create Small, Medium, Large variants
[
  {
    recipeId: "pizza-base-id",
    name: "Small",
    type: "size",
    sizeMultiplier: 0.75,
    ingredients: [] // No extra ingredients, just scale base
  },
  {
    recipeId: "pizza-base-id",
    name: "Medium",
    type: "size",
    sizeMultiplier: 1.0,
    ingredients: []
  },
  {
    recipeId: "pizza-base-id",
    name: "Large",
    type: "size",
    sizeMultiplier: 1.5,
    ingredients: []
  }
]

// ✅ System auto-calculates:
// Small totalCost = $3.00 × 0.75 = $2.25
// Medium totalCost = $3.00 × 1.0 = $3.00
// Large totalCost = $3.00 × 1.5 = $4.50
```

---

### Step 4: Create Recipe Variants (Flavor Variations)

**Admin Action:** Recipe Management → Select "Pizza Base" → Add Flavor Variants

```javascript
// POST /api/recipe-variants
[
  {
    recipeId: "pizza-base-id",
    name: "Pepperoni",
    type: "flavor",
    sizeMultiplier: 1.0,
    ingredients: [
      {
        sourceType: "inventory",
        sourceId: "pepperoni-id",
        quantity: 50,
        unit: "g"
      }
    ]
  },
  {
    recipeId: "pizza-base-id",
    name: "Fajita",
    type: "flavor",
    sizeMultiplier: 1.0,
    ingredients: [
      {
        sourceType: "inventory",
        sourceId: "chicken-id",
        quantity: 80,
        unit: "g"
      },
      {
        sourceType: "inventory",
        sourceId: "bell-peppers-id",
        quantity: 30,
        unit: "g"
      }
    ]
  }
]

// ✅ System auto-calculates:
// Pepperoni totalCost = $3.00 + (50 × 0.02) = $4.00
// Fajita totalCost = $3.00 + (80 × 0.025) + (30 × 0.01) = $5.30
```

---

### Step 5: Create Menu Item (Customer-Facing Product)

**Admin Action:** Menu Management → Create Menu Item

```javascript
// POST /api/menu-items
{
  name: "Pizza",
  slug: "pizza",
  categoryId: "main-course-category-id",
  recipeId: "pizza-base-id", // 🔗 LINK TO RECIPE
  pricing: {
    basePrice: 10.00, // Selling price (not cost!)
    priceIncludesTax: false,
    currency: "SAR"
  },
  description: "Delicious handmade pizza",
  isActive: true,
  variants: [], // Will be populated next
  addOns: []
}
```

---

### Step 6: Create Menu Variations (Customer Options)

**Admin Action:** Menu Management → Select "Pizza" → Add Variations

```javascript
// POST /api/menu-variations
// Size variations
[
  {
    menuItemId: "pizza-menu-item-id",
    name: "Small",
    type: "size",
    priceDelta: -3.00, // $10 - $3 = $7
    sizeMultiplier: 0.75,
    recipeVariantId: "small-recipe-variant-id" // 🔗 LINK TO RECIPE VARIANT
  },
  {
    menuItemId: "pizza-menu-item-id",
    name: "Medium",
    type: "size",
    priceDelta: 0, // $10 + $0 = $10
    sizeMultiplier: 1.0,
    recipeVariantId: "medium-recipe-variant-id",
    isDefault: true
  },
  {
    menuItemId: "pizza-menu-item-id",
    name: "Large",
    type: "size",
    priceDelta: 5.00, // $10 + $5 = $15
    sizeMultiplier: 1.5,
    recipeVariantId: "large-recipe-variant-id"
  }
]

// Flavor variations
[
  {
    menuItemId: "pizza-menu-item-id",
    name: "Pepperoni",
    type: "flavor",
    priceDelta: 2.00, // Add $2 for pepperoni
    recipeVariantId: "pepperoni-recipe-variant-id"
  },
  {
    menuItemId: "pizza-menu-item-id",
    name: "Fajita",
    type: "flavor",
    priceDelta: 3.50, // Add $3.50 for fajita
    recipeVariantId: "fajita-recipe-variant-id"
  }
]
```

---

## 🎯 FINAL RESULT: What Customer Sees

### POS Screen / Online Menu

```
┌─────────────────────────────────────────────────────┐
│  🍕 Pizza                                   $10.00  │
│  Delicious handmade pizza                           │
│                                                     │
│  Choose Size:                                       │
│  ○ Small (-$3.00)    ● Medium    ○ Large (+$5.00) │
│                                                     │
│  Choose Flavor:                                     │
│  ○ Plain    ○ Pepperoni (+$2.00)    ○ Fajita (+$3.50) │
│                                                     │
│  [Add to Cart]                                      │
└─────────────────────────────────────────────────────┘
```

### When Customer Orders "Large Pepperoni Pizza"

```javascript
// Order Calculation:
{
  menuItem: "Pizza",
  basePrice: 10.00,
  variations: [
    { name: "Large", type: "size", priceDelta: 5.00 },
    { name: "Pepperoni", type: "flavor", priceDelta: 2.00 }
  ],
  finalPrice: 10.00 + 5.00 + 2.00 = $17.00,
  
  // Cost Calculation (for profit margin):
  baseCost: 3.00, // Pizza Base recipe
  variationCosts: [
    { name: "Large", multiplier: 1.5, cost: 3.00 × 1.5 = 4.50 },
    { name: "Pepperoni", additionalCost: 1.00 }
  ],
  finalCost: 4.50 + 1.00 = $5.50,
  
  profit: $17.00 - $5.50 = $11.50 (67.6% margin) ✅
}
```

---

## 🔧 WHAT YOU NEED TO FIX

### Problem 1: MenuVariation Missing Recipe Link

**Current Schema:**
```javascript
// MenuVariation.schema.js
const MenuVariationSchema = new Schema({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  priceDelta: { type: Number, default: 0 },
  // ❌ NO LINK TO RECIPE VARIANT!
});
```

**Fixed Schema:**
```javascript
const MenuVariationSchema = new Schema({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  priceDelta: { type: Number, default: 0 },
  
  // ✅ ADD THIS:
  recipeVariantId: { 
    type: Schema.Types.ObjectId, 
    ref: 'RecipeVariant', 
    default: null,
    index: true 
  },
  
  // Keep existing fields for backward compatibility
  sizeMultiplier: { type: Number, default: 1 },
  ingredients: { type: [VariationIngredientSchema], default: [] }
});
```

---

### Problem 2: Need Helper Service for Cost Calculation

**Create: `features/menu/services/menuCostCalculator.service.js`**

```javascript
class MenuCostCalculator {
  /**
   * Calculate final cost when customer orders with variations
   */
  static async calculateOrderCost(conn, menuItemId, selectedVariationIds) {
    const menuItem = await MenuItemRepo.getById(conn, menuItemId);
    const recipe = await RecipeRepo.getById(conn, menuItem.recipeId);
    
    let totalCost = recipe.totalCost;
    let sizeMultiplier = 1.0;
    
    for (const varId of selectedVariationIds) {
      const menuVar = await MenuVariationRepo.getById(conn, varId);
      
      if (menuVar.recipeVariantId) {
        // Use linked recipe variant cost
        const recipeVar = await RecipeVariantRepo.getById(conn, menuVar.recipeVariantId);
        
        if (menuVar.type === 'size') {
          sizeMultiplier = recipeVar.sizeMultiplier;
          totalCost = recipe.totalCost * sizeMultiplier;
        } else {
          // Add flavor/topping cost (also scaled by size)
          totalCost += recipeVar.totalCost * sizeMultiplier;
        }
      }
    }
    
    return { totalCost, sizeMultiplier };
  }
}
```

---

## 📋 ADMIN WORKFLOW SUMMARY

### Complete Flow: Adding Pizza to System

```
1. Inventory Setup (One-time)
   ├─ Create Inventory Categories (Dough, Cheese, Meat, etc.)
   └─ Add Inventory Items (Raw materials with costs)

2. Recipe Creation (Backend)
   ├─ Create Base Recipe: "Pizza Base"
   │  └─ Add ingredients from inventory
   ├─ Create Size Variants: Small, Medium, Large
   │  └─ Set sizeMultiplier for each
   └─ Create Flavor Variants: Pepperoni, Fajita, etc.
      └─ Add extra ingredients for each

3. Menu Creation (Customer-Facing)
   ├─ Create Menu Item: "Pizza"
   │  ├─ Link to Recipe: "Pizza Base"
   │  └─ Set Base Price: $10.00
   └─ Create Menu Variations
      ├─ Size Options (Small, Medium, Large)
      │  ├─ Link each to Recipe Variant
      │  └─ Set price deltas
      └─ Flavor Options (Pepperoni, Fajita)
         ├─ Link each to Recipe Variant
         └─ Set price deltas

4. Result
   └─ Customer can order any combination
      └─ System automatically calculates:
         ├─ Final Price (for customer)
         ├─ Final Cost (for profit tracking)
         └─ Inventory deductions
```

---

## 🚀 RECOMMENDED CHANGES

### 1. Update MenuVariation Schema (CRITICAL)

Add `recipeVariantId` field to link menu variations to recipe variants.

### 2. Create Migration Script

Existing menu variations need to be linked to recipe variants.

### 3. Update Admin UI Flow

```
Menu Management Screen:
├─ Step 1: Create/Select Menu Item
├─ Step 2: Link to Recipe (dropdown)
├─ Step 3: Add Variations
│  ├─ Select Recipe Variant (dropdown)
│  ├─ Set Customer-Facing Name
│  └─ Set Price Delta
└─ Step 4: Preview & Save
```

### 4. Add Validation

- Menu Item MUST have a Recipe linked
- Menu Variation SHOULD have a Recipe Variant linked (optional for custom variations)
- Recipe Variant MUST belong to the same Recipe as Menu Item

---

## 📊 Comparison: Your System vs Production POS

| Feature | Your Current System | Production POS | Status |
|---------|-------------------|----------------|--------|
| Inventory Management | ✅ Good | ✅ | ✅ GOOD |
| Recipe System | ✅ Good | ✅ | ✅ GOOD |
| Recipe Variants | ✅ Good | ✅ | ✅ GOOD |
| Menu Items | ✅ Good | ✅ | ✅ GOOD |
| Menu Variations | ⚠️ Partial | ✅ | ❌ NEEDS FIX |
| Recipe ↔ Menu Link | ✅ Good | ✅ | ✅ GOOD |
| RecipeVariant ↔ MenuVariation Link | ❌ Missing | ✅ | ❌ CRITICAL |
| Cost Calculation | ⚠️ Partial | ✅ | ⚠️ NEEDS WORK |
| Inventory Deduction | ❓ Unknown | ✅ | ❓ CHECK |

---

## 🎓 Key Concepts

### Recipe vs Menu Item

- **Recipe** = "How to make it" (internal, cost-focused)
- **Menu Item** = "How to sell it" (customer-facing, price-focused)

### Recipe Variant vs Menu Variation

- **Recipe Variant** = "Different ways to make it" (cost implications)
- **Menu Variation** = "Different options for customer" (price implications)

### Why Separate Them?

1. **Flexibility**: Same recipe can be sold under different menu items
2. **Pricing Strategy**: Cost ≠ Price (you set margins)
3. **Multi-Brand**: Same recipe, different brands/menus
4. **Testing**: Change prices without affecting recipes

---

## ✅ NEXT STEPS

1. **Update MenuVariation Schema** - Add `recipeVariantId` field
2. **Create MenuCostCalculator Service** - Calculate costs accurately
3. **Update Admin UI** - Link recipe variants when creating menu variations
4. **Add Validation** - Ensure data integrity
5. **Create Migration** - Link existing data
6. **Update Documentation** - Admin user guide

---

## 📞 Questions to Answer

1. Should every MenuVariation REQUIRE a RecipeVariant? (Recommended: No, allow custom)
2. How to handle combo deals? (Multiple recipes in one menu item)
3. Should size multiply ALL flavors? (Recommended: Yes)
4. How to handle seasonal/temporary toppings? (Use isActive flag)

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-21  
**Status:** 🚨 CRITICAL - Requires immediate action
