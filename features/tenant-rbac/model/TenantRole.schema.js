// features/tenant-rbac/model/TenantRole.schema.js
module.exports = (Schema) => {
  const TenantRoleSchema = new Schema({
    name:        { type: String, required: true, trim: true, maxlength: 120 },
    key:         { type: String, required: true, trim: true, lowercase: true, unique: true }, // 'owner', 'cashier', ...
    description: { type: String, default: '' },
    scope:       { type: String, enum: ['tenant','branch'], default: 'tenant' },
    permissions: { type: [String], default: [] }, // e.g. 'menu.read','orders.create','menu.*','*'
    isSystem:    { type: Boolean, default: false }, // block delete/rename of defaults
  }, { timestamps: true });

  TenantRoleSchema.index({ key: 1 }, { unique: true });
  return TenantRoleSchema;
};
