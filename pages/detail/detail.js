const app = getApp()
const postsService = require('../../services/posts')
const { decoratePost } = require('../../utils/post')
const usersService = require('../../services/users')
const social = require('../../services/social')
const interactions = require('../../utils/social')
const { formatRelative } = require('../../utils/date')

Page({
  data: {
    postId: '',
    post: null,
    isOwner: false,
    loading: true, errorText: '', following: false, comments: [], commentsPage: 0,
    commentsLoading: false, commentsMore: true, commentsError: '', commentDraft: '',
    composerOpen: false, composerFocus: false, sending: false, replyToId: '', replyToName: '',
    keyboardHeight: 0, currentImage: 0, currentUser: null
  },

  onLoad(options) {
    let postId = ''
    try { postId = decodeURIComponent(options.id || '') } catch (err) { /* Invalid link. */ }
    if (!postId) {
      this.setData({ loading: false, errorText: '帖子链接无效' })
      return
    }
    this.setData({ postId })
    this.loadPost()
  },

  onShow() {
    if (this.data.post && this._revision !== app.globalData.socialRevision) this.refreshAuthor()
  },
  onUnload() { this._gone = true },
  async refreshAuthor() {
    if (!this.data.post) return
    try {
      const user = await usersService.getUser(this.data.post.authorOpenid)
      if (!this._gone) this.setData({ following: user.following, 'post.author': { nickname: user.nickname, avatarFileID: user.avatarFileID } })
      this._revision = app.globalData.socialRevision
    } catch (err) { /* Keep the existing author snapshot. */ }
  },

  async loadPost() {
    this.setData({ loading: !this.data.post, errorText: '' })
    try {
      const session = await app.ensureAuth()
      const raw = await postsService.getPost(this.data.postId)
      if (this._gone) return
      const post = decoratePost(raw)
      this.setData({
        post, currentUser: session.user,
        isOwner: Boolean(app.globalData.openid && app.globalData.openid === post.authorOpenid)
      })
      this.refreshAuthor()
      this.loadComments(true)
      if (raw.historySaved === false) wx.showToast({ title: '本次浏览记录未保存', icon: 'none' })
    } catch (err) {
      console.error(err)
      this.setData({ errorText: err.message || '加载失败，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onImageChange(e) { this.setData({ currentImage: e.detail.current }) },
  onLike() { return interactions.react(this, this.data.post, 'like', patch => this.setData({ post: { ...this.data.post, ...patch } })) },
  onFavorite() { return interactions.react(this, this.data.post, 'favorite', patch => this.setData({ post: { ...this.data.post, ...patch } })) },
  onFollow() {
    if (this.data.isOwner) return
    return interactions.follow(this, this.data.post.authorOpenid, this.data.following, result => this.setData({ following: result.following }))
  },
  onCommentTap() { wx.pageScrollTo({ selector: '#comments', duration: 250 }) },
  onOpenComposer() { this.setData({ composerOpen: true, composerFocus: true }) },
  onCloseComposer() {
    if (this.data.sending) return
    this.setData({ composerOpen: false, composerFocus: false, keyboardHeight: 0 })
    wx.hideKeyboard()
  },
  onKeyboardHeight(e) { this.setData({ keyboardHeight: e.detail.height || 0 }) },
  onDraftInput(e) { this.setData({ commentDraft: e.detail.value }) },
  onCancelReply() { this.setData({ replyToId: '', replyToName: '' }) },
  onReply(e) {
    const item = this.data.comments.find(c => c._id === e.currentTarget.dataset.id)
    if (item) this.setData({ replyToId: item._id, replyToName: item.author.nickname, composerOpen: true, composerFocus: true })
  },
  stopEvent() {},
  onReachBottom() { if (this.data.post) this.loadComments(false) },
  onRetryComments() { return this.loadComments((this.data.commentsError && this._lastCommentsReset) || !this.data.comments.length) },
  async loadComments(reset = false) {
    if (!reset && (this.data.commentsLoading || !this.data.commentsMore)) return
    const token = (this._commentsToken || 0) + 1
    this._commentsToken = token
    this.setData({ commentsLoading: true, commentsError: '' })
    const page = reset ? 0 : this.data.commentsPage
    this._lastCommentsReset = reset
    try {
      const data = await social.listComments(this.data.postId, page)
      if (this._gone || this._commentsToken !== token) return
      const source = reset ? [] : this.data.comments
      const ids = new Set(source.map(c => c._id))
      const comments = source.concat(data.items.filter(c => !ids.has(c._id)).map(c => ({ ...c, timeText: formatRelative(c.createdAt) })))
      this.setData({ comments, commentsPage: page + 1, commentsMore: data.hasMore })
    } catch (err) { if (this._commentsToken === token) this.setData({ commentsError: err.message || '评论加载失败' }) }
    finally { if (!this._gone && this._commentsToken === token) this.setData({ commentsLoading: false }) }
  },
  async onSendComment() {
    if (this.data.sending) return
    const content = this.data.commentDraft.trim()
    if (!content) return wx.showToast({ title: '先写点什么吧', icon: 'none' })
    const signature = `${this.data.replyToId}:${content}`
    if (!this._commentRequest || this._commentRequest.signature !== signature) this._commentRequest = { signature, id: `${Date.now()}_${Math.random().toString(36).slice(2, 12)}` }
    this.setData({ sending: true })
    try {
      const result = await social.addComment({ postId: this.data.postId, content, replyToId: this.data.replyToId, requestId: this._commentRequest.id })
      if (this._gone) return
      const comment = { ...result.comment, timeText: formatRelative(result.comment.createdAt) }
      this.setData({ comments: [comment].concat(this.data.comments.filter(c => c._id !== comment._id)), 'post.commentCount': result.commentCount, commentDraft: '', replyToId: '', replyToName: '', composerOpen: false, composerFocus: false, keyboardHeight: 0 })
      this._commentRequest = null
      interactions.changed()
      this.loadComments(true)
      wx.hideKeyboard()
      wx.showToast({ title: '评论已发送', icon: 'success' })
    } catch (err) { wx.showToast({ title: err.message || '发送失败，草稿已保留', icon: 'none' }) }
    finally { if (!this._gone) this.setData({ sending: false }) }
  },
  async onDeleteComment(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.comments.find(c => c._id === id)
    if (!item || !item.isMine || this._deletingComment) return
    const modal = await wx.showModal({ title: '删除这条评论？', content: '删除后无法恢复。', confirmText: '删除', confirmColor: '#C64040' })
    if (!modal.confirm) return
    this._deletingComment = true
    try {
      const result = await social.deleteComment(id)
      this.setData({ comments: this.data.comments.filter(c => c._id !== id), 'post.commentCount': result.commentCount === undefined ? Math.max(0, this.data.post.commentCount - 1) : result.commentCount })
      interactions.changed()
      this.loadComments(true)
    } catch (err) { wx.showToast({ title: err.message || '删除失败', icon: 'none' }) }
    finally { this._deletingComment = false }
  },
  async onMore() {
    const post = this.data.post
    const actions = [{ label: '保存图片', run: () => this.onSaveImage() }]
    if (this.data.isOwner && post.statusText && post.status !== 'resolved') actions.push({ label: post.category === 'lost' ? '标记为已找到' : '标记为已解决', run: () => this.onResolve() })
    if (this.data.isOwner) actions.push({ label: '删除帖子', run: () => this.onDelete() })
    try { const res = await wx.showActionSheet({ itemList: actions.map(a => a.label) }); await actions[res.tapIndex].run() } catch (err) { /* User cancelled. */ }
  },

  onAuthorTap() {
    const post = this.data.post
    if (!post || !post.authorOpenid) return
    wx.navigateTo({
      url: `/pages/user/user?openid=${encodeURIComponent(post.authorOpenid)}`
    })
  },

  onPreviewImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const images = (this.data.post && this.data.post.images) || []
    if (!images[index]) return
    wx.previewImage({ current: images[index], urls: images })
  },

  async onSaveImage() {
    const images = (this.data.post && this.data.post.images) || []
    if (!images.length) {
      wx.showToast({ title: '这条帖子没有图片', icon: 'none' })
      return
    }

    let index = 0
    if (images.length > 1) {
      try {
        const res = await wx.showActionSheet({
          itemList: images.map((_, i) => `保存第${i + 1}张`)
        })
        index = res.tapIndex
      } catch (err) {
        return
      }
    }

    wx.showLoading({ title: '正在保存', mask: true })
    try {
      const download = await wx.cloud.downloadFile({ fileID: images[index] })
      await wx.saveImageToPhotosAlbum({ filePath: download.tempFilePath })
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      const msg = String((err && err.errMsg) || '')
      if (msg.includes('auth deny') || msg.includes('authorize')) {
        const modal = await wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存图片到相册。',
          confirmText: '去设置'
        })
        if (modal.confirm) wx.openSetting()
        return
      }
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async onResolve() {
    const post = this.data.post
    if (!post || !this.data.isOwner || post.status === 'resolved') return

    try {
      await postsService.updateStatus(post._id, 'resolved')
      app.globalData.refreshHome = true
      app.globalData.refreshProfile = true
      wx.showToast({
        title: post.category === 'lost' ? '已标记找到' : '已标记解决',
        icon: 'success'
      })
      this.loadPost()
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  async onDelete() {
    const post = this.data.post
    if (!post || !this.data.isOwner) return

    const modal = await wx.showModal({
      title: '删除这条帖子？',
      content: '删除后无法恢复，关联图片也会从云存储中清理。',
      confirmText: '删除',
      confirmColor: '#C64040'
    })
    if (!modal.confirm) return

    wx.showLoading({ title: '正在删除', mask: true })
    try {
      await postsService.deletePost(post._id)
      app.globalData.refreshHome = true
      app.globalData.refreshProfile = true
      wx.hideLoading()
      wx.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 350)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '删除失败', icon: 'none' })
    }
  },

  onShareAppMessage() {
    const post = this.data.post
    if (!post) return { title: '海大圈' }
    return {
      title: post.title,
      path: `/pages/detail/detail?id=${encodeURIComponent(post._id)}`,
      imageUrl: post.coverFileID || undefined
    }
  }
})
