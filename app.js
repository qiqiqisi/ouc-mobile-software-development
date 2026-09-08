const { ENV_ID } = require('./config/cloud')
const authService = require('./services/auth')

App({
  globalData: {
    openid: '',
    user: null,
    authReady: false,
    refreshHome: false,
    refreshProfile: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库不支持云开发')
      return
    }

    const cloudConfig = { traceUser: true }
    if (ENV_ID) cloudConfig.env = ENV_ID
    wx.cloud.init(cloudConfig)

    this.ensureAuth().catch(err => {
      console.error('初始化微信身份失败', err)
    })
  },

  ensureAuth() {
    if (this.globalData.authReady && this.globalData.openid) {
      return Promise.resolve({
        openid: this.globalData.openid,
        user: this.globalData.user
      })
    }

    if (this._authPromise) return this._authPromise

    this._authPromise = authService.login()
      .then(session => {
        this.globalData.openid = session.openid
        this.globalData.user = session.user
        this.globalData.authReady = true
        return session
      })
      .finally(() => {
        this._authPromise = null
      })

    return this._authPromise
  },

  updateCurrentUser(user) {
    this.globalData.user = user
    this.globalData.refreshHome = true
    this.globalData.refreshProfile = true
  }
})
