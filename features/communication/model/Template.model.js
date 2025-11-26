const mongoose = require('mongoose');

try {
  'use strict';

  const TemplateSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: ['email','inapp','push','sms'], default: 'email' },
    subject: { type: String, trim: true },
    body: { type: String, required: true }, // HTML/MJML/Handlebars
    variables: { type: [String], default: [] },
    status: { type: String, enum: ['active','inactive'], default: 'active' },
  }, { timestamps: true });

  TemplateSchema.index({ name: 1 }, { unique: true });

  const Template = mongoose.model('Template', TemplateSchema);
  module.exports = Template;

} catch (e) { console.error('Template schema error:', e); }
