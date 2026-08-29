const recordService =
  require("../../services/records")

const analyzer =
  require("../../services/analyzer")

const reportService =
  require("../../services/reports")


function padNumber(number) {
  return String(number)
    .padStart(2, "0")
}


function formatDate(date) {
  return (
    `${date.getFullYear()}-` +
    `${padNumber(
      date.getMonth() + 1
    )}-` +
    `${padNumber(
      date.getDate()
    )}`
  )
}


function offsetDate(
  date,
  offsetDays
) {
  const result =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )

  result.setDate(
    result.getDate() +
    offsetDays
  )

  return result
}


function parseDateParts(
  dateString
) {
  const parts =
    dateString
      .split("-")
      .map(Number)

  return {
    year: parts[0],
    month: parts[1],
    day: parts[2]
  }
}


/**
 * 计算日期范围包含多少个自然日。
 *
 * 例如：
 * 8月20日 ~ 8月26日
 * 一共 7 天。
 *
 * 这里使用 Date.UTC，
 * 避免纯日期被时区转换影响。
 */
function calculateRangeDays(
  startDate,
  endDate
) {
  const start =
    parseDateParts(
      startDate
    )

  const end =
    parseDateParts(
      endDate
    )

  const startTime =
    Date.UTC(
      start.year,
      start.month - 1,
      start.day
    )

  const endTime =
    Date.UTC(
      end.year,
      end.month - 1,
      end.day
    )

  return (
    Math.floor(
      (
        endTime -
        startTime
      ) /
      (
        24 *
        60 *
        60 *
        1000
      )
    ) + 1
  )
}


Page({
  data: {
    mode: "7d",

    today: "",

    startDate: "",
    endDate: "",

    rangeDays: 7,

    validDays: 0,

    coverageRate: 0,

    coveragePercent: 0,

    canAnalyze: false
  },


  onLoad() {
    const today =
      new Date()

    const todayString =
      formatDate(today)

    const startDate =
      formatDate(
        offsetDate(
          today,
          -6
        )
      )

    this.setData({
      today:
        todayString,

      startDate,

      endDate:
        todayString,

      rangeDays:
        7
    })

    this.loadRangeStats()
  },


  onShow() {
    if (
      this.data.startDate &&
      this.data.endDate
    ) {
      this.loadRangeStats()
    }
  },


  selectMode(event) {
    const mode =
      event.currentTarget
        .dataset.mode

    if (
      mode ===
      this.data.mode
    ) {
      return
    }


    if (
      mode === "custom"
    ) {
      this.setData({
        mode
      })

      return
    }


    const days =
      mode === "30d"
        ? 30
        : 7

    const today =
      new Date()

    const startDate =
      formatDate(
        offsetDate(
          today,
          -(days - 1)
        )
      )

    const endDate =
      formatDate(today)

    this.setData({
      mode,

      startDate,

      endDate,

      rangeDays:
        days
    })

    this.loadRangeStats()
  },


  onStartDateChange(event) {
    const startDate =
      event.detail.value

    this.setData({
      mode:
        "custom",

      startDate
    })

    this.refreshCustomRange()
  },


  onEndDateChange(event) {
    const endDate =
      event.detail.value

    this.setData({
      mode:
        "custom",

      endDate
    })

    this.refreshCustomRange()
  },


  refreshCustomRange() {
    const startDate =
      this.data.startDate

    const endDate =
      this.data.endDate


    if (
      !startDate ||
      !endDate
    ) {
      return
    }


    if (
      startDate >
      endDate
    ) {
      this.setData({
        rangeDays:
          0,

        validDays:
          0,

        coverageRate:
          0,

        coveragePercent:
          0,

        canAnalyze:
          false
      })

      return
    }


    const rangeDays =
      calculateRangeDays(
        startDate,
        endDate
      )


    this.setData({
      rangeDays
    })

    this.loadRangeStats()
  },


  loadRangeStats() {
    const startDate =
      this.data.startDate

    const endDate =
      this.data.endDate


    if (
      !startDate ||
      !endDate ||
      startDate >
      endDate
    ) {
      this.setData({
        validDays:
          0,

        coverageRate:
          0,

        coveragePercent:
          0,

        canAnalyze:
          false
      })

      return
    }


    const rangeDays =
      calculateRangeDays(
        startDate,
        endDate
      )


    const records =
      recordService
        .listByRange(
          startDate,
          endDate
        )


    const validDays =
      records.length


    const rangeValid =
      rangeDays >= 3 &&
      rangeDays <= 90


    const coverageRate =
      rangeValid
        ? validDays / rangeDays
        : 0


    this.setData({
      rangeDays,

      validDays,

      coverageRate,

      coveragePercent:
        Math.round(
          coverageRate * 100
        ),

      canAnalyze:
        rangeValid
    })
  },


  runAnalysis() {
    const startDate =
      this.data.startDate

    const endDate =
      this.data.endDate


    if (
      startDate >
      endDate
    ) {
      wx.showToast({
        title:
          "开始日期不能晚于结束日期",

        icon:
          "none"
      })

      return
    }


    const rangeDays =
      calculateRangeDays(
        startDate,
        endDate
      )


    if (
      rangeDays < 3
    ) {
      wx.showToast({
        title:
          "检测范围至少 3 天",

        icon:
          "none"
      })

      return
    }


    if (
      rangeDays > 90
    ) {
      wx.showToast({
        title:
          "检测范围最多 90 天",

        icon:
          "none"
      })

      return
    }


    const records =
      recordService
        .listByRange(
          startDate,
          endDate
        )


    try {
      const result =
        analyzer.analyze(
          records
        )


      const coverageRate =
        result.validDays /
        rangeDays


      const report =
        reportService.save({
          startDate,

          endDate,

          rangeDays,

          validDays:
            result.validDays,

          coverageRate,

          code:
            result.code,

          score:
            result.score,

          algorithmVersion:
            result.algorithmVersion,

          candidates:
            result.candidates,

          gates:
            result.gates,

          features:
            result.features
        })


      wx.navigateTo({
        url:
          `/pages/result/result?reportId=${report.id}`
      })

    } catch (error) {
      console.error(
        "人格分析失败：",
        error
      )

      wx.showToast({
        title:
          "检测失败，请重试",

        icon:
          "none"
      })
    }
  }
})
