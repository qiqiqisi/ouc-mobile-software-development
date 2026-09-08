const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./page-harness')
const tick = () => new Promise(resolve => setImmediate(resolve))
const post = () => ({ _id: 'p1', authorOpenid: 'bob', author: { nickname: '乙同学' }, category: 'other', title: '测试笔记', images: [], likeCount: 0, favoriteCount: 0, commentCount: 0, liked: false, favorited: false })

test('快速切换分类：后到的旧请求不能覆盖新分类', async () => {
  const pending = {}
  const h = createHarness(data => new Promise(resolve => { pending[data.category] = resolve }))
  const page = h.page('pages/index/index.js')
  const old = page.loadPosts(true); await tick()
  const current = page.onCategoryTap({ currentTarget: { dataset: { key: 'course' } } }); await tick()
  pending.course({ items: [{ ...post(), _id: 'new', category: 'course' }], hasMore: false }); await current
  pending.all({ items: [{ ...post(), _id: 'old' }], hasMore: false }); await old
  assert.equal(page.data.posts[0]._id, 'new'); assert.equal(page.data.activeCategory, 'course'); assert.equal(page.data.loading, false)
})
test('分页网络失败保留已有内容与页码，重试请求同一页', async () => {
  let fail = true
  const h = createHarness(async () => { if (fail) throw new Error('断网'); return { items: [{ ...post(), _id: 'p2' }], hasMore: false } })
  const page = h.page('pages/index/index.js')
  page.setData({ posts: [post()], page: 1 })
  await page.loadPosts(false)
  assert.equal(page.data.posts.length, 1); assert.equal(page.data.page, 1); assert.equal(page.data.errorText, '断网')
  fail = false; await page.onRetry()
  assert.equal(page.data.posts.length, 2); assert.equal(h.calls[1].data.page, 1)
})
test('点赞立即反馈，连点只发一次，失败回滚', async () => {
  let reject
  const h = createHarness(() => new Promise((_, r) => { reject = r }))
  const page = h.page('pages/detail/detail.js'); page.setData({ post: post() })
  const request = page.onLike()
  assert.equal(page.data.post.liked, true); assert.equal(page.data.post.likeCount, 1)
  await page.onLike(); await tick()
  assert.equal(h.calls.length, 1)
  reject(new Error('网络中断')); await request
  assert.equal(page.data.post.liked, false); assert.equal(page.data.post.likeCount, 0); assert.equal(h.toasts.length, 1)
})
test('同时点赞收藏不互相覆盖，首页可增量同步保持分页', async () => {
  const h = createHarness(async data => ({ active: data.active, count: 1 }))
  const page = h.page('pages/detail/detail.js'); page.setData({ post: post() })
  await Promise.all([page.onLike(), page.onFavorite()])
  const update = h.app.globalData.postUpdates.p1
  assert.equal(update.liked, true); assert.equal(update.favorited, true)
  assert.equal(h.app.globalData.refreshHome, undefined)
})
test('评论发送失败保留草稿，重试复用请求 ID，成功清空草稿', async () => {
  let fail = true
  const h = createHarness(async data => {
    if (data.action === 'listComments') return { items: [], hasMore: false }
    if (fail) throw new Error('网络中断')
    return { comment: { _id: 'c1', content: data.content, author: { nickname: '甲同学' }, createdAt: Date.now() }, commentCount: 1 }
  })
  const page = h.page('pages/detail/detail.js'); page.setData({ post: post(), postId: 'p1', commentDraft: '好看！', composerOpen: true })
  await page.onSendComment()
  assert.equal(page.data.commentDraft, '好看！'); assert.equal(page.data.sending, false)
  fail = false; await page.onSendComment()
  const sends = h.calls.filter(c => c.data.action === 'addComment')
  assert.equal(sends[0].data.requestId, sends[1].data.requestId)
  assert.equal(page.data.commentDraft, ''); assert.equal(page.data.composerOpen, false)
})
test('空白评论不发送；回复带上真实评论 ID；取消回复不丢草稿', async () => {
  const h = createHarness(); const page = h.page('pages/detail/detail.js')
  page.setData({ commentDraft: '   ', comments: [{ _id: 'c1', author: { nickname: '乙同学' } }] })
  await page.onSendComment(); assert.equal(h.calls.length, 0)
  page.onReply({ currentTarget: { dataset: { id: 'c1' } } }); assert.equal(page.data.replyToId, 'c1')
  page.setData({ commentDraft: '回复草稿' }); page.onCancelReply()
  assert.equal(page.data.replyToId, ''); assert.equal(page.data.commentDraft, '回复草稿')
})
test('旧评论请求不能覆盖刷新后的列表', async () => {
  const resolves = []
  const h = createHarness(() => new Promise(resolve => resolves.push(resolve)))
  const page = h.page('pages/detail/detail.js'); page.setData({ postId: 'p1' })
  const first = page.loadComments(true); await tick()
  const second = page.loadComments(true); await tick()
  resolves[1]({ items: [{ _id: 'new', createdAt: Date.now() }], hasMore: false }); await second
  resolves[0]({ items: [{ _id: 'old', createdAt: Date.now() }], hasMore: true }); await first
  assert.equal(page.data.comments[0]._id, 'new'); assert.equal(page.data.commentsMore, false)
})
test('无效详情链接显示可恢复错误，不陷入加载状态', () => {
  const h = createHarness(); const page = h.page('pages/detail/detail.js')
  page.onLoad({ id: '%E0%A4%A' })
  assert.equal(page.data.loading, false); assert.match(page.data.errorText, /无效/)
})
test('详情评论、作者主页与历史页导航可达', () => {
  const h = createHarness(); const detail = h.page('pages/detail/detail.js'); detail.setData({ post: post() })
  detail.onAuthorTap()
  const profile = h.page('pages/profile/profile.js'); profile.onHistory(); profile.onRelations({ currentTarget: { dataset: { type: 'followers' } } })
  assert.deepEqual(h.navigations, ['/pages/user/user?openid=bob', '/pages/history/history', '/pages/relations/relations?type=followers'])
})
test('发布校验与封面删除索引修正，发布中禁止更换封面', () => {
  const h = createHarness(); const page = h.page('pages/publish/publish.js')
  assert.match(page.validate(), /标题/)
  page.setData({ title: '标题' }); assert.match(page.validate(), /至少/)
  page.setData({ images: [{ path: 'a' }, { path: 'b' }, { path: 'c' }], coverIndex: 2 })
  page.onRemoveImage({ currentTarget: { dataset: { index: 0 } } }); assert.equal(page.data.coverIndex, 1)
  page.setData({ publishing: true }); page.onSetCover({ currentTarget: { dataset: { index: 0 } } }); assert.equal(page.data.coverIndex, 1)
})
test('多图上传部分失败时回滚已上传文件', async () => {
  const h = createHarness(); let number = 0; let removed = []
  h.wx.cloud.uploadFile = async () => { if (++number === 2) throw new Error('second upload failed'); return { fileID: 'cloud://uploaded-first' } }
  h.wx.cloud.deleteFile = async ({ fileList }) => { removed = fileList }
  const upload = h.load('utils/upload.js')
  await assert.rejects(upload.uploadImages(['a.jpg', 'b.jpg'], 'alice'), /second upload/)
  assert.deepEqual(Array.from(removed), ['cloud://uploaded-first'])
})
test('浏览历史按日期分组，移除不影响其他记录', async () => {
  const h = createHarness(async () => ({ items: [], hasMore: false }))
  const page = h.page('pages/history/history.js')
  page.setData({ posts: [{ ...post(), viewedAt: Date.now() }, { ...post(), _id: 'old', viewedAt: Date.now() - 3 * 86400000 }] })
  page.groupPosts()
  assert.equal(page.data.groups.length, 2); assert.equal(page.data.groups[0].label, '今天')
  page.onManage(); assert.equal(page.data.managing, true)
})
test('关注操作请求失败时不伪装成功，后续可以重试', async () => {
  let fail = true
  const h = createHarness(async () => { if (fail) throw new Error('断网'); return { following: true, followerCount: 1 } })
  const page = h.page('pages/user/user.js'); page.setData({ openid: 'bob', user: { following: false } })
  await page.onFollow(); assert.equal(page.data.user.following, false)
  fail = false; await page.onFollow(); assert.equal(page.data.user.following, true)
})

test('已加载最后一页后刷新失败，重试仍能重新请求第一页', async () => {
  let fail = true
  const h = createHarness(async () => { if (fail) throw new Error('断网'); return { items: [post()], hasMore: false } })
  const page = h.page('pages/index/index.js'); page.setData({ posts: [post()], page: 1, hasMore: false })
  await page.loadPosts(true)
  fail = false; await page.onRetry()
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].data.page, 0); assert.equal(page.data.errorText, '')
})

test('查看更多评论请求下一页，不会重复刷新第一页', async () => {
  const h = createHarness(async data => ({ items: [{ _id: 'c' + data.page, createdAt: Date.now() }], hasMore: data.page === 0 }))
  const page = h.page('pages/detail/detail.js'); page.setData({ postId: 'p1' })
  await page.loadComments(true); await page.onRetryComments()
  assert.equal(h.calls[1].data.page, 1); assert.equal(page.data.comments.length, 2)
})
