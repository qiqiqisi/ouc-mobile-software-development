import * as petStorage from "../services/monitor-storage.js"
import * as planService from "../services/plans.js"
import * as focusService from "../services/focus.js"
import { getTodayString } from "../shared/date.js"
import { showToast } from "../shared/ui.js"
import {
  ROOM_BEHAVIOR,
  ROOM_LAYOUT,
  bouncePointFromDesk,
  buildWalkRoute,
  clamp,
  depthScale,
  floorBounds,
  isNormalWalkPosition,
  randomBetween,
  toyChaseTarget
} from "../shared/pet-room-engine.js"

const today = getTodayString()
const stage = document.querySelector("#room-stage")
const room = document.querySelector("#room-pets")
const toyNode = document.querySelector("#teaser-wand")
const objectUrls = new Map()
const actorIds = () => actors.map(actor => actor.id)
let actors = []
let width = 0
let height = 0
let baseSize = 106
let loopTimer = 0
let bubbleTimer = 0
let toy = null
let toyHome = null
let openPanelName = ""
const collisionCooldowns = new Map()

function setHidden(element, hidden) {
  element.classList.toggle("is-hidden", hidden)
}

function pct(value) {
  return `${value / 1254 * 100}%`
}

function layerStyle(element, left, top, layerWidth, layerHeight, transform = "") {
  element.style.left = pct(left)
  element.style.top = pct(top)
  element.style.width = pct(layerWidth)
  element.style.height = pct(layerHeight)
  element.style.transform = transform
}

function configureFigureGeometry(actor, sleeping = false) {
  const refs = actor.refs
  const legWidth = 1254 * 0.27
  const legHeight = 1254 * 0.20
  layerStyle(refs.leftStraight, 410 - legWidth / 2, 845, legWidth, legHeight, "scaleX(1)")
  layerStyle(refs.leftBent, 410 - legWidth / 2, 815, legWidth, legHeight, "scaleX(1)")
  layerStyle(refs.rightStraight, 844 - legWidth / 2, 845, legWidth, legHeight, "scaleX(-1)")
  layerStyle(refs.rightBent, 844 - legWidth / 2, 815, legWidth, legHeight, "scaleX(-1)")
  for (const body of [refs.defaultBody, refs.reactBody, refs.idleBody, refs.sleepBody]) {
    layerStyle(body, 0, 0, 1254, 1254)
  }
  const transform = petStorage.normalizeHeadTransform(actor.profile.headTransform)
  const headBottom = sleeping ? 525 : 515
  const headTransform = `rotate(${transform.rotation}deg) scale(${transform.scale})`
  layerStyle(refs.head, 627 - 250 + transform.offsetX, headBottom - 500 + transform.offsetY, 500, 500, headTransform)
  layerStyle(refs.sleepMask, 627 - 195 + transform.offsetX, 150 + transform.offsetY, 390, 171, headTransform)
}

function createActorNode(actor, imageUrl) {
  const node = document.createElement("button")
  node.type = "button"
  node.className = "room-pet"
  node.dataset.petId = actor.id
  node.setAttribute("aria-label", `${actor.profile.name}监工`)
  node.innerHTML = `
    <span class="room-pet-visual">
      <img class="pet-layer pet-leg pet-left-straight" src="./assets/pet/limbs/pet_leg_straight.png" alt="">
      <img class="pet-layer pet-leg pet-left-bent" src="./assets/pet/limbs/pet_leg_bent.png" alt="">
      <img class="pet-layer pet-leg pet-right-straight" src="./assets/pet/limbs/pet_leg_straight.png" alt="">
      <img class="pet-layer pet-leg pet-right-bent" src="./assets/pet/limbs/pet_leg_bent.png" alt="">
      <img class="pet-layer pet-body pet-body-default" src="./assets/pet/body/pet_body_default.png" alt="">
      <img class="pet-layer pet-body pet-body-react" src="./assets/pet/body/pet_body_react.png" alt="">
      <img class="pet-layer pet-body pet-body-idle" src="./assets/pet/body/pet_body_idle_alt.png" alt="">
      <img class="pet-layer pet-body pet-body-sleep" src="./assets/pet/extra/pet_sleep_pose.png" alt="">
      <img class="pet-layer pet-head" alt="">
      <img class="pet-layer pet-sleep-mask" src="./assets/pet/extra/pet_sleep_mask.png" alt="">
    </span>`
  const visual = node.querySelector(".room-pet-visual")
  const refs = {
    visual,
    leftStraight: node.querySelector(".pet-left-straight"),
    leftBent: node.querySelector(".pet-left-bent"),
    rightStraight: node.querySelector(".pet-right-straight"),
    rightBent: node.querySelector(".pet-right-bent"),
    defaultBody: node.querySelector(".pet-body-default"),
    reactBody: node.querySelector(".pet-body-react"),
    idleBody: node.querySelector(".pet-body-idle"),
    sleepBody: node.querySelector(".pet-body-sleep"),
    head: node.querySelector(".pet-head"),
    sleepMask: node.querySelector(".pet-sleep-mask")
  }
  refs.head.src = imageUrl
  actor.node = node
  actor.refs = refs
  configureFigureGeometry(actor)
  node.addEventListener("click", event => {
    event.stopPropagation()
    onActorTap(actor)
  })
  return node
}

function visible(element, show) {
  element.classList.toggle("is-visible", show)
}

function renderActor(actor) {
  if (!actor.node) return
  const sleeping = actor.state === "SLEEP"
  const moving = actor.state === "WALK" || actor.state === "CHASE"
  const react = actor.primary && (actor.state === "REACT" || actor.state === "CATCH")
  const idleAlt = actor.primary && actor.state === "IDLE_ALT"
  if (actor.lastSleeping !== sleeping) {
    configureFigureGeometry(actor, sleeping)
    actor.lastSleeping = sleeping
  }
  actor.node.className = `room-pet pet-state-${actor.state}`
  actor.node.style.width = `${actor.size}px`
  actor.node.style.height = `${actor.size}px`
  actor.node.style.left = `${actor.centerX - actor.size / 2}px`
  actor.node.style.top = `${actor.bottomY - actor.size}px`
  actor.node.style.transform = `scale(${depthScale(actor.bottomY, height)})`
  actor.node.style.zIndex = String((actor.primary ? 140 : 135) + Math.round(actor.bottomY))
  actor.refs.visual.style.transform = `scaleX(${actor.direction || 1})`
  const leftBent = moving && actor.phase === 1
  const rightBent = moving && actor.phase === 0
  visible(actor.refs.leftStraight, !sleeping && !leftBent && actor.state !== "DESK")
  visible(actor.refs.leftBent, !sleeping && leftBent && actor.state !== "DESK")
  visible(actor.refs.rightStraight, !sleeping && !rightBent && actor.state !== "DESK")
  visible(actor.refs.rightBent, !sleeping && rightBent && actor.state !== "DESK")
  visible(actor.refs.defaultBody, !sleeping && !react && !idleAlt)
  visible(actor.refs.reactBody, !sleeping && react)
  visible(actor.refs.idleBody, !sleeping && idleAlt)
  visible(actor.refs.sleepBody, sleeping)
  visible(actor.refs.head, true)
  visible(actor.refs.sleepMask, sleeping)
  if (actor.primary) {
    const bubble = document.querySelector("#pet-bubble")
    bubble.style.left = `${actor.centerX}px`
    bubble.style.top = `${actor.bottomY - actor.size * depthScale(actor.bottomY, height) - 5}px`
  }
}

async function getImageUrl(profile) {
  if (objectUrls.has(profile.id)) return objectUrls.get(profile.id)
  const blob = await petStorage.getProfileImage(profile)
  if (!blob) throw new Error(`${profile.name}的图片不存在`)
  const url = URL.createObjectURL(blob)
  objectUrls.set(profile.id, url)
  return url
}

function makeActor(profile, index, activeId, imageUrl) {
  const bounds = floorBounds(width, height)
  const primary = profile.id === activeId
  const ratio = clamp((profile.displayScale || 1.15) / 1.15, 0.88, 1.08)
  const size = baseSize * ratio
  const now = Date.now()
  const companionIndex = primary ? 0 : actors.filter(actor => !actor.primary).length
  const centerX = primary
    ? width * 0.70
    : clamp(bounds.maxX - (companionIndex + 1) * size * 0.92, bounds.minX + size * 0.18, bounds.maxX - size * 0.18)
  const bottomY = primary
    ? height * 0.82
    : clamp(bounds.maxBottomY - companionIndex * size * 0.36, Math.max(bounds.minBottomY, height * 0.76), bounds.maxBottomY)
  const actor = {
    id: profile.id,
    profile,
    primary,
    imageUrl,
    size,
    centerX,
    bottomY,
    direction: index % 2 === 0 ? 1 : -1,
    phase: 0,
    state: "IDLE",
    target: null,
    route: [],
    waitUntil: now + (primary ? ROOM_BEHAVIOR.idleBeforeWalkMs : 700 + companionIndex * 500),
    sleepAt: now + ROOM_BEHAVIOR.sleepAfterMs + (primary ? 0 : companionIndex * 2400),
    reactUntil: 0,
    catchUntil: 0,
    node: null,
    refs: null
  }
  actor.node = createActorNode(actor, imageUrl)
  return actor
}

async function renderRoom() {
  stopLoop()
  room.replaceChildren()
  actors = []
  const profiles = petStorage.getProfiles()
  const activeId = petStorage.getActiveProfileId()
  setHidden(document.querySelector("#room-empty"), profiles.length > 0)
  if (!profiles.length) return
  const ordered = [...profiles].sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId))
  for (let index = 0; index < ordered.length; index += 1) {
    const profile = ordered[index]
    const imageUrl = await getImageUrl(profile)
    const actor = makeActor(profile, index, activeId, imageUrl)
    actors.push(actor)
    room.append(actor.node)
    renderActor(actor)
  }
  startLoop()
}

function pickRandomTarget(actor) {
  const bounds = floorBounds(width, height)
  let socialTarget = null
  if (!actor.primary && Math.random() < 0.28) {
    const others = actors.filter(item => item.id !== actor.id && item.state !== "DESK")
    socialTarget = others[Math.floor(Math.random() * others.length)] || null
  }
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const target = socialTarget
      ? {
          centerX: clamp(socialTarget.centerX + randomBetween(-12, 12), bounds.minX, bounds.maxX),
          bottomY: clamp(socialTarget.bottomY + randomBetween(-8, 8), bounds.minBottomY, bounds.maxBottomY)
        }
      : {
          centerX: randomBetween(bounds.minX, bounds.maxX),
          bottomY: randomBetween(bounds.minBottomY, bounds.maxBottomY)
        }
    if (!isNormalWalkPosition(target, width, height, actor.size)) continue
    actor.route = buildWalkRoute(actor, target, width, height, actor.size)
    actor.target = actor.route.shift() || null
    actor.state = actor.target ? "WALK" : "IDLE"
    return
  }
  actor.state = "IDLE"
  actor.waitUntil = Date.now() + 900
}

function moveActorToward(actor, target, speed, state) {
  const dx = target.centerX - actor.centerX
  const dy = target.bottomY - actor.bottomY
  const distance = Math.hypot(dx, dy)
  if (distance < speed * 1.2) {
    actor.centerX = target.centerX
    actor.bottomY = target.bottomY
    return true
  }
  const step = Math.min(speed, distance)
  const candidate = {
    centerX: actor.centerX + dx / distance * step,
    bottomY: actor.bottomY + dy / distance * step
  }
  if (!isNormalWalkPosition(candidate, width, height, actor.size)) {
    const bounced = bouncePointFromDesk(actor, candidate, width, height, actor.size)
    actor.centerX = bounced.centerX
    actor.bottomY = bounced.bottomY
    actor.direction = dx >= 0 ? -1 : 1
    actor.target = null
    actor.route = []
    actor.state = "IDLE"
    actor.waitUntil = Date.now() + 500 + Math.random() * 800
    return false
  }
  actor.direction = dx >= 0 ? 1 : -1
  actor.centerX = candidate.centerX
  actor.bottomY = candidate.bottomY
  actor.phase = 1 - actor.phase
  actor.state = state
  return false
}

function nearbySleepPosition(actor) {
  const bounds = floorBounds(width, height)
  const current = {
    centerX: clamp(actor.centerX, bounds.minX, bounds.maxX),
    bottomY: clamp(actor.bottomY, bounds.minBottomY, bounds.maxBottomY)
  }
  const sleepers = actors.filter(item => item.id !== actor.id && item.state === "SLEEP")
  const free = candidate => {
    if (!isNormalWalkPosition(candidate, width, height, actor.size)) return false
    return sleepers.every(item => Math.hypot(
      candidate.centerX - item.centerX,
      candidate.bottomY - item.bottomY
    ) >= Math.max(48, (actor.size + item.size) * 0.42))
  }
  if (free(current)) return current
  const radius = Math.max(52, actor.size * 0.58)
  const offsets = [
    [radius, 0], [-radius, 0], [0, radius], [0, -radius],
    [radius * .75, radius * .55], [-radius * .75, radius * .55],
    [radius * .75, -radius * .55], [-radius * .75, -radius * .55]
  ]
  for (const [dx, dy] of offsets) {
    const candidate = {
      centerX: clamp(current.centerX + dx, bounds.minX, bounds.maxX),
      bottomY: clamp(current.bottomY + dy, bounds.minBottomY, bounds.maxBottomY)
    }
    if (free(candidate)) return candidate
  }
  return current
}

function enterSleep(actor) {
  const sleepPoint = nearbySleepPosition(actor)
  actor.centerX = sleepPoint.centerX
  actor.bottomY = sleepPoint.bottomY
  actor.state = "SLEEP"
  actor.target = null
  actor.route = []
  if (actor.primary) showBubble("Zzz… 监工已进入省电模式。", 0)
}

function toyTip() {
  if (!toy) return null
  return { x: toy.left + toy.width * 0.81, y: toy.top + toy.height * 0.24 }
}

function tickToyActor(actor, now, baseSpeed) {
  const target = toyChaseTarget({
    tip: toyTip(), petId: actor.id, size: actor.size, actorIds: actorIds(), width, height
  })
  if (!target) return
  const distance = Math.hypot(target.centerX - actor.centerX, target.bottomY - actor.bottomY)
  const stopDistance = Math.max(10, actor.size * 0.12)
  if (distance <= stopDistance) {
    if (actor.state !== "CATCH") {
      actor.state = "CATCH"
      actor.catchUntil = now + ROOM_BEHAVIOR.catchPauseMs
      if (actor.primary) showBubble(randomCatchMessage(), 900)
    }
    return
  }
  if (actor.state === "CATCH" && now < actor.catchUntil) return
  const route = buildWalkRoute(actor, target, width, height, actor.size)
  moveActorToward(actor, route[0] || target, baseSpeed * ROOM_BEHAVIOR.chaseSpeedMultiplier, "CHASE")
}

function tickActor(actor, now, baseSpeed) {
  if (toy && toy.active) {
    actor.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
    tickToyActor(actor, now, baseSpeed)
    return
  }
  if (actor.state === "DESK" || actor.state === "SLEEP") return
  if (actor.state === "REACT") {
    if (now < actor.reactUntil) return
    actor.state = "IDLE"
    actor.waitUntil = now + ROOM_BEHAVIOR.idleBeforeWalkMs
  }
  if (now >= actor.sleepAt) {
    enterSleep(actor)
    return
  }
  if (now < actor.waitUntil) return
  if (!actor.target) pickRandomTarget(actor)
  if (!actor.target) return
  if (moveActorToward(actor, actor.target, baseSpeed, "WALK")) {
    if (actor.route.length) {
      actor.target = actor.route.shift()
      actor.state = "WALK"
    } else {
      actor.target = null
      actor.state = actor.primary && Math.random() < 0.24 ? "IDLE_ALT" : "IDLE"
      actor.waitUntil = now + (actor.primary ? ROOM_BEHAVIOR.idleBeforeWalkMs : 900 + Math.random() * 1500)
    }
  }
}

function tick() {
  const now = Date.now()
  const speed = Math.max(2.4, width * 0.008)
  for (const actor of actors) tickActor(actor, now, speed)
  handleCollisions(now)
  for (const actor of actors) renderActor(actor)
}

function startLoop() {
  stopLoop()
  loopTimer = window.setInterval(tick, ROOM_BEHAVIOR.walkTickMs)
}

function stopLoop() {
  clearInterval(loopTimer)
  loopTimer = 0
}

function spawnCollisionFx(centerX, centerY) {
  const layer = document.querySelector("#collision-fx")
  const count = 3 + Math.floor(Math.random() * 3)
  for (let index = 0; index < count; index += 1) {
    const heart = Math.random() < 0.52
    const particle = document.createElement("span")
    particle.className = "collision-particle"
    particle.textContent = heart ? "♥" : "★"
    particle.style.color = heart ? "#e84b5b" : "#f2b544"
    particle.style.left = `${centerX + randomBetween(-24, 24)}px`
    particle.style.top = `${centerY + randomBetween(-10, 12)}px`
    particle.style.fontSize = `${Math.round(randomBetween(14, 29))}px`
    particle.style.animationDelay = `${Math.round(randomBetween(0, 140))}ms`
    layer.append(particle)
    window.setTimeout(() => particle.remove(), 1350)
  }
}

function handleCollisions(now) {
  const activeActors = actors.filter(actor => actor.state !== "DESK")
  for (let left = 0; left < activeActors.length; left += 1) {
    for (let right = left + 1; right < activeActors.length; right += 1) {
      const a = activeActors[left]
      const b = activeActors[right]
      const distance = Math.hypot(b.centerX - a.centerX, b.bottomY - a.bottomY)
      if (distance > Math.max(34, (a.size + b.size) * 0.28)) continue
      const key = [a.id, b.id].sort().join("|")
      if (now - (collisionCooldowns.get(key) || 0) <= 1350) continue
      collisionCooldowns.set(key, now)
      spawnCollisionFx((a.centerX + b.centerX) / 2, (a.bottomY + b.bottomY) / 2 - Math.max(a.size, b.size) * 0.62)
    }
  }
}

function showBubble(message, duration = 1600) {
  const bubble = document.querySelector("#pet-bubble")
  clearTimeout(bubbleTimer)
  bubble.textContent = message || ""
  setHidden(bubble, !message)
  if (duration > 0) bubbleTimer = window.setTimeout(() => setHidden(bubble, true), duration)
}

function primaryActor() {
  return actors.find(actor => actor.primary) || null
}

function contextMessage(actor) {
  const summary = planService.summary(today)
  if (summary.allDone) return "今日任务完成，批准娱乐。"
  if (summary.pending > 0) return `${actor.profile.name}看着你：还有 ${summary.pending} 项。`
  return `${actor.profile.name}看着你，不许偷懒！`
}

function onActorTap(actor) {
  if (toy && toy.active) return
  const now = Date.now()
  if (actor.state === "SLEEP") {
    actor.state = "IDLE"
    actor.waitUntil = now + 600
    actor.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
    if (actor.primary) showBubble("被你叫醒了。", 1500)
    renderActor(actor)
    return
  }
  if (actor.state === "DESK") return
  actor.target = null
  actor.route = []
  actor.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
  if (actor.primary) {
    actor.state = "REACT"
    actor.reactUntil = now + ROOM_BEHAVIOR.reactMs
    actor.waitUntil = actor.reactUntil + ROOM_BEHAVIOR.idleBeforeWalkMs
    showBubble(contextMessage(actor), 1800)
  } else {
    actor.state = "IDLE"
    actor.waitUntil = now + 700
  }
  renderActor(actor)
}

function randomCatchMessage() {
  const messages = ["抓到了。", "再来。", "工作时间禁止钓监工。", "这次算你放水。"]
  return messages[Math.floor(Math.random() * messages.length)]
}

function afterPlayMessage() {
  const summary = planService.summary(today)
  if (summary.allDone) return "今日任务完成，批准继续娱乐。"
  if (summary.pending > 0) return `玩归玩，还有 ${summary.pending} 项没做。`
  return "玩具归位，继续正常运行。"
}

function positionToy(nextToy, returning = false) {
  toyNode.classList.toggle("is-dragging", !returning && Boolean(nextToy.active))
  toyNode.style.left = `${nextToy.left}px`
  toyNode.style.top = `${nextToy.top}px`
  toyNode.style.width = `${nextToy.width}px`
  toyNode.style.height = `${nextToy.height}px`
}

function measureStage(preserve = true) {
  const initialRect = stage.getBoundingClientRect()
  if (!(initialRect.width > 0)) return
  const targetHeight = Math.max(initialRect.width / ROOM_LAYOUT.aspectRatio, window.innerHeight - 220)
  if (Math.abs(initialRect.height - targetHeight) > 0.5) stage.style.height = `${targetHeight}px`
  const rect = stage.getBoundingClientRect()
  if (!(rect.width > 0 && rect.height > 0)) return
  const oldWidth = width
  const oldHeight = height
  width = rect.width
  height = rect.height
  baseSize = clamp(width * 0.27, 88, 138)
  toyHome = {
    left: width * ROOM_LAYOUT.toyHome.left,
    top: height * ROOM_LAYOUT.toyHome.top,
    width: width * ROOM_LAYOUT.toyHome.width,
    height: width * ROOM_LAYOUT.toyHome.width * (446 / 540)
  }
  if (!toy || !toy.active) {
    toy = { ...toyHome, active:false, pointerId:null, grabX:0, grabY:0 }
    positionToy(toy, true)
  }
  if (preserve && oldWidth && oldHeight) {
    for (const actor of actors) {
      actor.centerX *= width / oldWidth
      actor.bottomY *= height / oldHeight
      const ratio = clamp((actor.profile.displayScale || 1.15) / 1.15, 0.88, 1.08)
      actor.size = baseSize * ratio
      const bounds = floorBounds(width, height)
      actor.centerX = clamp(actor.centerX, bounds.minX, bounds.maxX)
      actor.bottomY = clamp(actor.bottomY, bounds.minBottomY, bounds.maxBottomY)
      renderActor(actor)
    }
  }
}

function bindToy() {
  const move = event => {
    if (!toy || event.pointerId !== toy.pointerId) return
    const rect = stage.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    toy.left = clamp(localX - toy.grabX, 0, width - toy.width)
    toy.top = clamp(localY - toy.grabY, 0, height - toy.height)
    positionToy(toy)
  }
  toyNode.addEventListener("pointerdown", event => {
    if (!actors.length || !toy) return
    const rect = stage.getBoundingClientRect()
    toy.pointerId = event.pointerId
    toy.grabX = event.clientX - rect.left - toy.left
    toy.grabY = event.clientY - rect.top - toy.top
    toy.active = true
    toyNode.setPointerCapture(event.pointerId)
    const now = Date.now()
    for (const actor of actors) {
      actor.state = "CHASE"
      actor.target = null
      actor.route = []
      actor.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
    }
    positionToy(toy)
  })
  toyNode.addEventListener("pointermove", move)
  const end = event => {
    if (!toy || event.pointerId !== toy.pointerId) return
    toy.active = false
    toy.pointerId = null
    toy.left = toyHome.left
    toy.top = toyHome.top
    const now = Date.now()
    for (const actor of actors) {
      actor.state = "IDLE"
      actor.target = null
      actor.route = []
      actor.waitUntil = now + 650 + Math.random() * 850
      actor.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
    }
    positionToy(toy, true)
    showBubble(afterPlayMessage(), 1500)
  }
  toyNode.addEventListener("pointerup", end)
  toyNode.addEventListener("pointercancel", end)
}

function renderPlans() {
  const summary = planService.summary(today)
  const focusSummary = focusService.summary(today)
  const focusActive = Boolean(focusService.getActive())
  document.querySelector("#plan-pill-value").textContent = `${summary.completed} / ${summary.total}`
  document.querySelector("#plan-count").textContent = `${summary.completed} / ${summary.total}`
  document.querySelector("#focus-pill-value").textContent = focusActive ? "进行中" : `${focusSummary.totalMinutes} min`
  document.querySelector("#board-copy").innerHTML = `${summary.allDone ? "BUILD PASSED" : summary.total ? "RUNNING" : "NO DATA"}<br>PLAN ${summary.completed} / ${summary.total}`
  document.querySelector("#status-code").textContent = summary.allDone ? "BUILD PASSED" : summary.total ? "RUNNING" : "NO DATA"
  document.querySelector("#status-plan").textContent = `${summary.completed} / ${summary.total}`
  document.querySelector("#status-focus").textContent = `${focusSummary.totalMinutes} min`
  document.querySelector("#status-sessions").textContent = String(focusSummary.sessions)
  document.querySelector("#status-monitors").textContent = `${petStorage.getProfiles().length} / ${petStorage.MAX_PROFILES}`

  const list = document.querySelector("#plan-list")
  list.replaceChildren()
  setHidden(document.querySelector("#plan-empty"), summary.items.length > 0)
  for (const item of summary.items) {
    const row = document.createElement("div")
    row.className = `plan-item${item.completed ? " is-done" : ""}`
    const toggle = document.createElement("button")
    toggle.className = "plan-toggle"
    toggle.type = "button"
    toggle.setAttribute("aria-label", item.completed ? "取消完成" : "标记完成")
    const copy = document.createElement("div")
    copy.className = "plan-copy"
    const title = document.createElement("strong")
    title.textContent = item.text
    const meta = document.createElement("span")
    meta.textContent = `已专注 ${item.focusMinutes || 0} min · ${item.focusCompletedSessions || 0} 个番茄`
    copy.append(title, meta)
    row.append(toggle, copy)
    if (!item.completed) {
      const focusLink = document.createElement("a")
      focusLink.className = "plan-focus"
      focusLink.textContent = "陪学"
      focusLink.href = `./focus.html?planId=${encodeURIComponent(item.id)}`
      row.append(focusLink)
    }
    const remove = document.createElement("button")
    remove.className = "plan-delete"
    remove.type = "button"
    remove.textContent = "×"
    remove.setAttribute("aria-label", "删除")
    row.append(remove)
    toggle.addEventListener("click", () => {
      planService.toggle(today, item.id)
      const next = planService.summary(today)
      if (next.allDone) {
        const actor = primaryActor()
        if (actor) {
          actor.state = "REACT"
          actor.reactUntil = Date.now() + 850
          renderActor(actor)
        }
        showBubble("BUILD SUCCEEDED。今天可以合法下班了。", 2200)
      }
      renderPlans()
    })
    remove.addEventListener("click", () => {
      planService.removePlan(today, item.id)
      renderPlans()
    })
    list.append(row)
  }
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
    const image = document.createElement("img")
    image.src = url
    image.alt = ""
    image.style.cssText = "width:100%;height:100%;object-fit:contain"
    avatar.append(image)
    const copy = document.createElement("div")
    copy.className = "manager-copy"
    const name = document.createElement("strong")
    name.textContent = profile.name
    const detail = document.createElement("span")
    detail.textContent = profile.id === activeId ? "主监工 · 负责首页巡视和今日计划" : "在宠物天地自由活动"
    copy.append(name, detail)
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

function sendPrimaryToDesk() {
  const actor = primaryActor()
  if (!actor) return
  const deskLeft = width * ROOM_LAYOUT.desk.left
  const deskTop = height * ROOM_LAYOUT.desk.top
  const deskWidth = width * ROOM_LAYOUT.desk.width
  actor.centerX = deskLeft + deskWidth * 0.56
  actor.bottomY = deskTop + actor.size * 0.58
  actor.direction = 1
  actor.state = "DESK"
  actor.target = null
  actor.route = []
  renderActor(actor)
}

function exitPrimaryDesk() {
  const actor = primaryActor()
  if (!actor || actor.state !== "DESK") return
  const bounds = floorBounds(width, height)
  const deskLeft = width * ROOM_LAYOUT.desk.left
  const deskWidth = width * ROOM_LAYOUT.desk.width
  actor.centerX = clamp(deskLeft + deskWidth + actor.size * 0.62, bounds.minX, bounds.maxX)
  actor.bottomY = Math.min(bounds.maxBottomY, bounds.minBottomY + height * 0.085)
  actor.state = "IDLE"
  actor.waitUntil = Date.now() + ROOM_BEHAVIOR.idleBeforeWalkMs
  actor.sleepAt = Date.now() + ROOM_BEHAVIOR.sleepAfterMs
  renderActor(actor)
}

function openPanel(name) {
  openPanelName = name
  setHidden(document.querySelector("#plan-panel"), name !== "plan")
  setHidden(document.querySelector("#manage-panel"), name !== "manage")
  setHidden(document.querySelector("#status-panel"), name !== "status")
  const backdrop = document.querySelector("#panel-backdrop")
  setHidden(backdrop, false)
  backdrop.setAttribute("aria-hidden", "false")
  if (name === "plan") sendPrimaryToDesk()
  else {
    const actor = primaryActor()
    if (actor && actor.state !== "DESK") {
      if (actor.state === "SLEEP") actor.state = "IDLE"
      actor.target = null
      actor.route = []
      actor.waitUntil = Date.now() + ROOM_BEHAVIOR.idleBeforeWalkMs
      actor.sleepAt = Date.now() + ROOM_BEHAVIOR.sleepAfterMs
      renderActor(actor)
    }
  }
}

function closePanel() {
  const wasPlan = openPanelName === "plan"
  openPanelName = ""
  const backdrop = document.querySelector("#panel-backdrop")
  setHidden(backdrop, true)
  backdrop.setAttribute("aria-hidden", "true")
  if (wasPlan) exitPrimaryDesk()
}

async function refreshAll() {
  renderPlans()
  await renderRoom()
  await renderManager()
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
    showBubble(`计划已登记，今天共 ${planService.summary(today).total} 项。`, 1500)
  } catch (error) {
    showToast(error.message || "计划添加失败")
  }
})

measureStage(false)
bindToy()
new ResizeObserver(() => measureStage(true)).observe(stage)
refreshAll().catch(error => {
  console.error("宠物天地初始化失败：", error)
  showToast("宠物天地初始化失败")
})

window.addEventListener("pagehide", () => {
  stopLoop()
  objectUrls.forEach(url => URL.revokeObjectURL(url))
})
