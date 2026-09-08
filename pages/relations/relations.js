const app = getApp()
const social = require('../../services/social')
const { follow } = require('../../utils/social')
Page({
  data: { type: 'following', users: [], loading: false, hasMore: true, page: 0, errorText: '' },
  onLoad(options) { this.setData({ type: options.type === 'followers' ? 'followers' : 'following' }) },
  onShow() { return this.load(true) },
  onUnload() { this._gone = true },
  onTab(e) { const type = e.currentTarget.dataset.type; if (type === this.data.type) return; this.setData({ type, users: [] }); return this.load(true) },
  async load(reset = false) {
    if (!reset && (this.data.loading || !this.data.hasMore)) return
    const token = (this._token || 0)+1; this._token = token
    const page = reset ? 0 : this.data.page
    this._lastReset = reset
    const type = this.data.type
    this.setData({ loading: true, errorText: '' })
    try {
      await app.ensureAuth()
      const result = await social.listFollows(type, page)
      if (this._token !== token || this._gone) return
      const old = reset ? [] : this.data.users; const ids = new Set(old.map(u => u.openid))
      this.setData({ users: old.concat(result.items.filter(u => !ids.has(u.openid))), page: page+1, hasMore: result.hasMore })
    } catch (err) { if (this._token === token) this.setData({ errorText: err.message || '加载失败' }) }
    finally { if (this._token === token && !this._gone) this.setData({ loading: false }) }
  },
  onReachBottom() { return this.load(false) },
  onRetry() { return this.load(this._lastReset || !this.data.users.length) },
  onPullDownRefresh() { return this.load(true).finally(() => wx.stopPullDownRefresh()) },
  onUser(e) { wx.navigateTo({ url: '/pages/user/user?openid=' + encodeURIComponent(e.currentTarget.dataset.id) }) },
  onFollow(e) {
    const id = e.currentTarget.dataset.id; const user = this.data.users.find(u => u.openid === id)
    if (!user) return
    return follow(this, id, user.following, result => {
      const index = this.data.users.findIndex(u => u.openid === id)
      if (index >= 0) this.setData({ ['users[' + index + '].following']: result.following })
    })
  }
})
