const clone = value => structuredClone(value)
function createDatabase(seed = {}) {
  let store = clone(seed)
  let sequence = 0
  let transactionQueue = Promise.resolve()
  const matches = (item, filter) => Object.entries(filter).every(([key, expected]) => {
    const value = item[key]
    if (expected && expected.op === 'in') return expected.values.includes(value)
    if (expected && expected.op === 'lte') return value <= expected.value
    return value === expected
  })
  const db = {
    command: { in: values => ({ op: 'in', values }), lte: value => ({ op: 'lte', value }) },
    serverDate: () => Date.now(),
    collection(name) {
      if (!store[name]) store[name] = {}
      const query = (filter = {}, orders = [], skip = 0, limit = 100) => ({
        where: filter => query(filter, orders, skip, limit),
        orderBy: (field, direction) => query(filter, orders.concat([[field, direction]]), skip, limit),
        skip: value => query(filter, orders, value, limit),
        limit: value => query(filter, orders, skip, value),
        async get() {
          let rows = Object.entries(store[name]).map(([id, data]) => ({ ...clone(data), _id: id })).filter(row => matches(row, filter))
          rows.sort((a, b) => { for (const [key, direction] of orders) { const result = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0; if (result) return direction === 'desc' ? -result : result } return 0 })
          return { data: rows.slice(skip, skip + limit) }
        },
        async count() { return { total: Object.values(store[name]).filter(row => matches(row, filter)).length } },
        async update({ data }) { for (const [id, row] of Object.entries(store[name])) if (matches(row, filter)) store[name][id] = { ...row, ...clone(data) }; return { stats: { updated: 1 } } }
      })
      return {
        ...query(),
        doc(id) {
          return {
            async get() { if (!store[name][id]) throw Object.assign(new Error('document does not exist'), { errCode: -1 }); return { data: { ...clone(store[name][id]), _id: id } } },
            async set({ data }) { store[name][id] = clone(data); return { _id: id } },
            async update({ data }) { if (!store[name][id]) throw new Error('document does not exist'); store[name][id] = { ...store[name][id], ...clone(data) }; return {} },
            async remove() { delete store[name][id]; return {} }
          }
        },
        async add({ data }) { const id = data._id || 'generated-' + (++sequence); if (store[name][id]) throw new Error('duplicate id'); store[name][id] = clone(data); return { _id: id } }
      }
    },
    runTransaction(fn) {
      const pending = transactionQueue.then(async () => { const snapshot = clone(store); try { return await fn(db) } catch (err) { store = snapshot; throw err } })
      transactionQueue = pending.catch(() => {})
      return pending
    },
    inspect: () => clone(store)
  }
  return db
}
module.exports = { createDatabase }
