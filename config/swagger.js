// config/swagger.js
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tritech POS',
      version: '1.0.0',
      description: 'API documentation for your Node.js backend',
    },
    servers: [
      {
        url: process.env.SWAGGER_SERVER_URL || 'http://localhost:3000',
        description: 'Local dev server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        tenantHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-tenant-id',
          description: 'Tenant identifier (for multi-tenant requests)',
        },
      },
    },
    security: [
      { bearerAuth: [], tenantHeader: [] },
    ],
  },

  // 👇 Adjust glob to your structure
  apis: [
    path.join(__dirname, '../feature/**/*.js'),           // all feature files
    path.join(__dirname, '../config/swagger-schemas.js'), // shared schemas
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
