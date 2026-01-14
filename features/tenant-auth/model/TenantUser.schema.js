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

    branchIds: { type: [Schema.Types.ObjectId], default: [] }, // optional legacy field (for multi-branch access)
    
    // 🔒 CASHIER ASSIGNMENT - Single branch/POS assignment for staff
    assignedBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null }, // Primary branch assignment for cashiers
    posIds: { type: [Schema.Types.ObjectId], ref: 'PosTerminal', default: [] }, // POS restrictions (empty = can use any POS in assigned branch)
    
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: false },

    isStaff: { type: Boolean, default: false },
    position: { type: String, trim: true, maxlength: 120 },
    employeeId: { type: String, trim: true, uppercase: true, default: null }, // EMP-XXXXXX for PIN login

    pinHash: { type: String, default: null },
    pinKey:  { type: String, default: null }, // deterministic, peppered fingerprint for uniqueness checks
    pinUpdatedAt: { type: Date },
    pinLoginFailures: { type: Number, default: 0 },
    pinLockedUntil: { type: Date, default: null },
    lastPinLoginAt: { type: Date },

    invitedBy: { type: Schema.Types.ObjectId, ref: 'TenantUser', default: null },
    metadata: { type: Object },

    status:   { type: String, enum: ['active','suspended'], default: 'active' },
    lastLoginAt: { type: Date },

    resetToken: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  }, { timestamps: true });

  // NOTE: email already has { unique: true } at field level; avoid duplicate index definitions.
  TenantUserSchema.index({ pinKey: 1 }, { unique: true, sparse: true });
  TenantUserSchema.index({ assignedBranchId: 1, isStaff: 1 });
  return TenantUserSchema;
};
