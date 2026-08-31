const common = require('../../utils/common');

Page({
  data: {
    article: null,
    isFavorite: false
  },

  onLoad(options) {
    const article = common.getNewsById(options.id);
    if (!article) {
      wx.showToast({ title: '新闻不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }

    this.setData({
      article,
      isFavorite: common.isFavorite(article.id)
    });

    // 每次真正进入详情页时更新最近阅读：
    // 已存在的新闻不重复累加，而是移动到最前并更新时间。
    common.addHistory(article.id);
  },

  onShow() {
    if (this.data.article) {
      this.setData({
        isFavorite: common.isFavorite(this.data.article.id)
      });
    }
  },

  toggleFavorite() {
    const isFavorite = common.toggleFavorite(this.data.article.id);
    this.setData({ isFavorite });

    wx.showToast({
      title: isFavorite ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 900
    });
  },

  copySource() {
    wx.setClipboardData({
      data: this.data.article.sourceUrl,
      success() {
        wx.showToast({
          title: '原文地址已复制',
          icon: 'none'
        });
      }
    });
  },

  onShareAppMessage() {
    const article = this.data.article;

    if (!article) {
      return {
        title: '海大新闻',
        path: '/pages/index/index'
      };
    }

    return {
      title: article.title,
      path: `/pages/detail/detail?id=${article.id}`
    };
  }
});
