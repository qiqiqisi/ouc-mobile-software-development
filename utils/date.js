function toTimestamp(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Date.parse(value)
    return Number.isNaN(n) ? 0 : n
  }
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object') {
    if (value.$date) return Number(value.$date) || Date.parse(value.$date) || 0
    if (value.date) return Number(value.date) || Date.parse(value.date) || 0
  }
  return 0
}

function formatRelative(value) {
  const ts = toTimestamp(value)
  if (!ts) return ''
  const diff = Math.max(0, Date.now() - ts)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < day * 7) return `${Math.floor(diff / day)}天前`

  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${m}-${date}`
}

function formatDateTime(value) {
  const ts = toTimestamp(value)
  if (!ts) return ''
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

module.exports = {
  toTimestamp,
  formatRelative,
  formatDateTime
}
