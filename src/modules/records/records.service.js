const { PrismaClient } = require('@prisma/client');
const { buildRecordWhereClause } = require('../../utils/filter.utils');
const { getPagination } = require('../../utils/pagination.utils');

const prisma = new PrismaClient();

const ALLOWED_SORT_FIELDS = ['date', 'amount', 'createdAt', 'category'];
const DEFAULT_SORT_FIELD = 'date';
const DEFAULT_SORT_ORDER = 'desc';

const RECORD_SELECT = {
  id: true,
  amount: true,
  type: true,
  category: true,
  date: true,
  partitionKey: true,
  notes: true,
  addedBy: true,
  addedOn: true,
  lastModifiedBy: true,
  lastModifiedAt: true,
  deletedAt: true,
  deletedBy: true,
  version: true,
  creator: { select: { id: true, name: true, email: true } },
};

/**
 * Format a Date into "YYYY-MM" partition key.
 */
function toPartitionKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── 1. Create ──────────────────────────────────────────────────────────────

async function createRecord({ amount, type, category, date, notes }, userId) {
  const partitionKey = toPartitionKey(date);

  const record = await prisma.$transaction(async (tx) => {
    const fiveSecondsAgo = new Date(Date.now() - 5000);

    const duplicate = await tx.financialRecord.findFirst({
      where: {
        addedBy: userId,
        category,
        amount,
        type,
        addedOn: { gt: fiveSecondsAgo },
        deletedAt: null,
      },
    });

    if (duplicate) {
      const err = new Error(
        'A very similar record was just created. Please wait before retrying.'
      );
      err.statusCode = 409;
      err.code = 'DUPLICATE_WRITE';
      throw err;
    }

    return tx.financialRecord.create({
      data: {
        amount,
        type,
        category,
        date: new Date(date),
        partitionKey,
        notes: notes || null,
        addedBy: userId,
        version: 0,
      },
      select: RECORD_SELECT,
    });
  });

  return record;
}

// ─── 2. Get All ─────────────────────────────────────────────────────────────

/*
 * Design assumption: ALL roles with read access see all non-deleted records.
 * ANALYST_WRITE can read all records for analysis but can only POST/PATCH
 * their own. The write-ownership constraint is enforced at the route level
 * (via updateRecord/createRecord which stamp addedBy), not here.
 */
async function getAllRecords(queryParams, requestingUser) {
  const where = buildRecordWhereClause(queryParams);
  const { skip, take, page, limit } = getPagination(queryParams);

  let sortBy = queryParams.sortBy;
  if (!ALLOWED_SORT_FIELDS.includes(sortBy)) sortBy = DEFAULT_SORT_FIELD;
  const sortOrder = queryParams.sortOrder === 'asc' ? 'asc' : DEFAULT_SORT_ORDER;

  const [records, total] = await Promise.all([
    prisma.financialRecord.findMany({
      where,
      select: RECORD_SELECT,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.financialRecord.count({ where }),
  ]);

  return {
    records,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── 3. Get By Id ───────────────────────────────────────────────────────────

async function getRecordById(id) {
  const record = await prisma.financialRecord.findFirst({
    where: { id, deletedAt: null },
    select: RECORD_SELECT,
  });

  if (!record) {
    const err = new Error('Record not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return record;
}

// ─── 4. Update (optimistic locking) ────────────────────────────────────────

async function updateRecord(id, updateData, userId) {
  const { version, ...fields } = updateData;

  const current = await prisma.financialRecord.findFirst({
    where: { id, deletedAt: null },
  });

  if (!current) {
    const err = new Error('Record not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (current.version !== version) {
    const err = new Error(
      'This record was modified by someone else. Please refresh and retry.'
    );
    err.statusCode = 409;
    err.code = 'CONCURRENCY_CONFLICT';
    throw err;
  }

  // ANALYST_WRITE can only update their own records
  if (userId !== current.addedBy) {
    const caller = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (caller && caller.role === 'ANALYST_WRITE') {
      const err = new Error('You can only update your own records');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  const data = { ...fields };
  if (data.date) {
    data.date = new Date(data.date);
    data.partitionKey = toPartitionKey(data.date);
  }
  data.lastModifiedBy = userId;
  data.lastModifiedAt = new Date();
  data.version = { increment: 1 };

  try {
    const updated = await prisma.financialRecord.update({
      where: { id, version },
      data,
      select: RECORD_SELECT,
    });
    return updated;
  } catch (err) {
    if (err.code === 'P2025') {
      const conflict = new Error(
        'This record was modified by someone else. Please refresh and retry.'
      );
      conflict.statusCode = 409;
      conflict.code = 'CONCURRENCY_CONFLICT';
      throw conflict;
    }
    throw err;
  }
}

// ─── 5. Soft Delete ─────────────────────────────────────────────────────────
// Hard deletion is architecturally disabled — no deleteRecord() function exists.

async function softDeleteRecord(id, userId) {
  const record = await prisma.financialRecord.findFirst({
    where: { id, deletedAt: null },
  });

  if (!record) {
    const err = new Error('Record not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  await prisma.financialRecord.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: userId },
  });

  return { message: 'Record soft-deleted. No hard deletion is permitted.' };
}

module.exports = { createRecord, getAllRecords, getRecordById, updateRecord, softDeleteRecord };
