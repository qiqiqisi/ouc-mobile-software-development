const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const posts = db.collection('posts')
const users = db.collection('users')
const social = require('./social')(db, ensureUser)

const CATEGORY_SET = new Set(['errand', 'course', 'lost', 'scenery', 'other'])
const STATUS_CATEGORY_SET = new Set(['errand', 'lost'])

function ok(data) {
  return { ok: true, data }
}

function fail(message, code = 'BAD_REQUEST') {
  return { ok: false, message, code }
}

function text(value, max) {
  return String(value || '').trim().slice(0, max)
}

function validImageList(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => typeof item === 'string' && item.startsWith('cloud://'))
    .slice(0, 3)
}

function ownsFile(fileID, folder, openid) {
  if (typeof fileID !== 'string' || !fileID.startsWith('cloud://')) return false
  const parts = fileID.slice(8).split('/')
  return parts.length >= 4 && parts[1] === folder && parts[2] === openid && !parts.includes('..')
}

async function ensureUser(openid) {
  try {
    const res = await users.doc(openid).get()
    return res.data
  } catch (err) {
    if (!/document.*(not exist|not found)|DOCUMENT_NOT_FOUND|DATABASE_DOCUMENT_NOT_EXIST/i.test(err.errMsg || err.message || '')) throw err
    const now = db.serverDate()
    const initial = {
      openid,
      nickname: '海大同学',
      avatarFileID: '',
      createdAt: now,
      updatedAt: now
    }
    try {
      await users.add({ data: { _id: openid, ...initial } })
      const created = await users.doc(openid).get()
      return created.data
    } catch (createErr) {
      const retry = await users.doc(openid).get()
      return retry.data
    }
  }
}

async function listPosts(event, openid) {
  const category = event.category === 'all' ? '' : text(event.category, 20)
  const authorOpenid = text(event.authorOpenid, 128)
  const status = text(event.status, 20)
  const page = Math.max(0, Math.floor(Number(event.page) || 0))
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(event.pageSize) || 20)))

  const conditions = {}
  if (category) {
    if (!CATEGORY_SET.has(category)) return fail('分类不存在')
    conditions.category = category
  }
  if (authorOpenid) conditions.authorOpenid = authorOpenid
  if (status) conditions.status = status

  let query = Object.keys(conditions).length ? posts.where(conditions) : posts
  const res = await query
    .orderBy('createdAt', 'desc')
    .orderBy('_id', 'desc')
    .skip(page * pageSize)
    .limit(pageSize + 1)
    .get()

  const items = res.data.slice(0, pageSize)
  return ok({
    items: await social.decoratePosts(items, openid),
    hasMore: res.data.length > pageSize
  })
}

async function getPost(event, openid) {
  const postId = text(event.postId, 128)
  if (!postId) return fail('缺少帖子 ID')
  try {
    const res = await posts.doc(postId).get()
    const decorated = await social.decoratePosts([res.data], openid)
    // Browsing history is ancillary: an unavailable history collection must not hide the post.
    let historySaved = true
    try { await social.recordHistory(postId, openid) } catch (err) { historySaved = false; console.warn('浏览记录保存失败', err) }
    return ok({ ...decorated[0], historySaved })
  } catch (err) {
    if (/document.*(not exist|not found)|DOCUMENT_NOT_FOUND|DATABASE_DOCUMENT_NOT_EXIST/i.test(err.errMsg || err.message || '')) return fail('帖子不存在', 'NOT_FOUND')
    throw err
  }
}

async function createPost(event, openid) {
  const input = event.post || {}
  const category = text(input.category, 20)
  const title = text(input.title, 30)
  const content = text(input.content, 500)
  const location = text(input.location, 30)
  const contact = text(input.contact, 50)
  const images = validImageList(input.images)
  const coverFileID = text(input.coverFileID, 500)
  const coverIndex = Math.floor(Number(input.coverIndex))

  if (!CATEGORY_SET.has(category)) return fail('请选择正确的分类')
  if (!title) return fail('标题不能为空')
  if (category === 'scenery' && images.length === 0) return fail('风景帖至少需要1张图片')
  if (images.length > 0) {
    if (!images.every(fileID => ownsFile(fileID, 'posts', openid))) return fail('只能使用自己上传的图片')
    if (!coverFileID || images[coverIndex] !== coverFileID) return fail('封面与图片索引不一致')
    if (!Number.isInteger(coverIndex) || coverIndex < 0 || coverIndex >= images.length) {
      return fail('封面索引无效')
    }
  }

  const user = await ensureUser(openid)
  const now = db.serverDate()
  const data = {
    authorOpenid: openid,
    author: {
      nickname: user.nickname || '海大同学',
      avatarFileID: user.avatarFileID || ''
    },
    category,
    title,
    content,
    images,
    coverFileID: images.length ? coverFileID : '',
    coverIndex: images.length ? coverIndex : -1,
    location,
    contact,
    status: STATUS_CATEGORY_SET.has(category) ? 'open' : 'none',
    likeCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    createdAt: now,
    updatedAt: now
  }

  const res = await posts.add({ data })
  return ok({ postId: res._id })
}

async function updateStatus(event, openid) {
  const postId = text(event.postId, 128)
  const status = text(event.status, 20)
  if (!postId) return fail('缺少帖子 ID')
  if (!['open', 'resolved'].includes(status)) return fail('状态无效')

  let post
  try {
    post = (await posts.doc(postId).get()).data
  } catch (err) {
    return fail('帖子不存在', 'NOT_FOUND')
  }

  if (post.authorOpenid !== openid) return fail('无权修改该帖子', 'FORBIDDEN')
  if (!STATUS_CATEGORY_SET.has(post.category)) return fail('该分类没有解决状态')

  await posts.doc(postId).update({
    data: {
      status,
      updatedAt: db.serverDate()
    }
  })

  return ok({ status })
}

async function deletePost(event, openid) {
  const postId = text(event.postId, 128)
  if (!postId) return fail('缺少帖子 ID')

  let post
  try {
    post = (await posts.doc(postId).get()).data
  } catch (err) {
    return fail('帖子不存在', 'NOT_FOUND')
  }

  if (post.authorOpenid !== openid) return fail('无权删除该帖子', 'FORBIDDEN')

  await db.runTransaction(async tx => {
    const current = (await tx.collection('posts').doc(postId).get()).data
    if (current.authorOpenid !== openid) throw Object.assign(new Error('无权删除'), { code: 'FORBIDDEN' })
    const authorRef = tx.collection('users').doc(openid)
    const author = (await authorRef.get()).data
    await tx.collection('posts').doc(postId).remove()
    await authorRef.update({ data: {
      receivedLikes: Math.max(0, (Number(author.receivedLikes) || 0) - (Number(current.likeCount) || 0)),
      receivedFavorites: Math.max(0, (Number(author.receivedFavorites) || 0) - (Number(current.favoriteCount) || 0))
    } })
  })

  const fileList = validImageList(post.images).filter(fileID => ownsFile(fileID, 'posts', openid))
  let storageWarning = ''
  if (fileList.length) {
    try {
      await cloud.deleteFile({ fileList })
    } catch (err) {
      console.warn('删除帖子后清理云文件失败', err)
      storageWarning = '帖子已删除，但部分云文件可能需要稍后清理'
    }
  }

  return ok({ deleted: true, storageWarning })
}

async function updateProfile(event, openid) {
  const input = event.profile || {}
  const nickname = text(input.nickname, 20)
  const avatarFileID = text(input.avatarFileID, 500)

  if (!nickname) return fail('昵称不能为空')
  if (avatarFileID && !avatarFileID.startsWith('cloud://')) return fail('头像地址无效')

  const old = await ensureUser(openid)
  if (avatarFileID && avatarFileID !== old.avatarFileID && !ownsFile(avatarFileID, 'avatars', openid)) return fail('只能使用自己上传的头像')
  const data = {
    nickname,
    avatarFileID,
    updatedAt: db.serverDate()
  }

  await users.doc(openid).update({ data })

  // 帖子中保留作者快照，用户更新资料时同步自己的历史帖子。
  let snapshotsSynced = true
  try {
    await posts.where({ authorOpenid: openid }).update({
      data: {
        author: {
          nickname,
          avatarFileID
        },
        updatedAt: db.serverDate()
      }
    })
  } catch (err) {
    snapshotsSynced = false
    console.warn('同步历史帖子作者信息失败', err)
  }

  try {
    await db.collection('comments').where({ openid }).update({ data: { author: { nickname, avatarFileID } } })
  } catch (err) {
    snapshotsSynced = false
    console.warn('同步评论作者信息失败', err)
  }

  if (snapshotsSynced && old.avatarFileID !== avatarFileID && ownsFile(old.avatarFileID, 'avatars', openid)) {
    try {
      await cloud.deleteFile({ fileList: [old.avatarFileID] })
    } catch (err) {
      console.warn('旧头像清理失败', err)
    }
  }

  return ok({ ...old, nickname, avatarFileID })
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return fail('无法识别微信身份', 'UNAUTHORIZED')

    const action = text(event.action, 40)

    if (Object.prototype.hasOwnProperty.call(social.handlers, action)) return await social.handlers[action](event, OPENID)
    if (action === 'listPosts') return await listPosts(event, OPENID)
    if (action === 'getPost') return await getPost(event, OPENID)
    if (action === 'createPost') return await createPost(event, OPENID)
    if (action === 'updateStatus') return await updateStatus(event, OPENID)
    if (action === 'deletePost') return await deletePost(event, OPENID)
    if (action === 'updateProfile') return await updateProfile(event, OPENID)

    return fail('未知操作')
  } catch (err) {
    console.error(err)
    if (err.code && ['BAD_REQUEST', 'FORBIDDEN', 'NOT_FOUND'].includes(err.code)) return fail(err.message, err.code)
    return fail('服务器处理失败，请稍后重试', 'SERVER_ERROR')
  }
}
