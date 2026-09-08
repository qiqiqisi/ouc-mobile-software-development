const app = getApp()
const postsService = require('../../services/posts')
const usersService = require('../../services/users')
const social = require('../../services/social')
const { loadPaged } = require('../../utils/paged')
const { onPostTap, onAuthorTap, onLikeTap } = require('../../utils/social')
Page({
  data: { user: null, posts: [], tab: 'posts', tabs: [{key:'posts',label:'笔记'},{key:'favorite',label:'收藏'},{key:'like',label:'点赞'}], filter: '', page: 0, hasMore: true, loading: false, initialLoading: true, errorText: '', profileError: '', statusBarHeight: 24, navHeight: 44 },
  onLoad() {
    const system = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const capsule = wx.getMenuButtonBoundingClientRect()
    this.setData({ statusBarHeight: system.statusBarHeight, navHeight: Math.max(44, (capsule.top - system.statusBarHeight) * 2 + capsule.height) })
  },
  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 2 })
    return this.loadProfile()
  },
  onUnload() { this._gone = true },
  onPullDownRefresh() { return this.loadProfile().finally(() => wx.stopPullDownRefresh()) },
  async loadProfile() {
    this.setData({ profileError: '' })
    try {
      const session = await app.ensureAuth()
      const user = await usersService.getUser(session.openid)
      if (this._gone) return
      this.setData({ user })
      app.globalData.user = { ...app.globalData.user, ...user }
    } catch (err) { this.setData({ profileError: err.message || '资料加载失败' }) }
    return this.loadPosts(true)
  },
  loadPosts(reset) {
    const tab = this.data.tab
    const status = this.data.filter
    return loadPaged(this, reset, async page => {
      const session = await app.ensureAuth()
      return tab === 'posts' ? postsService.listPosts({ authorOpenid: session.openid, status, page }) : social.listLibrary(tab, page)
    })
  },
  onTabTap(e) {
    const tab = e.currentTarget.dataset.key
    if (!this.data.tabs.some(t => t.key === tab) || tab === this.data.tab) return
    this.setData({ tab, posts: [], filter: '', hasMore: true })
    return this.loadPosts(true)
  },
  onFilterTap(e) {
    this.setData({ filter: e.currentTarget.dataset.key || '', posts: [] })
    return this.loadPosts(true)
  },
  onReachBottom() { return this.loadPosts(false) },
  onRetry() { return this.loadPosts(this._lastLoadReset || !this.data.posts.length) },
  onEditProfile() { wx.navigateTo({ url: '/pages/profile-edit/profile-edit' }) },
  onHistory() { wx.navigateTo({ url: '/pages/history/history' }) },
  onRelations(e) { wx.navigateTo({ url: '/pages/relations/relations?type=' + e.currentTarget.dataset.type }) },
  onAppreciation() { const u = this.data.user || {}; wx.showModal({ title: '获赞与收藏', content: '公开笔记共获得 ' + (u.receivedLikes || 0) + ' 个赞，' + (u.receivedFavorites || 0) + ' 次收藏。', showCancel: false, confirmColor: '#1980C8' }) },
  onPostTap, onAuthorTap,
  async onLikeTap(e) {
    await onLikeTap.call(this, e)
    if (this.data.tab === 'like' && this.data.posts.some(p => p._id === e.detail.post._id && !p.liked)) return this.loadPosts(true)
  }
})
