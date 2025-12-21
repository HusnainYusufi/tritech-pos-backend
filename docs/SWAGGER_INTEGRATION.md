# Swagger API Documentation Integration

## Overview

This document describes the Swagger/OpenAPI integration for the Tritech POS Backend API. The API documentation is automatically generated from JSDoc comments in the codebase and is accessible via a web interface.

## Accessing the Documentation

### Development Environment
- **Swagger UI**: http://localhost:3000/api/docs
- **JSON Spec**: http://localhost:3000/api/docs.json

### Production Environment
- **Swagger UI**: https://your-domain.com/api/docs
- **JSON Spec**: https://your-domain.com/api/docs.json

## Features

✅ **Comprehensive API Documentation**
- All endpoints documented with request/response schemas
- Interactive API testing interface
- Authentication support (JWT Bearer tokens)
- Multi-tenant header support

✅ **Auto-generated from Code**
- Documentation stays in sync with code
- JSDoc comments in controller files
- Reusable schemas and components

✅ **Professional UI**
- Clean, modern interface
- Organized by tags/categories
- Searchable and filterable
- Try-it-out functionality

## Architecture

### Files Structure

```
tritech-pos-backend/
├── config/
│   └── swagger.config.js          # Main Swagger configuration
├── features/
│   └── [feature]/
│       └── controller/
│           └── *Controller.js     # JSDoc comments here
├── app.js                         # Swagger UI setup
└── swagger-gen.js                 # Alternative auto-generation script
```

### Configuration Files

#### 1. `config/swagger.config.js`
Main configuration file that defines:
- OpenAPI 3.0 specification
- API metadata (title, description, version)
- Server URLs (dev and production)
- Security schemes (JWT Bearer, tenant header)
- Reusable schemas (User, Tenant, Order, etc.)
- Common responses (errors, success)
- Tags for organizing endpoints

#### 2. `app.js`
Sets up Swagger UI middleware:
- Serves documentation at `/api/docs`
- Provides JSON spec at `/api/docs.json`
- Configures UI options (persistence, filtering, etc.)

## How to Document Endpoints

### Basic Endpoint Documentation

Add JSDoc comments above your route handlers:

```javascript
/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login as superadmin
 *     description: Authenticate and receive a JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/login', validate(login), async (req, res, next) => {
  // Your handler code
});
```

### Using Reusable Schemas

Reference schemas defined in `swagger.config.js`:

```javascript
/**
 * @swagger
 * /t/inventory:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get all inventory items
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InventoryItem'
 */
```

### Using Common Parameters

Reference parameters for consistency:

```javascript
/**
 * @swagger
 * /t/menu/items:
 *   get:
 *     tags:
 *       - Menu Items
 *     summary: Get menu items with pagination
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/search'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 */
```

### Using Common Responses

Reference error responses:

```javascript
/**
 * @swagger
 * /t/orders/{orderId}:
 *   get:
 *     responses:
 *       200:
 *         description: Order retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
```

## Available Schemas

The following schemas are pre-defined in `swagger.config.js`:

- `Error` - Standard error response
- `Success` - Standard success response
- `User` - User object
- `Tenant` - Tenant object
- `Branch` - Branch object
- `InventoryItem` - Inventory item object
- `Recipe` - Recipe object
- `MenuItem` - Menu item object
- `PosOrder` - POS order object
- `Staff` - Staff member object

## Available Response Templates

- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ValidationError` (400)
- `ServerError` (500)

## Available Parameters

- `tenantId` - x-tenant-id header
- `page` - Pagination page number
- `limit` - Items per page
- `search` - Search query

## Security Schemes

### Bearer Authentication
```javascript
security:
  - bearerAuth: []
```

### Tenant Header
```javascript
security:
  - tenantHeader: []
```

### Both (for tenant endpoints)
```javascript
security:
  - bearerAuth: []
  - tenantHeader: []
```

## Tags (Categories)

Organize your endpoints using these tags:

- `Authentication` - Superadmin auth
- `Tenant Authentication` - Tenant user auth
- `Tenants` - Tenant management
- `Plans` - Subscription plans
- `Branches` - Branch management
- `Inventory` - Inventory management
- `Inventory Categories` - Inventory categories
- `Recipes` - Recipe management
- `Recipe Variations` - Recipe variations
- `Menu Categories` - Menu categories
- `Menu Items` - Menu items
- `Menu Variations` - Menu variations
- `Branch Menu` - Branch-specific menus
- `Branch Inventory` - Branch-specific inventory
- `Staff` - Staff management
- `POS Menu` - POS menu operations
- `POS Till` - POS till operations
- `POS Terminal` - POS terminal management
- `POS Orders` - POS order management
- `RBAC` - Role-based access control
- `Dashboard` - Dashboard and analytics
- `Communications` - Communications

## NPM Scripts

```bash
# Start the server (documentation available at /api/docs)
npm run dev

# Alternative: Generate swagger-output.json using swagger-autogen
npm run swagger:generate
```

## Environment Variables

Configure server URLs in your `.env` file:

```env
# Swagger documentation server URL
SWAGGER_SERVER_URL=http://localhost:3000

# Production URL (optional)
PRODUCTION_URL=https://api.tritechpos.com
```

## Best Practices

### 1. Document All Public Endpoints
Every endpoint that external users or frontend applications interact with should be documented.

### 2. Use Descriptive Summaries
Write clear, concise summaries that explain what the endpoint does.

### 3. Include Examples
Always provide example values for request parameters and response data.

### 4. Document Error Cases
Include all possible error responses (400, 401, 403, 404, 500).

### 5. Use Reusable Components
Reference schemas, parameters, and responses instead of duplicating definitions.

### 6. Keep Documentation Updated
Update JSDoc comments whenever you modify endpoints.

### 7. Test in Swagger UI
Use the "Try it out" feature to ensure documentation matches actual behavior.

## Testing the Documentation

1. Start the server:
   ```bash
   npm run dev
   ```

2. Open your browser:
   ```
   http://localhost:3000/api/docs
   ```

3. Test an endpoint:
   - Click on an endpoint
   - Click "Try it out"
   - Fill in parameters
   - Click "Execute"
   - Verify the response

## Troubleshooting

### Documentation Not Showing Up

1. **Check server is running**:
   ```bash
   npm run dev
   ```

2. **Verify the URL**:
   - Should be `/api/docs` (not `/api-docs`)

3. **Check for errors in console**:
   - Look for swagger-related errors in terminal

### Endpoints Missing

1. **Verify JSDoc comments** are properly formatted
2. **Check file paths** in `swagger.config.js` apis array
3. **Restart the server** after adding new documentation

### Authentication Not Working

1. **Get a token** from login endpoint
2. **Click "Authorize"** button in Swagger UI
3. **Enter**: `Bearer <your-token>`
4. **Include tenant header** if required: `x-tenant-id: <tenant-id>`

## Examples

### Complete Controller Example

See the following files for complete examples:
- `features/auth/controller/AuthController.js`
- `features/tenant-auth/controller/TenantAuthController.js`

## Additional Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [swagger-jsdoc Documentation](https://github.com/Surnet/swagger-jsdoc)

## Support

For questions or issues with the API documentation:
1. Check this guide first
2. Review example controllers
3. Consult the OpenAPI specification
4. Contact the development team

---

**Last Updated**: December 2025
**Version**: 1.0.0
