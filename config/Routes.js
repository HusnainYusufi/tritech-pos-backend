'use strict';

module.exports.routes = (app) => {
  // Existing modules
  app.use('/role', require('../features/role/controller/RoleController'));

  // Auth (superadmin signup/login)
  app.use('/auth', require('../features/auth/controller/AuthController'));

  // Admin modules
  app.use('/admin/tenants', require('../features/tenant/controller/TenantController'));
  app.use('/admin/plans', require('../features/plan/controller/PlanController'));
  app.use('/admin/comms', require('../features/communication/controller/CommunicationController'));
  app.use('/admin/dashboard', require('../features/dashboard/controller/DashboardController'));

  app.use('/t/auth', require('../features/tenant-auth/controller/TenantAuthController'));

  app.use('/t/rbac', require('../features/tenant-rbac/controller/TenantRoleController'));

  app.use('/t/branches', require('../features/branch/controller/BranchController'));
  app.use('/t/inventory/categories', require('../features/inventory-category/controller/InventoryCategoryController'));

  app.use('/t/inventory', require('../features/inventory/controller/InventoryItemController'));
  app.use('/t/inventory', require('../features/inventory/controller/InventoryImportExportController'));
  app.use('/t/recipes', require('../features/recipe/controller/RecipeController'));
  app.use('/t/recipe-variations', require('../features/recipe-variant/routes/recipeVariant.routes'));

  app.use('/t/menu/categories', require('../features/menu/controller/MenuCategoryController'));
  app.use('/t/menu/items', require('../features/menu/controller/MenuItemController'));
  app.use('/t/menu/variations', require('../features/menu/controller/MenuVariationController'));
  app.use('/t/branch-menu' , require('../features/branch-menu/controller/BranchMenuController'));
  app.use('/t/branch-inventory' , require('../features/branch-inventory/controller/BranchInventoryController'));
  app.use('/t/staff', require('../features/staff/controller/StaffController'));
  app.use('/t/pos', require('../features/pos/controller/PosTillController'));

};
