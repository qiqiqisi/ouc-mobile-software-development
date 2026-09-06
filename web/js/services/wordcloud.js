import * as config from "../config/wordcloud.js"

const STRUCTURED_WORDS = new Set([
  ...config.TAG_LABELS,
  ...Object.values(config.MOOD_LABELS),
  ...Object.values(config.ENERGY_LABELS),
  ...Object.values(config.BUSYNESS_LABELS)
])

const STOP_WORDS = new Set(
  config.STOP_WORDS.map(word =>
    String(word).toLowerCase()
  )
)

const NOTE_DICTIONARY = config.NOTE_DICTIONARY
  .slice()
  .sort((a, b) => b.length - a.length)


function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  )
}

function roundWeight(value) {
  return Math.round(value * 100) / 100
}


function hashString(input) {
  let hash = 2166136261

  const text = String(input || "")

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}


function createRng(seed) {
  let state = (seed >>> 0) || 0x6d2b79f5

  return function random() {
    state += 0x6d2b79f5

    let value = state

    value = Math.imul(
      value ^ (value >>> 15),
      value | 1
    )

    value ^= value + Math.imul(
      value ^ (value >>> 7),
      value | 61
    )

    return (
      (value ^ (value >>> 14)) >>> 0
    ) / 4294967296
  }
}


function normalizeEnglishToken(token) {
  const raw = String(token || "")
    .replace(/^[._-]+|[._-]+$/g, "")

  if (!raw) {
    return ""
  }

  const lower = raw.toLowerCase()

  if (STOP_WORDS.has(lower)) {
    return ""
  }

  if (config.ENGLISH_CANONICAL[lower]) {
    return config.ENGLISH_CANONICAL[lower]
  }

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return ""
  }

  if (raw.length < 2 || raw.length > 16) {
    return ""
  }

  return raw
}


function extractEnglishKeywords(note) {
  const result = []

  const matches = String(note || "")
    .match(/C\+\+|C#|[A-Za-z][A-Za-z0-9._+#-]{1,19}/g) || []

  matches.forEach(token => {
    const normalized =
      normalizeEnglishToken(token)

    if (normalized) {
      result.push(normalized)
    }
  })

  return result
}


function extractDictionaryKeywords(note) {
  const text = String(note || "")
  const result = []

  NOTE_DICTIONARY.forEach(term => {
    if (
      STRUCTURED_WORDS.has(term) ||
      text.indexOf(term) < 0
    ) {
      return
    }

    const coveredByLongerTerm =
      result.some(existing =>
        existing.length > term.length &&
        existing.indexOf(term) >= 0
      )

    if (!coveredByLongerTerm) {
      result.push(term)
    }
  })

  return result
}


function extractNoteKeywords(note) {
  if (!note || !String(note).trim()) {
    return []
  }

  const unique = new Set([
    ...extractDictionaryKeywords(note),
    ...extractEnglishKeywords(note)
  ])

  return Array.from(unique)
    .filter(word => {
      const lower =
        String(word).toLowerCase()

      return (
        word &&
        !STOP_WORDS.has(lower) &&
        !STRUCTURED_WORDS.has(word)
      )
    })
}


function getMaxWords(validDays) {
  if (validDays <= 3) {
    return 12
  }

  if (validDays <= 7) {
    return 16
  }

  if (validDays <= 14) {
    return 20
  }

  if (validDays <= 30) {
    return 24
  }

  return 28
}


function addContribution(
  map,
  text,
  amount,
  source,
  date
) {
  if (!text || !amount) {
    return
  }

  if (!map.has(text)) {
    map.set(text, {
      text,
      weight: 0,
      sourceWeights: {},
      dates: new Set()
    })
  }

  const entry = map.get(text)

  entry.weight += amount

  entry.sourceWeights[source] =
    (entry.sourceWeights[source] || 0) +
    amount

  if (date) {
    entry.dates.add(date)
  }
}


function isUsableRecord(record) {
  if (
    !record ||
    typeof record !== "object" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.date || "")
  ) {
    return false
  }

  if (
    config.MOOD_LABELS[record.mood] === undefined ||
    config.ENERGY_LABELS[record.energy] === undefined ||
    config.BUSYNESS_LABELS[record.busyness] === undefined
  ) {
    return false
  }

  if (
    !Array.isArray(record.tags) ||
    record.tags.length < 1 ||
    record.tags.length > 3
  ) {
    return false
  }

  const uniqueTags =
    new Set(record.tags)

  if (uniqueTags.size !== record.tags.length) {
    return false
  }

  return record.tags.every(tag =>
    config.TAG_LABELS.includes(tag)
  )
}


function sanitizeRecords(records) {
  const map = new Map()

  const source =
    Array.isArray(records)
      ? records
      : []

  source.forEach(record => {
    if (isUsableRecord(record)) {
      map.set(record.date, record)
    }
  })

  return Array.from(map.values())
    .sort((a, b) =>
      a.date.localeCompare(b.date)
    )
}


function createSnapshot(records, options = {}) {
  const safeRecords =
    sanitizeRecords(records)

  const map = new Map()

  safeRecords.forEach(record => {
    const date = record.date || ""

    const tags = Array.isArray(record.tags)
      ? Array.from(new Set(record.tags))
      : []

    tags.forEach(tag => {
      if (config.TAG_LABELS.includes(tag)) {
        addContribution(
          map,
          tag,
          config.SOURCE_WEIGHTS.tag,
          "tag",
          date
        )
      }
    })

    const moodText =
      config.MOOD_LABELS[record.mood]

    const energyText =
      config.ENERGY_LABELS[record.energy]

    const busynessText =
      config.BUSYNESS_LABELS[record.busyness]

    addContribution(
      map,
      moodText,
      config.SOURCE_WEIGHTS.mood,
      "mood",
      date
    )

    addContribution(
      map,
      energyText,
      config.SOURCE_WEIGHTS.energy,
      "energy",
      date
    )

    addContribution(
      map,
      busynessText,
      config.SOURCE_WEIGHTS.busyness,
      "busyness",
      date
    )

    if (options.includeNote !== false) {
      extractNoteKeywords(record.note)
        .forEach(keyword => {
          addContribution(
            map,
            keyword,
            config.SOURCE_WEIGHTS.note,
            "note",
            date
          )
        })
    }
  })

  const words = Array.from(map.values())
    .map(item => ({
      text: item.text,
      weight: roundWeight(item.weight),
      dayCount: item.dates.size,
      sources: Object.keys(item.sourceWeights)
    }))
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight
      }

      if (b.dayCount !== a.dayCount) {
        return b.dayCount - a.dayCount
      }

      return a.text < b.text
        ? -1
        : a.text > b.text
          ? 1
          : 0
    })
    .slice(
      0,
      getMaxWords(safeRecords.length)
    )

  const seedSource = [
    options.startDate ||
      (safeRecords[0] && safeRecords[0].date) ||
      "",
    options.endDate ||
      (safeRecords[safeRecords.length - 1] &&
        safeRecords[safeRecords.length - 1].date) ||
      "",
    ...words.map(word =>
      `${word.text}:${word.weight}`
    )
  ].join("|")

  return {
    version: config.VERSION,
    baseSeed: hashString(seedSource),
    validDays: safeRecords.length,
    includeNote: options.includeNote !== false,
    words
  }
}


function getFontSize(
  word,
  minWeight,
  maxWeight,
  width
) {
  const minFont = clamp(
    width * 0.038,
    12,
    15
  )

  const maxFont = clamp(
    width * 0.125,
    38,
    46
  )

  let normalized = 1

  if (maxWeight > minWeight) {
    normalized =
      (word.weight - minWeight) /
      (maxWeight - minWeight)
  }

  let size =
    minFont +
    (maxFont - minFont) *
      Math.sqrt(clamp(normalized, 0, 1))

  const length = String(word.text).length

  if (length >= 10) {
    size *= 0.62
  } else if (length >= 8) {
    size *= 0.72
  } else if (length >= 6) {
    size *= 0.84
  }

  return Math.max(minFont, size)
}


function intersects(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  )
}


function isInside(rect, width, height, margin) {
  return (
    rect.left >= margin &&
    rect.top >= margin &&
    rect.right <= width - margin &&
    rect.bottom <= height - margin
  )
}


function makeRect(
  centerX,
  centerY,
  textWidth,
  fontSize,
  rotation,
  padding
) {
  const textHeight = fontSize * 1.08

  const boxWidth =
    rotation === 90
      ? textHeight
      : textWidth

  const boxHeight =
    rotation === 90
      ? textWidth
      : textHeight

  return {
    left:
      centerX - boxWidth / 2 - padding,
    right:
      centerX + boxWidth / 2 + padding,
    top:
      centerY - boxHeight / 2 - padding,
    bottom:
      centerY + boxHeight / 2 + padding
  }
}


function pickRotation(index, random) {
  if (index < 3) {
    return 0
  }

  return random() < 0.32
    ? 90
    : 0
}


function pickColor(index, random) {
  if (index === 0) {
    return config.PALETTE[0]
  }

  if (index === 1) {
    const candidates = [3, 5, 1]
    return config.PALETTE[
      candidates[
        Math.floor(random() * candidates.length)
      ]
    ]
  }

  if (index === 2) {
    const candidates = [1, 2, 4]
    return config.PALETTE[
      candidates[
        Math.floor(random() * candidates.length)
      ]
    ]
  }

  // 主绿和青绿色稍高概率，整体仍保留 BUGTI 品牌感。
  const weighted = [0, 0, 0, 1, 1, 2, 3, 4, 5]

  return config.PALETTE[
    weighted[
      Math.floor(random() * weighted.length)
    ]
  ]
}


function layoutWords(
  context,
  words,
  width,
  height,
  seed
) {
  if (!words.length) {
    return []
  }

  const minWeight = words[words.length - 1].weight
  const maxWeight = words[0].weight
  const placed = []
  const random = createRng(seed)
  const outerMargin = 7

  words.forEach((word, index) => {
    const rankScale = clamp(
      1 - index * 0.018,
      0.72,
      1
    )

    const baseFontSize = getFontSize(
      word,
      minWeight,
      maxWeight,
      width
    ) * rankScale

    const rotation =
      pickRotation(index, random)

    const color =
      pickColor(index, random)

    // 给不同 variant 一个不同的螺旋起始相位。
    const phase = random() * Math.PI * 2

    let placedWord = null

    for (
      let shrinkRound = 0;
      shrinkRound < 3 && !placedWord;
      shrinkRound += 1
    ) {
      const fontSize =
        baseFontSize *
        Math.pow(0.92, shrinkRound)

      context.font =
        `700 ${fontSize}px sans-serif`

      const metrics =
        context.measureText(word.text)

      const textWidth =
        metrics.width ||
        word.text.length * fontSize

      const padding =
        clamp(fontSize * 0.11, 3.5, 7)

      for (
        let attempt = 0;
        attempt < 520;
        attempt += 1
      ) {
        const angle =
          phase + attempt * 0.46

        const radius =
          attempt * 0.72

        const x =
          width / 2 +
          Math.cos(angle) *
            radius * 1.28

        const y =
          height / 2 +
          Math.sin(angle) *
            radius * 0.94

        const rect = makeRect(
          x,
          y,
          textWidth,
          fontSize,
          rotation,
          padding
        )

        if (
          !isInside(
            rect,
            width,
            height,
            outerMargin
          )
        ) {
          continue
        }

        const collision =
          placed.some(item =>
            intersects(
              rect,
              item.rect
            )
          )

        if (collision) {
          continue
        }

        placedWord = {
          text: word.text,
          weight: word.weight,
          x,
          y,
          fontSize,
          rotation,
          color,
          rect
        }

        placed.push(placedWord)
        break
      }
    }
  })

  return placed
}


function drawWordCloud(
  canvas,
  snapshot,
  options = {}
) {
  if (
    !canvas ||
    !snapshot ||
    !Array.isArray(snapshot.words)
  ) {
    return {
      placedCount: 0,
      totalCount: 0
    }
  }

  const width = Number(options.width) || 320
  const height = Number(options.height) || 260
  const dpr = clamp(
    Number(options.dpr) || 1,
    1,
    3
  )
  const variant =
    Number(options.variant) || 0

  canvas.width =
    Math.round(width * dpr)

  canvas.height =
    Math.round(height * dpr)

  const context =
    canvas.getContext("2d")

  context.scale(dpr, dpr)
  context.clearRect(0, 0, width, height)
  context.fillStyle =
    options.background || config.BACKGROUND
  context.fillRect(0, 0, width, height)

  context.textAlign = "center"
  context.textBaseline = "middle"

  const variantSeed =
    hashString(
      `${snapshot.baseSeed}|${variant}`
    )

  const placed = layoutWords(
    context,
    snapshot.words,
    width,
    height,
    variantSeed
  )

  placed.forEach(word => {
    context.save()

    context.translate(
      word.x,
      word.y
    )

    if (word.rotation === 90) {
      context.rotate(Math.PI / 2)
    }

    context.font =
      `700 ${word.fontSize}px sans-serif`

    context.fillStyle =
      word.color

    context.fillText(
      word.text,
      0,
      0
    )

    context.restore()
  })

  return {
    placedCount: placed.length,
    totalCount: snapshot.words.length
  }
}


export {
  createSnapshot,
  extractNoteKeywords,
  drawWordCloud,
  hashString
}
