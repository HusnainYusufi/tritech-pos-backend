'use strict';

const PasswordResetOTP = require('../model/PasswordResetOTP.model');

class PasswordResetOTPRepository {
  /**
   * Create a new OTP record
   */
  static async create(data) {
    return PasswordResetOTP.create(data);
  }

  /**
   * Find the latest valid OTP for an email
   */
  static async findLatestValid(email) {
    const now = new Date();
    return PasswordResetOTP.findOne({
      email: email.toLowerCase().trim(),
      expiresAt: { $gt: now },
      usedForReset: false
    })
    .sort({ createdAt: -1 })
    .lean();
  }

  /**
   * Find the latest valid OTP document (for updates)
   */
  static async findLatestValidDoc(email) {
    const now = new Date();
    return PasswordResetOTP.findOne({
      email: email.toLowerCase().trim(),
      expiresAt: { $gt: now },
      usedForReset: false
    })
    .sort({ createdAt: -1 });
  }

  /**
   * Find verified OTP that hasn't been used yet
   */
  static async findVerifiedUnused(email) {
    const now = new Date();
    return PasswordResetOTP.findOne({
      email: email.toLowerCase().trim(),
      verified: true,
      usedForReset: false,
      expiresAt: { $gt: now }
    })
    .sort({ verifiedAt: -1 })
    .lean();
  }

  /**
   * Mark OTP as used
   */
  static async markAsUsed(id) {
    return PasswordResetOTP.findByIdAndUpdate(
      id,
      { usedForReset: true },
      { new: true }
    );
  }

  /**
   * Invalidate all OTPs for an email
   */
  static async invalidateAll(email) {
    return PasswordResetOTP.updateMany(
      { email: email.toLowerCase().trim() },
      { usedForReset: true }
    );
  }

  /**
   * Count recent OTP requests (for rate limiting)
   */
  static async countRecentRequests(email, minutesAgo = 15) {
    const since = new Date(Date.now() - minutesAgo * 60 * 1000);
    return PasswordResetOTP.countDocuments({
      email: email.toLowerCase().trim(),
      createdAt: { $gte: since }
    });
  }

  /**
   * Increment attempt counter
   */
  static async incrementAttempts(id) {
    return PasswordResetOTP.findByIdAndUpdate(
      id,
      { $inc: { attempts: 1 } },
      { new: true }
    );
  }

  /**
   * Mark as verified
   */
  static async markAsVerified(id) {
    return PasswordResetOTP.findByIdAndUpdate(
      id,
      { 
        verified: true,
        verifiedAt: new Date()
      },
      { new: true }
    );
  }
}

module.exports = PasswordResetOTPRepository;

