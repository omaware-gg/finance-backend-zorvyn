const request = require('supertest');
const { prisma, seedTestData, cleanTestData, loginUser } = require('./setup');
const { bootstrap } = require('../src/app');

let app;
let testUsers;
let adminToken;
let viewerToken;
let analystRToken;

beforeAll(async () => {
  app = await bootstrap();
  await cleanTestData();
  testUsers = await seedTestData();
  adminToken = await loginUser(request, app, 'testadmin@finance.com', 'Admin@123');
  viewerToken = await loginUser(request, app, 'testviewer@finance.com', 'View@123');
  analystRToken = await loginUser(request, app, 'testanalystr@finance.com', 'Reader@123');
}, 30000);

afterAll(async () => {
  await cleanTestData();
  await prisma.$disconnect();
});

// ─── GET /api/users ─────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('Admin sees all users with pagination', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.total).toBeDefined();
    expect(res.body.data.page).toBe(1);
  });

  it('Search by email returns filtered results', async () => {
    const res = await request(app)
      .get('/api/users?search=testviewer')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBe(1);
    expect(res.body.data.users[0].email).toBe('testviewer@finance.com');
  });

  it('Filter by role=VIEWER returns only viewers', async () => {
    const res = await request(app)
      .get('/api/users?role=VIEWER')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.users.forEach((u) => expect(u.role).toBe('VIEWER'));
  });

  it('VIEWER gets 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it('ANALYST_READ gets 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${analystRToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/users/:id ───────────────────────────────────────────────────

describe('PATCH /api/users/:id', () => {
  it('Admin can change role to ANALYST_READ', async () => {
    // Create a throwaway user to mutate
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'MutableUser', email: 'mutable@test.com', password: 'Pass1234' });

    const userId = regRes.body.data.id;

    const res = await request(app)
      .patch(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ANALYST_READ' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('ANALYST_READ');
  });

  it('Changing role to NO_ACCESS sets isActive=false automatically', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Deactivate Me', email: 'deactivate@test.com', password: 'Pass1234' });

    const userId = regRes.body.data.id;

    const res = await request(app)
      .patch(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'NO_ACCESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('NO_ACCESS');
    expect(res.body.data.isActive).toBe(false);
  });

  it('Admin cannot delete themselves (returns 400)', async () => {
    const res = await request(app)
      .delete(`/api/users/${testUsers.admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Cannot delete your own account');
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .patch('/api/users/nonexistent-cuid-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nobody' });

    expect(res.status).toBe(404);
  });
});
