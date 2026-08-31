const common = require('../../utils/common');

Page({
  data: {
    swiperNews: [],
    newsList: [],
    categories: [],
    currentCategory: '全部',
    searchKeyword: '',
    currentSwiper: 0
  },

  onLoad() {
    this.setData({
      swiperNews: common.getSwiperNews(),
      categories: common.getCategories()
    });

    this.refreshNewsList();
  },

  onShow() {
    // 从详情页返回后重新读取收藏状态，保证首页星标立即同步。
    this.refreshNewsList();
  },

  refreshNewsList() {
    const favoriteIds = common.getFavoriteIds();

    const newsList = common
      .filterNews({
        keyword: this.data.searchKeyword,
        category: this.data.currentCategory
      })
      .map(item => ({
        ...item,
        isFavorite: favoriteIds.includes(item.id)
      }));

    this.setData({ newsList });
  },

  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });

    this.refreshNewsList();
  },

  clearSearch() {
    if (!this.data.searchKeyword) {
      return;
    }

    this.setData({
      searchKeyword: ''
    });

    this.refreshNewsList();
  },

  selectCategory(e) {
    const category = e.currentTarget.dataset.category;

    if (!category || category === this.data.currentCategory) {
      return;
    }

    this.setData({
      currentCategory: category
    });

    this.refreshNewsList();
  },

  toggleFavorite(e) {
    const id = String(e.currentTarget.dataset.id);
    const isFavorite = common.toggleFavorite(id);

    this.refreshNewsList();

    wx.showToast({
      title: isFavorite ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 800
    });
  },

  onSwiperChange(e) {
    this.setData({
      currentSwiper: e.detail.current
    });
  },

  openNews(e) {
    const id = e.currentTarget.dataset.id;

    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});
