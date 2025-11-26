const Joi = require('joi');

const createTemplate = Joi.object({
  name: Joi.string().required(),
  channel: Joi.string().valid('email','inapp','push','sms').default('email'),
  subject: Joi.string().allow(''),
  body: Joi.string().required(),
  variables: Joi.array().items(Joi.string()).default([]),
  status: Joi.string().valid('active','inactive').default('active'),
});

const updateTemplate = Joi.object({
  name: Joi.string(), channel: Joi.string().valid('email','inapp','push','sms'), subject: Joi.string().allow(''),
  body: Joi.string(), variables: Joi.array().items(Joi.string()), status: Joi.string().valid('active','inactive'),
});

const createAnnouncement = Joi.object({
  title: Joi.string().required(),
  templateId: Joi.string().required(),
  channels: Joi.array().items(Joi.string().valid('email','inapp','push','sms')).min(1).required(),
  scheduleAt: Joi.date().allow(null),
  recipientsQuery: Joi.object().default({}), 
});

const updateAnnouncement = Joi.object({
  title: Joi.string(),
  templateId: Joi.string(),
  channels: Joi.array().items(Joi.string().valid('email','inapp','push','sms')),
  scheduleAt: Joi.date().allow(null),
  status: Joi.string().valid('draft','scheduled','sent'),
  recipientsQuery: Joi.object()
});

module.exports = { createTemplate, updateTemplate, createAnnouncement, updateAnnouncement };
