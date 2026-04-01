const { PrismaClient } = require('@prisma/client');
const { getPagination } = require('../../utils/pagination.utils');

const prisma = new PrismaClient();

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  headerName: true,
  otpEnabled: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

async function getAllUsers({ page, limit, search, role, isActive }) {
  const { skip, take, page: pg, limit: lim } = getPagination({ page, limit });

  const where = { deletedAt: null };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (isActive !== undefined && isActive !== null && isActive !== '') {
    where.isActive = String(isActive).toLowerCase() === 'true';
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page: pg,
    limit: lim,
    totalPages: Math.ceil(total / lim),
  };
}

async function getUserById(id) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...SAFE_USER_SELECT,
      _count: { select: { records: true } },
    },
  });

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return user;
}

async function updateUser(id, { name, role, isActive }, performedBy) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const data = {};
  if (name !== undefined) data.name = name;

  if (role !== undefined) {
    data.role = role;
    if (role === 'NO_ACCESS') data.isActive = false;
    if (user.role === 'NO_ACCESS' && role !== 'NO_ACCESS') data.isActive = true;
    console.log(`[AUDIT] Role change: user=${id} from=${user.role} to=${role} by=${performedBy}`);
  }

  if (isActive !== undefined && data.isActive === undefined) {
    data.isActive = isActive;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: SAFE_USER_SELECT,
  });

  return updated;
}

async function softDeleteUser(id, performedBy) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (id === performedBy) {
    const err = new Error('Cannot delete your own account');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  return { message: 'User soft-deleted. Account remains in DB and can be restored.' };
}

async function getApiKeyForUser(id, requesterId, requesterRole) {
  if (id !== requesterId && requesterRole !== 'ADMIN') {
    const err = new Error('Insufficient permissions for this operation');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { headerName: true, apiKey: true },
  });

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return user;
}

module.exports = { getAllUsers, getUserById, updateUser, softDeleteUser, getApiKeyForUser };
