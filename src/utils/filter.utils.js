const { Decimal } = require('@prisma/client/runtime/library');

/**
 * Build a Prisma `where` clause for FinancialRecord queries.
 * Uses ONLY Prisma query operators — no raw SQL, no $queryRaw.
 *
 * This is the SINGLE source of filtering logic across the app.
 *
 * Supported query params:
 *   type, category, startDate, endDate, partitionKey,
 *   search, minAmount, maxAmount
 */
function buildRecordWhereClause(query = {}) {
  const where = { deletedAt: null };

  if (query.type) {
    where.type = query.type;
  }

  if (query.category) {
    where.category = { contains: query.category, mode: 'insensitive' };
  }

  if (query.startDate || query.endDate) {
    where.date = {};
    if (query.startDate) where.date.gte = new Date(query.startDate);
    if (query.endDate) where.date.lte = new Date(query.endDate);
  }

  if (query.partitionKey) {
    where.partitionKey = query.partitionKey;
  }

  if (query.search) {
    where.OR = [
      { category: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.minAmount || query.maxAmount) {
    where.amount = {};
    if (query.minAmount) where.amount.gte = new Decimal(query.minAmount);
    if (query.maxAmount) where.amount.lte = new Decimal(query.maxAmount);
  }

  return where;
}

module.exports = { buildRecordWhereClause };
