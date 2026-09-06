const fs =
  wx.getFileSystemManager()

let fileSequence = 0

function getFileExtension(filePath) {
  const match =
    String(filePath || "").match(
      /\.[a-zA-Z0-9]+$/
    )

  return match
    ? match[0]
    : ".jpg"
}


function normalizeExtension(extension) {
  if (!extension) {
    return ""
  }

  return String(extension).startsWith(".")
    ? String(extension)
    : `.${extension}`
}


function normalizePrefix(prefix) {
  const safePrefix =
    String(prefix || "bugti")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 32)

  return safePrefix || "bugti"
}


function persistTempFile(tempFilePath, options = {}) {
  const extension =
    normalizeExtension(
      options.extension
    ) || getFileExtension(tempFilePath)

  const prefix =
    normalizePrefix(
      options.prefix
    )

  const randomText =
    Math.random()
      .toString(36)
      .slice(2, 8)

  const fileName =
    `${prefix}_${Date.now()}_${randomText}_${++fileSequence}${extension}`

  const savedPath =
    `${wx.env.USER_DATA_PATH}/${fileName}`

  try {
    fs.copyFileSync(
      tempFilePath,
      savedPath
    )
  } catch (error) {
    // 复制失败也可能留下不完整文件；不触碰源文件或原有图片。
    removeFile(savedPath)
    throw error
  }

  return savedPath
}


function removeFile(filePath) {
  if (!filePath) {
    return true
  }

  const root = `${wx.env.USER_DATA_PATH}/`
  if (
    !String(filePath).startsWith(root) ||
    String(filePath).slice(root.length).split("/").includes("..")
  ) {
    return false
  }

  try {
    fs.unlinkSync(filePath)
    return true
  } catch (error) {
    if (/ENOENT|no such file|file not exist/i.test(String(error.errMsg || error.message))) {
      return true
    }
    console.warn(
      "删除图片失败：",
      error
    )
    return false
  }
}


module.exports = {
  persistTempFile,
  removeFile
}
