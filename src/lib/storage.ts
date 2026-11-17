import type { UsageRecord } from '../types'

/** 一次导入 = 一个批次 */
export interface ImportBatch {
  id: string
  name: string
  createdAt: number
  count: number
  records: UsageRecord[]
}

const DB_NAME = 'tokenscope-db'
const STORE = 'batches'
const VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 读取全部批次（按创建时间倒序） */
export async function loadBatches(): Promise<ImportBatch[]> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve((req.result as ImportBatch[]).sort((a, b) => b.createdAt - a.createdAt))
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  } catch { return [] }
}

/** 保存一个批次 */
export async function saveBatch(batch: ImportBatch): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(batch)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** 删除一个批次 */
export async function deleteBatch(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** 重命名一个批次 */
export async function renameBatch(id: string, name: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.get(id)
    req.onsuccess = () => {
      const batch = req.result as ImportBatch | undefined
      if (batch) store.put({ ...batch, name })
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** 清空全部批次 */
export async function clearBatches(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export function newBatchId(): string {
  return `b${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
