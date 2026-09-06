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

const recordService =
  require(
    "../../services/records"
  )

const wordCloudService =
  require(
    "../../services/wordcloud"
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


function getPixelRatio() {
  try {
    if (
      wx.getWindowInfo
    ) {
      const info =
        wx.getWindowInfo()

      if (
        info &&
        info.pixelRatio
      ) {
        return info.pixelRatio
      }
    }
  } catch (error) {
    console.warn(
      "读取窗口 DPR 失败：",
      error
    )
  }

  try {
    const info =
      wx.getSystemInfoSync()

    return info.pixelRatio || 1
  } catch (error) {
    return 1
  }
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
      null,

    wordCloudHasWords:
      false,

    wordCloudSubtitle:
      "",

    wordCloudRenderFailed:
      false
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


    const wordCloudInfo =
      this.prepareWordCloud(
        report
      )


    this.wordCloudSnapshot =
      wordCloudInfo.snapshot

    this.wordCloudVariant = 0


    this.setData({
      personality,

      dateRange,

      confidenceText,

      report,

      wordCloudHasWords:
        wordCloudInfo.snapshot.words.length > 0,

      wordCloudSubtitle:
        wordCloudInfo.subtitle
    })
  },


  onReady() {
    this.pageReady = true
    this.queueWordCloudRender()
  },


  prepareWordCloud(report) {
    if (
      report.wordCloud &&
      Array.isArray(
        report.wordCloud.words
      )
    ) {
      const validDays =
        typeof report.wordCloud.validDays ===
          "number"
          ? report.wordCloud.validDays
          : report.validDays || 0

      return {
        snapshot: {
          ...report.wordCloud,
          validDays
        },
        legacy: false,
        subtitle:
          this.getWordCloudSubtitle(
            validDays,
            report.wordCloud.words.length,
            false
          )
      }
    }


    const records =
      recordService.listByRange(
        report.startDate,
        report.endDate
      )

    const snapshot =
      wordCloudService.createSnapshot(
        records,
        {
          startDate:
            report.startDate,
          endDate:
            report.endDate,
          includeNote:
            true
        }
      )

    return {
      snapshot,
      legacy: true,
      subtitle:
        this.getWordCloudSubtitle(
          snapshot.validDays,
          snapshot.words.length,
          true
        )
    }
  },


  getWordCloudSubtitle(
    validDays,
    wordCount,
    legacy
  ) {
    if (validDays === 0) {
      return legacy
        ? "旧结果当时还没有保存词云，目前也找不到对应记录。"
        : "没有记录，词云也只能表演留白。"
    }

    let text =
      `从 ${validDays} 个记录日里捞出了 ${wordCount} 个词`

    if (validDays <= 2) {
      text +=
        " · 记录较少，看个热闹"
    }

    if (legacy) {
      text +=
        " · 旧结果按当前记录补生成"
    }

    return text
  },


  queueWordCloudRender() {
    if (
      !this.pageReady ||
      !this.data.wordCloudHasWords
    ) {
      return
    }

    wx.nextTick(() => {
      this.renderWordCloud()
    })
  },


  renderWordCloud() {
    if (
      !this.wordCloudSnapshot ||
      !this.data.wordCloudHasWords
    ) {
      return
    }

    const query =
      wx.createSelectorQuery()
        .in(this)

    query
      .select("#wordCloudCanvas")
      .fields({
        node: true,
        size: true
      })
      .exec(result => {
        const target =
          result && result[0]

        if (
          !target ||
          !target.node ||
          !target.width ||
          !target.height
        ) {
          console.error(
            "词云 Canvas 初始化失败：",
            target
          )

          this.setData({
            wordCloudRenderFailed:
              true
          })

          return
        }

        try {
          const drawResult =
            wordCloudService.drawWordCloud(
              target.node,
              this.wordCloudSnapshot,
              {
                width:
                  target.width,
                height:
                  target.height,
                dpr:
                  getPixelRatio(),
                variant:
                  this.wordCloudVariant
              }
            )

          this.setData({
            wordCloudRenderFailed:
              drawResult.placedCount === 0
          })

          if (
            drawResult.placedCount <
            drawResult.totalCount
          ) {
            console.info(
              "词云部分小词因空间不足被省略：",
              drawResult
            )
          }
        } catch (error) {
          console.error(
            "词云绘制失败：",
            error
          )

          this.setData({
            wordCloudRenderFailed:
              true
          })
        }
      })
  },


  changeWordCloudLayout() {
    if (!this.data.wordCloudHasWords) {
      return
    }

    this.wordCloudVariant =
      (this.wordCloudVariant || 0) + 1

    this.setData({
      wordCloudRenderFailed:
        false
    }, () => {
      this.renderWordCloud()
    })
  }
})
