const DATABASE_NAME =
  "bugti_web_images_v1"

const STORE_NAME =
  "images"


function openDatabase() {
  return new Promise(
    (resolve, reject) => {
      if (!window.indexedDB) {
        reject(
          new Error(
            "IndexedDB unavailable"
          )
        )
        return
      }

      const request =
        window.indexedDB.open(
          DATABASE_NAME,
          1
        )

      request.onupgradeneeded = () => {
        const database =
          request.result

        if (
          !database.objectStoreNames
            .contains(STORE_NAME)
        ) {
          database.createObjectStore(
            STORE_NAME,
            {
              keyPath: "id"
            }
          )
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(
          request.error ||
          new Error(
            "IndexedDB open failed"
          )
        )
      }
    }
  )
}


function createImageId() {
  if (
    window.crypto &&
    typeof window.crypto
      .randomUUID === "function"
  ) {
    return (
      `image_${window.crypto.randomUUID()}`
    )
  }

  return (
    `image_${Date.now()}_` +
    Math.random()
      .toString(36)
      .slice(2, 10)
  )
}


export async function saveImages(files) {
  const sourceFiles =
    Array.from(files || [])

  if (!sourceFiles.length) {
    return []
  }

  const database =
    await openDatabase()

  return new Promise(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          STORE_NAME,
          "readwrite"
        )

      const store =
        transaction.objectStore(
          STORE_NAME
        )

      const ids =
        sourceFiles.map(file => {
          const id = createImageId()

          store.put({
            id,
            blob: file,
            createdAt:
              new Date().toISOString()
          })

          return id
        })

      transaction.oncomplete = () => {
        database.close()
        resolve(ids)
      }

      transaction.onerror = () => {
        const error =
          transaction.error ||
          new Error(
            "Image save failed"
          )

        database.close()
        reject(error)
      }

      transaction.onabort =
        transaction.onerror
    }
  )
}


export async function getImage(id) {
  if (!id) {
    return null
  }

  const database =
    await openDatabase()

  return new Promise(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          STORE_NAME,
          "readonly"
        )

      const request =
        transaction
          .objectStore(STORE_NAME)
          .get(id)

      request.onsuccess = () => {
        const item = request.result
        database.close()
        resolve(item ? item.blob : null)
      }

      request.onerror = () => {
        const error =
          request.error ||
          new Error(
            "Image read failed"
          )

        database.close()
        reject(error)
      }
    }
  )
}


export async function deleteImage(id) {
  if (!id) {
    return
  }

  const database =
    await openDatabase()

  return new Promise(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          STORE_NAME,
          "readwrite"
        )

      transaction
        .objectStore(STORE_NAME)
        .delete(id)

      transaction.oncomplete = () => {
        database.close()
        resolve()
      }

      transaction.onerror = () => {
        const error =
          transaction.error ||
          new Error(
            "Image delete failed"
          )

        database.close()
        reject(error)
      }

      transaction.onabort =
        transaction.onerror
    }
  )
}
