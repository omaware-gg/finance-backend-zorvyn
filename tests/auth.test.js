const request = require('supertest');
const bcrypt = require('bcrypt');
const { prisma, seedTestData, cleanTestData, loginUser } = require('./setup');

// Mock OTP email sending to avoid real SMTP calls in tests
jest.mock('../src/utils/otp.utils', () => {
  const original = jest.requireActual('../src/utils/otp.utils');
  return {
    ...original,
    sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  };
});

const { bootstrap } = require('../src/app');

let app;
let testUsers;

beforeAll(async () => {
  app = await bootstrap();
  await cleanTestData();
  testUsers = await seedTestData();
}, 30000);

afterAll(async () => {
  await cleanTestData();
  await prisma.$disconnect();
});

// ─── POST /api/auth/register ────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('returns 201 with user object including apiKey and headerName', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'newuser@test.com', password: 'Pass1234' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('newuser@test.com');
    expect(res.body.data.role).toBe('VIEWER');
    expect(res.body.data.apiKey).toBeDefined();
    expect(res.body.data.headerName).toBeDefined();
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad', email: 'not-an-email', password: 'Pass1234' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 if password has no number', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad', email: 'nonum@test.com', password: 'NoNumbers' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 if email already exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'testadmin@finance.com', password: 'Pass1234' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });
});

// ─── POST /api/auth/login (non-Admin) ───────────────────────────────────────

describe('POST /api/auth/login (non-Admin)', () => {
  it('returns 200 with token and user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testviewer@finance.com', password: 'View@123' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('testviewer@finance.com');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 401 for wrong password (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testviewer@finance.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 for non-existent email (same message)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Pass1234' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});

// ─── POST /api/auth/login (Admin with 2FA) ─────────────────────────────────

describe('POST /api/auth/login (Admin with 2FA)', () => {
  beforeAll(async () => {
    await prisma.user.update({
      where: { id: testUsers.admin.id },
      data: { otpEnabled: true, otpSecret: 'testsecret' },
    });
  });

  afterAll(async () => {
    await prisma.user.update({
      where: { id: testUsers.admin.id },
      data: { otpEnabled: false, otpSecret: null },
    });
    await prisma.otpSession.deleteMany({ where: { userId: testUsers.admin.id } });
  });

  it('returns requiresOtp: true when admin has 2FA enabled', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testadmin@finance.com', password: 'Admin@123' });

    expect(res.status).toBe(200);
    expect(res.body.data.requiresOtp).toBe(true);
  });

  it('verify-otp returns token after valid OTP', async () => {
    // Manually create an OTP session so we know the plaintext
    const plainOtp = '123456';
    const hashed = await bcrypt.hash(plainOtp, 10);
    await prisma.otpSession.create({
      data: {
        userId: testUsers.admin.id,
        otp: hashed,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'testadmin@finance.com', otp: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('verify-otp returns 401 for wrong OTP', async () => {
    const hashed = await bcrypt.hash('654321', 10);
    await prisma.otpSession.create({
      data: {
        userId: testUsers.admin.id,
        otp: hashed,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'testadmin@finance.com', otp: '000000' });

    expect(res.status).toBe(401);
  });

  it('verify-otp returns 401 for expired OTP', async () => {
    const hashed = await bcrypt.hash('111111', 10);
    await prisma.otpSession.create({
      data: {
        userId: testUsers.admin.id,
        otp: hashed,
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'testadmin@finance.com', otp: '111111' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ───────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns current user with valid JWT', async () => {
    const token = await loginUser(request, app, 'testviewer@finance.com', 'View@123');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('testviewer@finance.com');
  });

  it('returns current user via API key header (Strategy 2)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set(testUsers.viewer.headerName, testUsers.viewer.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('testviewer@finance.com');
  });

  it('returns 401 with no auth', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with tampered JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/rotate-api-key ──────────────────────────────────────────

describe('POST /api/auth/rotate-api-key', () => {
  it('returns new apiKey — old key no longer works', async () => {
    const oldApiKey = testUsers.viewer.apiKey;
    const token = await loginUser(request, app, 'testviewer@finance.com', 'View@123');

    const rotateRes = await request(app)
      .post('/api/auth/rotate-api-key')
      .set('Authorization', `Bearer ${token}`);

    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.data.apiKey).toBeDefined();
    expect(rotateRes.body.data.apiKey).not.toBe(oldApiKey);

    // Old key should fail
    const oldKeyRes = await request(app)
      .get('/api/auth/me')
      .set(testUsers.viewer.headerName, oldApiKey);

    expect(oldKeyRes.status).toBe(401);

    // New key should work
    const newKeyRes = await request(app)
      .get('/api/auth/me')
      .set(testUsers.viewer.headerName, rotateRes.body.data.apiKey);

    expect(newKeyRes.status).toBe(200);
  });
});
