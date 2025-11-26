'use strict';
const logger = require('../modules/logger');

module.exports = (err, req, res, _next) => {
  // Ensure we always respond JSON
  const status = (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600) ? err.status : 500;

  const payload = {
    success: false,
    error: {
      message: err?.message || 'Internal Server Error'
    }
  };
  if (err?.details) payload.error.details = err.details;

  // Log with context
  const meta = {
    status,
    path: req.originalUrl,
    method: req.method
  };

  if (status < 500) {
    logger.warn ? logger.warn(payload.error.message, meta) : logger.error(payload.error.message, meta);
  } else {
    logger.error(payload.error.message, { ...meta, stack: err?.stack });
  }

  res.status(status).json(payload);
};
