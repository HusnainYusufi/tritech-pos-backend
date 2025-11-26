// swagger-gen.js
const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Tritech POS',
    description: 'Auto-generated API docs',
    version: '1.0.0',
  },
  servers: [
    {
      url: process.env.SWAGGER_SERVER_URL || 'http://localhost:3000',
      description: 'Local server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const outputFile = './swagger-output.json';

// 👇 Put entry files that load your routes
const endpointsFiles = [
  './app.js',        // or whatever your main file is (the second block you pasted)
  './config/Routes.js'
];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('✅ Swagger file generated: swagger-output.json');
  // you *can* auto-start server here if you want:
  // require('./index.js')
});
