import {
  getJSON,
  setJSON
} from "../shared/storage.js"


export const STORAGE_KEY =
  "bugti_web_records_v1"


function getAllRecords() {
  const records =
    getJSON(STORAGE_KEY, [])

  return Array.isArray(records)
    ? records
    : []
}


function saveAllRecords(records) {
  if (!setJSON(STORAGE_KEY, records)) {
    throw new Error(
      "records storage unavailable"
    )
  }
}


export function getByDate(date) {
  return (
    getAllRecords().find(
      record =>
        record.date === date
    ) || null
  )
}


export function listAll() {
  return getAllRecords()
    .slice()
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date)
    )
}


export function listByRange(
  startDate,
  endDate
) {
  return getAllRecords()
    .filter(record => (
      record.date >= startDate &&
      record.date <= endDate
    ))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date)
    )
}


export function upsert(record) {
  const records =
    getAllRecords()

  const index =
    records.findIndex(
      item =>
        item.date === record.date
    )

  const now =
    new Date().toISOString()

  const newRecord = {
    ...record,
    createdAt:
      index >= 0 &&
      records[index].createdAt
        ? records[index].createdAt
        : now,
    updatedAt: now,
    schemaVersion: "1.0"
  }

  if (index >= 0) {
    records[index] = newRecord
  } else {
    records.push(newRecord)
  }

  saveAllRecords(records)

  return newRecord
}


export function removeRecord(date) {
  const records =
    getAllRecords()
      .filter(
        record =>
          record.date !== date
      )

  saveAllRecords(records)
}
