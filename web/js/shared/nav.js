import { getTodayString } from "./date.js"

const current = document.body.dataset.nav || ""
const nav = document.createElement("nav")
nav.className = "bugti-nav"
nav.setAttribute("aria-label", "主导航")

const items = [
  { id: "home", code: "HOME", label: "首页", href: "./index.html" },
  { id: "history", code: "LOG", label: "记录", href: "./history.html" },
  { id: "add", code: "+", label: "记录今天", href: `./record.html?date=${getTodayString()}` },
  { id: "analyze", code: "BUG", label: "检测", href: "./analyze.html" },
  { id: "pet", code: "PET", label: "小屋", href: "./pet-home.html" }
]

items.forEach(item => {
  const link = document.createElement("a")
  link.href = item.href
  link.className = `bugti-nav-item${item.id === current ? " is-current" : ""}${item.id === "add" ? " bugti-nav-add" : ""}`
  if (item.id === "add") link.setAttribute("aria-label", item.label)
  link.innerHTML = item.id === "add"
    ? '<span class="bugti-nav-plus" aria-hidden="true">＋</span>'
    : `<span class="bugti-nav-code">${item.code}</span><span class="bugti-nav-label">${item.label}</span>`
  nav.append(link)
})

document.body.append(nav)
