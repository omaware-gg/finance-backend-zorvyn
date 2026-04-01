# Finance Data Processing & Access Control Backend

A Node.js/Express backend for financial data processing with role-based access control, per-user API keys, admin 2FA, and an AdminJS dashboard.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT + per-user API key + bcrypt
- **Admin GUI:** AdminJS
- **2FA (Admin):** nodemailer + otplib
- **Docs:** Swagger
- **Testing:** Jest + Supertest
- **Validation:** Zod

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14

### Installation

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Database Setup

```bash
npx prisma migrate dev
npx prisma db seed
```

### Running

```bash
# Development
npm run dev

# Production
npm start
```

### Testing

```bash
npm test

# With coverage
npm run test:coverage
```

## Project Structure

```
finance-backend/
├── prisma/            # Prisma schema and seed
├── src/
│   ├── config/        # Environment config
│   ├── admin/         # AdminJS setup
│   ├── middlewares/    # Auth, RBAC, API key, concurrency, error handling
│   ├── modules/       # Feature modules (auth, users, records, dashboard)
│   ├── utils/         # JWT, API key, OTP, pagination, filter, response helpers
│   └── docs/          # Swagger documentation
├── tests/             # Jest test suites
├── server.js          # Entry point
└── .env.example       # Environment template
```

## API Documentation

Once running, visit `http://localhost:3000/api-docs` for Swagger UI.

## Admin Panel

Visit `http://localhost:3000/admin` for the AdminJS dashboard (admin-only, 2FA required).
