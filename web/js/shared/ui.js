let toastTimer = null


export function showToast(text) {
  let toast =
    document.querySelector(
      ".web-toast"
    )

  if (!toast) {
    toast =
      document.createElement("div")

    toast.className =
      "web-toast"

    document.body.appendChild(
      toast
    )
  }

  toast.textContent = text
  toast.classList.add("is-visible")

  window.clearTimeout(toastTimer)

  toastTimer =
    window.setTimeout(() => {
      toast.classList.remove(
        "is-visible"
      )
    }, 1800)
}


export function goBack(
  fallback = "./index.html"
) {
  if (window.history.length > 1) {
    window.history.back()
    return
  }

  window.location.href = fallback
}


export function getQuery() {
  return new URLSearchParams(
    window.location.search
  )
}


async function copyText(text) {
  if (
    navigator.clipboard &&
    typeof navigator.clipboard
      .writeText === "function"
  ) {
    try {
      await navigator.clipboard
        .writeText(text)

      return true
    } catch (error) {
      console.warn(
        "Clipboard API 不可用，尝试传统复制。",
        error
      )
    }
  }

  const textarea =
    document.createElement(
      "textarea"
    )

  textarea.value = text
  textarea.setAttribute(
    "readonly",
    ""
  )
  textarea.className =
    "copy-helper"

  document.body.appendChild(
    textarea
  )

  textarea.select()

  let copied = false

  try {
    copied =
      document.execCommand("copy")
  } catch (error) {
    console.error(
      "传统复制失败：",
      error
    )
  }

  textarea.remove()

  return copied
}


export async function shareOrCopy({
  title,
  text,
  url
}) {
  if (
    typeof navigator.share ===
    "function"
  ) {
    try {
      await navigator.share({
        title,
        text,
        url
      })

      return "shared"
    } catch (error) {
      if (error.name === "AbortError") {
        return "cancelled"
      }

      console.warn(
        "系统分享不可用，改为复制链接。",
        error
      )
    }
  }

  const copied =
    await copyText(url)

  showToast(
    copied
      ? "分享链接已复制"
      : "复制失败，请手动复制地址栏链接"
  )

  return copied
    ? "copied"
    : "failed"
}
