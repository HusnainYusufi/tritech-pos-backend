'use strict';

const mongoose = require('mongoose');

/**
 * PasswordResetOTP Model
 * Stores OTP codes for password reset (both admin and tenant users)
 * Stored in MAIN DB for centralized OTP management
 */
const PasswordResetOTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  otpHash: {
    type: String,
    required: true
    // bcrypt hash of the OTP for security
  },
  
  userType: {
    type: String,
    enum: ['admin', 'tenant'],
    required: true
    // Determines which DB to update password in
  },
  
  tenantSlug: {
    type: String,
    default: null,
    trim: true,
    lowercase: true
    // Required only for tenant users
  },
  
  attempts: {
    type: Number,
    default: 0
    // Track verification attempts (max 5)
  },
  
  expiresAt: {
    type: Date,
    required: true,
    index: true
    // OTP valid for 10 minutes
  },
  
  verified: {
    type: Boolean,
    default: false
    // True after successful OTP verification
  },
  
  verifiedAt: {
    type: Date,
    default: null
  },
  
  usedForReset: {
    type: Boolean,
    default: false
    // True after password is reset (prevents reuse)
  },
  
  ipAddress: {
    type: String,
    default: null
  },
  
  userAgent: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for automatic cleanup of expired OTPs
PasswordResetOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient lookups
PasswordResetOTPSchema.index({ email: 1, verified: 1, usedForReset: 1 });

module.exports = mongoose.model('PasswordResetOTP', PasswordResetOTPSchema);

