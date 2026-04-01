const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const { signToken } = require('../../utils/jwt.utils');
const { generateApiKey, generateHeaderName } = require('../../utils/apikey.utils');
const { generateOtp, hashOtp, verifyOtp, sendOtpEmail } = require('../../utils/otp.utils');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  headerName: true,
  otpEnabled: true,
  createdAt: true,
  updatedAt: true,
};

async function register({ name, email, password, role }) {
  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    err.code = 'CONFLICT';
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const apiKey = generateApiKey();
  const headerName = generateHeaderName(name);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role || 'VIEWER',
      apiKey,
      headerName,
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    headerName: user.headerName,
    apiKey,
    createdAt: user.createdAt,
  };
}

async function login({ email, password }) {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true, deletedAt: null, role: { not: 'NO_ACCESS' } },
  });

  if (!user) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  if (user.role === 'ADMIN' && user.otpEnabled) {
    const { otp, expiresAt } = generateOtp();
    const hashed = await hashOtp(otp);

    await prisma.otpSession.create({
      data: { userId: user.id, otp: hashed, expiresAt },
    });

    await sendOtpEmail(user.email, otp);

    return { requiresOtp: true, message: 'OTP sent to registered email' };
  }

  const token = signToken({ id: user.id, role: user.role });
  const { password: _, otpSecret: __, apiKey: ___, ...safeUser } = user;
  return { token, user: safeUser };
}

async function verifyAdminOtp({ email, otp }) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (!user) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const session = await prisma.otpSession.findFirst({
    where: {
      userId: user.id,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    const err = new Error('OTP expired or not found');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const valid = await verifyOtp(otp, session.otp);
  if (!valid) {
    const err = new Error('Invalid OTP');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  await prisma.otpSession.update({
    where: { id: session.id },
    data: { used: true },
  });

  const token = signToken({ id: user.id, role: user.role });
  return { token };
}

async function enableAdminOtp(userId) {
  // otplib secret stored as-is for simplicity; in production consider encrypting at rest
  const secret = authenticator.generateSecret();

  await prisma.user.update({
    where: { id: userId },
    data: { otpSecret: secret, otpEnabled: true },
  });

  return { message: '2FA enabled for admin account' };
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_USER_SELECT,
  });
  return user;
}

async function rotateApiKey(userId) {
  const newApiKey = generateApiKey();

  const user = await prisma.user.update({
    where: { id: userId },
    data: { apiKey: newApiKey },
    select: { apiKey: true, headerName: true },
  });

  return user;
}

module.exports = { register, login, verifyAdminOtp, enableAdminOtp, getMe, rotateApiKey };
