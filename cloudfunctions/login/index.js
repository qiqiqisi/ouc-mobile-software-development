const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const users = db.collection('users')

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('OPENID unavailable')
  }

  let user
  try {
    const res = await users.doc(OPENID).get()
    user = res.data
  } catch (err) {
    if (!/document.*(not exist|not found)|DOCUMENT_NOT_FOUND|DATABASE_DOCUMENT_NOT_EXIST/i.test(err.errMsg || err.message || '')) throw err
    const now = db.serverDate()
    const initial = {
      openid: OPENID,
      nickname: '海大同学',
      avatarFileID: '',
      createdAt: now,
      updatedAt: now
    }

    try {
      await users.add({ data: { _id: OPENID, ...initial } })
      const created = await users.doc(OPENID).get()
      user = created.data
    } catch (createErr) {
      // 避免首次启动时多个并发登录造成重复创建异常。
      const retry = await users.doc(OPENID).get()
      user = retry.data
    }
  }

  return {
    openid: OPENID,
    user
  }
}
