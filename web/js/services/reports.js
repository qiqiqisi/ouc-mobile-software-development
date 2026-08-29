import {
  getJSON,
  setJSON
} from "../shared/storage.js"


export const STORAGE_KEY =
  "bugti_web_reports_v1"


const MAX_REPORTS = 30


function getAllReports() {
  const reports =
    getJSON(STORAGE_KEY, [])

  return Array.isArray(reports)
    ? reports
    : []
}


function saveAllReports(reports) {
  if (!setJSON(STORAGE_KEY, reports)) {
    throw new Error(
      "reports storage unavailable"
    )
  }
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


export function save(report) {
  const reports =
    getAllReports()

  const now =
    new Date().toISOString()

  const savedReport = {
    ...report,
    id:
      report.id || createId(),
    createdAt:
      report.createdAt || now,
    schemaVersion: "1.0"
  }

  reports.push(savedReport)

  reports.sort(
    (a, b) =>
      b.createdAt.localeCompare(
        a.createdAt
      )
  )

  saveAllReports(
    reports.slice(0, MAX_REPORTS)
  )

  return savedReport
}


export function getById(id) {
  return (
    getAllReports().find(
      report =>
        report.id === id
    ) || null
  )
}


export function getLatest() {
  return listAll()[0] || null
}


export function listAll() {
  return getAllReports()
    .slice()
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(
          a.createdAt
        )
    )
}
