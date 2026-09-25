function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

Component({
  properties: {
    current: {
      type: String,
      value: "home"
    }
  },

  methods: {
    goRoot(event) {
      const key = event.currentTarget.dataset.key
      if (!key || key === this.data.current) return
      const routes = {
        home: "/pages/index/index",
        log: "/pages/history/history",
        bug: "/pages/analyze/analyze",
        pet: "/pages/pet-home/pet-home"
      }
      const url = routes[key]
      if (!url) return
      wx.redirectTo({ url })
    },

    goRecord() {
      const today = formatDate(new Date())
      wx.navigateTo({ url: `/pages/record/record?date=${today}` })
    }
  }
})
