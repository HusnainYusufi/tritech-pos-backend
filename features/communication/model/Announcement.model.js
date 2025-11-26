const mongoose = require('mongoose');

try {
  'use strict';

  const AnnouncementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    channels: { type: [String], enum: ['email','inapp','push','sms'], default: ['email'] },
    status: { type: String, enum: ['draft','scheduled','sent'], default: 'draft' },

    scheduleAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },

    recipientsQuery: { type: Object, default: {} },
    recipientsCount: { type: Number, default: 0 },
    metrics: {
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      readRate: { type: Number, default: 0 },
    }
  }, { timestamps: true });

  const Announcement = mongoose.model('Announcement', AnnouncementSchema);
  module.exports = Announcement;

} catch (e) { console.error('Announcement schema error:', e); }
