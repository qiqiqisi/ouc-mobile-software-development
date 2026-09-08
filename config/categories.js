const CATEGORIES = [
  { key: 'all', label: '最新' },
  { key: 'errand', label: '跑腿' },
  { key: 'course', label: '选课' },
  { key: 'lost', label: '失物' },
  { key: 'scenery', label: '风景' },
  { key: 'other', label: '其他' }
]

const CATEGORY_MAP = {
  errand: { label: '跑腿', icon: '↗', tone: 'orange' },
  course: { label: '选课', icon: 'A', tone: 'blue' },
  lost: { label: '失物', icon: '?', tone: 'red' },
  scenery: { label: '风景', icon: '≈', tone: 'cyan' },
  other: { label: '其他', icon: '·', tone: 'gray' }
}

const STATUS_LABELS = {
  errand: { open: '进行中', resolved: '已解决' },
  lost: { open: '寻找中', resolved: '已找到' }
}

module.exports = {
  CATEGORIES,
  CATEGORY_MAP,
  STATUS_LABELS
}
