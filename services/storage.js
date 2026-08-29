const fs =
  wx.getFileSystemManager()


function getFileExtension(filePath) {
  const match =
    filePath.match(
      /\.[a-zA-Z0-9]+$/
    )

  return match
    ? match[0]
    : ".jpg"
}


function persistTempFile(tempFilePath) {
  const extension =
    getFileExtension(tempFilePath)

  const randomText =
    Math.random()
      .toString(36)
      .slice(2, 8)

  const fileName =
    `bugti_${Date.now()}_${randomText}${extension}`

  const savedPath =
    `${wx.env.USER_DATA_PATH}/${fileName}`

  fs.copyFileSync(
    tempFilePath,
    savedPath
  )

  return savedPath
}


function removeFile(filePath) {
  if (!filePath) {
    return
  }

  if (
    !filePath.startsWith(
      wx.env.USER_DATA_PATH
    )
  ) {
    return
  }

  try {
    fs.unlinkSync(filePath)
  } catch (error) {
    console.warn(
      "删除图片失败：",
      error
    )
  }
}


module.exports = {
  persistTempFile,
  removeFile
}