const DIRECTIONS = {
  U: { dr: -1, dc: 0 },
  D: { dr: 1, dc: 0 },
  L: { dr: 0, dc: -1 },
  R: { dr: 0, dc: 1 }
}

function keyOf(row, col) {
  return row + ',' + col
}

function parseMap(map) {
  const floors = new Set()
  const walls = new Set()
  const goals = new Set()
  const boxes = new Set()
  let player = { row: 0, col: 0 }

  map.forEach((line, row) => {
    line.forEach((value, col) => {
      const key = keyOf(row, col)

      if (value === 1) {
        walls.add(key)
        return
      }

      if ([2, 3, 4, 5].includes(value)) {
        floors.add(key)
      }

      if (value === 3) {
        goals.add(key)
      } else if (value === 4) {
        boxes.add(key)
      } else if (value === 5) {
        player = { row, col }
      }
    })
  })

  return {
    floors,
    walls,
    goals,
    boxes,
    player
  }
}

function snapshot(state) {
  return {
    player: {
      row: state.player.row,
      col: state.player.col
    },
    boxes: Array.from(state.boxes)
  }
}

function restore(state, saved) {
  state.player = {
    row: saved.player.row,
    col: saved.player.col
  }
  state.boxes = new Set(saved.boxes)
}

function tryMove(state, direction) {
  const delta = DIRECTIONS[direction]
  if (!delta) return { moved: false, pushed: false }

  const nextRow = state.player.row + delta.dr
  const nextCol = state.player.col + delta.dc
  const nextKey = keyOf(nextRow, nextCol)

  if (!state.floors.has(nextKey)) {
    return { moved: false, pushed: false }
  }

  let pushed = false

  if (state.boxes.has(nextKey)) {
    const boxRow = nextRow + delta.dr
    const boxCol = nextCol + delta.dc
    const boxKey = keyOf(boxRow, boxCol)

    if (!state.floors.has(boxKey) || state.boxes.has(boxKey)) {
      return { moved: false, pushed: false }
    }

    state.boxes.delete(nextKey)
    state.boxes.add(boxKey)
    pushed = true
  }

  state.player = {
    row: nextRow,
    col: nextCol
  }

  return {
    moved: true,
    pushed
  }
}

function isSolved(state) {
  if (state.boxes.size !== state.goals.size) {
    return false
  }

  for (const box of state.boxes) {
    if (!state.goals.has(box)) {
      return false
    }
  }

  return true
}

module.exports = {
  DIRECTIONS,
  keyOf,
  parseMap,
  snapshot,
  restore,
  tryMove,
  isSolved
}
