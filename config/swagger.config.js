/**
 * Swagger Configuration for Tritech POS Backend
 * This file configures swagger-jsdoc for comprehensive API documentation
 */

const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tritech POS API',
      version: '1.0.0',
      description: `
        Comprehensive API documentation for Tritech POS Backend System.
        
        ## Features
        - Multi-tenant architecture
        - Role-based access control (RBAC)
        - Inventory management
        - Recipe and menu management
        - POS terminal and till operations
        - Staff management
        
        ## Authentication
        This API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:
        \`Authorization: Bearer <your-token>\`
        
        For tenant-specific endpoints, also include:
        \`x-tenant-id: <tenant-identifier>\`
      `,
      contact: {
        name: 'Tritech POS Support',
        email: 'support@tritechpos.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: process.env.SWAGGER_SERVER_URL || 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: process.env.PRODUCTION_URL || 'https://api.tritechpos.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>'
        },
        tenantHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-tenant-id',
          description: 'Tenant identifier for multi-tenant requests'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'integer',
              example: 400
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'Detailed error description'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            status: {
              type: 'integer',
              example: 200
            },
            message: {
              type: 'string',
              example: 'Operation successful'
            },
            data: {
              type: 'object'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            uid: {
              type: 'string',
              example: 'usr_1234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            fullName: {
              type: 'string',
              example: 'John Doe'
            },
            role: {
              type: 'string',
              example: 'admin'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Tenant: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string',
              example: 'tenant_1234567890'
            },
            name: {
              type: 'string',
              example: 'My Restaurant'
            },
            subdomain: {
              type: 'string',
              example: 'myrestaurant'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'suspended'],
              example: 'active'
            },
            plan: {
              type: 'string',
              example: 'premium'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Branch: {
          type: 'object',
          properties: {
            branchId: {
              type: 'string',
              example: 'branch_1234567890'
            },
            name: {
              type: 'string',
              example: 'Main Branch'
            },
            address: {
              type: 'string',
              example: '123 Main St, City, Country'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active'
            }
          }
        },
        InventoryItem: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              example: 'inv_1234567890'
            },
            name: {
              type: 'string',
              example: 'Tomato'
            },
            sku: {
              type: 'string',
              example: 'SKU-001'
            },
            category: {
              type: 'string',
              example: 'Vegetables'
            },
            unit: {
              type: 'string',
              example: 'kg'
            },
            currentStock: {
              type: 'number',
              example: 50
            },
            reorderLevel: {
              type: 'number',
              example: 10
            },
            costPrice: {
              type: 'number',
              example: 2.5
            }
          }
        },
        Recipe: {
          type: 'object',
          properties: {
            recipeId: {
              type: 'string',
              example: 'recipe_1234567890'
            },
            name: {
              type: 'string',
              example: 'Margherita Pizza'
            },
            description: {
              type: 'string',
              example: 'Classic Italian pizza'
            },
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  inventoryItemId: {
                    type: 'string'
                  },
                  quantity: {
                    type: 'number'
                  },
                  unit: {
                    type: 'string'
                  }
                }
              }
            },
            preparationTime: {
              type: 'number',
              example: 15
            },
            costPrice: {
              type: 'number',
              example: 5.5
            }
          }
        },
        MenuItem: {
          type: 'object',
          properties: {
            menuItemId: {
              type: 'string',
              example: 'menu_1234567890'
            },
            name: {
              type: 'string',
              example: 'Margherita Pizza'
            },
            description: {
              type: 'string',
              example: 'Classic Italian pizza with fresh mozzarella'
            },
            category: {
              type: 'string',
              example: 'Pizza'
            },
            price: {
              type: 'number',
              example: 12.99
            },
            recipeId: {
              type: 'string',
              example: 'recipe_1234567890'
            },
            image: {
              type: 'string',
              example: 'https://example.com/images/pizza.jpg'
            },
            isAvailable: {
              type: 'boolean',
              example: true
            }
          }
        },
        PosOrder: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              example: 'order_1234567890'
            },
            orderNumber: {
              type: 'string',
              example: 'ORD-001'
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  menuItemId: {
                    type: 'string'
                  },
                  quantity: {
                    type: 'number'
                  },
                  price: {
                    type: 'number'
                  },
                  subtotal: {
                    type: 'number'
                  }
                }
              }
            },
            subtotal: {
              type: 'number',
              example: 25.98
            },
            tax: {
              type: 'number',
              example: 2.6
            },
            total: {
              type: 'number',
              example: 28.58
            },
            status: {
              type: 'string',
              enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
              example: 'pending'
            },
            paymentMethod: {
              type: 'string',
              enum: ['cash', 'card', 'digital'],
              example: 'card'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Staff: {
          type: 'object',
          properties: {
            staffId: {
              type: 'string',
              example: 'staff_1234567890'
            },
            fullName: {
              type: 'string',
              example: 'Jane Smith'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'jane@example.com'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            role: {
              type: 'string',
              example: 'cashier'
            },
            pin: {
              type: 'string',
              example: '1234'
            },
            branchId: {
              type: 'string',
              example: 'branch_1234567890'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                status: 401,
                message: 'Unauthorized',
                error: 'Invalid or missing authentication token'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'User does not have permission to access this resource',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                status: 403,
                message: 'Forbidden',
                error: 'Insufficient permissions'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                status: 404,
                message: 'Not Found',
                error: 'The requested resource was not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                status: 400,
                message: 'Validation Error',
                error: 'Invalid input data'
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                status: 500,
                message: 'Internal Server Error',
                error: 'An unexpected error occurred'
              }
            }
          }
        }
      },
      parameters: {
        tenantId: {
          name: 'x-tenant-id',
          in: 'header',
          required: true,
          schema: {
            type: 'string'
          },
          description: 'Tenant identifier'
        },
        page: {
          name: 'page',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          },
          description: 'Page number for pagination'
        },
        limit: {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10
          },
          description: 'Number of items per page'
        },
        search: {
          name: 'search',
          in: 'query',
          schema: {
            type: 'string'
          },
          description: 'Search query'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Superadmin authentication endpoints'
      },
      {
        name: 'Tenant Authentication',
        description: 'Tenant user authentication endpoints'
      },
      {
        name: 'Tenants',
        description: 'Tenant management (superadmin only)'
      },
      {
        name: 'Plans',
        description: 'Subscription plan management'
      },
      {
        name: 'Branches',
        description: 'Branch management'
      },
      {
        name: 'Inventory',
        description: 'Inventory item management'
      },
      {
        name: 'Inventory Categories',
        description: 'Inventory category management'
      },
      {
        name: 'Recipes',
        description: 'Recipe management'
      },
      {
        name: 'Recipe Variations',
        description: 'Recipe variation management'
      },
      {
        name: 'Menu Categories',
        description: 'Menu category management'
      },
      {
        name: 'Menu Items',
        description: 'Menu item management'
      },
      {
        name: 'Menu Variations',
        description: 'Menu variation management'
      },
      {
        name: 'Branch Menu',
        description: 'Branch-specific menu management'
      },
      {
        name: 'Branch Inventory',
        description: 'Branch-specific inventory management'
      },
      {
        name: 'Staff',
        description: 'Staff management'
      },
      {
        name: 'POS Menu',
        description: 'POS menu operations'
      },
      {
        name: 'POS Till',
        description: 'POS till operations'
      },
      {
        name: 'POS Terminal',
        description: 'POS terminal management'
      },
      {
        name: 'POS Orders',
        description: 'POS order management'
      },
      {
        name: 'RBAC',
        description: 'Role-based access control'
      },
      {
        name: 'Dashboard',
        description: 'Dashboard and analytics'
      },
      {
        name: 'Communications',
        description: 'Communication and announcements'
      }
    ]
  },
  // Paths to files containing OpenAPI definitions
  apis: [
    path.join(__dirname, '../features/**/*.js'),
    path.join(__dirname, './swagger.schemas.js')
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
