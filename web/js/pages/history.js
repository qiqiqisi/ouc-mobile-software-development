import {
  listByRange
} from "../services/records.js"

import {
  formatDateParts,
  getTodayString
} from "../shared/date.js"

import {
  goBack
} from "../shared/ui.js"


const MOOD_EMOJIS = [
  "",
  "😫",
  "🙁",
  "😐",
  "🙂",
  "😆"
]

const todayDate = new Date()
const today = getTodayString()

let year =
  todayDate.getFullYear()
let month =
  todayDate.getMonth() + 1


function renderCalendar() {
  const firstDay =
    new Date(year, month - 1, 1)

  const daysInMonth =
    new Date(year, month, 0)
      .getDate()

  const firstWeekday =
    (firstDay.getDay() + 6) % 7

  const startDate =
    formatDateParts(
      year,
      month,
      1
    )

  const endDate =
    formatDateParts(
      year,
      month,
      daysInMonth
    )

  const records =
    listByRange(
      startDate,
      endDate
    )

  const recordMap =
    new Map(
      records.map(
        record => [
          record.date,
          record
        ]
      )
    )

  document.querySelector(
    "#month-title"
  ).textContent =
    `${year}年${month}月`

  document.querySelector(
    "#month-record-count"
  ).textContent =
    String(records.length)

  const grid =
    document.querySelector(
      "#calendar-grid"
    )

  grid.replaceChildren()

  for (
    let index = 0;
    index < firstWeekday;
    index += 1
  ) {
    const empty =
      document.createElement(
        "div"
      )

    empty.className =
      "day-cell is-empty"
    grid.appendChild(empty)
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day += 1
  ) {
    const date =
      formatDateParts(
        year,
        month,
        day
      )

    const record =
      recordMap.get(date) || null

    const isFuture =
      date > today

    const cell =
      document.createElement(
        "button"
      )

    cell.type = "button"
    cell.className = "day-cell"
    cell.disabled = isFuture
    cell.setAttribute(
      "aria-label",
      `${date}${record ? "，有记录" : ""}`
    )

    const card =
      document.createElement("span")

    card.className = "day-card"

    if (record) {
      card.classList.add(
        "has-record"
      )
    }

    if (date === today) {
      card.classList.add(
        "is-today"
      )
    }

    if (isFuture) {
      card.classList.add(
        "is-future"
      )
    }

    const number =
      document.createElement("span")

    number.className = "day-number"
    number.textContent = String(day)
    card.appendChild(number)

    if (record) {
      const moodSlot =
        document.createElement("span")

      moodSlot.className =
        "day-mood-slot"

      const mood =
        document.createElement("span")

      mood.className = "day-mood"
      mood.textContent =
        MOOD_EMOJIS[record.mood] || ""

      moodSlot.appendChild(mood)
      card.appendChild(moodSlot)
    }

    cell.appendChild(card)

    if (!isFuture) {
      cell.addEventListener(
        "click",
        () => {
          window.location.href =
            `./record.html?date=${date}`
        }
      )
    }

    grid.appendChild(cell)
  }

  const atCurrentMonth =
    year === todayDate.getFullYear() &&
    month === todayDate.getMonth() + 1

  document.querySelector(
    "#next-month"
  ).disabled = atCurrentMonth
}


document.querySelector(
  ".page-back"
).addEventListener(
  "click",
  () => goBack()
)

document.querySelector(
  "#previous-month"
).addEventListener(
  "click",
  () => {
    month -= 1

    if (month < 1) {
      month = 12
      year -= 1
    }

    renderCalendar()
  }
)

document.querySelector(
  "#next-month"
).addEventListener(
  "click",
  () => {
    const nextDate =
      new Date(year, month, 1)

    const nextYear =
      nextDate.getFullYear()

    const nextMonth =
      nextDate.getMonth() + 1

    if (
      nextYear > todayDate.getFullYear() ||
      (
        nextYear === todayDate.getFullYear() &&
        nextMonth > todayDate.getMonth() + 1
      )
    ) {
      return
    }

    year = nextYear
    month = nextMonth
    renderCalendar()
  }
)


renderCalendar()


window.addEventListener(
  "pageshow",
  event => {
    if (event.persisted) {
      renderCalendar()
    }
  }
)
