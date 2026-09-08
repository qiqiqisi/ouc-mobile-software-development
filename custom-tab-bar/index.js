Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', symbol: '⌂' },
      { pagePath: '/pages/publish/publish', text: '发布', symbol: '+' },
      { pagePath: '/pages/profile/profile', text: '我的', symbol: '○' }
    ]
  },

  methods: {
    onTap(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item) return
      wx.switchTab({ url: item.pagePath })
    }
  }
})
