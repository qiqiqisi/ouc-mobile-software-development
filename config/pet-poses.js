const ASSET_ROOT = "/assets/pet"

// 组合参数沿用最初 1254×1254 的设计坐标系。
// 运行时 PNG 已压缩到 640×640，但 CSS 仍按这一虚拟坐标计算百分比，视觉位置不变。
const REFERENCE_WIDTH = 1254
const REFERENCE_HEIGHT = 1254
const ASSET_SIZE = 1254

const STANDING_LEGS = {
  // 腿素材本身占满大画布，实际组合时需要压短并加粗。
  // widthScale > heightScale：腿横向加粗约 15%，但不增加长度。
  widthScale: 0.27,
  heightScale: 0.20,
  left: {
    centerX: 410,
    straightFrameY: 845,
    bentFrameY: 815,
    flipX: false
  },
  right: {
    centerX: 844,
    straightFrameY: 845,
    bentFrameY: 815,
    flipX: true
  }
}

const PET_POSES = {
  default: {
    body: `${ASSET_ROOT}/body/pet_body_default.png`,
    headFrame: { centerX: 627, bottomY: 515, nominalSize: 500 },
    legs: STANDING_LEGS
  },
  react: {
    body: `${ASSET_ROOT}/body/pet_body_react.png`,
    headFrame: { centerX: 627, bottomY: 515, nominalSize: 500 },
    legs: STANDING_LEGS
  },
  idleAlt: {
    body: `${ASSET_ROOT}/body/pet_body_idle_alt.png`,
    headFrame: { centerX: 627, bottomY: 515, nominalSize: 500 },
    legs: STANDING_LEGS
  },
  sleep: {
    pose: `${ASSET_ROOT}/extra/pet_sleep_pose.png`,
    // 睡姿领口比站姿略低；头仍保持在画布中央附近。
    headFrame: { centerX: 627, bottomY: 525, nominalSize: 500 },
    legs: null
  }
}

function getPose(name) {
  return PET_POSES[name] || PET_POSES.default
}

function pct(value, total) {
  return value / total * 100
}

function layerStyle({ left, top, width, height, transform = "" }) {
  const parts = [
    `left:${pct(left, REFERENCE_WIDTH)}%`,
    `top:${pct(top, REFERENCE_HEIGHT)}%`,
    `width:${pct(width, REFERENCE_WIDTH)}%`,
    `height:${pct(height, REFERENCE_HEIGHT)}%`
  ]
  if (transform) parts.push(`transform:${transform}`)
  return `${parts.join(";")};`
}

function squareLayerStyle({ left, top, size, transform = "" }) {
  return layerStyle({ left, top, width: size, height: size, transform })
}

function normalizeTransform(headTransform) {
  const transform = headTransform || {}
  return {
    scale: Number.isFinite(Number(transform.scale)) ? Number(transform.scale) : 1,
    offsetX: Number.isFinite(Number(transform.offsetX)) ? Number(transform.offsetX) : 0,
    offsetY: Number.isFinite(Number(transform.offsetY)) ? Number(transform.offsetY) : 0,
    rotation: Number.isFinite(Number(transform.rotation)) ? Number(transform.rotation) : 0
  }
}

function headStyleForPose(pose, headTransform) {
  const transform = normalizeTransform(headTransform)
  const head = pose.headFrame
  const headLeft = head.centerX - head.nominalSize / 2 + transform.offsetX
  const headTop = head.bottomY - head.nominalSize + transform.offsetY

  return squareLayerStyle({
    left: headLeft,
    top: headTop,
    size: head.nominalSize,
    transform: `rotate(${transform.rotation}deg) scale(${transform.scale})`
  })
}

function legStyles(item, legs) {
  const width = ASSET_SIZE * legs.widthScale
  const height = ASSET_SIZE * legs.heightScale
  const left = item.centerX - width / 2
  const flip = `scaleX(${item.flipX ? -1 : 1})`

  return {
    straight: layerStyle({
      left,
      top: item.straightFrameY,
      width,
      height,
      transform: flip
    }),
    bent: layerStyle({
      left,
      top: item.bentFrameY,
      width,
      height,
      transform: flip
    })
  }
}

function buildStandingLayers(poseName, headTransform, options = {}) {
  const pose = getPose(poseName)
  const legs = pose.legs || STANDING_LEGS
  const walking = Boolean(options.walking)
  const walkPhase = Number(options.walkPhase) ? 1 : 0
  const leftBent = walking && walkPhase === 1
  const rightBent = walking && walkPhase === 0
  const left = legStyles(legs.left, legs)
  const right = legStyles(legs.right, legs)

  return {
    bodyImage: pose.body,
    bodyStyle: squareLayerStyle({ left: 0, top: 0, size: ASSET_SIZE }),
    headStyle: headStyleForPose(pose, headTransform),

    // 兼容试穿页原来的单图层接口。
    leftLegImage: leftBent
      ? `${ASSET_ROOT}/limbs/pet_leg_bent.png`
      : `${ASSET_ROOT}/limbs/pet_leg_straight.png`,
    rightLegImage: rightBent
      ? `${ASSET_ROOT}/limbs/pet_leg_bent.png`
      : `${ASSET_ROOT}/limbs/pet_leg_straight.png`,
    leftLegStyle: leftBent ? left.bent : left.straight,
    rightLegStyle: rightBent ? right.bent : right.straight,

    // 首页预加载两种腿素材后只切透明度，避免 WALK 时出现空白闪烁。
    leftLegStraightStyle: left.straight,
    leftLegBentStyle: left.bent,
    rightLegStraightStyle: right.straight,
    rightLegBentStyle: right.bent,
    leftBent,
    rightBent
  }
}


function sleepMaskStyle(headTransform) {
  const transform = normalizeTransform(headTransform)
  const head = PET_POSES.sleep.headFrame
  const width = 390
  const height = 171
  const left = head.centerX - width / 2 + transform.offsetX
  // 眼罩覆盖用户头部的中上部；与头图一起继承缩放、旋转和偏移。
  const top = 150 + transform.offsetY

  return layerStyle({
    left,
    top,
    width,
    height,
    transform: `rotate(${transform.rotation}deg) scale(${transform.scale})`
  })
}

function buildSleepLayers(headTransform) {
  const pose = PET_POSES.sleep
  return {
    sleepPoseImage: pose.pose,
    sleepPoseStyle: squareLayerStyle({ left: 0, top: 0, size: ASSET_SIZE }),
    headStyle: headStyleForPose(pose, headTransform),
    sleepMaskStyle: sleepMaskStyle(headTransform)
  }
}

module.exports = {
  ASSET_ROOT,
  ASSET_SIZE,
  REFERENCE_WIDTH,
  REFERENCE_HEIGHT,
  PET_POSES,
  getPose,
  buildStandingLayers,
  buildSleepLayers,
  sleepMaskStyle
}
