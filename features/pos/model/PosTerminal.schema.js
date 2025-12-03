// features/pos/model/PosTerminal.schema.js
'use strict';

const auditPlugin = require('../../../modules/audit.plugin');

module.exports = (Schema) => {
  const PosTerminalSchema = new Schema({
    branchId: { type: Schema.Types.ObjectId, required: true, ref: 'Branch' },
    machineId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ['active', 'maintenance', 'retired'], default: 'active' },
    metadata: { type: Object, default: null },
    lastSeenAt: { type: Date, default: null }
  }, { timestamps: true });

  PosTerminalSchema.index({ machineId: 1 }, { unique: true });
  PosTerminalSchema.index({ branchId: 1, status: 1 });

  PosTerminalSchema.plugin(auditPlugin);

  return PosTerminalSchema;
};
