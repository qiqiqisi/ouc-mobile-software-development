const app = getApp()
const social = require('../../services/social')
const { loadPaged } = require('../../utils/paged')
const { toTimestamp } = require('../../utils/date')
const { onPostTap } = require('../../utils/social')
function groupLabel(value) {
  const date = new Date(toTimestamp(value))
  const today = new Date(); today.setHours(0,0,0,0)
  if (date >= today) return '今天'
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1)
  if (date >= yesterday) return '昨天'
  return date.getFullYear() + '年' + (date.getMonth()+1) + '月' + date.getDate() + '日'
}
Page({
  data: { posts: [], groups: [], page: 0, loading: false, initialLoading: true, hasMore: true, errorText: '', clearing: false, managing: false },
  onShow() { return this.loadPosts(true) },
  onUnload() { this._gone = true },
  async loadPosts(reset) {
    await loadPaged(this, reset, async page => { await app.ensureAuth(); return social.listLibrary('history', page) })
    this.groupPosts()
  },
  groupPosts() {
    const groups = []
    this.data.posts.forEach(post => {
      const label = groupLabel(post.viewedAt)
      if (!groups.length || groups[groups.length-1].label !== label) groups.push({ label, items: [] })
      groups[groups.length-1].items.push(post)
    })
    this.setData({ groups })
  },
  onReachBottom() { return this.loadPosts(false) },
  onPullDownRefresh() { return this.loadPosts(true).finally(() => wx.stopPullDownRefresh()) },
  onRetry() { return this.loadPosts(this._lastLoadReset || !this.data.posts.length) },
  onManage() { this.setData({ managing: !this.data.managing }) },
  onOpen(e) { onPostTap({ detail: { post: { _id: e.currentTarget.dataset.id } } }) },
  async onRemove(e) {
    if (this._removing) return
    const id = e.currentTarget.dataset.id
    this._removing = true
    try { await social.removeHistory(id); this.setData({ posts: this.data.posts.filter(p => p._id !== id) }); this.groupPosts(); await this.loadPosts(true) }
    catch (err) { wx.showToast({ title: err.message || '移除失败', icon: 'none' }) }
    finally { this._removing = false }
  },
  async onClear() {
    if (this.data.clearing) return
    const before = Date.now()
    const modal = await wx.showModal({ title: '清空浏览记录？', content: '仅清空你的浏览记录，已点赞和收藏的笔记不受影响。', confirmText: '清空', confirmColor: '#1980C8' })
    if (!modal.confirm) return
    this.setData({ clearing: true })
    try { await social.clearHistory(before); await this.loadPosts(true); wx.showToast({ title: '已清空', icon: 'success' }) }
    catch (err) { await this.loadPosts(true); wx.showToast({ title: err.message || '清空未完成，请重试', icon: 'none' }) }
    finally { this.setData({ clearing: false }) }
  }
})
