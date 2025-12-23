# Quick Start Guide - Production POS v2.0

## 🚀 For Developers

### What Changed?

**TL;DR:** Menu variations now properly link to recipe variants for accurate cost tracking and inventory deduction.

### Key Files Modified

1. **Schemas:**
   - `features/menu/model/MenuVariation.schema.js` - Added `recipeVariantId`, `calculatedCost`
   - `features/pos/model/PosOrder.schema.js` - Added `selectedVariations` to order items

2. **Services:**
   - `features/menu/services/menuCostCalculator.service.js` - NEW: Cost calculation service
   - `features/menu/services/menuVariation.service.js` - Enhanced with validation
   - `features/recipe/services/recipeWithVariants.service.js` - Added transactions
   - `features/pos/services/PosOrderService.js` - Variation support in orders
   - `modules/inventoryHooks.js` - Variation-aware inventory deduction

3. **Validation:**
   - `features/menu/validation/menuVariation.validation.js` - Added `recipeVariantId`
   - `features/pos/validation/posOrder.validation.js` - Added `variations` array

### Quick Test

```bash
# 1. Run migration
node scripts/migrations/001-add-variation-support.js migrate your-tenant-slug

# 2. Create a menu variation with recipe variant link
curl -X POST https://api.tritechtechnologyllc.com/t/menu/variations \
  -H "x-tenant-id: your-tenant-slug" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "menuItemId": "YOUR_MENU_ITEM_ID",
    "recipeVariantId": "YOUR_RECIPE_VARIANT_ID",
    "name": "Large",
    "type": "size",
    "priceDelta": 5.00
  }'

# 3. Place an order with variations
curl -X POST https://api.tritechtechnologyllc.com/t/pos/orders \
  -H "x-tenant-id: your-tenant-slug" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "YOUR_BRANCH_ID",
    "items": [
      {
        "menuItemId": "YOUR_MENU_ITEM_ID",
        "variations": ["YOUR_VARIATION_ID"],
        "quantity": 1
      }
    ],
    "paymentMethod": "cash"
  }'

# 4. Check logs for cost calculation
tail -f logs/combined.log | grep "MenuCostCalculator"
```

---

## 🎯 For Frontend Developers

### API Changes

#### Creating Menu Variations

**New Optional Field:**
```typescript
interface CreateMenuVariation {
  menuItemId: string;
  recipeVariantId?: string; // ✅ NEW - Link to recipe variant
  name: string;
  type?: 'size' | 'crust' | 'flavor' | 'addon' | 'combo' | 'custom';
  priceDelta?: number;
  sizeMultiplier?: number;
  isDefault?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}
```

**Response Includes:**
```typescript
interface MenuVariation {
  _id: string;
  menuItemId: string;
  recipeVariantId?: string; // ✅ NEW
  calculatedCost: number; // ✅ NEW - Auto-calculated
  name: string;
  type: string;
  priceDelta: number;
  // ... other fields
}
```

#### Creating POS Orders

**New Field in Order Items:**
```typescript
interface OrderItem {
  menuItemId: string;
  variations?: string[]; // ✅ NEW - Array of variation IDs
  quantity: number;
  notes?: string;
}
```

**Example:**
```typescript
const order = {
  branchId: "507f1f77bcf86cd799439011",
  items: [
    {
      menuItemId: "507f1f77bcf86cd799439022",
      variations: [ // ✅ Just pass the IDs
        "large_variation_id",
        "pepperoni_variation_id"
      ],
      quantity: 2
    }
  ],
  paymentMethod: "card"
};

// System automatically:
// ✅ Calculates final price
// ✅ Deducts correct inventory
// ✅ Tracks profit margins
```

### UI Updates Needed

#### 1. Menu Variation Form

Add optional field to link recipe variant:

```tsx
<FormField>
  <Label>Recipe Variant (Optional)</Label>
  <Select 
    name="recipeVariantId"
    options={recipeVariants} // Fetch from /t/recipe-variants?recipeId={menuItem.recipeId}
  />
  <HelpText>
    Link to recipe variant for automatic cost calculation
  </HelpText>
</FormField>
```

#### 2. POS Order Screen

When customer selects variations, pass them in the order:

```tsx
const handleAddToCart = () => {
  const item = {
    menuItemId: selectedMenuItem.id,
    variations: selectedVariations.map(v => v.id), // ✅ Add this
    quantity: quantity,
    notes: notes
  };
  
  addToCart(item);
};
```

#### 3. Order Details Display

Show selected variations:

```tsx
{order.items.map(item => (
  <OrderItem key={item._id}>
    <ItemName>{item.nameSnapshot}</ItemName>
    {item.selectedVariations?.map(variation => (
      <Variation key={variation.menuVariationId}>
        {variation.nameSnapshot}
        {variation.priceDelta > 0 && ` (+$${variation.priceDelta})`}
      </Variation>
    ))}
    <Price>${item.lineTotal}</Price>
  </OrderItem>
))}
```

---

## 📱 For Mobile App Developers

### Order Submission

**Before:**
```dart
// Old way
final orderItem = {
  'menuItemId': menuItem.id,
  'quantity': quantity,
};
```

**After:**
```dart
// New way - include variations
final orderItem = {
  'menuItemId': menuItem.id,
  'variations': selectedVariations.map((v) => v.id).toList(), // ✅ Add this
  'quantity': quantity,
};
```

### Variation Selection UI

```dart
class VariationSelector extends StatefulWidget {
  final MenuItem menuItem;
  final Function(List<String>) onVariationsChanged;
  
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Size variations (single select)
        _buildSizeVariations(),
        
        // Flavor variations (single select)
        _buildFlavorVariations(),
        
        // Add-on variations (multi-select)
        _buildAddonVariations(),
      ],
    );
  }
}
```

---

## 🧪 For QA Team

### Test Cases

#### Test 1: Create Variation with Recipe Variant Link
```
Given: A menu item with a recipe
When: Create variation with recipeVariantId
Then: 
  ✅ Variation created successfully
  ✅ calculatedCost is populated
  ✅ Warning logged if selling below cost
```

#### Test 2: Create Variation with Duplicate Name
```
Given: Menu item already has variation "Large"
When: Try to create another variation named "Large"
Then: 
  ✅ Request fails with 409 Conflict
  ✅ Error message: "Variation 'Large' already exists"
```

#### Test 3: Order with Variations
```
Given: Menu item with size and flavor variations
When: Place order with both variations selected
Then:
  ✅ Order created successfully
  ✅ Price includes both variation deltas
  ✅ selectedVariations array populated
  ✅ Inventory deducted correctly (size multiplier applied)
```

#### Test 4: Order Without Variations
```
Given: Menu item with variations available
When: Place order without selecting variations
Then:
  ✅ Order created successfully
  ✅ Base price used
  ✅ Base recipe inventory deducted
```

#### Test 5: Invalid Recipe Variant Link
```
Given: Menu item linked to Recipe A
When: Try to link variation to Recipe B's variant
Then:
  ✅ Request fails with 400 Bad Request
  ✅ Error: "Recipe variant does not belong to this menu item's recipe"
```

### Performance Tests

```bash
# Load test: 100 concurrent orders with variations
artillery quick --count 100 --num 10 \
  https://api.tritechtechnologyllc.com/t/pos/orders \
  -H "x-tenant-id: test-tenant" \
  -H "Authorization: Bearer TOKEN" \
  -p order-with-variations.json

# Expected: < 500ms p95 latency
```

---

## 🔧 For DevOps

### Deployment Steps

1. **Pre-deployment:**
   ```bash
   # Backup databases
   ./scripts/backup-all-tenants.sh
   
   # Run migration in staging
   NODE_ENV=staging node scripts/migrations/001-add-variation-support.js migrate
   ```

2. **Deployment:**
   ```bash
   # Deploy new code
   git pull origin main
   npm install
   pm2 reload ecosystem.config.js
   ```

3. **Post-deployment:**
   ```bash
   # Run migration in production
   NODE_ENV=production node scripts/migrations/001-add-variation-support.js migrate
   
   # Monitor logs
   pm2 logs --lines 100
   
   # Check for errors
   grep "ERROR" logs/combined.log | tail -50
   ```

### Monitoring

Add alerts for:
```yaml
# Alert if selling below cost
- name: menu_variation_below_cost
  query: 'log.message:"Selling below cost"'
  severity: warning
  
# Alert if inventory deduction fails
- name: inventory_deduction_failed
  query: 'log.message:"inventory deduction failed"'
  severity: critical
  
# Alert if transaction rollback
- name: recipe_transaction_rollback
  query: 'log.message:"Transaction rolled back"'
  severity: warning
```

### Database Indexes

Migration automatically creates:
```javascript
// MenuVariation
{ menuItemId: 1, name: 1 } // unique
{ recipeVariantId: 1 }
{ menuItemId: 1, displayOrder: 1 }

// Already exists, verify:
db.menu_variations.getIndexes()
```

---

## 📚 For Technical Writers

### Documentation Updates Needed

1. **API Reference:**
   - Update MenuVariation schema documentation
   - Update PosOrder schema documentation
   - Add MenuCostCalculator service documentation

2. **User Guides:**
   - "How to Create Menu Variations" - Add recipe variant linking step
   - "Understanding Profit Margins" - New section on cost tracking
   - "Inventory Management" - Update with variation-aware deduction

3. **Admin Manual:**
   - Update screenshots for variation creation form
   - Add section on linking recipe variants
   - Add troubleshooting for "selling below cost" warnings

---

## 🎓 Training Materials

### For Restaurant Managers

**Key Points:**
1. Variations now track actual costs automatically
2. System warns if you're selling below cost
3. Inventory deduction is more accurate (accounts for size/toppings)
4. Profit margins are calculated per variation

### For Cashiers

**What's New:**
- When taking orders, select size and toppings as before
- System automatically calculates correct price
- No changes to POS workflow

### For Kitchen Staff

**What's New:**
- Orders now show selected variations clearly
- Inventory automatically deducted based on actual size/toppings
- No manual adjustments needed

---

## ❓ FAQ

**Q: Do I need to update existing menu variations?**  
A: No, they continue to work. But linking to recipe variants enables automatic cost calculation.

**Q: What if I don't link recipe variants?**  
A: System falls back to legacy calculation using ingredients array or costDelta field.

**Q: Will old orders still work?**  
A: Yes, migration adds empty `selectedVariations` array to existing orders.

**Q: Can I rollback if something goes wrong?**  
A: Yes, run `node scripts/migrations/001-add-variation-support.js rollback tenant-slug`

**Q: How do I test locally?**  
A: Use the test scenario in PRODUCTION-UPGRADE-V2.0.md

---

## 📞 Support Contacts

- **Engineering Lead:** [Your Name]
- **DevOps:** [DevOps Team]
- **Slack Channel:** #pos-v2-upgrade
- **Documentation:** https://docs.tritechtechnologyllc.com

---

**Version:** 2.0.0  
**Last Updated:** 2025-01-01  
**Status:** ✅ Ready for Production

