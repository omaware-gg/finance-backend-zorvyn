const { sendError } = require('../utils/response.utils');

// Role hierarchy (highest → lowest):
// ADMIN > DATA_LAKE_OWNER > ANALYST_WRITE > ANALYST_READ > VIEWER > NO_ACCESS

/**
 * Factory that returns middleware restricting access to the given roles.
 * @param  {...string} roles  Allowed role names
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(
        res,
        'Insufficient permissions for this operation',
        403,
        null,
        'FORBIDDEN'
      );
    }
    return next();
  };
}

module.exports = { authorize };
