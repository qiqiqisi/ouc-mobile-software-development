const STORAGE_KEY = "bugti_daily_records"


function getAllRecords() {
  const records = wx.getStorageSync(STORAGE_KEY)

  return Array.isArray(records)
    ? records
    : []
}


function saveAllRecords(records) {
  wx.setStorageSync(
    STORAGE_KEY,
    records
  )
}


function getByDate(date) {
  const records = getAllRecords()

  return (
    records.find(
      record => record.date === date
    ) || null
  )
}


function listAll() {
  return getAllRecords()
    .slice()
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date)
    )
}


function listByRange(startDate, endDate) {
  return getAllRecords()
    .filter(record => {
      return (
        record.date >= startDate &&
        record.date <= endDate
      )
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date)
    )
}


function upsert(record) {
  const records = getAllRecords()

  const index = records.findIndex(
    item => item.date === record.date
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


function remove(date) {
  const records = getAllRecords()

  const newRecords =
    records.filter(
      record => record.date !== date
    )

  saveAllRecords(newRecords)
}


module.exports = {
  getByDate,
  listAll,
  listByRange,
  upsert,
  remove
}