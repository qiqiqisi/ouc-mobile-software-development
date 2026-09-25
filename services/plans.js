const STORAGE_KEY = "bugti_daily_plans_v1"
const MAX_ITEMS = 5
const MAX_TEXT_LENGTH = 40

function normalizeDate(date) {
  const text = String(date || "").trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
}

function readStore() {
  const raw = wx.getStorageSync(STORAGE_KEY)
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw
    : {}
}

function writeStore(store) {
  wx.setStorageSync(STORAGE_KEY, store)
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null
  const text = normalizeText(item.text)
  if (!text) return null
  return {
    id: String(item.id || `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    text,
    completed: Boolean(item.completed),
    createdAt: item.createdAt || new Date().toISOString(),
    completedAt: item.completed ? item.completedAt || new Date().toISOString() : "",
    focusMinutes: Math.max(0, Math.round(Number(item.focusMinutes) || 0)),
    focusSessions: Math.max(0, Math.round(Number(item.focusSessions) || 0)),
    focusCompletedSessions: Math.max(0, Math.round(Number(item.focusCompletedSessions) || 0)),
    lastFocusedAt: item.lastFocusedAt || ""
  }
}

function getDay(date) {
  const day = normalizeDate(date)
  if (!day) return { date: "", items: [] }
  const store = readStore()
  const source = store[day]
  const items = source && Array.isArray(source.items)
    ? source.items.map(normalizeItem).filter(Boolean).slice(0, MAX_ITEMS)
    : []
  return { date: day, items }
}

function saveDay(date, items) {
  const day = normalizeDate(date)
  if (!day) throw new Error("计划日期无效")
  const normalized = (Array.isArray(items) ? items : [])
    .map(normalizeItem)
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
  const store = readStore()
  store[day] = {
    items: normalized,
    updatedAt: new Date().toISOString()
  }
  writeStore(store)
  return { date: day, items: normalized }
}

function add(date, text) {
  const normalizedText = normalizeText(text)
  if (!normalizedText) throw new Error("先写一条计划")
  const day = getDay(date)
  if (day.items.length >= MAX_ITEMS) throw new Error(`每天最多 ${MAX_ITEMS} 条计划`)
  const now = new Date().toISOString()
  day.items.push({
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: normalizedText,
    completed: false,
    createdAt: now,
    completedAt: "",
    focusMinutes: 0,
    focusSessions: 0,
    focusCompletedSessions: 0,
    lastFocusedAt: ""
  })
  return saveDay(date, day.items)
}

function toggle(date, id) {
  const day = getDay(date)
  const target = day.items.find(item => item.id === id)
  if (!target) throw new Error("没有找到这条计划")
  target.completed = !target.completed
  target.completedAt = target.completed ? new Date().toISOString() : ""
  return saveDay(date, day.items)
}

function remove(date, id) {
  const day = getDay(date)
  return saveDay(date, day.items.filter(item => item.id !== id))
}


function addFocus(date, id, minutes, completedSession = false) {
  const day = getDay(date)
  const target = day.items.find(item => item.id === id)
  if (!target) return null
  target.focusMinutes = Math.max(0, Math.round((target.focusMinutes || 0) + Math.max(0, Number(minutes) || 0)))
  target.focusSessions = Math.max(0, Math.round((target.focusSessions || 0) + 1))
  if (completedSession) {
    target.focusCompletedSessions = Math.max(0, Math.round((target.focusCompletedSessions || 0) + 1))
  }
  target.lastFocusedAt = new Date().toISOString()
  return saveDay(date, day.items)
}

function summary(date) {
  const day = getDay(date)
  const total = day.items.length
  const completed = day.items.filter(item => item.completed).length
  return {
    ...day,
    total,
    completed,
    pending: Math.max(0, total - completed),
    allDone: total > 0 && completed === total,
    progress: total ? completed / total : 0
  }
}

module.exports = {
  STORAGE_KEY,
  MAX_ITEMS,
  MAX_TEXT_LENGTH,
  getDay,
  add,
  toggle,
  remove,
  addFocus,
  summary
}
