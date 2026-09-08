function getExt(filePath) {
  const pure = String(filePath || '').split('?')[0]
  const match = pure.match(/\.([a-zA-Z0-9]+)$/)
  return match ? `.${match[1].toLowerCase()}` : '.jpg'
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10)
}

function compressImage(filePath) {
  return new Promise(resolve => {
    if (!wx.compressImage) {
      resolve(filePath)
      return
    }

    wx.compressImage({
      src: filePath,
      quality: 82,
      success: res => resolve(res.tempFilePath || filePath),
      fail: () => resolve(filePath)
    })
  })
}

async function uploadImages(localPaths, openid) {
  const uploaded = []
  try {
  for (let i = 0; i < localPaths.length; i += 1) {
    const compressed = await compressImage(localPaths[i])
    const ext = getExt(compressed)
    const cloudPath = `posts/${openid}/${Date.now()}_${i}_${randomToken()}${ext}`
    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath: compressed
    })
    uploaded.push(res.fileID)
  }
  return uploaded
  } catch (err) {
    // A later upload can fail before the caller receives the partial list.
    await deleteCloudFiles(uploaded)
    throw err
  }
}

async function uploadAvatar(localPath, openid) {
  const compressed = await compressImage(localPath)
  const ext = getExt(compressed)
  const cloudPath = `avatars/${openid}/${Date.now()}_${randomToken()}${ext}`
  const res = await wx.cloud.uploadFile({
    cloudPath,
    filePath: compressed
  })
  return res.fileID
}

function deleteCloudFiles(fileList) {
  const files = (fileList || []).filter(Boolean)
  if (!files.length) return Promise.resolve()
  return wx.cloud.deleteFile({ fileList: files }).catch(err => {
    console.warn('清理云文件失败', err)
  })
}

module.exports = {
  uploadImages,
  uploadAvatar,
  deleteCloudFiles
}
