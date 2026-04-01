const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ACTIVE_RECORD_FILTER = { deletedAt: null };

async function getSummary() {
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.financialRecord.aggregate({
      where: { ...ACTIVE_RECORD_FILTER, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.financialRecord.aggregate({
      where: { ...ACTIVE_RECORD_FILTER, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = Number(incomeAgg._sum.amount || 0);
  const totalExpenses = Number(expenseAgg._sum.amount || 0);

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
  };
}

async function getCategories(type) {
  const where = { ...ACTIVE_RECORD_FILTER };
  if (type) where.type = type;

  const groups = await prisma.financialRecord.groupBy({
    by: ['category'],
    where,
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  const grandTotal = groups.reduce((sum, g) => sum + Number(g._sum.amount || 0), 0);

  return groups.map((g) => {
    const totalAmount = Number(g._sum.amount || 0);
    return {
      category: g.category,
      totalAmount,
      count: g._count.id,
      percentageOfTotal: grandTotal > 0 ? Math.round((totalAmount / grandTotal) * 10000) / 100 : 0,
    };
  });
}

async function getMonthlyTrends() {
  const now = new Date();
  const months = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const partitionKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { year: 'numeric', month: 'short' });
    months.push({ partitionKey, label });
  }

  const records = await prisma.financialRecord.groupBy({
    by: ['partitionKey', 'type'],
    where: ACTIVE_RECORD_FILTER,
    _sum: { amount: true },
  });

  const lookup = {};
  for (const r of records) {
    if (!lookup[r.partitionKey]) lookup[r.partitionKey] = {};
    lookup[r.partitionKey][r.type] = Number(r._sum.amount || 0);
  }

  return months.map((m) => {
    const data = lookup[m.partitionKey] || {};
    const totalIncome = data.INCOME || 0;
    const totalExpenses = data.EXPENSE || 0;
    return {
      month: m.label,
      partitionKey: m.partitionKey,
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
    };
  });
}

async function getWeeklyTrends(weeks = 4) {
  const result = [];
  const now = new Date();

  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.financialRecord.aggregate({
        where: { ...ACTIVE_RECORD_FILTER, type: 'INCOME', date: { gte: weekStart, lte: weekEnd } },
        _sum: { amount: true },
      }),
      prisma.financialRecord.aggregate({
        where: { ...ACTIVE_RECORD_FILTER, type: 'EXPENSE', date: { gte: weekStart, lte: weekEnd } },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount || 0);
    const totalExpenses = Number(expenseAgg._sum.amount || 0);

    result.push({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
    });
  }

  return result;
}

async function getUserSummary(userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const [incomeAgg, expenseAgg, recordCount] = await Promise.all([
    prisma.financialRecord.aggregate({
      where: { ...ACTIVE_RECORD_FILTER, addedBy: userId, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.financialRecord.aggregate({
      where: { ...ACTIVE_RECORD_FILTER, addedBy: userId, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
    prisma.financialRecord.count({
      where: { ...ACTIVE_RECORD_FILTER, addedBy: userId },
    }),
  ]);

  const totalIncome = Number(incomeAgg._sum.amount || 0);
  const totalExpenses = Number(expenseAgg._sum.amount || 0);

  return {
    user,
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    recordCount,
  };
}

module.exports = { getSummary, getCategories, getMonthlyTrends, getWeeklyTrends, getUserSummary };
