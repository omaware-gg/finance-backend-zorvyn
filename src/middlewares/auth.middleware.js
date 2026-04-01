const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../utils/jwt.utils');
const { sendError } = require('../utils/response.utils');

const prisma = new PrismaClient();

const ACTIVE_USER_FILTER = { deletedAt: null, isActive: true, role: { not: 'NO_ACCESS' } };

/**
 * Dual-strategy authentication middleware.
 *
 * Strategy 1 — JWT Bearer token (checked first when Authorization header present)
 * Strategy 2 — Per-user API key via custom X-Finance-* header
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Strategy 1: JWT
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return sendError(res, 'Malformed Authorization header', 401, null, 'UNAUTHORIZED');
      }

      let decoded;
      try {
        decoded = verifyToken(parts[1]);
      } catch {
        return sendError(res, 'Invalid or expired token', 401, null, 'UNAUTHORIZED');
      }

      const user = await prisma.user.findFirst({
        where: { id: decoded.id, ...ACTIVE_USER_FILTER },
      });

      if (!user) {
        return sendError(res, 'User not found or deactivated', 401, null, 'UNAUTHORIZED');
      }

      req.user = user;
      return next();
    }

    // Strategy 2: API Key — look for any header starting with "X-Finance-"
    const apiKeyHeader = Object.keys(req.headers).find((h) =>
      h.toLowerCase().startsWith('x-finance-')
    );

    if (apiKeyHeader) {
      const apiKeyValue = req.headers[apiKeyHeader];
      const headerNameNormalized = apiKeyHeader.toLowerCase();

      const user = await prisma.user.findFirst({
        where: {
          headerName: { equals: apiKeyHeader, mode: 'insensitive' },
          apiKey: apiKeyValue,
          ...ACTIVE_USER_FILTER,
        },
      });

      if (!user) {
        return sendError(res, 'Invalid API key', 401, null, 'UNAUTHORIZED');
      }

      req.user = user;
      return next();
    }

    return sendError(res, 'Authentication required', 401, null, 'UNAUTHORIZED');
  } catch (err) {
    return sendError(res, 'Authentication failed', 401, null, 'UNAUTHORIZED');
  }
}

module.exports = { authenticate };
