const app = getApp()
const usersService = require('../../services/users')
const { uploadAvatar, deleteCloudFiles } = require('../../utils/upload')

Page({
  data: {
    nickname: '',
    avatarDisplay: '/assets/ouc-logo.png',
    newAvatarLocalPath: '',
    saving: false
  },

  async onLoad() {
    try {
      const session = await app.ensureAuth()
      const user = session.user || {}
      this.setData({
        nickname: user.nickname || '海大同学',
        avatarDisplay: user.avatarFileID || '/assets/ouc-logo.png'
      })
    } catch (err) {
      wx.showToast({ title: '身份初始化失败', icon: 'none' })
    }
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return
    this.setData({
      newAvatarLocalPath: avatarUrl,
      avatarDisplay: avatarUrl
    })
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value || '' })
  },

  async onSave() {
    if (this.data.saving) return
    const nickname = this.data.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (nickname.length > 20) {
      wx.showToast({ title: '昵称不能超过20个字', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '正在保存', mask: true })

    let newAvatarFileID = ''
    try {
      const session = await app.ensureAuth()
      if (this.data.newAvatarLocalPath) {
        newAvatarFileID = await uploadAvatar(this.data.newAvatarLocalPath, session.openid)
      }

      const user = await usersService.updateProfile({
        nickname,
        avatarFileID: newAvatarFileID || (session.user && session.user.avatarFileID) || ''
      })

      app.updateCurrentUser(user)
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 350)
    } catch (err) {
      console.error(err)
      if (newAvatarFileID) await deleteCloudFiles([newAvatarFileID])
      wx.hideLoading()
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
