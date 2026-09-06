const petService = require("../../services/pet")

const DEFAULT_BRUSH_SIZE = 46
const MIN_BRUSH_SIZE = 18
const MAX_BRUSH_SIZE = 96
const EXPORT_MAX_SIDE = 640
const WORKING_MAX_SIDE = 1280
const MIN_SELECTED_SIZE = 4
const MASK_PADDING_RATIO = 0.06

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getTouch(event) {
  const touches =
    event.touches && event.touches.length
      ? event.touches
      : event.changedTouches

  if (!touches || touches.length !== 1) {
    return null
  }

  return touches[0]
}

Page({
  data: {
    stage: "intro",
    existingProfile: null,
    petName: "",
    nameCount: 0,
    paintMode: "paint",
    brushSize: DEFAULT_BRUSH_SIZE,
    hasSelection: false,
    previewPath: "",
    displayScalePercent: 115,
    displayScale: 1.15,
    isBusy: false
  },

  onLoad() {
    let existingProfile
    try {
      existingProfile = petService.getProfile()
    } catch (error) {
      wx.showToast({ title: "监工配置暂时无法读取，请重新进入", icon: "none" })
      this.setData({ isBusy: true })
      return
    }

    this.setData({
      stage: existingProfile ? "existing" : "intro",
      existingProfile,
      petName: existingProfile ? existingProfile.name : "",
      nameCount: existingProfile
        ? petService.getNameLength(existingProfile.name)
        : 0,
      displayScalePercent: existingProfile
        ? Math.round(existingProfile.displayScale * 100)
        : Math.round(petService.DEFAULT_DISPLAY_SCALE * 100),
      displayScale: existingProfile
        ? existingProfile.displayScale
        : petService.DEFAULT_DISPLAY_SCALE
    })
  },

  onReady() {
    this.initAuxCanvases()
  },

  onUnload() {
    this._destroyed = true
    this.cancelPaintStroke()
    this._sourceImage = null
    this._sourcePath = ""
  },

  onPageScroll() {
    // 下一笔重新查询视口位置，不沿用滚动前的 boundingClientRect。
    this.cancelPaintStroke()
  },

  onResize() {
    this.cancelPaintStroke()
    if (this.data.stage === "paint" && !this.data.isBusy && this._sourcePath) {
      this.initPaintEditor(this._sourcePath, true)
    }
  },

  initAuxCanvases() {
    return new Promise(resolve => {
      const query = this.createSelectorQuery()

      query.select("#petMaskCanvas").fields({ node: true })
      query.select("#petExportCanvas").fields({ node: true })

      query.exec(result => {
        this._maskCanvas =
          result && result[0] && result[0].node
            ? result[0].node
            : this._maskCanvas

        this._exportCanvas =
          result && result[1] && result[1].node
            ? result[1].node
            : this._exportCanvas

        resolve()
      })
    })
  },

  choosePhoto() {
    if (this.data.isBusy) {
      return
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: async result => {
        const file =
          result && result.tempFiles && result.tempFiles[0]

        if (this._destroyed || !file || !file.tempFilePath) {
          return
        }

        this.setData({ isBusy: true })
        let sourcePath
        try {
          sourcePath = await this.prepareSourcePhoto(file.tempFilePath)
        } catch (error) {
          if (this._destroyed) return
          this.setData({ isBusy: false })
          wx.showToast({ title: error.message || "图片处理失败，请重试", icon: "none" })
          return
        }
        if (this._destroyed) return

        this._sourcePath = sourcePath
        this._sourceImage = null
        this._sourceDisplayRect = null
        this._selectionBounds = null
        this._isPainting = false
        this._lastPaintPoint = null

        this.setData({
          stage: "paint",
          paintMode: "paint",
          brushSize: DEFAULT_BRUSH_SIZE,
          hasSelection: false,
          previewPath: "",
          displayScalePercent: Math.round(
            petService.DEFAULT_DISPLAY_SCALE * 100
          ),
          displayScale: petService.DEFAULT_DISPLAY_SCALE
        }, () => {
          wx.nextTick(() => {
            this.initPaintEditor(this._sourcePath, false)
          })
        })
      },
      fail: error => {
        if (this._destroyed) return
        if (
          error &&
          String(error.errMsg || "").includes("cancel")
        ) {
          return
        }

        console.error("选择监工图片失败：", error)
        wx.showToast({
          title: "图片没选上，再试一次",
          icon: "none"
        })
      }
    })
  },

  async prepareSourcePhoto(path) {
    const getInfo = filePath => new Promise((resolve, reject) => {
      wx.getImageInfo({ src: filePath, success: resolve, fail: reject })
    })
    const info = await getInfo(path)
    if (!(info.width > 0 && info.height > 0)) throw new Error("无法读取图片尺寸")
    if (Math.max(info.width, info.height) <= WORKING_MAX_SIDE) return path

    if (typeof wx.compressImage !== "function") {
      throw new Error("当前微信无法缩小大图，请换一张较小的图片")
    }
    const ratio = WORKING_MAX_SIDE / Math.max(info.width, info.height)
    const result = await new Promise((resolve, reject) => {
      wx.compressImage({
        src: path,
        quality: 90,
        compressedWidth: Math.max(1, Math.floor(info.width * ratio)),
        compressedHeight: Math.max(1, Math.floor(info.height * ratio)),
        success: resolve,
        fail: reject
      })
    })
    const resized = await getInfo(result.tempFilePath)
    if (!(resized.width > 0 && resized.height > 0) ||
        Math.max(resized.width, resized.height) > WORKING_MAX_SIDE) {
      throw new Error("大图未能缩小，请换一张较小的图片")
    }
    // 仅临时工作图；长期保存的仍只有最终透明 PNG。
    return result.tempFilePath
  },

  async initPaintEditor(sourcePath, preserveMask) {
    const version = (this._editorVersion || 0) + 1
    this._editorVersion = version
    this._editorReady = false
    this.cancelPaintStroke()
    this.setData({ isBusy: true })
    await this.initAuxCanvases()
    if (this._destroyed || version !== this._editorVersion) return

    const query = this.createSelectorQuery()
    query.select("#petPaintCanvas").fields({
      node: true,
      size: true
    })
    query.select("#petPaintCanvas").boundingClientRect()

    query.exec(result => {
      if (this._destroyed || version !== this._editorVersion) return
      const info = result && result[0]
      const rect = result && result[1]

      if (!info || !info.node || !(info.width > 0 && info.height > 0)) {
        this.setData({ isBusy: false })
        wx.showToast({
          title: "画布还没准备好",
          icon: "none"
        })
        return
      }

      const canvas = info.node
      const width = info.width
      const height = info.height
      const logicalSizeChanged = this._paintWidth !== width || this._paintHeight !== height
      const windowInfo = wx.getWindowInfo
        ? wx.getWindowInfo()
        : { pixelRatio: 1 }
      const dpr = Math.min(windowInfo.pixelRatio || 1, 3,
        WORKING_MAX_SIDE / Math.max(width, height))

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)

      const context = canvas.getContext("2d")
      // 所有笔刷逻辑使用 CSS 坐标。像素取整后的实际倍率仅在画布边界使用。
      const pixelScaleX = canvas.width / width
      const pixelScaleY = canvas.height / height
      context.scale(pixelScaleX, pixelScaleY)

      this._paintCanvas = canvas
      this._paintContext = context
      this._paintWidth = width
      this._paintHeight = height
      this._pixelScaleX = pixelScaleX
      this._pixelScaleY = pixelScaleY
      this._paintRect = {
        left:
          rect && typeof rect.left === "number"
            ? rect.left
            : 0,
        top:
          rect && typeof rect.top === "number"
            ? rect.top
            : 0,
        width: rect && rect.width || width,
        height: rect && rect.height || height
      }

      if (!this._maskCanvas) {
        this.setData({ isBusy: false })
        wx.showToast({
          title: "蒙版画布还没准备好",
          icon: "none"
        })
        return
      }

      const maskSizeChanged =
        logicalSizeChanged ||
        this._maskCanvas.width !== Math.round(width * dpr) ||
        this._maskCanvas.height !== Math.round(height * dpr)

      if (!preserveMask || maskSizeChanged) {
        this._maskCanvas.width = Math.round(width * dpr)
        this._maskCanvas.height = Math.round(height * dpr)
        this._maskContext = this._maskCanvas.getContext("2d")
        this._maskContext.scale(pixelScaleX, pixelScaleY)
        this.clearMask(false)
        if (preserveMask && maskSizeChanged) {
          wx.showToast({ title: "画布尺寸变化，请重新涂抹", icon: "none" })
        }
      } else if (!this._maskContext) {
        this._maskContext = this._maskCanvas.getContext("2d")
      }

      const image = canvas.createImage()

      image.onload = () => {
        if (
          this._destroyed ||
          sourcePath !== this._sourcePath ||
          version !== this._editorVersion
        ) {
          return
        }

        this._sourceImage = image
        this._sourceWidth = image.width || 1
        this._sourceHeight = image.height || 1
        this._sourceDisplayRect = this.computeSourceDisplayRect()
        this._editorReady = true
        this.setData({ isBusy: false })
        this.redrawPaintEditor()
      }

      image.onerror = error => {
        if (this._destroyed || version !== this._editorVersion) return
        this.setData({ isBusy: false })
        console.error("加载监工图片失败：", error)
        wx.showToast({
          title: "这张图片暂时打不开",
          icon: "none"
        })
      }

      image.src = sourcePath
    })
  },

  computeSourceDisplayRect() {
    const width = this._paintWidth || 1
    const height = this._paintHeight || 1
    const sourceWidth = this._sourceWidth || 1
    const sourceHeight = this._sourceHeight || 1
    const scale = Math.min(
      width / sourceWidth,
      height / sourceHeight
    )
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale

    return {
      x: (width - drawWidth) / 2,
      y: (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    }
  },

  redrawPaintEditor() {
    const context = this._paintContext

    if (
      !context ||
      !this._paintWidth ||
      !this._paintHeight
    ) {
      return
    }

    context.clearRect(
      0,
      0,
      this._paintWidth,
      this._paintHeight
    )

    context.fillStyle = "#f2f6f3"
    context.fillRect(
      0,
      0,
      this._paintWidth,
      this._paintHeight
    )

    if (this._sourceImage && this._sourceDisplayRect) {
      const rect = this._sourceDisplayRect
      context.drawImage(
        this._sourceImage,
        rect.x,
        rect.y,
        rect.width,
        rect.height
      )
    }

    if (this._maskCanvas) {
      context.save()
      context.globalAlpha = 0.38
      context.drawImage(
        this._maskCanvas,
        0,
        0,
        this._maskCanvas.width,
        this._maskCanvas.height,
        0,
        0,
        this._paintWidth,
        this._paintHeight
      )
      context.restore()
    }
  },

  toPaintPoint(event) {
    const touch = getTouch(event)

    if (!touch || !this._paintRect) {
      return null
    }

    const rect = this._paintRect
    let localX
    let localY
    if (Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
      if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null
      localX = touch.clientX - rect.left
      localY = touch.clientY - rect.top
    } else if (Number.isFinite(touch.x) && Number.isFinite(touch.y)) {
      // 部分基础库的 CanvasTouch 只提供画布局部 CSS 坐标，不能再减视口偏移。
      localX = touch.x
      localY = touch.y
    } else {
      return null
    }
    const x = localX * this._paintWidth / rect.width
    const y = localY * this._paintHeight / rect.height

    if (
      x < 0 ||
      y < 0 ||
      x > this._paintWidth ||
      y > this._paintHeight
    ) {
      return null
    }

    const imageRect = this._sourceDisplayRect

    if (!imageRect) {
      return null
    }

    if (
      x < imageRect.x ||
      y < imageRect.y ||
      x > imageRect.x + imageRect.width ||
      y > imageRect.y + imageRect.height
    ) {
      return null
    }

    return { x, y }
  },

  onPaintTouchStart(event) {
    if (this.data.isBusy || !this._editorReady) {
      return
    }

    this.cancelPaintStroke()
    if (!getTouch(event)) return
    const stroke = this._strokeVersion
    this._isPainting = true
    this._rectPending = true
    this._pendingTouches = [event]
    // 每一笔都读取当前视口位置；查询期间缓存起笔与移动事件。
    this.createSelectorQuery().select("#petPaintCanvas").boundingClientRect().exec(result => {
      if (this._destroyed || stroke !== this._strokeVersion) return
      const rect = result && result[0]
      if (!rect || !(rect.width > 0 && rect.height > 0)) {
        this.cancelPaintStroke()
        return
      }
      this._paintRect = rect
      this._rectPending = false
      const pending = this._pendingTouches
      this._pendingTouches = []
      pending.forEach(item => this.paintTouch(item))
      if (this._strokeEnded) this.cancelPaintStroke()
    })
  },

  onPaintTouchMove(event) {
    if (!this._isPainting || this.data.isBusy) {
      return
    }

    if (!getTouch(event)) {
      this.cancelPaintStroke()
      return
    }
    if (this._rectPending) {
      this._pendingTouches.push(event)
      return
    }
    this.paintTouch(event)
  },

  paintTouch(event) {
    const point = this.toPaintPoint(event)

    if (!point) {
      this._lastPaintPoint = null
      return
    }

    const start = this._lastPaintPoint || point
    this.drawMaskSegment(start, point)
    this._lastPaintPoint = point
  },

  onPaintTouchEnd(event) {
    if (!this._isPainting) return
    if (event && event.type !== "touchcancel" && getTouch(event)) {
      if (this._rectPending) this._pendingTouches.push(event)
      else this.paintTouch(event)
    }
    if (this._rectPending && (!event || event.type !== "touchcancel")) {
      this._strokeEnded = true
    } else {
      this.cancelPaintStroke()
    }
  },

  cancelPaintStroke() {
    this._strokeVersion = (this._strokeVersion || 0) + 1
    this._isPainting = false
    this._rectPending = false
    this._strokeEnded = false
    this._pendingTouches = []
    this._lastPaintPoint = null
  },

  drawMaskSegment(start, end) {
    const context = this._maskContext

    if (!context || !this._sourceDisplayRect) {
      return
    }

    const mode = this.data.paintMode
    const size = Number(this.data.brushSize) || DEFAULT_BRUSH_SIZE

    context.save()
    const rect = this._sourceDisplayRect
    context.beginPath()
    context.rect(rect.x, rect.y, rect.width, rect.height)
    context.clip()
    context.lineCap = "round"
    context.lineJoin = "round"
    context.lineWidth = size

    if (mode === "erase") {
      context.globalCompositeOperation = "destination-out"
      context.strokeStyle = "rgba(0,0,0,1)"
    } else {
      context.globalCompositeOperation = "source-over"
      context.strokeStyle = "rgba(47,125,74,1)"
    }

    context.beginPath()
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
    context.stroke()

    if (start.x === end.x && start.y === end.y) {
      context.beginPath()
      context.arc(
        start.x,
        start.y,
        size / 2,
        0,
        Math.PI * 2
      )

      if (mode === "erase") {
        context.fillStyle = "rgba(0,0,0,1)"
      } else {
        context.fillStyle = "rgba(47,125,74,1)"
      }
      context.fill()
    }

    context.restore()

    if (mode === "paint") {
      this.expandSelectionBounds(start, size / 2)
      this.expandSelectionBounds(end, size / 2)

      if (!this.data.hasSelection) {
        this.setData({ hasSelection: true })
      }
    }

    this.redrawPaintEditor()
  },

  expandSelectionBounds(point, radius) {
    const imageRect = this._sourceDisplayRect
    const minX = clamp(
      point.x - radius,
      imageRect.x,
      imageRect.x + imageRect.width
    )
    const minY = clamp(
      point.y - radius,
      imageRect.y,
      imageRect.y + imageRect.height
    )
    const maxX = clamp(
      point.x + radius,
      imageRect.x,
      imageRect.x + imageRect.width
    )
    const maxY = clamp(
      point.y + radius,
      imageRect.y,
      imageRect.y + imageRect.height
    )

    if (!this._selectionBounds) {
      this._selectionBounds = {
        minX,
        minY,
        maxX,
        maxY
      }
      return
    }

    this._selectionBounds.minX = Math.min(
      this._selectionBounds.minX,
      minX
    )
    this._selectionBounds.minY = Math.min(
      this._selectionBounds.minY,
      minY
    )
    this._selectionBounds.maxX = Math.max(
      this._selectionBounds.maxX,
      maxX
    )
    this._selectionBounds.maxY = Math.max(
      this._selectionBounds.maxY,
      maxY
    )
  },

  setPaintMode(event) {
    if (this.data.isBusy) return
    this.cancelPaintStroke()
    const mode = event.currentTarget.dataset.mode

    if (mode !== "paint" && mode !== "erase") {
      return
    }

    this.setData({ paintMode: mode })
  },

  onBrushSizeChange(event) {
    if (this.data.isBusy) return
    this.setData({
      brushSize: clamp(Number(event.detail.value) || DEFAULT_BRUSH_SIZE,
        MIN_BRUSH_SIZE, MAX_BRUSH_SIZE)
    })
  },

  clearMask(showToast = true) {
    if (showToast !== false && this.data.isBusy) return
    this.cancelPaintStroke()
    if (this._maskContext && this._paintWidth && this._paintHeight) {
      this._maskContext.clearRect(
        0,
        0,
        this._paintWidth,
        this._paintHeight
      )
    }

    this._selectionBounds = null
    this._isPainting = false
    this._lastPaintPoint = null

    this.setData({ hasSelection: false })
    this.redrawPaintEditor()

    if (showToast) {
      wx.showToast({
        title: "已经清空",
        icon: "none"
      })
    }
  },

  async previewCutout() {
    if (this.data.isBusy) {
      return
    }

    if (!this.data.hasSelection || !this._selectionBounds) {
      wx.showToast({
        title: "先把想留下的部分涂出来",
        icon: "none"
      })
      return
    }

    if (!this._editorReady) return
    this.cancelPaintStroke()
    this.setData({ isBusy: true })

    try {
      const actualBounds = this.getActualMaskBounds()
      if (!actualBounds) {
        this.setData({ hasSelection: false })
        throw new Error("涂抹区域已经被擦空了")
      }
      const bounds = this.getExpandedSelectionBounds(actualBounds)
      if (Math.max(bounds.width, bounds.height) < MIN_SELECTED_SIZE) {
        throw new Error("选中的区域太小了")
      }
      const previewPath = await this.createPaintCutoutPng(bounds)
      if (this._destroyed) return

      this.setData({
        stage: "preview",
        previewPath,
        isBusy: false,
        petName:
          this.data.existingProfile && !this.data.petName
            ? this.data.existingProfile.name
            : this.data.petName,
        nameCount: petService.getNameLength(this.data.petName)
      })
    } catch (error) {
      if (this._destroyed) return
      console.error("生成监工透明 PNG 失败：", error)
      this.setData({ isBusy: false })
      wx.showToast({
        title: error.message || "这次没抠成功，再试一次",
        icon: "none"
      })
    }
  },

  getActualMaskBounds() {
    const fallback = this._selectionBounds

    if (
      !fallback ||
      !this._maskContext ||
      !this._pixelScaleX || !this._pixelScaleY
    ) {
      throw new Error("蒙版画布尚未准备好")
    }

    try {
      const scaleX = this._pixelScaleX
      const scaleY = this._pixelScaleY
      const sx = Math.max(0, Math.floor(fallback.minX * scaleX))
      const sy = Math.max(0, Math.floor(fallback.minY * scaleY))
      const ex = Math.min(
        this._maskCanvas.width,
        Math.ceil(fallback.maxX * scaleX)
      )
      const ey = Math.min(
        this._maskCanvas.height,
        Math.ceil(fallback.maxY * scaleY)
      )
      const width = Math.max(1, ex - sx)
      const height = Math.max(1, ey - sy)
      const pixels = this._maskContext.getImageData(
        sx,
        sy,
        width,
        height
      ).data

      let minX = width
      let minY = height
      let maxX = -1
      let maxY = -1

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const alpha = pixels[(y * width + x) * 4 + 3]

          if (alpha > 0) {
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        return null
      }

      return {
        minX: (sx + minX) / scaleX,
        minY: (sy + minY) / scaleY,
        maxX: (sx + maxX + 1) / scaleX,
        maxY: (sy + maxY + 1) / scaleY
      }
    } catch (error) {
      console.warn(
        "读取蒙版边界失败：",
        error
      )

      // 历史笔迹不能反映擦除后的实际范围，失败时保留编辑状态供重试。
      throw new Error("无法读取涂抹区域，请重试或更新微信")
    }
  },

  getExpandedSelectionBounds(rawBounds) {
    const raw = rawBounds || this._selectionBounds
    const pad = Math.max(raw.maxX - raw.minX, raw.maxY - raw.minY) * MASK_PADDING_RATIO

    const minX = raw.minX - pad
    const minY = raw.minY - pad
    const maxX = raw.maxX + pad
    const maxY = raw.maxY + pad

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    }
  },

  trimExportCanvasToAlpha(canvas) {
    const width = canvas.width
    const height = canvas.height
    const context = canvas.getContext("2d")
    const pixels = context.getImageData(0, 0, width, height).data
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 0) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      throw new Error("涂抹区域内没有可见内容")
    }

    const subjectWidth = maxX - minX + 1
    const subjectHeight = maxY - minY + 1
    const padding = Math.ceil(
      Math.max(subjectWidth, subjectHeight) * MASK_PADDING_RATIO
    )
    const cropX = Math.max(0, minX - padding)
    const cropY = Math.max(0, minY - padding)
    const cropRight = Math.min(width, maxX + 1 + padding)
    const cropBottom = Math.min(height, maxY + 1 + padding)
    const cropWidth = Math.max(1, cropRight - cropX)
    const cropHeight = Math.max(1, cropBottom - cropY)

    if (
      cropX === 0 && cropY === 0 &&
      cropWidth === width && cropHeight === height
    ) {
      return { width, height }
    }

    const cropped = context.getImageData(
      cropX,
      cropY,
      cropWidth,
      cropHeight
    )
    canvas.width = cropWidth
    canvas.height = cropHeight
    const croppedContext = canvas.getContext("2d")
    croppedContext.clearRect(0, 0, cropWidth, cropHeight)
    croppedContext.putImageData(cropped, 0, 0)

    return { width: cropWidth, height: cropHeight }
  },

  async createPaintCutoutPng(bounds) {
    await this.initAuxCanvases()

    if (!this._exportCanvas || !this._maskCanvas) {
      throw new Error("导出画布不可用")
    }

    const exportScale = Math.min(
      EXPORT_MAX_SIDE / Math.max(bounds.width, bounds.height),
      2.5
    )

    const outputWidth = Math.max(
      1,
      Math.round(bounds.width * exportScale)
    )
    const outputHeight = Math.max(
      1,
      Math.round(bounds.height * exportScale)
    )

    const canvas = this._exportCanvas
    canvas.width = outputWidth
    canvas.height = outputHeight

    const context = canvas.getContext("2d")
    context.clearRect(0, 0, outputWidth, outputHeight)

    const image = await this.loadExportImage(this._sourcePath)
    if (this._destroyed) throw new Error("页面已退出")
    const sourceRect = this._sourceDisplayRect
    const scaleX = outputWidth / bounds.width
    const scaleY = outputHeight / bounds.height

    context.globalCompositeOperation = "source-over"
    context.drawImage(
      image,
      (sourceRect.x - bounds.minX) * scaleX,
      (sourceRect.y - bounds.minY) * scaleY,
      sourceRect.width * scaleX,
      sourceRect.height * scaleY
    )

    context.globalCompositeOperation = "destination-in"
    context.drawImage(
      this._maskCanvas,
      0,
      0,
      this._maskCanvas.width,
      this._maskCanvas.height,
      -bounds.minX * scaleX,
      -bounds.minY * scaleY,
      this._paintWidth * scaleX,
      this._paintHeight * scaleY
    )

    context.globalCompositeOperation = "source-over"
    const finalSize = this.trimExportCanvasToAlpha(canvas)

    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath(
        {
          canvas,
          x: 0,
          y: 0,
          width: finalSize.width,
          height: finalSize.height,
          destWidth: finalSize.width,
          destHeight: finalSize.height,
          fileType: "png",
          quality: 1,
          success: result => resolve(result.tempFilePath),
          fail: reject
        },
        this
      )
    })
  },

  loadExportImage(sourcePath) {
    return new Promise((resolve, reject) => {
      const image = this._exportCanvas.createImage()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = sourcePath
    })
  },

  backToPaint() {
    if (this.data.isBusy) return
    this.setData({ stage: "paint" }, () => {
      wx.nextTick(() => {
        this.initPaintEditor(this._sourcePath, true)
      })
    })
  },

  onDisplayScaleChanging(event) {
    const percent = clamp(
      Number(event.detail.value) || 100,
      Math.round(petService.MIN_DISPLAY_SCALE * 100),
      Math.round(petService.MAX_DISPLAY_SCALE * 100)
    )

    this.setData({
      displayScalePercent: percent,
      displayScale: percent / 100
    })
  },

  onExistingScaleChange(event) {
    this.onDisplayScaleChanging(event)

    if (!this.data.existingProfile) {
      return
    }

    try {
      const profile = petService.updateDisplayScale(
        Number(event.detail.value) / 100
      )

      this.setData({
        existingProfile: profile,
        displayScale: profile.displayScale,
        displayScalePercent: Math.round(profile.displayScale * 100)
      })
    } catch (error) {
      console.error("保存监工大小失败：", error)
      const scale = this.data.existingProfile.displayScale
      this.setData({ displayScale: scale, displayScalePercent: Math.round(scale * 100) })
      wx.showToast({ title: "大小未保存，请重试", icon: "none" })
    }
  },

  onNameInput(event) {
    const value = event.detail.value || ""

    this.setData({
      petName: value,
      nameCount: petService.getNameLength(value)
    })
  },

  async savePet() {
    if (this.data.isBusy) {
      return
    }

    const validation = petService.validateName(this.data.petName)

    if (!validation.ok) {
      wx.showToast({
        title: validation.message,
        icon: "none"
      })
      return
    }

    if (!this.data.previewPath) {
      wx.showToast({
        title: "先把监工涂出来",
        icon: "none"
      })
      return
    }

    this.setData({ isBusy: true })

    try {
      const profile = petService.saveProfile({
        name: validation.name,
        tempFilePath: this.data.previewPath,
        displayScale: this.data.displayScale
      })

      this._sourcePath = ""
      this._sourceImage = null
      this._selectionBounds = null
      this.setData({
        isBusy: false,
        previewPath: "",
        existingProfile: profile,
        petName: profile.name,
        nameCount: petService.getNameLength(profile.name),
        displayScale: profile.displayScale,
        displayScalePercent: Math.round(profile.displayScale * 100),
        stage: "existing"
      })

      wx.showToast({
        title: "监工已就位",
        icon: "success"
      })
    } catch (error) {
      console.error("保存监工失败：", error)
      this.setData({ isBusy: false })
      wx.showToast({
        title: error.message || "保存失败，再试一次",
        icon: "none"
      })
    }
  },

  startRename() {
    if (!this.data.existingProfile) {
      return
    }

    const name = this.data.existingProfile.name
    this.setData({
      stage: "rename",
      petName: name,
      nameCount: petService.getNameLength(name)
    })
  },

  cancelRename() {
    const name = this.data.existingProfile
      ? this.data.existingProfile.name
      : ""

    this.setData({
      stage: "existing",
      petName: name,
      nameCount: petService.getNameLength(name)
    })
  },

  saveRename() {
    const validation = petService.validateName(this.data.petName)

    if (!validation.ok) {
      wx.showToast({
        title: validation.message,
        icon: "none"
      })
      return
    }

    try {
      const profile = petService.renameProfile(validation.name)
      this.setData({
        existingProfile: profile,
        petName: profile.name,
        nameCount: petService.getNameLength(profile.name),
        stage: "existing"
      })

      wx.showToast({
        title: "名字改好了",
        icon: "success"
      })
    } catch (error) {
      wx.showToast({
        title: error.message || "改名失败",
        icon: "none"
      })
    }
  },

  confirmDelete() {
    if (this.data.isBusy) return
    wx.showModal({
      title: "删除监工？",
      content: "抠好的图片也会一起删除。",
      confirmText: "删除",
      confirmColor: "#b4513f",
      success: result => {
        if (this._destroyed || !result.confirm) {
          return
        }

        try {
          petService.removeProfile()
          this._sourcePath = ""
          this._sourceImage = null
          this.setData({
            existingProfile: null,
            petName: "",
            nameCount: 0,
            previewPath: "",
            stage: "intro"
          })
        } catch (error) {
          wx.showToast({ title: error.message || "删除失败，监工已保留", icon: "none" })
        }
      }
    })
  },

  backHome() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.reLaunch({
      url: "/pages/index/index"
    })
  }
})
