const app = getApp()
const usersService = require('../../services/users')
const postsService = require('../../services/posts')
const { loadPaged } = require('../../utils/paged')
const { follow, onPostTap, onAuthorTap, onLikeTap } = require('../../utils/social')
Page({
  data: { openid: '', user: null, posts: [], page: 0, loading: false, initialLoading: true, hasMore: true, errorText: '', profileError: '' },
  onLoad(options) {
    let openid = ''
    try { openid = decodeURIComponent(options.openid || '') } catch (err) {}
    this.setData({ openid })
  },
  onShow() { if (this.data.openid) this.load(); else this.setData({ initialLoading: false, profileError: '用户链接无效' }) },
  onUnload() { this._gone = true },
  async load() {
    this.setData({ profileError: '' })
    try {
      await app.ensureAuth()
      const user = await usersService.getUser(this.data.openid)
      if (this._gone) return
      this.setData({ user })
      wx.setNavigationBarTitle({ title: user.nickname + '的主页' })
    } catch (err) { this.setData({ profileError: err.message || '用户加载失败' }) }
    return this.loadPosts(true)
  },
  loadPosts(reset) { return loadPaged(this, reset, page => postsService.listPosts({ authorOpenid: this.data.openid, page })) },
  onReachBottom() { return this.loadPosts(false) },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()) },
  onRetry() { return this.loadPosts(this._lastLoadReset || !this.data.posts.length) },
  onFollow() { if (this.data.user && !this.data.user.isSelf) return follow(this, this.data.openid, this.data.user.following, result => this.setData({ 'user.following': result.following, 'user.followerCount': result.followerCount })) },
  onEdit() { wx.navigateTo({ url: '/pages/profile-edit/profile-edit' }) },
  onPostTap, onAuthorTap, onLikeTap
})
