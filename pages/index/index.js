const recordService =
  require("../../services/records")

const reportService =
  require("../../services/reports")

const fortuneService =
  require("../../services/fortune")

const {
  getPersonality
} =
  require("../../config/personalities")

const {
  CARD_BACK_IMAGE,
  getFortuneDisplay
} =
  require("../../config/fortunes")


function wait(milliseconds) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  )
}


function getGeneralShareConfig() {
  return {
    title:
      "BUGTI｜测测你最近是什么 Bug，顺便抽一下今日运势",
    path:
      "/pages/index/index?fromShare=app",
    imageUrl:
      CARD_BACK_IMAGE
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

Page({
  onShow() {
    if (this.data.today) {
      this.loadHomeData()
      this.loadFortuneData()
    }
  },
  loadHomeData() {
    const records = recordService.listAll()
  
    const todayRecord =
      recordService.getByDate(this.data.today)
  
    const recordedDays = records.length
  
    let recentRecord = null

    let recentResult = null
  
    if (records.length > 0) {
      const record = records[0]
  
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
  
      recentRecord = {
        date: record.date,
  
        summary:
          `${moodEmojis[record.mood] || ""} ` +
          `${energyEmojis[record.energy] || ""} · ` +
          record.tags.join(" · ")
      }
    }

    const latestReport =
      reportService.getLatest()

    if (latestReport) {
      const personality =
        getPersonality(
          latestReport.code
        )

      if (personality) {
        recentResult = {
          id: latestReport.id,
          code: personality.code,
          name: personality.name,
          tagline: personality.tagline,
          startDate:
            latestReport.startDate,
          endDate:
            latestReport.endDate,
          validDays:
            latestReport.validDays,
          coverageRate:
            typeof latestReport
              .coverageRate ===
              "number"
              ? latestReport
                .coverageRate
              : null
        }
      }
    }
  
    this.setData({
      hasTodayRecord: Boolean(todayRecord),
      recordedDays,
      recentRecord,
      recentResult
    })
  },

  loadFortuneData() {
    const state =
      fortuneService
        .getTodayState()

    const fortune =
      state.latestFortuneId
        ? getFortuneDisplay(
          state.latestFortuneId,
          state.latestVariantIndex
        )
        : null

    this.setData({
      fortune,
      fortuneImage:
        fortune
          ? fortune.image
          : CARD_BACK_IMAGE,
      fortuneDrawCount:
        state.drawCount
    })
  },

  loadSharedFortune(options) {
    if (
      !options ||
      options.fromShare !==
        "fortune"
    ) {
      this.setData({
        sharedFortunePreview:
          null
      })

      return
    }

    const variant =
      Number(options.variant)

    const sharedFortunePreview =
      options.variant !== undefined &&
      options.variant !== null &&
      options.variant !== "" &&
      Number.isInteger(variant)
        ? getFortuneDisplay(
          options.fortuneId,
          variant
        )
        : null

    this.setData({
      sharedFortunePreview
    })
  },

  async drawFortune() {
    if (this._fortuneDrawing) {
      return
    }

    this._fortuneDrawing = true

    this.setData({
      fortuneAnimating: true
    })

    try {
      await wait(200)

      const result =
        fortuneService
          .drawFortune()

      this.setData({
        fortune:
          result.fortune,
        fortuneImage:
          result.fortune.image,
        fortuneDrawCount:
          result.state.drawCount,
        sharedFortunePreview:
          null
      })

      await wait(300)
    } catch (error) {
      console.error(
        "抽取今日运势失败：",
        error
      )

      wx.showToast({
        title:
          "系统今天有点迷信失败",
        icon:
          "none"
      })
    } finally {
      this._fortuneDrawing = false

      this.setData({
        fortuneAnimating: false
      })
    }
  },

  onShareAppMessage(event) {
    const generalShare =
      getGeneralShareConfig()

    try {
      if (
        !event ||
        event.from === "menu"
      ) {
        return generalShare
      }

      let shareKind = null

      if (
        event.from === "button" &&
        event.target &&
        event.target.dataset
      ) {
        shareKind =
          event.target.dataset
            .shareKind
      }

      if (
        shareKind !== "fortune" ||
        !this.data.fortune
      ) {
        return generalShare
      }

      const fortune =
        getFortuneDisplay(
          this.data.fortune.id,
          this.data.fortune
            .variantIndex
        )

      if (!fortune) {
        return generalShare
      }

      return {
        title:
          fortune.id ===
            "draw_again"
            ? "我把 BUGTI 今日一抽抽成了穷举"
            : `我今天抽到「${fortune.title}」｜BUGTI 今日一抽`,
        path:
          "/pages/index/index" +
          `?fromShare=fortune&fortuneId=${fortune.id}` +
          `&variant=${fortune.variantIndex}`,
        imageUrl:
          fortune.image
      }
    } catch (error) {
      return generalShare
    }
  },

  data: {
    today: "",

    // 下一阶段会从本地数据层读取
    hasTodayRecord: false,
    recordedDays: 0,
    unlockDays: 3,

    recentRecord: null,
    recentResult: null,

    fortune: null,
    fortuneImage:
      CARD_BACK_IMAGE,
    fortuneDrawCount: 0,
    fortuneAnimating: false,
    sharedFortunePreview: null
  },

  onLoad(options) {
    const today = formatDate(new Date())
  
    this.setData({
      today
    })

    wx.showShareMenu({
      menus: [
        "shareAppMessage"
      ]
    })

    this.loadSharedFortune(
      options
    )
  
    this.loadHomeData()
    this.loadFortuneData()
  },

  // 记录今天 / 编辑今天
  goToTodayRecord() {
    wx.navigateTo({
      url: `/pages/record/record?date=${this.data.today}`
    })
  },

  // 补过去的记录
  onBackfillDateChange(event) {
    const date = event.detail.value

    wx.navigateTo({
      url: `/pages/record/record?date=${date}`
    })
  },

  // 查看历史
  goToHistory() {
    wx.navigateTo({
      url: "/pages/history/history"
    })
  },

  // 去检测
  goToAnalyze() {
    wx.navigateTo({
      url: "/pages/analyze/analyze"
    })
  },

  // 查看最近结果
  goToRecentResult() {
    if (!this.data.recentResult) {
      return
    }

    wx.navigateTo({
      url:
        `/pages/result/result?reportId=${this.data.recentResult.id}`
    })
  }
})
