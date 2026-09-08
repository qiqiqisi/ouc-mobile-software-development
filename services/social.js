const api = require('./api')
const setReaction = (postId, type, active) => api.call('setReaction', { postId, type, active })
const setFollow = (targetOpenid, active) => api.call('setFollow', { targetOpenid, active })
const listLibrary = (type, page = 0) => api.call('listLibrary', { type, page })
const listFollows = (type, page = 0) => api.call('listFollows', { type, page })
const listComments = (postId, page = 0) => api.call('listComments', { postId, page })
const addComment = data => api.call('addComment', data)
const deleteComment = commentId => api.call('deleteComment', { commentId })
const removeHistory = postId => api.call('removeHistory', { postId })
async function clearHistory(before) {
  let result
  do { result = await api.call('clearHistory', { before }) } while (result.hasMore)
  return result
}
module.exports = { setReaction, setFollow, listLibrary, listFollows, listComments, addComment, deleteComment, removeHistory, clearHistory }
