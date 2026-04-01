const { z } = require('zod');

const createRecordSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be positive'),
  type: z.enum(['INCOME', 'EXPENSE'], { required_error: 'Type is required' }),
  category: z
    .string({ required_error: 'Category is required' })
    .min(2, 'Category must be at least 2 characters')
    .max(100, 'Category must be at most 100 characters'),
  date: z.coerce.date({ required_error: 'Date is required' }),
  notes: z.string().max(500, 'Notes must be at most 500 characters').optional(),
});

const updateRecordSchema = z.object({
  version: z
    .number({ required_error: 'Version is required for optimistic locking' })
    .int('Version must be an integer'),
  amount: z.number().positive('Amount must be positive').optional(),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  category: z
    .string()
    .min(2, 'Category must be at least 2 characters')
    .max(100, 'Category must be at most 100 characters')
    .optional(),
  date: z.coerce.date().optional(),
  notes: z.string().max(500, 'Notes must be at most 500 characters').optional(),
});

module.exports = { createRecordSchema, updateRecordSchema };
