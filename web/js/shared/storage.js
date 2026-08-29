export function getJSON(key, fallback) {
  try {
    const rawValue =
      window.localStorage.getItem(key)

    if (rawValue === null) {
      return fallback
    }

    return JSON.parse(rawValue)
  } catch (error) {
    console.warn(
      `读取本地数据失败：${key}`,
      error
    )

    return fallback
  }
}


export function setJSON(key, value) {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value)
    )

    return true
  } catch (error) {
    console.error(
      `保存本地数据失败：${key}`,
      error
    )

    return false
  }
}


export function remove(key) {
  try {
    window.localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(
      `删除本地数据失败：${key}`,
      error
    )

    return false
  }
}
