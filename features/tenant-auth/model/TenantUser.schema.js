// features/tenant-auth/model/TenantUser.schema.js
module.exports = (Schema) => {
  const TenantUserSchema = new Schema({
    fullName: { type: String, trim: true, required: true, maxlength: 120 },
    email:    { type: String, trim: true, lowercase: true, required: true, unique: true },

    // Coarse roles (legacy compatible)
    roles:    { type: [String], default: ['owner'] },

    // Fine-grained assignments with scope (NEW)
    roleGrants: [{
      roleKey:  { type: String, required: true },       // matches TenantRole.key
      scope:    { type: String, enum: ['tenant','branch'], default: 'tenant' },
      branchId: { type: Schema.Types.ObjectId, default: null }
    }],

    branchIds: { type: [Schema.Types.ObjectId], default: [] }, // optional legacy field
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: false },

    status:   { type: String, enum: ['active','suspended'], default: 'active' },
    lastLoginAt: { type: Date },

    resetToken: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  }, { timestamps: true });

  TenantUserSchema.index({ email: 1 }, { unique: true });
  return TenantUserSchema;
};
