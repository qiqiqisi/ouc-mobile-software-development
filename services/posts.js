const api = require('./api')

function listPosts({ category = 'all', page = 0, pageSize = 20, authorOpenid = '', status = '' } = {}) {
  return api.call('listPosts', {
    category,
    page,
    pageSize,
    authorOpenid,
    status
  })
}

function getPost(postId) {
  return api.call('getPost', { postId })
}

function createPost(post) {
  return api.call('createPost', { post })
}

function deletePost(postId) {
  return api.call('deletePost', { postId })
}

function updateStatus(postId, status) {
  return api.call('updateStatus', { postId, status })
}

module.exports = {
  listPosts,
  getPost,
  createPost,
  deletePost,
  updateStatus
}
