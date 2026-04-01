const request = require('supertest');
const { prisma, seedTestData, cleanTestData, loginUser } = require('./setup');
const { bootstrap } = require('../src/app');

let app;
let testUsers;
let adminToken, viewerToken, analystWToken, analystRToken;

beforeAll(async () => {
  app = await bootstrap();
  await cleanTestData();
  testUsers = await seedTestData();
  adminToken = await loginUser(request, app, 'testadmin@finance.com', 'Admin@123');
  viewerToken = await loginUser(request, app, 'testviewer@finance.com', 'View@123');
  analystWToken = await loginUser(request, app, 'testanalystw@finance.com', 'Analyst@123');
  analystRToken = await loginUser(request, app, 'testanalystr@finance.com', 'Reader@123');
}, 30000);

afterAll(async () => {
  await cleanTestData();
  await prisma.$disconnect();
});

// ─── POST /api/records ──────────────────────────────────────────────────────

describe('POST /api/records', () => {
  let seq = 0;
  function uniqueRecord(overrides = {}) {
    seq++;
    return {
      amount: 500 + seq,
      type: 'INCOME',
      category: `TestCat${seq}`,
      date: new Date().toISOString(),
      ...overrides,
    };
  }

  it('Admin creates record with audit fields', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(uniqueRecord());

    expect(res.status).toBe(201);
    expect(res.body.data.addedBy).toBe(testUsers.admin.id);
    expect(res.body.data.addedOn).toBeDefined();
    expect(res.body.data.version).toBe(0);
    expect(res.body.data.partitionKey).toMatch(/^\d{4}-\d{2}$/);
  });

  it('ANALYST_WRITE creates a record successfully', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${analystWToken}`)
      .send(uniqueRecord({ category: 'Consulting' }));

    expect(res.status).toBe(201);
    expect(res.body.data.addedBy).toBe(testUsers.analystWrite.id);
  });

  it('VIEWER gets 403', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(uniqueRecord());

    expect(res.status).toBe(403);
  });

  it('ANALYST_READ gets 403', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${analystRToken}`)
      .send(uniqueRecord());

    expect(res.status).toBe(403);
  });

  it('returns 400 for negative amount', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(uniqueRecord({ amount: -10 }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing type', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 100, category: 'Food', date: new Date().toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── Concurrent write collision ─────────────────────────────────────────────

describe('Duplicate write collision', () => {
  it('second near-identical record within 5s returns 409 DUPLICATE_WRITE', async () => {
    const payload = {
      amount: 7777,
      type: 'EXPENSE',
      category: 'DuplicateTest',
      date: new Date().toISOString(),
    };

    const first = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('DUPLICATE_WRITE');
  });
});

// ─── PATCH /api/records/:id (optimistic locking) ────────────────────────────

describe('PATCH /api/records/:id', () => {
  let recordId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1234, type: 'INCOME', category: 'LockTest', date: new Date().toISOString() });

    recordId = res.body.data.id;
  });

  it('Admin updates with correct version; version increments to 1', async () => {
    const res = await request(app)
      .patch(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 0, amount: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(1);
    expect(Number(res.body.data.amount)).toBe(2000);
  });

  it('stale version returns 409 CONCURRENCY_CONFLICT', async () => {
    const res = await request(app)
      .patch(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 0, amount: 3000 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONCURRENCY_CONFLICT');
  });

  it('updating a soft-deleted record returns 404', async () => {
    // Create and soft-delete a record
    const create = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 50, type: 'EXPENSE', category: 'Deletable', date: new Date().toISOString() });

    const id = create.body.data.id;

    await request(app)
      .delete(`/api/records/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .patch(`/api/records/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 0, amount: 999 });

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/records filtering ─────────────────────────────────────────────

describe('GET /api/records filtering', () => {
  it('?type=INCOME returns only income records', async () => {
    const res = await request(app)
      .get('/api/records?type=INCOME')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.records.forEach((r) => expect(r.type).toBe('INCOME'));
  });

  it('?category=Salary returns matching records', async () => {
    const res = await request(app)
      .get('/api/records?category=Salary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.records.forEach((r) =>
      expect(r.category.toLowerCase()).toContain('salary')
    );
  });

  it('?startDate and ?endDate filter correctly', async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), 5).toISOString();

    const res = await request(app)
      .get(`/api/records?startDate=${start}&endDate=${end}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.records.forEach((r) => {
      const d = new Date(r.date);
      expect(d >= new Date(start)).toBe(true);
      expect(d <= new Date(end)).toBe(true);
    });
  });

  it('?search=rent matches case-insensitively', async () => {
    const res = await request(app)
      .get('/api/records?search=rent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.records.forEach((r) => {
      const match =
        r.category.toLowerCase().includes('rent') ||
        (r.notes && r.notes.toLowerCase().includes('rent'));
      expect(match).toBe(true);
    });
  });

  it('pagination: page=2&limit=3 returns correct slice', async () => {
    const res = await request(app)
      .get('/api/records?page=2&limit=3')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.records.length).toBeLessThanOrEqual(3);
    expect(res.body.data.page).toBe(2);
    expect(res.body.data.limit).toBe(3);
  });

  it('?partitionKey filters by month', async () => {
    const now = new Date();
    const pk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const res = await request(app)
      .get(`/api/records?partitionKey=${pk}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.records.forEach((r) => expect(r.partitionKey).toBe(pk));
  });
});

// ─── DELETE /api/records/:id ────────────────────────────────────────────────

describe('DELETE /api/records/:id', () => {
  let deleteTargetId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 42, type: 'EXPENSE', category: 'ToDelete', date: new Date().toISOString() });

    deleteTargetId = res.body.data.id;
  });

  it('Admin soft-deletes; record disappears from GET', async () => {
    const delRes = await request(app)
      .delete(`/api/records/${deleteTargetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/records/${deleteTargetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(404);
  });

  it('deleted record still exists in DB', async () => {
    const dbRecord = await prisma.financialRecord.findUnique({
      where: { id: deleteTargetId },
    });

    expect(dbRecord).not.toBeNull();
    expect(dbRecord.deletedAt).not.toBeNull();
    expect(dbRecord.deletedBy).toBe(testUsers.admin.id);
  });

  it('ANALYST_WRITE gets 403 on delete', async () => {
    const create = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${analystWToken}`)
      .send({ amount: 10, type: 'INCOME', category: 'NoDel', date: new Date().toISOString() });

    const res = await request(app)
      .delete(`/api/records/${create.body.data.id}`)
      .set('Authorization', `Bearer ${analystWToken}`);

    expect(res.status).toBe(403);
  });
});
