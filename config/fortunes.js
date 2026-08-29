const CARD_BACK_IMAGE =
  "/assets/fortune/card_back.webp"


const NORMAL_FORTUNES = [
  {
    id: "cow_come",
    title: "牛来",
    image:
      "/assets/fortune/cow_come.webp",
    variants: [
      {
        yi: "该争取的直接开口",
        ji: "好运到门口还装客气",
        comment:
          "今天不是小吉，是牛亲自把门顶开了。能接住的机会就接住，别跟运气客气。"
      },
      {
        yi: "把想做的事往前推一步",
        ji: "临门一脚突然开始谦虚",
        comment:
          "今日运势有点横：路不一定自己开，但牛会替你撞一下。"
      },
      {
        yi: "顺手试试那个一直想做的",
        ji: "事情还没开始就先唱衰",
        comment:
          "今天的好东西可能不敲门。它直接进来。"
      }
    ],
    special: false
  },

  {
    id: "wolf_dog",
    title: "狼想开了就是狗",
    image:
      "/assets/fortune/wolf_dog.webp",
    variants: [
      {
        yi: "把破事降级处理",
        ji: "给屁大点事上价值",
        comment:
          "狼想开了就是狗，你想开了就是省电模式。今天没必要每件事都上强度。"
      },
      {
        yi: "有些事就算了",
        ji: "睡前复盘一句话十遍",
        comment:
          "事情没有解决，但你突然不想理它了。效果居然差不多。"
      },
      {
        yi: "对自己宽松一点",
        ji: "非要给所有事情找意义",
        comment:
          "今天允许你从“我要想明白”切换成“爱咋咋地”。"
      }
    ],
    special: false
  },

  {
    id: "grass_stage",
    title: "草台班子正常营业",
    image:
      "/assets/fortune/grass_stage.webp",
    variants: [
      {
        yi: "先上场再补妆",
        ji: "因为不完美就不上场",
        comment:
          "配置一般，气势先到位。今天不一定专业，但可以先把场子镇住。"
      },
      {
        yi: "先做出第一版",
        ji: "把准备工作做成主体工程",
        comment:
          "草台班子也是班子。能开张就别先拆自己的台。"
      },
      {
        yi: "先唬住自己",
        ji: "开场前主动自曝短板",
        comment:
          "像不像狮子先不重要，至少今天别自己先“喵”出来。"
      }
    ],
    special: false
  },

  {
    id: "love_self",
    title: "爱你老己",
    image:
      "/assets/fortune/love_self.webp",
    variants: [
      {
        yi: "先偏袒自己一次",
        ji: "一天到晚反思自己",
        comment:
          "老己，我受你一靠子。文化水平不高，感情很真。"
      },
      {
        yi: "给自己发个内部表扬",
        ji: "别人皱眉你就自动反思",
        comment:
          "今日最佳员工评选结束。经过本人慎重投票，获奖者还是本人。"
      },
      {
        yi: "先把自己哄明白",
        ji: "对全世界当全天候客服",
        comment:
          "别人爱不爱你先放一边，老己这边建议续费。"
      }
    ],
    special: false
  },

  {
    id: "bold_kangaroo",
    title: "胆子肥嘟嘟",
    image:
      "/assets/fortune/bold_kangaroo.webp",
    variants: [
      {
        yi: "试试那个一直没敢试的",
        ji: "把胆大升级成没谱",
        comment:
          "你胆子今天确实肥嘟嘟的。可以莽一点，但别莽到需要写情况说明。"
      },
      {
        yi: "主动开一次口",
        ji: "勇气上头以后不看路",
        comment:
          "系统检测到胆量模块正在横向发育。"
      },
      {
        yi: "趁胆子还在赶紧行动",
        ji: "把“我试试”变成“我作死”",
        comment:
          "胆子是肥了，脑子记得跟上。"
      }
    ],
    special: false
  },

  {
    id: "doubao",
    title: "豆包型人格",
    image:
      "/assets/fortune/doubao.webp",
    variants: [
      {
        yi: "先把气氛稳住",
        ji: "拿“哈哈哈”当万能补丁",
        comment:
          "今日豆包型人格：啥事先嘻嘻哈哈糊弄一下，被发现就嬉皮笑脸道歉。认错速度很快，改不改另说。优点是情绪稳定，缺点是事情可能也稳定地没做完。"
      },
      {
        yi: "遇事先别把自己吓死",
        ji: "把“差不多”做成“差很多”",
        comment:
          "今天主打豆包式生存：先响应，再糊弄；被抓包就诚恳两秒，然后继续保持良好心态。"
      },
      {
        yi: "先交一个能跑的版本",
        ji: "被发现以后还嘴硬",
        comment:
          "豆包型人格的精髓不是不会错，是错了还能笑着说“好的好的”，然后继续活蹦乱跳。"
      }
    ],
    special: false
  }
]


export const SPECIAL_FORTUNE = {
  id: "draw_again",
  title: "这把不算",
  ...
  variants: [
    {
      yi: "继续遍历",
      ji: "嘴上最后一次，手上继续抽",
      comment:
        "六种普通运势都被你翻过了。现在继续抽不叫算运势，叫遍历；“再来一次”不是按钮，是 while(true)。"
    }
  ]
}


function getFortuneById(id) {
  const normalFortune =
    NORMAL_FORTUNES.find(
      fortune =>
        fortune.id === id
    )

  if (normalFortune) {
    return normalFortune
  }

  return id === SPECIAL_FORTUNE.id
    ? SPECIAL_FORTUNE
    : null
}


function getFortuneDisplay(
  id,
  variantIndex
) {
  const fortune =
    getFortuneById(id)

  if (
    !fortune ||
    !Number.isInteger(
      variantIndex
    ) ||
    variantIndex < 0 ||
    variantIndex >=
      fortune.variants.length
  ) {
    return null
  }

  const variant =
    fortune.variants[
      variantIndex
    ]

  return {
    id: fortune.id,
    title: fortune.title,
    image: fortune.image,
    yi: variant.yi,
    ji: variant.ji,
    comment: variant.comment,
    variantIndex,
    special: fortune.special
  }
}


module.exports = {
  NORMAL_FORTUNES,
  SPECIAL_FORTUNE,
  CARD_BACK_IMAGE,
  getFortuneById,
  getFortuneDisplay
}
