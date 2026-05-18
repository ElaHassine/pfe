const path = require('path');

function getSharedUploadsRoot() {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }

  // Default to a shared folder at the workspace root so uploads persist across both backends.
  return path.resolve(__dirname, '..', '..', '..', 'shared-uploads');
}

function getUploadsSubdir(...parts) {
  return path.join(getSharedUploadsRoot(), ...parts);
}

function normalizeMediaUrl(rawUrl, req) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  const publicBase = `${req.protocol}://${req.get('host')}`;

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return `${publicBase}${parsed.pathname}${parsed.search}`;
      }
      return value;
    } catch (_error) {
      return value;
    }
  }

  if (value.startsWith('/uploads/')) {
    return `${publicBase}${value}`;
  }

  if (value.startsWith('uploads/')) {
    return `${publicBase}/${value}`;
  }

  return value;
}

module.exports = {
  getSharedUploadsRoot,
  getUploadsSubdir,
  normalizeMediaUrl,
};