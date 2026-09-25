const petService = require("../../services/pet")
const planService = require("../../services/plans")
const focusService = require("../../services/focus")
const recordService = require("../../services/records")
const reportService = require("../../services/reports")
const { getPersonality } = require("../../config/personalities")
const {
  buildStandingLayers,
  buildSleepLayers
} = require("../../config/pet-poses")
const {
  ROOM_ASSETS,
  ROOM_LAYOUT,
  ROOM_BEHAVIOR
} = require("../../config/pet-room")

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function statusFromRecord(record) {
  if (!record) {
    return {
      code: "NO DATA",
      label: "今天还没记录",
      moodText: "—",
      energyText: "—",
      busynessText: "—",
      tagsText: "还没有今日状态"
    }
  }

  const moodMap = ["", "裂开", "不妙", "一般", "不错", "起飞"]
  const energyMap = ["", "没电", "还能跑", "满格"]
  const busynessMap = ["", "闲", "还行", "忙炸了"]

  let code = "RUNNING"
  let label = "正常运行"

  if (record.energy === 1) {
    code = "LOW BATTERY"
    label = "建议充电"
  } else if (record.busyness === 3) {
    code = "HIGH LOAD"
    label = "高负载运行"
  } else if (record.energy === 3 && record.mood >= 4) {
    code = "FULL POWER"
    label = "状态很满"
  }

  return {
    code,
    label,
    moodText: moodMap[record.mood] || "—",
    energyText: energyMap[record.energy] || "—",
    busynessText: busynessMap[record.busyness] || "—",
    tagsText: Array.isArray(record.tags) && record.tags.length
      ? record.tags.join(" · ")
      : "—"
  }
}

function personalitySnapshot() {
  const report = reportService.getLatest()
  if (!report) return null
  const personality = getPersonality(report.code)
  if (!personality) return null
  return {
    code: personality.code,
    name: personality.name,
    tagline: personality.tagline
  }
}

function buildPetLayers(profile, state, walkPhase) {
  const transform = petService.normalizeHeadTransform(profile.headTransform)

  if (state === "SLEEP") {
    const sleep = buildSleepLayers(transform)
    return {
      petBodyStyle: sleep.sleepPoseStyle,
      petSleepPoseStyle: sleep.sleepPoseStyle,
      petHeadStyle: sleep.headStyle,
      petSleepMaskStyle: sleep.sleepMaskStyle,
      petShowSleep: true,
      petShowDefaultBody: false,
      petShowReactBody: false,
      petShowIdleBody: false,
      petShowLeftStraight: false,
      petShowLeftBent: false,
      petShowRightStraight: false,
      petShowRightBent: false
    }
  }

  if (state === "DESK" || state === "DESK_EXIT") {
    const layers = buildStandingLayers("default", transform, {
      walking: false,
      walkPhase: 0
    })
    return {
      petBodyStyle: layers.bodyStyle,
      petSleepPoseStyle: layers.bodyStyle,
      petHeadStyle: layers.headStyle,
      petSleepMaskStyle: "",
      petLeftLegStraightStyle: layers.leftLegStraightStyle,
      petLeftLegBentStyle: layers.leftLegBentStyle,
      petRightLegStraightStyle: layers.rightLegStraightStyle,
      petRightLegBentStyle: layers.rightLegBentStyle,
      petShowSleep: false,
      petShowDefaultBody: true,
      petShowReactBody: false,
      petShowIdleBody: false,
      petShowLeftStraight: false,
      petShowLeftBent: false,
      petShowRightStraight: false,
      petShowRightBent: false
    }
  }

  const visualState = state === "REACT" || state === "CATCH"
    ? "react"
    : state === "IDLE_ALT"
    ? "idleAlt"
    : "default"
  const walking = state === "WALK" || state === "CHASE"
  const layers = buildStandingLayers(visualState, transform, {
    walking,
    walkPhase
  })

  return {
    petBodyStyle: layers.bodyStyle,
    petSleepPoseStyle: layers.bodyStyle,
    petHeadStyle: layers.headStyle,
    petSleepMaskStyle: "",
    petLeftLegStraightStyle: layers.leftLegStraightStyle,
    petLeftLegBentStyle: layers.leftLegBentStyle,
    petRightLegStraightStyle: layers.rightLegStraightStyle,
    petRightLegBentStyle: layers.rightLegBentStyle,
    petShowSleep: false,
    petShowDefaultBody: visualState === "default",
    petShowReactBody: visualState === "react",
    petShowIdleBody: visualState === "idleAlt",
    petShowLeftStraight: !layers.leftBent,
    petShowLeftBent: layers.leftBent,
    petShowRightStraight: !layers.rightBent,
    petShowRightBent: layers.rightBent
  }
}

Page({
  data: {
    today: "",
    roomAssets: ROOM_ASSETS,
    hasSuitPet: false,
    petProfile: null,
    petProfiles: [],
    activePetId: "",
    maxPetProfiles: petService.MAX_PROFILES || 3,
    companionPets: [],
    collisionFx: [],

    stageWidth: 0,
    stageHeight: 0,

    petState: "IDLE",
    petCharacterSize: 106,
    petMotionStyle: "left:0px;top:0px;transform:scale(1);z-index:180;",
    petVisualStyle: "transform:scaleX(1);",
    petBodyStyle: "",
    petSleepPoseStyle: "",
    petHeadStyle: "",
    petSleepMaskStyle: "",
    petLeftLegStraightStyle: "",
    petLeftLegBentStyle: "",
    petRightLegStraightStyle: "",
    petRightLegBentStyle: "",
    petShowSleep: false,
    petShowDefaultBody: true,
    petShowReactBody: false,
    petShowIdleBody: false,
    petShowLeftStraight: true,
    petShowLeftBent: false,
    petShowRightStraight: true,
    petShowRightBent: false,

    petBubble: "",

    deskStyle: "",
    boardStyle: "",
    toyStyle: "",
    toyReturning: false,

    planSummary: {
      total: 0,
      completed: 0,
      pending: 0,
      allDone: false,
      items: []
    },
    planInput: "",
    panel: "",
    focusSummary: { totalMinutes: 0, sessions: 0, completed: 0, interrupted: 0, items: [] },
    focusActive: false,

    todayStatus: {
      code: "NO DATA",
      label: "今天还没记录",
      moodText: "—",
      energyText: "—",
      busynessText: "—",
      tagsText: "还没有今日状态"
    },
    latestPersonality: null
  },

  onLoad() {
    let windowWidth = 390
    let windowHeight = 760
    try {
      const info = typeof wx.getWindowInfo === "function"
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync()
      windowWidth = info.windowWidth || windowWidth
      windowHeight = info.windowHeight || windowHeight
    } catch (error) {}

    const stageWidth = Math.max(280, windowWidth - 24)
    const ratioHeight = stageWidth / ROOM_LAYOUT.aspectRatio
    const fullHeight = Math.max(ratioHeight, windowHeight - 220)
    this.setData({
      today: formatDate(new Date()),
      stageWidth,
      stageHeight: fullHeight
    })
    this.loadRoomData()
  },

  onShow() {
    if (this.data.today) this.loadRoomData()
  },

  onReady() {
    wx.nextTick(() => this.measureRoom())
  },

  onResize() {
    wx.nextTick(() => this.measureRoom())
  },

  onHide() {
    this.stopAllPetActivity()
    this.stopCompanionActivity()
  },

  onUnload() {
    this.stopAllPetActivity()
    this.stopCompanionActivity()
    clearTimeout(this._bubbleTimer)
  },

  loadRoomData() {
    let profile = null
    try {
      profile = petService.getProfile()
    } catch (error) {
      console.warn("读取监工失败：", error)
    }

    const profiles = petService.getProfiles ? petService.getProfiles() : (profile ? [profile] : [])
    const activePetId = petService.getActiveProfileId ? petService.getActiveProfileId() : (profile && profile.id || "")
    const hasSuitPet = petService.isSuitProfile(profile)
    const planSummary = planService.summary(this.data.today)
    const focusSummary = focusService.summary(this.data.today)
    const focusActive = Boolean(focusService.getActive())
    const record = recordService.getByDate(this.data.today)

    this.setData({
      petProfile: profile,
      petProfiles: profiles,
      activePetId,
      hasSuitPet,
      planSummary,
      focusSummary,
      focusActive,
      todayStatus: statusFromRecord(record),
      latestPersonality: personalitySnapshot()
    }, () => {
      if (hasSuitPet && this.data.stageWidth > 0) {
        this.resetPetForRoom(false)
        this.setupCompanions()
      }
    })
  },

  measureRoom() {
    this.createSelectorQuery()
      .select("#petRoomStage")
      .boundingClientRect(rect => {
        if (!rect || !(rect.width > 0 && rect.height > 0)) return

        this._roomRect = rect
        const stageWidth = rect.width
        const stageHeight = rect.height
        const scaleRatio = this.data.petProfile && this.data.petProfile.displayScale
          ? this.data.petProfile.displayScale / 1.15
          : 1
        const petCharacterSize = clamp(stageWidth * 0.27 * scaleRatio, 88, 138)

        const deskStyle = this.makeAssetStyle(ROOM_LAYOUT.desk, stageWidth, stageHeight, 720)
        const boardStyle = this.makeAssetStyle(ROOM_LAYOUT.board, stageWidth, stageHeight, 60)

        const toyWidth = stageWidth * ROOM_LAYOUT.toyHome.width
        const toyHeight = toyWidth * (446 / 540)
        const toyLeft = stageWidth * ROOM_LAYOUT.toyHome.left
        const toyTop = stageHeight * ROOM_LAYOUT.toyHome.top
        this._toyHome = { left: toyLeft, top: toyTop, width: toyWidth, height: toyHeight }
        this._toy = { ...this._toyHome }

        this.setData({
          stageWidth,
          stageHeight,
          petCharacterSize,
          deskStyle,
          boardStyle,
          toyStyle: this.makeToyStyle(this._toyHome, false)
        }, () => {
          if (this.data.hasSuitPet) this.resetPetForRoom(true)
          this.setupCompanions()
        })
      })
      .exec()
  },

  makeAssetStyle(layout, stageWidth, stageHeight, zIndex) {
    const width = stageWidth * layout.width
    return [
      `left:${stageWidth * layout.left}px`,
      `top:${stageHeight * layout.top}px`,
      `width:${width}px`,
      `z-index:${zIndex}`
    ].join(";") + ";"
  },

  makeToyStyle(toy, returning) {
    if (!toy) return ""
    return [
      `left:${toy.left}px`,
      `top:${toy.top}px`,
      `width:${toy.width}px`,
      `height:${toy.height}px`,
      returning ? `transition:left ${ROOM_BEHAVIOR.toyReturnMs}ms cubic-bezier(.2,.8,.25,1),top ${ROOM_BEHAVIOR.toyReturnMs}ms cubic-bezier(.2,.8,.25,1)` : "transition:none"
    ].filter(Boolean).join(";") + ";"
  },

  roomFloorBounds() {
    const w = this.data.stageWidth
    const h = this.data.stageHeight
    return {
      minX: w * ROOM_LAYOUT.floor.minX,
      maxX: w * ROOM_LAYOUT.floor.maxX,
      minBottomY: h * ROOM_LAYOUT.floor.minBottomY,
      maxBottomY: h * ROOM_LAYOUT.floor.maxBottomY
    }
  },

  getDeskWalkObstacle(size = this.data.petCharacterSize) {
    const w = this.data.stageWidth
    const h = this.data.stageHeight
    const deskLeft = w * ROOM_LAYOUT.desk.left
    const deskRight = deskLeft + w * ROOM_LAYOUT.desk.width
    return {
      minX: Math.max(0, deskLeft - size * 0.34),
      maxX: Math.min(w, deskRight + size * 0.34),
      maxBottomY: h * 0.715
    }
  },

  isNormalWalkPosition(point, size = this.data.petCharacterSize) {
    const bounds = this.roomFloorBounds()
    if (!point) return false
    if (point.centerX < bounds.minX || point.centerX > bounds.maxX ||
        point.bottomY < bounds.minBottomY || point.bottomY > bounds.maxBottomY) return false
    const obstacle = this.getDeskWalkObstacle(size)
    return !(point.centerX >= obstacle.minX &&
      point.centerX <= obstacle.maxX &&
      point.bottomY < obstacle.maxBottomY)
  },

  pickRandomWalkTarget() {
    const bounds = this.roomFloorBounds()
    for (let i = 0; i < 20; i += 1) {
      const target = {
        centerX: randomBetween(bounds.minX, bounds.maxX),
        bottomY: randomBetween(bounds.minBottomY, bounds.maxBottomY)
      }
      if (this.isNormalWalkPosition(target)) return target
    }
    return {
      centerX: bounds.maxX * 0.72,
      bottomY: Math.max(bounds.minBottomY, this.data.stageHeight * 0.78)
    }
  },

  segmentHitsDesk(startPoint, targetPoint, size = this.data.petCharacterSize) {
    if (!startPoint || !targetPoint) return false
    const obstacle = this.getDeskWalkObstacle(size)
    for (let i = 1; i < 12; i += 1) {
      const t = i / 12
      const x = startPoint.centerX + (targetPoint.centerX - startPoint.centerX) * t
      const y = startPoint.bottomY + (targetPoint.bottomY - startPoint.bottomY) * t
      if (x >= obstacle.minX && x <= obstacle.maxX && y < obstacle.maxBottomY) return true
    }
    return false
  },

  buildWalkRouteFrom(startPoint, targetPoint, size = this.data.petCharacterSize) {
    if (!startPoint || !this.segmentHitsDesk(startPoint, targetPoint, size)) return [targetPoint]
    const obstacle = this.getDeskWalkObstacle(size)
    const bounds = this.roomFloorBounds()
    const safeY = Math.min(bounds.maxBottomY, obstacle.maxBottomY + size * 0.36)
    const rightX = Math.min(bounds.maxX, obstacle.maxX + size * 0.26)
    return [
      { centerX: rightX, bottomY: safeY },
      { centerX: targetPoint.centerX, bottomY: Math.max(targetPoint.bottomY, safeY) }
    ]
  },

  buildWalkRoute(targetPoint) {
    return this.buildWalkRouteFrom(this._petPosition, targetPoint, this.data.petCharacterSize)
  },

  bouncePointFromDesk(currentPoint, candidatePoint, size = this.data.petCharacterSize) {
    const bounds = this.roomFloorBounds()
    const obstacle = this.getDeskWalkObstacle(size)
    const margin = Math.max(10, size * 0.16)
    const safe = {
      centerX: currentPoint && Number.isFinite(currentPoint.centerX) ? currentPoint.centerX : candidatePoint.centerX,
      bottomY: currentPoint && Number.isFinite(currentPoint.bottomY) ? currentPoint.bottomY : candidatePoint.bottomY
    }

    const fromLeft = Math.abs(candidatePoint.centerX - obstacle.minX)
    const fromRight = Math.abs(obstacle.maxX - candidatePoint.centerX)
    const fromBottom = Math.abs(obstacle.maxBottomY - candidatePoint.bottomY)

    if (currentPoint && currentPoint.centerX <= obstacle.minX) {
      safe.centerX = obstacle.minX - margin
    } else if (currentPoint && currentPoint.centerX >= obstacle.maxX) {
      safe.centerX = obstacle.maxX + margin
    } else if (currentPoint && currentPoint.bottomY >= obstacle.maxBottomY) {
      safe.bottomY = obstacle.maxBottomY + margin
    } else if (fromBottom <= fromLeft && fromBottom <= fromRight) {
      safe.bottomY = obstacle.maxBottomY + margin
    } else if (fromLeft <= fromRight) {
      safe.centerX = obstacle.minX - margin
    } else {
      safe.centerX = obstacle.maxX + margin
    }

    safe.centerX = clamp(safe.centerX, bounds.minX, bounds.maxX)
    safe.bottomY = clamp(safe.bottomY, bounds.minBottomY, bounds.maxBottomY)
    return safe
  },

  normalizePointOutsideDesk(point, size = this.data.petCharacterSize) {
    if (!point) return point
    if (this.isNormalWalkPosition(point, size)) return point
    const bounced = this.bouncePointFromDesk(point, point, size)
    return {
      centerX: bounced.centerX,
      bottomY: bounced.bottomY
    }
  },

  startMoveRoute(route, mode, onDone) {
    const points = Array.isArray(route) ? route.slice() : []
    if (!points.length) {
      if (typeof onDone === "function") onDone()
      return
    }
    const next = points.shift()
    this.startMoveLoop(next, mode, () => {
      if (points.length) {
        this.startMoveRoute(points, mode, onDone)
        return true
      }
      if (typeof onDone === "function") return Boolean(onDone())
      return false
    })
  },

  resetPetForRoom(preservePosition) {
    this.stopAllPetActivity()
    if (!this.data.hasSuitPet || !this.data.stageWidth) return

    const bounds = this.roomFloorBounds()
    if (!preservePosition || !this._petPosition) {
      this._petPosition = {
        centerX: this.data.stageWidth * 0.70,
        bottomY: this.data.stageHeight * 0.82
      }
    } else {
      this._petPosition.centerX = clamp(this._petPosition.centerX, bounds.minX, bounds.maxX)
      this._petPosition.bottomY = clamp(this._petPosition.bottomY, bounds.minBottomY, bounds.maxBottomY)
      if (!this.isNormalWalkPosition(this._petPosition)) {
        this._petPosition = {
          centerX: this.data.stageWidth * 0.70,
          bottomY: this.data.stageHeight * 0.82
        }
      }
    }
    this._petDirection = this._petDirection || 1
    this.applyPetState("IDLE", 0)
    this.updatePetMotion()
    this.scheduleWalk()
    this.scheduleSleep()
  },

  applyPetState(state, walkPhase) {
    if (!this.data.hasSuitPet || !this.data.petProfile) return
    this.setData({
      petState: state,
      ...buildPetLayers(this.data.petProfile, state, walkPhase)
    })
  },

  updatePetMotion() {
    if (!this._petPosition) return
    const size = this.data.petCharacterSize
    const left = this._petPosition.centerX - size / 2
    const top = this._petPosition.bottomY - size
    const depth = clamp(
      0.90 + ((this._petPosition.bottomY / this.data.stageHeight) - 0.66) * 0.38,
      0.90,
      1.04
    )
    const z = 140 + Math.round(this._petPosition.bottomY)
    this.setData({
      petMotionStyle: `left:${left}px;top:${top}px;transform:scale(${depth});z-index:${z};`,
      petVisualStyle: `transform:scaleX(${this._petDirection || 1});`
    })
  },

  stopCompanionActivity() {
    clearInterval(this._companionTimer)
    this._companionTimer = null
  },

  setupCompanions() {
    this.stopCompanionActivity()
    if (!this.data.stageWidth || !this.data.stageHeight) {
      this.setData({ companionPets: [] })
      return
    }
    const profiles = (this.data.petProfiles || [])
      .filter(item => item.id !== this.data.activePetId && petService.isSuitProfile(item))
      .slice(0, Math.max(0, (this.data.maxPetProfiles || 3) - 1))

    const bounds = this.roomFloorBounds()
    const baseSize = this.data.petCharacterSize || 106
    this._companions = profiles.map((profile, index) => {
      const ratio = clamp((profile.displayScale || 1.15) / 1.15, 0.88, 1.08)
      const size = baseSize * ratio
      const startX = clamp(
        bounds.maxX - (index + 1) * size * 0.92,
        bounds.minX + size * 0.18,
        bounds.maxX - size * 0.18
      )
      const startY = clamp(
        bounds.maxBottomY - index * size * 0.36,
        Math.max(bounds.minBottomY, this.data.stageHeight * 0.76),
        bounds.maxBottomY
      )
      const now = Date.now()
      return {
        id: profile.id,
        profile,
        size,
        centerX: startX,
        bottomY: startY,
        direction: index % 2 === 0 ? -1 : 1,
        phase: 0,
        state: "IDLE",
        route: [],
        target: null,
        waitUntil: now + 700 + index * 500,
        sleepAt: now + ROOM_BEHAVIOR.sleepAfterMs + index * 2400,
        wakeAt: 0,
        catchUntil: 0
      }
    })
    this.refreshCompanionData()
    if (!this._companions.length) return
    this._companionTimer = setInterval(() => this.tickCompanions(), ROOM_BEHAVIOR.walkTickMs)
  },

  pickCompanionTarget(companion) {
    const bounds = this.roomFloorBounds()
    const others = [
      ...(this._companions || []).filter(item => item.id !== companion.id),
      ...(this._petPosition && this.data.petState !== "DESK"
        ? [{ id: this.data.activePetId, centerX: this._petPosition.centerX, bottomY: this._petPosition.bottomY, size: this.data.petCharacterSize }]
        : [])
    ]

    // 偶尔主动去找另一个监工，制造“碰面”机会；其余时间仍是随机巡视。
    const socialTarget = others.length && Math.random() < 0.28
      ? others[Math.floor(Math.random() * others.length)]
      : null

    for (let i = 0; i < 24; i += 1) {
      const target = socialTarget
        ? {
            centerX: clamp(socialTarget.centerX + randomBetween(-12, 12), bounds.minX, bounds.maxX),
            bottomY: clamp(socialTarget.bottomY + randomBetween(-8, 8), bounds.minBottomY, bounds.maxBottomY)
          }
        : {
            centerX: randomBetween(bounds.minX, bounds.maxX),
            bottomY: randomBetween(bounds.minBottomY, bounds.maxBottomY)
          }
      if (!this.isNormalWalkPosition(target, companion.size)) continue
      companion.route = this.buildWalkRouteFrom(
        { centerX: companion.centerX, bottomY: companion.bottomY },
        target,
        companion.size
      )
      companion.target = companion.route.shift() || null
      companion.state = companion.target ? "WALK" : "IDLE"
      return
    }
    companion.waitUntil = Date.now() + 900
    companion.state = "IDLE"
  },

  isPositionClearOfPets(point, size, excludeId = "") {
    const minDistance = Math.max(42, size * 0.64)
    if (this._petPosition && excludeId !== this.data.activePetId) {
      const dx = point.centerX - this._petPosition.centerX
      const dy = point.bottomY - this._petPosition.bottomY
      if (Math.sqrt(dx * dx + dy * dy) < minDistance) return false
    }
    const companions = this._companions || []
    for (const item of companions) {
      if (item.id === excludeId) continue
      const dx = point.centerX - item.centerX
      const dy = point.bottomY - item.bottomY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < Math.max(minDistance, (size + item.size) * 0.32)) return false
    }
    return true
  },

  getNearbySleepPosition(point, size, excludeId = "") {
    const bounds = this.roomFloorBounds()
    const current = {
      centerX: clamp(point.centerX, bounds.minX, bounds.maxX),
      bottomY: clamp(point.bottomY, bounds.minBottomY, bounds.maxBottomY)
    }
    const sleepers = []
    if (this._petPosition && this.data.petState === "SLEEP" && excludeId !== this.data.activePetId) {
      sleepers.push({ id: this.data.activePetId, centerX: this._petPosition.centerX, bottomY: this._petPosition.bottomY, size: this.data.petCharacterSize })
    }
    for (const item of (this._companions || [])) {
      if (item.id !== excludeId && item.state === "SLEEP") sleepers.push({ id:item.id, centerX:item.centerX, bottomY:item.bottomY, size:item.size })
    }
    const free = candidate => {
      if (!this.isNormalWalkPosition(candidate, size)) return false
      return sleepers.every(other => {
        const dx = candidate.centerX - other.centerX
        const dy = candidate.bottomY - other.bottomY
        return Math.sqrt(dx * dx + dy * dy) >= Math.max(48, (size + other.size) * 0.42)
      })
    }
    if (free(current)) return current
    const radius = Math.max(52, size * 0.58)
    const offsets = [
      [radius,0],[-radius,0],[0,radius],[0,-radius],
      [radius*.75,radius*.55],[-radius*.75,radius*.55],[radius*.75,-radius*.55],[-radius*.75,-radius*.55]
    ]
    for (const [dx,dy] of offsets) {
      const candidate = { centerX: clamp(current.centerX + dx, bounds.minX, bounds.maxX), bottomY: clamp(current.bottomY + dy, bounds.minBottomY, bounds.maxBottomY) }
      if (free(candidate)) return candidate
    }
    return current
  },

  tickCompanions() {
    const companions = this._companions || []
    if (!companions.length) return
    const now = Date.now()
    const speedBase = Math.max(2.4, this.data.stageWidth * 0.008)
    const toyTip = this._toyActive ? this.toyTip() : null
    const bounds = this.roomFloorBounds()

    companions.forEach(item => {
      // 拖动逗宠棒时，所有监工都会立刻醒来并追毛球。
      if (toyTip) {
        item.wakeAt = 0
        item.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
        const target = this.getToyChaseTarget(item.id, item.size)
        if (!target) return
        const cdx = target.centerX - item.centerX
        const cdy = target.bottomY - item.bottomY
        const catchDistance = Math.sqrt(cdx * cdx + cdy * cdy)
        const stopDistance = Math.max(10, item.size * 0.12)
        if (catchDistance <= stopDistance) {
          item.state = "CATCH"
          item.target = null
          item.route = []
          item.catchUntil = now + 280
          return
        }

        item.state = "CHASE"
        const route = this.buildWalkRouteFrom(
          { centerX: item.centerX, bottomY: item.bottomY },
          target,
          item.size
        )
        const next = route[0] || target
        const dx = next.centerX - item.centerX
        const dy = next.bottomY - item.bottomY
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > 0.5) {
          const step = Math.min(speedBase * ROOM_BEHAVIOR.chaseSpeedMultiplier, distance)
          const candidate = {
            centerX: item.centerX + dx / distance * step,
            bottomY: item.bottomY + dy / distance * step
          }
          if (this.isNormalWalkPosition(candidate, item.size)) {
            item.direction = dx >= 0 ? 1 : -1
            item.centerX = candidate.centerX
            item.bottomY = candidate.bottomY
            item.phase = 1 - item.phase
          } else {
            const bounced = this.bouncePointFromDesk(
              { centerX: item.centerX, bottomY: item.bottomY },
              candidate,
              item.size
            )
            item.centerX = bounced.centerX
            item.bottomY = bounced.bottomY
            item.direction = dx >= 0 ? -1 : 1
            item.target = null
            item.route = []
            item.state = "IDLE"
            item.waitUntil = now + 420
          }
        }
        return
      }

      // 与主监工一致：睡着后不会自己醒，只有用户点它或逗宠棒开始时才醒。
      if (item.state === "SLEEP") {
        return
      }
      if (now >= (item.sleepAt || Infinity)) {
        const sleepPoint = this.getNearbySleepPosition(
          { centerX: item.centerX, bottomY: item.bottomY },
          item.size,
          item.id
        )
        item.centerX = sleepPoint.centerX
        item.bottomY = sleepPoint.bottomY
        item.state = "SLEEP"
        item.target = null
        item.route = []
        item.wakeAt = 0
        return
      }

      if (now < (item.waitUntil || 0)) {
        item.state = "IDLE"
        return
      }
      if (!item.target) {
        this.pickCompanionTarget(item)
        return
      }
      const dx = item.target.centerX - item.centerX
      const dy = item.target.bottomY - item.bottomY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < speedBase * 1.25) {
        item.centerX = item.target.centerX
        item.bottomY = item.target.bottomY
        if (item.route && item.route.length) {
          item.target = item.route.shift()
          item.state = "WALK"
        } else {
          item.target = null
          item.state = "IDLE"
          item.waitUntil = now + 900 + Math.random() * 1500
        }
        return
      }
      const step = Math.min(speedBase, distance)
      const candidate = {
        centerX: item.centerX + dx / distance * step,
        bottomY: item.bottomY + dy / distance * step
      }
      if (!this.isNormalWalkPosition(candidate, item.size)) {
        const bounced = this.bouncePointFromDesk(
          { centerX: item.centerX, bottomY: item.bottomY },
          candidate,
          item.size
        )
        item.centerX = bounced.centerX
        item.bottomY = bounced.bottomY
        item.direction = dx >= 0 ? -1 : 1
        item.target = null
        item.route = []
        item.state = "IDLE"
        item.waitUntil = now + 500 + Math.random() * 800
        return
      }
      item.direction = dx >= 0 ? 1 : -1
      item.centerX = candidate.centerX
      item.bottomY = candidate.bottomY
      item.phase = 1 - item.phase
      item.state = "WALK"
    })

    if (this._petPosition && this.data.petState !== "DESK") {
      this._petPosition = this.normalizePointOutsideDesk(this._petPosition, this.data.petCharacterSize)
      this.updatePetMotion()
    }
    companions.forEach(item => {
      const fixed = this.normalizePointOutsideDesk({ centerX: item.centerX, bottomY: item.bottomY }, item.size)
      item.centerX = fixed.centerX
      item.bottomY = fixed.bottomY
    })
    this.handlePetCollisions(now)
    this.refreshCompanionData()
  },

  refreshCompanionData() {
    const stageHeight = this.data.stageHeight || 1
    const items = (this._companions || []).map(item => {
      const normalized = this.normalizePointOutsideDesk({ centerX: item.centerX, bottomY: item.bottomY }, item.size)
      item.centerX = normalized.centerX
      item.bottomY = normalized.bottomY
      const sleeping = item.state === "SLEEP"
      const moving = item.state === "WALK" || item.state === "CHASE"
      const transform = petService.normalizeHeadTransform(item.profile.headTransform)
      const standing = buildStandingLayers("default", transform, {
        walking: moving,
        walkPhase: item.phase
      })
      const sleep = sleeping ? buildSleepLayers(transform) : null
      const depth = clamp(
        0.90 + ((item.bottomY / stageHeight) - 0.66) * 0.38,
        0.90,
        1.04
      )
      const left = item.centerX - item.size / 2
      const top = item.bottomY - item.size
      const z = 135 + Math.round(item.bottomY)
      return {
        id: item.id,
        name: item.profile.name,
        state: item.state || "IDLE",
        headImage: item.profile.headImage,
        size: item.size,
        motionStyle: `left:${left}px;top:${top}px;transform:scale(${depth});z-index:${z};`,
        visualStyle: `transform:scaleX(${item.direction || 1});`,
        bodyStyle: standing.bodyStyle,
        headStyle: sleeping ? sleep.headStyle : standing.headStyle,
        sleepPoseStyle: sleeping ? sleep.sleepPoseStyle : standing.bodyStyle,
        sleepMaskStyle: sleeping ? sleep.sleepMaskStyle : "",
        showSleep: sleeping,
        leftLegStraightStyle: standing.leftLegStraightStyle,
        leftLegBentStyle: standing.leftLegBentStyle,
        rightLegStraightStyle: standing.rightLegStraightStyle,
        rightLegBentStyle: standing.rightLegBentStyle,
        showLeftStraight: !sleeping && !standing.leftBent,
        showLeftBent: !sleeping && standing.leftBent,
        showRightStraight: !sleeping && !standing.rightBent,
        showRightBent: !sleeping && standing.rightBent
      }
    })
    this.setData({ companionPets: items })
  },

  handlePetCollisions(now = Date.now()) {
    const pets = []
    if (this._petPosition && this.data.petState !== "DESK") {
      pets.push({
        id: this.data.activePetId || "main",
        main: true,
        size: this.data.petCharacterSize,
        centerX: this._petPosition.centerX,
        bottomY: this._petPosition.bottomY,
        state: this.data.petState
      })
    }
    for (const item of (this._companions || [])) {
      pets.push({
        id: item.id,
        main: false,
        ref: item,
        size: item.size,
        centerX: item.centerX,
        bottomY: item.bottomY,
        state: item.state
      })
    }
    this._collisionCooldowns = this._collisionCooldowns || {}

    for (let i = 0; i < pets.length; i += 1) {
      for (let j = i + 1; j < pets.length; j += 1) {
        const a = pets[i]
        const b = pets[j]
        if (a.state === "DESK" || b.state === "DESK") continue
        const dx = b.centerX - a.centerX
        const dy = b.bottomY - a.bottomY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const threshold = Math.max(34, (a.size + b.size) * 0.28)
        if (distance > threshold) continue

        const key = [a.id, b.id].sort().join("|")
        const last = this._collisionCooldowns[key] || 0
        if (now - last > 1350) {
          this._collisionCooldowns[key] = now
          this.spawnCollisionFx(
            (a.centerX + b.centerX) / 2,
            (a.bottomY + b.bottomY) / 2 - Math.max(a.size, b.size) * 0.62
          )
        }

      }
    }
  },

  spawnCollisionFx(centerX, centerY) {
    const count = 3 + Math.floor(Math.random() * 3)
    const baseId = `${Date.now()}_${Math.floor(Math.random() * 9999)}`
    const next = []
    for (let i = 0; i < count; i += 1) {
      const heart = Math.random() < 0.52
      next.push({
        id: `${baseId}_${i}`,
        symbol: heart ? "♥" : "★",
        color: heart ? "#e84b5b" : "#f2b544",
        left: centerX + randomBetween(-24, 24),
        top: centerY + randomBetween(-10, 12),
        size: Math.round(randomBetween(14, 29)),
        delay: Math.round(randomBetween(0, 140))
      })
    }
    const merged = [...(this.data.collisionFx || []), ...next].slice(-18)
    this.setData({ collisionFx: merged })
    setTimeout(() => {
      const ids = new Set(next.map(item => item.id))
      this.setData({
        collisionFx: (this.data.collisionFx || []).filter(item => !ids.has(item.id))
      })
    }, 1350)
  },

  onCompanionTap(event) {
    const id = event.currentTarget.dataset.id
    const item = (this._companions || []).find(pet => pet.id === id)
    if (!item) return

    const now = Date.now()
    if (item.state === "SLEEP") {
      item.state = "IDLE"
      item.target = null
      item.route = []
      item.wakeAt = 0
      item.waitUntil = now + 600
      item.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
      this.refreshCompanionData()
      return
    }

    // 醒着时点一下只让它原地停一下，不改变主监工身份。
    item.state = "IDLE"
    item.target = null
    item.route = []
    item.waitUntil = now + 700
    item.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
    this.refreshCompanionData()
  },

  stopAllPetActivity() {
    clearTimeout(this._idleTimer)
    clearTimeout(this._sleepTimer)
    clearTimeout(this._reactTimer)
    clearInterval(this._walkTimer)
    clearInterval(this._chaseTimer)
    this._idleTimer = null
    this._sleepTimer = null
    this._reactTimer = null
    this._walkTimer = null
    this._chaseTimer = null
  },

  resetInactivity() {
    clearTimeout(this._sleepTimer)
    if (this.data.hasSuitPet && !["CHASE", "CATCH", "DESK"].includes(this.data.petState)) {
      this.scheduleSleep()
    }
  },

  scheduleWalk() {
    clearTimeout(this._idleTimer)
    if (!this.data.hasSuitPet || ["SLEEP", "DESK", "CHASE", "CATCH"].includes(this.data.petState)) return
    this._idleTimer = setTimeout(() => this.startRandomWalk(), ROOM_BEHAVIOR.idleBeforeWalkMs)
  },

  startRandomWalk() {
    if (!this.data.hasSuitPet || this._walkTimer || ["SLEEP", "DESK", "CHASE", "CATCH"].includes(this.data.petState)) return
    const target = this.pickRandomWalkTarget()
    const route = this.buildWalkRoute(target)
    this.startMoveRoute(route, "WALK")
  },

  startMoveLoop(target, mode, onArrive) {
    clearInterval(this._walkTimer)
    let phase = 0
    const tickMs = ROOM_BEHAVIOR.walkTickMs
    const baseSpeed = Math.max(2.4, this.data.stageWidth * 0.008)

    this._walkTimer = setInterval(() => {
      if (!this._petPosition || this.data.petState === "SLEEP" || this.data.petState === "DESK") {
        clearInterval(this._walkTimer)
        this._walkTimer = null
        return
      }
      const dx = target.centerX - this._petPosition.centerX
      const dy = target.bottomY - this._petPosition.bottomY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < baseSpeed * 1.2) {
        this._petPosition = { ...target }
        this.updatePetMotion()
        clearInterval(this._walkTimer)
        this._walkTimer = null
        if (typeof onArrive === "function") {
          const handled = onArrive()
          if (handled) return
        }
        this.applyPetState(Math.random() < 0.24 ? "IDLE_ALT" : "IDLE", 0)
        this.scheduleWalk()
        return
      }

      this._petDirection = dx >= 0 ? 1 : -1
      const candidate = {
        centerX: this._petPosition.centerX + dx / distance * baseSpeed,
        bottomY: this._petPosition.bottomY + dy / distance * baseSpeed
      }
      if (!this.isNormalWalkPosition(candidate, this.data.petCharacterSize)) {
        const bounced = this.bouncePointFromDesk(this._petPosition, candidate, this.data.petCharacterSize)
        this._petPosition = { ...bounced }
        this._petDirection = dx >= 0 ? -1 : 1
        clearInterval(this._walkTimer)
        this._walkTimer = null
        this.applyPetState(Math.random() < 0.24 ? "IDLE_ALT" : "IDLE", 0)
        this.updatePetMotion()
        this.scheduleWalk()
        return
      }
      this._petPosition.centerX = candidate.centerX
      this._petPosition.bottomY = candidate.bottomY
      phase = 1 - phase
      this.applyPetState(mode, phase)
      this.updatePetMotion()
      this.handlePetCollisions(Date.now())
    }, tickMs)
  },

  scheduleSleep() {
    clearTimeout(this._sleepTimer)
    if (!this.data.hasSuitPet || ["DESK", "CHASE", "CATCH"].includes(this.data.petState)) return
    this._sleepTimer = setTimeout(() => this.enterSleep(), ROOM_BEHAVIOR.sleepAfterMs)
  },

  enterSleep() {
    if (!this.data.hasSuitPet || ["DESK", "CHASE", "CATCH"].includes(this.data.petState)) return
    clearInterval(this._walkTimer)
    clearTimeout(this._idleTimer)
    this._walkTimer = null
    this._idleTimer = null
    this._petPosition = this.getNearbySleepPosition(
      this._petPosition || {
        centerX: this.data.stageWidth * 0.66,
        bottomY: this.data.stageHeight * 0.84
      },
      this.data.petCharacterSize,
      this.data.activePetId
    )
    this._petDirection = this._petDirection || 1
    this.applyPetState("SLEEP", 0)
    this.updatePetMotion()
    this.showPetBubble("Zzz… 监工已进入省电模式。", 0)
  },

  wakePet(message) {
    if (this.data.petState !== "SLEEP") return
    this.applyPetState("IDLE", 0)
    this.showPetBubble(message || `${this.data.petProfile.name}醒了。`, 1500)
    this.scheduleWalk()
    this.scheduleSleep()
  },

  onPetTap() {
    if (!this.data.hasSuitPet) {
      this.goCreatePet()
      return
    }
    if (this.data.petState === "SLEEP") {
      this.wakePet("被你叫醒了。")
      return
    }
    if (["CHASE", "CATCH", "DESK"].includes(this.data.petState)) return

    this.stopAllPetActivity()
    this.applyPetState("REACT", 0)
    const message = this.getContextPetMessage()
    this.showPetBubble(message, 1800)
    this._reactTimer = setTimeout(() => {
      this.applyPetState("IDLE", 0)
      this.scheduleWalk()
      this.scheduleSleep()
    }, ROOM_BEHAVIOR.reactMs)
  },

  getContextPetMessage() {
    const name = this.data.petProfile ? this.data.petProfile.name : "监工"
    const plan = this.data.planSummary
    const record = recordService.getByDate(this.data.today)

    if (plan.allDone) return "今日任务完成，批准娱乐。"
    if (plan.pending > 0) return `${name}看着你：还有 ${plan.pending} 项。`
    if (record && Array.isArray(record.tags) && record.tags.includes("摸鱼")) return "我们两个到底谁在摸鱼？"
    if (record && Array.isArray(record.tags) && record.tags.includes("休息")) return "今天允许合理休息。"
    return `${name}看着你，不许偷懒！`
  },

  showPetBubble(message, duration = 1600) {
    clearTimeout(this._bubbleTimer)
    this.setData({ petBubble: message || "" })
    if (duration > 0) {
      this._bubbleTimer = setTimeout(() => this.setData({ petBubble: "" }), duration)
    }
  },

  getDeskPetAnchor() {
    const deskLeft = this.data.stageWidth * ROOM_LAYOUT.desk.left
    const deskTop = this.data.stageHeight * ROOM_LAYOUT.desk.top
    const deskWidth = this.data.stageWidth * ROOM_LAYOUT.desk.width
    const size = this.data.petCharacterSize
    // 只露出完整头部和半个西装，其余身体留在桌后被遮住。
    return {
      centerX: deskLeft + deskWidth * 0.56,
      bottomY: deskTop + size * 0.58
    }
  },

  getDeskSideAnchor() {
    const deskLeft = this.data.stageWidth * ROOM_LAYOUT.desk.left
    const deskWidth = this.data.stageWidth * ROOM_LAYOUT.desk.width
    const size = this.data.petCharacterSize
    const hiddenY = this.getDeskPetAnchor().bottomY
    return {
      centerX: Math.min(this.data.stageWidth * 0.88, deskLeft + deskWidth + size * 0.62),
      bottomY: hiddenY
    }
  },

  getDeskFloorExitAnchor() {
    const side = this.getDeskSideAnchor()
    const bounds = this.roomFloorBounds()
    return {
      centerX: clamp(side.centerX, bounds.minX, bounds.maxX),
      bottomY: Math.min(bounds.maxBottomY, bounds.minBottomY + this.data.stageHeight * 0.085)
    }
  },

  openPlanPanel() {
    this.interruptForInteraction()
    this._petAtDesk = true
    if (this.data.hasSuitPet) {
      this._petPosition = this.getDeskPetAnchor()
      this._petDirection = 1
      this.applyPetState("DESK", 0)
      this.updatePetMotion()
    }
    this.setData({ panel: "plans" })
  },

  openStatusPanel() {
    this.interruptForInteraction()
    if (this.data.hasSuitPet) this.applyPetState("IDLE", 0)
    this.setData({
      panel: "status",
      todayStatus: statusFromRecord(recordService.getByDate(this.data.today)),
      latestPersonality: personalitySnapshot(),
      planSummary: planService.summary(this.data.today)
    })
    this.showPetBubble("状态板已更新。", 1200)
  },

  closePanel() {
    const wasDesk = Boolean(this._petAtDesk)
    this.setData({ panel: "", planInput: "" })
    if (!this.data.hasSuitPet) return

    if (wasDesk) {
      this.exitDeskFromSide()
      return
    }

    this.applyPetState("IDLE", 0)
    this.scheduleWalk()
    this.scheduleSleep()
  },

  exitDeskFromSide() {
    this.stopAllPetActivity()
    const floorTarget = this.getDeskFloorExitAnchor()

    // 关闭计划后，直接把监工放到书桌右侧地面，避免出现穿模、悬空腿，
    // 同时确保非写作状态绝不会停留在书桌后方。
    this._petAtDesk = false
    this._petPosition = { ...floorTarget }
    this._petDirection = 1
    this.applyPetState("IDLE", 0)
    this.updatePetMotion()
    this.scheduleWalk()
    this.scheduleSleep()
  },

  interruptForInteraction() {
    if (this.data.petState === "SLEEP") this.wakePet("")
    this.stopAllPetActivity()
  },

  onPlanInput(event) {
    this.setData({ planInput: event.detail.value })
  },

  addPlan() {
    try {
      const result = planService.add(this.data.today, this.data.planInput)
      const summary = planService.summary(this.data.today)
      this.setData({ planSummary: summary, planInput: "" })
      this.showPetBubble(`计划已登记，今天共 ${result.items.length} 项。`, 1500)
    } catch (error) {
      wx.showToast({ title: error.message || "添加失败", icon: "none" })
    }
  },

  togglePlan(event) {
    const id = event.currentTarget.dataset.id
    try {
      planService.toggle(this.data.today, id)
      const summary = planService.summary(this.data.today)
      this.setData({ planSummary: summary })
      if (summary.allDone) {
        this.showPetBubble("BUILD SUCCEEDED。今天可以合法下班了。", 2200)
        this.applyPetState("REACT", 0)
        clearTimeout(this._reactTimer)
        this._reactTimer = setTimeout(() => this.applyPetState("DESK", 0), 850)
      } else {
        this.showPetBubble(summary.pending ? `还剩 ${summary.pending} 项。` : "计划清空。", 1400)
      }
    } catch (error) {
      wx.showToast({ title: error.message || "更新失败", icon: "none" })
    }
  },

  removePlan(event) {
    const id = event.currentTarget.dataset.id
    try {
      planService.remove(this.data.today, id)
      this.setData({ planSummary: planService.summary(this.data.today) })
    } catch (error) {
      wx.showToast({ title: error.message || "删除失败", icon: "none" })
    }
  },

  toyTip() {
    const toy = this._toy || this._toyHome
    if (!toy) return null
    return {
      x: toy.left + toy.width * 0.81,
      y: toy.top + toy.height * 0.24
    }
  },

  getToyChaseTarget(petId, size) {
    const tip = this.toyTip()
    if (!tip) return null
    const bounds = this.roomFloorBounds()
    const order = [
      this.data.activePetId || "main",
      ...(this._companions || []).map(item => item.id)
    ]
    const count = Math.max(1, order.length)
    const index = Math.max(0, order.indexOf(petId))
    const petSize = Math.max(1, size || this.data.petCharacterSize || 1)
    const spacing = Math.max(68, Math.min(92, petSize * 0.82))

    let xOffset = 0
    let yOffset = 0
    if (count === 2) {
      xOffset = index === 0 ? -spacing * 0.52 : spacing * 0.52
      yOffset = spacing * 0.08
    } else if (count >= 3) {
      // 主监工占中间，另外两只分别在左右，避免三只一起挤到逗猫棒同一个像素点。
      const slots = [0, -spacing, spacing]
      xOffset = slots[Math.min(index, slots.length - 1)]
      yOffset = index === 0 ? 0 : spacing * 0.16
    }

    const leftSpread = count >= 3 ? spacing : count === 2 ? spacing * 0.52 : 0
    const rightSpread = leftSpread
    const baseX = clamp(
      tip.x,
      bounds.minX + leftSpread,
      bounds.maxX - rightSpread
    )
    return {
      centerX: clamp(baseX + xOffset, bounds.minX, bounds.maxX),
      bottomY: clamp(
        tip.y + petSize * 0.58 + yOffset,
        bounds.minBottomY,
        bounds.maxBottomY
      )
    }
  },

  onToyTouchStart(event) {
    if (!this.data.hasSuitPet || !this._roomRect || !this._toy) return
    this.interruptForInteraction()
    const touch = event.touches && event.touches[0]
    if (!touch) return
    const localX = touch.clientX - this._roomRect.left
    const localY = touch.clientY - this._roomRect.top
    this._toyGrabDx = localX - this._toy.left
    this._toyGrabDy = localY - this._toy.top
    this._toyActive = true
    const now = Date.now()
    for (const item of (this._companions || [])) {
      item.state = "CHASE"
      item.target = null
      item.route = []
      item.wakeAt = 0
      item.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
    }
    this.setData({ toyReturning: false })
    this.applyPetState("CHASE", 0)
    this.startChaseLoop()
  },

  onToyTouchMove(event) {
    if (!this._toy || !this._roomRect) return
    const touch = event.touches && event.touches[0]
    if (!touch) return
    const localX = touch.clientX - this._roomRect.left
    const localY = touch.clientY - this._roomRect.top
    const maxLeft = Math.max(0, this.data.stageWidth - this._toy.width)
    const maxTop = Math.max(0, this.data.stageHeight - this._toy.height)
    this._toy.left = clamp(localX - this._toyGrabDx, 0, maxLeft)
    this._toy.top = clamp(localY - this._toyGrabDy, 0, maxTop)
    this.setData({ toyStyle: this.makeToyStyle(this._toy, false) })

    if (this.data.petState === "CATCH") {
      const tip = this.toyTip()
      const petPoint = this.petCatchPoint()
      if (tip && petPoint) {
        const dx = tip.x - petPoint.x
        const dy = tip.y - petPoint.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > this.data.petCharacterSize * 0.62) this.applyPetState("CHASE", 0)
      }
    }
  },

  onToyTouchEnd() {
    if (!this._toyHome) return
    this._toyActive = false
    const now = Date.now()
    for (const item of (this._companions || [])) {
      item.state = "IDLE"
      item.target = null
      item.route = []
      item.waitUntil = now + 650 + Math.random() * 850
      item.sleepAt = now + ROOM_BEHAVIOR.sleepAfterMs
      item.wakeAt = 0
    }
    clearInterval(this._chaseTimer)
    this._chaseTimer = null
    this._toy = { ...this._toyHome }
    this.setData({
      toyReturning: true,
      toyStyle: this.makeToyStyle(this._toyHome, true)
    })
    setTimeout(() => {
      this.setData({ toyReturning: false, toyStyle: this.makeToyStyle(this._toyHome, false) })
    }, ROOM_BEHAVIOR.toyReturnMs + 30)

    if (this.data.hasSuitPet) {
      this.applyPetState("IDLE", 0)
      this.showPetBubble(this.getAfterPlayMessage(), 1500)
      this.scheduleWalk()
      this.scheduleSleep()
    }
  },

  startChaseLoop() {
    clearInterval(this._chaseTimer)
    let phase = 0
    const speed = Math.max(2.4, this.data.stageWidth * 0.008) * ROOM_BEHAVIOR.chaseSpeedMultiplier

    this._chaseTimer = setInterval(() => {
      if (!this._petPosition || !["CHASE", "CATCH"].includes(this.data.petState)) return
      const tip = this.toyTip()
      if (!tip) return
      const target = this.getToyChaseTarget(
        this.data.activePetId || "main",
        this.data.petCharacterSize
      )
      if (!target) return

      const cdx = target.centerX - this._petPosition.centerX
      const cdy = target.bottomY - this._petPosition.bottomY
      const catchDistance = Math.sqrt(cdx * cdx + cdy * cdy)
      const stopDistance = Math.max(10, this.data.petCharacterSize * 0.12)
      if (catchDistance <= stopDistance) {
        if (this.data.petState !== "CATCH") {
          this.applyPetState("CATCH", 0)
          this.showPetBubble(this.randomCatchMessage(), 900)
        }
        return
      }

      if (this.data.petState !== "CHASE") this.applyPetState("CHASE", phase)
      const dx = target.centerX - this._petPosition.centerX
      const dy = target.bottomY - this._petPosition.bottomY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < 1) return
      const step = Math.min(speed, distance)
      this._petDirection = dx >= 0 ? 1 : -1
      const candidate = {
        centerX: this._petPosition.centerX + dx / distance * step,
        bottomY: this._petPosition.bottomY + dy / distance * step
      }
      if (!this.isNormalWalkPosition(candidate, this.data.petCharacterSize)) {
        this._petPosition = this.bouncePointFromDesk(
          this._petPosition,
          candidate,
          this.data.petCharacterSize
        )
        this._petDirection = dx >= 0 ? -1 : 1
        this.updatePetMotion()
        return
      }
      this._petPosition.centerX = candidate.centerX
      this._petPosition.bottomY = candidate.bottomY
      phase = 1 - phase
      this.applyPetState("CHASE", phase)
      this.updatePetMotion()
      this.handlePetCollisions(Date.now())
    }, ROOM_BEHAVIOR.chaseTickMs)
  },

  petCatchPoint() {
    if (!this._petPosition) return { x: 0, y: 0 }
    return {
      x: this._petPosition.centerX,
      y: this._petPosition.bottomY - this.data.petCharacterSize * 0.58
    }
  },

  randomCatchMessage() {
    const list = ["抓到了。", "再来。", "工作时间禁止钓监工。", "这次算你放水。"]
    return list[Math.floor(Math.random() * list.length)]
  },

  getAfterPlayMessage() {
    const plan = this.data.planSummary
    if (plan.allDone) return "今日任务完成，批准继续娱乐。"
    if (plan.pending > 0) return `玩归玩，还有 ${plan.pending} 项没做。`
    const record = recordService.getByDate(this.data.today)
    if (record && Array.isArray(record.tags) && record.tags.includes("摸鱼")) return "我们两个到底谁在摸鱼？"
    return "玩具归位，继续正常运行。"
  },


  goToFocus() {
    this.setData({ panel: "" })
    wx.navigateTo({ url: "/pages/focus/focus" })
  },

  startFocusForPlan(event) {
    const id = event && event.currentTarget && event.currentTarget.dataset
      ? String(event.currentTarget.dataset.id || "")
      : ""
    this.setData({ panel: "" })
    wx.navigateTo({ url: `/pages/focus/focus${id ? `?planId=${id}` : ""}` })
  },

  noop() {},

  openPetManager() {
    this.interruptForInteraction()
    this.setData({
      panel: "manager",
      petProfiles: petService.getProfiles ? petService.getProfiles() : [],
      activePetId: petService.getActiveProfileId ? petService.getActiveProfileId() : ""
    })
  },

  setPrimaryPet(event) {
    const id = event.currentTarget.dataset.id
    try {
      petService.setActiveProfile(id)
      this.setData({ panel: "" })
      this.loadRoomData()
      wx.showToast({ title: "已设为主监工", icon: "success" })
    } catch (error) {
      wx.showToast({ title: error.message || "切换失败", icon: "none" })
    }
  },

  editPetById(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/pet/pet?petId=${id}` })
  },

  addPet() {
    if (this.data.petProfiles.length >= this.data.maxPetProfiles) {
      wx.showToast({ title: `最多 ${this.data.maxPetProfiles} 个监工`, icon: "none" })
      return
    }
    wx.navigateTo({ url: "/pages/pet/pet?mode=add" })
  },

  goEditPet() {
    const id = this.data.activePetId
    wx.navigateTo({ url: id ? `/pages/pet/pet?petId=${id}` : "/pages/pet/pet" })
  },

  goCreatePet() {
    wx.navigateTo({ url: "/pages/pet/pet" })
  },

  onPetBodyError() {
    this.showPetBubble("身体素材加载慢了一下，稍等已补位。", 1000)
  },

  onPetHeadError() {
    this.showPetBubble("脑袋加载失败，回首页编辑一下。", 0)
  }
})
