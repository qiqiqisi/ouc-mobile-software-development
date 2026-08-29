import {
  listByRange
} from "../services/records.js"

import {
  analyze
} from "../services/analyzer.js"

import {
  save
} from "../services/reports.js"

import {
  calculateRangeDays,
  formatLocalDate,
  getTodayString,
  offsetDate
} from "../shared/date.js"

import {
  goBack,
  showToast
} from "../shared/ui.js"


const today = getTodayString()

const startInput =
  document.querySelector(
    "#start-date"
  )

const endInput =
  document.querySelector(
    "#end-date"
  )

let mode = "7d"


function setMode(nextMode) {
  mode = nextMode

  document.querySelectorAll(
    ".mode-item"
  ).forEach(button => {
    button.classList.toggle(
      "mode-active",
      button.dataset.mode === mode
    )
  })
}


function updateStats() {
  const startDate = startInput.value
  const endDate = endInput.value

  const rangeDays =
    startDate &&
    endDate &&
    startDate <= endDate
      ? calculateRangeDays(
        startDate,
        endDate
      )
      : 0

  const records =
    rangeDays > 0
      ? listByRange(
        startDate,
        endDate
      )
      : []

  const validDays = records.length
  const rangeValid =
    rangeDays >= 3 &&
    rangeDays <= 90

  const coverageRate =
    rangeValid
      ? validDays / rangeDays
      : 0

  document.querySelector(
    "#range-days"
  ).textContent = `${rangeDays} 天`

  document.querySelector(
    "#valid-days"
  ).textContent = `${validDays} 天`

  document.querySelector(
    "#coverage-percent"
  ).textContent =
    `${Math.round(coverageRate * 100)}%`

  const tip =
    document.querySelector(
      "#status-tip"
    )

  let tipText
  let warning = false

  if (rangeDays > 90) {
    tipText =
      "自定义检测范围最多 90 天。"
    warning = true
  } else if (rangeDays < 3) {
    tipText =
      "检测范围至少需要 3 天。"
    warning = true
  } else if (validDays < 3) {
    tipText =
      "目前记录还比较少，也可以先测测看。"
    warning = true
  } else if (coverageRate < 0.3) {
    tipText =
      "这段时间记录比较稀疏，结果更多反映你留下记录的那些日子。"
    warning = true
  } else {
    tipText =
      "没有记录的日期视为未知，不会被当成宅家、摸鱼或低电量。"
  }

  tip.textContent = tipText
  tip.classList.toggle(
    "warning",
    warning
  )

  const runButton =
    document.querySelector(
      "#run-analysis"
    )

  runButton.disabled = !rangeValid
  runButton.classList.toggle(
    "is-disabled",
    !rangeValid
  )

  return {
    startDate,
    endDate,
    rangeDays,
    validDays,
    coverageRate,
    rangeValid,
    records
  }
}


function selectMode(nextMode) {
  if (nextMode === "custom") {
    setMode(nextMode)
    return
  }

  const days =
    nextMode === "30d"
      ? 30
      : 7

  const currentDate = new Date()

  startInput.value =
    formatLocalDate(
      offsetDate(
        currentDate,
        -(days - 1)
      )
    )

  endInput.value =
    formatLocalDate(currentDate)

  setMode(nextMode)
  updateStats()
}


function runAnalysis() {
  const stats = updateStats()

  if (
    stats.startDate >
    stats.endDate
  ) {
    showToast(
      "开始日期不能晚于结束日期"
    )
    return
  }

  if (stats.rangeDays < 3) {
    showToast("检测范围至少 3 天")
    return
  }

  if (stats.rangeDays > 90) {
    showToast("检测范围最多 90 天")
    return
  }

  try {
    const result =
      analyze(stats.records)

    const coverageRate =
      result.validDays /
      stats.rangeDays

    const report = save({
      startDate: stats.startDate,
      endDate: stats.endDate,
      rangeDays:
        stats.rangeDays,
      validDays:
        result.validDays,
      coverageRate,
      code: result.code,
      score: result.score,
      algorithmVersion:
        result.algorithmVersion,
      candidates:
        result.candidates,
      gates: result.gates,
      features: result.features
    })

    window.location.href =
      `./result.html?reportId=${encodeURIComponent(report.id)}`
  } catch (error) {
    console.error(
      "人格分析失败：",
      error
    )
    showToast("检测失败，请重试")
  }
}


document.querySelector(
  ".page-back"
).addEventListener(
  "click",
  () => goBack()
)

document.querySelectorAll(
  ".mode-item"
).forEach(button => {
  button.addEventListener(
    "click",
    () => selectMode(
      button.dataset.mode
    )
  )
})

;[
  startInput,
  endInput
].forEach(input => {
  input.max = today
  input.addEventListener(
    "change",
    () => {
      setMode("custom")
      updateStats()
    }
  )
})

document.querySelector(
  "#run-analysis"
).addEventListener(
  "click",
  runAnalysis
)


selectMode("7d")
