import {
  getPersonality
} from "../config/personalities.js"

import {
  getById,
  getLatest
} from "../services/reports.js"

import {
  listByRange
} from "../services/records.js"

import {
  createSnapshot,
  drawWordCloud
} from "../services/wordcloud.js"

import {
  formatDisplayDate
} from "../shared/date.js"

import {
  getQuery,
  goBack
} from "../shared/ui.js"


let wordCloudSnapshot = null
let wordCloudVariant = 0
let wordCloudResizeObserver = null
let wordCloudResizeTimer = 0


function setHidden(element, hidden) {
  element.classList.toggle("is-hidden", hidden)
}


function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "")
}


function getWordCloudSubtitle(
  validDays,
  wordCount,
  legacy,
  reconstructable
) {
  if (!reconstructable) {
    return "旧结果没有保存检测范围，无法可靠重建词云。"
  }

  if (validDays === 0) {
    return legacy
      ? "旧结果当时还没有保存词云，目前也找不到对应记录。"
      : "没有记录，词云也只能表演留白。"
  }

  let text =
    `从 ${validDays} 个记录日里捞出了 ${wordCount} 个词`

  if (validDays <= 2) {
    text += " · 记录较少，看个热闹"
  }

  if (legacy) {
    text += " · 旧结果按当前记录补生成"
  }

  return text
}


function prepareWordCloud(report) {
  if (
    report.wordCloud &&
    Array.isArray(report.wordCloud.words)
  ) {
    const snapshot = {
      ...report.wordCloud,
      validDays:
        Number(report.wordCloud.validDays) || 0
    }

    return {
      snapshot,
      subtitle: getWordCloudSubtitle(
        snapshot.validDays,
        snapshot.words.length,
        false,
        true
      )
    }
  }

  if (
    !isDateString(report.startDate) ||
    !isDateString(report.endDate) ||
    report.startDate > report.endDate
  ) {
    return {
      snapshot: {
        version: "wordcloud-v1.0",
        baseSeed: 0,
        validDays: 0,
        includeNote: true,
        words: []
      },
      subtitle: getWordCloudSubtitle(
        0,
        0,
        true,
        false
      )
    }
  }

  const records = listByRange(
    report.startDate,
    report.endDate
  )
  const snapshot = createSnapshot(
    records,
    {
      startDate: report.startDate,
      endDate: report.endDate,
      includeNote: true
    }
  )

  return {
    snapshot,
    subtitle: getWordCloudSubtitle(
      snapshot.validDays,
      snapshot.words.length,
      true,
      true
    )
  }
}


function drawCurrentWordCloud() {
  if (
    !wordCloudSnapshot ||
    !wordCloudSnapshot.words.length
  ) {
    return
  }

  const card = document.querySelector(
    "#wordcloud-card"
  )
  const canvas = document.querySelector(
    "#wordcloud-canvas"
  )
  const errorBox = document.querySelector(
    "#wordcloud-error"
  )
  const width = card.clientWidth
  const height = clampWordCloudHeight(width)

  if (!width || !height) {
    return
  }

  card.style.height = `${height}px`

  try {
    const result = drawWordCloud(
      canvas,
      wordCloudSnapshot,
      {
        width,
        height,
        dpr: Math.min(
          Number(window.devicePixelRatio) || 1,
          3
        ),
        variant: wordCloudVariant
      }
    )

    setHidden(errorBox, result.placedCount > 0)
  } catch (error) {
    console.error("词云绘制失败：", error)
    setHidden(errorBox, false)
  }
}


function clampWordCloudHeight(width) {
  return Math.max(
    250,
    Math.min(310, Math.round(width * 0.78))
  )
}


function initializeWordCloud(report) {
  const info = prepareWordCloud(report)
  const hasWords = info.snapshot.words.length > 0
  const card = document.querySelector("#wordcloud-card")
  const empty = document.querySelector("#wordcloud-empty")
  const refresh = document.querySelector("#wordcloud-refresh")
  const note = document.querySelector("#wordcloud-note")

  wordCloudSnapshot = info.snapshot
  wordCloudVariant = 0
  document.querySelector(
    "#wordcloud-subtitle"
  ).textContent = info.subtitle
  setHidden(card, !hasWords)
  setHidden(empty, hasWords)
  setHidden(refresh, !hasWords)
  setHidden(note, !hasWords)

  if (!hasWords) {
    return
  }

  refresh.addEventListener("click", () => {
    wordCloudVariant += 1
    drawCurrentWordCloud()
  })

  requestAnimationFrame(drawCurrentWordCloud)

  if (typeof ResizeObserver === "function") {
    wordCloudResizeObserver = new ResizeObserver(() => {
      window.clearTimeout(wordCloudResizeTimer)
      wordCloudResizeTimer = window.setTimeout(
        drawCurrentWordCloud,
        90
      )
    })
    wordCloudResizeObserver.observe(card)
  } else {
    window.addEventListener("resize", () => {
      window.clearTimeout(wordCloudResizeTimer)
      wordCloudResizeTimer = window.setTimeout(
        drawCurrentWordCloud,
        90
      )
    })
  }
}


function showMissingReport() {
  document.querySelector(
    "#missing-report"
  ).classList.remove("is-hidden")
}


function renderReport(
  report,
  personality
) {
  document.querySelector(
    "#result-content"
  ).classList.remove("is-hidden")

  document.querySelector(
    "#date-range"
  ).textContent =
    `${formatDisplayDate(report.startDate)} - ${formatDisplayDate(report.endDate)}`

  document.querySelector(
    "#personality-name"
  ).textContent = personality.name

  document.querySelector(
    "#personality-code"
  ).textContent = personality.code

  const personalityImage =
    document.querySelector(
      "#personality-image"
    )

  personalityImage.src =
    personality.image
  personalityImage.alt =
    `${personality.name} 人格插画`

  document.querySelector(
    "#personality-tagline"
  ).textContent = personality.tagline

  const rawCoverageRate =
    typeof report.coverageRate ===
      "number"
      ? report.coverageRate
      : report.validDays /
        report.rangeDays

  const coverageRate =
    Math.max(
      0,
      Math.min(
        1,
        Number.isFinite(rawCoverageRate)
          ? rawCoverageRate
          : 0
      )
    )

  let confidenceText =
    `有效记录 ${report.validDays} 天` +
    ` · 数据覆盖 ${Math.round(coverageRate * 100)}%`

  if (
    typeof report.score ===
    "number"
  ) {
    confidenceText +=
      ` · 匹配 ${Math.round(report.score)}%`
  }

  document.querySelector(
    "#confidence"
  ).textContent = confidenceText

  const description =
    document.querySelector(
      "#description"
    )

  personality.description.forEach(
    paragraphText => {
      const paragraph =
        document.createElement("p")

      paragraph.className =
        "paragraph"
      paragraph.textContent =
        paragraphText
      description.appendChild(paragraph)
    }
  )

  const keywords =
    document.querySelector(
      "#keywords"
    )

  personality.keywords.forEach(
    keywordText => {
      const keyword =
        document.createElement("span")

      keyword.className = "keyword"
      keyword.textContent = keywordText
      keywords.appendChild(keyword)
    }
  )

  document.querySelector(
    "#system-comment"
  ).textContent =
    personality.systemComment

  initializeWordCloud(report)
}


function initialize() {
  document.querySelector(
    ".page-back"
  ).addEventListener(
    "click",
    () => goBack()
  )

  const reportId =
    getQuery().get("reportId")

  const report =
    reportId
      ? getById(reportId)
      : getLatest()

  if (!report) {
    showMissingReport()
    return
  }

  const personality =
    getPersonality(report.code)

  if (!personality) {
    console.error(
      "找不到人格配置：",
      report.code
    )
    showMissingReport()
    return
  }

  renderReport(
    report,
    personality
  )
}


initialize()
