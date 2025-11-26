const validate = (schema) => (req, _res, next) => {
  const data = { ...req.body, ...req.params, ...req.query }; // single object
 const { error } = schema.validate(data, {
  abortEarly: false,
  allowUnknown: true,       // ← add this
  stripUnknown: true        // ← removes them from req.body
});
  if (error) return next(error);
  next();
};

module.exports = validate;
