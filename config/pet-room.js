const ROOM_ASSETS = {
  background: "/assets/pet/room/pet_room_base.png",
  desk: "/assets/pet/room/pet_room_desk.png",
  statusBoard: "/assets/pet/room/pet_room_status_board.png",
  teaserWand: "/assets/pet/room/pet_room_teaser_wand.png",
  entryHouse: "/assets/pet/entry/pet_home_entry_house.png",
  sleepMask: "/assets/pet/extra/pet_sleep_mask.png"
}

const ROOM_LAYOUT = {
  aspectRatio: 3 / 4,
  desk: { left: 0.02, top: 0.40, width: 0.44 },
  // 状态板完全放在窗户右侧，并略放大，避免只遮住窗户一角。
  board: { left: 0.56, top: 0.15, width: 0.40 },
  toyHome: { left: 0.79, top: 0.69, width: 0.17 },
  floor: {
    minX: 0.12,
    maxX: 0.89,
    minBottomY: 0.67,
    maxBottomY: 0.92
  },
  // 书桌工作位：露出完整头部和半个西装，其余身体由书桌遮住。
  deskAnchor: { centerX: 0.295, bottomY: 0.665 },
  // 先从桌后移动到右侧出口，再从侧边离开。
  deskExitAnchor: { centerX: 0.50, bottomY: 0.71 }
}

const ROOM_BEHAVIOR = {
  idleBeforeWalkMs: 2600,
  walkTickMs: 70,
  sleepAfterMs: 30000,
  reactMs: 760,
  catchPauseMs: 280,
  toyReturnMs: 420,
  chaseTickMs: 70,
  catchDistanceRatio: 0.42,
  chaseSpeedMultiplier: 1.65
}

module.exports = {
  ROOM_ASSETS,
  ROOM_LAYOUT,
  ROOM_BEHAVIOR
}
