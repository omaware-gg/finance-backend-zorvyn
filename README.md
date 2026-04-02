# Finance Dashboard Backend

## Overview

Node.js + Express + PostgreSQL + Prisma backend for a finance dashboard system.
Supports granular role-based access control, per-user API key authentication,
JWT auth, soft-deletes, optimistic concurrency, and aggregated analytics APIs.
Admin GUI available via AdminJS at `/admin`.

---

## Tech Stack


| Layer      | Choice                 | Why                                                                          |
| ---------- | ---------------------- | ---------------------------------------------------------------------------- |
| Runtime    | Node.js                | Async I/O suits API-heavy workloads                                          |
| Framework  | Express                | Minimal, flexible, widely understood                                         |
| Database   | PostgreSQL             | ACID compliance; native Decimal type for finance; Athena-compatible via Glue |
| ORM        | Prisma                 | Type-safe queries; migration tooling; prevents raw SQL injection risks       |
| Auth       | JWT + per-user API key | JWT for humans; API keys for service-to-service (Metabase, Athena)           |
| Admin GUI  | AdminJS                | Embedded, no separate service; admins manage users/roles in-browser          |
| Validation | Zod                    | Runtime schema validation with clear error messages                          |
| Testing    | Jest + Supertest       | Industry standard; 55 integration tests covering all modules                 |
| Docs       | Swagger (OpenAPI 3.0)  | Interactive API docs at `/api-docs`                                          |


---

## Database Choice: Tradeoffs

**Why PostgreSQL over alternatives:**

- Relational model fits financial data (strong referential integrity, joins for reporting)
- Decimal type avoids floating-point errors on amounts (unlike MongoDB's default Double)
- Native support for window functions and CTEs (useful for trend queries at scale)
- Athena compatibility: PG schemas map cleanly to Glue Data Catalog; export to S3 as Parquet
- Metabase and QuickSight both have first-class PostgreSQL JDBC connectors

**Why not SQLite:** No concurrent write support; not suitable for multi-user finance systems.

**Why not MongoDB:** Flexible schema is a liability in finance; aggregation pipeline is more complex
than Prisma's `groupBy` for simple trend queries.

---

## Assumptions

- **Soft deletes only.** No hard deletion of rows is implemented or possible via API.
Hard deletion of databases is possible but requires admin action and is logged with 30-day backup.
- `version` field is required on all `PATCH /api/records` requests for optimistic locking.
- Filtering uses Prisma query operators exclusively — no raw SQL, ensuring portability.
- `partitionKey` ("YYYY-MM") is computed server-side and stored explicitly for partition-aligned
queries and clean Athena S3 path mapping (`/year=2024/month=03/`).
- ANALYST_WRITE can read all records but only create/modify their own. ANALYST_READ and above can read all.
- API keys are returned only at creation or rotation — they are never returned again in list endpoints.
- 2FA (OTP via email) is available only for ADMIN role accounts.
- Rate limiting is global (100 req/15min) plus per-route stricter limits on write endpoints
(30 writes/10min per user, 200 reads/10min per IP).

---

## Role Matrix


| Operation                 | ADMIN | DATA_LAKE_OWNER | ANALYST_WRITE | ANALYST_READ | VIEWER | NO_ACCESS |
| ------------------------- | ----- | --------------- | ------------- | ------------ | ------ | --------- |
| Register / Login          | ✅     | ✅               | ✅             | ✅            | ✅      | ❌         |
| View all records          | ✅     | ✅               | ✅             | ✅            | ✅      | ❌         |
| Create / edit records     | ✅     | ❌               | own only      | ❌            | ❌      | ❌         |
| Delete records (soft)     | ✅     | ❌               | ❌             | ❌            | ❌      | ❌         |
| Dashboard / analytics     | ✅     | ✅               | ✅             | ✅            | ✅      | ❌         |
| User summary by userId    | ✅     | ❌               | ❌             | ❌            | ❌      | ❌         |
| Manage users (CRUD)       | ✅     | ❌               | ❌             | ❌            | ❌      | ❌         |
| View / rotate own API key | ✅     | ✅               | ✅             | ✅            | ✅      | ❌         |
| DB backup log management  | ✅     | ❌               | ❌             | ❌            | ❌      | ❌         |
| Enable 2FA                | ✅     | ❌               | ❌             | ❌            | ❌      | ❌         |


---

## Error Codes Reference


| HTTP | Code                   | When it occurs                                                      |
| ---- | ---------------------- | ------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | Zod schema validation fails; invalid request body                   |
| 401  | `UNAUTHORIZED`         | No/invalid token or API key; wrong credentials                      |
| 401  | `TOKEN_EXPIRED`        | JWT past expiry                                                     |
| 403  | `FORBIDDEN`            | Valid auth but insufficient role for the operation                  |
| 404  | `NOT_FOUND`            | Record or user doesn't exist or is soft-deleted                     |
| 409  | `CONFLICT`             | Email already registered; Prisma unique constraint violation        |
| 409  | `DUPLICATE_WRITE`      | Near-identical record created by same user within 5 seconds         |
| 409  | `CONCURRENCY_CONFLICT` | `version` mismatch on PATCH (stale data; another user edited first) |
| 429  | `RATE_LIMITED`         | Too many requests (global or per-route limiter)                     |
| 500  | `INTERNAL_ERROR`       | Unhandled server exception (stack hidden in production)             |


---

## Expected Latency

Assumed org: ~50 internal users, ~50k records, self-hosted or RDS PostgreSQL.


| Endpoint                            | Expected p95 | Notes                                |
| ----------------------------------- | ------------ | ------------------------------------ |
| `POST /api/auth/login`              | < 200ms      | bcrypt adds ~100ms intentionally     |
| `GET /api/records` (paginated)      | < 80ms       | Indexed queries, 10 rows default     |
| `POST /api/records`                 | < 100ms      | Includes duplicate-check transaction |
| `PATCH /api/records/:id`            | < 80ms       | Optimistic lock + version increment  |
| `GET /api/dashboard/summary`        | < 120ms      | Two parallel aggregates              |
| `GET /api/dashboard/monthly-trends` | < 150ms      | groupBy + JS merge for 12 months     |
| `GET /api/dashboard/weekly-trends`  | < 300ms      | Up to N parallel aggregate pairs     |


---

## API Cost Estimate

Read-only API calls (`GET /api/records`, `GET /api/dashboard/`*) on a self-hosted
PostgreSQL instance add negligible infrastructure cost — primarily CPU for
query execution and network I/O, typically fractions of a cent per 1,000 requests
at this org scale. On AWS RDS (`db.t3.medium`), 1M read API calls/month adds
an estimated $2–5 to the compute bill. Write endpoints are similarly cheap at
this scale; cost only becomes significant at millions of writes per day.

---

## Concurrency & Invalid State Handling

**Two users editing the same record:** Handled by optimistic locking (`version` field).
PATCH requires the current version. If two users load `version=3` and both submit,
the first succeeds (`version` becomes 4), the second receives `409 CONCURRENCY_CONFLICT`.
The client is expected to refresh and retry.

**Two users inserting identical rows simultaneously:** A 5-second duplicate-write
guard checks for a near-identical record from the same user (same amount, type, category)
before inserting. This handles accidental double-submits and network retries.

**Soft delete only:** DELETE routes set `deletedAt` and `deletedBy`. The record remains
in the database. All queries filter `deletedAt: null`. There is no API endpoint for
hard deletion of rows.

**Database-level deletion:** Possible only by ADMIN. Every such action must be logged
via `POST /api/admin/db-backup-log` before execution. The backup is retained for 30 days
at a separate location (documented here; actual pg_dump scheduling is an infrastructure concern).

---

## AWS Athena / Metabase / QuickSight Compatibility

The schema is designed for direct analytics integration:

- `partitionKey` ("YYYY-MM") maps to S3 partition paths when exported
- All analytical fields use standard scalar types (no JSONB on key columns)
- `amount` uses `DECIMAL(15,2)` which maps cleanly to Athena's DECIMAL type
- Per-user API keys allow Metabase and QuickSight to connect using service-account credentials
without exposing admin passwords

**Metabase integration:** Connect via PostgreSQL JDBC using a `DATA_LAKE_OWNER` account's API key.

**AWS Athena integration:** Export PostgreSQL tables to S3 as Parquet using AWS DMS or a
scheduled `pg_dump` → Glue crawler pipeline. The `partitionKey` column maps directly to
S3 partition paths (`s3://bucket/records/partitionKey=2024-03/`).

---

## Admin GUI

AdminJS is available at: **[http://localhost:3000/admin](http://localhost:3000/admin)**

Provides:

- User management (view, edit role, activate/deactivate)
- Record browsing with filters
- Audit field visibility (addedBy, lastModifiedBy, etc.)
- API key visibility per user (show view only, not in list)
- No hard-delete buttons (intentionally disabled)

### Additional Data Tools


| Tool                                    | Use Case                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| **Prisma Studio** (`npx prisma studio`) | Built-in DB browser at localhost:5555 — dev-time inspection                    |
| **[Retool](https://retool.com)**        | Drag-and-drop internal tool builder; connects directly to PostgreSQL           |
| **[Metabase](https://metabase.com)**    | Open-source BI tool; dashboards and ad-hoc queries for analysts                |
| **AWS QuickSight**                      | Managed BI service; connects via JDBC or Athena for executive dashboards       |
| **pgAdmin 4**                           | Traditional PostgreSQL GUI; DBA operations, schema inspection, query profiling |


---

## Project Structure

```
finance-backend/
├── prisma/
│   ├── schema.prisma          # Database schema (4 models, 2 enums, 15 indexes)
│   └── seed.js                # Seeds 5 users + 20 financial records
├── src/
│   ├── config/
│   │   └── env.js             # Validated, frozen config from .env
│   ├── admin/
│   │   └── adminjs.setup.js   # AdminJS GUI with Prisma adapter
│   ├── middlewares/
│   │   ├── auth.middleware.js  # Dual-strategy: JWT Bearer + API key header
│   │   ├── rbac.middleware.js  # authorize(...roles) factory
│   │   ├── apikey.middleware.js# API-key-only auth (service-to-service)
│   │   ├── concurrency.middleware.js
│   │   └── error.middleware.js # Global error handler (Prisma, Zod, JWT mapping)
│   ├── modules/
│   │   ├── auth/              # register, login, 2FA OTP, rotate API key
│   │   ├── users/             # CRUD, soft-delete, backup log endpoints
│   │   ├── records/           # CRUD, optimistic locking, duplicate guard
│   │   └── dashboard/         # summary, categories, monthly/weekly trends
│   ├── utils/
│   │   ├── jwt.utils.js       # signToken, verifyToken
│   │   ├── apikey.utils.js    # generateApiKey, generateHeaderName
│   │   ├── otp.utils.js       # generateOtp, hashOtp, verifyOtp, sendOtpEmail
│   │   ├── pagination.utils.js# getPagination (page/limit/skip/take)
│   │   ├── filter.utils.js    # buildRecordWhereClause (single source of filtering)
│   │   └── response.utils.js  # sendSuccess, sendError
│   ├── docs/
│   │   └── swagger.js         # OpenAPI 3.0 spec + Swagger UI mount
│   └── app.js                 # Express app wiring (no listen)
├── tests/
│   ├── setup.js               # Shared test helpers (seed, clean, loginUser)
│   ├── auth.test.js           # 15 tests
│   ├── users.test.js          # 9 tests
│   ├── records.test.js        # 20 tests (incl. concurrency + collision)
│   └── dashboard.test.js      # 11 tests
├── .env / .env.example
├── .gitignore
├── babel.config.js
├── jest.config.js
├── server.js                  # Entry point (listen + process handlers)
└── package.json
```

---

## Setup Instructions

1. Clone the repo and install dependencies:

```bash
npm install
```

1. Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

1. Start PostgreSQL (via Docker or local install):

```bash
docker run -d --name finance_pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=finance_db \
  -p 5432:5432 postgres:16-alpine
```

1. Run migrations and seed:

```bash
npx prisma migrate dev
npx prisma db seed
```

1. Start the server:

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

1. Open in browser:
  - **API Docs:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
  - **Admin GUI:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Seeded Accounts


| Email                                                         | Password     | Role            |
| ------------------------------------------------------------- | ------------ | --------------- |
| [admin@finance.com](mailto:admin@finance.com)                 | Admin@123    | ADMIN           |
| [datalake@finance.com](mailto:datalake@finance.com)           | DataLake@123 | DATA_LAKE_OWNER |
| [analyst_write@finance.com](mailto:analyst_write@finance.com) | Analyst@123  | ANALYST_WRITE   |
| [analyst_read@finance.com](mailto:analyst_read@finance.com)   | Viewer@123   | ANALYST_READ    |
| [viewer@finance.com](mailto:viewer@finance.com)               | View@123     | VIEWER          |


20 financial records are seeded across 6 months and 8 categories, all attributed to the admin user.

---

## Running Tests

```bash
# Run all 55 tests
npm test

# With coverage report
npm run test:coverage
```

Tests use a dedicated `finance_test_db` database (configured via `TEST_DATABASE_URL` in `.env`).
Each test suite seeds its own data and cleans up after itself.


| Suite             | Tests | Covers                                                                                                      |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| auth.test.js      | 15    | Registration, login, 2FA OTP flow, JWT + API key auth, key rotation                                         |
| users.test.js     | 9     | Admin CRUD, search/filter, role changes, self-delete guard                                                  |
| records.test.js   | 20    | Create, update, soft-delete, optimistic locking, duplicate-write collision, 8 filter dimensions, pagination |
| dashboard.test.js | 11    | Summary, categories, monthly trends, weekly trends, per-user summary, soft-delete exclusion                 |


