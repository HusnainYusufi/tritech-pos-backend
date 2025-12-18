# 🚀 Quick Reference: Recipe with Variants

## Endpoint

```
POST /t/recipes/with-variants
```

## Headers

```
Authorization: Bearer <JWT_TOKEN>
x-tenant-id: <tenant-slug>
Content-Type: application/json
```

## Minimal Example

```json
{
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
    { "name": "Small", "sizeMultiplier": 0.7 },
    { "name": "Large", "sizeMultiplier": 1.5 }
  ]
}
```

## Full Example

```json
{
  "name": "Margherita Pizza",
  "code": "PIZZA-001",
  "description": "Classic Italian pizza",
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
    }
  ],
  "yield": 1,
  "isActive": true,
  "variations": [
    {
      "name": "Small (8 inch)",
      "description": "Perfect for one",
      "type": "size",
      "sizeMultiplier": 0.7,
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
    }
  ]
}
```

## Response

```json
{
  "status": 201,
  "message": "Recipe created successfully with 2 variant(s)",
  "result": {
    "recipe": { ... },
    "variants": [ ... ],
    "summary": {
      "recipeId": "...",
      "recipeName": "Margherita Pizza",
      "variantCount": 2,
      "processingTimeMs": 245
    }
  }
}
```

## Common Errors

| Status | Message | Fix |
|--------|---------|-----|
| 400 | Recipe name is required | Add `name` field |
| 400 | Recipe must have at least one ingredient | Add `ingredients` array |
| 400 | Duplicate variant names detected | Use unique variant names |
| 404 | Inventory item not found | Check `sourceId` exists |
| 409 | Recipe slug already exists | Change name or provide custom slug |

## Field Reference

### Recipe Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| name | string | ✅ | - | Recipe name (1-160 chars) |
| customName | string | ❌ | "" | Custom display name |
| slug | string | ❌ | auto | URL-friendly identifier |
| code | string | ❌ | "" | Recipe code/SKU |
| description | string | ❌ | "" | Recipe description |
| type | string | ❌ | "final" | "sub" or "final" |
| ingredients | array | ✅ | - | At least 1 ingredient |
| yield | number | ❌ | 1 | Recipe yield quantity |
| isActive | boolean | ❌ | true | Active status |
| metadata | object | ❌ | {} | Additional data |
| variations | array | ❌ | [] | Variant definitions |

### Ingredient Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sourceType | string | ✅ | "inventory" or "recipe" |
| sourceId | string | ✅ | MongoDB ObjectId |
| quantity | number | ✅ | Positive number |
| unit | string | ✅ | Unit of measurement |
| costPerUnit | number | ❌ | Cost per unit |
| nameSnapshot | string | ❌ | Name for reference |

### Variation Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| name | string | ✅ | - | Variant name (1-160 chars) |
| description | string | ❌ | "" | Variant description |
| type | string | ❌ | "custom" | size/flavor/crust/style/custom |
| sizeMultiplier | number | ❌ | 1 | Multiplier for all ingredients |
| baseCostAdjustment | number | ❌ | 0 | Fixed cost adjustment |
| crustType | string | ❌ | "" | Crust type (for pizzas) |
| ingredients | array | ❌ | [] | Additional ingredients |
| isActive | boolean | ❌ | true | Active status |
| metadata | object | ❌ | {} | Additional data |

## Size Multiplier Examples

```json
{
  "variations": [
    { "name": "Small", "sizeMultiplier": 0.7 },    // 70% of base
    { "name": "Medium", "sizeMultiplier": 1 },     // 100% of base
    { "name": "Large", "sizeMultiplier": 1.5 },    // 150% of base
    { "name": "XL", "sizeMultiplier": 2 }          // 200% of base
  ]
}
```

## Base Cost Adjustment Examples

```json
{
  "variations": [
    { 
      "name": "With Extra Cheese",
      "baseCostAdjustment": 2.50  // Adds $2.50 to total cost
    },
    {
      "name": "Discount Size",
      "baseCostAdjustment": -1.00  // Subtracts $1.00 from total cost
    }
  ]
}
```

## Variant with Extra Ingredients

```json
{
  "variations": [
    {
      "name": "Vanilla Latte",
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
      ]
    }
  ]
}
```

## cURL Example

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
      { "name": "Small", "sizeMultiplier": 0.7 },
      { "name": "Large", "sizeMultiplier": 1.5 }
    ]
  }'
```

## JavaScript Example

```javascript
const response = await fetch('/t/recipes/with-variants', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': 'acme',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Margherita Pizza',
    ingredients: [
      {
        sourceType: 'inventory',
        sourceId: '65a1234567890abcdef12345',
        quantity: 200,
        unit: 'g'
      }
    ],
    variations: [
      { name: 'Small', sizeMultiplier: 0.7 },
      { name: 'Large', sizeMultiplier: 1.5 }
    ]
  })
});

const result = await response.json();
console.log(result.result.summary);
```

## Best Practices

✅ **DO:**
- Use descriptive variant names
- Keep units consistent
- Use size multipliers for scaling
- Provide meaningful descriptions
- Test with real inventory items

❌ **DON'T:**
- Use duplicate variant names
- Mix units (g vs kg)
- Create circular recipe dependencies
- Exceed 100 variants per request
- Skip required fields

## Performance Tips

- **0-10 variants**: ~100-300ms (optimal)
- **10-50 variants**: ~300-800ms (good)
- **50-100 variants**: ~800-1200ms (acceptable)
- **100+ variants**: Consider batching

## Troubleshooting

**Q: Transaction timeout?**  
A: Reduce variant count or increase timeout

**Q: Unit mismatch error?**  
A: Check inventory item's base unit

**Q: Circular dependency?**  
A: Recipe cannot reference itself

**Q: Slug already exists?**  
A: Provide custom slug or change name

## Related Endpoints

- `GET /t/recipes/:id/with-variants` - Get recipe with variants
- `GET /t/recipes` - List all recipes
- `PUT /t/recipes/:id` - Update recipe
- `POST /t/recipe-variations` - Create single variant

## Documentation

- Full API Docs: `docs/RECIPE_WITH_VARIANTS_API.md`
- Examples: `docs/examples/recipe-with-variants-examples.json`
- Engineering Summary: `docs/ENGINEERING_SUMMARY_RECIPE_WITH_VARIANTS.md`

---

**Need Help?** Contact: support@tritechtechnologyllc.com

