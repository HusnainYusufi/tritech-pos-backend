// ======== middlewares/checkRoles.js ========
module.exports = (allowedRoles = []) => (req, res, next) => {
  const userRoles = req.user?.roles || [];
  const hasRole = Array.isArray(allowedRoles)
    ? allowedRoles.some(r => userRoles.includes(r))
    : userRoles.includes(allowedRoles);

  if (!hasRole) {
    return next(new (require('../modules/AppError'))(
      'Forbidden: insufficient permissions', 403
    ));
  }
  next();
}