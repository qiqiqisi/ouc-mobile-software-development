const app = getApp()
const postsService = require('../../services/posts')
const { CATEGORIES } = require('../../config/categories')
const { loadPaged } = require('../../utils/paged')
const { onPostTap, onAuthorTap, onLikeTap } = require('../../utils/social')
Page({
  data: { categories: CATEGORIES, activeCategory: 'all', posts: [], page: 0, hasMore: true, loading: false, initialLoading: true, errorText: '', statusBarHeight: 24, navHeight: 44 },
  onLoad() {
    const system = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const capsule = wx.getMenuButtonBoundingClientRect()
    this.setData({ statusBarHeight: system.statusBarHeight, navHeight: Math.max(44, (capsule.top - system.statusBarHeight) * 2 + capsule.height) })
    this.loadPosts(true)
  },
  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 0 })
    const updates = app.globalData.postUpdates || {}
    if (Object.keys(updates).length) {
      this.setData({ posts: this.data.posts.map(p => updates[p._id] ? { ...p, ...updates[p._id] } : p) })
      app.globalData.postUpdates = {}
    }
    if (app.globalData.refreshHome) { app.globalData.refreshHome = false; this.loadPosts(true) }
  },
  onUnload() { this._gone = true },
  onPullDownRefresh() { return this.loadPosts(true).finally(() => wx.stopPullDownRefresh()) },
  onReachBottom() { return this.loadPosts(false) },
  onRetry() { return this.loadPosts(this._lastLoadReset || !this.data.posts.length) },
  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key
    if (!CATEGORIES.some(c => c.key === key) || key === this.data.activeCategory) return
    this.setData({ activeCategory: key, posts: [], hasMore: true })
    return this.loadPosts(true)
  },
  loadPosts(reset) {
    const category = this.data.activeCategory
    return loadPaged(this, reset, async page => { await app.ensureAuth(); return postsService.listPosts({ category, page }) })
  },
  onPostTap, onAuthorTap, onLikeTap
})
