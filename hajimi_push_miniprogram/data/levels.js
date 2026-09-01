const LEVELS = [
  {
    id: 1,
    name: '哈吉米，启动！',
    description: '先别急着卡关，这关主要防止你开局退游。',
    gameSubtitle: '现在后悔还来得及。',
    optimalSteps: 51,
    optimalPushes: 11,
    solution: 'URDRRDDRDDLLULLDLURRRDLLRRRRUULUULLDDUURRDDRDDLLULL',
    map: [
      [0, 1, 1, 1, 1, 0, 0, 0],
      [0, 1, 2, 2, 1, 1, 1, 0],
      [0, 1, 5, 4, 2, 2, 1, 0],
      [1, 1, 1, 2, 1, 2, 1, 1],
      [1, 3, 1, 2, 1, 2, 2, 1],
      [1, 3, 4, 2, 2, 1, 2, 1],
      [1, 3, 2, 2, 2, 4, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ]
  },
  {
    id: 2,
    name: '猫猫祟祟',
    description: '看似乱推，实则每一步都像蓄谋已久。',
    gameSubtitle: '已经开始鬼鬼祟祟了。',
    optimalSteps: 10,
    optimalPushes: 6,
    solution: 'DULLRUUDRR',
    map: [
      [0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 1, 3, 1, 0, 0, 0],
      [0, 0, 1, 2, 1, 1, 1, 1],
      [1, 1, 1, 4, 2, 4, 3, 1],
      [1, 3, 2, 4, 5, 1, 1, 1],
      [1, 1, 1, 1, 4, 1, 0, 0],
      [0, 0, 0, 1, 3, 1, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0]
    ]
  },
  {
    id: 3,
    name: '不是，猫们？',
    description: '地图已经开始针对你了，建议脑子也上线。',
    gameSubtitle: '不是，猫们？真要这么走？',
    optimalSteps: 51,
    optimalPushes: 14,
    solution: 'UUDDLLDDRRUUDDRRULDLLLUURRURDLLLDDRRUURULDDDRUULLUU',
    map: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 1, 3, 3, 1, 0, 0],
      [0, 1, 1, 2, 3, 1, 1, 0],
      [0, 1, 2, 2, 4, 3, 1, 0],
      [1, 1, 2, 2, 5, 4, 1, 1],
      [1, 2, 2, 1, 4, 4, 2, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ]
  },
  {
    id: 4,
    name: '有点脏了',
    description: '场面已经失控，但哈吉米觉得问题不大。',
    gameSubtitle: '今天必须有人把这里收拾了。',
    optimalSteps: 61,
    optimalPushes: 20,
    solution: 'LUUUULURRDLDDDDLLUURLDDRRUUUURULDDDDDRRRUULUDLUDRRDDLLLUUURUL',
    map: [
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 3, 2, 3, 3, 1, 0],
      [0, 1, 3, 2, 4, 3, 1, 0],
      [1, 1, 1, 2, 2, 4, 1, 1],
      [1, 2, 4, 2, 2, 4, 2, 1],
      [1, 2, 1, 4, 1, 1, 2, 1],
      [1, 2, 2, 2, 5, 2, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ]
  }
]

module.exports = {
  LEVELS
}
