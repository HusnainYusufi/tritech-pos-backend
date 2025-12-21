/**
 * Swagger Auto-generation Script
 * 
 * This script uses swagger-autogen to automatically generate swagger-output.json
 * from your route files. This is an alternative to manually writing JSDoc comments.
 * 
 * Note: The main swagger documentation now uses swagger-jsdoc with manual JSDoc comments
 * for better control and documentation quality. This file is kept for reference.
 * 
 * Usage: npm run swagger:generate
 */

const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Tritech POS API',
    description: 'Auto-generated API documentation for Tritech POS Backend',
    version: '1.0.0',
  },
  servers: [
    {
      url: process.env.SWAGGER_SERVER_URL || 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: process.env.PRODUCTION_URL || 'https://api.tritechpos.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Authorization header using the Bearer scheme',
      },
      tenantHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-tenant-id',
        description: 'Tenant identifier for multi-tenant requests',
      },
    },
  },
  security: [
    { bearerAuth: [] },
  ],
  tags: [
    { name: 'Authentication', description: 'Superadmin authentication' },
    { name: 'Tenant Authentication', description: 'Tenant user authentication' },
    { name: 'Tenants', description: 'Tenant management' },
    { name: 'Plans', description: 'Subscription plans' },
    { name: 'Branches', description: 'Branch management' },
    { name: 'Inventory', description: 'Inventory management' },
    { name: 'Recipes', description: 'Recipe management' },
    { name: 'Menu', description: 'Menu management' },
    { name: 'POS', description: 'Point of Sale operations' },
    { name: 'Staff', description: 'Staff management' },
  ],
};

const outputFile = './swagger-output.json';

// Entry files that load your routes
const endpointsFiles = [
  './config/Routes.js',
];

swaggerAutogen(outputFile, endpointsFiles, doc)
  .then(() => {
    console.log('✅ Swagger documentation generated successfully!');
    console.log('📄 Output file: swagger-output.json');
    console.log('🚀 Start the server and visit: http://localhost:3000/api/docs');
  })
  .catch((err) => {
    console.error('❌ Error generating swagger documentation:', err);
    process.exit(1);
  });
