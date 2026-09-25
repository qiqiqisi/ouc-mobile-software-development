const STORAGE_KEY = "bugti_focus_sessions_v1"
const ACTIVE_KEY = "bugti_focus_active_v1"
const MAX_RECORDS = 500

function createId() {
  return `focus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeDate(date) {
  const text = String(date || "").trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""
}

function readSessions() {
  const raw = wx.getStorageSync(STORAGE_KEY)
  return Array.isArray(raw) ? raw : []
}

function writeSessions(items) {
  wx.setStorageSync(STORAGE_KEY, (Array.isArray(items) ? items : []).slice(-MAX_RECORDS))
}

function addSession(input = {}) {
  const date = normalizeDate(input.date)
  if (!date) throw new Error("专注日期无效")
  const actualSeconds = Math.max(0, Math.round(Number(input.actualSeconds) || 0))
  const plannedMinutes = Math.max(1, Math.round(Number(input.plannedMinutes) || 25))
  const item = {
    id: createId(),
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
  writeSessions(all)
  return item
}

function listByDate(date) {
  const day = normalizeDate(date)
  if (!day) return []
  return readSessions()
    .filter(item => item && item.date === day)
    .sort((a, b) => String(b.endedAt || "").localeCompare(String(a.endedAt || "")))
}

function summary(date) {
  const items = listByDate(date)
  const totalSeconds = items.reduce((sum, item) => sum + Math.max(0, Number(item.actualSeconds) || 0), 0)
  const completed = items.filter(item => item.completed).length
  const interrupted = items.filter(item => !item.completed).length
  return {
    date: normalizeDate(date),
    items,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    sessions: items.length,
    completed,
    interrupted
  }
}

function setActive(session) {
  wx.setStorageSync(ACTIVE_KEY, session || null)
}

function getActive() {
  const value = wx.getStorageSync(ACTIVE_KEY)
  return value && typeof value === "object" ? value : null
}

function clearActive() {
  wx.removeStorageSync(ACTIVE_KEY)
}

module.exports = {
  STORAGE_KEY,
  ACTIVE_KEY,
  addSession,
  listByDate,
  summary,
  setActive,
  getActive,
  clearActive
}
