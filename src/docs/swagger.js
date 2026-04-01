const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance Dashboard API',
      version: '1.0.0',
      description:
        'Finance Data Processing and Access Control Backend — JWT & per-user API key auth, RBAC, optimistic locking, audit trails, and Athena-compatible schema.',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Finance-{YourHeaderName}',
          description:
            'Per-user API key header. The header name is unique per user and can be retrieved from GET /api/users/:id/api-key. The header value is the API key.',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            code: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' }, nullable: true },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'DATA_LAKE_OWNER', 'ANALYST_WRITE', 'ANALYST_READ', 'VIEWER', 'NO_ACCESS'] },
            isActive: { type: 'boolean' },
            headerName: { type: 'string' },
            otpEnabled: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        FinancialRecord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'string', description: 'Decimal(15,2)' },
            type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
            category: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            partitionKey: { type: 'string', example: '2024-03' },
            notes: { type: 'string', nullable: true },
            addedBy: { type: 'string' },
            addedOn: { type: 'string', format: 'date-time' },
            lastModifiedBy: { type: 'string', nullable: true },
            lastModifiedAt: { type: 'string', format: 'date-time', nullable: true },
            version: { type: 'integer' },
            creator: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } } },
          },
        },
        DatabaseBackupLog: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            action: { type: 'string' },
            requestedBy: { type: 'string' },
            targetDatabase: { type: 'string' },
            backupLocation: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'RESTORED'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.js'],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = { setupSwagger, swaggerSpec };
