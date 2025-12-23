# Swagger Documentation Updates - v2.0

## ✅ Complete Swagger Update Summary

All Swagger documentation has been updated to reflect the new v2.0 architecture with variation support.

---

## 📝 Files Updated

### 1. **Configuration Files**

#### `config/swagger.config.js`
- ✅ Updated production URL to: `https://api.tritechtechnologyllc.com`
- ✅ Added `MenuVariation` schema with new fields:
  - `recipeVariantId` (NEW v2.0)
  - `calculatedCost` (NEW v2.0)
  - Enhanced descriptions for all fields
- ✅ Enhanced `PosOrder` schema with:
  - `selectedVariations` array (NEW v2.0)
  - `calculatedCost` in order items (NEW v2.0)
  - Complete variation details structure

#### `config/swagger.js`
- ✅ Added production server URL: `https://api.tritechtechnologyllc.com`

---

### 2. **Controller Documentation**

#### `features/menu/controller/MenuVariationController.js`
✅ **POST /t/menu/variations** - Enhanced with:
- New `recipeVariantId` field documentation
- `calculatedCost` field in response
- Validation rules (price delta range, size multiplier limits)
- Multiple examples (size variation, flavor variation)
- Production URL reference
- Error responses (409 for duplicate names)

✅ **GET /t/menu/variations** - Updated response schema

✅ **GET /t/menu/variations/{id}** - Updated response schema

✅ **PUT /t/menu/variations/{id}** - Updated request/response schema

✅ **DELETE /t/menu/variations/{id}** - Updated response schema

---

#### `features/pos/controller/PosOrderController.js`
✅ **POST /t/pos/orders** - Enhanced with:
- New `variations` array in order items
- Complete variation structure documentation
- Two examples:
  - Order with variations (Large Pepperoni Pizza)
  - Simple order without variations
- Detailed field descriptions
- Production URL reference

✅ **GET /t/pos/orders/{id}/receipt** - Updated response schema

---

#### `features/recipe/controller/RecipeController.js`
✅ **POST /t/recipes/with-variants** - Enhanced with:
- Complete request body schema
- All variation properties documented
- Transaction safety explanation
- Example with pizza and size variations
- Production URL reference
- Detailed response schema

✅ **GET /t/recipes/{id}/with-variants** - Updated response schema

✅ **GET /t/recipes/by-slug/{slug}/with-variations** - Updated response schema

---

## 📊 New Schema Definitions

### MenuVariation Schema
```yaml
MenuVariation:
  type: object
  properties:
    _id: string
    menuItemId: string
    recipeVariantId: string (NEW v2.0) - Linked recipe variant
    name: string (unique per menu item)
    type: enum [size, crust, flavor, addon, combo, custom]
    priceDelta: number
    calculatedCost: number (NEW v2.0) - Auto-calculated
    sizeMultiplier: number (0.01 to 10)
    isDefault: boolean
    isActive: boolean
    displayOrder: number
    createdAt: date-time
    updatedAt: date-time
```

### PosOrder Schema (Enhanced)
```yaml
PosOrder:
  type: object
  properties:
    orderNumber: string
    items:
      type: array
      items:
        menuItemId: string
        recipeIdSnapshot: string
        selectedVariations: (NEW v2.0)
          type: array
          items:
            menuVariationId: string
            recipeVariantId: string
            nameSnapshot: string
            type: string
            priceDelta: number
            sizeMultiplier: number
            calculatedCost: number
        quantity: number
        unitPrice: number
        lineTotal: number
        calculatedCost: number (NEW v2.0)
        priceIncludesTax: boolean
        notes: string
    totals:
      subTotal: number
      taxTotal: number
      discount: number
      grandTotal: number
    status: enum [placed, paid, void, refunded]
    paymentMethod: enum [cash, card, mobile, split]
```

---

## 🎯 Key Documentation Improvements

### 1. **Production URL Added**
All endpoints now reference:
```
Production URL: https://api.tritechtechnologyllc.com
```

### 2. **Version Indicators**
All new fields marked with:
```
✅ NEW v2.0: [Field description]
```

### 3. **Complete Examples**
- Menu variation creation with recipe variant link
- Order creation with variations
- Recipe creation with variants

### 4. **Enhanced Descriptions**
- Field purposes explained
- Validation rules documented
- Business logic described
- Error scenarios covered

### 5. **Response Schemas**
- All new fields included
- Calculated fields documented
- Snapshot fields explained

---

## 🔍 How to View Updated Swagger

### Local Development
```bash
# Start server
npm start

# Access Swagger UI
http://localhost:3000/api-docs
```

### Production
```
https://api.tritechtechnologyllc.com/api-docs
```

### Generate Swagger JSON
```bash
npm run swagger:generate
# Output: swagger-output.json
```

---

## 📋 Swagger Endpoints Updated

### Menu Variations
- ✅ `POST /t/menu/variations` - Create with recipe variant link
- ✅ `GET /t/menu/variations` - List all variations
- ✅ `GET /t/menu/variations/{id}` - Get variation details
- ✅ `GET /t/menu/variations/by-item/{menuItemId}` - Get by menu item
- ✅ `PUT /t/menu/variations/{id}` - Update variation
- ✅ `DELETE /t/menu/variations/{id}` - Delete variation

### POS Orders
- ✅ `POST /t/pos/orders` - Create order with variations
- ✅ `GET /t/pos/orders/{id}` - Get order details
- ✅ `GET /t/pos/orders/{id}/receipt` - Get receipt

### Recipes
- ✅ `POST /t/recipes/with-variants` - Create recipe with variants (atomic)
- ✅ `POST /t/recipes` - Create recipe (standard)
- ✅ `GET /t/recipes` - List recipes
- ✅ `GET /t/recipes/{id}` - Get recipe
- ✅ `GET /t/recipes/{id}/with-variants` - Get recipe with variants
- ✅ `GET /t/recipes/by-slug/{slug}/with-variants` - Get by slug with variants
- ✅ `PUT /t/recipes/{id}` - Update recipe
- ✅ `DELETE /t/recipes/{id}` - Delete recipe

---

## ✅ Verification Checklist

- [x] Production URL set correctly
- [x] MenuVariation schema includes new fields
- [x] PosOrder schema includes selectedVariations
- [x] All controller endpoints documented
- [x] Examples provided for new features
- [x] Error responses documented
- [x] Validation rules explained
- [x] Version indicators added
- [x] Field descriptions complete

---

## 🎉 Summary

**All Swagger documentation is now:**
- ✅ **Complete** - All new fields documented
- ✅ **Accurate** - Matches actual API implementation
- ✅ **Production-Ready** - Includes production URL
- ✅ **User-Friendly** - Examples and descriptions provided
- ✅ **Versioned** - Clear indicators of v2.0 changes

**Access Swagger UI:**
- **Local:** http://localhost:3000/api-docs
- **Production:** https://api.tritechtechnologyllc.com/api-docs

---

**Updated By:** Head of Engineering  
**Date:** 2025-01-01  
**Version:** 2.0.0

