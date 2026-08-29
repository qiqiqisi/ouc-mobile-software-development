const recordService =
  require("../../services/records")


const MOOD_EMOJIS = [
  "",
  "😫",
  "🙁",
  "😐",
  "🙂",
  "😆"
]


function padNumber(number) {
  return String(number).padStart(2, "0")
}


function formatDate(year, month, day) {
  return (
    `${year}-` +
    `${padNumber(month)}-` +
    `${padNumber(day)}`
  )
}


function getTodayString() {
  const today = new Date()

  return formatDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  )
}


Page({
  data: {
    year: 0,
    month: 0,

    monthTitle: "",

    weekNames: [
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
      "日"
    ],

    calendarDays: [],

    monthRecordCount: 0,

    today: ""
  },


  onLoad() {
    const today = new Date()

    this.setData({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      today: getTodayString()
    })
  },


  onShow() {
    if (
      this.data.year &&
      this.data.month
    ) {
      this.loadCalendar()
    }
  },


  loadCalendar() {
    const year = this.data.year
    const month = this.data.month

    const firstDay =
      new Date(year, month - 1, 1)

    const daysInMonth =
      new Date(year, month, 0)
        .getDate()

    // JS：周日=0，周一=1...
    // 我们的日历从周一开始，因此转换成：
    // 周一=0 ... 周日=6
    const firstWeekday =
      (firstDay.getDay() + 6) % 7

    const startDate =
      formatDate(year, month, 1)

    const endDate =
      formatDate(
        year,
        month,
        daysInMonth
      )

    const records =
      recordService.listByRange(
        startDate,
        endDate
      )

    const recordMap = {}

    records.forEach(record => {
      recordMap[record.date] = record
    })

    const calendarDays = []


    // 月初前面的空格
    for (
      let i = 0;
      i < firstWeekday;
      i += 1
    ) {
      calendarDays.push({
        empty: true
      })
    }


    // 本月日期
    for (
      let day = 1;
      day <= daysInMonth;
      day += 1
    ) {
      const date =
        formatDate(
          year,
          month,
          day
        )

      const record =
        recordMap[date] || null

      calendarDays.push({
        empty: false,

        day,
        date,

        isToday:
          date === this.data.today,

        isFuture:
          date > this.data.today,

        hasRecord:
          Boolean(record),

        moodEmoji:
          record
            ? MOOD_EMOJIS[
                record.mood
              ] || ""
            : ""
      })
    }


    this.setData({
      monthTitle:
        `${year}年${month}月`,

      calendarDays,

      monthRecordCount:
        records.length
    })
  },


  goPreviousMonth() {
    let year = this.data.year
    let month = this.data.month - 1

    if (month < 1) {
      month = 12
      year -= 1
    }

    this.setData({
      year,
      month
    })

    this.loadCalendar()
  },


  goNextMonth() {
    let year = this.data.year
    let month = this.data.month + 1

    if (month > 12) {
      month = 1
      year += 1
    }

    const today = new Date()

    const currentYear =
      today.getFullYear()

    const currentMonth =
      today.getMonth() + 1


    // 不允许翻到未来月份
    if (
      year > currentYear ||
      (
        year === currentYear &&
        month > currentMonth
      )
    ) {
      return
    }


    this.setData({
      year,
      month
    })

    this.loadCalendar()
  },


  tapDay(event) {
    const date =
      event.currentTarget.dataset.date

    const isFuture =
      event.currentTarget.dataset.future

    if (!date || isFuture) {
      return
    }

    wx.navigateTo({
      url:
        `/pages/record/record?date=${date}`
    })
  }
})