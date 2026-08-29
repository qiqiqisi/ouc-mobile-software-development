const STORAGE_KEY =
  "bugti_analysis_reports"

const MAX_REPORTS = 30


function getAllReports() {
  const reports =
    wx.getStorageSync(
      STORAGE_KEY
    )

  return Array.isArray(reports)
    ? reports
    : []
}


function saveAllReports(reports) {
  wx.setStorageSync(
    STORAGE_KEY,
    reports
  )
}


function createId() {
  const random =
    Math.random()
      .toString(36)
      .slice(2, 8)

  return (
    `report_${Date.now()}_${random}`
  )
}


function save(report) {
  const reports =
    getAllReports()

  const now =
    new Date().toISOString()

  const savedReport = {
    ...report,

    id:
      report.id ||
      createId(),

    createdAt:
      report.createdAt ||
      now,

    schemaVersion:
      "1.0"
  }

  reports.push(
    savedReport
  )

  reports.sort(
    (a, b) =>
      b.createdAt.localeCompare(
        a.createdAt
      )
  )

  const limitedReports =
    reports.slice(
      0,
      MAX_REPORTS
    )

  saveAllReports(
    limitedReports
  )

  return savedReport
}


function getById(id) {
  const reports =
    getAllReports()

  return (
    reports.find(
      report =>
        report.id === id
    ) || null
  )
}


function getLatest() {
  const reports =
    getAllReports()
      .slice()
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(
            a.createdAt
          )
      )

  return reports[0] || null
}


function listAll() {
  return getAllReports()
    .slice()
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(
          a.createdAt
        )
    )
}


module.exports = {
  save,
  getById,
  getLatest,
  listAll
}