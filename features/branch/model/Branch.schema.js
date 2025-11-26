// features/branch/model/Branch.schema.js
module.exports = (Schema) => {
  const PrinterSchema = new Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['network','usb','bluetooth'], default: 'network' },
    ip: { type: String, default: '' },
    port: { type: Number, default: 9100 },
    target: { type: String, enum: ['kitchen','receipt','bar','label'], default: 'receipt' },
    enabled: { type: Boolean, default: true }
  }, { _id: false });

  const BranchSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 160 },
    code: { type: String, required: true, trim: true, lowercase: true, maxlength: 40, unique: true },

    status: { type: String, enum: ['active','inactive','archived'], default: 'active' },
    isDefault: { type: Boolean, default: false },

    contact: {
      phone: String,
      email: String,
    },

    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },

    timezone: { type: String, default: 'Asia/Karachi' },
    currency: { type: String, default: 'PKR' },

    tax: {
      mode: { type: String, enum: ['inclusive','exclusive'], default: 'exclusive' },
      rate: { type: Number, default: 0 },           // percentage
      vatNumber: { type: String, default: '' }
    },

    posConfig: {
      orderPrefix: { type: String, default: 'ORD' },
      receiptFooter: { type: String, default: '' },
      enableHoldOrders: { type: Boolean, default: true },
      enableTableService: { type: Boolean, default: false }
    },

    printers: { type: [PrinterSchema], default: [] },

    metadata: { type: Object, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'TenantUser', default: null }
  }, { timestamps: true });

  BranchSchema.index({ code: 1 }, { unique: true });
  BranchSchema.index({ name: 1 });

  return BranchSchema;
};
