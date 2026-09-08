const { decoratePost } = require('./post')

async function loadPaged(host, reset, fetchPage) {
  if (!reset && (host.data.loading || !host.data.hasMore)) return
  const token = (host._loadToken || 0) + 1
  host._loadToken = token
  const page = reset ? 0 : host.data.page
  host._lastLoadReset = reset
  host.setData({ loading: true, errorText: '', initialLoading: reset && !host.data.posts.length })
  try {
    const result = await fetchPage(page)
    if (host._loadToken !== token || host._gone) return
    const old = reset ? [] : host.data.posts
    const ids = new Set(old.map(p => p._id))
    const posts = old.concat((result.items || []).filter(p => !ids.has(p._id)).map(decoratePost))
    host.setData({ posts, page: page + 1, hasMore: Boolean(result.hasMore) })
  } catch (err) {
    if (host._loadToken === token && !host._gone) host.setData({ errorText: err.message || '加载失败，请重试' })
  } finally {
    if (host._loadToken === token && !host._gone) host.setData({ loading: false, initialLoading: false })
  }
}

module.exports = { loadPaged }
