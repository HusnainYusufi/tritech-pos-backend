const mongoose = require('mongoose');

try {
  'use strict';

  const UserSchema = new mongoose.Schema({
    fullName: { type: String, trim: true, required: true, maxlength: 120 },
    email:    { type: String, trim: true, lowercase: true, unique: true, required: true },

  
    roleId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
 
    roleName: { type: String, trim: true, required: true }, 


    roles:    { type: [String], default: function() { return [this.roleName].filter(Boolean); } },

    passwordHash: { type: String, required: true },

    status:  { type: String, enum: ['active','suspended'], default: 'active' },
    lastLoginAt: { type: Date },

    resetToken: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  }, { timestamps: true });

  // NOTE: email already has { unique: true } at field level; avoid duplicate index definitions.

  const User = mongoose.model('User', UserSchema);
  module.exports = User;

} catch (error) {
  console.error('Error creating User schema:', error);
}
