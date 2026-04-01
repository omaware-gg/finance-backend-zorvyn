const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;
const DEFAULT_PAGE = 1;

/**
 * Extract pagination parameters from a request query object.
 *
 * @param {Record<string, string>} query  req.query
 * @returns {{ skip: number, take: number, page: number, limit: number }}
 */
function getPagination(query = {}) {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) page = DEFAULT_PAGE;

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
}

module.exports = { getPagination };
