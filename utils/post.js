const { CATEGORY_MAP, STATUS_LABELS } = require('../config/categories')
const { formatRelative, formatDateTime } = require('./date')

function decoratePost(post) {
  const category = CATEGORY_MAP[post.category] || CATEGORY_MAP.other
  const statusMap = STATUS_LABELS[post.category] || {}
  return {
    ...post,
    likeCount: Math.max(0, Number(post.likeCount) || 0),
    favoriteCount: Math.max(0, Number(post.favoriteCount) || 0),
    commentCount: Math.max(0, Number(post.commentCount) || 0),
    liked: Boolean(post.liked),
    favorited: Boolean(post.favorited),
    categoryLabel: category.label,
    categoryIcon: category.icon,
    categoryTone: category.tone,
    timeText: formatRelative(post.createdAt),
    dateTimeText: formatDateTime(post.createdAt),
    statusText: statusMap[post.status] || '',
    author: post.author || {
      nickname: '海大同学',
      avatarFileID: ''
    },
    coverFileID: post.coverFileID || '',
    images: Array.isArray(post.images) ? post.images : []
  }
}

module.exports = { decoratePost }
