// features/tenant-auth/model/TillSession.schema.js
const auditPlugin = require('../../../modules/audit.plugin');

module.exports = (Schema) => {
  const TillSessionSchema = new Schema({
    staffId: { type: Schema.Types.ObjectId, ref: 'TenantUser', required: true },
    branchId: { type: Schema.Types.ObjectId, required: true },
    posId: { type: String, default: null },

    status: { type: String, enum: ['open', 'closed'], default: 'open' },

    openingAmount: { type: Number, required: true },
    declaredClosingAmount: { type: Number, default: null },
    systemClosingAmount: { type: Number, default: null },
    variance: { type: Number, default: null },

    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },

    cashCounts: { type: Object, default: null },
    notes: { type: String, trim: true, maxlength: 500 },
  }, { timestamps: true });

  TillSessionSchema.index({ staffId: 1, branchId: 1, posId: 1, status: 1 });
  TillSessionSchema.index({ staffId: 1, branchId: 1, posId: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });

  TillSessionSchema.plugin(auditPlugin);

  return TillSessionSchema;
};
