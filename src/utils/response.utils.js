/**
 * Send a success JSON response.
 *
 * @param {import('express').Response} res
 * @param {*}      data
 * @param {string} message
 * @param {number} statusCode
 */
function sendSuccess(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send an error JSON response.
 *
 * @param {import('express').Response} res
 * @param {string}      message
 * @param {number}      statusCode
 * @param {Array|null}  errors   Field-level or detail errors
 * @param {string|null} code     Machine-readable error code
 */
function sendError(res, message = 'Error', statusCode = 400, errors = null, code = null) {
  const body = {
    success: false,
    message,
  };

  if (errors !== null) body.errors = errors;
  if (code !== null) body.code = code;

  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess, sendError };
