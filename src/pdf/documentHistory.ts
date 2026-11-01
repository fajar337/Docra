import type { EditorObject } from '../types/editor'

const DATABASE_NAME = 'docra-document-history'
const STORE_NAME = 'documents'
const MAX_ENTRIES = 20

export interface SavedDocument {
  id: string
  fileName: string
  savedAt: number
  originalBytes: Uint8Array
  objects: EditorObject[]
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveDocumentHistory(entry: SavedDocument): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(entry)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    const entries = await listDocumentHistory()
    const expired = entries.slice(MAX_ENTRIES)
    if (expired.length) await Promise.all(expired.map(({ id }) => deleteDocumentHistory(id)))
    window.dispatchEvent(new Event('docra-history-change'))
  } finally {
    database.close()
  }
}

export async function listDocumentHistory(): Promise<SavedDocument[]> {
  const database = await openDatabase()
  try {
    const entries = await new Promise<SavedDocument[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(request.result as SavedDocument[])
      request.onerror = () => reject(request.error)
    })
    return entries.sort((first, second) => second.savedAt - first.savedAt)
  } finally {
    database.close()
  }
}

export async function deleteDocumentHistory(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}
