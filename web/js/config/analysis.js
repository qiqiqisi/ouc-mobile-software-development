const ANALYSIS_CONFIG = {
  algorithmVersion: "rule-v1.3",

  // =========================
  // 基础限制
  // =========================

  minValidDays: 3,

  // 原始数值标准化
  normalization: {
    mood: {
      1: 0,
      2: 0.25,
      3: 0.5,
      4: 0.75,
      5: 1
    },

    energy: {
      1: 0,
      2: 0.5,
      3: 1
    },

    busyness: {
      1: 0,
      2: 0.5,
      3: 1
    }
  },


  // =========================
  // 标签定义
  // =========================

  tags: {
    all: [
      "学习科研",
      "实习工作",
      "运动",
      "社交",
      "出门",
      "娱乐",
      "摸鱼",
      "宅家",
      "休息"
    ],

    productive: [
      "学习科研",
      "实习工作",
      "运动"
    ],

    active: [
      "学习科研",
      "实习工作",
      "运动",
      "社交",
      "出门"
    ]
  },


  // =========================
  // 生活领域
  // =========================

  domains: {
    growth: [
      "学习科研",
      "实习工作"
    ],

    movement: [
      "运动",
      "出门"
    ],

    social: [
      "社交"
    ],

    fun: [
      "娱乐"
    ],

    recovery: [
      "宅家",
      "休息",
      "摸鱼"
    ]
  },

  // 某个领域至少出现在多少比例的记录日中，
  // 才认为它是“持续存在的生活领域”
  persistentDomainRate: 0.25,


  // =========================
  // Gate
  // =========================

  gates: {

    "404": {
      homeRateMin: 0.50,
      socialRateMax: 0.34,
      outingRateMax: 0.34
    },


    "LOW BATTERY": {
      // 路径 A：
      // 平均电量低 + 经常最低档
      energyMeanMaxA: 0.40,
      lowestEnergyRateMin: 0.50,

      // 路径 B：
      // 电量中低 + 经常休息
      energyMeanMaxB: 0.50,
      restRateMin: 0.50
    },


    "NPC": {
      stabilityMin: 0.68,
      numericVariationMax: 0.22,
      tagVariationMax: 0.35
    },


    "ESC": {
      slackRateMin: 0.34,
      productiveRateMax: 0.50,
      busynessMeanMax: 0.67
    },


    "CTRL+A": {
      multiTagDayCountMin: 2,
      multiTagRateMin: 0.40,
      multiDomainRateMin: 0.30,
      averageDailyDomainsMin: 1.40,
      periodDomainCountMin: 3,
      activeRateMin: 0.60
    },


    "CTRL+V": {
      socialRateMin: 0.50
    },


    "BUG": {
      totalVariationMin: 0.34,

      // 有效记录日 = 3
      n3: {
        numericVariationStrong: 0.50,
        numericVariationWeak: 0.38,
        tagVariationRequired: 0.60
      },

      // 有效记录日 = 4~5
      n4to5: {
        numericVariationStrong: 0.36,
        numericVariationWeak: 0.28,
        tagVariationRequired: 0.50
      },

      // 有效记录日 >= 6
      n6plus: {
        numericVariationStrong: 0.34,
        numericVariationWeak: 0.25,
        tagVariationRequired: 0.45
      }
    },


    "F5": {
      minDays: 5,

      firstHalfRunScoreMax: 0.58,
      secondHalfRunScoreMin: 0.55,

      componentImprovementMin: 0.10,
      minImprovedComponents: 2,

      trendByDays: {
        n5: 0.28,
        n6to7: 0.22,
        n8plus: 0.18
      },

      behaviorReset: {
        minDays: 3,
        firstProductiveRateMax: 0.34,
        secondProductiveRateMin: 0.67,
        productiveImprovementMin: 0.50
      }
    }
  },


  // =========================
  // 运行分 K
  // 用于 F5 趋势判断
  // =========================

  runScoreWeights: {
    energy: 0.40,
    mood: 0.35,
    active: 0.25
  },


  // =========================
  // Gate 后匹配分
  // =========================

  score: {
    base: 60,
    strengthRange: 40,

    weights: {

      "404": {
        home: 0.50,
        lowSocial: 0.25,
        lowOuting: 0.25
      },


      "LOW BATTERY": {
        lowEnergy: 0.65,
        rest: 0.20,
        lowestEnergy: 0.15
      },


      "NPC": {
        stability: 0.45,
        lowNumericVariation: 0.30,
        lowTagVariation: 0.25
      },


      "ESC": {
        slack: 0.50,
        lowProductive: 0.30,
        lowBusyness: 0.20
      },


      "CTRL+A": {
        multiTagRate: 0.30,
        multiDomainRate: 0.25,
        averageDailyDomains: 0.20,
        periodDomainCount: 0.15,
        active: 0.10
      },


      "CTRL+V": {
        social: 0.75,
        socialDominance: 0.15,
        outing: 0.10
      },


      "BUG": {
        numericVariation: 0.55,
        tagVariation: 0.30,
        totalVariation: 0.15
      },


      "F5": {
        trend: 0.35,
        productiveImprovement: 0.35,
        energyImprovement: 0.10,
        moodImprovement: 0.10,
        activeImprovement: 0.10
      }
    }
  },


  // =========================
  // 冲突消解
  // =========================

  conflicts: {

    homeVsLowBattery: {
      veryLowEnergyMean: 0.25,
      veryLowEnergyRate: 2 / 3
    },


    homeVsBug: {
      numericVariationForBug: 0.50
    },


    lowBatteryVsBug: {
      energySwingForBug: 0.67
    },


    ctrlAVsCtrlV: {
      veryStrongSocialRate: 0.80,
      socialOtherGap: 0.25,
      sparseDomainMax: 3
    },


    ctrlAVsBug: {
      numericVariationForBug: 0.40
    },


    closeScoreGap: 5
  },


  // =========================
  // 无特殊规则覆盖时的兜底优先级
  // =========================

  fallbackPriority: [
    "F5",
    "LOW BATTERY",
    "404",
    "CTRL+A",
    "CTRL+V",
    "BUG",
    "ESC",
    "NPC"
  ]
}


export default ANALYSIS_CONFIG
