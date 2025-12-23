# Deployment Checklist - POS v2.0

## ✅ Pre-Deployment (Complete Before Production)

### Code & Testing
- [x] All code changes implemented
- [x] Linting passed (no errors)
- [x] Migration script created and tested
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Load tests completed (1000+ concurrent orders)
- [ ] Security audit completed

### Documentation
- [x] API documentation updated (Swagger)
- [x] Technical documentation complete
- [x] Quick start guide created
- [x] Migration guide written
- [ ] User manual updated
- [ ] Training materials prepared

### Infrastructure
- [ ] Staging environment updated
- [ ] Database backup strategy confirmed
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Log aggregation setup verified

---

## 🔄 Staging Deployment

### Step 1: Preparation
```bash
# 1. Backup staging database
mongodump --uri="mongodb://staging-connection" --out=/backup/staging-pre-v2

# 2. Deploy code to staging
git checkout main
git pull origin main
npm install

# 3. Run migration in staging
NODE_ENV=staging node scripts/migrations/001-add-variation-support.js migrate

# 4. Restart application
pm2 reload ecosystem.config.js --env staging
```

### Step 2: Verification
- [ ] Application starts without errors
- [ ] Health check endpoint responds
- [ ] Can create menu variation with recipe variant link
- [ ] Can place order with variations
- [ ] Inventory deduction works correctly
- [ ] Cost calculation is accurate
- [ ] Swagger docs load correctly

### Step 3: QA Testing
- [ ] Test all variation creation scenarios
- [ ] Test order flow with variations
- [ ] Test inventory deduction accuracy
- [ ] Test profit margin calculations
- [ ] Test error scenarios (invalid data)
- [ ] Test transaction rollback
- [ ] Performance test (load testing)

---

## 🚀 Production Deployment

### Pre-Deployment Checklist
- [ ] Staging tests all passed
- [ ] Stakeholder approval received
- [ ] Deployment window scheduled
- [ ] Team notified
- [ ] Support team briefed
- [ ] Rollback plan reviewed

### Step 1: Backup (CRITICAL)
```bash
# Backup ALL tenant databases
for tenant in $(mongo --eval "db.tenants.find({status:'active'}).forEach(t => print(t.slug))" --quiet); do
  mongodump --uri="mongodb://prod-connection" --db="tenant_${tenant}" --out="/backup/prod-pre-v2/${tenant}"
done

# Verify backups
ls -lh /backup/prod-pre-v2/
```

### Step 2: Deploy Code
```bash
# 1. Pull latest code
cd /var/www/tritech-pos-backend
git pull origin main

# 2. Install dependencies
npm install --production

# 3. Verify environment variables
cat .env | grep -E "MONGODB_URI|NODE_ENV|PORT"

# 4. Reload application (zero-downtime)
pm2 reload ecosystem.config.js --env production
```

### Step 3: Run Migration
```bash
# Run migration for all tenants
NODE_ENV=production node scripts/migrations/001-add-variation-support.js migrate

# Monitor output for errors
# Expected: "✅ Completed successfully" for each tenant
```

### Step 4: Verification
```bash
# 1. Check application status
pm2 status

# 2. Check logs for errors
pm2 logs --lines 100 | grep -i error

# 3. Health check
curl https://api.tritechtechnologyllc.com/health

# 4. Test variation creation
curl -X POST https://api.tritechtechnologyllc.com/t/menu/variations \
  -H "x-tenant-id: test-tenant" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"menuItemId":"...","recipeVariantId":"...","name":"Test","priceDelta":5}'

# 5. Test order with variations
curl -X POST https://api.tritechtechnologyllc.com/t/pos/orders \
  -H "x-tenant-id: test-tenant" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branchId":"...","items":[{"menuItemId":"...","variations":["..."],"quantity":1}],"paymentMethod":"cash"}'
```

### Step 5: Monitoring (First 24 Hours)
- [ ] Monitor error rates (should be < 0.1%)
- [ ] Monitor response times (should be < 500ms p95)
- [ ] Monitor database performance
- [ ] Monitor memory usage
- [ ] Check for cost-below-price warnings
- [ ] Verify inventory deduction accuracy

---

## 📊 Post-Deployment Verification

### Immediate Checks (First Hour)
```bash
# Check for errors
tail -f logs/combined.log | grep -i error

# Check order processing
tail -f logs/combined.log | grep "PosOrderService"

# Check inventory deduction
tail -f logs/combined.log | grep "InventoryHooks"

# Check cost calculation
tail -f logs/combined.log | grep "MenuCostCalculator"
```

### Database Verification
```javascript
// Connect to production database
use tenant_example

// Verify MenuVariation updates
db.menu_variations.findOne({}, {recipeVariantId: 1, calculatedCost: 1})
// Should show new fields

// Verify unique index
db.menu_variations.getIndexes()
// Should include: { menuItemId: 1, name: 1 } unique

// Verify PosOrder updates
db.pos_orders.findOne({}, {"items.selectedVariations": 1})
// Should show new field

// Check for any errors
db.pos_orders.find({"items.selectedVariations": {$exists: false}}).count()
// Should be 0
```

### Functional Tests
- [ ] Create new menu variation with recipe variant link
- [ ] Place order with size variation
- [ ] Place order with flavor variation
- [ ] Place order with multiple variations
- [ ] Verify inventory deducted correctly
- [ ] Check order details show variations
- [ ] Verify cost calculation in database

---

## 🔙 Rollback Procedure (If Needed)

### When to Rollback
- Critical errors affecting order processing
- Data corruption detected
- Performance degradation > 50%
- Inventory deduction failures

### Rollback Steps
```bash
# 1. Rollback code
cd /var/www/tritech-pos-backend
git revert HEAD
pm2 reload ecosystem.config.js

# 2. Rollback database migration
NODE_ENV=production node scripts/migrations/001-add-variation-support.js rollback

# 3. Restore from backup (if needed)
mongorestore --uri="mongodb://prod-connection" /backup/prod-pre-v2/

# 4. Verify rollback
curl https://api.tritechtechnologyllc.com/health
pm2 logs --lines 50
```

### Post-Rollback
- [ ] Notify stakeholders
- [ ] Document issues encountered
- [ ] Plan fixes for next deployment
- [ ] Schedule post-mortem meeting

---

## 📈 Success Metrics

### Technical Metrics
- **Error Rate:** < 0.1%
- **Response Time:** < 500ms (p95)
- **Uptime:** > 99.9%
- **Database Performance:** No degradation

### Business Metrics
- **Orders with Variations:** Track adoption rate
- **Inventory Accuracy:** Should improve to 100%
- **Cost Tracking:** Now available (was 0%)
- **Profit Margin Visibility:** Now available

### Monitor These KPIs
```sql
-- Orders with variations
SELECT COUNT(*) FROM pos_orders 
WHERE items.selectedVariations IS NOT NULL AND ARRAY_LENGTH(items.selectedVariations) > 0;

-- Average variations per order
SELECT AVG(variation_count) FROM (
  SELECT ARRAY_LENGTH(items.selectedVariations) as variation_count 
  FROM pos_orders
);

-- Most popular variations
SELECT items.selectedVariations.nameSnapshot, COUNT(*) 
FROM pos_orders 
GROUP BY items.selectedVariations.nameSnapshot 
ORDER BY COUNT(*) DESC 
LIMIT 10;
```

---

## 🎓 Training & Communication

### Before Deployment
- [ ] Email sent to all stakeholders
- [ ] Training session scheduled for admins
- [ ] Quick reference guide distributed
- [ ] Support team briefed on new features
- [ ] FAQ document shared

### After Deployment
- [ ] Deployment announcement sent
- [ ] Success metrics shared
- [ ] Feedback collection initiated
- [ ] Follow-up training scheduled
- [ ] Documentation links shared

---

## 📞 Emergency Contacts

### Technical Team
- **Engineering Lead:** [Your Name] - [Phone]
- **DevOps:** [Name] - [Phone]
- **Database Admin:** [Name] - [Phone]

### Business Team
- **Product Owner:** [Name] - [Phone]
- **Operations Manager:** [Name] - [Phone]

### Escalation Path
1. Engineering Lead (immediate)
2. CTO (if critical)
3. CEO (if business-impacting)

---

## 📝 Post-Deployment Report Template

```markdown
# Deployment Report - POS v2.0

**Date:** YYYY-MM-DD
**Deployed By:** [Name]
**Duration:** [Start] - [End]

## Summary
- [ ] Successful
- [ ] Partial Success
- [ ] Failed (Rolled Back)

## Metrics
- Tenants Migrated: X/Y
- Orders Processed: X
- Error Rate: X%
- Response Time (p95): Xms

## Issues Encountered
1. [Issue description]
   - Impact: [High/Medium/Low]
   - Resolution: [How it was fixed]

## Lessons Learned
- [What went well]
- [What could be improved]

## Next Steps
- [ ] Monitor for 24 hours
- [ ] Schedule Phase 2 planning
- [ ] Update documentation based on feedback
```

---

## ✅ Final Sign-Off

### Deployment Approval
- [ ] Engineering Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______
- [ ] Product Owner: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______

### Post-Deployment Confirmation
- [ ] All checks passed
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Stakeholders notified
- [ ] Documentation updated

---

**Version:** 2.0.0  
**Deployment Date:** [To be filled]  
**Status:** Ready for Deployment  
**Production URL:** https://api.tritechtechnologyllc.com

