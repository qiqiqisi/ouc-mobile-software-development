const {
  getPersonality
} =
  require(
    "../../config/personalities"
  )

const reportService =
  require(
    "../../services/reports"
  )


function formatDisplayDate(
  date
) {
  if (!date) {
    return ""
  }

  return date.replace(
    /-/g,
    "."
  )
}


Page({
  data: {
    personality:
      null,

    dateRange:
      "",

    confidenceText:
      "",

    report:
      null
  },


  onLoad(options) {
    let report = null


    if (options.reportId) {
      report =
        reportService.getById(
          options.reportId
        )
    }


    if (!report) {
      report =
        reportService
          .getLatest()
    }


    if (!report) {
      wx.showToast({
        title:
          "还没有检测结果",

        icon:
          "none"
      })

      return
    }


    const personality =
      getPersonality(
        report.code
      )


    if (!personality) {
      console.error(
        "找不到人格配置：",
        report.code
      )

      wx.showToast({
        title:
          "结果读取失败",

        icon:
          "none"
      })

      return
    }


    const dateRange =
      `${formatDisplayDate(
        report.startDate
      )} - ${formatDisplayDate(
        report.endDate
      )}`


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
          Number.isFinite(
            rawCoverageRate
          )
            ? rawCoverageRate
            : 0
        )
      )


    let confidenceText =
      `有效记录 ${report.validDays} 天` +
      ` · 数据覆盖 ${Math.round(
        coverageRate * 100
      )}%`


    if (
      typeof report.score ===
      "number"
    ) {
      confidenceText +=
        ` · 匹配 ${Math.round(
          report.score
        )}%`
    }


    this.setData({
      personality,

      dateRange,

      confidenceText,

      report
    })
  }
})
