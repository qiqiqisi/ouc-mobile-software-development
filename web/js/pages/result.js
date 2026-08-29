import {
  getPersonality
} from "../config/personalities.js"

import {
  getById,
  getLatest
} from "../services/reports.js"

import {
  formatDisplayDate
} from "../shared/date.js"

import {
  getQuery,
  goBack
} from "../shared/ui.js"


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
