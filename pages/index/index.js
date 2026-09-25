const recordService =
  require("../../services/records")

const reportService =
  require("../../services/reports")

const fortuneService =
  require("../../services/fortune")

const petService =
  require("../../services/pet")

const {
  buildStandingLayers,
  buildSleepLayers
} = require("../../config/pet-poses")

const {
  getPersonality
} =
  require("../../config/personalities")

const {
  CARD_BACK_IMAGE,
  getFortuneDisplay
} =
  require("../../config/fortunes")



const PET_SLEEP_AFTER_MS = 20000
const PET_SLEEP_DURATION_MS = 8000
const PET_WALK_DELAY_MS = 2800
const PET_WALK_TICK_MS = 90

function wait(milliseconds) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  )
}


function getGeneralShareConfig() {
  return {
    title:
      "BUGTI｜测测你最近是什么 Bug，顺便抽一下今日运势",
    path:
      "/pages/index/index?fromShare=app",
    imageUrl:
      CARD_BACK_IMAGE
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function isSuitProfileCaption(profile) {
  return `${profile.name}看着你，不许偷懒！`
}

function buildSuitLayers(profile, state, walkPhase) {
  const transform = petService.normalizeHeadTransform(profile.headTransform)

  if (state === "SLEEP") {
    const sleepLayers = buildSleepLayers(transform)
    return {
      petBodyPose: "sleep",
      petBodyImage: "/assets/pet/body/pet_body_default.png",
      petSleepPoseStyle: sleepLayers.sleepPoseStyle,
      petHeadStyle: sleepLayers.headStyle,
      petSleepMaskStyle: sleepLayers.sleepMaskStyle,
      petLeftBent: false,
      petRightBent: false,
      petShowDefaultBody: false,
      petShowReactBody: false,
      petShowIdleBody: false,
      petShowSleepPose: true,
      petShowLeftStraight: false,
      petShowLeftBent: false,
      petShowRightStraight: false,
      petShowRightBent: false
    }
  }

  const poseName = state === "REACT"
    ? "react"
    : state === "IDLE_ALT"
    ? "idleAlt"
    : "default"

  const layers = buildStandingLayers(poseName, transform, {
    walking: state === "WALK",
    walkPhase
  })

  return {
    petBodyPose: poseName,
    petBodyImage: layers.bodyImage,
    petBodyStyle: layers.bodyStyle,
    petSleepPoseStyle: layers.bodyStyle,
    petHeadStyle: layers.headStyle,
    petLeftLegStraightStyle: layers.leftLegStraightStyle,
    petLeftLegBentStyle: layers.leftLegBentStyle,
    petRightLegStraightStyle: layers.rightLegStraightStyle,
    petRightLegBentStyle: layers.rightLegBentStyle,
    petLeftBent: layers.leftBent,
    petRightBent: layers.rightBent,
    petShowDefaultBody: poseName === "default",
    petShowReactBody: poseName === "react",
    petShowIdleBody: poseName === "idleAlt",
    petShowSleepPose: false,
    petShowLeftStraight: !layers.leftBent,
    petShowLeftBent: layers.leftBent,
    petShowRightStraight: !layers.rightBent,
    petShowRightBent: layers.rightBent
  }
}

function buildHomePetView(profile, state, total) {
  const sleeping = state === "SLEEP"
  const count = Math.max(1, Math.min(3, total || 1))
  const baseSize = count === 1 ? 128 : count === 2 ? 108 : 94
  const displayRatio = Math.max(0.86, Math.min(1.0, (profile.displayScale || 1.15) / 1.15))
  const size = Math.round(baseSize * displayRatio)

  if (!petService.isSuitProfile(profile)) {
    return {
      id: profile.id,
      name: profile.name,
      state,
      isSuit: false,
      imagePath: profile.imagePath,
      size
    }
  }

  const transform = petService.normalizeHeadTransform(profile.headTransform)
  const standing = buildStandingLayers("default", transform, { walking: false, walkPhase: 0 })
  const sleep = sleeping ? buildSleepLayers(transform) : null
  return {
    id: profile.id,
    name: profile.name,
    state,
    isSuit: true,
    headImage: profile.headImage,
    size,
    bodyStyle: standing.bodyStyle,
    headStyle: sleeping ? sleep.headStyle : standing.headStyle,
    sleepPoseStyle: sleeping ? sleep.sleepPoseStyle : standing.bodyStyle,
    sleepMaskStyle: sleeping ? sleep.sleepMaskStyle : "",
    showSleep: sleeping,
    leftLegStraightStyle: standing.leftLegStraightStyle,
    rightLegStraightStyle: standing.rightLegStraightStyle,
    showLeftStraight: !sleeping,
    showRightStraight: !sleeping
  }
}


Page({
  onShow() {
    if (this.data.today) {
      this.loadHomeData()
      this.loadFortuneData()
    }
  },
  loadHomeData() {
    const records = recordService.listAll()
  
    const todayRecord =
      recordService.getByDate(this.data.today)

    let petProfile = null
    let petProfiles = []
    try {
      petProfile = petService.getProfile()
      petProfiles = petService.getProfiles ? petService.getProfiles() : (petProfile ? [petProfile] : [])
    } catch (error) {
      console.warn("读取监工失败：", error)
    }

    const petCaption =
      petProfile
        ? isSuitProfileCaption(petProfile)
        : ""

    const savedPetDisplayScale =
      petProfile &&
      typeof petProfile.displayScale === "number"
        ? petProfile.displayScale
        : 1.15
    // 首页右上角活动区空间固定，首页显示尺寸单独限制，避免压字或跑出画面。
    const petDisplayScale = Math.max(0.82, Math.min(1.02, savedPetDisplayScale))

    // 使用实际布局尺寸承载缩放，品牌、文案和 TODAY 自然排布。
    const isSuitPet = petService.isSuitProfile(petProfile)
    const petStageHeight = isSuitPet
      ? Math.round(148 * petDisplayScale)
      : petProfile
      ? Math.round(154 * petDisplayScale)
      : 156
    // 舞台宽度固定，角色大小随允许范围轻微变化；这样移动边界稳定。
    const petStageWidth = 176
  
    const recordedDays = records.length
  
    let recentRecord = null

    let recentResult = null
  
    if (records.length > 0) {
      const record = records[0]
  
      const moodEmojis = [
        "",
        "😫",
        "🙁",
        "😐",
        "🙂",
        "😆"
      ]
  
      const energyEmojis = [
        "",
        "🪫",
        "🔋",
        "⚡"
      ]
  
      recentRecord = {
        date: record.date,
  
        summary:
          `${moodEmojis[record.mood] || ""} ` +
          `${energyEmojis[record.energy] || ""} · ` +
          record.tags.join(" · ")
      }
    }

    const latestReport =
      reportService.getLatest()

    if (latestReport) {
      const personality =
        getPersonality(
          latestReport.code
        )

      if (personality) {
        recentResult = {
          id: latestReport.id,
          code: personality.code,
          name: personality.name,
          tagline: personality.tagline,
          startDate:
            latestReport.startDate,
          endDate:
            latestReport.endDate,
          validDays:
            latestReport.validDays,
          coverageRate:
            typeof latestReport
              .coverageRate ===
              "number"
              ? latestReport
                .coverageRate
              : null
        }
      }
    }
  
    this.setData({
      hasTodayRecord: Boolean(todayRecord),
      recordedDays,
      recentRecord,
      recentResult,
      petProfile,
      homePets: [],
      petCaption,
      petDisplayScale,
      petStageHeight,
      petStageWidth,
      petBubble: "",
      showPetEdit: false,
      isSuitPet,
      petState: "IDLE",
      petCharacterWidth: Math.round(132 * petDisplayScale),
      petCharacterHeight: Math.round(132 * petDisplayScale),
      petCharacterMotionStyle: "left:0px;transform:scaleX(1);",
      petBodyPose: "default",
      petBodyImage: "/assets/pet/body/pet_body_default.png"
    }, () => {
      this.stopPetLifecycle()
      this.setupHomePets(petProfiles)
    })
  },

  loadFortuneData() {
    const state =
      fortuneService
        .getTodayState()

    const fortune =
      state.latestFortuneId
        ? getFortuneDisplay(
          state.latestFortuneId,
          state.latestVariantIndex
        )
        : null

    this.setData({
      fortune,
      fortuneImage:
        fortune
          ? fortune.image
          : CARD_BACK_IMAGE,
      fortuneDrawCount:
        state.drawCount
    })
  },

  loadSharedFortune(options) {
    if (
      !options ||
      options.fromShare !==
        "fortune"
    ) {
      this.setData({
        sharedFortunePreview:
          null
      })

      return
    }

    const variant =
      Number(options.variant)

    const sharedFortunePreview =
      options.variant !== undefined &&
      options.variant !== null &&
      options.variant !== "" &&
      Number.isInteger(variant)
        ? getFortuneDisplay(
          options.fortuneId,
          variant
        )
        : null

    this.setData({
      sharedFortunePreview
    })
  },

  async drawFortune() {
    if (this._fortuneDrawing) {
      return
    }

    this._fortuneDrawing = true

    this.setData({
      fortuneAnimating: true
    })

    try {
      await wait(200)

      const result =
        fortuneService
          .drawFortune()

      this.setData({
        fortune:
          result.fortune,
        fortuneImage:
          result.fortune.image,
        fortuneDrawCount:
          result.state.drawCount,
        sharedFortunePreview:
          null
      })

      await wait(300)
    } catch (error) {
      console.error(
        "抽取今日运势失败：",
        error
      )

      wx.showToast({
        title:
          "系统今天有点迷信失败",
        icon:
          "none"
      })
    } finally {
      this._fortuneDrawing = false

      this.setData({
        fortuneAnimating: false
      })
    }
  },

  onShareAppMessage(event) {
    const generalShare =
      getGeneralShareConfig()

    try {
      if (
        !event ||
        event.from === "menu"
      ) {
        return generalShare
      }

      let shareKind = null

      if (
        event.from === "button" &&
        event.target &&
        event.target.dataset
      ) {
        shareKind =
          event.target.dataset
            .shareKind
      }

      if (
        shareKind !== "fortune" ||
        !this.data.fortune
      ) {
        return generalShare
      }

      const fortune =
        getFortuneDisplay(
          this.data.fortune.id,
          this.data.fortune
            .variantIndex
        )

      if (!fortune) {
        return generalShare
      }

      return {
        title:
          fortune.id ===
            "draw_again"
            ? "我把 BUGTI 今日一抽抽成了穷举"
            : `我今天抽到「${fortune.title}」｜BUGTI 今日一抽`,
        path:
          "/pages/index/index" +
          `?fromShare=fortune&fortuneId=${fortune.id}` +
          `&variant=${fortune.variantIndex}`,
        imageUrl:
          fortune.image
      }
    } catch (error) {
      return generalShare
    }
  },

  data: {
    today: "",

    // 下一阶段会从本地数据层读取
    hasTodayRecord: false,
    recordedDays: 0,
    unlockDays: 3,

    recentRecord: null,
    recentResult: null,

    fortune: null,
    fortuneImage:
      CARD_BACK_IMAGE,
    fortuneDrawCount: 0,
    fortuneAnimating: false,
    sharedFortunePreview: null,

    petProfile: null,
    homePets: [],
    petCaption: "",
    petBubble: "",
    showPetEdit: false,
    isSuitPet: false,
    petState: "IDLE",
    petBodyPose: "default",
    petBodyImage: "/assets/pet/body/pet_body_default.png",
    petCharacterWidth: 172,
    petCharacterHeight: 172,
    petCharacterMotionStyle: "left:0px;transform:scaleX(1);",
    petBodyStyle: "",
    petSleepPoseStyle: "",
    petSleepMaskStyle: "",
    petHeadStyle: "",
    petLeftLegStraightStyle: "",
    petLeftLegBentStyle: "",
    petRightLegStraightStyle: "",
    petRightLegBentStyle: "",
    petLeftBent: false,
    petRightBent: false,
    petShowDefaultBody: true,
    petShowReactBody: false,
    petShowIdleBody: false,
    petShowSleepPose: false,
    petShowLeftStraight: true,
    petShowLeftBent: false,
    petShowRightStraight: true,
    petShowRightBent: false
  },

  onLoad(options) {
    const today = formatDate(new Date())
  
    this.setData({
      today
    })

    wx.showShareMenu({
      menus: [
        "shareAppMessage"
      ]
    })

    this.loadSharedFortune(
      options
    )
  
    this.loadHomeData()
    this.loadFortuneData()
  },


  setupHomePets(profiles) {
    this.stopHomePetLifecycle()
    const activeId = petService.getActiveProfileId ? petService.getActiveProfileId() : ""
    const list = (profiles || [])
      .slice(0, 3)
      .sort((a, b) => {
        if (a.id === activeId && b.id !== activeId) return 1
        if (b.id === activeId && a.id !== activeId) return -1
        return 0
      })
    const now = Date.now()
    this._homeProfiles = list
    this._homePetStates = this._homePetStates || {}
    const nextStates = {}
    list.forEach((profile, index) => {
      const previous = this._homePetStates[profile.id]
      nextStates[profile.id] = previous && previous.state === "SLEEP"
        ? previous
        : {
            state: "IDLE",
            sleepAt: now + PET_SLEEP_AFTER_MS + index * 2200
          }
    })
    this._homePetStates = nextStates
    this.refreshHomePets()
    if (!list.length) return
    this._homePetTimer = setInterval(() => {
      const tickNow = Date.now()
      let changed = false
      for (const profile of this._homeProfiles || []) {
        const item = this._homePetStates[profile.id]
        if (!item || item.state === "SLEEP") continue
        if (tickNow >= item.sleepAt) {
          item.state = "SLEEP"
          changed = true
        }
      }
      if (changed) this.refreshHomePets()
    }, 500)
  },

  stopHomePetLifecycle() {
    clearInterval(this._homePetTimer)
    this._homePetTimer = null
  },

  refreshHomePets() {
    const profiles = this._homeProfiles || []
    const total = profiles.length
    const homePets = profiles.map(profile => {
      const state = this._homePetStates && this._homePetStates[profile.id]
      return buildHomePetView(profile, state && state.state || "IDLE", total)
    })
    this.setData({ homePets })
  },

  onHomePetTap(event) {
    const id = event.currentTarget.dataset.id
    const item = this._homePetStates && this._homePetStates[id]
    if (!item) return
    item.state = "IDLE"
    item.sleepAt = Date.now() + PET_SLEEP_AFTER_MS
    this.refreshHomePets()
  },

  onHomePetLongPress(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/pet/pet?profileId=${id}` })
  },

  // 我的监工
  applySuitPose(state, walkPhase) {
    if (!this.data.isSuitPet || !this.data.petProfile) return
    this.setData({
      petState: state,
      ...buildSuitLayers(this.data.petProfile, state, walkPhase)
    })
  },

  clearPetTimers() {
    clearTimeout(this._petIdleTimer)
    clearTimeout(this._petReactTimer)
    clearTimeout(this._petSleepTimer)
    clearTimeout(this._petWakeTimer)
    clearInterval(this._petWalkTimer)
    this._petIdleTimer = null
    this._petReactTimer = null
    this._petSleepTimer = null
    this._petWakeTimer = null
    this._petWalkTimer = null
    this._petSleepPending = false
    this._petWalkTarget = null
  },

  stopPetLifecycle() {
    this._petLifecycleToken = (this._petLifecycleToken || 0) + 1
    this.clearPetTimers()
  },

  startPetLifecycle() {
    this.stopPetLifecycle()
    if (!this.data.isSuitPet) return
    const token = this._petLifecycleToken

    this.createSelectorQuery()
      .select("#petSuitStage").boundingClientRect()
      .select("#petSuitCharacter").boundingClientRect()
      .exec(result => {
        if (token !== this._petLifecycleToken || !this.data.isSuitPet) return
        const stage = result && result[0]
        const character = result && result[1]
        if (!stage || !character || !(stage.width > 0 && character.width > 0)) return

        // 首页监工只在右上固定矩形内巡逻，并保留左右安全边距。
        const safeMargin = Math.min(14, stage.width * 0.06)
        this._petMinX = safeMargin
        this._petMaxX = Math.max(safeMargin, stage.width - character.width - safeMargin)
        this._petTravel = Math.max(0, this._petMaxX - this._petMinX)
        if (!Number.isFinite(this._petPosition)) {
          // 初始从舞台中间偏左开始。
          this._petPosition = this._petMinX + this._petTravel * 0.35
          this._petDirection = 1
        } else {
          this._petPosition = Math.max(this._petMinX || 0, Math.min(this._petPosition, this._petMaxX || this._petPosition))
          this._petDirection = this._petDirection || -1
        }

        this.setData({
          petCharacterMotionStyle: `left:${this._petPosition}px;transform:scaleX(${this._petDirection});`
        })

        this.applySuitPose("IDLE", 0)
        this.schedulePetWalk()
        this.schedulePetSleep()
      })
  },

  schedulePetWalk() {
    clearTimeout(this._petIdleTimer)
    if (!this.data.isSuitPet || this.data.petState === "SLEEP") return
    const token = this._petLifecycleToken
    this._petIdleTimer = setTimeout(() => {
      if (token !== this._petLifecycleToken || this.data.petState === "SLEEP") return
      this.startPetWalk()
    }, PET_WALK_DELAY_MS)
  },

  schedulePetSleep() {
    clearTimeout(this._petSleepTimer)
    this._petSleepPending = false
    if (!this.data.isSuitPet || this.data.petState === "SLEEP") return

    const token = this._petLifecycleToken
    this._petSleepTimer = setTimeout(() => {
      if (token !== this._petLifecycleToken || !this.data.isSuitPet) return

      // 20 秒没人点它以后才准备睡。正在走路/点击反馈时不突然切姿势，
      // 等当前动作结束再进入 SLEEP，避免出现半路“塌下去”的跳帧。
      if (this.data.petState === "WALK" || this.data.petState === "REACT") {
        this._petSleepPending = true
        return
      }

      this.enterPetSleep()
    }, PET_SLEEP_AFTER_MS)
  },

  startPetWalk() {
    if (
      !this.data.isSuitPet ||
      this._petWalkTimer ||
      this.data.petState === "SLEEP" ||
      this._petSleepPending
    ) {
      if (this._petSleepPending && this.data.petState !== "SLEEP") {
        this.enterPetSleep()
      }
      return
    }

    const token = this._petLifecycleToken
    const travel = Math.max(0, this._petTravel || 0)
    const minX = this._petMinX || 0
    const maxX = this._petMaxX || minX
    if (travel <= 1) return

    const current = Math.max(minX, Math.min(this._petPosition || minX, maxX))

    // 只在安全区内左右来回，绝不触碰文字区域或右侧边缘。
    const mid = (minX + maxX) / 2
    const nearLeft = current <= mid
    const edgeBand = Math.max(8, travel * 0.18)
    const target = nearLeft
      ? Math.max(mid + travel * 0.10, maxX - Math.random() * edgeBand)
      : Math.min(mid - travel * 0.10, minX + Math.random() * edgeBand)

    this._petWalkTarget = target
    this._petDirection = target >= current ? 1 : -1
    let ticks = 0

    this._petWalkTimer = setInterval(() => {
      if (
        token !== this._petLifecycleToken ||
        !this.data.isSuitPet ||
        this.data.petState === "SLEEP"
      ) {
        clearInterval(this._petWalkTimer)
        this._petWalkTimer = null
        return
      }

      ticks += 1
      const remaining = Math.abs(target - (this._petPosition || 0))
      const step = Math.max(3.8, Math.min(5.4, travel / 36 || 4.5))
      const arrived = remaining <= step
      const position = arrived
        ? target
        : (this._petPosition || 0) + this._petDirection * step

      this._petPosition = Math.max(minX, Math.min(maxX, position))
      this.applySuitPose("WALK", ticks % 2)
      this.setData({
        petCharacterMotionStyle: `left:${this._petPosition}px;transform:scaleX(${this._petDirection});`
      })

      if (arrived) {
        clearInterval(this._petWalkTimer)
        this._petWalkTimer = null
        this._petWalkTarget = null

        if (this._petSleepPending) {
          this.enterPetSleep()
          return
        }

        this.applySuitPose(Math.random() < 0.28 ? "IDLE_ALT" : "IDLE", 0)
        this.schedulePetWalk()
      }
    }, PET_WALK_TICK_MS)
  },

  enterPetSleep() {
    if (!this.data.isSuitPet || this.data.petState === "SLEEP") return

    this._petSleepPending = false
    clearTimeout(this._petSleepTimer)
    this._petSleepTimer = null
    clearTimeout(this._petIdleTimer)
    clearTimeout(this._petReactTimer)
    clearInterval(this._petWalkTimer)
    this._petIdleTimer = null
    this._petReactTimer = null
    this._petWalkTimer = null

    this.applySuitPose("SLEEP", 0)
    this.setData({
      petBubble: "Zzz… 点一下叫醒它"
    })

    clearTimeout(this._petWakeTimer)
    this._petWakeTimer = setTimeout(() => {
      this.wakePet(false)
    }, PET_SLEEP_DURATION_MS)
  },

  wakePet(byTap) {
    if (!this.data.isSuitPet) return
    clearTimeout(this._petWakeTimer)
    this._petWakeTimer = null
    this._petSleepPending = false
    this.applySuitPose("IDLE", 0)
    this.setData({
      petBubble: byTap ? `${this.data.petProfile.name}被你叫醒了。` : ""
    })
    this.schedulePetWalk()
    this.schedulePetSleep()

    if (byTap) {
      clearTimeout(this._petBubbleTimer)
      this._petBubbleTimer = setTimeout(() => {
        this.setData({ petBubble: "" })
      }, 1600)
    }
  },

  onPetBodyAssetError(error) {
    console.warn("监工身体素材加载失败：", error)

    // 站立姿势只渲染一个身体图层。若 react / idleAlt 素材偶发加载失败，
    // 直接退回默认身体，避免旧方案“默认层 + 覆盖层”同时显示造成重影。
    if (this.data.petState !== "SLEEP") {
      this.setData({
        petBodyImage: "/assets/pet/body/pet_body_default.png"
      })
    }
  },

  onPetHeadLoadError(error) {
    console.warn("监工头部图片加载失败：", error)
    this.setData({
      petBubble: "脑袋加载失败，点编辑重新保存一下。",
      showPetEdit: true
    })
  },

  goToPet() {
    wx.navigateTo({
      url: "/pages/pet/pet"
    })
  },

  goToPetHome() {
    wx.navigateTo({
      url: "/pages/pet-home/pet-home"
    })
  },

  onPetTap() {
    if (!this.data.petProfile) {
      this.goToPet()
      return
    }

    if (!this.data.showPetEdit) {
      this.setData({ showPetEdit: true })
    }

    // 睡觉时点击优先叫醒，不再切换 react 身体。
    if (this.data.isSuitPet && this.data.petState === "SLEEP") {
      this.wakePet(true)
      return
    }

    if (this.data.isSuitPet) {
      // 点击属于用户互动，重新计算睡眠倒计时。
      this._petSleepPending = false
      clearTimeout(this._petSleepTimer)
      clearTimeout(this._petIdleTimer)
      clearInterval(this._petWalkTimer)
      clearTimeout(this._petReactTimer)
      this._petIdleTimer = null
      this._petWalkTimer = null
      this._petReactTimer = null

      this.applySuitPose("REACT", 0)
      this._petReactTimer = setTimeout(() => {
        if (!this.data.isSuitPet) return
        if (this._petSleepPending) {
          this.enterPetSleep()
          return
        }
        this.applySuitPose("IDLE", 0)
        this.schedulePetWalk()
      }, 900)
      this.schedulePetSleep()
    }

    this._petTapCount = (this._petTapCount || 0) + 1

    const name = this.data.petProfile.name
    let message = `${name}看了你一眼。`

    if (this._petTapCount >= 10) {
      message = "TOUCH LIMIT EXCEEDED"
      this._petTapCount = 0
    } else if (this._petTapCount >= 5) {
      message = "别点了，去记录。"
    } else if (this._petTapCount >= 3) {
      message = `${name}开始觉得你有点闲。`
    } else if (this._petTapCount === 2) {
      message = `${name}又看了你一眼。`
    }

    clearTimeout(this._petBubbleTimer)
    this.setData({ petBubble: message })
    this._petBubbleTimer = setTimeout(() => {
      this.setData({ petBubble: "" })
    }, 1800)
  },

  // 记录今天 / 编辑今天
  goToTodayRecord() {
    wx.navigateTo({
      url: `/pages/record/record?date=${this.data.today}`
    })
  },

  // 补过去的记录
  onBackfillDateChange(event) {
    const date = event.detail.value

    wx.navigateTo({
      url: `/pages/record/record?date=${date}`
    })
  },

  // 查看历史
  goToHistory() {
    wx.navigateTo({
      url: "/pages/history/history"
    })
  },

  // 去检测
  goToAnalyze() {
    wx.navigateTo({
      url: "/pages/analyze/analyze"
    })
  },

  // 查看最近结果
  goToRecentResult() {
    if (!this.data.recentResult) {
      return
    }

    wx.navigateTo({
      url:
        `/pages/result/result?reportId=${this.data.recentResult.id}`
    })
  },

  onResize() {
    this.refreshHomePets()
  },

  onUnload() {
    this.stopHomePetLifecycle()
    this.stopPetLifecycle()
    clearTimeout(
      this._petBubbleTimer
    )
  },

  onHide() {
    this.stopHomePetLifecycle()
    this.stopPetLifecycle()
    clearTimeout(this._petBubbleTimer)
    this._petBubbleTimer = null
  }
})
