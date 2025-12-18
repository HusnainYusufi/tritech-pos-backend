# Recipe with Variants API - Production Documentation

## 🚀 Overview

The **Recipe with Variants** endpoint allows you to create a recipe and all its variations in a **single atomic transaction**. This ensures data consistency - if any part fails, the entire operation rolls back.

### Key Features

✅ **Atomic Transaction** - All-or-nothing operation  
✅ **Bulk Optimization** - Efficient bulk inserts for variants  
✅ **Cost Calculation** - Automatic cost computation for recipe and variants  
✅ **Validation** - Comprehensive input validation  
✅ **Circular Detection** - Prevents circular recipe dependencies  
✅ **Unit Consistency** - Enforces proper unit usage  
✅ **Production Logging** - Detailed operation tracking  
✅ **Scalable** - Handles 1 to 100+ variants efficiently  

---

## 📡 Endpoint

```
POST /t/recipes/with-variants
```

### Headers

```
Authorization: Bearer <JWT_TOKEN>
x-tenant-id: <tenant-slug>
Content-Type: application/json
```

---

## 📥 Request Body Schema

```json
{
  "name": "string (required, 1-160 chars)",
  "customName": "string (optional)",
  "slug": "string (optional, auto-generated from name)",
  "code": "string (optional)",
  "description": "string (optional)",
  "type": "sub | final (optional, default: final)",
  "ingredients": [
    {
      "sourceType": "inventory | recipe (required)",
      "sourceId": "string (required, MongoDB ObjectId)",
      "quantity": "number (required, positive)",
      "unit": "string (required)",
      "costPerUnit": "number (optional, default: 0)",
      "nameSnapshot": "string (optional)"
    }
  ],
  "yield": "number (optional, default: 1)",
  "isActive": "boolean (optional, default: true)",
  "metadata": "object (optional)",
  "variations": [
    {
      "name": "string (required, 1-160 chars)",
      "description": "string (optional)",
      "type": "size | flavor | crust | style | custom (optional, default: custom)",
      "sizeMultiplier": "number (optional, default: 1)",
      "baseCostAdjustment": "number (optional, default: 0)",
      "crustType": "string (optional)",
      "ingredients": [
        {
          "sourceType": "inventory | recipe (required)",
          "sourceId": "string (required)",
          "quantity": "number (required)",
          "unit": "string (required)",
          "costPerUnit": "number (optional)"
        }
      ],
      "isActive": "boolean (optional, default: true)",
      "metadata": "object (optional)"
    }
  ]
}
```

---

## 📤 Response Schema

### Success Response (201 Created)

```json
{
  "status": 201,
  "message": "Recipe created successfully with 3 variant(s)",
  "result": {
    "recipe": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Margherita Pizza",
      "customName": "",
      "slug": "margherita-pizza",
      "code": "PIZZA-001",
      "description": "Classic Italian pizza",
      "type": "final",
      "ingredients": [...],
      "totalCost": 5.50,
      "yield": 1,
      "isActive": true,
      "metadata": {},
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "variants": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "recipeId": "507f1f77bcf86cd799439011",
        "name": "Small",
        "description": "8 inch pizza",
        "type": "size",
        "sizeMultiplier": 0.7,
        "baseCostAdjustment": 0,
        "crustType": "",
        "ingredients": [],
        "totalCost": 3.85,
        "isActive": true,
        "metadata": {},
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439013",
        "recipeId": "507f1f77bcf86cd799439011",
        "name": "Medium",
        "description": "12 inch pizza",
        "type": "size",
        "sizeMultiplier": 1,
        "baseCostAdjustment": 0,
        "crustType": "",
        "ingredients": [],
        "totalCost": 5.50,
        "isActive": true,
        "metadata": {},
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439014",
        "recipeId": "507f1f77bcf86cd799439011",
        "name": "Large",
        "description": "16 inch pizza",
        "type": "size",
        "sizeMultiplier": 1.5,
        "baseCostAdjustment": 0,
        "crustType": "",
        "ingredients": [],
        "totalCost": 8.25,
        "isActive": true,
        "metadata": {},
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "summary": {
      "recipeId": "507f1f77bcf86cd799439011",
      "recipeName": "Margherita Pizza",
      "recipeSlug": "margherita-pizza",
      "recipeCost": 5.50,
      "variantCount": 3,
      "totalIngredients": 5,
      "processingTimeMs": 245
    }
  }
}
```

### Error Responses

#### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "error": {
    "message": "Recipe name is required"
  }
}
```

#### 404 Not Found - Ingredient Missing
```json
{
  "success": false,
  "error": {
    "message": "Inventory item not found: Mozzarella Cheese"
  }
}
```

#### 409 Conflict - Duplicate Slug
```json
{
  "success": false,
  "error": {
    "message": "Recipe with slug \"margherita-pizza\" already exists"
  }
}
```

#### 400 Bad Request - Circular Dependency
```json
{
  "success": false,
  "error": {
    "message": "Circular recipe dependency detected. A recipe cannot reference itself directly or indirectly."
  }
}
```

---

## 📋 Example Requests

### Example 1: Pizza with Size Variations

```json
{
  "name": "Margherita Pizza",
  "code": "PIZZA-001",
  "description": "Classic Italian pizza with tomato sauce, mozzarella, and basil",
  "type": "final",
  "ingredients": [
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12345",
      "quantity": 200,
      "unit": "g",
      "nameSnapshot": "Pizza Dough"
    },
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12346",
      "quantity": 100,
      "unit": "g",
      "nameSnapshot": "Tomato Sauce"
    },
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12347",
      "quantity": 150,
      "unit": "g",
      "nameSnapshot": "Mozzarella Cheese"
    },
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12348",
      "quantity": 10,
      "unit": "g",
      "nameSnapshot": "Fresh Basil"
    }
  ],
  "yield": 1,
  "isActive": true,
  "variations": [
    {
      "name": "Small (8 inch)",
      "description": "Perfect for one person",
      "type": "size",
      "sizeMultiplier": 0.7,
      "baseCostAdjustment": 0,
      "isActive": true
    },
    {
      "name": "Medium (12 inch)",
      "description": "Standard size",
      "type": "size",
      "sizeMultiplier": 1,
      "baseCostAdjustment": 0,
      "isActive": true
    },
    {
      "name": "Large (16 inch)",
      "description": "Great for sharing",
      "type": "size",
      "sizeMultiplier": 1.5,
      "baseCostAdjustment": 0,
      "isActive": true
    },
    {
      "name": "Extra Large (20 inch)",
      "description": "Party size",
      "type": "size",
      "sizeMultiplier": 2,
      "baseCostAdjustment": 0,
      "isActive": true
    }
  ]
}
```

### Example 2: Coffee with Flavor Variations

```json
{
  "name": "Latte",
  "code": "COFFEE-002",
  "description": "Espresso with steamed milk",
  "type": "final",
  "ingredients": [
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12350",
      "quantity": 30,
      "unit": "ml",
      "nameSnapshot": "Espresso"
    },
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12351",
      "quantity": 200,
      "unit": "ml",
      "nameSnapshot": "Milk"
    }
  ],
  "yield": 1,
  "variations": [
    {
      "name": "Vanilla Latte",
      "description": "With vanilla syrup",
      "type": "flavor",
      "sizeMultiplier": 1,
      "baseCostAdjustment": 0.50,
      "ingredients": [
        {
          "sourceType": "inventory",
          "sourceId": "65a1234567890abcdef12352",
          "quantity": 20,
          "unit": "ml",
          "nameSnapshot": "Vanilla Syrup"
        }
      ],
      "isActive": true
    },
    {
      "name": "Caramel Latte",
      "description": "With caramel syrup",
      "type": "flavor",
      "sizeMultiplier": 1,
      "baseCostAdjustment": 0.50,
      "ingredients": [
        {
          "sourceType": "inventory",
          "sourceId": "65a1234567890abcdef12353",
          "quantity": 20,
          "unit": "ml",
          "nameSnapshot": "Caramel Syrup"
        }
      ],
      "isActive": true
    },
    {
      "name": "Hazelnut Latte",
      "description": "With hazelnut syrup",
      "type": "flavor",
      "sizeMultiplier": 1,
      "baseCostAdjustment": 0.50,
      "ingredients": [
        {
          "sourceType": "inventory",
          "sourceId": "65a1234567890abcdef12354",
          "quantity": 20,
          "unit": "ml",
          "nameSnapshot": "Hazelnut Syrup"
        }
      ],
      "isActive": true
    }
  ]
}
```

### Example 3: Recipe Only (No Variations)

```json
{
  "name": "Caesar Salad",
  "code": "SALAD-001",
  "description": "Classic Caesar salad",
  "type": "final",
  "ingredients": [
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12360",
      "quantity": 200,
      "unit": "g",
      "nameSnapshot": "Romaine Lettuce"
    },
    {
      "sourceType": "recipe",
      "sourceId": "65a1234567890abcdef12361",
      "quantity": 1,
      "unit": "portion",
      "nameSnapshot": "Caesar Dressing"
    },
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12362",
      "quantity": 30,
      "unit": "g",
      "nameSnapshot": "Parmesan Cheese"
    },
    {
      "sourceType": "inventory",
      "sourceId": "65a1234567890abcdef12363",
      "quantity": 50,
      "unit": "g",
      "nameSnapshot": "Croutons"
    }
  ],
  "yield": 1,
  "isActive": true,
  "variations": []
}
```

---

## 🎯 Use Cases

### 1. **Pizza Restaurant**
- Base recipe: Margherita Pizza
- Variations: Small, Medium, Large, Extra Large

### 2. **Coffee Shop**
- Base recipe: Latte
- Variations: Vanilla, Caramel, Hazelnut, Mocha

### 3. **Burger Joint**
- Base recipe: Classic Burger
- Variations: Single, Double, Triple patty

### 4. **Ice Cream Parlor**
- Base recipe: Vanilla Ice Cream
- Variations: Cup, Cone, Waffle Cone, Sundae

### 5. **Bakery**
- Base recipe: Chocolate Cake
- Variations: 6-inch, 8-inch, 10-inch, 12-inch

---

## ⚡ Performance Characteristics

### Benchmarks (Tested on Standard MongoDB Instance)

| Variant Count | Processing Time | Database Operations |
|---------------|-----------------|---------------------|
| 0 variants    | ~50-100ms       | 1 insert            |
| 5 variants    | ~150-250ms      | 1 + 1 bulk insert   |
| 10 variants   | ~200-350ms      | 1 + 1 bulk insert   |
| 25 variants   | ~350-500ms      | 1 + 1 bulk insert   |
| 50 variants   | ~500-800ms      | 1 + 1 bulk insert   |
| 100 variants  | ~800-1200ms     | 1 + 1 bulk insert   |

### Optimization Features

✅ **Bulk Insert** - All variants created in single operation  
✅ **Pre-calculation** - Costs computed before transaction  
✅ **Connection Pooling** - Reuses tenant database connections  
✅ **Atomic Transaction** - Single commit for all operations  
✅ **Efficient Validation** - Fail-fast approach  

---

## 🛡️ Error Handling

The endpoint implements comprehensive error handling:

### Validation Errors (400)
- Missing required fields
- Invalid data types
- Duplicate variant names
- Unit mismatches

### Not Found Errors (404)
- Inventory item doesn't exist
- Sub-recipe doesn't exist

### Conflict Errors (409)
- Recipe slug already exists
- Duplicate variant name within recipe

### Business Logic Errors (400)
- Circular recipe dependencies
- Empty ingredients array
- Invalid size multipliers

### Transaction Failures
- Automatic rollback on any error
- No partial data saved
- Detailed error logging

---

## 🔍 Logging & Monitoring

The service logs the following events:

```javascript
// Success logs
[RecipeWithVariants] Calculating base recipe cost
[RecipeWithVariants] Pre-calculating variant costs
[RecipeWithVariants] Starting atomic transaction
[RecipeWithVariants] Base recipe created
[RecipeWithVariants] Variants created
[RecipeWithVariants] Transaction committed successfully

// Error logs
[RecipeWithVariants] Transaction aborted due to error
[RecipeWithVariants] Unexpected error
```

Each log includes:
- Recipe name
- Variant count
- Processing duration
- Error details (if applicable)

---

## 🧪 Testing

### cURL Example

```bash
curl -X POST https://api.yourpos.com/t/recipes/with-variants \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-id: acme" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Margherita Pizza",
    "ingredients": [
      {
        "sourceType": "inventory",
        "sourceId": "65a1234567890abcdef12345",
        "quantity": 200,
        "unit": "g"
      }
    ],
    "variations": [
      {
        "name": "Small",
        "sizeMultiplier": 0.7
      },
      {
        "name": "Large",
        "sizeMultiplier": 1.5
      }
    ]
  }'
```

### Postman Collection

Import the collection from: `docs/postman/recipe-with-variants.postman_collection.json`

---

## 📊 Database Schema

### Recipe Collection

```javascript
{
  _id: ObjectId,
  name: String,
  customName: String,
  slug: String (unique),
  code: String,
  description: String,
  type: 'sub' | 'final',
  ingredients: [{
    sourceType: 'inventory' | 'recipe',
    sourceId: ObjectId,
    nameSnapshot: String,
    quantity: Number,
    unit: String,
    costPerUnit: Number,
    totalCost: Number
  }],
  totalCost: Number,
  yield: Number,
  isActive: Boolean,
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### Recipe Variant Collection

```javascript
{
  _id: ObjectId,
  recipeId: ObjectId (ref: Recipe),
  name: String,
  description: String,
  type: 'size' | 'flavor' | 'crust' | 'style' | 'custom',
  sizeMultiplier: Number,
  baseCostAdjustment: Number,
  crustType: String,
  ingredients: [...],
  totalCost: Number,
  isActive: Boolean,
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```javascript
// Recipe
{ slug: 1 } // unique
{ name: 1 }

// RecipeVariant
{ recipeId: 1, name: 1 } // unique compound
{ recipeId: 1, createdAt: -1 }
```

---

## 🚀 Best Practices

### 1. **Always Provide Meaningful Names**
```json
{
  "name": "Margherita Pizza",  // ✅ Good
  "variations": [
    { "name": "Small (8 inch)" }  // ✅ Good - descriptive
  ]
}
```

### 2. **Use Consistent Units**
```json
{
  "ingredients": [
    { "quantity": 200, "unit": "g" },  // ✅ Good
    { "quantity": 0.2, "unit": "kg" }  // ❌ Bad - inconsistent
  ]
}
```

### 3. **Leverage Size Multipliers**
```json
{
  "variations": [
    { "name": "Small", "sizeMultiplier": 0.7 },   // ✅ Scales all ingredients
    { "name": "Large", "sizeMultiplier": 1.5 }
  ]
}
```

### 4. **Use Base Cost Adjustment for Add-ons**
```json
{
  "variations": [
    { 
      "name": "With Extra Cheese",
      "baseCostAdjustment": 2.50  // ✅ Adds fixed cost
    }
  ]
}
```

### 5. **Batch Create Variations**
Create all variations in one request rather than multiple API calls.

---

## 🔧 Troubleshooting

### Issue: Transaction Timeout
**Solution**: Reduce number of variants per request (max 100)

### Issue: Unit Mismatch Error
**Solution**: Ensure all ingredients use the same unit as defined in inventory

### Issue: Circular Dependency
**Solution**: Check that sub-recipes don't reference the parent recipe

### Issue: Slug Already Exists
**Solution**: Provide a custom slug or change the recipe name

---

## 📞 Support

For issues or questions:
- Email: support@tritechtechnologyllc.com
- Slack: #pos-api-support
- Documentation: https://docs.yourpos.com

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Maintained By**: Tritech Technology Engineering Team

