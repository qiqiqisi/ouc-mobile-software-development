const app = getApp()
const postsService = require('../../services/posts')
const { CATEGORIES } = require('../../config/categories')
const { uploadImages, deleteCloudFiles } = require('../../utils/upload')

const PUBLISH_CATEGORIES = CATEGORIES.filter(item => item.key !== 'all')

Page({
  data: {
    categories: PUBLISH_CATEGORIES,
    category: 'scenery',
    images: [],
    coverIndex: null,
    title: '',
    content: '',
    location: '',
    contact: '',
    publishing: false,
    titleLength: 0,
    contentLength: 0
  },

  onShow() {
    if (this.getTabBar) {
      const tabBar = this.getTabBar()
      if (tabBar) tabBar.setData({ selected: 1 })
    }
  },

  onCategoryTap(e) {
    if (this.data.publishing) return
    const category = e.currentTarget.dataset.key
    if (!category || category === this.data.category) return
    this.setData({ category })
  },

  async onChooseImages() {
    if (this.data.publishing) return
    const remain = 3 - this.data.images.length
    if (remain <= 0) {
      wx.showToast({ title: '最多添加3张图片', icon: 'none' })
      return
    }

    try {
      const res = await wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        camera: 'back'
      })

      const selected = (res.tempFiles || [])
        .map(item => item.tempFilePath)
        .filter(Boolean)
        .map(path => ({ path }))

      const images = this.data.images.concat(selected)
      let coverIndex = this.data.coverIndex
      if (images.length === 1) coverIndex = 0

      this.setData({ images, coverIndex })
    } catch (err) {
      if (err && String(err.errMsg || '').includes('cancel')) return
      console.error(err)
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    }
  },

  onPreviewImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const urls = this.data.images.map(item => item.path)
    if (!urls[index]) return
    wx.previewImage({ current: urls[index], urls })
  },

  onSetCover(e) {
    if (this.data.publishing) return
    const index = Number(e.currentTarget.dataset.index)
    if (!this.data.images[index]) return
    this.setData({ coverIndex: index })
  },

  onRemoveImage(e) {
    if (this.data.publishing) return
    const index = Number(e.currentTarget.dataset.index)
    const images = this.data.images.slice()
    if (!images[index]) return
    images.splice(index, 1)

    let coverIndex = this.data.coverIndex
    if (coverIndex === index) {
      coverIndex = images.length === 1 ? 0 : null
    } else if (coverIndex !== null && coverIndex > index) {
      coverIndex -= 1
    }

    this.setData({ images, coverIndex })
  },

  onTitleInput(e) {
    const title = e.detail.value || ''
    this.setData({ title, titleLength: title.length })
  },

  onContentInput(e) {
    const content = e.detail.value || ''
    this.setData({ content, contentLength: content.length })
  },

  onLocationInput(e) {
    this.setData({ location: e.detail.value || '' })
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value || '' })
  },

  validate() {
    const { category, title, content, images, coverIndex } = this.data

    if (!category) return '请选择分类'
    if (!title.trim()) return '请填写标题'
    if (title.trim().length > 30) return '标题不能超过30个字'
    if (content.trim().length > 500) return '正文不能超过500个字'
    if (category === 'scenery' && images.length === 0) return '风景帖至少需要1张图片'
    if (images.length > 0 && (coverIndex === null || !images[coverIndex])) {
      return '请选择一张图片作为封面'
    }

    return ''
  },

  async onPublish() {
    if (this.data.publishing) return

    const message = this.validate()
    if (message) {
      wx.showToast({ title: message, icon: 'none' })
      return
    }

    this.setData({ publishing: true })
    const draft = { ...this.data, images: this.data.images.slice() }
    wx.showLoading({ title: '正在发布', mask: true })

    let uploaded = []
    try {
      const session = await app.ensureAuth()
      const localPaths = draft.images.map(item => item.path)
      uploaded = await uploadImages(localPaths, session.openid)

      const coverFileID = uploaded.length ? uploaded[draft.coverIndex] : ''
      await postsService.createPost({
        category: draft.category,
        title: draft.title.trim(),
        content: draft.content.trim(),
        images: uploaded,
        coverFileID,
        coverIndex: uploaded.length ? draft.coverIndex : -1,
        location: draft.location.trim(),
        contact: ['errand', 'lost'].includes(draft.category) ? draft.contact.trim() : ''
      })

      app.globalData.refreshHome = true
      app.globalData.refreshProfile = true

      this.setData({
        category: 'scenery',
        images: [],
        coverIndex: null,
        title: '',
        content: '',
        location: '',
        contact: '',
        titleLength: 0,
        contentLength: 0
      })

      wx.hideLoading()
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 350)
    } catch (err) {
      console.error(err)
      if (uploaded.length) await deleteCloudFiles(uploaded)
      wx.hideLoading()
      wx.showToast({
        title: err.message || '发布失败，请重试',
        icon: 'none',
        duration: 2500
      })
    } finally {
      this.setData({ publishing: false })
    }
  }
})
