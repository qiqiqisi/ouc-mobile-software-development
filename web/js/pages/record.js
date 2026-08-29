import * as recordService from
  "../services/records.js"

import {
  saveImages,
  getImage,
  deleteImage
} from "../services/image-store.js"

import {
  getTodayString
} from "../shared/date.js"

import {
  getQuery,
  goBack,
  showToast
} from "../shared/ui.js"


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

const moods = [
  { value: 1, emoji: "😫", label: "裂开" },
  { value: 2, emoji: "🙁", label: "不妙" },
  { value: 3, emoji: "😐", label: "一般" },
  { value: 4, emoji: "🙂", label: "不错" },
  { value: 5, emoji: "😆", label: "起飞" }
]

const energies = [
  { value: 1, emoji: "🪫", label: "没电" },
  { value: 2, emoji: "🔋", label: "还能跑" },
  { value: 3, emoji: "⚡", label: "满格" }
]

const busynessOptions = [
  { value: 1, label: "闲" },
  { value: 2, label: "还行" },
  { value: 3, label: "忙炸了" }
]


const state = {
  date: "",
  isEditing: false,
  selectedMood: null,
  selectedEnergy: null,
  selectedBusyness: null,
  selectedTags: [],
  images: [],
  oldImageIds: []
}


function renderOptionGroup(
  container,
  options,
  selectedValue,
  onSelect
) {
  container.replaceChildren()

  options.forEach(option => {
    const button =
      document.createElement(
        "button"
      )

    button.type = "button"
    button.className =
      "option-button"

    if (selectedValue === option.value) {
      button.classList.add(
        "is-selected"
      )
    }

    if (option.emoji) {
      const emoji =
        document.createElement("span")

      emoji.className =
        "option-emoji"
      emoji.textContent =
        option.emoji
      button.appendChild(emoji)
    }

    const label =
      document.createElement("span")

    label.className =
      "option-label"
    label.textContent =
      option.label

    button.appendChild(label)
    button.addEventListener(
      "click",
      () => onSelect(option.value)
    )

    container.appendChild(button)
  })
}


function renderSelections() {
  renderOptionGroup(
    document.querySelector(
      "#mood-list"
    ),
    moods,
    state.selectedMood,
    value => {
      state.selectedMood = value
      renderSelections()
    }
  )

  renderOptionGroup(
    document.querySelector(
      "#energy-list"
    ),
    energies,
    state.selectedEnergy,
    value => {
      state.selectedEnergy = value
      renderSelections()
    }
  )

  renderOptionGroup(
    document.querySelector(
      "#busyness-list"
    ),
    busynessOptions,
    state.selectedBusyness,
    value => {
      state.selectedBusyness = value
      renderSelections()
    }
  )

  const tagList =
    document.querySelector(
      "#tag-list"
    )

  tagList.replaceChildren()

  TAG_LABELS.forEach(label => {
    const button =
      document.createElement(
        "button"
      )

    button.type = "button"
    button.className = "tag-item"
    button.textContent = label

    if (
      state.selectedTags
        .includes(label)
    ) {
      button.classList.add(
        "is-selected"
      )
    }

    button.addEventListener(
      "click",
      () => {
        const selected =
          state.selectedTags
            .includes(label)

        if (
          !selected &&
          state.selectedTags.length >= 3
        ) {
          showToast("最多选 3 个")
          return
        }

        state.selectedTags =
          selected
            ? state.selectedTags.filter(
              item => item !== label
            )
            : [
              ...state.selectedTags,
              label
            ]

        renderSelections()
      }
    )

    tagList.appendChild(button)
  })

  document.querySelector(
    "#tag-count"
  ).textContent =
    `${state.selectedTags.length} / 3`
}


function removeImageAt(index) {
  const [removed] =
    state.images.splice(index, 1)

  if (
    removed &&
    removed.isNew &&
    removed.url
  ) {
    URL.revokeObjectURL(
      removed.url
    )
  }

  renderImages()
}


function renderImages() {
  const grid =
    document.querySelector(
      "#image-grid"
    )

  grid.replaceChildren()

  state.images.forEach(
    (image, index) => {
      const item =
        document.createElement("div")

      item.className = "image-item"

      const preview =
        document.createElement("img")

      preview.className =
        "record-image"
      preview.src = image.url
      preview.alt =
        `记录图片 ${index + 1}`

      preview.addEventListener(
        "click",
        () => {
          window.open(
            image.url,
            "_blank",
            "noopener"
          )
        }
      )

      const removeButton =
        document.createElement(
          "button"
        )

      removeButton.type = "button"
      removeButton.className =
        "remove-image"
      removeButton.textContent = "×"
      removeButton.setAttribute(
        "aria-label",
        "移除图片"
      )
      removeButton.addEventListener(
        "click",
        () => removeImageAt(index)
      )

      item.append(
        preview,
        removeButton
      )
      grid.appendChild(item)
    }
  )

  document.querySelector(
    "#image-count"
  ).textContent =
    `可选 · ${state.images.length} / 3`

  document.querySelector(
    "#image-picker-label"
  ).classList.toggle(
    "is-hidden",
    state.images.length >= 3
  )
}


async function loadExistingImages(ids) {
  const loaded = []

  for (const id of ids) {
    try {
      const blob =
        await getImage(id)

      if (blob) {
        loaded.push({
          id,
          file: null,
          url:
            URL.createObjectURL(blob),
          isNew: false
        })
      }
    } catch (error) {
      console.warn(
        "读取记录图片失败：",
        error
      )
    }
  }

  state.images = loaded
  renderImages()
}


function validateForm() {
  if (!state.selectedMood) {
    return "先选一下心情"
  }

  if (!state.selectedEnergy) {
    return "先选一下电量"
  }

  if (!state.selectedBusyness) {
    return "先选一下忙碌度"
  }

  if (!state.selectedTags.length) {
    return "至少选 1 个状态标签"
  }

  return ""
}


async function saveRecord(event) {
  event.preventDefault()

  const errorMessage =
    validateForm()

  if (errorMessage) {
    showToast(errorMessage)
    return
  }

  const savedNewIds = []
  let imageSaveFailed = false

  for (
    const image of
    state.images.filter(
      item => item.isNew
    )
  ) {
    try {
      const [id] =
        await saveImages([
          image.file
        ])

      savedNewIds.push(id)
      image.id = id
      image.isNew = false
    } catch (error) {
      imageSaveFailed = true
      console.error(
        "图片保存失败：",
        error
      )
    }
  }

  const imageIds =
    state.images
      .map(image => image.id)
      .filter(Boolean)

  try {
    recordService.upsert({
      date: state.date,
      mood: state.selectedMood,
      energy: state.selectedEnergy,
      busyness:
        state.selectedBusyness,
      tags:
        state.selectedTags.slice(),
      note:
        document.querySelector(
          "#note"
        ).value.trim(),
      images: imageIds
    })
  } catch (error) {
    await Promise.allSettled(
      savedNewIds.map(deleteImage)
    )

    console.error(
      "保存记录失败：",
      error
    )
    showToast("保存失败，请重试")
    return
  }

  await Promise.allSettled(
    state.oldImageIds
      .filter(
        id => !imageIds.includes(id)
      )
      .map(deleteImage)
  )

  state.oldImageIds =
    imageIds.slice()
  state.isEditing = true

  showToast(
    imageSaveFailed
      ? "图片保存失败，其他记录已保存"
      : "保存成功"
  )

  window.setTimeout(
    () => goBack(),
    imageSaveFailed ? 1500 : 800
  )
}


async function deleteRecord() {
  if (!state.isEditing) {
    return
  }

  const confirmed =
    window.confirm(
      "删除这天的记录？\n记录和已经保存的图片都会被删除，删除后无法恢复。"
    )

  if (!confirmed) {
    return
  }

  const existingRecord =
    recordService.getByDate(
      state.date
    )

  if (!existingRecord) {
    showToast("这条记录已经不存在")
    return
  }

  try {
    recordService.removeRecord(
      state.date
    )

    await Promise.allSettled(
      (existingRecord.images || [])
        .map(deleteImage)
    )

    showToast("已删除")

    window.setTimeout(
      () => goBack(),
      700
    )
  } catch (error) {
    console.error(
      "删除记录失败：",
      error
    )
    showToast("删除失败，请重试")
  }
}


async function initialize() {
  const today =
    getTodayString()

  const queryDate =
    getQuery().get("date")

  const validDate =
    /^\d{4}-\d{2}-\d{2}$/
      .test(queryDate || "") &&
    queryDate <= today

  state.date =
    validDate
      ? queryDate
      : today

  if (queryDate && !validDate) {
    showToast("不能记录未来日期")
  }

  const isToday =
    state.date === today

  document.querySelector(
    "#record-eyebrow"
  ).textContent =
    isToday ? "TODAY" : "BACKFILL"

  document.querySelector(
    "#record-title"
  ).textContent =
    isToday
      ? "今天运行得怎么样？"
      : "那天运行得怎么样？"

  document.querySelector(
    "#record-date"
  ).textContent = state.date

  const existingRecord =
    recordService.getByDate(
      state.date
    )

  if (existingRecord) {
    state.isEditing = true
    state.selectedMood =
      existingRecord.mood
    state.selectedEnergy =
      existingRecord.energy
    state.selectedBusyness =
      existingRecord.busyness
    state.selectedTags =
      Array.isArray(
        existingRecord.tags
      )
        ? existingRecord.tags.slice()
        : []
    state.oldImageIds =
      Array.isArray(
        existingRecord.images
      )
        ? existingRecord.images.slice()
        : []

    document.querySelector(
      "#note"
    ).value =
      existingRecord.note || ""

    document.querySelector(
      "#save-button"
    ).textContent = "更新记录"

    document.querySelector(
      "#delete-area"
    ).classList.remove(
      "is-hidden"
    )

    await loadExistingImages(
      state.oldImageIds
    )
  }

  renderSelections()
  renderImages()

  document.querySelector(
    ".page-back"
  ).addEventListener(
    "click",
    () => goBack()
  )

  document.querySelector(
    "#record-form"
  ).addEventListener(
    "submit",
    saveRecord
  )

  document.querySelector(
    "#delete-button"
  ).addEventListener(
    "click",
    deleteRecord
  )

  document.querySelector(
    "#image-picker"
  ).addEventListener(
    "change",
    event => {
      const remaining =
        3 - state.images.length

      const files =
        Array.from(
          event.target.files || []
        ).slice(0, remaining)

      files.forEach(file => {
        state.images.push({
          id: null,
          file,
          url:
            URL.createObjectURL(file),
          isNew: true
        })
      })

      event.target.value = ""
      renderImages()
    }
  )
}


initialize().catch(error => {
  console.error(
    "记录页初始化失败：",
    error
  )
  showToast("页面加载失败，请重试")
})


window.addEventListener(
  "beforeunload",
  () => {
    state.images.forEach(image => {
      if (image.url) {
        URL.revokeObjectURL(image.url)
      }
    })
  }
)
