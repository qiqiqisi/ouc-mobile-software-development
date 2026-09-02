const STORAGE_KEY = 'hajimiSokobanProgressV1'

function emptyProgress() {
  return {
    version: 1,
    levels: {
      1: { passed: false, bestSteps: null, bestPushes: null },
      2: { passed: false, bestSteps: null, bestPushes: null },
      3: { passed: false, bestSteps: null, bestPushes: null },
      4: { passed: false, bestSteps: null, bestPushes: null }
    }
  }
}

function normalize(raw) {
  const base = emptyProgress()

  if (!raw || typeof raw !== 'object') {
    return base
  }

  for (let id = 1; id <= 4; id += 1) {
    const source = raw.levels && raw.levels[id]
    if (!source) continue

    base.levels[id] = {
      passed: Boolean(source.passed),
      bestSteps: Number.isFinite(source.bestSteps) ? source.bestSteps : null,
      bestPushes: Number.isFinite(source.bestPushes) ? source.bestPushes : null
    }
  }

  return base
}

function getProgress() {
  try {
    return normalize(wx.getStorageSync(STORAGE_KEY))
  } catch (error) {
    return emptyProgress()
  }
}

function saveProgress(progress) {
  try {
    wx.setStorageSync(STORAGE_KEY, progress)
  } catch (error) {
    console.warn('保存游戏进度失败：', error)
  }
}

function saveLevelResult(levelId, steps, pushes) {
  const progress = getProgress()
  const old = progress.levels[levelId] || {
    passed: false,
    bestSteps: null,
    bestPushes: null
  }

  const isNewRecord = old.bestSteps === null || steps < old.bestSteps

  progress.levels[levelId] = {
    passed: true,
    bestSteps: old.bestSteps === null ? steps : Math.min(old.bestSteps, steps),
    bestPushes: old.bestPushes === null ? pushes : Math.min(old.bestPushes, pushes)
  }

  saveProgress(progress)

  return {
    progress,
    isNewRecord,
    bestSteps: progress.levels[levelId].bestSteps,
    bestPushes: progress.levels[levelId].bestPushes
  }
}

module.exports = {
  STORAGE_KEY,
  getProgress,
  saveProgress,
  saveLevelResult
}
