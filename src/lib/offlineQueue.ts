const DB_NAME = 'trckr-offline'
const STORE = 'queue'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface QueuedOp {
  type: 'stop_open' | 'insert_entry'
  payload: Record<string, unknown>
  timestamp: string
}

export async function enqueue(op: QueuedOp) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add(op)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function drainQueue(): Promise<Array<{ key: IDBValidKey; op: QueuedOp }>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const items: Array<{ key: IDBValidKey; op: QueuedOp }> = []
    const cursor = store.openCursor()
    cursor.onsuccess = (e) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (c) {
        items.push({ key: c.key, op: c.value as QueuedOp })
        c.continue()
      } else {
        resolve(items)
      }
    }
    cursor.onerror = () => reject(cursor.error)
  })
}

export async function removeFromQueue(key: IDBValidKey) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
