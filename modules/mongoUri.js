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
    // Check if it's a valid MongoDB URI format
    if (!dbUri.startsWith('mongodb://') && !dbUri.startsWith('mongodb+srv://')) {
      console.warn(`[mongoUri] Invalid MongoDB URI format: ${dbUri}`);
      return dbUri;
    }

    const parsed = new URL(dbUri);
    if (!parsed.searchParams.has('authSource')) {
      parsed.searchParams.set('authSource', getDefaultAuthSource());
    }
    return parsed.toString();
  } catch (err) {
    console.error(`[mongoUri] Failed to parse URI: ${dbUri}`, err.message);
    // If URL parsing fails, try manual string manipulation as fallback
    try {
      const authSource = getDefaultAuthSource();
      if (dbUri.includes('?')) {
        // Already has query params
        if (!dbUri.includes('authSource=')) {
          return `${dbUri}&authSource=${authSource}`;
        }
      } else {
        // No query params yet
        return `${dbUri}?authSource=${authSource}`;
      }
    } catch (fallbackErr) {
      console.error(`[mongoUri] Fallback parsing also failed`, fallbackErr.message);
    }
    return dbUri;
  }
}

function buildTenantDbUri(slug) {
  const baseUri = process.env.MONGO_URI_MAIN || 'mongodb://localhost:27017';
  const dbName = `tenant_${slug}`;

  try {
    // Validate base URI format
    if (!baseUri.startsWith('mongodb://') && !baseUri.startsWith('mongodb+srv://')) {
      console.warn(`[mongoUri] Invalid base MongoDB URI format: ${baseUri}`);
      // Fallback to string concat
      const authSource = getDefaultAuthSource();
      const suffix = baseUri.includes('?') ? `&authSource=${authSource}` : `?authSource=${authSource}`;
      return `${baseUri.replace(/\/+$/, '')}/${dbName}${suffix}`;
    }

    const parsed = new URL(baseUri);
    parsed.pathname = `/${dbName}`;
    if (!parsed.searchParams.has('authSource')) {
      parsed.searchParams.set('authSource', getDefaultAuthSource());
    }
    return parsed.toString();
  } catch (err) {
    console.error(`[mongoUri] Failed to build tenant URI for ${slug}:`, err.message);
    // Fallback to string concat if URL parsing fails
    const authSource = getDefaultAuthSource();
    const suffix = baseUri.includes('?') ? `&authSource=${authSource}` : `?authSource=${authSource}`;
    return `${baseUri.replace(/\/+$/, '')}/${dbName}${suffix}`;
  }
}

module.exports = { getDefaultAuthSource, withAuthSource, buildTenantDbUri };
