const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Override env vars for tests BEFORE any module loads them
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://postgres:password@localhost:5432/finance_test_db';
process.env.NODE_ENV = 'test';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function seedTestData() {
  const adminPw = await bcrypt.hash('Admin@123', SALT_ROUNDS);
  const viewerPw = await bcrypt.hash('View@123', SALT_ROUNDS);
  const analystWPw = await bcrypt.hash('Analyst@123', SALT_ROUNDS);
  const analystRPw = await bcrypt.hash('Reader@123', SALT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      name: 'Test Admin',
      email: 'testadmin@finance.com',
      password: adminPw,
      role: 'ADMIN',
      apiKey: crypto.randomUUID(),
      headerName: 'X-Finance-TestAdmin',
    },
  });

  const viewer = await prisma.user.create({
    data: {
      name: 'Test Viewer',
      email: 'testviewer@finance.com',
      password: viewerPw,
      role: 'VIEWER',
      apiKey: crypto.randomUUID(),
      headerName: 'X-Finance-TestViewer',
    },
  });

  const analystWrite = await prisma.user.create({
    data: {
      name: 'Test AnalystW',
      email: 'testanalystw@finance.com',
      password: analystWPw,
      role: 'ANALYST_WRITE',
      apiKey: crypto.randomUUID(),
      headerName: 'X-Finance-TestAnalystW',
    },
  });

  const analystRead = await prisma.user.create({
    data: {
      name: 'Test AnalystR',
      email: 'testanalystr@finance.com',
      password: analystRPw,
      role: 'ANALYST_READ',
      apiKey: crypto.randomUUID(),
      headerName: 'X-Finance-TestAnalystR',
    },
  });

  const now = new Date();
  const records = [];
  const categories = ['Salary', 'Rent', 'Food', 'Investment'];

  for (let i = 0; i < 10; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), 1 + i);
    const pk = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    records.push({
      amount: (i + 1) * 100,
      type: i < 5 ? 'INCOME' : 'EXPENSE',
      category: categories[i % categories.length],
      date,
      partitionKey: pk,
      notes: `Test record ${i + 1} ${categories[i % categories.length]}`,
      addedBy: admin.id,
      version: 0,
    });
  }

  await prisma.financialRecord.createMany({ data: records });

  return { admin, viewer, analystWrite, analystRead };
}

async function cleanTestData() {
  await prisma.otpSession.deleteMany();
  await prisma.financialRecord.deleteMany();
  await prisma.databaseBackupLog.deleteMany();
  await prisma.user.deleteMany();
}

async function loginUser(request, app, email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.data?.token;
}

module.exports = { prisma, seedTestData, cleanTestData, loginUser };
