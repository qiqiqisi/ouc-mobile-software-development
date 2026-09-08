const crypto = require('crypto')

const idFor = (...parts) => crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32)
const count = value => Math.max(0, Number(value) || 0)
const clean = value => typeof value === 'string' ? value.trim() : ''
const publicUser = user => ({
  openid: user.openid || user._id,
  nickname: user.nickname || '海大同学',
  avatarFileID: user.avatarFileID || '',
  followingCount: count(user.followingCount),
  followerCount: count(user.followerCount),
  receivedLikes: count(user.receivedLikes),
  receivedFavorites: count(user.receivedFavorites)
})

function error(message, code = 'BAD_REQUEST') {
  return Object.assign(new Error(message), { code })
}

async function optional(ref) {
  try { return (await ref.get()).data || null } catch (err) {
    // Only a missing document is optional. A network/permission failure must propagate.
    if (/document.*(not exist|not found)|DOCUMENT_NOT_FOUND|DATABASE_DOCUMENT_NOT_EXIST/i.test(err.errMsg || err.message || '')) return null
    throw err
  }
}

module.exports = function createSocial(db, ensureUser) {
  const _ = db.command
  const col = name => db.collection(name)
  const ok = data => ({ ok: true, data })
  const pageArgs = event => ({ page: Math.max(0, Math.floor(Number(event.page) || 0)), size: Math.min(50, Math.max(1, Math.floor(Number(event.pageSize) || 20))) })
  const requirePost = async (postId, source = db) => {
    if (!clean(postId) || postId.length > 128) throw error('帖子标识无效')
    const post = await optional(source.collection('posts').doc(postId))
    if (!post) throw error('帖子已删除或不存在', 'NOT_FOUND')
    return post
  }

  async function decoratePosts(items, openid) {
    if (!items.length) return []
    const ids = items.map(p => p._id)
    const relations = await col('post_reactions').where({ openid, postId: _.in(ids) }).limit(100).get()
    const liked = new Set(relations.data.filter(r => r.type === 'like').map(r => r.postId))
    const saved = new Set(relations.data.filter(r => r.type === 'favorite').map(r => r.postId))
    return items.map(p => ({ ...p, liked: liked.has(p._id), favorited: saved.has(p._id), likeCount: count(p.likeCount), favoriteCount: count(p.favoriteCount), commentCount: count(p.commentCount) }))
  }

  async function setReaction(event, openid) {
    const { postId, type, active } = event
    if (!['like', 'favorite'].includes(type) || typeof active !== 'boolean') throw error('互动参数无效')
    await ensureUser(openid)
    return ok(await db.runTransaction(async tx => {
      const post = await requirePost(postId, tx)
      const ref = tx.collection('post_reactions').doc(idFor(openid, postId, type))
      const existing = await optional(ref)
      const field = type === 'like' ? 'likeCount' : 'favoriteCount'
      const authorField = type === 'like' ? 'receivedLikes' : 'receivedFavorites'
      const delta = Number(active) - Number(Boolean(existing))
      let next = count(post[field])
      if (delta) {
        const authorRef = tx.collection('users').doc(post.authorOpenid)
        const author = await optional(authorRef)
        next = Math.max(0, next + delta)
        if (active) await ref.set({ data: { openid, postId, type, createdAt: Date.now() } })
        else await ref.remove()
        await tx.collection('posts').doc(postId).update({ data: { [field]: next } })
        if (author) await authorRef.update({ data: { [authorField]: Math.max(0, count(author[authorField]) + delta) } })
      }
      return { active, count: next }
    }))
  }

  async function setFollow(event, openid) {
    const targetOpenid = clean(event.targetOpenid)
    if (!targetOpenid || targetOpenid.length > 128 || typeof event.active !== 'boolean') throw error('关注参数无效')
    if (targetOpenid === openid) throw error('不能关注自己')
    await ensureUser(openid)
    return ok(await db.runTransaction(async tx => {
      const sourceRef = tx.collection('users').doc(openid)
      const targetRef = tx.collection('users').doc(targetOpenid)
      const source = await optional(sourceRef)
      const target = await optional(targetRef)
      if (!target || !source) throw error('用户不存在', 'NOT_FOUND')
      const ref = tx.collection('follows').doc(idFor(openid, targetOpenid))
      const existing = await optional(ref)
      const delta = Number(event.active) - Number(Boolean(existing))
      const followerCount = Math.max(0, count(target.followerCount) + delta)
      if (delta) {
        if (event.active) await ref.set({ data: { openid, targetOpenid, createdAt: Date.now() } })
        else await ref.remove()
        await sourceRef.update({ data: { followingCount: Math.max(0, count(source.followingCount) + delta) } })
        await targetRef.update({ data: { followerCount } })
      }
      return { following: event.active, followerCount }
    }))
  }

  async function getUser(event, openid) {
    const target = clean(event.openid) || openid
    const user = await optional(col('users').doc(target))
    if (!user) throw error('用户不存在', 'NOT_FOUND')
    const [following, total] = await Promise.all([
      target === openid ? null : optional(col('follows').doc(idFor(openid, target))),
      col('posts').where({ authorOpenid: target }).count()
    ])
    return ok({ ...publicUser(user), isSelf: target === openid, following: Boolean(following), postCount: total.total })
  }

  async function recordHistory(postId, openid) {
    await col('browse_history').doc(idFor(openid, postId)).set({ data: { openid, postId, viewedAt: Date.now() } })
  }

  async function listLibrary(event, openid) {
    const { page, size } = pageArgs(event)
    if (!['like', 'favorite', 'history'].includes(event.type)) throw error('列表类型无效')
    const history = event.type === 'history'
    const query = col(history ? 'browse_history' : 'post_reactions').where(history ? { openid } : { openid, type: event.type })
    const rows = (await query.orderBy(history ? 'viewedAt' : 'createdAt', 'desc').orderBy('_id', 'desc').skip(page * size).limit(size + 1).get()).data
    const selected = rows.slice(0, size)
    const ids = selected.map(r => r.postId)
    const posts = ids.length ? (await col('posts').where({ _id: _.in(ids) }).limit(100).get()).data : []
    const map = new Map(posts.map(p => [p._id, p]))
    const items = selected.filter(r => map.has(r.postId)).map(r => ({ ...map.get(r.postId), viewedAt: r.viewedAt || 0 }))
    return ok({ items: await decoratePosts(items, openid), hasMore: rows.length > size })
  }

  async function removeHistory(event, openid) {
    const postId = clean(event.postId)
    if (!postId) throw error('缺少帖子标识')
    await col('browse_history').doc(idFor(openid, postId)).remove()
    return ok({ removed: true })
  }

  async function clearHistory(event, openid) {
    // Delete only records visible before the user's confirmation; concurrent new visits survive.
    const before = Number(event.before)
    if (!Number.isFinite(before) || before <= 0 || before > Date.now() + 60000) throw error('清空时间无效')
    let removed = 0
    // Bound each invocation; the client continues until hasMore is false.
    const batch = (await col('browse_history').where({ openid, viewedAt: _.lte(before) }).limit(20).get()).data
    for (const record of batch) {
        const deleted = await db.runTransaction(async tx => {
          const ref = tx.collection('browse_history').doc(record._id)
          const latest = await optional(ref)
          if (latest && latest.openid === openid && latest.viewedAt <= before) { await ref.remove(); return true }
          return false
        })
        if (deleted) removed++
    }
    return ok({ removed, hasMore: batch.length === 20 })
  }

  async function listFollows(event, openid) {
    const { page, size } = pageArgs(event)
    const fans = event.type === 'followers'
    const rows = (await col('follows').where(fans ? { targetOpenid: openid } : { openid }).orderBy('createdAt', 'desc').orderBy('_id', 'desc').skip(page * size).limit(size + 1).get()).data
    const ids = rows.slice(0, size).map(r => fans ? r.openid : r.targetOpenid)
    const people = ids.length ? (await col('users').where({ _id: _.in(ids) }).limit(100).get()).data : []
    const mine = ids.length ? (await col('follows').where({ openid, targetOpenid: _.in(ids) }).limit(100).get()).data : []
    const following = new Set(mine.map(r => r.targetOpenid))
    const map = new Map(people.map(u => [u._id, u]))
    return ok({ items: ids.filter(id => map.has(id)).map(id => ({ ...publicUser(map.get(id)), following: following.has(id) })), hasMore: rows.length > size })
  }

  async function listComments(event, openid) {
    await requirePost(event.postId)
    const { page, size } = pageArgs(event)
    const rows = (await col('comments').where({ postId: event.postId }).orderBy('createdAt', 'desc').orderBy('_id', 'desc').skip(page * size).limit(size + 1).get()).data
    return ok({ items: rows.slice(0, size).map(c => ({ ...c, isMine: c.openid === openid })), hasMore: rows.length > size })
  }

  async function addComment(event, openid) {
    const content = clean(event.content)
    const requestId = clean(event.requestId)
    if (!content || content.length > 500) throw error('评论请输入 1～500 个字')
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) throw error('评论请求标识无效')
    const user = await ensureUser(openid)
    return ok(await db.runTransaction(async tx => {
      const post = await requirePost(event.postId, tx)
      const ref = tx.collection('comments').doc(idFor(openid, event.postId, requestId))
      const existing = await optional(ref)
      if (existing) return { comment: { ...existing, isMine: true }, commentCount: count(post.commentCount) }
      let reply = null
      if (event.replyToId) {
        reply = await optional(tx.collection('comments').doc(clean(event.replyToId)))
        if (!reply || reply.postId !== post._id) throw error('回复的评论已不存在', 'NOT_FOUND')
      }
      const comment = {
        postId: post._id, openid, content, author: { nickname: user.nickname, avatarFileID: user.avatarFileID || '' },
        replyToId: reply ? reply._id : '', replyToName: reply ? reply.author.nickname : '', createdAt: Date.now()
      }
      await ref.set({ data: comment })
      const commentCount = count(post.commentCount) + 1
      await tx.collection('posts').doc(post._id).update({ data: { commentCount } })
      return { comment: { ...comment, _id: idFor(openid, post._id, requestId), isMine: true }, commentCount }
    }))
  }

  async function deleteComment(event, openid) {
    const commentId = clean(event.commentId)
    if (!commentId) throw error('缺少评论标识')
    return ok(await db.runTransaction(async tx => {
      const ref = tx.collection('comments').doc(commentId)
      const comment = await optional(ref)
      if (!comment) return { deleted: true }
      if (comment.openid !== openid) throw error('只能删除自己的评论', 'FORBIDDEN')
      const post = await optional(tx.collection('posts').doc(comment.postId))
      await ref.remove()
      const commentCount = post ? Math.max(0, count(post.commentCount) - 1) : 0
      if (post) await tx.collection('posts').doc(post._id).update({ data: { commentCount } })
      return { deleted: true, commentCount }
    }))
  }

  return { decoratePosts, recordHistory, handlers: { setReaction, setFollow, getUser, listLibrary, removeHistory, clearHistory, listFollows, listComments, addComment, deleteComment } }
}
