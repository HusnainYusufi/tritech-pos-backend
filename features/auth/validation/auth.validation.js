const Joi = require('joi');

const register = Joi.object({
  fullName: Joi.string().max(120).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  roleId: Joi.string().required(),      
  inviteCode: Joi.string().allow('').optional() 
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const forgotPassword = Joi.object({
  email: Joi.string().email().required()
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(128).required()
});

// OTP-based password reset validations
const requestOTP = Joi.object({
  email: Joi.string().email().required()
});

const verifyOTP = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().pattern(/^[0-9]{6}$/).required().messages({
    'string.pattern.base': 'OTP must be exactly 6 digits'
  })
});

const resetPasswordWithOTP = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required()
});

module.exports = { 
  register, 
  login, 
  forgotPassword, 
  resetPassword,
  requestOTP,
  verifyOTP,
  resetPasswordWithOTP
};
