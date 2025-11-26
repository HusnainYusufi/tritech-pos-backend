'use strict';
const AppError = require('../modules/AppError');

// Usage in routes: allow('admin'), allow('admin','csr_user'), etc.
module.exports = (...allowed) => (req, _res, next) => {
  // your JWT payload (createToken) includes userType = role name
  const role = req.user?.userType || req.user?.role || null;
  if (!role || !allowed.map(String).includes(String(role))) {
    return next(new AppError('Forbidden: insufficient permissions', 403));
  }
  next();
};
