const crypto = require('crypto');

function generateApiKey() {
  return crypto.randomUUID();
}

/**
 * Build a unique, HTTP-safe header name from a user's display name.
 * Example: "John Doe" → "X-Finance-JohnDoe-a3f1"
 */
function generateHeaderName(name) {
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '');
  const suffix = crypto.randomBytes(2).toString('hex');
  return `X-Finance-${sanitized}-${suffix}`;
}

module.exports = { generateApiKey, generateHeaderName };
