const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

const SEED_USERS = [
  {
    name: 'Admin',
    email: 'admin@finance.com',
    password: 'Admin@123',
    role: 'ADMIN',
    headerName: 'X-Finance-Admin',
  },
  {
    name: 'Data Lake Owner',
    email: 'datalake@finance.com',
    password: 'DataLake@123',
    role: 'DATA_LAKE_OWNER',
    headerName: 'X-Finance-DLO',
  },
  {
    name: 'Analyst Write',
    email: 'analyst_write@finance.com',
    password: 'Analyst@123',
    role: 'ANALYST_WRITE',
    headerName: 'X-Finance-AW',
  },
  {
    name: 'Analyst Read',
    email: 'analyst_read@finance.com',
    password: 'Viewer@123',
    role: 'ANALYST_READ',
    headerName: 'X-Finance-AR',
  },
  {
    name: 'Viewer',
    email: 'viewer@finance.com',
    password: 'View@123',
    role: 'VIEWER',
    headerName: 'X-Finance-Viewer',
  },
];

const CATEGORIES = [
  'Salary',
  'Rent',
  'Food',
  'Investment',
  'Utilities',
  'Travel',
  'Equipment',
  'Consulting',
];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function buildRecords(adminId) {
  const records = [];
  const now = new Date();

  for (let i = 0; i < 20; i++) {
    const monthOffset = i % 6;
    const date = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1 + (i % 28));
    const partitionKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const type = i % 3 === 0 ? 'INCOME' : 'EXPENSE';
    const category = CATEGORIES[i % CATEGORIES.length];
    const amount = parseFloat(randomBetween(100, 15000).toFixed(2));

    records.push({
      amount,
      type,
      category,
      date,
      partitionKey,
      notes: `Seed record ${i + 1} – ${category}`,
      addedBy: adminId,
      version: 0,
    });
  }

  return records;
}

async function main() {
  console.log('Seeding database …');

  for (const u of SEED_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`  ✓ User ${u.email} already exists – skipping`);
      continue;
    }

    const hashed = await bcrypt.hash(u.password, SALT_ROUNDS);
    await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        password: hashed,
        role: u.role,
        apiKey: uuidv4(),
        headerName: u.headerName,
      },
    });
    console.log(`  + Created ${u.role}: ${u.email}`);
  }

  const admin = await prisma.user.findUnique({ where: { email: 'admin@finance.com' } });

  const existingCount = await prisma.financialRecord.count();
  if (existingCount === 0) {
    const records = buildRecords(admin.id);
    await prisma.financialRecord.createMany({ data: records });
    console.log(`  + Created ${records.length} financial records`);
  } else {
    console.log(`  ✓ ${existingCount} financial records already exist – skipping`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
