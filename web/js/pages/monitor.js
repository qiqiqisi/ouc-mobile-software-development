import * as monitorStorage from
  "../services/monitor-storage.js"

import {
  showToast
} from "../shared/ui.js"


const WORKING_MAX_SIDE = 1280
const EXPORT_MAX_SIDE = 640
const MASK_PADDING_RATIO = 0.06
const MIN_BRUSH_SIZE = 18
const MAX_BRUSH_SIZE = 96


const state = {
  profile: null,
  homeUrl: "",
  source: null,
  sourceRelease: null,
  sourceBlob: null,
  maskCanvas: document.createElement("canvas"),
  maskContext: null,
  logicalWidth: 0,
  logicalHeight: 0,
  pixelScaleX: 1,
  pixelScaleY: 1,
  activePointerId: null,
  lastPoint: null,
  hasSelection: false,
  mode: "paint",
  previewBlob: null,
  previewUrl: "",
  clickCount: 0,
  busy: false,
  resizeTimer: 0
}


const elements = {}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}


function setHidden(element, hidden) {
  if (element) {
    element.classList.toggle("is-hidden", hidden)
  }
}


function revokeUrl(key) {
  if (state[key]) {
    URL.revokeObjectURL(state[key])
    state[key] = ""
  }
}


function setBusy(busy) {
  state.busy = busy
  elements.dialog
    .querySelectorAll("button, input")
    .forEach(control => {
      if (control.dataset.keepEnabled !== "true") {
        control.disabled = busy
      }
    })
  elements.dialog.classList.toggle(
    "monitor-is-busy",
    busy
  )
}


function showStage(stage) {
  elements.dialog.dataset.stage = stage
  elements.dialog
    .querySelectorAll("[data-monitor-stage]")
    .forEach(section => {
      setHidden(
        section,
        section.dataset.monitorStage !== stage
      )
    })
}


function updateNameCount(input, output) {
  const length =
    monitorStorage.getNameLength(input.value)

  output.textContent = `${length} / 6 个字符`
  output.classList.toggle(
    "monitor-field-error",
    length > monitorStorage.MAX_NAME_LENGTH
  )
}


function updateScaleUi(input, output, image) {
  const percent = clamp(
    Number(input.value) || 115,
    75,
    200
  )

  input.value = String(percent)
  output.textContent = `${percent}%`

  if (image) {
    image.style.transform =
      `scale(${percent / 100})`
  }
}


function releaseSource() {
  if (state.sourceRelease) {
    state.sourceRelease()
  }

  state.source = null
  state.sourceRelease = null
  state.sourceBlob = null
}


function clearDraft() {
  releaseSource()
  revokeUrl("previewUrl")
  state.previewBlob = null
  state.hasSelection = false
  state.activePointerId = null
  state.lastPoint = null
  state.mode = "paint"
  elements.fileInput.value = ""
}


async function decodeBlob(blob) {
  if (typeof window.createImageBitmap === "function") {
    try {
      const bitmap = await window.createImageBitmap(
        blob,
        { imageOrientation: "from-image" }
      )

      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close()
      }
    } catch (error) {
      console.warn("createImageBitmap 读取失败，改用 Image：", error)
    }
  }

  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        image,
        width:
          image.naturalWidth || image.width,
        height:
          image.naturalHeight || image.height,
        release: () => URL.revokeObjectURL(url)
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("图片读取失败"))
    }

    image.src = url
  })
}


function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error("透明 PNG 生成失败"))
      }
    }, "image/png", 1)
  })
}


async function createWorkingSource(file) {
  const decoded = await decodeBlob(file)
  const scale = Math.min(
    1,
    WORKING_MAX_SIDE /
      Math.max(decoded.width, decoded.height)
  )
  const width = Math.max(
    1,
    Math.round(decoded.width * scale)
  )
  const height = Math.max(
    1,
    Math.round(decoded.height * scale)
  )
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  context.drawImage(decoded.image, 0, 0, width, height)
  decoded.release()

  const blob = await canvasToBlob(canvas)
  const working = await decodeBlob(blob)

  return {
    ...working,
    blob
  }
}


function copyCurrentMask() {
  if (!state.maskCanvas.width || !state.maskCanvas.height) {
    return null
  }

  const copy = document.createElement("canvas")
  copy.width = state.maskCanvas.width
  copy.height = state.maskCanvas.height
  copy.getContext("2d").drawImage(state.maskCanvas, 0, 0)
  return copy
}


function configurePaintCanvas(preserveMask = false) {
  if (!state.source) {
    return
  }

  const oldMask = preserveMask
    ? copyCurrentMask()
    : null
  const shellWidth =
    elements.paintShell.clientWidth || 320
  const availableHeight = Math.max(
    240,
    Math.min(430, window.innerHeight * 0.52)
  )
  const aspect = state.source.width / state.source.height
  let logicalWidth = shellWidth
  let logicalHeight = logicalWidth / aspect

  if (logicalHeight > availableHeight) {
    logicalHeight = availableHeight
    logicalWidth = logicalHeight * aspect
  }

  logicalWidth = Math.max(1, logicalWidth)
  logicalHeight = Math.max(1, logicalHeight)

  const requestedDpr = clamp(
    Number(window.devicePixelRatio) || 1,
    1,
    3
  )
  const safeDpr = Math.min(
    requestedDpr,
    WORKING_MAX_SIDE /
      Math.max(logicalWidth, logicalHeight)
  )
  const pixelWidth = Math.max(
    1,
    Math.round(logicalWidth * safeDpr)
  )
  const pixelHeight = Math.max(
    1,
    Math.round(logicalHeight * safeDpr)
  )

  state.logicalWidth = logicalWidth
  state.logicalHeight = logicalHeight
  state.pixelScaleX = pixelWidth / logicalWidth
  state.pixelScaleY = pixelHeight / logicalHeight

  elements.paintCanvas.width = pixelWidth
  elements.paintCanvas.height = pixelHeight
  elements.paintCanvas.style.width = `${logicalWidth}px`
  elements.paintCanvas.style.height = `${logicalHeight}px`

  state.maskCanvas.width = pixelWidth
  state.maskCanvas.height = pixelHeight
  state.maskContext =
    state.maskCanvas.getContext("2d", {
      willReadFrequently: true
    })
  state.maskContext.setTransform(
    state.pixelScaleX,
    0,
    0,
    state.pixelScaleY,
    0,
    0
  )

  if (oldMask) {
    state.maskContext.drawImage(
      oldMask,
      0,
      0,
      oldMask.width,
      oldMask.height,
      0,
      0,
      logicalWidth,
      logicalHeight
    )
  }

  renderPaintCanvas()
}


function renderPaintCanvas() {
  if (!state.source) {
    return
  }

  const context = elements.paintCanvas.getContext("2d")
  context.setTransform(
    state.pixelScaleX,
    0,
    0,
    state.pixelScaleY,
    0,
    0
  )
  context.clearRect(
    0,
    0,
    state.logicalWidth,
    state.logicalHeight
  )
  context.drawImage(
    state.source,
    0,
    0,
    state.logicalWidth,
    state.logicalHeight
  )
  context.globalAlpha = 0.36
  context.drawImage(
    state.maskCanvas,
    0,
    0,
    state.maskCanvas.width,
    state.maskCanvas.height,
    0,
    0,
    state.logicalWidth,
    state.logicalHeight
  )
  context.globalAlpha = 1
}


export function getPointerPoint(event, canvas, width, height) {
  const rect = canvas.getBoundingClientRect()

  if (!rect.width || !rect.height) {
    return null
  }

  const x =
    (event.clientX - rect.left) * width / rect.width
  const y =
    (event.clientY - rect.top) * height / rect.height

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 || y < 0 ||
    x > width || y > height
  ) {
    return null
  }

  return { x, y }
}


function drawMaskSegment(from, to) {
  const context = state.maskContext
  const brushSize = clamp(
    Number(elements.brushSize.value) || 42,
    MIN_BRUSH_SIZE,
    MAX_BRUSH_SIZE
  )

  context.save()
  context.globalCompositeOperation =
    state.mode === "erase"
      ? "destination-out"
      : "source-over"
  context.strokeStyle = "#2f7d4a"
  context.fillStyle = "#2f7d4a"
  context.lineWidth = brushSize
  context.lineCap = "round"
  context.lineJoin = "round"

  if (from.x === to.x && from.y === to.y) {
    context.beginPath()
    context.arc(
      to.x,
      to.y,
      brushSize / 2,
      0,
      Math.PI * 2
    )
    context.fill()
  } else {
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
  }

  context.restore()
  state.hasSelection = true
  renderPaintCanvas()
}


function onPointerDown(event) {
  if (state.busy || !state.source || event.button > 0) {
    return
  }

  const point = getPointerPoint(
    event,
    elements.paintCanvas,
    state.logicalWidth,
    state.logicalHeight
  )

  if (!point) {
    return
  }

  event.preventDefault()
  elements.paintCanvas.setPointerCapture(event.pointerId)
  state.activePointerId = event.pointerId
  state.lastPoint = point
  drawMaskSegment(point, point)
}


function onPointerMove(event) {
  if (
    state.activePointerId !== event.pointerId ||
    !state.lastPoint
  ) {
    return
  }

  const point = getPointerPoint(
    event,
    elements.paintCanvas,
    state.logicalWidth,
    state.logicalHeight
  )

  if (!point) {
    return
  }

  event.preventDefault()
  drawMaskSegment(state.lastPoint, point)
  state.lastPoint = point
}


function endPointer(event) {
  if (state.activePointerId !== event.pointerId) {
    return
  }

  if (state.lastPoint) {
    const point = getPointerPoint(
      event,
      elements.paintCanvas,
      state.logicalWidth,
      state.logicalHeight
    )

    if (point) {
      drawMaskSegment(state.lastPoint, point)
    }
  }

  if (
    elements.paintCanvas.hasPointerCapture(event.pointerId)
  ) {
    elements.paintCanvas.releasePointerCapture(event.pointerId)
  }

  state.activePointerId = null
  state.lastPoint = null
}


export function scanAlphaBounds(
  context,
  width,
  height
) {
  const pixels =
    context.getImageData(0, 0, width, height).data
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
    return null
  }

  return {
    minX,
    minY,
    maxX: maxX + 1,
    maxY: maxY + 1,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
}


function getMaskBounds() {
  const physical = scanAlphaBounds(
    state.maskContext,
    state.maskCanvas.width,
    state.maskCanvas.height
  )

  if (!physical) {
    return null
  }

  return {
    minX: physical.minX / state.pixelScaleX,
    minY: physical.minY / state.pixelScaleY,
    maxX: physical.maxX / state.pixelScaleX,
    maxY: physical.maxY / state.pixelScaleY
  }
}


function expandBounds(bounds) {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const padding =
    Math.max(width, height) * MASK_PADDING_RATIO

  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
    width: width + padding * 2,
    height: height + padding * 2
  }
}


export function trimCanvasToAlpha(
  sourceCanvas,
  paddingRatio = MASK_PADDING_RATIO
) {
  const sourceContext = sourceCanvas.getContext(
    "2d",
    { willReadFrequently: true }
  )
  const bounds = scanAlphaBounds(
    sourceContext,
    sourceCanvas.width,
    sourceCanvas.height
  )

  if (!bounds) {
    throw new Error("涂抹区域内没有可见内容")
  }

  const padding = Math.ceil(
    Math.max(bounds.width, bounds.height) * paddingRatio
  )
  const x = Math.max(0, bounds.minX - padding)
  const y = Math.max(0, bounds.minY - padding)
  const right = Math.min(
    sourceCanvas.width,
    bounds.maxX + padding
  )
  const bottom = Math.min(
    sourceCanvas.height,
    bounds.maxY + padding
  )
  const width = Math.max(1, right - x)
  const height = Math.max(1, bottom - y)
  const output = document.createElement("canvas")
  output.width = width
  output.height = height
  output.getContext("2d").drawImage(
    sourceCanvas,
    x,
    y,
    width,
    height,
    0,
    0,
    width,
    height
  )
  return output
}


async function createCutoutBlob() {
  const maskBounds = getMaskBounds()

  if (!maskBounds) {
    state.hasSelection = false
    throw new Error("涂抹区域已经被擦空了")
  }

  const bounds = expandBounds(maskBounds)
  const exportScale = Math.min(
    EXPORT_MAX_SIDE /
      Math.max(bounds.width, bounds.height),
    2.5
  )
  const width = Math.max(
    1,
    Math.round(bounds.width * exportScale)
  )
  const height = Math.max(
    1,
    Math.round(bounds.height * exportScale)
  )
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext(
    "2d",
    { willReadFrequently: true }
  )
  const scaleX = width / bounds.width
  const scaleY = height / bounds.height

  context.drawImage(
    state.source,
    -bounds.minX * scaleX,
    -bounds.minY * scaleY,
    state.logicalWidth * scaleX,
    state.logicalHeight * scaleY
  )
  context.globalCompositeOperation = "destination-in"
  context.drawImage(
    state.maskCanvas,
    0,
    0,
    state.maskCanvas.width,
    state.maskCanvas.height,
    -bounds.minX * scaleX,
    -bounds.minY * scaleY,
    state.logicalWidth * scaleX,
    state.logicalHeight * scaleY
  )
  context.globalCompositeOperation = "source-over"

  const trimmed = trimCanvasToAlpha(canvas)
  return canvasToBlob(trimmed)
}


function clearMask() {
  if (!state.maskContext || state.busy) {
    return
  }

  state.maskContext.save()
  state.maskContext.setTransform(1, 0, 0, 1, 0, 0)
  state.maskContext.clearRect(
    0,
    0,
    state.maskCanvas.width,
    state.maskCanvas.height
  )
  state.maskContext.restore()
  state.hasSelection = false
  renderPaintCanvas()
}


function setMode(mode) {
  state.mode = mode === "erase"
    ? "erase"
    : "paint"

  elements.dialog
    .querySelectorAll("[data-paint-mode]")
    .forEach(button => {
      button.classList.toggle(
        "monitor-tool-active",
        button.dataset.paintMode === state.mode
      )
    })
}


async function beginPaint(file) {
  if (!file || !String(file.type).startsWith("image/")) {
    showToast("请选择一张图片")
    return
  }

  setBusy(true)

  try {
    const working = await createWorkingSource(file)
    releaseSource()
    revokeUrl("previewUrl")
    state.previewBlob = null
    state.source = working.image
    state.sourceRelease = working.release
    state.sourceBlob = working.blob
    state.hasSelection = false
    elements.previewName.value =
      state.profile ? state.profile.name : ""
    elements.previewScale.value = String(
      Math.round(
        (state.profile
          ? state.profile.displayScale
          : monitorStorage.DEFAULT_DISPLAY_SCALE) * 100
      )
    )
    updateNameCount(
      elements.previewName,
      elements.previewNameCount
    )
    setMode("paint")
    showStage("paint")
    await new Promise(resolve =>
      requestAnimationFrame(resolve)
    )
    configurePaintCanvas(false)
  } catch (error) {
    console.error("监工图片读取失败：", error)
    showToast(error.message || "图片读取失败")
  } finally {
    setBusy(false)
  }
}


async function previewCutout() {
  if (state.busy || !state.hasSelection) {
    showToast("先厚涂想保留的主体")
    return
  }

  setBusy(true)

  try {
    const blob = await createCutoutBlob()
    state.previewBlob = blob
    revokeUrl("previewUrl")
    state.previewUrl = URL.createObjectURL(blob)
    elements.previewImage.src = state.previewUrl
    updateScaleUi(
      elements.previewScale,
      elements.previewScaleValue,
      elements.previewImage
    )
    showStage("preview")
  } catch (error) {
    console.error("监工透明 PNG 生成失败：", error)
    showToast(error.message || "这次没抠成功")
  } finally {
    setBusy(false)
  }
}


function fillSettings(profile) {
  elements.existingName.value = profile.name
  elements.existingScale.value = String(
    Math.round(profile.displayScale * 100)
  )
  updateNameCount(
    elements.existingName,
    elements.existingNameCount
  )
  updateScaleUi(
    elements.existingScale,
    elements.existingScaleValue,
    elements.existingImage
  )
  elements.existingImage.src = state.homeUrl
}


function openDialog() {
  clearDraft()
  elements.dialog.classList.remove("is-hidden")
  elements.dialog.setAttribute("aria-hidden", "false")
  document.body.classList.add("monitor-modal-open")

  if (state.profile && state.homeUrl) {
    fillSettings(state.profile)
    showStage("settings")
  } else {
    elements.previewName.value = ""
    elements.previewScale.value = "115"
    updateNameCount(
      elements.previewName,
      elements.previewNameCount
    )
    showStage("choose")
  }
}


function closeDialog() {
  if (state.busy) {
    return
  }

  clearDraft()
  elements.dialog.classList.add("is-hidden")
  elements.dialog.setAttribute("aria-hidden", "true")
  document.body.classList.remove("monitor-modal-open")
}


async function renderHomeMonitor() {
  state.profile = monitorStorage.getProfile()
  revokeUrl("homeUrl")

  if (!state.profile) {
    setHidden(elements.monitorAdd, false)
    setHidden(elements.monitorHome, true)
    return
  }

  try {
    const blob = await monitorStorage.getProfileImage(
      state.profile
    )

    if (!blob) {
      throw new Error("监工图片不存在")
    }

    state.homeUrl = URL.createObjectURL(blob)
    elements.homeImage.src = state.homeUrl
    elements.homeImage.alt = `${state.profile.name}监工`
    elements.homeCaption.textContent =
      `${state.profile.name}会一直盯着你完成记录。`
    const width = 150 * state.profile.displayScale
    const height = 140 * state.profile.displayScale
    elements.monitorHome.style.setProperty(
      "--monitor-width",
      `${width}px`
    )
    elements.monitorHome.style.setProperty(
      "--monitor-height",
      `${height}px`
    )
    setHidden(elements.monitorAdd, true)
    setHidden(elements.monitorHome, false)
  } catch (error) {
    console.error("读取监工图片失败：", error)
    setHidden(elements.monitorAdd, false)
    setHidden(elements.monitorHome, true)
  }
}


async function saveNewMonitor() {
  if (state.busy || !state.previewBlob) {
    return
  }

  const validation = monitorStorage.validateName(
    elements.previewName.value
  )

  if (!validation.ok) {
    showToast(validation.message)
    return
  }

  setBusy(true)

  try {
    await monitorStorage.saveProfile({
      name: validation.name,
      blob: state.previewBlob,
      displayScale:
        Number(elements.previewScale.value) / 100
    })
    await renderHomeMonitor()
    setBusy(false)
    closeDialog()
    showToast("监工已住进首页")
  } catch (error) {
    console.error("监工保存失败：", error)
    showToast(error.message || "监工保存失败")
    setBusy(false)
  }
}


async function saveExistingMonitor() {
  if (state.busy || !state.profile) {
    return
  }

  setBusy(true)

  try {
    monitorStorage.updateProfile({
      name: elements.existingName.value,
      displayScale:
        Number(elements.existingScale.value) / 100
    })
    await renderHomeMonitor()
    setBusy(false)
    closeDialog()
    showToast("监工设置已更新")
  } catch (error) {
    showToast(error.message || "监工设置保存失败")
    setBusy(false)
  }
}


async function deleteMonitor() {
  if (
    state.busy ||
    !state.profile ||
    !window.confirm("删除当前监工？")
  ) {
    return
  }

  setBusy(true)

  try {
    await monitorStorage.removeProfile()
    await renderHomeMonitor()
    setBusy(false)
    closeDialog()
    showToast("监工已删除")
  } catch (error) {
    console.error("监工删除失败：", error)
    showToast(error.message || "监工删除失败")
    setBusy(false)
  }
}


function onHomeMonitorClick() {
  if (!state.profile) {
    return
  }

  state.clickCount += 1

  const messages = [
    `${state.profile.name}看了你一眼。`,
    `${state.profile.name}开始觉得你有点闲。`,
    "别点了，去记录。",
    "TOUCH LIMIT EXCEEDED"
  ]
  const index = Math.min(
    messages.length - 1,
    state.clickCount - 1
  )
  showToast(messages[index])
}


function bindEvents() {
  elements.monitorAdd.addEventListener("click", openDialog)
  elements.monitorEdit.addEventListener("click", openDialog)
  elements.homeImageButton.addEventListener(
    "click",
    onHomeMonitorClick
  )
  elements.dialogClose.addEventListener("click", closeDialog)
  elements.dialog.addEventListener("click", event => {
    if (event.target === elements.dialog) {
      closeDialog()
    }
  })
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeDialog()
    }
  })

  elements.chooseButtons.forEach(button => {
    button.addEventListener("click", () =>
      elements.fileInput.click()
    )
  })
  elements.fileInput.addEventListener("change", () => {
    const file = elements.fileInput.files[0]
    elements.fileInput.value = ""
    beginPaint(file)
  })
  elements.paintCanvas.addEventListener(
    "pointerdown",
    onPointerDown
  )
  elements.paintCanvas.addEventListener(
    "pointermove",
    onPointerMove
  )
  elements.paintCanvas.addEventListener(
    "pointerup",
    endPointer
  )
  elements.paintCanvas.addEventListener(
    "pointercancel",
    endPointer
  )
  elements.paintCanvas.addEventListener(
    "lostpointercapture",
    () => {
      state.activePointerId = null
      state.lastPoint = null
    }
  )

  elements.dialog
    .querySelectorAll("[data-paint-mode]")
    .forEach(button => {
      button.addEventListener("click", () =>
        setMode(button.dataset.paintMode)
      )
    })
  elements.clearMask.addEventListener("click", clearMask)
  elements.previewCutout.addEventListener(
    "click",
    previewCutout
  )
  elements.backToPaint.addEventListener(
    "click",
    () => showStage("paint")
  )
  elements.saveNew.addEventListener("click", saveNewMonitor)
  elements.saveExisting.addEventListener(
    "click",
    saveExistingMonitor
  )
  elements.deleteMonitor.addEventListener("click", deleteMonitor)

  elements.previewName.addEventListener("input", () =>
    updateNameCount(
      elements.previewName,
      elements.previewNameCount
    )
  )
  elements.existingName.addEventListener("input", () =>
    updateNameCount(
      elements.existingName,
      elements.existingNameCount
    )
  )
  elements.previewScale.addEventListener("input", () =>
    updateScaleUi(
      elements.previewScale,
      elements.previewScaleValue,
      elements.previewImage
    )
  )
  elements.existingScale.addEventListener("input", () =>
    updateScaleUi(
      elements.existingScale,
      elements.existingScaleValue,
      elements.existingImage
    )
  )

  window.addEventListener("resize", () => {
    window.clearTimeout(state.resizeTimer)
    state.resizeTimer = window.setTimeout(() => {
      if (
        elements.dialog.dataset.stage === "paint" &&
        state.source
      ) {
        configurePaintCanvas(true)
      }
    }, 120)
  })
}


function collectElements() {
  Object.assign(elements, {
    monitorAdd: document.querySelector("#monitor-add"),
    monitorHome: document.querySelector("#monitor-home"),
    homeImageButton: document.querySelector("#monitor-home-image-button"),
    homeImage: document.querySelector("#monitor-home-image"),
    homeCaption: document.querySelector("#monitor-home-caption"),
    monitorEdit: document.querySelector("#monitor-edit"),
    dialog: document.querySelector("#monitor-dialog"),
    dialogClose: document.querySelector("#monitor-dialog-close"),
    fileInput: document.querySelector("#monitor-file-input"),
    chooseButtons: Array.from(
      document.querySelectorAll("[data-choose-monitor]")
    ),
    paintShell: document.querySelector("#monitor-paint-shell"),
    paintCanvas: document.querySelector("#monitor-paint-canvas"),
    brushSize: document.querySelector("#monitor-brush-size"),
    clearMask: document.querySelector("#monitor-clear-mask"),
    previewCutout: document.querySelector("#monitor-preview-cutout"),
    backToPaint: document.querySelector("#monitor-back-to-paint"),
    previewImage: document.querySelector("#monitor-preview-image"),
    previewName: document.querySelector("#monitor-preview-name"),
    previewNameCount: document.querySelector("#monitor-preview-name-count"),
    previewScale: document.querySelector("#monitor-preview-scale"),
    previewScaleValue: document.querySelector("#monitor-preview-scale-value"),
    saveNew: document.querySelector("#monitor-save-new"),
    existingImage: document.querySelector("#monitor-existing-image"),
    existingName: document.querySelector("#monitor-existing-name"),
    existingNameCount: document.querySelector("#monitor-existing-name-count"),
    existingScale: document.querySelector("#monitor-existing-scale"),
    existingScaleValue: document.querySelector("#monitor-existing-scale-value"),
    saveExisting: document.querySelector("#monitor-save-existing"),
    deleteMonitor: document.querySelector("#monitor-delete")
  })
}


export async function initializeMonitor() {
  collectElements()
  bindEvents()
  setMode("paint")
  updateNameCount(
    elements.previewName,
    elements.previewNameCount
  )
  updateScaleUi(
    elements.previewScale,
    elements.previewScaleValue,
    elements.previewImage
  )
  await renderHomeMonitor()
}
