const imageStorage = require("./storage")

const STORAGE_KEY = "bugti_pet_profile_v1"
const ROSTER_KEY = "bugti_pet_roster_v1"
const MAX_NAME_LENGTH = 6
const MAX_PROFILES = 3
const DEFAULT_DISPLAY_SCALE = 1.15
const MIN_DISPLAY_SCALE = 0.75
const MAX_DISPLAY_SCALE = 1.35

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
    return { ok: false, name: "", length: 0, message: "先给监工起个名字" }
  }
  if (length > MAX_NAME_LENGTH) {
    return { ok: false, name: normalized, length, message: "名字需要 1～6 个可见字符" }
  }
  return { ok: true, name: normalized, length, message: "" }
}

function clampDisplayScale(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_DISPLAY_SCALE
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_DISPLAY_SCALE
  return Math.max(MIN_DISPLAY_SCALE, Math.min(MAX_DISPLAY_SCALE, number))
}

function isSuitProfile(profile) {
  return Boolean(
    profile &&
    profile.mode === "suit" &&
    profile.headImage &&
    profile.headTransform &&
    profile.bodySet === "bugti-suit-v1"
  )
}

function normalizeHeadTransform(transform) {
  const source = transform || {}
  const number = (value, fallback, min, max) => {
    const parsed = Number(value)
    return Number.isFinite(parsed)
      ? Math.max(min, Math.min(max, parsed))
      : fallback
  }
  return {
    scale: number(source.scale, 1, 0.5, 2),
    offsetX: number(source.offsetX, 0, -300, 300),
    offsetY: number(source.offsetY, 0, -300, 300),
    rotation: number(source.rotation, 0, -35, 35)
  }
}

function createId() {
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object" || !profile.name) return null
  const suit = isSuitProfile(profile)
  if (!suit && !profile.imagePath) return null
  return {
    ...profile,
    id: profile.id || createId(),
    displayScale: clampDisplayScale(profile.displayScale),
    headTransform: suit ? normalizeHeadTransform(profile.headTransform) : profile.headTransform
  }
}

function readRosterRaw() {
  const roster = wx.getStorageSync(ROSTER_KEY)
  if (!roster || typeof roster !== "object" || !Array.isArray(roster.profiles)) return null
  const profiles = roster.profiles.map(normalizeProfile).filter(Boolean)
  const activeId = profiles.some(item => item.id === roster.activeId)
    ? roster.activeId
    : profiles[0] && profiles[0].id || ""
  return { version: 1, activeId, profiles }
}

function mirrorActive(roster) {
  const active = roster.profiles.find(item => item.id === roster.activeId) || roster.profiles[0] || null
  if (active) wx.setStorageSync(STORAGE_KEY, active)
  else wx.removeStorageSync(STORAGE_KEY)
}

function writeRoster(roster) {
  const normalized = {
    version: 1,
    activeId: roster.activeId || roster.profiles[0] && roster.profiles[0].id || "",
    profiles: roster.profiles.map(normalizeProfile).filter(Boolean).slice(0, MAX_PROFILES)
  }
  if (!normalized.profiles.some(item => item.id === normalized.activeId)) {
    normalized.activeId = normalized.profiles[0] && normalized.profiles[0].id || ""
  }
  wx.setStorageSync(ROSTER_KEY, normalized)
  mirrorActive(normalized)
  return normalized
}

function ensureRoster() {
  const existing = readRosterRaw()
  if (existing) return existing

  const legacy = normalizeProfile(wx.getStorageSync(STORAGE_KEY))
  if (!legacy) return { version: 1, activeId: "", profiles: [] }
  return writeRoster({ version: 1, activeId: legacy.id, profiles: [legacy] })
}

function getProfiles() {
  return ensureRoster().profiles.map(item => ({ ...item }))
}

function getActiveProfileId() {
  return ensureRoster().activeId || ""
}

function getProfileById(id) {
  if (!id) return null
  return ensureRoster().profiles.find(item => item.id === id) || null
}

function getProfile() {
  const roster = ensureRoster()
  return roster.profiles.find(item => item.id === roster.activeId) || roster.profiles[0] || null
}

function setActiveProfile(id) {
  const roster = ensureRoster()
  if (!roster.profiles.some(item => item.id === id)) throw new Error("没有找到这个监工")
  roster.activeId = id
  writeRoster(roster)
  return getProfile()
}

function saveProfile({
  name,
  tempFilePath,
  displayScale = DEFAULT_DISPLAY_SCALE,
  profileId = "",
  createNew = false
}) {
  const validation = validateName(name)
  if (!validation.ok) throw new Error(validation.message)
  if (!tempFilePath) throw new Error("没有找到抠好的监工图片")

  const roster = ensureRoster()
  const targetId = createNew ? "" : (profileId || roster.activeId)
  const oldProfile = targetId ? roster.profiles.find(item => item.id === targetId) : null
  if (!oldProfile && roster.profiles.length >= MAX_PROFILES) throw new Error(`最多保留 ${MAX_PROFILES} 个监工`)

  let savedPath = ""
  try {
    savedPath = imageStorage.persistTempFile(tempFilePath, {
      prefix: "bugti_monitor",
      extension: ".png"
    })
    const now = new Date().toISOString()
    const profile = {
      version: 3,
      id: oldProfile && oldProfile.id || createId(),
      name: validation.name,
      imagePath: savedPath,
      displayScale: clampDisplayScale(displayScale),
      createdAt: oldProfile && oldProfile.createdAt || now,
      updatedAt: now
    }
    if (oldProfile) {
      roster.profiles = roster.profiles.map(item => item.id === oldProfile.id ? profile : item)
    } else {
      roster.profiles.push(profile)
    }
    if (!roster.activeId) roster.activeId = profile.id
    writeRoster(roster)
    if (oldProfile && oldProfile.imagePath && oldProfile.imagePath !== savedPath) imageStorage.removeFile(oldProfile.imagePath)
    return profile
  } catch (error) {
    if (savedPath) imageStorage.removeFile(savedPath)
    throw error
  }
}

function saveSuitProfile({
  name,
  tempFilePath,
  headTransform,
  displayScale = DEFAULT_DISPLAY_SCALE,
  profileId = "",
  createNew = false
}) {
  const validation = validateName(name)
  if (!validation.ok) throw new Error(validation.message)
  if (!tempFilePath) throw new Error("没有找到抠好的监工头部图片")

  const roster = ensureRoster()
  const targetId = createNew ? "" : (profileId || roster.activeId)
  const oldProfile = targetId ? roster.profiles.find(item => item.id === targetId) : null
  if (!oldProfile && roster.profiles.length >= MAX_PROFILES) throw new Error(`最多保留 ${MAX_PROFILES} 个监工`)

  let savedPath = ""
  try {
    savedPath = imageStorage.persistTempFile(tempFilePath, {
      prefix: "bugti_monitor_head",
      extension: ".png"
    })
    const now = new Date().toISOString()
    const profile = {
      version: 3,
      id: oldProfile && oldProfile.id || createId(),
      mode: "suit",
      name: validation.name,
      headImage: savedPath,
      headTransform: normalizeHeadTransform(headTransform),
      bodySet: "bugti-suit-v1",
      displayScale: clampDisplayScale(displayScale),
      legacyImagePath: oldProfile && !isSuitProfile(oldProfile)
        ? oldProfile.imagePath
        : oldProfile && oldProfile.legacyImagePath || "",
      createdAt: oldProfile && oldProfile.createdAt || now,
      updatedAt: now
    }
    if (oldProfile) roster.profiles = roster.profiles.map(item => item.id === oldProfile.id ? profile : item)
    else roster.profiles.push(profile)
    if (!roster.activeId) roster.activeId = profile.id
    writeRoster(roster)

    if (isSuitProfile(oldProfile) && oldProfile.headImage !== savedPath) imageStorage.removeFile(oldProfile.headImage)
    return profile
  } catch (error) {
    if (savedPath) imageStorage.removeFile(savedPath)
    throw error
  }
}

function renameProfile(name, profileId = "") {
  const roster = ensureRoster()
  const targetId = profileId || roster.activeId
  const profile = roster.profiles.find(item => item.id === targetId)
  if (!profile) throw new Error("还没有设置监工")
  const validation = validateName(name)
  if (!validation.ok) throw new Error(validation.message)
  const updated = { ...profile, version: 3, name: validation.name, updatedAt: new Date().toISOString() }
  roster.profiles = roster.profiles.map(item => item.id === targetId ? updated : item)
  writeRoster(roster)
  return updated
}

function updateDisplayScale(displayScale, profileId = "") {
  const roster = ensureRoster()
  const targetId = profileId || roster.activeId
  const profile = roster.profiles.find(item => item.id === targetId)
  if (!profile) throw new Error("还没有设置监工")
  const updated = {
    ...profile,
    version: 3,
    displayScale: clampDisplayScale(displayScale),
    updatedAt: new Date().toISOString()
  }
  roster.profiles = roster.profiles.map(item => item.id === targetId ? updated : item)
  writeRoster(roster)
  return updated
}

function removeProfile(profileId = "") {
  const roster = ensureRoster()
  const targetId = profileId || roster.activeId
  const profile = roster.profiles.find(item => item.id === targetId)
  if (!profile) return

  const nextProfiles = roster.profiles.filter(item => item.id !== targetId)
  const nextActiveId = roster.activeId === targetId
    ? nextProfiles[0] && nextProfiles[0].id || ""
    : roster.activeId

  writeRoster({ version: 1, activeId: nextActiveId, profiles: nextProfiles })
  const paths = [profile.imagePath, profile.headImage, profile.legacyImagePath]
    .filter((path, index, list) => path && list.indexOf(path) === index)
  const removed = paths.every(path => imageStorage.removeFile(path))
  if (!removed) {
    const rollback = ensureRoster()
    rollback.profiles.push(profile)
    rollback.activeId = roster.activeId
    writeRoster(rollback)
    throw new Error("图片未能删除，监工已保留，请重试")
  }
}

module.exports = {
  MAX_NAME_LENGTH,
  MAX_PROFILES,
  DEFAULT_DISPLAY_SCALE,
  MIN_DISPLAY_SCALE,
  MAX_DISPLAY_SCALE,
  getNameLength,
  getProfile,
  getProfiles,
  getProfileById,
  getActiveProfileId,
  setActiveProfile,
  isSuitProfile,
  saveProfile,
  saveSuitProfile,
  renameProfile,
  updateDisplayScale,
  removeProfile,
  validateName,
  clampDisplayScale,
  normalizeHeadTransform
}
