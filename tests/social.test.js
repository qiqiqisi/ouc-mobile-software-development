const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const { createDatabase } = require('./mock-db')
const createSocial = require('../cloudfunctions/campusApi/social')

function fixture() {
  const db = createDatabase({
    users: { alice: { openid: 'alice', nickname: '甲同学' }, bob: { openid: 'bob', nickname: '乙同学' }, eve: { openid: 'eve', nickname: '丙同学' } },
    posts: { p1: { authorOpenid: 'bob', author: { nickname: '乙同学' }, title: '校园风景', content: '', category: 'other', images: [], createdAt: 100 }, p2: { authorOpenid: 'alice', title: '失物招领', category: 'lost', status: 'open', images: [], createdAt: 200 } }
  })
  const social = createSocial(db, async openid => (await db.collection('users').doc(openid).get()).data)
  const cloud = { init() {}, database: () => db, getWXContext: () => ({ OPENID: 'alice' }), deleteFile: async () => ({ fileList: [] }) }
  const exported = {}
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../cloudfunctions/campusApi/index.js'), 'utf8'), {
    require: name => name === 'wx-server-sdk' ? cloud : createSocial,
    exports: exported, console: { log() {}, warn() {}, error() {} }, Set, Map, Date
  })
  return { db, ...social, call: exported.main, cloud }
}

test('点赞设置幂等，重复请求只计一次，取消不产生负数', async () => {
  const { handlers: h, db } = fixture()
  const input = { postId: 'p1', type: 'like', active: true }
  await Promise.all(Array.from({ length: 12 }, () => h.setReaction(input, 'alice')))
  assert.equal(db.inspect().posts.p1.likeCount, 1)
  assert.equal(db.inspect().users.bob.receivedLikes, 1)
  assert.equal(Object.keys(db.inspect().post_reactions).length, 1)
  await h.setReaction({ ...input, active: false }, 'alice')
  await h.setReaction({ ...input, active: false }, 'alice')
  assert.equal(db.inspect().posts.p1.likeCount, 0)
  assert.equal(db.inspect().users.bob.receivedLikes, 0)
})
test('不同用户点赞独立，收藏与点赞独立', async () => {
  const { handlers: h, db, decoratePosts } = fixture()
  await h.setReaction({ postId: 'p1', type: 'like', active: true }, 'alice')
  await h.setReaction({ postId: 'p1', type: 'like', active: true }, 'eve')
  await h.setReaction({ postId: 'p1', type: 'favorite', active: true }, 'alice')
  const own = (await decoratePosts([{ _id: 'p1', ...db.inspect().posts.p1 }], 'alice'))[0]
  const other = (await decoratePosts([{ _id: 'p1', ...db.inspect().posts.p1 }], 'bob'))[0]
  assert.equal(own.likeCount, 2); assert.equal(own.favoriteCount, 1)
  assert.equal(own.liked, true); assert.equal(own.favorited, true)
  assert.equal(other.liked, false); assert.equal(other.favorited, false)
})
test('旧帖子缺少互动字段时按零处理', async () => {
  const { decoratePosts } = fixture()
  const [post] = await decoratePosts([{ _id: 'p1' }], 'alice')
  assert.equal(post.likeCount, 0); assert.equal(post.commentCount, 0); assert.equal(post.favoriteCount, 0)
})
test('无效点赞参数与不存在帖子不会创建关系', async () => {
  const { handlers: h, db } = fixture()
  await assert.rejects(h.setReaction({ postId: 'p1', type: 'like', active: 'true' }, 'alice'), /参数/)
  await assert.rejects(h.setReaction({ postId: 'missing', type: 'like', active: true }, 'alice'), /不存在/)
  assert.equal(Object.keys(db.inspect().post_reactions || {}).length, 0)
})
test('关注不可关注自己，重复关注不重复计数，可取消', async () => {
  const { handlers: h, db } = fixture()
  await assert.rejects(h.setFollow({ targetOpenid: 'alice', active: true }, 'alice'), /自己/)
  await assert.rejects(h.setFollow({ targetOpenid: 'missing', active: true }, 'alice'), /不存在/)
  await Promise.all(Array.from({ length: 8 }, () => h.setFollow({ targetOpenid: 'bob', active: true }, 'alice')))
  assert.equal(db.inspect().users.alice.followingCount, 1)
  assert.equal(db.inspect().users.bob.followerCount, 1)
  assert.equal((await h.getUser({ openid: 'bob' }, 'alice')).data.following, true)
  await h.setFollow({ targetOpenid: 'bob', active: false }, 'alice')
  assert.equal(db.inspect().users.bob.followerCount, 0)
})
test('关注列表与粉丝列表显示当前用户真实关系', async () => {
  const { handlers: h } = fixture()
  await h.setFollow({ targetOpenid: 'bob', active: true }, 'alice')
  await h.setFollow({ targetOpenid: 'alice', active: true }, 'bob')
  const following = await h.listFollows({ type: 'following' }, 'alice')
  const fans = await h.listFollows({ type: 'followers' }, 'alice')
  assert.equal(following.data.items[0].openid, 'bob')
  assert.equal(fans.data.items[0].following, true)
})
test('重复浏览去重，只查询自己的历史，删除帖子不展示', async () => {
  const { recordHistory, handlers: h, db } = fixture()
  await recordHistory('p1', 'alice'); await recordHistory('p1', 'alice'); await recordHistory('p2', 'bob')
  assert.equal(Object.keys(db.inspect().browse_history).length, 2)
  assert.equal((await h.listLibrary({ type: 'history', openid: 'bob' }, 'alice')).data.items.length, 1)
  await db.collection('posts').doc('p1').remove()
  assert.equal((await h.listLibrary({ type: 'history' }, 'alice')).data.items.length, 0)
})
test('收藏列表只展示本人的收藏，取消后消失', async () => {
  const { handlers: h } = fixture()
  await h.setReaction({ postId: 'p1', type: 'favorite', active: true }, 'alice')
  assert.equal((await h.listLibrary({ type: 'favorite' }, 'alice')).data.items[0]._id, 'p1')
  assert.equal((await h.listLibrary({ type: 'favorite' }, 'bob')).data.items.length, 0)
  await h.setReaction({ postId: 'p1', type: 'favorite', active: false }, 'alice')
  assert.equal((await h.listLibrary({ type: 'favorite' }, 'alice')).data.items.length, 0)
})
test('清空历史不影响他人、收藏及确认后的新访问', async () => {
  const { handlers: h, db } = fixture()
  await db.collection('browse_history').doc('old').set({ data: { openid: 'alice', postId: 'p1', viewedAt: 10 } })
  await db.collection('browse_history').doc('new').set({ data: { openid: 'alice', postId: 'p2', viewedAt: 30 } })
  await db.collection('browse_history').doc('other').set({ data: { openid: 'bob', postId: 'p2', viewedAt: 10 } })
  await h.setReaction({ postId: 'p1', type: 'favorite', active: true }, 'alice')
  await h.clearHistory({ before: 20 }, 'alice')
  assert.deepEqual(Object.keys(db.inspect().browse_history).sort(), ['new', 'other'])
  assert.equal(Object.keys(db.inspect().post_reactions).length, 1)
})
test('移除单条历史只操作本人的确定性记录', async () => {
  const { handlers: h, recordHistory } = fixture()
  await recordHistory('p1', 'alice'); await recordHistory('p1', 'bob')
  await h.removeHistory({ postId: 'p1', openid: 'bob' }, 'alice')
  assert.equal((await h.listLibrary({ type: 'history' }, 'alice')).data.items.length, 0)
  assert.equal((await h.listLibrary({ type: 'history' }, 'bob')).data.items.length, 1)
})
test('评论内容校验：空白与超长拒绝，500字接受', async () => {
  const { handlers: h } = fixture()
  const input = { postId: 'p1', requestId: 'request_0001' }
  await assert.rejects(h.addComment({ ...input, content: '  \n ' }, 'alice'), /1～500/)
  await assert.rejects(h.addComment({ ...input, content: '字'.repeat(501) }, 'alice'), /1～500/)
  assert.equal((await h.addComment({ ...input, content: '字'.repeat(500) }, 'alice')).data.comment.content.length, 500)
})
test('评论请求重试幂等，不重复发送或累计评论数', async () => {
  const { handlers: h, db } = fixture()
  const input = { postId: 'p1', content: '海大真好看', requestId: 'request_0002' }
  const results = await Promise.all(Array.from({ length: 8 }, () => h.addComment(input, 'alice')))
  assert.equal(new Set(results.map(r => r.data.comment._id)).size, 1)
  assert.equal(db.inspect().posts.p1.commentCount, 1)
})
test('回复绑定真实评论，拒绝跨帖子回复', async () => {
  const { handlers: h } = fixture()
  const first = (await h.addComment({ postId: 'p1', content: '在哪个校区？', requestId: 'request_first' }, 'alice')).data.comment
  const reply = (await h.addComment({ postId: 'p1', content: '崂山校区', requestId: 'request_reply', replyToId: first._id }, 'bob')).data.comment
  assert.equal(reply.replyToName, '甲同学')
  await assert.rejects(h.addComment({ postId: 'p2', content: '跨帖', requestId: 'request_cross', replyToId: first._id }, 'bob'), /不存在/)
})
test('评论仅本人可删；重复删除不减两次；别人仍可看评论', async () => {
  const { handlers: h, db } = fixture()
  const comment = (await h.addComment({ postId: 'p1', content: '测试', requestId: 'request_delete' }, 'alice')).data.comment
  assert.equal((await h.listComments({ postId: 'p1' }, 'bob')).data.items[0].isMine, false)
  await assert.rejects(h.deleteComment({ commentId: comment._id }, 'bob'), /自己的/)
  await h.deleteComment({ commentId: comment._id }, 'alice'); await h.deleteComment({ commentId: comment._id }, 'alice')
  assert.equal(db.inspect().posts.p1.commentCount, 0)
})
test('评论分页无截断，顺序确定，最后一页 hasMore 为 false', async () => {
  const { handlers: h, db } = fixture()
  for (let i = 0; i < 45; i++) await db.collection('comments').doc(String(i).padStart(3, '0')).set({ data: { postId: 'p1', openid: 'alice', content: '评论' + i, createdAt: 100, author: { nickname: '甲' } } })
  const a = await h.listComments({ postId: 'p1', page: 0 }, 'alice')
  const b = await h.listComments({ postId: 'p1', page: 1 }, 'alice')
  const c = await h.listComments({ postId: 'p1', page: 2 }, 'alice')
  assert.equal(a.data.items.length, 20); assert.equal(c.data.items.length, 5); assert.equal(c.data.hasMore, false)
  assert.equal(new Set(a.data.items.concat(b.data.items, c.data.items).map(i => i._id)).size, 45)
})
test('云函数身份来自微信上下文，伪造 openid 无效', async () => {
  const { call, db, cloud } = fixture()
  await call({ action: 'setReaction', postId: 'p1', type: 'like', active: true, openid: 'bob' })
  assert.equal(Object.values(db.inspect().post_reactions)[0].openid, 'alice')
  cloud.getWXContext = () => ({})
  assert.equal((await call({ action: 'listLibrary', type: 'history' })).code, 'UNAUTHORIZED')
})
test('完整云函数拒绝越权删帖，并更新作者获赞计数', async () => {
  const { call, cloud, db } = fixture()
  await call({ action: 'setReaction', postId: 'p1', type: 'like', active: true })
  assert.equal((await call({ action: 'deletePost', postId: 'p1' })).code, 'FORBIDDEN')
  cloud.getWXContext = () => ({ OPENID: 'bob' })
  assert.equal((await call({ action: 'deletePost', postId: 'p1' })).ok, true)
  assert.equal(db.inspect().users.bob.receivedLikes, 0)
})
test('发布封面必须与索引一致', async () => {
  const { call } = fixture()
  const result = await call({ action: 'createPost', post: { category: 'scenery', title: '封面测试', images: ['cloud://env/posts/alice/a', 'cloud://env/posts/alice/b'], coverIndex: 0, coverFileID: 'cloud://env/posts/alice/b' } })
  assert.equal(result.ok, false)
  assert.match(result.message, /不一致/)
})
test('数据库故障不能被当成空关系覆盖已有互动', async () => {
  const { db } = fixture()
  const original = db.collection.bind(db)
  db.collection = name => name !== 'post_reactions' ? original(name) : { doc: () => ({ get: async () => { throw Object.assign(new Error('network unavailable'), { errCode: -1 }) } }) }
  const social = createSocial(db, async id => ({ openid: id }))
  await assert.rejects(social.handlers.setReaction({ postId: 'p1', type: 'like', active: true }, 'alice'), /network/)
  assert.equal(db.inspect().posts.p1.likeCount, undefined)
})

test('个人笔记超过100条仍可完整分页读取', async () => {
  const { call, db } = fixture()
  for (let i = 0; i < 105; i++) await db.collection('posts').doc('bulk-' + i).set({ data: { authorOpenid: 'alice', title: '历史笔记', category: 'other', createdAt: i } })
  const ids = []; let page = 0; let result
  do { result = await call({ action: 'listPosts', authorOpenid: 'alice', page: page++ }); ids.push(...result.data.items.map(p => p._id)) } while (result.data.hasMore)
  assert.equal(new Set(ids).size, 106)
})

test('资料更新同步帖子和评论作者快照', async () => {
  const { call, handlers: h, db } = fixture()
  await h.addComment({ postId: 'p1', content: '留言', requestId: 'profile_comment' }, 'alice')
  const result = await call({ action: 'updateProfile', profile: { nickname: '海风同学', avatarFileID: '' } })
  assert.equal(result.data.nickname, '海风同学')
  assert.equal(Object.values(db.inspect().comments)[0].author.nickname, '海风同学')
  assert.equal(db.inspect().posts.p2.author.nickname, '海风同学')
})

test('多页清空历史每次最多20条，可以安全重试', async () => {
  const { handlers: h, db } = fixture()
  for (let i = 0; i < 45; i++) await db.collection('browse_history').doc('history-' + i).set({ data: { openid: 'alice', postId: 'p1', viewedAt: 10 } })
  const a = await h.clearHistory({ before: 20 }, 'alice')
  assert.equal(a.data.removed, 20); assert.equal(a.data.hasMore, true)
  await h.clearHistory({ before: 20 }, 'alice')
  const last = await h.clearHistory({ before: 20 }, 'alice')
  assert.equal(last.data.removed, 5); assert.equal(last.data.hasMore, false)
  assert.equal(Object.keys(db.inspect().browse_history).length, 0)
})

test('用户资料读取不泄露浏览记录或收藏列表', async () => {
  const { handlers: h, db } = fixture()
  await db.collection('users').doc('bob').update({ data: { privateContact: '不应返回', recentHistory: ['secret'] } })
  const user = (await h.getUser({ openid: 'bob' }, 'alice')).data
  assert.equal(user.privateContact, undefined); assert.equal(user.recentHistory, undefined); assert.equal(user.isSelf, false)
})

test('发布与头像接口拒绝引用别人的云文件', async () => {
  const { call } = fixture()
  const file = 'cloud://env/posts/bob/photo.jpg'
  const post = await call({ action: 'createPost', post: { category: 'scenery', title: '他人图片', images: [file], coverIndex: 0, coverFileID: file } })
  const avatar = await call({ action: 'updateProfile', profile: { nickname: '甲', avatarFileID: 'cloud://env/avatars/bob/avatar.jpg' } })
  assert.equal(post.ok, false); assert.equal(avatar.ok, false)
})
