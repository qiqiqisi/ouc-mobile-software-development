const { LEVELS } = require('../../data/levels')
const { getProgress } = require('../../utils/storage')

function buildPreview(map) {
  return map.map((row, rowIndex) => ({
    id: rowIndex,
    cells: row.map((value, cellIndex) => ({
      id: cellIndex,
      value
    }))
  }))
}

Page({
  data: {
    levels: [],
    passedCount: 0,
    progressDots: [],
    continueLevelId: 1,
    continueText: '开始作案'
  },

  onShow() {
    this.navigating = false
    this.refresh()
  },

  refresh() {
    const progress = getProgress()
    let passedCount = 0
    let continueLevelId = 1

    const levels = LEVELS.map((level) => {
      const saved = progress.levels[level.id] || {}
      const passed = Boolean(saved.passed)
      const isOptimal = passed && saved.bestSteps === level.optimalSteps

      if (passed) {
        passedCount += 1
      }

      let statusText = '尚未作案'
      let statusClass = 'status-idle'

      if (isOptimal) {
        statusText = '★ 猫界标准答案'
        statusClass = 'status-perfect'
      } else if (passed) {
        statusText = '✓ 已处理 · BEST ' + saved.bestSteps
        statusClass = 'status-passed'
      }

      return {
        ...level,
        preview: buildPreview(level.map),
        passed,
        bestSteps: saved.bestSteps,
        statusText,
        statusClass
      }
    })

    const firstUnpassed = levels.find((item) => !item.passed)
    if (firstUnpassed) {
      continueLevelId = firstUnpassed.id
    } else {
      continueLevelId = 4
    }

    this.setData({
      levels,
      passedCount,
      continueLevelId,
      continueText: passedCount > 0 ? '继续营业' : '开始作案',
      progressDots: levels.map((item) => ({
        id: item.id,
        done: item.passed
      }))
    })
  },

  startContinue() {
    this.goLevel(this.data.continueLevelId)
  },

  chooseLevel(event) {
    const levelId = Number(event.currentTarget.dataset.level)
    this.goLevel(levelId)
  },

  goLevel(levelId) {
    if (this.navigating) return
    this.navigating = true

    wx.navigateTo({
      url: '/pages/game/game?level=' + levelId,
      fail: () => {
        this.navigating = false
      }
    })
  },

  openSolutions() {
    wx.navigateTo({
      url: '/pages/solutions/solutions'
    })
  }
})
