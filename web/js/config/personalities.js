export const PERSONALITIES = {
  "404": {
    code: "404",
    name: "活人未检出",
    tagline: "人还活着，但最近基本没人见过。",
    description: [
      "你这段时间像是从现实世界里悄悄下线了。不怎么出门，不怎么社交，活动范围稳定得像被锁在一个地图角落里。别人放假是在旅游、聚会、到处跑，你放假更像是在测试“一个人到底能多久不被发现”。",
      "最神奇的是，你本人可能还过得挺舒服。毕竟只要不出现，就不会被临时抓去干活。"
    ],
    keywords: ["宅家", "低社交", "隐身", "安静消失"],
    systemComment: "查找用户中……算了，找不到就算了。",
    image: "./assets/personality/404.webp",
    special: false
  },

  "NPC": {
    code: "NPC",
    name: "出厂设置",
    tagline: "每天都在运行，但剧情暂时没有更新。",
    description: [
      "你的生活稳定得令人安心，也稳定得有点可疑。昨天干什么，今天大概率还在干什么；今天干什么，明天系统已经替你预测完了。别人每天解锁新剧情，你主要负责按时刷新。",
      "好消息是，你很少突然崩。坏消息是，连续看你七天的记录，可能只需要看第一天。"
    ],
    keywords: ["重复", "稳定", "日常循环", "默认模式"],
    systemComment: "用户运行正常。更新内容：暂无。",
    image: "./assets/personality/npc.webp",
    special: false
  },

  "ESC": {
    code: "ESC",
    name: "先撤了",
    tagline: "事情还没开始，你已经找到出口了。",
    description: [
      "你对“知难而退”这四个字理解得非常灵活。遇到麻烦先看看能不能绕，遇到任务先看看能不能晚点，实在不行——那就先走一步。你不是没有解决问题的能力，你只是非常擅长判断：这个问题到底值不值得由你解决。",
      "别人面对困难是迎难而上。你面对困难是确认一下出口在哪。"
    ],
    keywords: ["摸鱼", "随缘", "低投入", "见势不妙"],
    systemComment: "检测到问题。用户已退出当前页面。",
    image: "./assets/personality/esc.webp",
    special: false
  },

  "CTRL+A": {
    code: "CTRL+A",
    name: "全都要",
    tagline: "不做选择，我全选。",
    description: [
      "学习想搞，游戏想打，朋友要见，运动也不能落下，出去玩当然更不能少。你的生活理念不是“有所取舍”，而是“成年人为什么不能全要”。一天只有二十四小时这件事，对你来说更像一个不太合理的产品限制。",
      "问题不是你没有兴趣。问题是你的兴趣可能比时间多。"
    ],
    keywords: ["多线并行", "什么都想试", "活跃", "选择困难"],
    systemComment: "已选择全部项目。内存够不够，稍后再说。",
    image: "./assets/personality/ctrl_a.webp",
    special: false
  },

  "CTRL+V": {
    code: "CTRL+V",
    name: "粘人精",
    tagline: "你出现的地方，通常还会附赠别人。",
    description: [
      "你最近的生活里，“我”出现得不多，“我们”出现得倒是很勤。吃饭最好有人，出去最好有人，连什么都不干的时候，旁边有个人一起什么都不干也会更有意思。",
      "你不是单纯爱社交。你更像是已经把自己复制粘贴到了朋友身边。"
    ],
    keywords: ["高社交", "陪伴", "朋友浓度高", "一起行动"],
    systemComment: "粘贴成功。是否允许单独运行？不允许。",
    image: "./assets/personality/ctrl_v.webp",
    special: false
  },

  "F5": {
    code: "F5",
    name: "重新做人",
    tagline: "上一个版本不太行，这次真的重开。",
    description: [
      "你这段时间最明显的特点，是总能在某个时刻突然决定：“好了，从今天开始我要正常生活。”",
      "于是你重新调整作息、重新学习、重新运动、重新制定计划，整个人像按了一次刷新键。至于这个新版本能运行多久，目前还没有足够数据证明。",
      "但至少有一点值得肯定：你是真的会重启，不是彻底关机。"
    ],
    keywords: ["重启", "状态回升", "再来一次", "新版本"],
    systemComment: "刷新成功。请不要立即重复之前的操作。",
    image: "./assets/personality/f5.webp",
    special: false
  },

  "BUG": {
    code: "BUG",
    name: "正常发挥",
    tagline: "每天都可能出点问题，但你已经习惯了。",
    description: [
      "你的生活很难预测。计划写得挺好，实际发生什么主要看当天系统心情。今天突然高效，明天突然消失；上午准备认真学习，下午可能莫名其妙开始干另一件完全无关的事。",
      "最离谱的是，面对这些意外，你已经越来越淡定。别人遇到 Bug 会排查原因，你遇到 Bug 第一反应是：“哦，又来了。”"
    ],
    keywords: ["随机", "波动", "意外很多", "习以为常"],
    systemComment: "检测到异常。经核实：属于正常发挥。",
    image: "./assets/personality/bug.webp",
    special: false
  },

  "LOW BATTERY": {
    code: "LOW BATTERY",
    name: "暂停营业",
    tagline: "人在，电不多了。",
    description: [
      "你最近不是不想动，主要是真的没什么电。该做的事情你可能还在做，该出现的时候你也勉强出现，但整个人的运行状态明显进入省电模式。能坐着绝不站着，能晚点做绝不现在做，能休息五分钟就绝不只休息四分钟。",
      "这不是消失，也不是摆烂。只是你的系统正在非常认真地请求充电。"
    ],
    keywords: ["低能量", "休息", "疲惫", "省电模式"],
    systemComment: "当前电量过低。建议停止假装自己还有 80%。",
    image: "./assets/personality/low_battery.webp",
    special: false
  },

  "RUN": {
    code: "RUN",
    name: "能跑就行",
    tagline: "没有惊天动地，但至少没报错。",
    description: [
      "你的状态没有特别极端的地方。没忙到爆炸，也没彻底躺平；没有突然起飞，也没有原地崩溃。整体而言，你最近处于一种非常朴素但可靠的状态——能吃、能睡、能做事，偶尔摸鱼，偶尔认真。",
      "对于程序来说，这已经是一种难得的美德。别问为什么能跑。能跑就别动。"
    ],
    keywords: ["平稳", "正常运行", "佛系", "凑合能用"],
    systemComment: "Build succeeded. 谁都别碰。",
    image: "./assets/personality/run.webp",
    special: false
  },

  "NO DATA": {
    code: "NO DATA",
    name: "你倒是记啊",
    tagline: "系统准备分析半天，结果你什么都没留。",
    description: [
      "你选择了一段时间，然后非常期待系统告诉你最近是什么状态。系统也很期待。",
      "随后它打开记录一看——没几条。",
      "别人是不知道自己这段时间怎么过的，你比较彻底：连证据都没留下。记录按钮离你并不远，但你显然认为“以后再记”也是一种生活方式。",
      "这不是人格。这是系统在催你干活。"
    ],
    keywords: ["懒得记录", "数据不足", "一片空白", "下次一定"],
    systemComment: "分析失败。原因：用户甚至懒得提供素材。",
    image: "./assets/personality/no_data.webp",
    special: true
  }
}

export function getPersonality(code) {
  return PERSONALITIES[code] || null
}
