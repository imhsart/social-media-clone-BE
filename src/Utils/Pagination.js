const getPagination = (req, defaultLimit = 20, maxLimit = 30) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(req.query.limit) || defaultLimit, 1), maxLimit)
  const skip = (page - 1) * limit

  return { page, limit, skip }
}


const buildPage = (items, limit, page) => {
  const hasMore = items.length > limit
  return { items: hasMore ? items.slice(0, limit) : items, page, hasMore }
}


module.exports = {
  getPagination,
  buildPage
}