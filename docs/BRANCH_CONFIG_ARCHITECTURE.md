# Branch POS Configuration - Architecture

## System Architecture

```mermaid
flowchart TB
    subgraph database [Database Layer]
        BranchSchema[Branch Schema<br/>posConfig fields]
    end
    
    subgraph services [Service Layer]
        BranchConfigService[BranchConfigService<br/>getPosConfig<br/>updatePosConfig<br/>getPosConfigForAuth]
        TenantAuthService[TenantAuthService<br/>loginWithPin enhanced<br/>me enhanced]
        PosOrderService[PosOrderService<br/>create payment optional]
        ReceiptService[ReceiptService<br/>uses receiptConfig]
    end
    
    subgraph api [API Layer]
        BranchConfigAPI[GET/PUT<br/>/t/branches/:id/pos-config]
        AuthAPI[POST /t/auth/login-pin<br/>GET /t/auth/me]
        OrderAPI[POST /t/pos/orders]
        ReceiptAPI[GET /t/pos/orders/:id/receipt]
    end
    
    subgraph frontend [Frontend]
        Login[Cashier Login]
        Config[Store branchConfig]
        PayNowUI[Pay Now UI<br/>Immediate Payment]
        PayLaterUI[Pay Later UI<br/>Deferred Payment]
        Receipt[Receipt Display]
    end
    
    BranchSchema --> BranchConfigService
    BranchConfigService --> BranchConfigAPI
    BranchConfigService --> TenantAuthService
    BranchConfigService --> ReceiptService
    
    TenantAuthService --> AuthAPI
    PosOrderService --> OrderAPI
    ReceiptService --> ReceiptAPI
    
    Login --> AuthAPI
    AuthAPI --> Config
    Config --> PayNowUI
    Config --> PayLaterUI
    PayNowUI --> OrderAPI
    PayLaterUI --> OrderAPI
    OrderAPI --> ReceiptAPI
    ReceiptAPI --> Receipt
```

---

## Data Flow

### 1. Cashier Login Flow

```mermaid
sequenceDiagram
    participant Cashier
    participant Frontend
    participant AuthAPI
    participant TenantAuthService
    participant BranchConfigService
    participant Database
    
    Cashier->>Frontend: Enter PIN
    Frontend->>AuthAPI: POST /t/auth/login-pin
    AuthAPI->>TenantAuthService: loginWithPin()
    TenantAuthService->>Database: Find user by PIN
    TenantAuthService->>BranchConfigService: getPosConfigForAuth()
    BranchConfigService->>Database: Get branch config
    BranchConfigService-->>TenantAuthService: branchConfig
    TenantAuthService-->>AuthAPI: token + user + branchConfig
    AuthAPI-->>Frontend: Login response
    Frontend->>Frontend: Store config in state
    Frontend->>Cashier: Show POS interface
```

---

### 2. Pay Now Flow (KFC Style)

```mermaid
sequenceDiagram
    participant Cashier
    participant Frontend
    participant OrderAPI
    participant PosOrderService
    participant Database
    
    Cashier->>Frontend: Add items to cart
    Cashier->>Frontend: Click Checkout
    Frontend->>Frontend: Check: paymentMode === 'payNow'
    Frontend->>Cashier: Show payment screen IMMEDIATELY
    Cashier->>Frontend: Enter payment
    Frontend->>OrderAPI: POST /t/pos/orders (WITH payment)
    OrderAPI->>PosOrderService: create()
    PosOrderService->>Database: Create order (status: 'paid')
    PosOrderService-->>OrderAPI: Order created
    OrderAPI-->>Frontend: Order response
    Frontend->>Cashier: Print receipt
```

---

### 3. Pay Later Flow (Fine Dining Style)

```mermaid
sequenceDiagram
    participant Waiter
    participant Frontend
    participant OrderAPI
    participant PosOrderService
    participant Database
    
    Waiter->>Frontend: Add items to cart
    Waiter->>Frontend: Click Send to Kitchen
    Frontend->>Frontend: Check: paymentMode === 'payLater'
    Frontend->>OrderAPI: POST /t/pos/orders (NO payment)
    OrderAPI->>PosOrderService: create()
    PosOrderService->>Database: Create order (status: 'placed')
    PosOrderService-->>OrderAPI: Order created
    OrderAPI-->>Frontend: Order response
    Frontend->>Waiter: Order sent to kitchen
    
    Note over Waiter,Database: Customer eats meal...
    
    Waiter->>Frontend: Click Request Bill
    Frontend->>Waiter: Show bill preview
    Waiter->>Frontend: Enter payment
    Frontend->>OrderAPI: POST /t/pos/orders (WITH payment)
    Note over OrderAPI,Database: Or update existing order
    OrderAPI-->>Frontend: Payment processed
    Frontend->>Waiter: Print receipt
```

---

### 4. Config Update Flow

```mermaid
sequenceDiagram
    participant Admin
    participant AdminPanel
    participant ConfigAPI
    participant BranchConfigService
    participant Database
    
    Admin->>AdminPanel: Open branch settings
    AdminPanel->>ConfigAPI: GET /t/branches/:id/pos-config
    ConfigAPI->>BranchConfigService: getPosConfig()
    BranchConfigService->>Database: Get branch
    BranchConfigService-->>ConfigAPI: Current config
    ConfigAPI-->>AdminPanel: Display config
    
    Admin->>AdminPanel: Change paymentMode to 'payLater'
    AdminPanel->>ConfigAPI: PUT /t/branches/:id/pos-config
    ConfigAPI->>BranchConfigService: updatePosConfig()
    BranchConfigService->>Database: Update branch.posConfig
    BranchConfigService-->>ConfigAPI: Updated config
    ConfigAPI-->>AdminPanel: Success
    
    Note over AdminPanel,Database: All cashiers get new config on next login
```

---

## Database Schema

### Branch Collection

```javascript
{
  _id: ObjectId,
  name: "Main Branch",
  code: "MAIN01",
  currency: "PKR",
  timezone: "Asia/Karachi",
  
  tax: {
    mode: "exclusive",
    rate: 15,
    vatNumber: "VAT123"
  },
  
  posConfig: {
    // Existing fields
    orderPrefix: "ORD",
    receiptFooter: "Thank you!",
    enableHoldOrders: true,
    enableTableService: false,
    
    // NEW: Payment workflow mode
    paymentMode: "payNow", // or "payLater"
    
    // NEW: Receipt customization
    receiptConfig: {
      showLogo: false,
      logoUrl: "",
      showQRCode: false,
      qrCodeData: "",
      headerText: "",
      footerText: "Thank you for your business!",
      showTaxBreakdown: true,
      showItemCodes: false,
      paperWidth: 80,
      fontSizeMultiplier: 1.0
    },
    
    // NEW: Payment method settings
    paymentMethods: {
      cash: {
        enabled: true,
        taxRateOverride: null
      },
      card: {
        enabled: true,
        taxRateOverride: null,
        minAmount: 0
      },
      mobile: {
        enabled: true,
        taxRateOverride: null
      }
    }
  }
}
```

---

## API Endpoints

### Branch Configuration

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/t/branches/:id/pos-config` | GET | Get POS config | Full config |
| `/t/branches/:id/pos-config` | PUT | Update config | Updated config |

### Authentication (Enhanced)

| Endpoint | Method | Enhancement | Returns |
|----------|--------|-------------|---------|
| `/t/auth/login-pin` | POST | Includes `branchConfig` | token + user + **branchConfig** |
| `/t/auth/me` | GET | Includes `branchConfig` | user + **branchConfig** |

### Orders (Enhanced)

| Endpoint | Method | Enhancement | Behavior |
|----------|--------|-------------|----------|
| `/t/pos/orders` | POST | Payment optional | Creates order with/without payment |

### Receipts (Enhanced)

| Endpoint | Method | Enhancement | Behavior |
|----------|--------|-------------|----------|
| `/t/pos/orders/:id/receipt` | GET | Uses `receiptConfig` | Customized receipt |

---

## Service Methods

### BranchConfigService

```javascript
class BranchConfigService {
  // Get full POS config (for admin panel)
  static async getPosConfig(conn, branchId)
  
  // Update POS config (for admin panel)
  static async updatePosConfig(conn, branchId, configData)
  
  // Get lightweight config (for auth responses)
  static async getPosConfigForAuth(conn, branchId)
}
```

### TenantAuthService (Enhanced)

```javascript
class TenantAuthService {
  // Enhanced to include branchConfig
  static async loginWithPin(_conn, { pin, terminalId })
  
  // Enhanced to include branchConfig
  static async me(conn, { uid })
}
```

### PosOrderService (Enhanced)

```javascript
class PosOrderService {
  // Enhanced to support optional payment
  static async create(conn, tenantSlug, userContext, payload)
  // Now accepts orders with or without payment data
  // Uses branch.posConfig.paymentMethods for tax overrides
}
```

### ReceiptService (Enhanced)

```javascript
class ReceiptService {
  // Enhanced to use receiptConfig
  static async generateReceipt(conn, orderId, format)
  // Now includes logo, QR codes, custom text, etc.
}
```

---

## Configuration Validation

### Joi Schema

```javascript
const updatePosConfig = Joi.object({
  orderPrefix: Joi.string().max(10).optional(),
  receiptFooter: Joi.string().max(500).optional(),
  enableHoldOrders: Joi.boolean().optional(),
  enableTableService: Joi.boolean().optional(),
  paymentMode: Joi.string().valid('payNow', 'payLater').optional(),
  
  receiptConfig: Joi.object({
    showLogo: Joi.boolean().optional(),
    logoUrl: Joi.string().uri().allow('').optional(),
    showQRCode: Joi.boolean().optional(),
    qrCodeData: Joi.string().max(500).allow('').optional(),
    headerText: Joi.string().max(200).allow('').optional(),
    footerText: Joi.string().max(500).allow('').optional(),
    showTaxBreakdown: Joi.boolean().optional(),
    showItemCodes: Joi.boolean().optional(),
    paperWidth: Joi.number().valid(58, 80).optional(),
    fontSizeMultiplier: Joi.number().min(0.5).max(2.0).optional()
  }).optional(),
  
  paymentMethods: Joi.object({
    cash: Joi.object({
      enabled: Joi.boolean().optional(),
      taxRateOverride: Joi.number().min(0).max(99.99).allow(null).optional()
    }).optional(),
    card: Joi.object({
      enabled: Joi.boolean().optional(),
      taxRateOverride: Joi.number().min(0).max(99.99).allow(null).optional(),
      minAmount: Joi.number().min(0).optional()
    }).optional(),
    mobile: Joi.object({
      enabled: Joi.boolean().optional(),
      taxRateOverride: Joi.number().min(0).max(99.99).allow(null).optional()
    }).optional()
  }).optional()
});
```

---

## Security & Permissions

### Required Permissions

| Action | Permission |
|--------|-----------|
| View POS config | `branches.read` |
| Update POS config | `branches.manage` OR `branches.settings` |

### Branch-Scoped Access

- Cashiers can only access config for their assigned branch
- Admins with tenant scope can access all branches
- Config is automatically filtered by branch assignment

---

## Performance Considerations

1. **Config is cached in JWT** - No extra DB calls during order creation
2. **Lightweight auth response** - Only essential config fields returned
3. **No breaking changes** - All new fields have defaults
4. **Backward compatible** - Existing orders work without changes

---

## Testing Strategy

### Unit Tests

- ✅ BranchConfigService methods
- ✅ Validation schemas
- ✅ Auth service enhancements

### Integration Tests

- ✅ Login returns branchConfig
- ✅ ME API returns branchConfig
- ✅ Orders work with/without payment
- ✅ Receipts use receiptConfig

### E2E Tests

- ✅ Pay Now flow (full cycle)
- ✅ Pay Later flow (full cycle)
- ✅ Config update propagation

---

## Deployment Checklist

- [x] Database schema updated (backward compatible)
- [x] New service methods created
- [x] API endpoints added
- [x] Validation schemas added
- [x] Auth responses enhanced
- [x] Order service updated
- [x] Receipt service updated
- [x] Documentation created
- [x] No linting errors
- [ ] Frontend integration (pending)
- [ ] Admin panel UI (pending)

---

## Future Enhancements

1. **Table Management** - Track table numbers for payLater mode
2. **Split Bills** - Allow multiple payments per order
3. **Order Modification** - Edit orders before payment in payLater mode
4. **Kitchen Display** - Separate kitchen receipt format
5. **Multi-Receipt** - Kitchen order + Bill preview + Final receipt
6. **Analytics** - Track payment mode performance

---

**Status:** ✅ Backend implementation complete and ready for frontend integration!

