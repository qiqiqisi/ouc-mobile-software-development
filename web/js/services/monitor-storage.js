import {
  saveImages,
  getImage,
  deleteImage
} from "./image-store.js"

import {
  getJSON,
  setJSON,
  remove
} from "../shared/storage.js"


export const STORAGE_KEY = "bugti_web_monitor_profile_v2"
export const ROSTER_KEY = "bugti_web_pet_roster_v1"
export const MIN_DISPLAY_SCALE = 0.75
export const DEFAULT_DISPLAY_SCALE = 1.15
export const MAX_DISPLAY_SCALE = 1.35
export const MAX_NAME_LENGTH = 6
export const MAX_PROFILES = 3


function normalizeName(name) {
  return String(name || "").trim()
}


export function getNameLength(name) {
  const text = normalizeName(name)
    .replace(/[\u0000-\u001f\u007f\u200b\u200e\u200f\u2060\ufeff]/g, "")

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, {
      granularity: "grapheme"
    }).segment(text)).filter(item =>
      item.segment.replace(/[\u200d\ufe0e\ufe0f]/g, "")
    ).length
  }

  let count = 0
  let joined = false
  let regionalCount = 0
  Array.from(text).forEach(character => {
    const point = character.codePointAt(0)
    if (point === 0x200d) {
      joined = count > 0
      return
    }
    if (/^[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f\ufe20-\ufe2f]$/.test(character) ||
        (point >= 0x1f3fb && point <= 0x1f3ff)) {
      return
    }
    const regional = point >= 0x1f1e6 && point <= 0x1f1ff
    if (!joined && (!regional || regionalCount % 2 === 0)) count += 1
    joined = false
    regionalCount = regional ? regionalCount + 1 : 0
  })
  return count
}


export function validateName(name) {
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


export function clampDisplayScale(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_DISPLAY_SCALE
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_DISPLAY_SCALE
  return Math.max(MIN_DISPLAY_SCALE, Math.min(MAX_DISPLAY_SCALE, number))
}


export function normalizeHeadTransform(transform = {}) {
  const safe = (value, fallback, min, max) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
  }
  return {
    scale: safe(transform.scale, 1, 0.5, 2),
    offsetX: safe(transform.offsetX, 0, -300, 300),
    offsetY: safe(transform.offsetY, 0, -300, 300),
    rotation: safe(transform.rotation, 0, -35, 35)
  }
}


function createId() {
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}


function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object" || !profile.name || !profile.imageKey) return null
  return {
    ...profile,
    version: 3,
    id: profile.id || createId(),
    mode: "suit",
    headTransform: normalizeHeadTransform(profile.headTransform),
    displayScale: clampDisplayScale(profile.displayScale)
  }
}


function normalizeRoster(roster) {
  const profiles = Array.isArray(roster && roster.profiles)
    ? roster.profiles.map(normalizeProfile).filter(Boolean).slice(0, MAX_PROFILES)
    : []
  const activeId = profiles.some(item => item.id === roster.activeId)
    ? roster.activeId
    : (profiles[0] && profiles[0].id) || ""
  return { version: 1, activeId, profiles }
}


function saveRoster(roster) {
  const normalized = normalizeRoster(roster)
  if (!setJSON(ROSTER_KEY, normalized)) throw new Error("监工设置保存失败")
  const active = normalized.profiles.find(item => item.id === normalized.activeId) || null
  if (active) setJSON(STORAGE_KEY, active)
  else remove(STORAGE_KEY)
  return normalized
}


function readRoster() {
  const stored = getJSON(ROSTER_KEY, null)
  if (stored && Array.isArray(stored.profiles)) return normalizeRoster(stored)
  const legacy = normalizeProfile(getJSON(STORAGE_KEY, null))
  if (!legacy) return { version: 1, activeId: "", profiles: [] }
  return saveRoster({ version: 1, activeId: legacy.id, profiles: [legacy] })
}


export function getProfiles() {
  return readRoster().profiles.map(item => ({ ...item }))
}


export function getActiveProfileId() {
  return readRoster().activeId
}


export function getProfileById(id) {
  return readRoster().profiles.find(item => item.id === id) || null
}


export function getProfile() {
  const roster = readRoster()
  return roster.profiles.find(item => item.id === roster.activeId) || roster.profiles[0] || null
}


export function setActiveProfile(id) {
  const roster = readRoster()
  if (!roster.profiles.some(item => item.id === id)) throw new Error("没有找到这个监工")
  roster.activeId = id
  saveRoster(roster)
  return getProfile()
}


export async function getProfileImage(profile) {
  return profile && profile.imageKey ? getImage(profile.imageKey) : null
}


export async function saveProfile({
  name,
  blob,
  displayScale = DEFAULT_DISPLAY_SCALE,
  profileId = "",
  createNew = false,
  headTransform = null
}) {
  const validation = validateName(name)
  if (!validation.ok) throw new Error(validation.message)
  if (!(blob instanceof Blob) || !blob.size) throw new Error("没有找到抠好的监工图片")

  const roster = readRoster()
  const targetId = createNew ? "" : (profileId || roster.activeId)
  const oldProfile = roster.profiles.find(item => item.id === targetId) || null
  if (!oldProfile && roster.profiles.length >= MAX_PROFILES) {
    throw new Error(`最多保留 ${MAX_PROFILES} 个监工`)
  }

  let newImageKey = ""
  try {
    const ids = await saveImages([blob])
    newImageKey = ids[0] || ""
    if (!newImageKey) throw new Error("监工图片保存失败")
    const now = new Date().toISOString()
    const profile = {
      version: 3,
      id: oldProfile ? oldProfile.id : createId(),
      mode: "suit",
      name: validation.name,
      imageKey: newImageKey,
      headTransform: normalizeHeadTransform(headTransform || (oldProfile && oldProfile.headTransform)),
      bodySet: "bugti-suit-v1",
      displayScale: clampDisplayScale(displayScale),
      createdAt: oldProfile && oldProfile.createdAt ? oldProfile.createdAt : now,
      updatedAt: now
    }
    if (oldProfile) roster.profiles = roster.profiles.map(item => item.id === oldProfile.id ? profile : item)
    else roster.profiles.push(profile)
    if (!roster.activeId) roster.activeId = profile.id
    saveRoster(roster)
    if (oldProfile && oldProfile.imageKey !== newImageKey) {
      deleteImage(oldProfile.imageKey).catch(error => console.warn("旧监工图片清理失败：", error))
    }
    return profile
  } catch (error) {
    if (newImageKey) {
      try { await deleteImage(newImageKey) } catch (cleanupError) {
        console.warn("新监工图片回滚失败：", cleanupError)
      }
    }
    throw error
  }
}


export function updateProfile({ name, displayScale, profileId = "", headTransform = null }) {
  const roster = readRoster()
  const targetId = profileId || roster.activeId
  const profile = roster.profiles.find(item => item.id === targetId)
  if (!profile) throw new Error("还没有设置监工")
  const validation = validateName(name)
  if (!validation.ok) throw new Error(validation.message)
  const updated = {
    ...profile,
    name: validation.name,
    displayScale: clampDisplayScale(displayScale),
    headTransform: normalizeHeadTransform(headTransform || profile.headTransform),
    updatedAt: new Date().toISOString()
  }
  roster.profiles = roster.profiles.map(item => item.id === targetId ? updated : item)
  saveRoster(roster)
  return updated
}


export async function removeProfile(profileId = "") {
  const roster = readRoster()
  const targetId = profileId || roster.activeId
  const profile = roster.profiles.find(item => item.id === targetId)
  if (!profile) return
  const nextProfiles = roster.profiles.filter(item => item.id !== targetId)
  const nextActiveId = roster.activeId === targetId
    ? ((nextProfiles[0] && nextProfiles[0].id) || "")
    : roster.activeId
  saveRoster({ version: 1, activeId: nextActiveId, profiles: nextProfiles })
  try {
    await deleteImage(profile.imageKey)
  } catch (error) {
    saveRoster(roster)
    throw error
  }
}
