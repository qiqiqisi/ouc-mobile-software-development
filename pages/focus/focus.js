const petService = require("../../services/pet")
const planService = require("../../services/plans")
const focusService = require("../../services/focus")
const { buildStandingLayers, buildSleepLayers } = require("../../config/pet-poses")

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function timerText(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds) || 0))
  const minutes = Math.floor(safe / 60)
  const remain = safe % 60
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`
}

Page({
  data: {
    today: "",
    mode: "setup",
    plans: [],
    pets: [],
    activePetId: "",
    selectedPlanId: "",
    selectedPlanText: "自由专注",
    selectedPetId: "",
    selectedPet: null,
    presets: [
      { work: 25, break: 5 },
      { work: 50, break: 10 },
      { work: 90, break: 15 }
    ],
    selectedWorkMinutes: 25,
    selectedBreakMinutes: 5,
    canStart: false,
    focusSummary: { totalMinutes: 0, sessions: 0, completed: 0, interrupted: 0, items: [] },

    phase: "work",
    paused: false,
    remainingSeconds: 25 * 60,
    timerText: "25:00",
    runningPetLine: "",
    focusBodyStyle: "",
    focusHeadStyle: "",
    focusSleepPoseStyle: "",
    focusSleepMaskStyle: "",
    lastResult: null
  },

  onLoad(options = {}) {
    this._requestedPlanId = options.planId || ""
    const today = formatDate(new Date())
    this.setData({ today }, () => {
      this.loadSetupData()
      this.restoreActiveSession()
    })
  },

  onShow() {
    if (!this.data.today) return
    this.loadSetupData(false)
    if (this.data.mode === "running") this.resumeTicker()
  },

  onHide() {
    this.stopTicker()
  },

  onUnload() {
    this.stopTicker()
  },

  loadSetupData(applyRequested = true) {
    const plans = planService.getDay(this.data.today).items
    const pets = petService.getProfiles().filter(item => petService.isSuitProfile(item))
    const activePetId = petService.getActiveProfileId()
    let selectedPlanId = this.data.selectedPlanId
    if (applyRequested && this._requestedPlanId && plans.some(item => item.id === this._requestedPlanId)) {
      selectedPlanId = this._requestedPlanId
      this._requestedPlanId = ""
    }
    if (selectedPlanId && !plans.some(item => item.id === selectedPlanId)) selectedPlanId = ""
    const plan = plans.find(item => item.id === selectedPlanId)

    let selectedPetId = this.data.selectedPetId
    if (!pets.some(item => item.id === selectedPetId)) {
      selectedPetId = pets.some(item => item.id === activePetId)
        ? activePetId
        : pets[0] && pets[0].id || ""
    }
    const selectedPet = pets.find(item => item.id === selectedPetId) || null

    this.setData({
      plans,
      pets,
      activePetId,
      selectedPlanId,
      selectedPlanText: plan ? plan.text : "自由专注",
      selectedPetId,
      selectedPet,
      canStart: Boolean(selectedPet),
      focusSummary: focusService.summary(this.data.today)
    }, () => this.updatePetPreview())
  },

  updatePetPreview() {
    const pet = this.data.selectedPet
    if (!pet || !petService.isSuitProfile(pet)) {
      this.setData({
        focusBodyStyle: "",
        focusHeadStyle: "",
        focusSleepPoseStyle: "",
        focusSleepMaskStyle: ""
      })
      return
    }
    const transform = petService.normalizeHeadTransform(pet.headTransform)
    const standing = buildStandingLayers("default", transform, { walking: false, walkPhase: 0 })
    const sleep = buildSleepLayers(transform)
    this.setData({
      focusBodyStyle: standing.bodyStyle,
      focusHeadStyle: this.data.phase === "break" ? sleep.headStyle : standing.headStyle,
      focusSleepPoseStyle: sleep.sleepPoseStyle,
      focusSleepMaskStyle: sleep.sleepMaskStyle
    })
  },

  selectPlan(event) {
    if (this.data.mode !== "setup") return
    const id = String(event.currentTarget.dataset.id || "")
    const plan = this.data.plans.find(item => item.id === id)
    this.setData({
      selectedPlanId: id,
      selectedPlanText: plan ? plan.text : "自由专注"
    })
  },

  selectPet(event) {
    if (this.data.mode !== "setup") return
    const id = String(event.currentTarget.dataset.id || "")
    const pet = this.data.pets.find(item => item.id === id) || null
    this.setData({ selectedPetId: id, selectedPet: pet, canStart: Boolean(pet) }, () => this.updatePetPreview())
  },

  selectPreset(event) {
    const work = Number(event.currentTarget.dataset.work) || 25
    const rest = Number(event.currentTarget.dataset.break) || 5
    this.setData({ selectedWorkMinutes: work, selectedBreakMinutes: rest })
  },

  onCustomWork(event) {
    const work = clamp(Math.round(Number(event.detail.value) || 25), 5, 120)
    const rest = work <= 30 ? 5 : work <= 60 ? 10 : 15
    this.setData({ selectedWorkMinutes: work, selectedBreakMinutes: rest })
  },

  startSession() {
    if (!this.data.canStart || !this.data.selectedPet) return
    const now = Date.now()
    const workSeconds = this.data.selectedWorkMinutes * 60
    const session = {
      version: 1,
      date: this.data.today,
      planId: this.data.selectedPlanId,
      planText: this.data.selectedPlanText,
      petId: this.data.selectedPetId,
      petName: this.data.selectedPet.name,
      workMinutes: this.data.selectedWorkMinutes,
      breakMinutes: this.data.selectedBreakMinutes,
      phase: "work",
      startedAt: new Date(now).toISOString(),
      workStartedAtMs: now,
      targetEndAt: now + workSeconds * 1000,
      remainingSeconds: workSeconds,
      paused: false,
      workRecorded: false
    }
    this._active = session
    focusService.setActive(session)
    this.setData({
      mode: "running",
      phase: "work",
      paused: false,
      remainingSeconds: workSeconds,
      timerText: timerText(workSeconds),
      runningPetLine: `${this.data.selectedPet.name}：开工。`
    }, () => {
      this.updatePetPreview()
      this.resumeTicker()
    })
  },

  restoreActiveSession() {
    const active = focusService.getActive()
    if (!active || active.date !== this.data.today) return
    const pet = this.data.pets.find(item => item.id === active.petId)
    if (!pet) {
      focusService.clearActive()
      return
    }
    this._active = active
    this.setData({
      mode: "running",
      phase: active.phase || "work",
      paused: Boolean(active.paused),
      selectedPlanId: active.planId || "",
      selectedPlanText: active.planText || "自由专注",
      selectedPetId: pet.id,
      selectedPet: pet,
      selectedWorkMinutes: active.workMinutes || 25,
      selectedBreakMinutes: active.breakMinutes || 5,
      runningPetLine: active.phase === "break" ? `${pet.name}：休息一下。` : `${pet.name}：我盯着。`
    }, () => {
      this.updatePetPreview()
      this.syncTimerFromActive()
      this.resumeTicker()
    })
  },

  resumeTicker() {
    this.stopTicker()
    if (this.data.mode !== "running") return
    this.syncTimerFromActive()
    this._timer = setInterval(() => this.syncTimerFromActive(), 500)
  },

  stopTicker() {
    clearInterval(this._timer)
    this._timer = null
  },

  syncTimerFromActive() {
    const active = this._active || focusService.getActive()
    if (!active || this.data.mode !== "running") return
    this._active = active
    let remaining = Number(active.remainingSeconds) || 0
    if (!active.paused) {
      remaining = Math.max(0, Math.ceil((Number(active.targetEndAt) - Date.now()) / 1000))
    }
    this.setData({
      phase: active.phase,
      paused: Boolean(active.paused),
      remainingSeconds: remaining,
      timerText: timerText(remaining)
    })
    if (remaining <= 0 && !active.paused) this.onPhaseExpired()
  },

  togglePause() {
    const active = this._active
    if (!active || active.phase !== "work") return
    if (active.paused) {
      active.paused = false
      active.targetEndAt = Date.now() + Math.max(0, active.remainingSeconds) * 1000
      this.setData({ paused: false, runningPetLine: `${active.petName}：继续。` })
    } else {
      active.remainingSeconds = Math.max(0, Math.ceil((active.targetEndAt - Date.now()) / 1000))
      active.paused = true
      this.setData({ paused: true, runningPetLine: `${active.petName}：暂停计时。` })
    }
    focusService.setActive(active)
  },

  onPhaseExpired() {
    if (this._phaseTransitioning) return
    this._phaseTransitioning = true
    const active = this._active
    if (!active) {
      this._phaseTransitioning = false
      return
    }
    if (active.phase === "work") {
      this.recordWork(true, "completed")
      if (active.breakMinutes > 0) {
        const seconds = active.breakMinutes * 60
        active.phase = "break"
        active.paused = false
        active.remainingSeconds = seconds
        active.targetEndAt = Date.now() + seconds * 1000
        focusService.setActive(active)
        this.setData({
          phase: "break",
          paused: false,
          remainingSeconds: seconds,
          timerText: timerText(seconds),
          runningPetLine: `${active.petName}：这一轮过了，我先睡会。`
        }, () => this.updatePetPreview())
      } else {
        this.finishSession(true)
      }
    } else {
      this.finishSession(true)
    }
    this._phaseTransitioning = false
  },

  recordWork(completed, reason) {
    const active = this._active
    if (!active || active.workRecorded) return null
    let actualSeconds
    if (completed) {
      actualSeconds = Math.max(0, (active.workMinutes || 25) * 60)
    } else if (active.phase === "work") {
      const remaining = active.paused
        ? Number(active.remainingSeconds) || 0
        : Math.max(0, Math.ceil((active.targetEndAt - Date.now()) / 1000))
      actualSeconds = Math.max(0, (active.workMinutes || 25) * 60 - remaining)
    } else {
      actualSeconds = Math.max(0, (active.workMinutes || 25) * 60)
    }

    const record = focusService.addSession({
      date: active.date,
      planId: active.planId,
      planText: active.planText,
      petId: active.petId,
      petName: active.petName,
      plannedMinutes: active.workMinutes,
      actualSeconds,
      completed,
      reason,
      startedAt: active.startedAt
    })
    active.workRecorded = true
    active.recordId = record.id
    active.actualSeconds = actualSeconds
    focusService.setActive(active)

    if (active.planId && actualSeconds >= 30) {
      planService.addFocus(active.date, active.planId, Math.max(1, Math.round(actualSeconds / 60)), completed)
    }
    return record
  },

  stopSession() {
    const active = this._active
    if (!active) return
    if (active.phase === "work") {
      this.recordWork(false, "stopped")
      this.finishSession(false)
    } else {
      this.finishSession(true)
    }
  },

  skipBreak() {
    if (!this._active || this._active.phase !== "break") return
    this.finishSession(true)
  },

  finishSession(workCompleted) {
    this.stopTicker()
    const active = this._active
    if (!active) return
    if (!active.workRecorded) this.recordWork(Boolean(workCompleted), workCompleted ? "completed" : "stopped")
    const plan = active.planId ? planService.getDay(active.date).items.find(item => item.id === active.planId) : null
    const actualMinutes = Math.max(0, Math.round((active.actualSeconds || active.workMinutes * 60) / 60))
    const result = {
      completed: Boolean(workCompleted),
      planId: active.planId || "",
      planText: active.planText || "自由专注",
      petId: active.petId,
      petName: active.petName,
      actualMinutes,
      planCompleted: Boolean(plan && plan.completed)
    }
    focusService.clearActive()
    this._active = null
    this.setData({
      mode: "finished",
      lastResult: result,
      focusSummary: focusService.summary(this.data.today)
    })
  },

  markPlanDone() {
    const result = this.data.lastResult
    if (!result || !result.planId || result.planCompleted) return
    const plan = planService.getDay(this.data.today).items.find(item => item.id === result.planId)
    if (plan && !plan.completed) planService.toggle(this.data.today, result.planId)
    this.setData({ "lastResult.planCompleted": true })
    wx.showToast({ title: "任务已完成", icon: "success" })
  },

  backToSetup() {
    this.setData({ mode: "setup", lastResult: null }, () => this.loadSetupData(false))
  },

  backToPetHome() {
    wx.navigateBack({ delta: 1 })
  }
})
