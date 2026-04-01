const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config/env');
const { errorHandler } = require('./middlewares/error.middleware');
const { setupSwagger } = require('./docs/swagger');
const { setupAdminJS } = require('./admin/adminjs.setup');

const authRoutes = require('./modules/auth/auth.routes');
const { usersRouter, adminApiRouter } = require('./modules/users/users.routes');
const recordsRoutes = require('./modules/records/records.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

const app = express();

// ── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' })); // Restrict origin in production
if (config.nodeEnv !== 'test') app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Global rate limiter (disabled in test environment) ──────────────────────
if (config.nodeEnv !== 'test') {
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
      },
    })
  );
}

// ── AdminJS (async bootstrap) ───────────────────────────────────────────────
async function bootstrap() {
  try {
    const { adminRouter } = await setupAdminJS();
    app.use('/admin', adminRouter);
  } catch (err) {
    console.error('AdminJS failed to initialize:', err.message);
  }

  // ── API routes ──────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRouter);
  app.use('/api/admin', adminApiRouter);
  app.use('/api/records', recordsRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // ── Swagger docs ────────────────────────────────────────────────────────
  setupSwagger(app);

  // ── 404 catch-all ───────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      code: 'NOT_FOUND',
    });
  });

  // ── Global error handler (must be last) ─────────────────────────────────
  app.use(errorHandler);

  return app;
}

module.exports = { app, bootstrap };
