Page({
  onLoad() {
    wx.showShareMenu({
      menus: ['shareAppMessage']
    })
  },

  copyLink(e) {
    const url = e.currentTarget.dataset.url

    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        })
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '伍紫涵的个人名片',
      path: '/pages/index/index',
      imageUrl: '/images/card-cover.png'
    }
  }
})