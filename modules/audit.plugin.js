// modules/audit.plugin.js
module.exports = function auditPlugin(schema, options = {}) {
  schema.add({
    createdBy: { type: String, default: null }, // uid/email from req.user if present
    updatedBy: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  });

  schema.methods.softDelete = function(userId) {
    this.deletedAt = new Date();
    if (userId) this.updatedBy = userId;
    return this.save();
  };

  schema.pre('save', function(next) {
    if (!this.isNew) this.updatedAt = new Date();
    next();
  });

  // hide soft-deleted by default
  if (!schema.options.toJSON) schema.options.toJSON = {};
  schema.options.toJSON.transform = (doc, ret) => {
    if (ret.deletedAt) ret._deleted = true;
    return ret;
  };
  schema.pre(/^find/, function(next) {
    if (!this.getQuery()._withDeleted) {
      this.where({ deletedAt: null });
    } else {
      const q = this.getQuery();
      delete q._withDeleted;
    }
    next();
  });
};
