const { REFERENCE_WIDTH, getPose } = require("../../config/pet-poses")

Page({
  data: {
    allowed: false,
    headX: 627,
    headBottomY: 515,
    legScalePercent: 20,
    groundY: 1057,
    output: ""
  },

  onLoad() {
    const account = wx.getAccountInfoSync && wx.getAccountInfoSync()
    const environment = account && account.miniProgram && account.miniProgram.envVersion
    const allowed = environment === "develop" || environment === "trial"
    if (!allowed) {
      wx.showToast({ title: "仅开发构建可访问", icon: "none" })
      setTimeout(() => wx.navigateBack(), 300)
      return
    }
    this.setData({ allowed: true })
    this.updateOutput()
  },

  onValueChange(event) {
    const key = event.currentTarget.dataset.key
    this.setData({ [key]: Number(event.detail.value) }, () => this.updateOutput())
  },

  updateOutput() {
    const { headX, headBottomY, legScalePercent, groundY } = this.data
    this.setData({
      output: `headFrame: { centerX: ${headX}, bottomY: ${headBottomY}, nominalSize: 500 },\nlegs: { scale: ${(legScalePercent / 100).toFixed(2)}, groundY: ${groundY} }`
    })
  },

  getPoseStyle(event) {
    return getPose(event.currentTarget.dataset.pose || "default")
  }
})
