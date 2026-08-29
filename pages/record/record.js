const recordService =
  require("../../services/records")

const imageStorage =
  require("../../services/storage")


const TAG_LABELS = [
  "学习科研",
  "实习工作",
  "运动",
  "社交",
  "出门",
  "娱乐",
  "摸鱼",
  "宅家",
  "休息"
]


function formatDate(date) {
  const year = date.getFullYear()
  const month =
    String(date.getMonth() + 1).padStart(2, "0")
  const day =
    String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}


function createTags(selectedTags = []) {
  return TAG_LABELS.map(label => ({
    label,
    selected: selectedTags.includes(label)
  }))
}


Page({
  data: {
    date: "",
    isToday: false,
    isEditing: false,

    moods: [
      { value: 1, emoji: "😫", label: "裂开" },
      { value: 2, emoji: "🙁", label: "不妙" },
      { value: 3, emoji: "😐", label: "一般" },
      { value: 4, emoji: "🙂", label: "不错" },
      { value: 5, emoji: "😆", label: "起飞" }
    ],

    energies: [
      { value: 1, emoji: "🪫", label: "没电" },
      { value: 2, emoji: "🔋", label: "还能跑" },
      { value: 3, emoji: "⚡", label: "满格" }
    ],

    busynessOptions: [
      { value: 1, label: "闲" },
      { value: 2, label: "还行" },
      { value: 3, label: "忙炸了" }
    ],

    tags: createTags(),

    selectedMood: null,
    selectedEnergy: null,
    selectedBusyness: null,
    selectedTagCount: 0,

    note: "",

    images: []
  },


  onLoad(options) {
    const today =
      formatDate(new Date())

    const date =
      options.date || today

    this.setData({
      date,
      isToday: date === today
    })

    const existingRecord =
      recordService.getByDate(date)

    if (existingRecord) {
      this.loadExistingRecord(
        existingRecord
      )
    }
  },


  loadExistingRecord(record) {
    const selectedTags =
      record.tags || []

    this.setData({
      isEditing: true,

      selectedMood:
        record.mood,

      selectedEnergy:
        record.energy,

      selectedBusyness:
        record.busyness,

      tags:
        createTags(selectedTags),

      selectedTagCount:
        selectedTags.length,

      note:
        record.note || "",

      images:
        (record.images || []).map(
          path => ({
            path,
            isNew: false
          })
        )
    })
  },


  selectMood(event) {
    const value =
      Number(
        event.currentTarget.dataset.value
      )

    this.setData({
      selectedMood: value
    })
  },


  selectEnergy(event) {
    const value =
      Number(
        event.currentTarget.dataset.value
      )

    this.setData({
      selectedEnergy: value
    })
  },


  selectBusyness(event) {
    const value =
      Number(
        event.currentTarget.dataset.value
      )

    this.setData({
      selectedBusyness: value
    })
  },


  toggleTag(event) {
    const index =
      Number(
        event.currentTarget.dataset.index
      )

    const tags =
      this.data.tags.map(item => ({
        ...item
      }))

    const target =
      tags[index]

    if (
      !target.selected &&
      this.data.selectedTagCount >= 3
    ) {
      wx.showToast({
        title: "最多选 3 个",
        icon: "none"
      })

      return
    }

    target.selected =
      !target.selected

    const selectedTagCount =
      tags.filter(
        item => item.selected
      ).length

    this.setData({
      tags,
      selectedTagCount
    })
  },


  onNoteInput(event) {
    this.setData({
      note: event.detail.value
    })
  },


  chooseImages() {
    const remaining =
      3 - this.data.images.length

    if (remaining <= 0) {
      wx.showToast({
        title: "最多添加 3 张图片",
        icon: "none"
      })

      return
    }

    wx.chooseMedia({
      count: remaining,

      mediaType: ["image"],

      sourceType: [
        "album",
        "camera"
      ],

      sizeType: ["compressed"],

      success: res => {
        const newImages =
          res.tempFiles.map(
            file => ({
              path:
                file.tempFilePath,

              isNew: true
            })
          )

        this.setData({
          images: [
            ...this.data.images,
            ...newImages
          ]
        })
      }
    })
  },


  previewImage(event) {
    const index =
      Number(
        event.currentTarget.dataset.index
      )

    const urls =
      this.data.images.map(
        item => item.path
      )

    wx.previewImage({
      current: urls[index],
      urls
    })
  },


  removeImage(event) {
    const index =
      Number(
        event.currentTarget.dataset.index
      )

    const images =
      this.data.images.slice()

    images.splice(index, 1)

    this.setData({
      images
    })
  },


  getSelectedTags() {
    return this.data.tags
      .filter(
        item => item.selected
      )
      .map(
        item => item.label
      )
  },


  validateForm(selectedTags) {
    if (!this.data.selectedMood) {
      return "先选一下心情"
    }

    if (!this.data.selectedEnergy) {
      return "先选一下电量"
    }

    if (!this.data.selectedBusyness) {
      return "先选一下忙碌度"
    }

    if (selectedTags.length === 0) {
      return "至少选 1 个状态标签"
    }

    return ""
  },


  saveRecord() {
    const selectedTags =
      this.getSelectedTags()

    const errorMessage =
      this.validateForm(
        selectedTags
      )

    if (errorMessage) {
      wx.showToast({
        title: errorMessage,
        icon: "none"
      })

      return
    }


    const oldRecord =
      recordService.getByDate(
        this.data.date
      )

    const newlySavedPaths = []


    try {
      const imagePaths =
        this.data.images.map(
          image => {

            if (!image.isNew) {
              return image.path
            }

            const savedPath =
              imageStorage.persistTempFile(
                image.path
              )

            newlySavedPaths.push(
              savedPath
            )

            return savedPath
          }
        )


      recordService.upsert({
        date:
          this.data.date,

        mood:
          this.data.selectedMood,

        energy:
          this.data.selectedEnergy,

        busyness:
          this.data.selectedBusyness,

        tags:
          selectedTags,

        note:
          this.data.note.trim(),

        images:
          imagePaths
      })


      const oldImages =
        oldRecord &&
        oldRecord.images
          ? oldRecord.images
          : []


      oldImages
        .filter(
          path =>
            !imagePaths.includes(path)
        )
        .forEach(path => {
          imageStorage.removeFile(path)
        })


      this.setData({
        isEditing: true,

        images:
          imagePaths.map(
            path => ({
              path,
              isNew: false
            })
          )
      })


      wx.showToast({
        title: "保存成功",
        icon: "success",
        duration: 800
      })


      setTimeout(() => {
        wx.navigateBack()
      }, 800)

    } catch (error) {

      newlySavedPaths.forEach(
        path => {
          imageStorage.removeFile(path)
        }
      )

      console.error(
        "保存记录失败：",
        error
      )

      wx.showToast({
        title: "保存失败，请重试",
        icon: "none"
      })
    }
  },


  deleteRecord() {
    if (!this.data.isEditing) {
      return
    }


    wx.showModal({
      title:
        "删除这天的记录？",

      content:
        "记录和已经保存的图片都会被删除，删除后无法恢复。",

      confirmText:
        "删除",

      confirmColor:
        "#c44b4b",

      cancelText:
        "取消",


      success: res => {
        if (!res.confirm) {
          return
        }


        const existingRecord =
          recordService.getByDate(
            this.data.date
          )


        if (!existingRecord) {
          wx.showToast({
            title:
              "这条记录已经不存在",

            icon:
              "none"
          })

          return
        }


        try {
          const images =
            existingRecord.images || []


          recordService.remove(
            this.data.date
          )


          images.forEach(path => {
            imageStorage.removeFile(
              path
            )
          })


          wx.showToast({
            title:
              "已删除",

            icon:
              "success",

            duration:
              700
          })


          setTimeout(() => {
            wx.navigateBack()
          }, 700)

        } catch (error) {

          console.error(
            "删除记录失败：",
            error
          )

          wx.showToast({
            title:
              "删除失败，请重试",

            icon:
              "none"
          })
        }
      }
    })
  }
})