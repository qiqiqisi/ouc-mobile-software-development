const { LEVELS } = require('../../data/levels')
const { getProgress } = require('../../utils/storage')

const ARROWS = {
  U: '↑',
  D: '↓',
  L: '←',
  R: '→'
}

Page({
  data: {
    levels: [],
    expandedLevelId: null,
    passedCount: 0
  },

  onLoad(options) {
    this.focusLevelId = Number(options.level || 0)
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const progress = getProgress()
    let passedCount = 0

    const levels = LEVELS.map((level) => {
      const saved = progress.levels[level.id] || {}
      const passed = Boolean(saved.passed)

      if (passed) {
        passedCount += 1
      }

      return {
        ...level,
        passed,
        bestSteps: saved.bestSteps,
        bestStepsText: Number.isFinite(saved.bestSteps) ? String(saved.bestSteps) : '--',
        solutionMoves: level.solution.split('').map((direction, index) => ({
          id: index,
          arrow: ARROWS[direction],
          direction
        }))
      }
    })

    let expandedLevelId = this.data.expandedLevelId

    if (
      this.focusLevelId &&
      levels.some((item) => item.id === this.focusLevelId && item.passed)
    ) {
      expandedLevelId = this.focusLevelId
      this.focusLevelId = 0
    }

    this.setData({
      levels,
      passedCount,
      expandedLevelId
    })
  },

  toggleLevel(event) {
    const levelId = Number(event.currentTarget.dataset.level)
    const level = this.data.levels.find((item) => item.id === levelId)

    if (!level || !level.passed) {
      wx.showToast({
        title: '你都没过，还想看答案？',
        icon: 'none'
      })
      return
    }

    this.setData({
      expandedLevelId: this.data.expandedLevelId === levelId ? null : levelId
    })
  }
})
