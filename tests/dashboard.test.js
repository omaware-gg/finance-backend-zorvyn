const request = require('supertest');
const { prisma, seedTestData, cleanTestData, loginUser } = require('./setup');
const { bootstrap } = require('../src/app');

let app;
let testUsers;
let adminToken, analystRToken;

beforeAll(async () => {
  app = await bootstrap();
  await cleanTestData();
  testUsers = await seedTestData();
  adminToken = await loginUser(request, app, 'testadmin@finance.com', 'Admin@123');
  analystRToken = await loginUser(request, app, 'testanalystr@finance.com', 'Reader@123');
}, 30000);

afterAll(async () => {
  await cleanTestData();
  await prisma.$disconnect();
});

// ─── GET /api/dashboard/summary ─────────────────────────────────────────────

describe('GET /api/dashboard/summary', () => {
  it('returns correct totalIncome, totalExpenses, netBalance', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { totalIncome, totalExpenses, netBalance } = res.body.data;
    expect(typeof totalIncome).toBe('number');
    expect(typeof totalExpenses).toBe('number');
    expect(netBalance).toBeCloseTo(totalIncome - totalExpenses, 2);
  });

  it('soft-deleted records are NOT counted', async () => {
    // Get baseline
    const before = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    // Create and soft-delete a record
    const create = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 99999, type: 'INCOME', category: 'Ghost', date: new Date().toISOString() });

    await request(app)
      .delete(`/api/records/${create.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const after = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(after.body.data.totalIncome).toBeCloseTo(before.body.data.totalIncome, 2);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/dashboard/categories ──────────────────────────────────────────

describe('GET /api/dashboard/categories', () => {
  it('returns array with category, totalAmount, count, percentageOfTotal', async () => {
    const res = await request(app)
      .get('/api/dashboard/categories')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const first = res.body.data[0];
    expect(first).toHaveProperty('category');
    expect(first).toHaveProperty('totalAmount');
    expect(first).toHaveProperty('count');
    expect(first).toHaveProperty('percentageOfTotal');
  });

  it('?type=EXPENSE filters correctly; percentages add to ~100%', async () => {
    const res = await request(app)
      .get('/api/dashboard/categories?type=EXPENSE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const totalPct = res.body.data.reduce((s, c) => s + c.percentageOfTotal, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

// ─── GET /api/dashboard/monthly-trends ──────────────────────────────────────

describe('GET /api/dashboard/monthly-trends', () => {
  it('returns exactly 12 months', async () => {
    const res = await request(app)
      .get('/api/dashboard/monthly-trends')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(12);
  });

  it('months with no data have zeros', async () => {
    const res = await request(app)
      .get('/api/dashboard/monthly-trends')
      .set('Authorization', `Bearer ${adminToken}`);

    const emptyMonth = res.body.data.find(
      (m) => m.totalIncome === 0 && m.totalExpenses === 0
    );
    if (emptyMonth) {
      expect(emptyMonth.netBalance).toBe(0);
    }
  });

  it('data months have correct aggregated values', async () => {
    const res = await request(app)
      .get('/api/dashboard/monthly-trends')
      .set('Authorization', `Bearer ${adminToken}`);

    const nonEmpty = res.body.data.filter((m) => m.totalIncome > 0 || m.totalExpenses > 0);
    nonEmpty.forEach((m) => {
      expect(m.netBalance).toBeCloseTo(m.totalIncome - m.totalExpenses, 2);
    });
  });
});

// ─── GET /api/dashboard/weekly-trends ───────────────────────────────────────

describe('GET /api/dashboard/weekly-trends', () => {
  it('?weeks=4 returns exactly 4 week objects with date ranges', async () => {
    const res = await request(app)
      .get('/api/dashboard/weekly-trends?weeks=4')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(4);

    const first = res.body.data[0];
    expect(first).toHaveProperty('weekStart');
    expect(first).toHaveProperty('weekEnd');
    expect(first).toHaveProperty('totalIncome');
    expect(first).toHaveProperty('totalExpenses');
    expect(first).toHaveProperty('netBalance');
  });
});

// ─── GET /api/dashboard/user-summary/:userId ────────────────────────────────

describe('GET /api/dashboard/user-summary/:userId', () => {
  it('Admin gets summary for a specific user', async () => {
    const res = await request(app)
      .get(`/api/dashboard/user-summary/${testUsers.admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(testUsers.admin.id);
    expect(typeof res.body.data.totalIncome).toBe('number');
    expect(typeof res.body.data.recordCount).toBe('number');
  });

  it('ANALYST_READ gets 403', async () => {
    const res = await request(app)
      .get(`/api/dashboard/user-summary/${testUsers.admin.id}`)
      .set('Authorization', `Bearer ${analystRToken}`);

    expect(res.status).toBe(403);
  });
});
