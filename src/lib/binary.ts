import initSqlJs from 'sql.js'
import * as fzstd from 'fzstd'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { UsageRecord } from '../types'
import { parseJSONLLine } from './parsers'

/** 判断二进制是否 zstd 帧（magic 0x28 B5 2F FD） */
export function isZstd(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x28 && buf[1] === 0xb5 && buf[2] === 0x2f && buf[3] === 0xfd
}

/** 判断二进制是否 SQLite（magic "SQLite format 3\0"） */
export function isSQLite(buf: Uint8Array): boolean {
  const s = 'SQLite format 3\0'
  if (buf.length < s.length) return false
  for (let i = 0; i < s.length; i++) if (buf[i] !== s.charCodeAt(i)) return false
  return true
}

/**
 * 解压 zstd（支持多帧串联，如 DeepSeek Harness 的 session.jsonl.zstd）。
 * fzstd.decompress 遇到多帧时只解第一帧，这里逐个定位帧边界分别解压再拼接。
 */
export function decompressZstd(buf: Uint8Array): string {
  const MAGIC = [0x28, 0xb5, 0x2f, 0xfd]
  const isMagic = (i: number) => MAGIC.every((b, j) => buf[i + j] === b)
  const parts: string[] = []
  let i = 0
  while (i < buf.length && isMagic(i)) {
    // 尝试从当前帧起点解压，fzstd 会消费完整的一帧
    const slice = buf.subarray(i)
    try {
      const out = fzstd.decompress(slice)
      parts.push(new TextDecoder().decode(out))
      // 推算已消费长度：从 slice 里找到下一帧 magic 的位置
      // fzstd 未提供 consumed，改用逐字节试探下一 magic
      let next = -1
      for (let k = i + 4; k < buf.length - 4; k++) {
        if (isMagic(k)) { next = k; break }
      }
      if (next < 0) break
      i = next
    } catch {
      // 整段解压失败，尝试单帧（首个 magic 之后到下一个 magic）
      let next = -1
      for (let k = i + 4; k < buf.length - 4; k++) {
        if (isMagic(k)) { next = k; break }
      }
      const end = next < 0 ? buf.length : next
      try {
        const out = fzstd.decompress(buf.subarray(i, end))
        parts.push(new TextDecoder().decode(out))
      } catch { /* 跳过损坏帧 */ }
      if (next < 0) break
      i = next
    }
  }
  if (!parts.length) {
    // 兜底：整体当一帧
    try { return new TextDecoder().decode(fzstd.decompress(buf)) } catch { return '' }
  }
  return parts.join('')
}

/** 解析 zstd 压缩的会话日志 */
export function parseZstdLog(buf: Uint8Array): UsageRecord[] {
  const text = decompressZstd(buf)
  if (!text) return []
  const out: UsageRecord[] = []
  for (const line of text.split(/\r?\n/)) {
    const r = parseJSONLLine(line)
    if (r) out.push(r)
  }
  return out
}

/**
 * 探索式解析 SQLite 数据库：遍历所有表所有单元格，凡是文本里含 token/usage
 * 的 JSON 对象，尝试用 parseJSONLLine 提取。不依赖任何工具的固定 schema。
 */
export async function parseSQLiteDB(buf: Uint8Array): Promise<UsageRecord[]> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const db = new SQL.Database(buf)
  const out: UsageRecord[] = []
  const seen = new Set<string>()
  try {
    // 取所有表名
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    const names: string[] = []
    if (tables.length && tables[0].values) {
      for (const row of tables[0].values) if (typeof row[0] === 'string') names.push(row[0])
    }
    for (const name of names) {
      let res: any[]
      try { res = db.exec(`SELECT * FROM "${name.replace(/"/g, '""')}"`) } catch { continue }
      for (const table of res) {
        for (const row of table.values) {
          for (const cell of row) {
            // 单元格可能是 JSON 文本或二进制
            let text = ''
            if (typeof cell === 'string') text = cell
            else if (cell instanceof Uint8Array) {
              try { text = new TextDecoder().decode(cell) } catch { continue }
            } else continue
            if (text.length < 8) continue
            // 快速筛选：必须含 token/usage 相关词
            if (!/token|usage|prompt|completion|input|output/i.test(text)) continue
            // 行内 JSON：尝试整体解析
            const candidates: string[] = [text]
            // 若是 JSON 数组/对象里嵌消息，尝试逐条
            try {
              const o = JSON.parse(text)
              const arr = Array.isArray(o) ? o
                : (o.messages || o.items || o.data || o.records || [])
              if (Array.isArray(arr)) {
                for (const it of arr) candidates.push(JSON.stringify(it))
              }
            } catch { /* 非 JSON 文本，按行再试 */ candidates.push(...text.split(/\r?\n/)) }
            for (const c of candidates) {
              if (seen.has(c)) continue
              seen.add(c)
              const r = parseJSONLLine(c)
              if (r) out.push(r)
            }
          }
        }
      }
    }
  } finally {
    try { db.close() } catch { /* ignore */ }
  }
  return out
}
