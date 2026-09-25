import * as petStorage from "../services/monitor-storage.js"
import * as planService from "../services/plans.js"
import * as focusService from "../services/focus.js"
import { getTodayString } from "../shared/date.js"
import { getQuery, showToast } from "../shared/ui.js"

const today = getTodayString()
const state = {
  plans: [],
  pets: [],
  activePetId: "",
  selectedPlanId: "",
  selectedPetId: "",
  workMinutes: 25,
  breakMinutes: 5,
  active: null,
  result: null,
  timer: 0,
  objectUrls: new Map()
}
let phaseTransitioning = false

function setHidden(element, hidden) {
  element.classList.toggle("is-hidden", hidden)
}

function timerText(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds) || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`
}

function headVariables(profile) {
  const transform = petStorage.normalizeHeadTransform(profile.headTransform)
  return `--head-scale:${transform.scale};--head-x:${transform.offsetX / 12.54}%;--head-y:${transform.offsetY / 12.54}%;--head-rotation:${transform.rotation}deg`
}

async function imageUrl(profile) {
  if (state.objectUrls.has(profile.id)) return state.objectUrls.get(profile.id)
  const blob = await petStorage.getProfileImage(profile)
  if (!blob) return ""
  const url = URL.createObjectURL(blob)
  state.objectUrls.set(profile.id, url)
  return url
}

function petMarkup(profile, url, resting = false) {
  return `<div class="focus-pet" style="${headVariables(profile)}">
    ${resting ? "" : '<img class="pet-layer pet-leg-left" src="./assets/pet/limbs/pet_leg_straight.png" alt=""><img class="pet-layer pet-leg-right" src="./assets/pet/limbs/pet_leg_straight.png" alt="">'}
    <img class="pet-layer pet-body" src="${resting ? "./assets/pet/extra/pet_sleep_pose.png" : "./assets/pet/body/pet_body_default.png"}" alt="">
    <img class="pet-layer pet-head" src="${url}" alt="">
    ${resting ? '<img class="pet-layer pet-head" src="./assets/pet/extra/pet_sleep_mask.png" alt="" style="z-index:5;object-fit:contain">' : ""}
  </div>`
}

function selectedPlan() {
  return state.plans.find(item => item.id === state.selectedPlanId) || null
}

function selectedPet() {
  return state.pets.find(item => item.id === state.selectedPetId) || null
}

function renderTasks() {
  const list = document.querySelector("#task-list")
  list.replaceChildren()
  const tasks = [{ id: "", text: "自由专注", meta: "不绑定计划，只记录专注时间" }]
    .concat(state.plans.map(item => ({
      id: item.id,
      text: item.text,
      meta: `${item.focusMinutes || 0} min · ${item.focusCompletedSessions || 0} 个完成番茄${item.completed ? " · 已完成" : ""}`
    })))
  tasks.forEach(task => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = `task-card${task.id === state.selectedPlanId ? " is-selected" : ""}`
    button.innerHTML = '<span class="task-radio"></span><span class="task-copy"><strong></strong><span></span></span>'
    button.querySelector("strong").textContent = task.text
    button.querySelector(".task-copy span").textContent = task.meta
    button.addEventListener("click", () => {
      state.selectedPlanId = task.id
      renderTasks()
    })
    list.append(button)
  })
}

async function renderPets() {
  const picker = document.querySelector("#pet-picker")
  picker.replaceChildren()
  setHidden(document.querySelector("#pet-empty"), state.pets.length > 0)
  for (const pet of state.pets) {
    const url = await imageUrl(pet)
    if (!url) continue
    const button = document.createElement("button")
    button.type = "button"
    button.className = `pet-choice${pet.id === state.selectedPetId ? " is-selected" : ""}`
    button.innerHTML = `<div class="pet-choice-preview">${petMarkup(pet, url)}</div><strong></strong><span>${pet.id === state.activePetId ? "主监工" : ""}</span>`
    button.querySelector("strong").textContent = pet.name
    button.addEventListener("click", () => {
      state.selectedPetId = pet.id
      renderPets()
      updateStartButton()
    })
    picker.append(button)
  }
  updateStartButton()
}

function updateDurationUi() {
  document.querySelectorAll("#duration-row button").forEach(button => {
    button.classList.toggle("is-selected", Number(button.dataset.work) === state.workMinutes)
  })
  document.querySelector("#custom-work").value = String(state.workMinutes)
  document.querySelector("#custom-work-value").textContent = `${state.workMinutes} min`
}

function updateStartButton() {
  document.querySelector("#start-session").disabled = !selectedPet()
}

function renderSummary() {
  const summary = focusService.summary(today)
  document.querySelector("#focus-total").textContent = `${summary.totalMinutes} min`
  document.querySelector("#completed-count").textContent = summary.completed
  document.querySelector("#interrupted-count").textContent = summary.interrupted
  document.querySelector("#session-count").textContent = summary.sessions
  const list = document.querySelector("#session-list")
  list.replaceChildren()
  setHidden(document.querySelector("#session-empty"), summary.items.length > 0)
  summary.items.forEach(item => {
    const row = document.createElement("div")
    row.className = "session-item"
    row.innerHTML = `<div><strong></strong><span></span></div><b class="session-status${item.completed ? "" : " is-stop"}">${item.completed ? "DONE" : "STOP"}</b>`
    row.querySelector("strong").textContent = item.planText
    row.querySelector("span").textContent = `${item.petName} · ${item.actualMinutes} min`
    list.append(row)
  })
}

async function loadSetup() {
  state.plans = planService.getDay(today).items
  state.pets = petStorage.getProfiles()
  state.activePetId = petStorage.getActiveProfileId()
  const requested = getQuery().get("planId") || ""
  if (requested && state.plans.some(item => item.id === requested)) state.selectedPlanId = requested
  if (!state.pets.some(item => item.id === state.selectedPetId)) {
    state.selectedPetId = state.pets.some(item => item.id === state.activePetId)
      ? state.activePetId
      : ((state.pets[0] && state.pets[0].id) || "")
  }
  renderTasks()
  await renderPets()
  updateDurationUi()
  renderSummary()
}

function showView(name) {
  setHidden(document.querySelector("#setup-view"), name !== "setup")
  setHidden(document.querySelector("#running-view"), name !== "running")
  setHidden(document.querySelector("#finish-view"), name !== "finish")
}

async function renderRunning() {
  const active = state.active
  if (!active) return
  const pet = state.pets.find(item => item.id === active.petId)
  if (!pet) {
    focusService.clearActive()
    state.active = null
    showView("setup")
    return
  }
  const url = await imageUrl(pet)
  const resting = active.phase === "break"
  document.querySelector("#phase-code").textContent = resting ? "BREAK" : "FOCUSING"
  document.querySelector("#running-task").textContent = active.planText
  document.querySelector("#timer-caption").textContent = resting ? "这一轮完成了，休息一下。" : "现在只做这一件事。"
  document.querySelector("#pet-line").textContent = resting ? `${pet.name}：这一轮过了，我先睡会。` : `${pet.name}：我盯着。`
  document.querySelector("#running-scene").innerHTML = `${petMarkup(pet, url, resting)}${resting ? "" : '<img class="focus-desk" src="./assets/pet/room/pet_room_desk.png" alt="书桌">'}`
  const pause = document.querySelector("#pause-session")
  pause.textContent = resting ? "跳过休息" : (active.paused ? "继续" : "暂停")
  pause.dataset.action = resting ? "skip" : "pause"
  document.querySelector("#stop-session").textContent = resting ? "结束" : "结束本轮"
  syncTimer()
}

function saveActive() {
  focusService.setActive(state.active)
}

function startTicker() {
  clearInterval(state.timer)
  state.timer = window.setInterval(syncTimer, 500)
}

function remainingSeconds(active) {
  if (active.paused) return Math.max(0, Number(active.remainingSeconds) || 0)
  return Math.max(0, Math.ceil((Number(active.targetEndAt) - Date.now()) / 1000))
}

function syncTimer() {
  if (!state.active) return
  const remaining = remainingSeconds(state.active)
  document.querySelector("#timer").textContent = timerText(remaining)
  state.active.remainingSeconds = remaining
  if (remaining <= 0 && !state.active.paused) phaseExpired()
}

function recordWork(completed, reason) {
  const active = state.active
  if (!active || active.workRecorded) return null
  const plannedSeconds = active.workMinutes * 60
  const actualSeconds = completed
    ? plannedSeconds
    : Math.max(0, plannedSeconds - remainingSeconds(active))
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
  active.actualSeconds = actualSeconds
  saveActive()
  if (active.planId && actualSeconds >= 30) {
    planService.addFocus(active.date, active.planId, Math.max(1, Math.round(actualSeconds / 60)), completed)
  }
  return record
}

async function phaseExpired() {
  const active = state.active
  if (!active || phaseTransitioning) return
  phaseTransitioning = true
  if (active.phase === "work") {
    recordWork(true, "completed")
    if (active.breakMinutes > 0) {
      active.phase = "break"
      active.paused = false
      active.remainingSeconds = active.breakMinutes * 60
      active.targetEndAt = Date.now() + active.remainingSeconds * 1000
      phaseTransitioning = false
      saveActive()
      await renderRunning()
      return
    }
  }
  finishSession(true)
  phaseTransitioning = false
}

function startSession() {
  const pet = selectedPet()
  if (!pet) return
  const plan = selectedPlan()
  const now = Date.now()
  state.active = {
    version: 1,
    date: today,
    planId: plan ? plan.id : "",
    planText: plan ? plan.text : "自由专注",
    petId: pet.id,
    petName: pet.name,
    workMinutes: state.workMinutes,
    breakMinutes: state.breakMinutes,
    phase: "work",
    startedAt: new Date(now).toISOString(),
    targetEndAt: now + state.workMinutes * 60 * 1000,
    remainingSeconds: state.workMinutes * 60,
    paused: false,
    workRecorded: false
  }
  saveActive()
  showView("running")
  renderRunning()
  startTicker()
}

function togglePause() {
  const active = state.active
  if (!active) return
  if (active.phase === "break") {
    finishSession(true)
    return
  }
  if (active.paused) {
    active.paused = false
    active.targetEndAt = Date.now() + active.remainingSeconds * 1000
  } else {
    active.remainingSeconds = remainingSeconds(active)
    active.paused = true
  }
  saveActive()
  renderRunning()
}

function stopSession() {
  if (!state.active) return
  if (state.active.phase === "work") {
    recordWork(false, "stopped")
    finishSession(false)
  } else {
    finishSession(true)
  }
}

function finishSession(completed) {
  clearInterval(state.timer)
  const active = state.active
  if (!active) return
  if (!active.workRecorded) recordWork(completed, completed ? "completed" : "stopped")
  const plan = active.planId ? planService.getDay(today).items.find(item => item.id === active.planId) : null
  state.result = {
    completed,
    planId: active.planId,
    planText: active.planText,
    petName: active.petName,
    actualMinutes: Math.max(0, Math.round((active.actualSeconds || 0) / 60)),
    planCompleted: Boolean(plan && plan.completed)
  }
  focusService.clearActive()
  state.active = null
  renderFinish()
  showView("finish")
}

function renderFinish() {
  const result = state.result
  document.querySelector("#finish-code").textContent = result.completed ? "BUILD SUCCEEDED" : "SESSION STOPPED"
  document.querySelector("#finish-title").textContent = result.planText
  document.querySelector("#finish-time").textContent = `${result.actualMinutes} min`
  document.querySelector("#finish-copy").textContent = `${result.petName}：${result.completed ? "这轮算你认真。" : "这次没跑完，下轮继续。"}`
  setHidden(document.querySelector("#finish-plan"), !result.planId || result.planCompleted)
}

function restoreActive() {
  const active = focusService.getActive()
  if (!active || active.date !== today || !state.pets.some(item => item.id === active.petId)) {
    if (active) focusService.clearActive()
    return
  }
  state.active = active
  showView("running")
  renderRunning()
  startTicker()
}

document.querySelectorAll("#duration-row button").forEach(button => {
  button.addEventListener("click", () => {
    state.workMinutes = Number(button.dataset.work)
    state.breakMinutes = Number(button.dataset.break)
    updateDurationUi()
  })
})
document.querySelector("#custom-work").addEventListener("input", event => {
  state.workMinutes = Number(event.target.value)
  state.breakMinutes = state.workMinutes <= 30 ? 5 : state.workMinutes <= 60 ? 10 : 15
  updateDurationUi()
})
document.querySelector("#start-session").addEventListener("click", startSession)
document.querySelector("#pause-session").addEventListener("click", togglePause)
document.querySelector("#stop-session").addEventListener("click", stopSession)
document.querySelector("#again-session").addEventListener("click", async () => {
  state.result = null
  await loadSetup()
  showView("setup")
})
document.querySelector("#finish-plan").addEventListener("click", () => {
  if (!state.result || !state.result.planId || state.result.planCompleted) return
  const plan = planService.getDay(today).items.find(item => item.id === state.result.planId)
  if (plan && !plan.completed) planService.toggle(today, state.result.planId)
  state.result.planCompleted = true
  setHidden(document.querySelector("#finish-plan"), true)
  showToast("任务已完成")
})

loadSetup().then(restoreActive).catch(error => {
  console.error("专注页面初始化失败：", error)
  showToast("专注页面初始化失败")
})

window.addEventListener("pagehide", () => {
  clearInterval(state.timer)
  state.objectUrls.forEach(url => URL.revokeObjectURL(url))
})
