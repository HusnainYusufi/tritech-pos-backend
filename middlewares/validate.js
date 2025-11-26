// ======== middlewares/validate.js ========
const AppError = require('../modules/AppError');
module.exports = (schema) => async (req, res, next) => {
  try {
    const data = { ...req.body, ...req.params, ...req.query };
    await schema.validateAsync(data, { abortEarly: false, allowUnknown: true, stripUnknown: true });
    next();
  } catch (error) {
    const details = error.details ? error.details.map(d => ({ field: d.path.join('.'), message: d.message })) : null;
    next(new AppError('Validation failed', 400, details));
  }
};
