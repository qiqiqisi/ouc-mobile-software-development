const { LEVELS } = require('../../data/levels')
const {
  keyOf,
  parseMap,
  snapshot,
  restore,
  tryMove,
  isSolved
} = require('../../utils/sokoban')
const {
  getProgress,
  saveLevelResult
} = require('../../utils/storage')

const IMAGE_PATHS = {
  player: '../../assets/hajimi/player.png',
  push: '../../assets/hajimi/player-push.png',
  can: '../../assets/game/can.png',
  bowl: '../../assets/game/bowl.png',
  wall: '../../assets/game/wall.png'
}

Page({
  data: {
    levelId: 1,
    level: LEVELS[0],
    levelIndexText: '01 / 04',
    steps: 0,
    pushes: 0,
    bestStepsText: '--',
    canvasMounted: false,
    canvasReady: false,
    canvasVisible: false,
    suspendingForComplete: false,
    showComplete: false,
    completeComment: '',
    isNewRecord: false,
    toastText: '',
    nextButtonText: '下一摊'
  },

  onLoad(options) {
    this.pageActive = false
    this.pageReady = false
    this.navigationLocked = false
    this.canvasGeneration = 0
    this.levelFinished = false

    const rawLevel = Number(options.level || 1)
    const levelId = Math.min(4, Math.max(1, rawLevel))
    this.loadLevel(levelId)
  },

  onShow() {
    this.pageActive = true

    // 从“标准作案路线”等页面返回时，当前页面已经 ready。
    // 此时重新创建 Canvas，但仍留一点时间给页面切换动画收尾。
    if (
      this.pageReady &&
      !this.data.showComplete &&
      !this.data.suspendingForComplete &&
      !this.data.canvasMounted
    ) {
      this.scheduleCanvasMount(260)
    }
  },

  onReady() {
    this.pageReady = true

    // 关键：不要在 navigateTo 转场过程中创建原生 Canvas。
    // 开发者工具的 Canvas 在转场阶段会短暂压到上一页上方。
    this.scheduleCanvasMount(520)
  },

  onHide() {
    this.pageActive = false
    this.teardownCanvas()
  },

  onUnload() {
    this.pageActive = false
    this.clearTimers()
    this.canvasGeneration += 1
    this.canvas = null
    this.ctx = null
    this.images = null
  },

  clearTimers() {
    if (this.canvasMountTimer) clearTimeout(this.canvasMountTimer)
    if (this.pushTimer) clearTimeout(this.pushTimer)
    if (this.toastTimer) clearTimeout(this.toastTimer)
    if (this.finishTimer) clearTimeout(this.finishTimer)
    if (this.completeTimer) clearTimeout(this.completeTimer)
    if (this.canvasRevealTimer) clearTimeout(this.canvasRevealTimer)
    if (this.canvasRelayoutTimer) clearTimeout(this.canvasRelayoutTimer)

    this.canvasMountTimer = null
    this.pushTimer = null
    this.toastTimer = null
    this.finishTimer = null
    this.completeTimer = null
    this.canvasRevealTimer = null
    this.canvasRelayoutTimer = null
  },

  loadLevel(levelId) {
    const level = LEVELS[levelId - 1]
    const progress = getProgress()
    const saved = progress.levels[levelId] || {}

    this.levelRuntime = parseMap(level.map)
    this.history = []
    this.levelFinished = false

    this.setData({
      levelId,
      level,
      levelIndexText: '0' + levelId + ' / 04',
      steps: 0,
      pushes: 0,
      bestStepsText: Number.isFinite(saved.bestSteps) ? String(saved.bestSteps) : '--',
      suspendingForComplete: false,
      showComplete: false,
      completeComment: '',
      isNewRecord: false,
      nextButtonText: levelId < 4 ? '下一摊' : '返回现场'
    })

    if (this.data.canvasReady) {
      this.drawBoard(false)
    }
  },

  scheduleCanvasMount(delay) {
    if (this.canvasMountTimer) {
      clearTimeout(this.canvasMountTimer)
    }

    this.canvasMountTimer = setTimeout(() => {
      this.canvasMountTimer = null

      if (
        !this.pageActive ||
        this.data.showComplete ||
        this.data.suspendingForComplete ||
        this.data.canvasMounted
      ) {
        return
      }

      const generation = ++this.canvasGeneration

      this.setData({
        canvasMounted: true,
        canvasReady: false,
        canvasVisible: false
      }, () => {
        wx.nextTick(() => {
          if (
            generation !== this.canvasGeneration ||
            !this.pageActive ||
            !this.data.canvasMounted
          ) {
            return
          }
          this.setupCanvas(generation)
        })
      })
    }, delay)
  },

  teardownCanvas(callback) {
    if (this.canvasMountTimer) {
      clearTimeout(this.canvasMountTimer)
      this.canvasMountTimer = null
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }

    // 让尚未完成的图片异步加载结果全部失效。
    this.canvasGeneration += 1
    this.canvas = null
    this.ctx = null
    this.images = null
    this.canvasSize = 0
    this.cellSize = 0

    if (!this.data.canvasMounted && !this.data.canvasReady) {
      if (callback) callback()
      return
    }

    // wx:if=false 会真正销毁 Canvas 节点。必须等节点销毁后再弹层/跳页，
    // 不能只依靠 z-index，否则开发者工具中 Canvas 仍会压在普通 view 上。
    this.setData({
      canvasMounted: false,
      canvasReady: false,
      canvasVisible: false
    }, () => {
      wx.nextTick(() => {
        setTimeout(() => {
          if (callback) callback()
        }, 90)
      })
    })
  },

  setupCanvas(generation) {
    const query = wx.createSelectorQuery().in(this)

    query
      .select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((result) => {
        if (
          generation !== this.canvasGeneration ||
          !this.pageActive ||
          !this.data.canvasMounted
        ) {
          return
        }

        const info = result && result[0]

        if (!info || !info.node) {
          this.setData({ canvasMounted: false, canvasReady: false })
          this.showToast('画布没起床，重新进一下。')
          return
        }

        const canvas = info.node
        const ctx = canvas.getContext('2d')
        const dpr = this.getPixelRatio()

        canvas.width = Math.round(info.width * dpr)
        canvas.height = Math.round(info.height * dpr)
        ctx.scale(dpr, dpr)

        this.canvas = canvas
        this.ctx = ctx
        this.canvasSize = info.width
        this.cellSize = info.width / 8

        this.loadCanvasImages(canvas)
          .then(() => {
            if (
              generation !== this.canvasGeneration ||
              !this.pageActive ||
              !this.data.canvasMounted ||
              this.data.showComplete ||
              this.data.suspendingForComplete
            ) {
              return
            }

            // 先在不可见状态完成首帧绘制。开发者工具中 2D Canvas
            // 动态挂载后偶尔会缓存错误的原生层屏幕坐标；手动滚动一下
            // 页面就会恢复，说明绘图没错，错的是原生层定位。
            // 因此首帧不直接展示，而是绘制后主动触发一次 1px 的
            // page scroll relayout，再恢复原滚动位置，最后才显示 Canvas。
            this.drawBoard(false)
            this.stabilizeCanvasPosition(generation)
          })
          .catch((error) => {
            console.warn('素材加载失败，使用图形兜底：', error)

            if (
              generation !== this.canvasGeneration ||
              !this.pageActive ||
              !this.data.canvasMounted
            ) {
              return
            }

            this.images = {}
            // 先在不可见状态完成首帧绘制。开发者工具中 2D Canvas
            // 动态挂载后偶尔会缓存错误的原生层屏幕坐标；手动滚动一下
            // 页面就会恢复，说明绘图没错，错的是原生层定位。
            // 因此首帧不直接展示，而是绘制后主动触发一次 1px 的
            // page scroll relayout，再恢复原滚动位置，最后才显示 Canvas。
            this.drawBoard(false)
            this.stabilizeCanvasPosition(generation)
          })
      })
  },

  stabilizeCanvasPosition(generation) {
    if (this.canvasRevealTimer) {
      clearTimeout(this.canvasRevealTimer)
      this.canvasRevealTimer = null
    }
    if (this.canvasRelayoutTimer) {
      clearTimeout(this.canvasRelayoutTimer)
      this.canvasRelayoutTimer = null
    }

    const reveal = () => {
      if (
        generation !== this.canvasGeneration ||
        !this.pageActive ||
        !this.data.canvasMounted ||
        this.data.showComplete ||
        this.data.suspendingForComplete
      ) {
        return
      }

      this.setData({
        canvasReady: true,
        canvasVisible: true
      })
    }

    // 获取当前滚动位置，避免从答案页返回或未来页面布局变化时
    // 强行把用户拉回顶部。
    const query = wx.createSelectorQuery().in(this)
    query.selectViewport().scrollOffset().exec((result) => {
      if (
        generation !== this.canvasGeneration ||
        !this.pageActive ||
        !this.data.canvasMounted
      ) {
        return
      }

      const viewport = result && result[0]
      const originalTop = viewport && Number.isFinite(viewport.scrollTop)
        ? viewport.scrollTop
        : 0

      // 初始通常在 0；向下 1px 再回到原位。若当前已经滚动，
      // 则向上 1px。这个动作等价于用户截图里“轻轻滚一下鼠标”，
      // 但发生在 Canvas 仍不可见的阶段，所以不会看到地图跳动。
      const nudgeTop = originalTop <= 0
        ? 1
        : Math.max(0, originalTop - 1)

      wx.pageScrollTo({
        scrollTop: nudgeTop,
        duration: 0,
        complete: () => {
          this.canvasRelayoutTimer = setTimeout(() => {
            this.canvasRelayoutTimer = null

            if (
              generation !== this.canvasGeneration ||
              !this.pageActive ||
              !this.data.canvasMounted
            ) {
              return
            }

            wx.pageScrollTo({
              scrollTop: originalTop,
              duration: 0,
              complete: () => {
                this.canvasRevealTimer = setTimeout(() => {
                  this.canvasRevealTimer = null
                  reveal()
                }, 40)
              }
            })
          }, 35)
        }
      })
    })
  },

  getPixelRatio() {
    try {
      if (wx.getWindowInfo) {
        return wx.getWindowInfo().pixelRatio || 1
      }
      return wx.getSystemInfoSync().pixelRatio || 1
    } catch (error) {
      return 1
    }
  },

  loadCanvasImages(canvas) {
    const entries = Object.keys(IMAGE_PATHS)

    return Promise.all(
      entries.map((name) => this.loadSingleCanvasImage(
        canvas,
        name,
        IMAGE_PATHS[name]
      ).catch((error) => {
        console.warn('Canvas 素材加载失败：', name, IMAGE_PATHS[name], error)
        return [name, null]
      }))
    ).then((items) => {
      this.images = {}
      items.forEach(([name, image]) => {
        if (image) this.images[name] = image
      })
    })
  },

  loadSingleCanvasImage(canvas, name, src) {
    return new Promise((resolve, reject) => {
      const image = canvas.createImage()
      let settled = false

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('image load timeout: ' + src))
      }, 3000)

      image.onload = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve([name, image])
      }

      image.onerror = (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error || new Error('image load failed: ' + src))
      }

      image.src = src
    })
  },

  drawBoard(usePushImage) {
    if (!this.ctx || !this.levelRuntime || !this.data.canvasMounted) return

    const ctx = this.ctx
    const size = this.canvasSize
    const cell = this.cellSize
    const state = this.levelRuntime

    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#DED8CC'
    ctx.fillRect(0, 0, size, size)

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const x = col * cell
        const y = row * cell
        const key = keyOf(row, col)
        const isFloor = state.floors.has(key)
        const isWall = state.walls.has(key)

        // 墙所在的格子和普通可走格使用同一套棋盘底色。
        // 纸箱只是叠在格子上方，不再给墙格额外铺一整块牛皮纸色背景。
        if (isFloor || isWall) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#F5F1E8' : '#ECE6DB'
          ctx.fillRect(x, y, cell + 0.5, cell + 0.5)

          ctx.strokeStyle = 'rgba(126, 116, 99, 0.10)'
          ctx.lineWidth = 1
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1)
        }

        if (isWall) {
          if (this.images && this.images.wall) {
            const margin = cell * 0.075
            ctx.drawImage(
              this.images.wall,
              x + margin,
              y + margin,
              cell - margin * 2,
              cell - margin * 2
            )
          } else {
            ctx.strokeStyle = '#746B60'
            ctx.lineWidth = Math.max(1, cell * 0.045)
            ctx.strokeRect(
              x + cell * 0.10,
              y + cell * 0.10,
              cell * 0.80,
              cell * 0.80
            )
          }
        }
      }
    }

    state.goals.forEach((key) => {
      const [row, col] = key.split(',').map(Number)
      const x = col * cell
      const y = row * cell

      if (this.images && this.images.bowl) {
        const w = cell * 0.72
        const h = cell * 0.50
        ctx.drawImage(
          this.images.bowl,
          x + (cell - w) / 2,
          y + (cell - h) / 2 + cell * 0.08,
          w,
          h
        )
      } else {
        ctx.beginPath()
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.23, 0, Math.PI * 2)
        ctx.strokeStyle = '#AFC83F'
        ctx.lineWidth = Math.max(2, cell * 0.07)
        ctx.stroke()
      }
    })

    state.boxes.forEach((key) => {
      const [row, col] = key.split(',').map(Number)
      const x = col * cell
      const y = row * cell

      if (this.images && this.images.can) {
        const w = cell * 0.70
        const h = cell * 0.58
        ctx.drawImage(
          this.images.can,
          x + (cell - w) / 2,
          y + (cell - h) / 2,
          w,
          h
        )
      } else {
        ctx.fillStyle = '#F1C84B'
        ctx.beginPath()
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.22, 0, Math.PI * 2)
        ctx.fill()
      }

      if (state.goals.has(key)) {
        const badgeX = x + cell * 0.75
        const badgeY = y + cell * 0.25
        ctx.fillStyle = '#D5ED55'
        ctx.beginPath()
        ctx.arc(badgeX, badgeY, cell * 0.12, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#22261A'
        ctx.font = 'bold ' + Math.max(8, cell * 0.18) + 'px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('✓', badgeX, badgeY + 0.5)
      }
    })

    const player = state.player
    const playerX = player.col * cell
    const playerY = player.row * cell
    const playerImage = usePushImage && this.images && this.images.push
      ? this.images.push
      : this.images && this.images.player

    if (playerImage) {
      const w = cell * 0.90
      const h = cell * 0.84
      ctx.drawImage(
        playerImage,
        playerX + (cell - w) / 2,
        playerY + (cell - h) / 2,
        w,
        h
      )
    } else {
      ctx.fillStyle = '#171A20'
      ctx.beginPath()
      ctx.arc(playerX + cell / 2, playerY + cell / 2, cell * 0.33, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#D5ED55'
      ctx.beginPath()
      ctx.arc(playerX + cell * 0.61, playerY + cell * 0.45, cell * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
  },

  moveByButton(event) {
    const direction = event.currentTarget.dataset.dir
    this.handleMove(direction)
  },

  handleMove(direction) {
    if (
      !this.data.canvasReady ||
      this.data.showComplete ||
      this.data.suspendingForComplete ||
      this.levelFinished
    ) {
      return
    }

    const before = snapshot(this.levelRuntime)
    const result = tryMove(this.levelRuntime, direction)

    if (!result.moved) return

    this.history.push({
      state: before,
      steps: this.data.steps,
      pushes: this.data.pushes
    })

    const steps = this.data.steps + 1
    const pushes = this.data.pushes + (result.pushed ? 1 : 0)

    this.setData({ steps, pushes })
    this.drawBoard(result.pushed)

    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }

    if (result.pushed) {
      this.pushTimer = setTimeout(() => {
        if (
          this.data.canvasReady &&
          !this.data.showComplete &&
          !this.data.suspendingForComplete
        ) {
          this.drawBoard(false)
        }
      }, 120)
    }

    if (isSolved(this.levelRuntime)) {
      // 先让玩家看到最后一个罐罐归位，再销毁 Canvas 显示结果。
      this.levelFinished = true
      this.finishTimer = setTimeout(() => {
        this.finishTimer = null
        this.finishLevel(steps, pushes)
      }, 220)
    }
  },

  undo() {
    if (
      this.data.showComplete ||
      this.data.suspendingForComplete ||
      this.levelFinished
    ) {
      return
    }

    const last = this.history.pop()

    if (!last) {
      this.showToast('还没走，先别后悔。')
      return
    }

    restore(this.levelRuntime, last.state)

    this.setData({
      steps: last.steps,
      pushes: last.pushes
    }, () => {
      this.drawBoard(false)
    })
  },

  resetRuntime() {
    const level = this.data.level
    this.levelRuntime = parseMap(level.map)
    this.history = []
    this.levelFinished = false

    if (this.finishTimer) {
      clearTimeout(this.finishTimer)
      this.finishTimer = null
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
  },

  resetLevel() {
    if (this.data.showComplete || this.data.suspendingForComplete) return

    this.resetRuntime()

    this.setData({
      steps: 0,
      pushes: 0,
      isNewRecord: false
    }, () => {
      this.drawBoard(false)
      this.showToast('当无事发生。')
    })
  },

  finishLevel(steps, pushes) {
    const result = saveLevelResult(this.data.levelId, steps, pushes)
    const diff = steps - this.data.level.optimalSteps

    let completeComment = '建议不要复盘，活着出来就行。'

    if (diff === 0) {
      completeComment = '你和哈吉米共用一个脑回路。'
    } else if (diff <= 5) {
      completeComment = '差一点成为黑猫指定大脑。'
    } else if (diff <= 15) {
      completeComment = '路线有点自由，但问题解决了。'
    }

    // 先把普通页面切到“准备结算”状态，让 loading 占位也不出现。
    this.setData({
      bestStepsText: String(result.bestSteps),
      isNewRecord: result.isNewRecord,
      completeComment,
      suspendingForComplete: true
    }, () => {
      // 关键修复：结果弹层出现前真正销毁 Canvas。
      // 这样地图不会再压住结果卡和步数统计。
      this.teardownCanvas(() => {
        if (!this.pageActive) return

        this.completeTimer = setTimeout(() => {
          this.completeTimer = null
    this.canvasRevealTimer = null
    this.canvasRelayoutTimer = null
          this.setData({
            showComplete: true,
            suspendingForComplete: false
          })
        }, 80)
      })
    })
  },

  runAfterCanvasRemoved(action) {
    if (this.navigationLocked) return
    this.navigationLocked = true

    this.teardownCanvas(() => {
      setTimeout(() => {
        action(() => {
          this.navigationLocked = false
        })
      }, 70)
    })
  },

  nextLevel() {
    const next = this.data.levelId + 1

    this.runAfterCanvasRemoved((done) => {
      const options = {
        success: done,
        fail: done
      }

      if (next <= 4) {
        wx.redirectTo({
          ...options,
          url: '/pages/game/game?level=' + next
        })
        return
      }

      wx.reLaunch({
        ...options,
        url: '/pages/index/index'
      })
    })
  },

  replay() {
    this.resetRuntime()

    this.setData({
      steps: 0,
      pushes: 0,
      showComplete: false,
      suspendingForComplete: false,
      isNewRecord: false
    }, () => {
      this.scheduleCanvasMount(120)
    })
  },

  viewSolution() {
    this.runAfterCanvasRemoved((done) => {
      wx.navigateTo({
        url: '/pages/solutions/solutions?level=' + this.data.levelId,
        success: done,
        fail: done
      })
    })
  },

  onTouchStart(event) {
    if (!event.touches || !event.touches[0]) return

    this.touchStartPoint = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    }
  },

  onTouchEnd(event) {
    if (!this.touchStartPoint || !event.changedTouches || !event.changedTouches[0]) {
      return
    }

    const touch = event.changedTouches[0]
    const dx = touch.clientX - this.touchStartPoint.x
    const dy = touch.clientY - this.touchStartPoint.y
    const threshold = 28

    this.touchStartPoint = null

    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return

    if (Math.abs(dx) > Math.abs(dy)) {
      this.handleMove(dx > 0 ? 'R' : 'L')
    } else {
      this.handleMove(dy > 0 ? 'D' : 'U')
    }
  },

  showToast(text) {
    this.setData({ toastText: text })

    if (this.toastTimer) clearTimeout(this.toastTimer)

    this.toastTimer = setTimeout(() => {
      this.toastTimer = null
      this.setData({ toastText: '' })
    }, 1300)
  },

  noop() {}
})
