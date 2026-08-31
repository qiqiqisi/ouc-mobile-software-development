const common = require('../../utils/common');

const SWIPE_ACTION_WIDTH = 164;
const BRAND_AVATAR = '/images/brand/ouc_logo.png';

Page({
  data: {
    profile: null,
    profileAvatar: BRAND_AVATAR,
    savedAvatarPreview: BRAND_AVATAR,
    hasSavedProfile: false,
    loggedIn: false,

    editing: false,
    editorMode: 'edit',
    draftAvatar: BRAND_AVATAR,
    draftNickname: '',
    avatarChosen: false,

    activeTab: 'favorites',
    favorites: [],
    history: [],

    manageMode: false,
    selectedIds: [],
    selectedCount: 0,
    allSelected: false
  },

  onShow() {
    this.resetTransientState();
    this.refresh();
  },

  onUnload() {
    if (this._editTimer) {
      clearTimeout(this._editTimer);
    }
  },

  resetTransientState() {
    this._swipe = null;
    this._suppressOpenUntil = 0;

    this.setData({
      manageMode: false,
      selectedIds: [],
      selectedCount: 0,
      allSelected: false
    });
  },

  preventTouchMove() {},

  stopPropagation() {},

  formatHistoryTime(timestamp) {
    if (!timestamp) {
      return '';
    }

    const date = new Date(timestamp);
    const pad = (num) => String(num).padStart(2, '0');

    return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  decorateFavoriteList(selectedSet = new Set()) {
    return common.getFavoriteNews().map(item => ({
      ...item,
      swipeX: 0,
      selected: selectedSet.has(item.id)
    }));
  },

  decorateHistoryList(selectedSet = new Set()) {
    const favoriteIds = new Set(common.getFavoriteIds());

    return common.getHistoryNews().map(item => ({
      ...item,
      viewedAtText: this.formatHistoryTime(item.viewedAt),
      swipeX: 0,
      selected: selectedSet.has(item.id),
      isFavorite: favoriteIds.has(item.id)
    }));
  },

  refresh() {
    const savedProfile = common.getProfile();
    const hasSavedProfile = common.hasSavedProfile();
    const loggedIn = common.isLoggedIn();
    const avatarUrl = hasSavedProfile && savedProfile.avatarUrl
      ? savedProfile.avatarUrl
      : BRAND_AVATAR;

    this.setData({
      profile: loggedIn ? savedProfile : null,
      profileAvatar: loggedIn ? avatarUrl : BRAND_AVATAR,
      savedAvatarPreview: avatarUrl,
      hasSavedProfile,
      loggedIn,
      favorites: this.decorateFavoriteList(),
      history: this.decorateHistoryList()
    });
  },

  refreshLists() {
    const selectedSet = new Set(this.data.selectedIds);

    this.setData({
      favorites: this.decorateFavoriteList(selectedSet),
      history: this.decorateHistoryList(selectedSet)
    });

    this.syncSelectionState();
  },

  switchContentTab(e) {
    const tab = e.currentTarget.dataset.tab;

    if (!tab || tab === this.data.activeTab) {
      return;
    }

    this._swipe = null;

    this.setData({
      activeTab: tab,
      manageMode: false,
      selectedIds: [],
      selectedCount: 0,
      allSelected: false,
      favorites: this.data.favorites.map(item => ({
        ...item,
        swipeX: 0,
        selected: false
      })),
      history: this.data.history.map(item => ({
        ...item,
        swipeX: 0,
        selected: false
      }))
    });
  },

  // ---------------- 用户资料 / 登录 ----------------

  openEditor(mode) {
    if (this._editTimer) {
      clearTimeout(this._editTimer);
    }

    const isLogin = mode === 'login';
    const savedProfile = common.getProfile() || {};

    // 延后到当前点击彻底结束后再挂载 chooseAvatar 原生组件，
    // 避免“点击编辑资料”被同一次触摸误派发给头像选择器。
    this._editTimer = setTimeout(() => {
      this.setData({
        editing: true,
        editorMode: isLogin ? 'login' : 'edit',
        draftAvatar: isLogin
          ? BRAND_AVATAR
          : (savedProfile.avatarUrl || BRAND_AVATAR),
        draftNickname: isLogin ? '' : (savedProfile.nickname || ''),
        avatarChosen: !isLogin && Boolean(savedProfile.avatarUrl)
      });

      this._editTimer = null;
    }, 180);
  },

  startLogin() {
    if (common.hasSavedProfile()) {
      common.setLoggedIn(true);
      const profile = common.getProfile();

      this.setData({
        profile,
        profileAvatar: profile.avatarUrl || BRAND_AVATAR,
        savedAvatarPreview: profile.avatarUrl || BRAND_AVATAR,
        hasSavedProfile: true,
        loggedIn: true,
        editing: false
      });

      wx.showToast({
        title: '欢迎回来',
        icon: 'none',
        duration: 900
      });
      return;
    }

    this.openEditor('login');
  },

  startEdit() {
    this.openEditor('edit');
  },

  cancelEdit() {
    if (this._editTimer) {
      clearTimeout(this._editTimer);
      this._editTimer = null;
    }

    this.setData({
      editing: false
    });
  },

  onChooseAvatar(e) {
    const tempFilePath = e.detail && e.detail.avatarUrl;
    if (!tempFilePath) {
      return;
    }

    const fs = wx.getFileSystemManager();
    const extMatch = tempFilePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const ext = extMatch && /^(png|jpe?g|webp)$/i.test(extMatch[1])
      ? extMatch[1].toLowerCase()
      : 'jpg';
    const filePath = `${wx.env.USER_DATA_PATH}/lab03_avatar_${Date.now()}.${ext}`;
    const previousDraft = this.data.draftAvatar;

    fs.saveFile({
      tempFilePath,
      filePath,
      success: (res) => {
        const savedFilePath = res.savedFilePath || filePath;

        this.setData({
          draftAvatar: savedFilePath,
          avatarChosen: true
        });

        // 仅删除我们自己在 USER_DATA_PATH 中生成的旧头像文件。
        if (
          previousDraft &&
          previousDraft !== savedFilePath &&
          previousDraft.indexOf(`${wx.env.USER_DATA_PATH}/lab03_avatar_`) === 0
        ) {
          fs.unlink({
            filePath: previousDraft,
            fail() {}
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '头像保存失败，请重新选择',
          icon: 'none'
        });
      }
    });
  },

  onNicknameInput(e) {
    this.setData({
      draftNickname: e.detail.value
    });
  },

  saveProfile() {
    const nickname = (this.data.draftNickname || '').trim();
    const isLogin = this.data.editorMode === 'login';

    if (isLogin && !this.data.avatarChosen) {
      wx.showToast({
        title: '请先选择微信头像',
        icon: 'none'
      });
      return;
    }

    if (!nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    const profile = {
      avatarUrl: this.data.draftAvatar || BRAND_AVATAR,
      nickname
    };

    common.saveProfile(profile);
    common.setLoggedIn(true);

    this.setData({
      profile,
      profileAvatar: profile.avatarUrl,
      savedAvatarPreview: profile.avatarUrl,
      hasSavedProfile: true,
      loggedIn: true,
      editing: false,
      avatarChosen: true
    });

    wx.showToast({
      title: isLogin ? '登录成功' : '资料已保存',
      icon: 'none'
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后仅结束当前登录状态，头像、昵称、收藏和最近阅读仍保留在本机。',
      confirmText: '退出',
      confirmColor: '#C85B52',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        common.setLoggedIn(false);

        const savedProfile = common.getProfile();
        const hasSavedProfile = common.hasSavedProfile();

        this.setData({
          profile: null,
          profileAvatar: BRAND_AVATAR,
          savedAvatarPreview: hasSavedProfile
            ? (savedProfile.avatarUrl || BRAND_AVATAR)
            : BRAND_AVATAR,
          hasSavedProfile,
          loggedIn: false,
          editing: false,
          draftAvatar: BRAND_AVATAR,
          draftNickname: '',
          avatarChosen: false,
          editorMode: 'login'
        });

        this.closeAllSwipeRows();

        wx.showToast({
          title: '已退出登录',
          icon: 'none',
          duration: 900
        });
      }
    });
  },

  onProfileAvatarError() {
    this.setData({
      profileAvatar: BRAND_AVATAR
    });
  },

  onSavedAvatarError() {
    this.setData({
      savedAvatarPreview: BRAND_AVATAR
    });
  },

  onDraftAvatarError() {
    this.setData({
      draftAvatar: BRAND_AVATAR,
      avatarChosen: false
    });
  },

  // ---------------- 列表 / 收藏 / 最近阅读 ----------------

  getListByType(type) {
    return type === 'history' ? this.data.history : this.data.favorites;
  },

  setListByType(type, list) {
    if (type === 'history') {
      this.setData({ history: list });
    } else {
      this.setData({ favorites: list });
    }
  },

  toggleHistoryFavorite(e) {
    if (this.data.manageMode) {
      return;
    }

    const id = String(e.currentTarget.dataset.id);
    const isFavorite = common.toggleFavorite(id);

    this.setData({
      favorites: this.decorateFavoriteList(),
      history: this.decorateHistoryList()
    });

    wx.showToast({
      title: isFavorite ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 800
    });
  },

  onRowTouchStart(e) {
    if (this.data.manageMode) {
      return;
    }

    const id = String(e.currentTarget.dataset.id);
    const type = e.currentTarget.dataset.type || 'favorites';
    const touch = e.touches && e.touches[0];

    if (!touch) {
      return;
    }

    this._swipe = {
      id,
      type,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      moved: false,
      vertical: false
    };
  },

  onRowTouchMove(e) {
    if (this.data.manageMode || !this._swipe) {
      return;
    }

    const touch = e.touches && e.touches[0];
    if (!touch) {
      return;
    }

    const dx = touch.clientX - this._swipe.startX;
    const dy = touch.clientY - this._swipe.startY;

    if (!this._swipe.moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      this._swipe.vertical = true;
      return;
    }

    if (this._swipe.vertical) {
      return;
    }

    if (Math.abs(dx) > 6) {
      this._swipe.moved = true;
    }

    this._swipe.lastX = touch.clientX;

    let offset = dx;
    if (offset > 0) {
      offset = 0;
    }
    if (offset < -SWIPE_ACTION_WIDTH) {
      offset = -SWIPE_ACTION_WIDTH;
    }

    const list = this.getListByType(this._swipe.type).map(item => ({
      ...item,
      swipeX: item.id === this._swipe.id ? offset : 0
    }));

    this.setListByType(this._swipe.type, list);
  },

  onRowTouchEnd() {
    if (this.data.manageMode || !this._swipe) {
      this._swipe = null;
      return;
    }

    const swipe = this._swipe;
    this._swipe = null;

    if (swipe.vertical) {
      return;
    }

    const dx = swipe.lastX - swipe.startX;
    const open = dx < -52;

    const list = this.getListByType(swipe.type).map(item => ({
      ...item,
      swipeX: item.id === swipe.id && open ? -SWIPE_ACTION_WIDTH : 0
    }));

    this.setListByType(swipe.type, list);

    if (swipe.moved) {
      this._suppressOpenUntil = Date.now() + 260;
    }
  },

  closeAllSwipeRows() {
    this.setData({
      favorites: this.data.favorites.map(item => ({ ...item, swipeX: 0 })),
      history: this.data.history.map(item => ({ ...item, swipeX: 0 }))
    });
  },

  removeRow(e) {
    if (this.data.manageMode) {
      return;
    }

    const id = String(e.currentTarget.dataset.id);
    const type = e.currentTarget.dataset.type || 'favorites';

    if (type === 'history') {
      common.removeHistory(id);
      this.setData({
        history: this.decorateHistoryList()
      });

      wx.showToast({
        title: '已删除记录',
        icon: 'none',
        duration: 900
      });
      return;
    }

    common.removeFavorite(id);
    this.setData({
      favorites: this.decorateFavoriteList(),
      history: this.decorateHistoryList()
    });

    wx.showToast({
      title: '已取消收藏',
      icon: 'none',
      duration: 900
    });
  },

  clearFavorites() {
    if (!this.data.favorites.length || this.data.manageMode) {
      return;
    }

    wx.showModal({
      title: '清空全部收藏？',
      content: '清空后无法恢复，最近阅读不会受到影响。',
      confirmText: '清空',
      confirmColor: '#C85B52',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        common.clearFavorites();

        this.setData({
          favorites: [],
          history: this.decorateHistoryList()
        });

        wx.showToast({
          title: '收藏已清空',
          icon: 'none',
          duration: 900
        });
      }
    });
  },

  clearHistory() {
    if (!this.data.history.length || this.data.manageMode) {
      return;
    }

    wx.showModal({
      title: '清空最近阅读？',
      content: '仅删除本机的浏览记录，不会影响收藏新闻。',
      confirmText: '清空',
      confirmColor: '#C85B52',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        common.clearHistory();

        this.setData({
          history: []
        });

        wx.showToast({
          title: '记录已清空',
          icon: 'none',
          duration: 900
        });
      }
    });
  },

  openNews(e) {
    const id = String(e.currentTarget.dataset.id);
    const type = e.currentTarget.dataset.type || 'favorites';

    if (this.data.manageMode) {
      this.toggleSelectedId(id);
      return;
    }

    if (Date.now() < (this._suppressOpenUntil || 0)) {
      return;
    }

    const current = this.getListByType(type)
      .find(item => item.id === id);

    if (current && current.swipeX) {
      this.closeAllSwipeRows();
      return;
    }

    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  // ---------------- 批量管理 ----------------

  startManage() {
    const list = this.getListByType(this.data.activeTab);

    if (!list.length) {
      return;
    }

    this._swipe = null;

    this.setData({
      manageMode: true,
      selectedIds: [],
      selectedCount: 0,
      allSelected: false,
      favorites: this.data.favorites.map(item => ({
        ...item,
        swipeX: 0,
        selected: false
      })),
      history: this.data.history.map(item => ({
        ...item,
        swipeX: 0,
        selected: false
      }))
    });
  },

  finishManage() {
    this.setData({
      manageMode: false,
      selectedIds: [],
      selectedCount: 0,
      allSelected: false,
      favorites: this.data.favorites.map(item => ({
        ...item,
        selected: false
      })),
      history: this.data.history.map(item => ({
        ...item,
        selected: false
      }))
    });
  },

  toggleSelectedId(id) {
    const selectedIds = this.data.selectedIds.slice();
    const index = selectedIds.indexOf(id);

    if (index >= 0) {
      selectedIds.splice(index, 1);
    } else {
      selectedIds.push(id);
    }

    const selectedSet = new Set(selectedIds);

    this.setData({
      selectedIds,
      selectedCount: selectedIds.length,
      favorites: this.data.favorites.map(item => ({
        ...item,
        selected: selectedSet.has(item.id)
      })),
      history: this.data.history.map(item => ({
        ...item,
        selected: selectedSet.has(item.id)
      }))
    });

    this.syncSelectionState();
  },

  toggleSelectAll() {
    if (!this.data.manageMode) {
      return;
    }

    const list = this.getListByType(this.data.activeTab);
    const selectedIds = this.data.allSelected
      ? []
      : list.map(item => item.id);
    const selectedSet = new Set(selectedIds);

    this.setData({
      selectedIds,
      selectedCount: selectedIds.length,
      favorites: this.data.favorites.map(item => ({
        ...item,
        selected: selectedSet.has(item.id)
      })),
      history: this.data.history.map(item => ({
        ...item,
        selected: selectedSet.has(item.id)
      }))
    });

    this.syncSelectionState();
  },

  syncSelectionState() {
    if (!this.data.manageMode) {
      return;
    }

    const list = this.getListByType(this.data.activeTab);
    const listIds = new Set(list.map(item => item.id));
    const validSelected = this.data.selectedIds
      .filter(id => listIds.has(id));

    this.setData({
      selectedIds: validSelected,
      selectedCount: validSelected.length,
      allSelected: Boolean(list.length) && validSelected.length === list.length
    });
  },

  batchDelete() {
    if (!this.data.manageMode || !this.data.selectedIds.length) {
      return;
    }

    const ids = this.data.selectedIds.slice();
    const isHistory = this.data.activeTab === 'history';
    const count = ids.length;

    wx.showModal({
      title: `删除选中的 ${count} 条${isHistory ? '记录' : '收藏'}？`,
      content: isHistory
        ? '仅删除这些阅读记录，不会影响已经收藏的新闻。'
        : '取消收藏后，相关新闻仍会保留在最近阅读中。',
      confirmText: '删除',
      confirmColor: '#C85B52',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        if (isHistory) {
          common.removeHistories(ids);
        } else {
          common.removeFavorites(ids);
        }

        this.setData({
          manageMode: false,
          selectedIds: [],
          selectedCount: 0,
          allSelected: false,
          favorites: this.decorateFavoriteList(),
          history: this.decorateHistoryList()
        });

        wx.showToast({
          title: `已删除 ${count} 条`,
          icon: 'none',
          duration: 900
        });
      }
    });
  },

  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
