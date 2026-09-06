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


export const STORAGE_KEY =
  "bugti_web_monitor_profile_v2"

export const MIN_DISPLAY_SCALE = 0.75
export const DEFAULT_DISPLAY_SCALE = 1.15
export const MAX_DISPLAY_SCALE = 2
export const MAX_NAME_LENGTH = 6


function normalizeName(name) {
  return String(name || "").trim()
}


export function getNameLength(name) {
  const text = normalizeName(name)
    .replace(/[\u0000-\u001f\u007f\u200b\u200e\u200f\u2060\ufeff]/g, "")

  if (
    typeof Intl !== "undefined" &&
    typeof Intl.Segmenter === "function"
  ) {
    return Array.from(
      new Intl.Segmenter(undefined, {
        granularity: "grapheme"
      }).segment(text)
    ).filter(item =>
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

    if (
      /^[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f\ufe20-\ufe2f]$/.test(character) ||
      (point >= 0x1f3fb && point <= 0x1f3ff)
    ) {
      return
    }

    const regional =
      point >= 0x1f1e6 && point <= 0x1f1ff

    if (
      !joined &&
      (!regional || regionalCount % 2 === 0)
    ) {
      count += 1
    }

    joined = false
    regionalCount = regional
      ? regionalCount + 1
      : 0
  })

  return count
}


export function validateName(name) {
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


export function clampDisplayScale(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
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


export function getProfile() {
  const profile = getJSON(STORAGE_KEY, null)

  if (
    !profile ||
    typeof profile !== "object" ||
    !profile.imageKey ||
    !profile.name
  ) {
    return null
  }

  return {
    version: 2,
    ...profile,
    displayScale:
      clampDisplayScale(profile.displayScale)
  }
}


export async function getProfileImage(profile) {
  if (!profile || !profile.imageKey) {
    return null
  }

  return getImage(profile.imageKey)
}


export async function saveProfile({
  name,
  blob,
  displayScale = DEFAULT_DISPLAY_SCALE
}) {
  const validation = validateName(name)

  if (!validation.ok) {
    throw new Error(validation.message)
  }

  if (!(blob instanceof Blob) || !blob.size) {
    throw new Error("没有找到抠好的监工图片")
  }

  const oldProfile = getProfile()
  let newImageKey = ""

  try {
    const ids = await saveImages([blob])
    newImageKey = ids[0] || ""

    if (!newImageKey) {
      throw new Error("监工图片保存失败")
    }

    const now = new Date().toISOString()
    const profile = {
      version: 2,
      name: validation.name,
      imageKey: newImageKey,
      displayScale:
        clampDisplayScale(displayScale),
      createdAt:
        oldProfile && oldProfile.createdAt
          ? oldProfile.createdAt
          : now,
      updatedAt: now
    }

    if (!setJSON(STORAGE_KEY, profile)) {
      throw new Error("监工设置保存失败")
    }

    if (
      oldProfile &&
      oldProfile.imageKey !== newImageKey
    ) {
      deleteImage(oldProfile.imageKey)
        .catch(error => {
          console.warn("旧监工图片清理失败：", error)
        })
    }

    return profile
  } catch (error) {
    if (newImageKey) {
      try {
        await deleteImage(newImageKey)
      } catch (cleanupError) {
        console.warn("新监工图片回滚失败：", cleanupError)
      }
    }

    throw error
  }
}


export function updateProfile({
  name,
  displayScale
}) {
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
    displayScale:
      clampDisplayScale(displayScale),
    updatedAt: new Date().toISOString()
  }

  if (!setJSON(STORAGE_KEY, updated)) {
    throw new Error("监工设置保存失败")
  }

  return updated
}


export async function removeProfile() {
  const profile = getProfile()

  if (!remove(STORAGE_KEY)) {
    throw new Error("监工设置删除失败")
  }

  if (profile && profile.imageKey) {
    try {
      await deleteImage(profile.imageKey)
    } catch (error) {
      setJSON(STORAGE_KEY, profile)
      throw error
    }
  }
}
