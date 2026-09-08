function login() {
  return wx.cloud.callFunction({ name: 'login' }).then(res => {
    const result = res && res.result
    if (!result || !result.openid) {
      throw new Error('无法获取微信用户身份')
    }
    return result
  })
}

module.exports = { login }
