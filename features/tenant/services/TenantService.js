const mongoose = require('mongoose');
const TenantRepo = require('../repository/tenant.repository');
const Plan = require('../../plan/model/Plan.model');
const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const { sendEmail } = require('../../../modules/helper');
const TenantRoleService = require('../../tenant-rbac/services/TenantRoleService');
const { buildTenantDbUri } = require('../../../modules/mongoUri');

// main DB directory: email -> tenantSlug (needed for login without x-tenant-id)
const TenantUserDirectoryRepo = require('../../tenant-auth/repository/tenantUserDirectory.repository');


// for seeding Owner user + invite
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
// schema factory compiled on the TENANT connection (not global)
const TenantUserSchemaFactory = require('../../tenant-auth/model/TenantUser.schema');

const ACCEPT_BASE =
  process.env.TENANT_ACCEPT_BASE_URL ||
  'https://pos-admin.tritechtechnologyllc.com/accept-invite';

class TenantService {

  /**
   * Admin creates a tenant:
   * - Creates tenant DB (e.g., mongodb://HOST:PORT/tenant_slug)
   * - Seeds a simple settings doc
   * - Seeds an Owner user with a 24h invite token (if contactEmail provided)
   * - Stores tenant doc in admin DB with dbUri
   * - Sends invite email to Owner
   */
  static async create(data) {
    // 1) basic guards
    const slug = String(data.slug).toLowerCase();
    const dbName = `tenant_${slug}`;
    const exists = await TenantRepo.getBySlug(slug);
  if (exists) throw new AppError('Slug already exists', 409);

  if (data.planId) {
    const plan = await Plan.findById(data.planId).lean();
    if (!plan) throw new AppError('Plan not found', 404);
  }

  // 2) build the tenant DB URI from MONGO_URI_MAIN (no db name here!)
  const tenantDbUri = buildTenantDbUri(slug);

  let tempConn;
  let inviteInfo = null;

  try {
    // 3) open a dedicated connection to the new DB and seed minimal data
    tempConn = await mongoose.createConnection(tenantDbUri);

    logger.info(`[TenantService] Initialized tenant DB ${dbName}`);

    // seed a tiny setting
    const SettingSchema = new mongoose.Schema({
      key: String,
      value: mongoose.Schema.Types.Mixed,
    });
    const Setting = tempConn.models.Setting || tempConn.model('Setting', SettingSchema, 'settings');
    await Setting.create({ key: 'init', value: true });

    // ✅ NEW: seed default roles into this tenant DB
    await TenantRoleService.seedDefaults(tempConn);

    // 4) seed Owner user with invite token (only if we have a contactEmail)
    if (data.contactEmail) {
      const TenantUser =
        tempConn.models.TenantUser ||
        tempConn.model('TenantUser', TenantUserSchemaFactory(mongoose.Schema), 'tenant_users');

      // if user already exists (rare), refresh token; else create new
      const existing = await TenantUser.findOne({ email: data.contactEmail });
      const token = crypto.randomBytes(24).toString('hex');
      let ownerDoc;

      if (existing) {
        existing.resetToken = token;
        existing.resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        existing.mustChangePassword = true;
        existing.status = 'active';
        ownerDoc = await existing.save();
      } else {
        // temp random password (will be replaced on accept-invite)
        const randomPass = crypto.randomBytes(12).toString('hex');
        const passwordHash = await bcrypt.hash(randomPass, 10);

        ownerDoc = await TenantUser.create({
          fullName: `${data.name} Owner`,
          email: data.contactEmail,
          roles: ['owner'],
          branchIds: [],
          passwordHash,
          mustChangePassword: true,
          status: 'active',
          resetToken: token,
          resetTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        });
      }

      // Ensure login WITHOUT x-tenant-id works (gmail/outlook supported)
      // by keeping a main-DB mapping: email -> tenantSlug
      if (ownerDoc?._id) {
        await TenantUserDirectoryRepo.upsertByEmail({
          email: data.contactEmail,
          tenantSlug: slug,
          tenantUserId: ownerDoc._id,
          userType: 'owner'
        });
      }

      inviteInfo = { token, email: data.contactEmail, tenantSlug: slug };
    }

  } catch (err) {
    logger.error(err);
    throw new AppError('Failed to initialize tenant DB', 500);
  } finally {
    // Close bootstrap connection (we’ll reconnect per-request via tenantContext)
    if (tempConn) {
      try { await tempConn.close(); } catch (e) { logger.error(e); }
    }
  }

  // 5) record the tenant in admin DB
  const doc = await TenantRepo.create({
    ...data,
    slug,
    dbUri: tenantDbUri,
  });

  // 6) email: single invite (if we seeded an owner)
  try {
    if (inviteInfo) {
      const acceptUrl = `${ACCEPT_BASE}?tenant=${inviteInfo.tenantSlug}&token=${inviteInfo.token}`;
      await sendEmail({
        from: '"Tritech Technology" <no-reply@tritechtechnologyllc.com>',
        to: inviteInfo.email,
        subject: `You're invited to Tritech (${data.name})`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
            <h2>Your workspace is ready</h2>
            <p>Hi ${data.name},</p>
            <p>Your POS workspace has been created. Click below to set your password and activate your Owner account.</p>
            <p><a href="${acceptUrl}" style="display:inline-block;background:#0a2540;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Accept Invite</a></p>
            <p>This link expires in 24 hours.</p>
            <hr/>
            <p style="font-size:12px;color:#666">If the button doesn't work, copy & paste this URL:<br/>${acceptUrl}</p>
          </div>
        `,
      });
    }
  } catch (e) {
    // Don’t fail tenant creation if email fails; just log
    logger.error(`[TenantService] Invite email error: ${e.message}`);
  }

  return { status: 200, message: 'Tenant created and DB deployed', result: doc };
}


  static async update(id, patch) {
    if (patch.planId) {
      const plan = await Plan.findById(patch.planId).lean();
      if (!plan) throw new AppError('Plan not found', 404);
    }
    const doc = await TenantRepo.updateById(id, patch);
    if (!doc) throw new AppError('Tenant not found', 404);
    return { status: 200, message: 'Tenant updated', result: doc };
  }

  static async get(id) {
    const doc = await TenantRepo.getById(id);
    if (!doc) throw new AppError('Tenant not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  static async list(params) {
    const out = await TenantRepo.search(params);
    return { status: 200, message: 'OK', ...out };
  }

  static async del(id) {
    const doc = await TenantRepo.deleteById(id);
    if (!doc) throw new AppError('Tenant not found', 404);
    return { status: 200, message: 'Tenant deleted' };
  }

  static async changePlan(id, planId) {
    const plan = await Plan.findById(planId).lean();
    if (!plan) throw new AppError('Plan not found', 404);
    const doc = await TenantRepo.updateById(id, {
      planId,
      status: (plan.type === 'trial' ? 'trial' : 'paid')
    });
    if (!doc) throw new AppError('Tenant not found', 404);
    return { status: 200, message: 'Plan changed', result: doc };
  }
}

module.exports = TenantService;
