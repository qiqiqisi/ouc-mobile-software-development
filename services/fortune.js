const {
  NORMAL_FORTUNES,
  SPECIAL_FORTUNE,
  getFortuneById,
  getFortuneDisplay
} =
  require("../config/fortunes")


const STORAGE_KEY =
  "bugti_daily_fortune_v1"


function padNumber(number) {
  return String(number)
    .padStart(2, "0")
}


function getLocalDateString() {
  const today =
    new Date()

  return (
    `${today.getFullYear()}-` +
    `${padNumber(
      today.getMonth() + 1
    )}-` +
    `${padNumber(
      today.getDate()
    )}`
  )
}


function createInitialState(today) {
  return {
    schemaVersion: 1,
    date: today,
    drawCount: 0,
    latestFortuneId: null,
    latestVariantIndex: null,
    seenNormalIds: [],
    specialShown: false
  }
}


function saveState(state) {
  wx.setStorageSync(
    STORAGE_KEY,
    state
  )
}


function sanitizeSeenNormalIds(
  ids
) {
  if (!Array.isArray(ids)) {
    return []
  }

  const normalIds =
    NORMAL_FORTUNES.map(
      fortune =>
        fortune.id
    )

  return Array.from(
    new Set(
      ids.filter(
        id =>
          normalIds.includes(id)
      )
    )
  )
}


function getTodayState() {
  const today =
    getLocalDateString()

  const stored =
    wx.getStorageSync(
      STORAGE_KEY
    )

  if (
    !stored ||
    typeof stored !== "object" ||
    stored.date !== today
  ) {
    const initialState =
      createInitialState(today)

    saveState(initialState)

    return initialState
  }

  const drawCount =
    Number.isInteger(
      stored.drawCount
    ) &&
    stored.drawCount >= 0
      ? stored.drawCount
      : 0

  const seenNormalIds =
    sanitizeSeenNormalIds(
      stored.seenNormalIds
    )

  let latestFortuneId =
    stored.latestFortuneId

  let latestVariantIndex =
    stored.latestVariantIndex

  const latestFortune =
    getFortuneById(
      latestFortuneId
    )

  if (
    !latestFortune ||
    !getFortuneDisplay(
      latestFortuneId,
      latestVariantIndex
    )
  ) {
    latestFortuneId = null
    latestVariantIndex = null
  }

  const state = {
    schemaVersion: 1,
    date: today,
    drawCount,
    latestFortuneId,
    latestVariantIndex,
    seenNormalIds,
    specialShown:
      typeof stored.specialShown ===
        "boolean"
        ? stored.specialShown
        : false
  }

  saveState(state)

  return state
}


function chooseRandomItem(items) {
  return items[
    Math.floor(
      Math.random() *
      items.length
    )
  ]
}


function drawFortune() {
  const currentState =
    getTodayState()

  const allNormalSeen =
    NORMAL_FORTUNES.every(
      fortune =>
        currentState
          .seenNormalIds
          .includes(
            fortune.id
          )
    )

  let fortune
  let variantIndex
  let seenNormalIds =
    currentState
      .seenNormalIds
      .slice()
  let specialShown =
    currentState.specialShown

  if (
    allNormalSeen &&
    !specialShown
  ) {
    fortune = SPECIAL_FORTUNE
    variantIndex = 0
    specialShown = true
  } else {
    const previousWasNormal =
      NORMAL_FORTUNES.some(
        item =>
          item.id ===
          currentState
            .latestFortuneId
      )

    const candidates =
      previousWasNormal
        ? NORMAL_FORTUNES.filter(
          item =>
            item.id !==
            currentState
              .latestFortuneId
        )
        : NORMAL_FORTUNES

    fortune =
      chooseRandomItem(
        candidates
      )

    variantIndex =
      Math.floor(
        Math.random() *
        fortune.variants.length
      )

    seenNormalIds =
      Array.from(
        new Set([
          ...seenNormalIds,
          fortune.id
        ])
      )
  }

  const state = {
    ...currentState,
    drawCount:
      currentState.drawCount + 1,
    latestFortuneId:
      fortune.id,
    latestVariantIndex:
      variantIndex,
    seenNormalIds,
    specialShown
  }

  saveState(state)

  return {
    fortune:
      getFortuneDisplay(
        fortune.id,
        variantIndex
      ),
    state
  }
}


module.exports = {
  getTodayState,
  drawFortune
}
