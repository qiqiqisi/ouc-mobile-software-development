import * as recordService from
  "../services/records.js"

import * as reportService from
  "../services/reports.js"

import * as fortuneService from
  "../services/fortune.js"

import {
  getPersonality
} from "../config/personalities.js"

import {
  CARD_BACK_IMAGE,
  getFortuneDisplay
} from "../config/fortunes.js"

import {
  getTodayString
} from "../shared/date.js"

import {
  getQuery,
  shareOrCopy,
  showToast
} from "../shared/ui.js"


const moodEmojis = [
  "",
  "😫",
  "🙁",
  "😐",
  "🙂",
  "😆"
]

const energyEmojis = [
  "",
  "🪫",
  "🔋",
  "⚡"
]


let currentFortune = null
let drawing = false


function wait(milliseconds) {
  return new Promise(
    resolve =>
      window.setTimeout(
        resolve,
        milliseconds
      )
  )
}


function setHidden(element, hidden) {
  element.classList.toggle(
    "is-hidden",
    hidden
  )
}


function loadHomeData() {
  const records =
    recordService.listAll()

  const today =
    getTodayString()

  const todayRecord =
    recordService.getByDate(today)

  const recordedDays =
    records.length

  const todayButton =
    document.querySelector(
      "#today-record-button"
    )

  todayButton.textContent =
    todayRecord
      ? "编辑今日记录"
      : "记录今天"

  const progressNumber =
    document.querySelector(
      "#progress-number"
    )

  progressNumber.textContent =
    `${recordedDays} / 3`

  document.querySelector(
    "#progress-bar"
  ).style.width =
    `${Math.min(100, recordedDays / 3 * 100)}%`

  const progressTip =
    document.querySelector(
      "#progress-tip"
    )

  const ready =
    recordedDays >= 3

  progressTip.textContent =
    ready
      ? "数据够了，可以看看最近运行成什么样。"
      : "目前记录还比较少，也可以先测测看。"

  progressTip.classList.toggle(
    "is-ready",
    ready
  )

  const recentRecord =
    document.querySelector(
      "#recent-record"
    )

  const recordEmpty =
    document.querySelector(
      "#record-empty"
    )

  if (records.length) {
    const record = records[0]

    document.querySelector(
      "#recent-record-date"
    ).textContent = record.date

    document.querySelector(
      "#recent-record-summary"
    ).textContent =
      `${moodEmojis[record.mood] || ""} ` +
      `${energyEmojis[record.energy] || ""} · ` +
      (Array.isArray(record.tags)
        ? record.tags.join(" · ")
        : "")

    setHidden(recentRecord, false)
    setHidden(recordEmpty, true)
  } else {
    setHidden(recentRecord, true)
    setHidden(recordEmpty, false)
  }

  const latestReport =
    reportService.getLatest()

  const recentResult =
    document.querySelector(
      "#recent-result"
    )

  const resultEmpty =
    document.querySelector(
      "#result-empty"
    )

  const personality =
    latestReport
      ? getPersonality(
        latestReport.code
      )
      : null

  if (latestReport && personality) {
    recentResult.href =
      `./result.html?reportId=${encodeURIComponent(latestReport.id)}`

    document.querySelector(
      "#recent-result-code"
    ).textContent = personality.code

    document.querySelector(
      "#recent-result-name"
    ).textContent = personality.name

    document.querySelector(
      "#recent-result-tagline"
    ).textContent = personality.tagline

    setHidden(recentResult, false)
    setHidden(resultEmpty, true)
  } else {
    setHidden(recentResult, true)
    setHidden(resultEmpty, false)
  }
}


function renderFortune(
  fortune,
  drawCount
) {
  currentFortune = fortune

  const image =
    document.querySelector(
      "#fortune-image"
    )

  image.src =
    fortune
      ? fortune.image
      : CARD_BACK_IMAGE

  image.classList.toggle(
    "is-card-back",
    !fortune
  )

  const count =
    document.querySelector(
      "#fortune-count"
    )

  count.textContent =
    drawCount > 0
      ? `第 ${drawCount} 抽`
      : ""

  setHidden(count, drawCount <= 0)

  setHidden(
    document.querySelector(
      "#fortune-empty"
    ),
    Boolean(fortune)
  )

  setHidden(
    document.querySelector(
      "#fortune-result"
    ),
    !fortune
  )

  if (!fortune) {
    return
  }

  document.querySelector(
    "#fortune-result-title"
  ).textContent =
    `今日：${fortune.title}`

  document.querySelector(
    "#fortune-yi"
  ).textContent = fortune.yi

  document.querySelector(
    "#fortune-ji"
  ).textContent = fortune.ji

  document.querySelector(
    "#fortune-comment"
  ).textContent = fortune.comment
}


function loadFortuneData() {
  const state =
    fortuneService.getTodayState()

  const fortune =
    state.latestFortuneId
      ? getFortuneDisplay(
        state.latestFortuneId,
        state.latestVariantIndex
      )
      : null

  renderFortune(
    fortune,
    state.drawCount
  )
}


function loadSharedFortune() {
  const query = getQuery()

  const sharedCard =
    document.querySelector(
      "#shared-fortune"
    )

  if (
    query.get("fromShare") !==
      "fortune"
  ) {
    setHidden(sharedCard, true)
    return
  }

  const variantText =
    query.get("variant")

  const variant =
    Number(variantText)

  const sharedFortune =
    variantText !== null &&
    variantText !== "" &&
    Number.isInteger(variant)
      ? getFortuneDisplay(
        query.get("fortuneId"),
        variant
      )
      : null

  if (!sharedFortune) {
    setHidden(sharedCard, true)
    return
  }

  document.querySelector(
    "#shared-fortune-image"
  ).src = sharedFortune.image

  document.querySelector(
    "#shared-fortune-title"
  ).textContent = sharedFortune.title

  document.querySelector(
    "#shared-fortune-comment"
  ).textContent = sharedFortune.comment

  setHidden(sharedCard, false)
}


async function drawFortune() {
  if (drawing) {
    return
  }

  drawing = true

  const card =
    document.querySelector(
      "#fortune-card"
    )

  card.classList.add("is-drawing")

  try {
    await wait(200)

    const result =
      fortuneService.drawFortune()

    renderFortune(
      result.fortune,
      result.state.drawCount
    )

    setHidden(
      document.querySelector(
        "#shared-fortune"
      ),
      true
    )

    await wait(300)
  } catch (error) {
    console.error(
      "抽取今日运势失败：",
      error
    )

    showToast(
      "系统今天有点迷信失败"
    )
  } finally {
    drawing = false
    card.classList.remove(
      "is-drawing"
    )
  }
}


async function shareFortune() {
  if (!currentFortune) {
    return
  }

  const shareUrl =
    new URL(
      "./index.html",
      window.location.href
    )

  shareUrl.searchParams.set(
    "fromShare",
    "fortune"
  )
  shareUrl.searchParams.set(
    "fortuneId",
    currentFortune.id
  )
  shareUrl.searchParams.set(
    "variant",
    String(
      currentFortune.variantIndex
    )
  )

  const title =
    currentFortune.id ===
      "draw_again"
      ? "我把 BUGTI 今日一抽抽成了穷举"
      : `我今天抽到「${currentFortune.title}」｜BUGTI 今日一抽`

  await shareOrCopy({
    title,
    text: currentFortune.comment,
    url: shareUrl.href
  })
}


function initialize() {
  const today =
    getTodayString()

  document.querySelector(
    "#today"
  ).textContent = today

  const backfillInput =
    document.querySelector(
      "#backfill-date"
    )

  backfillInput.max = today

  backfillInput.addEventListener(
    "change",
    event => {
      if (event.target.value) {
        window.location.href =
          `./record.html?date=${encodeURIComponent(event.target.value)}`
      }
    }
  )

  document.querySelector(
    "#today-record-button"
  ).addEventListener(
    "click",
    () => {
      window.location.href =
        `./record.html?date=${today}`
    }
  )

  document.querySelector(
    "#analyze-button"
  ).addEventListener(
    "click",
    () => {
      window.location.href =
        "./analyze.html"
    }
  )

  ;[
    "#draw-button",
    "#draw-again-button",
    "#draw-shared-button"
  ].forEach(selector => {
    document.querySelector(selector)
      .addEventListener(
        "click",
        drawFortune
      )
  })

  document.querySelector(
    "#share-fortune-button"
  ).addEventListener(
    "click",
    shareFortune
  )

  loadSharedFortune()
  loadHomeData()
  loadFortuneData()
}


initialize()


window.addEventListener(
  "pageshow",
  event => {
    if (event.persisted) {
      loadHomeData()
      loadFortuneData()
    }
  }
)
