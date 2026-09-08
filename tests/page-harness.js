const fs = require('fs')
const path = require('path')
const vm = require('vm')
function createHarness(call = async () => ({})) {
  const calls = []; const toasts = []; const navigations = []
  const app = { globalData: { openid: 'alice', user: { nickname: '甲同学' } }, ensureAuth: async () => ({ openid: 'alice', user: { nickname: '甲同学' } }), updateCurrentUser(user) { this.globalData.user = user } }
  const wx = {
    cloud: { callFunction: async options => { calls.push(options); return options.name === 'login' ? { result: { openid: 'alice', user: app.globalData.user } } : { result: { ok: true, data: await call(options.data) } } } },
    showToast: options => toasts.push(options), showLoading() {}, hideLoading() {}, hideKeyboard() {}, stopPullDownRefresh() {},
    setNavigationBarTitle() {}, pageScrollTo() {}, showModal: async () => ({ confirm: true }),
    getWindowInfo: () => ({ statusBarHeight: 24 }), getMenuButtonBoundingClientRect: () => ({ top: 28, height: 32 }),
    navigateTo: options => navigations.push(options.url), switchTab: options => navigations.push(options.url), navigateBack() {}
  }
  const cache = new Map(); let definition
  const load = file => {
    const full = path.resolve(__dirname, '..', file)
    if (cache.has(full)) return cache.get(full).exports
    const mod = { exports: {} }; cache.set(full, mod)
    const source = fs.readFileSync(full, 'utf8')
    vm.runInNewContext(source, {
      module: mod, exports: mod.exports, wx, getApp: () => app,
      Page: value => { definition = value }, Component: value => { definition = value },
      require: relative => load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(full), relative + (path.extname(relative) ? '' : '.js')))),
      console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, Date, Set, Map
    }, { filename: full })
    return mod.exports
  }
  const page = file => {
    load(file)
    const instance = { ...definition, data: structuredClone(definition.data || {}), getTabBar: () => ({ setData() {} }) }
    instance.setData = patch => {
      for (const [key, value] of Object.entries(patch)) {
        const pieces = key.replace(/\[(\d+)\]/g, '.$1').split('.')
        let target = instance.data
        pieces.slice(0, -1).forEach(piece => { target = target[piece] })
        target[pieces[pieces.length - 1]] = value
      }
    }
    return instance
  }
  return { app, wx, load, page, calls, toasts, navigations }
}
module.exports = { createHarness }
