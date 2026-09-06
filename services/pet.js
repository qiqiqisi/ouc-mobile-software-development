const imageStorage = require("./storage")

const STORAGE_KEY = "bugti_pet_profile_v1"
const MAX_NAME_LENGTH = 6
const DEFAULT_DISPLAY_SCALE = 1.15
const MIN_DISPLAY_SCALE = 0.75
const MAX_DISPLAY_SCALE = 2.00

function normalizeName(name) {
  return String(name || "").trim()
}

function getNameLength(name) {
  const text = normalizeName(name)
    .replace(/[\u0000-\u001f\u007f\u200b\u200e\u200f\u2060\ufeff]/g, "")

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, {
      granularity: "grapheme"
    }).segment(text)).filter(item => item.segment.replace(/[\u200d\ufe0e\ufe0f]/g, "")).length
  }

  // 旧基础库无 Segmenter 时，合并常见组合音标、肤色、ZWJ 表情及旗帜。
  let count = 0
  let joined = false
  let regionalCount = 0
  for (const character of Array.from(text)) {
    const point = character.codePointAt(0)
    if (point === 0x200d) {
      joined = count > 0
      continue
    }
    if (/^[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f\ufe20-\ufe2f]$/.test(character) ||
        (point >= 0x1f3fb && point <= 0x1f3ff)) {
      continue
    }
    const regional = point >= 0x1f1e6 && point <= 0x1f1ff
    if (!joined && (!regional || regionalCount % 2 === 0)) count += 1
    joined = false
    regionalCount = regional ? regionalCount + 1 : 0
  }
  return count
}

function validateName(name) {
  const normalized = normalizeName(name)
  const length = getNameLength(normalized)

  if (!normalized || length === 0) {
    return {
      ok: false,
      name: "",
      length: 0,
      message: "先给监工起个名字"
    }
  }

  if (length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      name: normalized,
      length,
      message: "名字需要 1～6 个可见字符"
    }
  }

  return {
    ok: true,
    name: normalized,
    length,
    message: ""
  }
}

function clampDisplayScale(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_DISPLAY_SCALE
  }
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return DEFAULT_DISPLAY_SCALE
  }

  return Math.max(
    MIN_DISPLAY_SCALE,
    Math.min(MAX_DISPLAY_SCALE, number)
  )
}

function getProfile() {
  const profile = wx.getStorageSync(STORAGE_KEY)

  if (
    !profile ||
    typeof profile !== "object" ||
    !profile.imagePath ||
    !profile.name
  ) {
    return null
  }

  return {
    version: 2,
    ...profile,
    displayScale: clampDisplayScale(
      profile.displayScale
    )
  }
}

function saveProfile({
  name,
  tempFilePath,
  displayScale = DEFAULT_DISPLAY_SCALE
}) {
  const validation = validateName(name)

  if (!validation.ok) {
    throw new Error(validation.message)
  }

  if (!tempFilePath) {
    throw new Error("没有找到抠好的监工图片")
  }

  const oldProfile = getProfile()
  let savedPath = ""
  let profile

  try {
    savedPath = imageStorage.persistTempFile(
      tempFilePath,
      {
        prefix: "bugti_monitor",
        extension: ".png"
      }
    )

    const now = new Date().toISOString()

    profile = {
      version: 2,
      name: validation.name,
      imagePath: savedPath,
      displayScale: clampDisplayScale(displayScale),
      createdAt:
        oldProfile && oldProfile.createdAt
          ? oldProfile.createdAt
          : now,
      updatedAt: now
    }

    wx.setStorageSync(STORAGE_KEY, profile)

  } catch (error) {
    if (savedPath) {
      imageStorage.removeFile(savedPath)
    }

    throw error
  }

  // 提交成功后的旧图清理不能再回滚、删除已生效的新 PNG。
  if (oldProfile && oldProfile.imagePath !== savedPath) {
    imageStorage.removeFile(oldProfile.imagePath)
  }
  return profile
}

function renameProfile(name) {
  const profile = getProfile()

  if (!profile) {
    throw new Error("还没有设置监工")
  }

  const validation = validateName(name)

  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const updated = {
    ...profile,
    version: 2,
    name: validation.name,
    updatedAt: new Date().toISOString()
  }

  wx.setStorageSync(STORAGE_KEY, updated)
  return updated
}

function updateDisplayScale(displayScale) {
  const profile = getProfile()

  if (!profile) {
    throw new Error("还没有设置监工")
  }

  const updated = {
    ...profile,
    version: 2,
    displayScale: clampDisplayScale(displayScale),
    updatedAt: new Date().toISOString()
  }

  wx.setStorageSync(STORAGE_KEY, updated)
  return updated
}

function removeProfile() {
  const profile = getProfile()

  // 配置删除失败时，图片还在。图片删除失败时恢复配置，允许用户重试。
  wx.removeStorageSync(STORAGE_KEY)
  if (profile && !imageStorage.removeFile(profile.imagePath)) {
    wx.setStorageSync(STORAGE_KEY, profile)
    throw new Error("图片未能删除，监工已保留，请重试")
  }
}

module.exports = {
  MAX_NAME_LENGTH,
  DEFAULT_DISPLAY_SCALE,
  MIN_DISPLAY_SCALE,
  MAX_DISPLAY_SCALE,
  getNameLength,
  getProfile,
  saveProfile,
  renameProfile,
  updateDisplayScale,
  removeProfile,
  validateName,
  clampDisplayScale
}
