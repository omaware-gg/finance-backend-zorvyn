const recordsService = require('./records.service');
const { createRecordSchema, updateRecordSchema } = require('./records.schema');
const { sendSuccess, sendError } = require('../../utils/response.utils');

async function createRecord(req, res) {
  try {
    const parsed = createRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation failed', 400, parsed.error.issues, 'VALIDATION_ERROR');
    }

    const data = await recordsService.createRecord(parsed.data, req.user.id);
    return sendSuccess(res, data, 'Record created', 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getAllRecords(req, res) {
  try {
    const data = await recordsService.getAllRecords(req.query, req.user);
    return sendSuccess(res, data, 'Records retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getRecordById(req, res) {
  try {
    const data = await recordsService.getRecordById(req.params.id);
    return sendSuccess(res, data, 'Record retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function updateRecord(req, res) {
  try {
    const parsed = updateRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation failed', 400, parsed.error.issues, 'VALIDATION_ERROR');
    }

    const data = await recordsService.updateRecord(req.params.id, parsed.data, req.user.id);
    return sendSuccess(res, data, 'Record updated');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function softDeleteRecord(req, res) {
  try {
    const data = await recordsService.softDeleteRecord(req.params.id, req.user.id);
    return sendSuccess(res, data, data.message);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

module.exports = { createRecord, getAllRecords, getRecordById, updateRecord, softDeleteRecord };
