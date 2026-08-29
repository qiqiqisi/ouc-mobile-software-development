export function padNumber(number) {
  return String(number)
    .padStart(2, "0")
}


export function formatLocalDate(date) {
  return (
    `${date.getFullYear()}-` +
    `${padNumber(date.getMonth() + 1)}-` +
    `${padNumber(date.getDate())}`
  )
}


export function getTodayString() {
  return formatLocalDate(
    new Date()
  )
}


export function formatDateParts(
  year,
  month,
  day
) {
  return (
    `${year}-` +
    `${padNumber(month)}-` +
    `${padNumber(day)}`
  )
}


export function parseDateParts(
  dateString
) {
  const parts =
    String(dateString || "")
      .split("-")
      .map(Number)

  return {
    year: parts[0],
    month: parts[1],
    day: parts[2]
  }
}


export function offsetDate(
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


export function calculateRangeDays(
  startDate,
  endDate
) {
  const start =
    parseDateParts(startDate)

  const end =
    parseDateParts(endDate)

  if (
    !start.year ||
    !start.month ||
    !start.day ||
    !end.year ||
    !end.month ||
    !end.day
  ) {
    return 0
  }

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
        endTime - startTime
      ) /
      (
        24 * 60 * 60 * 1000
      )
    ) + 1
  )
}


export function formatDisplayDate(date) {
  return date
    ? date.replace(/-/g, ".")
    : ""
}
