const { z } = require('zod');

const ROLES = ['ADMIN', 'DATA_LAKE_OWNER', 'ANALYST_WRITE', 'ANALYST_READ', 'VIEWER', 'NO_ACCESS'];

const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { updateUserSchema };
