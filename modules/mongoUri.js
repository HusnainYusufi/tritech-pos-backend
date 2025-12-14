'use strict';

const DEFAULT_AUTH_SOURCE = 'admin';

function getDefaultAuthSource() {
  const candidates = [process.env.MONGO_URI, process.env.MONGO_URI_MAIN];
  for (const uri of candidates) {
    if (!uri) continue;
    try {
      const parsed = new URL(uri);
      const auth = parsed.searchParams.get('authSource');
      if (auth) return auth;
    } catch (err) {
      // ignore malformed values, fall through to fallback
    }
  }
  return process.env.MONGO_AUTH_DB || DEFAULT_AUTH_SOURCE;
}

function withAuthSource(dbUri) {
  if (!dbUri) return dbUri;
  try {
    const parsed = new URL(dbUri);
    if (!parsed.searchParams.has('authSource')) {
      parsed.searchParams.set('authSource', getDefaultAuthSource());
    }
    return parsed.toString();
  } catch (err) {
    return dbUri;
  }
}

function buildTenantDbUri(slug) {
  const baseUri = process.env.MONGO_URI_MAIN || 'mongodb://localhost:27017';
  const dbName = `tenant_${slug}`;

  try {
    const parsed = new URL(baseUri);
    parsed.pathname = `/${dbName}`;
    if (!parsed.searchParams.has('authSource')) {
      parsed.searchParams.set('authSource', getDefaultAuthSource());
    }
    return parsed.toString();
  } catch (err) {
    // Fallback to string concat if URL parsing fails
    const suffix = baseUri.includes('?') ? '' : `?authSource=${getDefaultAuthSource()}`;
    return `${baseUri.replace(/\/+$/, '')}/${dbName}${suffix}`;
  }
}

module.exports = { getDefaultAuthSource, withAuthSource, buildTenantDbUri };
