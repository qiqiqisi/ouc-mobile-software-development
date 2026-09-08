const api = require('./api')

function getUser(openid) {
  return api.call('getUser', { openid })
}

function updateProfile(profile) {
  return api.call('updateProfile', { profile })
}

module.exports = {
  getUser,
  updateProfile
}
