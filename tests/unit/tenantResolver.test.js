// tests/unit/tenantResolver.test.js
const { resolveTenantSlug } = require('../../modules/tenantResolver');
const jwt = require('jsonwebtoken');

describe('tenantResolver', () => {
  describe('resolveTenantSlug', () => {
    const JWT_SECRET = process.env.JWT_SECRET_KEY || 'test-secret';

    it('should extract tenant from JWT token (priority 1)', async () => {
      const token = jwt.sign({ tenantSlug: 'acme', uid: '123' }, JWT_SECRET);
      const req = {
        headers: {
          'authorization': `Bearer ${token}`,
          'x-tenant-id': 'wrong-tenant'
        },
        body: { email: 'user@gmail.com' },
        hostname: 'wrong-tenant.com'
      };

      const result = await resolveTenantSlug(req);
      expect(result).toBe('acme');
    });

    it('should extract tenant from header (priority 2)', async () => {
      const req = {
        headers: {
          'x-tenant-id': 'acme'
        },
        body: {},
        hostname: 'wrong-tenant.com'
      };

      const result = await resolveTenantSlug(req);
      expect(result).toBe('acme');
    });

    it('should extract tenant from subdomain (priority 3)', async () => {
      const req = {
        headers: {},
        body: {},
        hostname: 'acme.yourapp.com'
      };

      const result = await resolveTenantSlug(req);
      expect(result).toBe('acme');
    });

    it('should return null when no tenant source available', async () => {
      const req = {
        headers: {},
        body: {},
        hostname: 'localhost'
      };

      const result = await resolveTenantSlug(req);
      expect(result).toBeNull();
    });

    it('should handle invalid JWT gracefully', async () => {
      const req = {
        headers: {
          'authorization': 'Bearer invalid-token',
          'x-tenant-id': 'acme'
        },
        body: {},
        hostname: 'localhost'
      };

      const result = await resolveTenantSlug(req);
      expect(result).toBe('acme'); // Falls back to header
    });

    it('should handle expired JWT gracefully', async () => {
      const expiredToken = jwt.sign(
        { tenantSlug: 'acme', uid: '123' },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const req = {
        headers: {
          'authorization': `Bearer ${expiredToken}`,
          'x-tenant-id': 'fallback-tenant'
        },
        body: {},
        hostname: 'localhost'
      };

      const result = await resolveTenantSlug(req);
      expect(result).toBe('fallback-tenant'); // Falls back to header
    });

    it('should normalize tenant slug to lowercase', async () => {
      const req = {
        headers: {
          'x-tenant-id': 'ACME'
        },
        body: {},
        hostname: 'localhost'
      };

      const result = await resolveTenantSlug(req);
      expect(result).toBe('acme');
    });

    it('should trim whitespace from tenant slug', async () => {
      const req = {
        headers: {
          'x-tenant-id': '  acme  '
        },
        body: {},
        hostname: 'localhost'
      };

      const result = await resolveTenantSlug(req);
      expect(result).toBe('acme');
    });
  });
});

