'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const PasswordResetOTPRepo = require('../repository/passwordResetOTP.repository');
const { transporter } = require('../../../modules/nodemail');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;

class OTPService {
  /**
   * Generate a random 6-digit OTP
   */
  static generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Request OTP for password reset
   * @param {string} email - User email
   * @param {string} userType - 'admin' or 'tenant'
   * @param {string|null} tenantSlug - Required for tenant users
   * @param {object} metadata - IP address, user agent, etc.
   */
  static async requestOTP(email, userType, tenantSlug = null, metadata = {}) {
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting check
    const recentCount = await PasswordResetOTPRepo.countRecentRequests(
      normalizedEmail,
      RATE_LIMIT_WINDOW_MINUTES
    );

    if (recentCount >= RATE_LIMIT_REQUESTS) {
      throw new AppError(
        `Too many requests. Please try again in ${RATE_LIMIT_WINDOW_MINUTES} minutes.`,
        429
      );
    }

    // Invalidate any existing OTPs for this email
    await PasswordResetOTPRepo.invalidateAll(normalizedEmail);

    // Generate new OTP
    const otp = this.generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);

    // Calculate expiry
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Create OTP record
    const otpRecord = await PasswordResetOTPRepo.create({
      email: normalizedEmail,
      otpHash,
      userType,
      tenantSlug,
      expiresAt,
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null
    });

    // Send OTP via email
    try {
      await this.sendOTPEmail(normalizedEmail, otp, userType, tenantSlug);
    } catch (emailError) {
      logger.error('Failed to send OTP email:', emailError);
      // Don't throw - OTP is created, email failure shouldn't block the flow
    }

    logger.info(`OTP requested for ${userType} user: ${normalizedEmail}`);

    return {
      status: 200,
      message: 'OTP sent to your email. Please check your inbox.',
      result: {
        email: normalizedEmail,
        expiresIn: `${OTP_EXPIRY_MINUTES} minutes`,
        expiresAt: expiresAt.toISOString()
      }
    };
  }

  /**
   * Verify OTP
   * @param {string} email - User email
   * @param {string} otp - OTP code to verify
   */
  static async verifyOTP(email, otp) {
    const normalizedEmail = email.toLowerCase().trim();

    // Find latest valid OTP
    const otpDoc = await PasswordResetOTPRepo.findLatestValidDoc(normalizedEmail);

    if (!otpDoc) {
      throw new AppError('No valid OTP found. Please request a new one.', 400);
    }

    // Check if already verified
    if (otpDoc.verified) {
      return {
        status: 200,
        message: 'OTP already verified. You can now reset your password.',
        result: {
          email: normalizedEmail,
          verified: true
        }
      };
    }

    // Check max attempts
    if (otpDoc.attempts >= MAX_ATTEMPTS) {
      throw new AppError('Maximum verification attempts exceeded. Please request a new OTP.', 400);
    }

    // Increment attempts
    await PasswordResetOTPRepo.incrementAttempts(otpDoc._id);

    // Verify OTP
    const isValid = await bcrypt.compare(otp, otpDoc.otpHash);

    if (!isValid) {
      const remainingAttempts = MAX_ATTEMPTS - (otpDoc.attempts + 1);
      throw new AppError(
        `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        400
      );
    }

    // Mark as verified
    await PasswordResetOTPRepo.markAsVerified(otpDoc._id);

    logger.info(`OTP verified for ${otpDoc.userType} user: ${normalizedEmail}`);

    return {
      status: 200,
      message: 'OTP verified successfully. You can now reset your password.',
      result: {
        email: normalizedEmail,
        verified: true,
        userType: otpDoc.userType,
        tenantSlug: otpDoc.tenantSlug
      }
    };
  }

  /**
   * Validate that user has a verified OTP before allowing password reset
   * @param {string} email - User email
   * @returns {object} OTP record with user details
   */
  static async validateVerifiedOTP(email) {
    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await PasswordResetOTPRepo.findVerifiedUnused(normalizedEmail);

    if (!otpRecord) {
      throw new AppError(
        'No verified OTP found. Please request and verify an OTP first.',
        400
      );
    }

    return otpRecord;
  }

  /**
   * Mark OTP as used after successful password reset
   * @param {string} email - User email
   */
  static async markOTPAsUsed(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const otpRecord = await PasswordResetOTPRepo.findVerifiedUnused(normalizedEmail);

    if (otpRecord) {
      await PasswordResetOTPRepo.markAsUsed(otpRecord._id);
      logger.info(`OTP marked as used for: ${normalizedEmail}`);
    }
  }

  /**
   * Send OTP via email
   */
  static async sendOTPEmail(email, otp, userType, tenantSlug) {
    const subject = '🔐 Your Password Reset Code';
    const html = this.buildOTPEmailTemplate(otp, userType, tenantSlug);

    await transporter.sendMail({
      from: '"Tritech POS" <notifications.vmeals@gmail.com>',
      to: email,
      subject,
      html
    });

    logger.info(`OTP email sent to: ${email}`);
  }

  /**
   * Build OTP email template
   */
  static buildOTPEmailTemplate(otp, userType, tenantSlug) {
    const accountType = userType === 'admin' ? 'Admin' : `Tenant (${tenantSlug || 'N/A'})`;

    return `
    <div style="font-family: Arial, sans-serif; background: #f9fafb; padding: 20px;">
      <table width="100%" style="max-width: 600px; margin: auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <tr>
          <td style="background: #0a2540; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">🔐 Password Reset</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px; color: #333; line-height: 1.6;">
            <p style="font-size: 18px;">Hello,</p>
            <p>
              You requested to reset your password for your <strong>${accountType}</strong> account.
            </p>
            <p>
              Your verification code is:
            </p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0a2540;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">
              ⏰ This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
            </p>
            <p style="color: #666; font-size: 14px;">
              🔒 For security, you have <strong>${MAX_ATTEMPTS} attempts</strong> to enter the correct code.
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
              ⚠️ If you didn't request this, please ignore this email or contact support if you're concerned about your account security.
            </p>
            <p style="font-weight: bold; margin-top: 20px;">— The Tritech Team</p>
          </td>
        </tr>
        <tr>
          <td style="background: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #888;">
            © ${new Date().getFullYear()} Tritech Technology LLC. All rights reserved.
          </td>
        </tr>
      </table>
    </div>
    `;
  }
}

module.exports = OTPService;

