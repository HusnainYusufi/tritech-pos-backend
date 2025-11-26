'use strict';

try {
  require('dotenv').config();

  require('./config/redis');

  const express = require('express');
  const helmet = require('helmet');
  const path = require('path');

  const { routes } = require('./config/Routes');
  const { Base } = require('./middlewares/Base');
  const logger = require('./modules/logger');
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./swagger-output.json');



  const _errorLogging = require('./middlewares/errorLoggingMiddleware');
  const _notFound = require('./middlewares/notFound');


  const toMiddleware = (m) =>
    typeof m === 'function'
      ? m
      : (m && typeof m.default === 'function' ? m.default : null);

  const errorLoggingMiddleware = toMiddleware(_errorLogging);
  const notFound = toMiddleware(_notFound);

  if (!errorLoggingMiddleware) throw new TypeError('errorLoggingMiddleware export is invalid');
  if (!notFound) throw new TypeError('notFound export is invalid');

  const app = express();
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
  }));

  // Raw JSON spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  const PORT = process.env.PORT || 3000;

  app.use(helmet());


  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Init
  Base.init(app)
    .then(() => {
      // 1) mount all routes
      routes(app);


      app.use(notFound);


      app.use(errorLoggingMiddleware);


    })
    .catch((e) => {
      logger.error('Base.init failed', { message: e.message, stack: e.stack });
      process.exit(1);
    });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', { reason: reason?.message || reason, stack: reason?.stack });
    process.exit(1);
  });

} catch (error) {
  console.error(error);
}
