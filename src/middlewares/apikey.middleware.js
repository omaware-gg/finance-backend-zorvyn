const { PrismaClient } = require('@prisma/client');
const { sendError } = require('../utils/response.utils');

const prisma = new PrismaClient();

/**
 * Standalone API-key-only authentication for service-to-service integrations
 * (Metabase, Athena export endpoints, etc.). JWT is not accepted on these routes.
 */
async function authenticateApiKey(req, res, next) {
  try {
    const apiKeyHeader = Object.keys(req.headers).find((h) =>
      h.toLowerCase().startsWith('x-finance-')
    );

    if (!apiKeyHeader) {
      return sendError(res, 'API key header required', 401, null, 'UNAUTHORIZED');
    }

    const apiKeyValue = req.headers[apiKeyHeader];

    const user = await prisma.user.findFirst({
      where: {
        headerName: { equals: apiKeyHeader, mode: 'insensitive' },
        apiKey: apiKeyValue,
        deletedAt: null,
        isActive: true,
        role: { not: 'NO_ACCESS' },
      },
    });

    if (!user) {
      return sendError(res, 'Invalid API key', 401, null, 'UNAUTHORIZED');
    }

    req.user = user;
    return next();
  } catch (err) {
    return sendError(res, 'API key authentication failed', 401, null, 'UNAUTHORIZED');
  }
}

module.exports = { authenticateApiKey };
