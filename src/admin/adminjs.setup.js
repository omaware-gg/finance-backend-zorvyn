const { PrismaClient } = require('@prisma/client');
const session = require('express-session');
const config = require('../config/env');

const prisma = new PrismaClient();

/**
 * Initializes AdminJS with the Prisma adapter.
 * All AdminJS packages are ESM-only, so dynamic import() is required.
 *
 * @returns {Promise<{ admin: AdminJS, adminRouter: express.Router }>}
 */
async function setupAdminJS() {
  const AdminJS = (await import('adminjs')).default;
  const AdminJSExpress = await import('@adminjs/express');
  const AdminJSPrisma = await import('@adminjs/prisma');

  AdminJS.registerAdapter({
    Database: AdminJSPrisma.Database,
    Resource: AdminJSPrisma.Resource,
  });

  const admin = new AdminJS({
    resources: [
      {
        resource: { model: AdminJSPrisma.getModelByName('User'), client: prisma },
        options: {
          properties: {
            password: { isVisible: false },
            apiKey: { isVisible: { list: false, show: true, edit: false, filter: false } },
            otpSecret: { isVisible: false },
          },
          actions: {
            delete: { isAccessible: false },
          },
        },
      },
      {
        resource: { model: AdminJSPrisma.getModelByName('FinancialRecord'), client: prisma },
        options: {
          actions: {
            delete: { isAccessible: false },
          },
        },
      },
      {
        resource: { model: AdminJSPrisma.getModelByName('DatabaseBackupLog'), client: prisma },
        options: {
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
          },
        },
      },
      {
        resource: { model: AdminJSPrisma.getModelByName('OtpSession'), client: prisma },
        options: {
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
          },
        },
      },
    ],
    branding: {
      companyName: 'Finance Dashboard',
      softwareBrothers: false,
    },
    rootPath: '/admin',
  });

  const sessionStore = session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: config.nodeEnv === 'production' },
  });

  const adminRouter = AdminJSExpress.buildRouter(admin, undefined, undefined, sessionStore);

  return { admin, adminRouter };
}

module.exports = { setupAdminJS };
