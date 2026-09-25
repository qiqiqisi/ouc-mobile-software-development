export const ROOM_LAYOUT = Object.freeze({
  aspectRatio: 3 / 4,
  desk: Object.freeze({ left: 0.02, top: 0.40, width: 0.44 }),
  board: Object.freeze({ left: 0.56, top: 0.15, width: 0.40 }),
  toyHome: Object.freeze({ left: 0.79, top: 0.69, width: 0.17 }),
  floor: Object.freeze({ minX: 0.12, maxX: 0.89, minBottomY: 0.67, maxBottomY: 0.92 })
})

export const ROOM_BEHAVIOR = Object.freeze({
  idleBeforeWalkMs: 2600,
  walkTickMs: 70,
  sleepAfterMs: 30000,
  reactMs: 760,
  catchPauseMs: 280,
  toyReturnMs: 420,
  chaseTickMs: 70,
  catchDistanceRatio: 0.42,
  chaseSpeedMultiplier: 1.65
})

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

export function floorBounds(width, height) {
  return {
    minX: width * ROOM_LAYOUT.floor.minX,
    maxX: width * ROOM_LAYOUT.floor.maxX,
    minBottomY: height * ROOM_LAYOUT.floor.minBottomY,
    maxBottomY: height * ROOM_LAYOUT.floor.maxBottomY
  }
}

export function deskObstacle(width, height, size) {
  const left = width * ROOM_LAYOUT.desk.left
  const right = left + width * ROOM_LAYOUT.desk.width
  return {
    minX: Math.max(0, left - size * 0.34),
    maxX: Math.min(width, right + size * 0.34),
    maxBottomY: height * 0.715
  }
}

export function isNormalWalkPosition(point, width, height, size) {
  if (!point) return false
  const bounds = floorBounds(width, height)
  if (point.centerX < bounds.minX || point.centerX > bounds.maxX ||
      point.bottomY < bounds.minBottomY || point.bottomY > bounds.maxBottomY) return false
  const obstacle = deskObstacle(width, height, size)
  return !(point.centerX >= obstacle.minX && point.centerX <= obstacle.maxX &&
    point.bottomY < obstacle.maxBottomY)
}

export function segmentHitsDesk(start, target, width, height, size) {
  if (!start || !target) return false
  const obstacle = deskObstacle(width, height, size)
  for (let index = 1; index < 12; index += 1) {
    const ratio = index / 12
    const x = start.centerX + (target.centerX - start.centerX) * ratio
    const y = start.bottomY + (target.bottomY - start.bottomY) * ratio
    if (x >= obstacle.minX && x <= obstacle.maxX && y < obstacle.maxBottomY) return true
  }
  return false
}

export function buildWalkRoute(start, target, width, height, size) {
  if (!segmentHitsDesk(start, target, width, height, size)) return [target]
  const obstacle = deskObstacle(width, height, size)
  const bounds = floorBounds(width, height)
  const safeY = Math.min(bounds.maxBottomY, obstacle.maxBottomY + size * 0.36)
  const rightX = Math.min(bounds.maxX, obstacle.maxX + size * 0.26)
  return [
    { centerX: rightX, bottomY: safeY },
    { centerX: target.centerX, bottomY: Math.max(target.bottomY, safeY) }
  ]
}

export function bouncePointFromDesk(current, candidate, width, height, size) {
  const bounds = floorBounds(width, height)
  const obstacle = deskObstacle(width, height, size)
  const margin = Math.max(10, size * 0.16)
  const safe = {
    centerX: current && Number.isFinite(current.centerX) ? current.centerX : candidate.centerX,
    bottomY: current && Number.isFinite(current.bottomY) ? current.bottomY : candidate.bottomY
  }
  const fromLeft = Math.abs(candidate.centerX - obstacle.minX)
  const fromRight = Math.abs(obstacle.maxX - candidate.centerX)
  const fromBottom = Math.abs(obstacle.maxBottomY - candidate.bottomY)
  if (current && current.centerX <= obstacle.minX) safe.centerX = obstacle.minX - margin
  else if (current && current.centerX >= obstacle.maxX) safe.centerX = obstacle.maxX + margin
  else if (current && current.bottomY >= obstacle.maxBottomY) safe.bottomY = obstacle.maxBottomY + margin
  else if (fromBottom <= fromLeft && fromBottom <= fromRight) safe.bottomY = obstacle.maxBottomY + margin
  else if (fromLeft <= fromRight) safe.centerX = obstacle.minX - margin
  else safe.centerX = obstacle.maxX + margin
  safe.centerX = clamp(safe.centerX, bounds.minX, bounds.maxX)
  safe.bottomY = clamp(safe.bottomY, bounds.minBottomY, bounds.maxBottomY)
  return safe
}

export function depthScale(bottomY, height) {
  return clamp(0.90 + ((bottomY / height) - 0.66) * 0.38, 0.90, 1.04)
}

export function toyChaseTarget({ tip, petId, size, actorIds, width, height }) {
  if (!tip) return null
  const bounds = floorBounds(width, height)
  const ids = actorIds.length ? actorIds : [petId]
  const index = Math.max(0, ids.indexOf(petId))
  const spacing = Math.max(68, Math.min(92, Math.max(1, size) * 0.82))
  let xOffset = 0
  let yOffset = 0
  if (ids.length === 2) {
    xOffset = index === 0 ? -spacing * 0.52 : spacing * 0.52
    yOffset = spacing * 0.08
  } else if (ids.length >= 3) {
    xOffset = [0, -spacing, spacing][Math.min(index, 2)]
    yOffset = index === 0 ? 0 : spacing * 0.16
  }
  const spread = ids.length >= 3 ? spacing : ids.length === 2 ? spacing * 0.52 : 0
  const baseX = clamp(tip.x, bounds.minX + spread, bounds.maxX - spread)
  return {
    centerX: clamp(baseX + xOffset, bounds.minX, bounds.maxX),
    bottomY: clamp(tip.y + size * 0.58 + yOffset, bounds.minBottomY, bounds.maxBottomY)
  }
}
