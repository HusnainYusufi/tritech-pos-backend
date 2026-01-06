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
      enableTableService: { type: Boolean, default: false },
      
      // Payment workflow mode (frontend behavior control)
      paymentMode: {
        type: String,
        enum: ['payNow', 'payLater'],
        default: 'payNow',
        // payNow: immediate payment (KFC/fast food style)
        // payLater: bill after service (fine dining style)
      },
      
      // Receipt customization
      receiptConfig: {
        showLogo: { type: Boolean, default: false },
        logoUrl: { type: String, default: '' },
        showQRCode: { type: Boolean, default: false },
        qrCodeData: { type: String, default: '' }, // URL or payment link
        headerText: { type: String, default: '' },
        footerText: { type: String, default: 'Thank you for your business!' },
        showTaxBreakdown: { type: Boolean, default: true },
        showItemCodes: { type: Boolean, default: false },
        paperWidth: { type: Number, default: 80, enum: [58, 80] }, // mm
        fontSizeMultiplier: { type: Number, default: 1.0, min: 0.5, max: 2.0 }
      },
      
      // Payment method specific settings
      paymentMethods: {
        cash: {
          enabled: { type: Boolean, default: true },
          taxRateOverride: { type: Number, default: null }, // null = use branch tax
        },
        card: {
          enabled: { type: Boolean, default: true },
          taxRateOverride: { type: Number, default: null },
          minAmount: { type: Number, default: 0 }
        },
        mobile: {
          enabled: { type: Boolean, default: true },
          taxRateOverride: { type: Number, default: null },
        }
      }
    },

    printers: { type: [PrinterSchema], default: [] },

    metadata: { type: Object, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'TenantUser', default: null }
  }, { timestamps: true });

  BranchSchema.index({ code: 1 }, { unique: true });
  BranchSchema.index({ name: 1 });

  return BranchSchema;
};
