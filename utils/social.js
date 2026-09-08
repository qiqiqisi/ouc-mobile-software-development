const social = require('../services/social')

function changed(post) {
  const app = getApp()
  if (!post) app.globalData.refreshHome = true
  app.globalData.refreshProfile = true
  app.globalData.socialRevision = (app.globalData.socialRevision || 0) + 1
  if (post) {
    app.globalData.postUpdates = app.globalData.postUpdates || {}
    app.globalData.postUpdates[post._id] = { ...app.globalData.postUpdates[post._id], ...post }
  }
}

// Explicit desired state + per-control lock: retries never invert an already accepted action.
async function react(host, post, type, update) {
  if (!post) return
  const key = `${post._id}:${type}`
  host._reactionLocks = host._reactionLocks || new Set()
  if (host._reactionLocks.has(key)) return
  host._reactionLocks.add(key)
  const flag = type === 'like' ? 'liked' : 'favorited'
  const field = type === 'like' ? 'likeCount' : 'favoriteCount'
  const old = { [flag]: Boolean(post[flag]), [field]: Number(post[field]) || 0 }
  const active = !old[flag]
  update({ [flag]: active, [field]: Math.max(0, old[field] + (active ? 1 : -1)) })
  try {
    await getApp().ensureAuth()
    const result = await social.setReaction(post._id, type, active)
    update({ [flag]: result.active, [field]: result.count })
    changed({ _id: post._id, [flag]: result.active, [field]: result.count })
  } catch (err) {
    update(old)
    wx.showToast({ title: err.message || '操作失败，请重试', icon: 'none' })
  } finally { host._reactionLocks.delete(key) }
}

async function follow(host, openid, following, update) {
  host._followLocks = host._followLocks || new Set()
  if (host._followLocks.has(openid)) return
  host._followLocks.add(openid)
  try {
    await getApp().ensureAuth()
    const result = await social.setFollow(openid, !following)
    update(result)
    changed()
  } catch (err) { wx.showToast({ title: err.message || '关注失败，请重试', icon: 'none' }) }
  finally { host._followLocks.delete(openid) }
}

const onPostTap = e => wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(e.detail.post._id)}` })
const onAuthorTap = e => wx.navigateTo({ url: `/pages/user/user?openid=${encodeURIComponent(e.detail.post.authorOpenid)}` })
function onLikeTap(e) {
  const post = e.detail.post
  return react(this, post, 'like', patch => {
    const index = this.data.posts.findIndex(p => p._id === post._id)
    if (index >= 0) this.setData({ [`posts[${index}]`]: { ...this.data.posts[index], ...patch } })
  })
}
module.exports = { changed, react, follow, onPostTap, onAuthorTap, onLikeTap }
