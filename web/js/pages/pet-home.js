import * as petStorage from "../services/monitor-storage.js"
import * as planService from "../services/plans.js"
import * as focusService from "../services/focus.js"
import { getTodayString } from "../shared/date.js"
import { showToast } from "../shared/ui.js"

const today = getTodayString()
const objectUrls = new Map()
const petNodes = new Map()
const defaultPositions = [
  { x: 69, y: 76 },
  { x: 31, y: 84 },
  { x: 55, y: 90 }
]
let bubbleTimer = 0
let walkTimer = 0
let toyPointerId = null

function setHidden(element, hidden) {
  element.classList.toggle("is-hidden", hidden)
}

function headStyle(profile) {
  const transform = petStorage.normalizeHeadTransform(profile.headTransform)
  return [
    `--head-scale:${transform.scale}`,
    `--head-x:${transform.offsetX / 12.54}%`,
    `--head-y:${transform.offsetY / 12.54}%`,
    `--head-rotation:${transform.rotation}deg`,
    `--pet-scale:${profile.displayScale || 1}`
  ].join(";")
}

function buildPetFigure(profile, imageUrl, compact = false) {
  const figure = document.createElement(compact ? "span" : "button")
  figure.className = "pet-figure"
  if (!compact) figure.type = "button"
  figure.dataset.petId = profile.id
  figure.setAttribute("aria-label", `${profile.name}监工`)
  figure.style.cssText = headStyle(profile)
  figure.innerHTML = `
    <img class="pet-layer pet-leg-left" src="./assets/pet/limbs/pet_leg_straight.png" alt="">
    <img class="pet-layer pet-leg-right" src="./assets/pet/limbs/pet_leg_straight.png" alt="">
    <img class="pet-layer pet-body" src="./assets/pet/body/pet_body_default.png" alt="">
    <img class="pet-layer pet-head" src="${imageUrl}" alt="">
  `
  return figure
}

async function getImageUrl(profile) {
  if (objectUrls.has(profile.id)) return objectUrls.get(profile.id)
  const blob = await petStorage.getProfileImage(profile)
  if (!blob) throw new Error(`${profile.name}的图片不存在`)
  const url = URL.createObjectURL(blob)
  objectUrls.set(profile.id, url)
  return url
}

function showBubble(message) {
  const bubble = document.querySelector("#pet-bubble")
  bubble.textContent = message
  setHidden(bubble, false)
  clearTimeout(bubbleTimer)
  bubbleTimer = window.setTimeout(() => setHidden(bubble, true), 1700)
}

function movePet(node, position, running = false) {
  node.classList.toggle("is-running", running)
  node.style.left = `${position.x}%`
  node.style.top = `${position.y}%`
}

function startWalking() {
  clearInterval(walkTimer)
  walkTimer = window.setInterval(() => {
    petNodes.forEach(node => {
      if (toyPointerId !== null) return
      movePet(node, {
        x: 16 + Math.random() * 70,
        y: 69 + Math.random() * 23
      })
    })
  }, 3200)
}

async function renderRoom() {
  const profiles = petStorage.getProfiles()
  const activeId = petStorage.getActiveProfileId()
  const room = document.querySelector("#room-pets")
  room.replaceChildren()
  petNodes.clear()
  setHidden(document.querySelector("#room-empty"), profiles.length > 0)

  for (let index = 0; index < profiles.length; index += 1) {
    const profile = profiles[index]
    const url = await getImageUrl(profile)
    const figure = buildPetFigure(profile, url)
    figure.classList.toggle("is-primary", profile.id === activeId)
    movePet(figure, defaultPositions[index] || defaultPositions[0])
    figure.addEventListener("click", () => {
      const body = figure.querySelector(".pet-body")
      body.src = "./assets/pet/body/pet_body_react.png"
      showBubble(`${profile.name}：别点了，去完成计划。`)
      window.setTimeout(() => { body.src = "./assets/pet/body/pet_body_default.png" }, 760)
    })
    room.append(figure)
    petNodes.set(profile.id, figure)
  }
  startWalking()
}

function renderPlans() {
  const summary = planService.summary(today)
  const focusSummary = focusService.summary(today)
  document.querySelector("#plan-pill-value").textContent = `${summary.completed} / ${summary.total}`
  document.querySelector("#plan-count").textContent = `${summary.completed} / ${summary.total}`
  document.querySelector("#focus-pill-value").textContent = `${focusSummary.totalMinutes} min`
  document.querySelector("#board-copy").innerHTML = `${summary.allDone ? "BUILD PASSED" : "FULL POWER"}<br>PLAN ${summary.completed} / ${summary.total}`

  const list = document.querySelector("#plan-list")
  list.replaceChildren()
  setHidden(document.querySelector("#plan-empty"), summary.items.length > 0)
  summary.items.forEach(item => {
    const row = document.createElement("div")
    row.className = `plan-item${item.completed ? " is-done" : ""}`
    row.innerHTML = `
      <button class="plan-toggle" type="button" aria-label="${item.completed ? "取消完成" : "标记完成"}"></button>
      <div class="plan-copy"><strong></strong><span>${item.focusMinutes || 0} min · ${item.focusCompletedSessions || 0} 个完成番茄</span></div>
      ${item.completed ? "" : '<a class="plan-focus">陪学</a>'}
      <button class="plan-delete" type="button" aria-label="删除">×</button>
    `
    row.querySelector("strong").textContent = item.text
    row.querySelector(".plan-toggle").addEventListener("click", () => {
      planService.toggle(today, item.id)
      renderPlans()
    })
    const focusLink = row.querySelector(".plan-focus")
    if (focusLink) focusLink.href = `./focus.html?planId=${encodeURIComponent(item.id)}`
    row.querySelector(".plan-delete").addEventListener("click", () => {
      planService.removePlan(today, item.id)
      renderPlans()
    })
    list.append(row)
  })
}

async function renderManager() {
  const profiles = petStorage.getProfiles()
  const activeId = petStorage.getActiveProfileId()
  const list = document.querySelector("#manage-list")
  list.replaceChildren()
  document.querySelector("#manage-count").textContent = `${profiles.length} / ${petStorage.MAX_PROFILES}`
  setHidden(document.querySelector("#manage-add"), profiles.length >= petStorage.MAX_PROFILES)
  setHidden(document.querySelector("#manage-limit"), profiles.length < petStorage.MAX_PROFILES)

  for (const profile of profiles) {
    const url = await getImageUrl(profile)
    const row = document.createElement("div")
    row.className = "manager-item"
    const avatar = document.createElement("div")
    avatar.className = "manager-avatar"
    avatar.append(buildPetFigure(profile, url, true))
    const copy = document.createElement("div")
    copy.className = "manager-copy"
    copy.innerHTML = `<strong></strong><span>${profile.id === activeId ? '<b class="primary-badge">主监工</b> · 负责首页巡视和今日计划' : "在宠物天地自由活动"}</span>`
    copy.querySelector("strong").textContent = profile.name
    const actions = document.createElement("div")
    actions.className = "manager-actions"
    if (profile.id !== activeId) {
      const primary = document.createElement("button")
      primary.type = "button"
      primary.textContent = "设为主监工"
      primary.addEventListener("click", async () => {
        petStorage.setActiveProfile(profile.id)
        await refreshAll()
        showToast("已设为主监工")
      })
      actions.append(primary)
    }
    const edit = document.createElement("a")
    edit.textContent = "编辑"
    edit.href = `./index.html?monitor=edit&petId=${encodeURIComponent(profile.id)}&return=pet-home`
    actions.append(edit)
    row.append(avatar, copy, actions)
    list.append(row)
  }
}

function openPanel(name) {
  const backdrop = document.querySelector("#panel-backdrop")
  setHidden(document.querySelector("#plan-panel"), name !== "plan")
  setHidden(document.querySelector("#manage-panel"), name !== "manage")
  setHidden(backdrop, false)
  backdrop.setAttribute("aria-hidden", "false")
}

function closePanel() {
  const backdrop = document.querySelector("#panel-backdrop")
  setHidden(backdrop, true)
  backdrop.setAttribute("aria-hidden", "true")
}

function bindToy() {
  const stage = document.querySelector("#room-stage")
  const toy = document.querySelector("#teaser-wand")
  const move = event => {
    if (event.pointerId !== toyPointerId) return
    const rect = stage.getBoundingClientRect()
    const x = Math.max(6, Math.min(94, (event.clientX - rect.left) / rect.width * 100))
    const y = Math.max(56, Math.min(94, (event.clientY - rect.top) / rect.height * 100))
    toy.style.left = `${x}%`
    toy.style.top = `${y}%`
    toy.style.right = "auto"
    toy.style.bottom = "auto"
    toy.style.transform = "translate(-50%, -50%)"
    let offset = -6
    petNodes.forEach(node => {
      movePet(node, { x: Math.max(12, Math.min(89, x + offset)), y: Math.max(68, Math.min(92, y + 7)) }, true)
      offset += 6
    })
  }
  toy.addEventListener("pointerdown", event => {
    toyPointerId = event.pointerId
    toy.setPointerCapture(event.pointerId)
    move(event)
    showBubble("玩具上线，监工开始追逐。")
  })
  toy.addEventListener("pointermove", move)
  const end = event => {
    if (event.pointerId !== toyPointerId) return
    toyPointerId = null
    petNodes.forEach(node => node.classList.remove("is-running"))
  }
  toy.addEventListener("pointerup", end)
  toy.addEventListener("pointercancel", end)
}

async function refreshAll() {
  renderPlans()
  await Promise.all([renderRoom(), renderManager()])
}

document.querySelectorAll("[data-panel]").forEach(button => {
  button.addEventListener("click", () => openPanel(button.dataset.panel))
})
document.querySelectorAll("[data-close-panel]").forEach(button => button.addEventListener("click", closePanel))
document.querySelector("#panel-backdrop").addEventListener("click", event => {
  if (event.target.id === "panel-backdrop") closePanel()
})
document.querySelector("#plan-form").addEventListener("submit", event => {
  event.preventDefault()
  const input = document.querySelector("#plan-input")
  try {
    planService.add(today, input.value)
    input.value = ""
    renderPlans()
  } catch (error) {
    showToast(error.message || "计划添加失败")
  }
})

bindToy()
refreshAll().catch(error => {
  console.error("宠物天地初始化失败：", error)
  showToast("宠物天地初始化失败")
})

window.addEventListener("pagehide", () => {
  clearInterval(walkTimer)
  objectUrls.forEach(url => URL.revokeObjectURL(url))
})
