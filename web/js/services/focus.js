import { getJSON, setJSON, remove } from "../shared/storage.js"

export const STORAGE_KEY = "bugti_web_focus_sessions_v1"
export const ACTIVE_KEY = "bugti_web_focus_active_v1"
const MAX_RECORDS = 500

function normalizeDate(date) {
  const text = String(date || "").trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""
}

function readSessions() {
  const raw = getJSON(STORAGE_KEY, [])
  return Array.isArray(raw) ? raw : []
}

export function addSession(input = {}) {
  const date = normalizeDate(input.date)
  if (!date) throw new Error("专注日期无效")
  const actualSeconds = Math.max(0, Math.round(Number(input.actualSeconds) || 0))
  const plannedMinutes = Math.max(1, Math.round(Number(input.plannedMinutes) || 25))
  const item = {
    id: `focus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    planId: String(input.planId || ""),
    planText: String(input.planText || "自由专注").trim().slice(0, 60) || "自由专注",
    petId: String(input.petId || ""),
    petName: String(input.petName || "监工").trim().slice(0, 20) || "监工",
    plannedMinutes,
    actualSeconds,
    actualMinutes: Math.max(0, Math.round(actualSeconds / 60)),
    completed: Boolean(input.completed),
    reason: String(input.reason || (input.completed ? "completed" : "stopped")),
    startedAt: input.startedAt || new Date(Date.now() - actualSeconds * 1000).toISOString(),
    endedAt: input.endedAt || new Date().toISOString()
  }
  const all = readSessions()
  all.push(item)
  if (!setJSON(STORAGE_KEY, all.slice(-MAX_RECORDS))) throw new Error("专注记录保存失败")
  return item
}

export function listByDate(date) {
  const day = normalizeDate(date)
  if (!day) return []
  return readSessions()
    .filter(item => item && item.date === day)
    .sort((a, b) => String(b.endedAt || "").localeCompare(String(a.endedAt || "")))
}

export function summary(date) {
  const items = listByDate(date)
  const totalSeconds = items.reduce((sum, item) => sum + Math.max(0, Number(item.actualSeconds) || 0), 0)
  return {
    date: normalizeDate(date),
    items,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    sessions: items.length,
    completed: items.filter(item => item.completed).length,
    interrupted: items.filter(item => !item.completed).length
  }
}

export function setActive(session) {
  if (!setJSON(ACTIVE_KEY, session || null)) throw new Error("计时状态保存失败")
}

export function getActive() {
  const value = getJSON(ACTIVE_KEY, null)
  return value && typeof value === "object" ? value : null
}

export function clearActive() {
  remove(ACTIVE_KEY)
}
