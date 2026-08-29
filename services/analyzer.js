const config =
  require("../config/analysis")


/**
 * 把数值限制在 0 ~ 1。
 */
function clamp01(value) {
  if (value < 0) {
    return 0
  }

  if (value > 1) {
    return 1
  }

  return value
}


/**
 * 数组平均值。
 */
function average(values) {
  if (!values.length) {
    return 0
  }

  const sum =
    values.reduce(
      (total, value) =>
        total + value,
      0
    )

  return sum / values.length
}


/**
 * 对“越高越符合”的指标进行强度归一化。
 *
 * threshold：
 * 达到这个值后才算通过 Gate。
 *
 * 返回：
 * threshold → 0
 * 1         → 1
 */
function normalizeHigh(
  value,
  threshold
) {
  if (threshold >= 1) {
    return value >= threshold
      ? 1
      : 0
  }

  return clamp01(
    (value - threshold) /
    (1 - threshold)
  )
}


/**
 * 对“越低越符合”的指标进行强度归一化。
 *
 * threshold：
 * 低于这个值才开始符合。
 *
 * 返回：
 * threshold → 0
 * 0         → 1
 */
function normalizeLow(
  value,
  threshold
) {
  if (threshold <= 0) {
    return value <= threshold
      ? 1
      : 0
  }

  return clamp01(
    (threshold - value) /
    threshold
  )
}


/**
 * 判断某一天是否包含某一组标签中的至少一个。
 */
function hasAnyTag(
  record,
  tagList
) {
  return record.tags.some(
    tag =>
      tagList.includes(tag)
  )
}


/**
 * 某一个具体标签的出现率。
 */
function tagRate(
  records,
  tag
) {
  const count =
    records.filter(
      record =>
        record.tags.includes(tag)
    ).length

  return count / records.length
}


/**
 * 某一组标签的参与率。
 *
 * 例如：
 * 学习科研 / 实习工作 / 运动
 * 只要当天出现其中一个，
 * 就算当天有“正事参与”。
 */
function groupRate(
  records,
  tags
) {
  const count =
    records.filter(
      record =>
        hasAnyTag(
          record,
          tags
        )
    ).length

  return count / records.length
}


/**
 * Jaccard 距离。
 *
 * 用来计算：
 * 今天的标签集合
 * 和
 * 昨天的标签集合
 * 有多不一样。
 *
 * 完全一样 → 0
 * 完全不同 → 1
 */
function jaccardDistance(
  tagsA,
  tagsB
) {
  const setA =
    new Set(tagsA)

  const setB =
    new Set(tagsB)

  const union =
    new Set([
      ...setA,
      ...setB
    ])

  if (!union.size) {
    return 0
  }

  let intersection = 0

  setA.forEach(tag => {
    if (setB.has(tag)) {
      intersection += 1
    }
  })

  return (
    1 -
    intersection /
    union.size
  )
}


/**
 * 判断一条记录是不是有效结构化记录。
 *
 * 自由文字和图片不参与判断。
 */
function isValidRecord(record) {
  if (
    !record ||
    typeof record !== "object"
  ) {
    return false
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(record.date || "")
  ) {
    return false
  }

  if (
    config.normalization
      .mood[record.mood] ===
    undefined
  ) {
    return false
  }

  if (
    config.normalization
      .energy[record.energy] ===
    undefined
  ) {
    return false
  }

  if (
    config.normalization
      .busyness[
        record.busyness
      ] === undefined
  ) {
    return false
  }

  if (
    !Array.isArray(
      record.tags
    )
  ) {
    return false
  }

  if (
    record.tags.length < 1 ||
    record.tags.length > 3
  ) {
    return false
  }

  const uniqueTags =
    new Set(record.tags)

  if (
    uniqueTags.size !==
    record.tags.length
  ) {
    return false
  }

  return record.tags.every(
    tag =>
      config.tags.all.includes(
        tag
      )
  )
}


/**
 * 清理输入数据。
 *
 * 1. 删除无效记录
 * 2. 同一天只保留一条
 * 3. 按日期升序排列
 */
function sanitizeRecords(records) {
  const recordMap = {}

  const sourceRecords =
    Array.isArray(records)
      ? records
      : []

  sourceRecords.forEach(
    record => {
      if (
        isValidRecord(record)
      ) {
        recordMap[
          record.date
        ] = record
      }
    }
  )

  return Object.keys(recordMap)
    .sort()
    .map(
      date =>
        recordMap[date]
    )
}


/**
 * 把原始 1~5 / 1~3 数据转换为 0~1。
 */
function normalizeRecord(record) {
  return {
    date:
      record.date,

    mood:
      config.normalization
        .mood[record.mood],

    energy:
      config.normalization
        .energy[
          record.energy
        ],

    busyness:
      config.normalization
        .busyness[
          record.busyness
        ],

    tags:
      record.tags.slice()
  }
}


/**
 * 计算相邻记录之间的波动。
 */
function calculateVariation(
  records
) {
  if (records.length < 2) {
    return {
      numericVariation: 0,
      tagVariation: 0,
      totalVariation: 0,
      stability: 1,
      energySwing: 0
    }
  }

  const numericDiffs = []
  const tagDiffs = []
  const energyDiffs = []

  for (
    let i = 1;
    i < records.length;
    i += 1
  ) {
    const previous =
      records[i - 1]

    const current =
      records[i]

    const numericDiff =
      (
        Math.abs(
          current.mood -
          previous.mood
        ) +
        Math.abs(
          current.energy -
          previous.energy
        ) +
        Math.abs(
          current.busyness -
          previous.busyness
        )
      ) / 3

    numericDiffs.push(
      numericDiff
    )

    tagDiffs.push(
      jaccardDistance(
        previous.tags,
        current.tags
      )
    )

    energyDiffs.push(
      Math.abs(
        current.energy -
        previous.energy
      )
    )
  }

  const numericVariation =
    average(numericDiffs)

  const tagVariation =
    average(tagDiffs)

  const totalVariation =
    clamp01(
      0.60 *
        numericVariation +
      0.40 *
        tagVariation
    )

  return {
    numericVariation,

    tagVariation,

    totalVariation,

    stability:
      1 - totalVariation,

    energySwing:
      average(
        energyDiffs
      )
  }
}


/**
 * F5 使用的单日运行分 K。
 */
function calculateRunScore(
  record
) {
  const active =
    hasAnyTag(
      record,
      config.tags.active
    )
      ? 1
      : 0

  const weights =
    config.runScoreWeights

  return (
    weights.energy *
      record.energy +

    weights.mood *
      record.mood +

    weights.active *
      active
  )
}


/**
 * 计算 F5 的前后变化趋势。
 *
 * 奇数天时：
 * 中间那一天不参与前后比较。
 *
 * 例如 5 天：
 *
 * 1 2 | 3 | 4 5
 *
 * 比较：
 * 前两天 vs 后两天
 */
function calculateTrend(
  records
) {
  const n =
    records.length

  const behaviorSplitIndex =
    Math.floor(n / 2)

  const firstBehaviorHalf =
    records.slice(
      0,
      behaviorSplitIndex
    )

  const secondBehaviorHalf =
    records.slice(
      behaviorSplitIndex
    )

  const firstHalfProductiveRate =
    groupRate(
      firstBehaviorHalf,
      config.tags.productive
    )

  const secondHalfProductiveRate =
    groupRate(
      secondBehaviorHalf,
      config.tags.productive
    )

  const productiveImprovement =
    secondHalfProductiveRate -
    firstHalfProductiveRate

  if (
    n <
    config.gates.F5.minDays
  ) {
    return {
      firstHalfRunScore: 0,
      secondHalfRunScore: 0,

      trend: 0,

      energyImprovement: 0,
      moodImprovement: 0,
      activeImprovement: 0,

      firstHalfProductiveRate,
      secondHalfProductiveRate,
      productiveImprovement,

      improvedComponents: 0
    }
  }

  const half =
    Math.floor(n / 2)

  const firstHalf =
    records.slice(
      0,
      half
    )

  const secondHalf =
    records.slice(
      n - half
    )


  const firstHalfRunScore =
    average(
      firstHalf.map(
        calculateRunScore
      )
    )

  const secondHalfRunScore =
    average(
      secondHalf.map(
        calculateRunScore
      )
    )


  const firstEnergy =
    average(
      firstHalf.map(
        record =>
          record.energy
      )
    )

  const secondEnergy =
    average(
      secondHalf.map(
        record =>
          record.energy
      )
    )


  const firstMood =
    average(
      firstHalf.map(
        record =>
          record.mood
      )
    )

  const secondMood =
    average(
      secondHalf.map(
        record =>
          record.mood
      )
    )


  const firstActive =
    groupRate(
      firstHalf,
      config.tags.active
    )

  const secondActive =
    groupRate(
      secondHalf,
      config.tags.active
    )


  const energyImprovement =
    secondEnergy -
    firstEnergy

  const moodImprovement =
    secondMood -
    firstMood

  const activeImprovement =
    secondActive -
    firstActive


  const improvements = [
    energyImprovement,
    moodImprovement,
    activeImprovement
  ]


  const improvedComponents =
    improvements.filter(
      value =>
        value >=
        config.gates.F5
          .componentImprovementMin
    ).length


  return {
    firstHalfRunScore,
    secondHalfRunScore,

    trend:
      secondHalfRunScore -
      firstHalfRunScore,

    energyImprovement,
    moodImprovement,
    activeImprovement,

    firstHalfProductiveRate,
    secondHalfProductiveRate,
    productiveImprovement,

    improvedComponents
  }
}


/**
 * 把所有原始记录转换成人格分析特征。
 */
function calculateFeatures(
  records
) {
  const n =
    records.length


  const allSeenTags =
    new Set()

  records.forEach(record => {
    record.tags.forEach(tag => {
      allSeenTags.add(tag)
    })
  })


  const domainRates = {}

  Object.keys(
    config.domains
  ).forEach(
    domainName => {
      domainRates[
        domainName
      ] =
        groupRate(
          records,
          config.domains[
            domainName
          ]
        )
    }
  )


  const dailyDomainCount =
    records.map(record => {
      return Object.keys(
        config.domains
      ).filter(
        domainName =>
          hasAnyTag(
            record,
            config.domains[
              domainName
            ]
          )
      ).length
    })


  const periodDomainCount =
    Object.keys(
      domainRates
    ).filter(
      domainName =>
        domainRates[
          domainName
        ] > 0
    ).length


  const multiTagDayCount =
    records.filter(
      record =>
        record.tags.length >= 2
    ).length


  const multiDomainDayCount =
    dailyDomainCount.filter(
      count =>
        count >= 2
    ).length


  const persistentDomains =
    Object.keys(
      domainRates
    ).filter(
      domainName =>
        domainRates[
          domainName
        ] >=
        config
          .persistentDomainRate
    ).length


  const otherSocialDomainMax =
    Math.max(
      domainRates.growth,
      domainRates.movement,
      domainRates.fun,
      domainRates.recovery
    )


  const variation =
    calculateVariation(
      records
    )

  const trend =
    calculateTrend(
      records
    )


  return {
    n,

    moodMean:
      average(
        records.map(
          record =>
            record.mood
        )
      ),

    energyMean:
      average(
        records.map(
          record =>
            record.energy
        )
      ),

    busynessMean:
      average(
        records.map(
          record =>
            record.busyness
        )
      ),


    homeRate:
      tagRate(
        records,
        "宅家"
      ),

    socialRate:
      tagRate(
        records,
        "社交"
      ),

    outingRate:
      tagRate(
        records,
        "出门"
      ),

    slackRate:
      tagRate(
        records,
        "摸鱼"
      ),

    restRate:
      tagRate(
        records,
        "休息"
      ),

    entertainmentRate:
      tagRate(
        records,
        "娱乐"
      ),


    productiveRate:
      groupRate(
        records,
        config.tags.productive
      ),

    activeRate:
      groupRate(
        records,
        config.tags.active
      ),


    lowestEnergyRate:
      records.filter(
        record =>
          record.energy === 0
      ).length / n,


    multiTagDayCount,

    multiTagRate:
      multiTagDayCount / n,


    diversity:
      allSeenTags.size /
      config.tags.all.length,


    dailyDomainCount,

    multiDomainDayCount,

    multiDomainRate:
      multiDomainDayCount / n,

    averageDailyDomains:
      average(
        dailyDomainCount
      ),

    periodDomainCount,


    domainRates,

    persistentDomains,

    otherSocialDomainMax,

    socialDominanceGap:
      domainRates.social -
      otherSocialDomainMax,


    ...variation,

    ...trend
  }
}


/**
 * 根据有效记录日数量，
 * 选择 BUG 对应的门槛。
 */
function getBugGateConfig(n) {
  if (n === 3) {
    return (
      config.gates.BUG.n3
    )
  }

  if (n <= 5) {
    return (
      config.gates.BUG
        .n4to5
    )
  }

  return (
    config.gates.BUG
      .n6plus
  )
}


/**
 * 根据有效记录日数量，
 * 选择 F5 趋势门槛。
 */
function getF5TrendThreshold(
  n
) {
  const thresholds =
    config.gates.F5
      .trendByDays

  if (n === 5) {
    return thresholds.n5
  }

  if (n <= 7) {
    return thresholds.n6to7
  }

  return thresholds.n8plus
}


/**
 * Gate：
 *
 * 这里只负责判断
 * “这个人格有没有资格成为候选”。
 */
function checkGates(features) {
  const gates = {}


  // =========================
  // 404
  // =========================

  const gate404 =
    config.gates["404"]

  gates["404"] =
    features.homeRate >=
      gate404.homeRateMin &&

    features.socialRate <=
      gate404.socialRateMax &&

    features.outingRate <=
      gate404.outingRateMax


  // =========================
  // LOW BATTERY
  // =========================

  const lowGate =
    config.gates[
      "LOW BATTERY"
    ]

  const lowPathA =
    features.energyMean <=
      lowGate.energyMeanMaxA &&

    features.lowestEnergyRate >=
      lowGate
        .lowestEnergyRateMin


  const lowPathB =
    features.energyMean <=
      lowGate.energyMeanMaxB &&

    features.restRate >=
      lowGate.restRateMin


  gates["LOW BATTERY"] =
    lowPathA ||
    lowPathB


  // =========================
  // NPC
  // =========================

  const npcGate =
    config.gates.NPC

  gates.NPC =
    features.stability >=
      npcGate.stabilityMin &&

    features.numericVariation <=
      npcGate
        .numericVariationMax &&

    features.tagVariation <=
      npcGate.tagVariationMax


  // =========================
  // ESC
  // =========================

  const escGate =
    config.gates.ESC

  gates.ESC =
    features.slackRate >=
      escGate.slackRateMin &&

    features.productiveRate <=
      escGate
        .productiveRateMax &&

    features.busynessMean <=
      escGate
        .busynessMeanMax


  // =========================
  // CTRL+A
  // =========================

  const ctrlAGate =
    config.gates["CTRL+A"]

  gates["CTRL+A"] =
    features.multiTagDayCount >=
      ctrlAGate
        .multiTagDayCountMin &&

    features.multiTagRate >=
      ctrlAGate
        .multiTagRateMin &&

    features.multiDomainRate >=
      ctrlAGate
        .multiDomainRateMin &&

    features
      .averageDailyDomains >=
      ctrlAGate
        .averageDailyDomainsMin &&

    features.periodDomainCount >=
      ctrlAGate
        .periodDomainCountMin &&

    features.activeRate >=
      ctrlAGate.activeRateMin


  // =========================
  // CTRL+V
  // =========================

  const ctrlVGate =
    config.gates["CTRL+V"]

  gates["CTRL+V"] =
    features.socialRate >=
      ctrlVGate.socialRateMin


  // =========================
  // BUG
  // =========================

  const bugGate =
    config.gates.BUG

  const bugGateForN =
    getBugGateConfig(
      features.n
    )


  const bugNumericStrong =
    features.numericVariation >=
      bugGateForN
        .numericVariationStrong


  const bugNumericAndTags =
    features.numericVariation >=
      bugGateForN
        .numericVariationWeak &&

    features.tagVariation >=
      bugGateForN
        .tagVariationRequired


  gates.BUG =
    features.totalVariation >=
      bugGate
        .totalVariationMin &&

    (
      bugNumericStrong ||
      bugNumericAndTags
    )


  // =========================
  // F5
  // =========================

  const f5Gate =
    config.gates.F5

  const trendThreshold =
    getF5TrendThreshold(
      features.n
    )


  const recoveryPath =
    features.n >=
      f5Gate.minDays &&

    features
      .firstHalfRunScore <=
      f5Gate
        .firstHalfRunScoreMax &&

    features
      .secondHalfRunScore >=
      f5Gate
        .secondHalfRunScoreMin &&

    features.trend >=
      trendThreshold &&

    features
      .improvedComponents >=
      f5Gate
        .minImprovedComponents


  const behaviorResetGate =
    f5Gate.behaviorReset

  const behaviorResetPath =
    features.n >=
      behaviorResetGate.minDays &&

    features
      .firstHalfProductiveRate <=
      behaviorResetGate
        .firstProductiveRateMax &&

    features
      .secondHalfProductiveRate >=
      behaviorResetGate
        .secondProductiveRateMin &&

    features
      .productiveImprovement >=
      behaviorResetGate
        .productiveImprovementMin


  gates.F5 =
    recoveryPath ||
    behaviorResetPath


  return gates
}


/**
 * Gate 通过后：
 * 60 + 40 × 匹配强度
 */
function buildScore(
  strength
) {
  const score =
    config.score.base +
    config.score
      .strengthRange *
    clamp01(strength)

  return (
    Math.round(
      score * 10
    ) / 10
  )
}


/**
 * 对所有通过 Gate 的人格计算匹配分。
 */
function calculateScores(
  features,
  gates
) {
  const candidates = []

  const weights =
    config.score.weights


  // =========================
  // 404
  // =========================

  if (gates["404"]) {
    const gate =
      config.gates["404"]

    const weight =
      weights["404"]

    const strength =
      weight.home *
        normalizeHigh(
          features.homeRate,
          gate.homeRateMin
        ) +

      weight.lowSocial *
        normalizeLow(
          features.socialRate,
          gate.socialRateMax
        ) +

      weight.lowOuting *
        normalizeLow(
          features.outingRate,
          gate.outingRateMax
        )

    candidates.push({
      code: "404",
      score:
        buildScore(strength)
    })
  }


  // =========================
  // LOW BATTERY
  // =========================

  if (
    gates["LOW BATTERY"]
  ) {
    const gate =
      config.gates[
        "LOW BATTERY"
      ]

    const weight =
      weights[
        "LOW BATTERY"
      ]

    const strength =
      weight.lowEnergy *
        normalizeLow(
          features.energyMean,
          gate.energyMeanMaxB
        ) +

      weight.rest *
        normalizeHigh(
          features.restRate,
          gate.restRateMin
        ) +

      weight.lowestEnergy *
        normalizeHigh(
          features
            .lowestEnergyRate,
          gate
            .lowestEnergyRateMin
        )

    candidates.push({
      code:
        "LOW BATTERY",

      score:
        buildScore(strength)
    })
  }


  // =========================
  // NPC
  // =========================

  if (gates.NPC) {
    const gate =
      config.gates.NPC

    const weight =
      weights.NPC

    const strength =
      weight.stability *
        normalizeHigh(
          features.stability,
          gate.stabilityMin
        ) +

      weight
        .lowNumericVariation *
        normalizeLow(
          features
            .numericVariation,
          gate
            .numericVariationMax
        ) +

      weight
        .lowTagVariation *
        normalizeLow(
          features
            .tagVariation,
          gate
            .tagVariationMax
        )

    candidates.push({
      code: "NPC",
      score:
        buildScore(strength)
    })
  }


  // =========================
  // ESC
  // =========================

  if (gates.ESC) {
    const gate =
      config.gates.ESC

    const weight =
      weights.ESC

    const strength =
      weight.slack *
        normalizeHigh(
          features.slackRate,
          gate.slackRateMin
        ) +

      weight.lowProductive *
        normalizeLow(
          features
            .productiveRate,
          gate
            .productiveRateMax
        ) +

      weight.lowBusyness *
        normalizeLow(
          features.busynessMean,
          gate.busynessMeanMax
        )

    candidates.push({
      code: "ESC",
      score:
        buildScore(strength)
    })
  }


  // =========================
  // CTRL+A
  // =========================

  if (
    gates["CTRL+A"]
  ) {
    const gate =
      config.gates["CTRL+A"]

    const weight =
      weights["CTRL+A"]


    const averageDailyDomainsStrength =
      clamp01(
        (
          features
            .averageDailyDomains -
          gate
            .averageDailyDomainsMin
        ) /
        (
          3 -
          gate
            .averageDailyDomainsMin
        )
      )


    const periodDomainCountStrength =
      clamp01(
        (
          features
            .periodDomainCount -
          gate
            .periodDomainCountMin
        ) /
        (
          5 -
          gate
            .periodDomainCountMin
        )
      )


    const strength =
      weight
        .multiTagRate *
        normalizeHigh(
          features.multiTagRate,
          gate.multiTagRateMin
        ) +

      weight
        .multiDomainRate *
        normalizeHigh(
          features.multiDomainRate,
          gate.multiDomainRateMin
        ) +

      weight
        .averageDailyDomains *
        averageDailyDomainsStrength +

      weight
        .periodDomainCount *
        periodDomainCountStrength +

      weight.active *
        normalizeHigh(
          features.activeRate,
          gate.activeRateMin
        )


    candidates.push({
      code: "CTRL+A",

      score:
        buildScore(strength)
    })
  }


  // =========================
  // CTRL+V
  // =========================

  if (
    gates["CTRL+V"]
  ) {
    const gate =
      config.gates["CTRL+V"]

    const weight =
      weights["CTRL+V"]


    const socialDominance =
      clamp01(
        Math.max(
          0,
          features
            .socialDominanceGap
        ) / 0.5
      )


    const strength =
      weight.social *
        normalizeHigh(
          features.socialRate,
          gate.socialRateMin
        ) +

      weight
        .socialDominance *
        socialDominance +

      weight.outing *
        features.outingRate


    candidates.push({
      code: "CTRL+V",

      score:
        buildScore(strength)
    })
  }


  // =========================
  // BUG
  // =========================

  if (gates.BUG) {
    const gate =
      config.gates.BUG

    const gateForN =
      getBugGateConfig(
        features.n
      )

    const weight =
      weights.BUG


    const strength =
      weight
        .numericVariation *
        normalizeHigh(
          features
            .numericVariation,
          gateForN
            .numericVariationWeak
        ) +

      weight.tagVariation *
        normalizeHigh(
          features
            .tagVariation,
          gateForN
            .tagVariationRequired
        ) +

      weight
        .totalVariation *
        normalizeHigh(
          features
            .totalVariation,
          gate
            .totalVariationMin
        )


    candidates.push({
      code: "BUG",

      score:
        buildScore(strength)
    })
  }


  // =========================
  // F5
  // =========================

  if (gates.F5) {
    const gate =
      config.gates.F5

    const weight =
      weights.F5

    const trendThreshold =
      getF5TrendThreshold(
        features.n
      )


    const strength =
      weight.trend *
        normalizeHigh(
          features.trend,
          trendThreshold
        ) +

      weight
        .productiveImprovement *
        clamp01(
          features
            .productiveImprovement
        ) +

      weight
        .energyImprovement *
        normalizeHigh(
          features
            .energyImprovement,
          gate
            .componentImprovementMin
        ) +

      weight
        .moodImprovement *
        normalizeHigh(
          features
            .moodImprovement,
          gate
            .componentImprovementMin
        ) +

      weight
        .activeImprovement *
        normalizeHigh(
          features
            .activeImprovement,
          gate
            .componentImprovementMin
        )


    candidates.push({
      code: "F5",

      score:
        buildScore(strength)
    })
  }


  return candidates.sort(
    (a, b) =>
      b.score - a.score
  )
}


/**
 * 候选列表里有没有某个人格。
 */
function hasCode(
  candidates,
  code
) {
  return candidates.some(
    candidate =>
      candidate.code === code
  )
}


/**
 * 从候选列表删除某个人格。
 */
function removeCode(
  candidates,
  code
) {
  return candidates.filter(
    candidate =>
      candidate.code !== code
  )
}


/**
 * 解决具有明确语义关系的人格冲突。
 */
function resolveConflicts(
  candidates,
  features
) {
  let remaining =
    candidates.slice()


  if (
    remaining.length <= 1
  ) {
    return remaining
  }


  /**
   * F5 是比较稀有、
   * 而且具有明确方向性的状态。
   *
   * 严格 Gate 已经通过时，
   * 认为“恢复趋势”比单纯波动
   * 更具有解释力。
   */
  if (
    hasCode(
      remaining,
      "F5"
    )
  ) {
    return remaining.filter(
      candidate =>
        candidate.code ===
        "F5"
    )
  }


  /**
   * NPC 属于次级模式。
   *
   * 如果同时存在其他鲜明人格，
   * NPC 主动让位。
   */
  if (
    hasCode(
      remaining,
      "NPC"
    ) &&
    remaining.length > 1
  ) {
    remaining =
      removeCode(
        remaining,
        "NPC"
      )
  }


  /**
   * 404 vs LOW BATTERY
   */
  if (
    hasCode(
      remaining,
      "404"
    ) &&
    hasCode(
      remaining,
      "LOW BATTERY"
    )
  ) {
    const rule =
      config.conflicts
        .homeVsLowBattery

    const lowBatteryWins =
      features.energyMean <=
        rule
          .veryLowEnergyMean ||

      features
        .lowestEnergyRate >=
        rule
          .veryLowEnergyRate

    remaining =
      removeCode(
        remaining,

        lowBatteryWins
          ? "404"
          : "LOW BATTERY"
      )
  }


  /**
   * 404 vs ESC
   *
   * 一直宅家摸鱼：
   * 更符合“活人未检出”。
   */
  if (
    hasCode(
      remaining,
      "404"
    ) &&
    hasCode(
      remaining,
      "ESC"
    )
  ) {
    remaining =
      removeCode(
        remaining,
        "ESC"
      )
  }


  /**
   * LOW BATTERY vs ESC
   *
   * 真没电时，
   * 不把它解释成单纯摸鱼。
   */
  if (
    hasCode(
      remaining,
      "LOW BATTERY"
    ) &&
    hasCode(
      remaining,
      "ESC"
    )
  ) {
    remaining =
      removeCode(
        remaining,
        "ESC"
      )
  }


  /**
   * 404 vs BUG
   */
  if (
    hasCode(
      remaining,
      "404"
    ) &&
    hasCode(
      remaining,
      "BUG"
    )
  ) {
    const bugWins =
      features
        .numericVariation >=
      config.conflicts
        .homeVsBug
        .numericVariationForBug

    remaining =
      removeCode(
        remaining,

        bugWins
          ? "404"
          : "BUG"
      )
  }


  /**
   * LOW BATTERY vs BUG
   */
  if (
    hasCode(
      remaining,
      "LOW BATTERY"
    ) &&
    hasCode(
      remaining,
      "BUG"
    )
  ) {
    const bugWins =
      features.energySwing >=
      config.conflicts
        .lowBatteryVsBug
        .energySwingForBug

    remaining =
      removeCode(
        remaining,

        bugWins
          ? "LOW BATTERY"
          : "BUG"
      )
  }


  /**
   * CTRL+A vs CTRL+V
   */
  if (
    hasCode(
      remaining,
      "CTRL+A"
    ) &&
    hasCode(
      remaining,
      "CTRL+V"
    )
  ) {
    const rule =
      config.conflicts
        .ctrlAVsCtrlV


    const socialDominant =
      features.socialRate >=
        rule
          .veryStrongSocialRate &&

      (
        features
          .socialDominanceGap >
          rule
            .socialOtherGap ||

        features
          .periodDomainCount <=
          rule
            .sparseDomainMax
      )


    remaining =
      removeCode(
        remaining,

        socialDominant
          ? "CTRL+A"
          : "CTRL+V"
      )
  }


  /**
   * CTRL+A vs BUG
   */
  if (
    hasCode(
      remaining,
      "CTRL+A"
    ) &&
    hasCode(
      remaining,
      "BUG"
    )
  ) {
    const bugWins =
      features
        .numericVariation >=
      config.conflicts
        .ctrlAVsBug
        .numericVariationForBug

    remaining =
      removeCode(
        remaining,

        bugWins
          ? "CTRL+A"
          : "BUG"
      )
  }


  return remaining
}


/**
 * 特殊冲突解决以后，
 * 用得分和兜底优先级决定最终人格。
 */
function chooseWinner(
  candidates
) {
  if (!candidates.length) {
    return null
  }

  if (
    candidates.length === 1
  ) {
    return candidates[0]
  }

  const sorted =
    candidates
      .slice()
      .sort(
        (a, b) =>
          b.score - a.score
      )


  const scoreGap =
    sorted[0].score -
    sorted[1].score


  if (
    scoreGap >
    config.conflicts
      .closeScoreGap
  ) {
    return sorted[0]
  }


  for (
    const code of
    config.fallbackPriority
  ) {
    const candidate =
      sorted.find(
        item =>
          item.code === code
      )

    if (candidate) {
      return candidate
    }
  }


  return sorted[0]
}


/**
 * 主入口。
 *
 * analyze() 接收的 records
 * 应该已经来自用户选择的日期范围。
 *
 * 例如：
 * recordService.listByRange(...)
 */
function analyze(records) {
  const cleanedRecords =
    sanitizeRecords(records)


  /**
   * 有效记录不足 3 天。
   */
  if (
    cleanedRecords.length <
    config.minValidDays
  ) {
    return {
      code: "NO DATA",

      score: null,

      validDays:
        cleanedRecords.length,

      algorithmVersion:
        config.algorithmVersion,

      candidates: [],

      gates: null,

      features: null
    }
  }


  /**
   * 原始记录
   * ↓
   * 0~1 标准化
   */
  const normalizedRecords =
    cleanedRecords.map(
      normalizeRecord
    )


  /**
   * 标准化记录
   * ↓
   * 特征
   */
  const features =
    calculateFeatures(
      normalizedRecords
    )


  /**
   * 特征
   * ↓
   * Gate
   */
  const gates =
    checkGates(features)


  /**
   * Gate
   * ↓
   * 候选人格得分
   */
  const candidates =
    calculateScores(
      features,
      gates
    )


  /**
   * 没有任何人格通过 Gate：
   * RUN。
   */
  if (
    !candidates.length
  ) {
    return {
      code: "RUN",

      score: null,

      validDays:
        cleanedRecords.length,

      algorithmVersion:
        config.algorithmVersion,

      candidates: [],

      gates,

      features
    }
  }


  /**
   * 先解决明确的人格语义冲突。
   */
  const resolvedCandidates =
    resolveConflicts(
      candidates,
      features
    )


  /**
   * 最后选冠军。
   */
  const winner =
    chooseWinner(
      resolvedCandidates
    )


  return {
    code:
      winner
        ? winner.code
        : "RUN",

    score:
      winner
        ? winner.score
        : null,

    validDays:
      cleanedRecords.length,

    algorithmVersion:
      config.algorithmVersion,

    /**
     * 保留所有原始候选。
     *
     * 以后调试非常有用：
     *
     * [
     *   { code: "404", score: 86 },
     *   { code: "NPC", score: 74 }
     * ]
     */
    candidates,

    gates,

    features
  }
}


module.exports = {
  analyze
}
