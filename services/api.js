function call(action, data = {}) {
  return wx.cloud.callFunction({
    name: 'campusApi',
    data: { action, ...data }
  }).then(res => {
    const result = res && res.result
    if (!result || result.ok !== true) {
      const message = (result && result.message) || '云端请求失败'
      const error = new Error(message)
      error.code = result && result.code
      throw error
    }
    return result.data
  })
}

module.exports = { call }
