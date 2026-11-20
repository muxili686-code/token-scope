import type { UsageRecord, DataSource } from '../types'
import { extractSessionTitles, attachSessionTitles } from './sessionTitles'

let seq = 0
const uid = () => `r${Date.now().toString(36)}-${(seq++).toString(36)}`

/** 从任意对象里找 token 数字（兼容多种字段名） */
function pickInt(obj: any, keys: string[]): number {
  if (!obj || typeof obj !== 'object') return 0
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v))
    if (typeof v === 'string' && /^\d+$/.test(v)) return Math.max(0, parseInt(v))
  }
  return 0
}

/** 递归查找嵌套对象里的某个字段（如 prompt_tokens_details.cached_tokens） */
function pickDeep(obj: any, path: string[]): number {
  let cur = obj
  for (const p of path) {
    if (!cur || typeof cur !== 'object') return 0
    cur = cur[p]
  }
  return typeof cur === 'number' && isFinite(cur) ? Math.max(0, Math.round(cur)) : 0
}

/** 推断厂商 */
export function inferVendor(model: string): string {
  const m = (model || '').toLowerCase()
  if (m.includes('claude') || m.includes('fable')) return 'Anthropic'
  if (/gemini|google|^gemma/i.test(m)) return 'Google Gemini'
  if (/gpt-|o1|o3|o4|chatgpt|^gpt/.test(m)) return 'OpenAI'
  if (/doubao|seed|豆包/.test(m)) return '字节/豆包'
  if (m.includes('deepseek')) return 'DeepSeek'
  if (/glm|智谱|chatglm/.test(m)) return '智谱GLM'
  if (/kimi|moonshot/.test(m)) return 'Kimi'
  if (/qwen|通义/.test(m)) return '阿里通义'
  if (/minimax/.test(m)) return 'MiniMax'
  if (/mimo/.test(m)) return '小米 MiMo'
  if (/step-\d|stepfun|阶跃/.test(m)) return '阶跃星辰'
  if (/hunyuan|^hy\b|^hy-|hy4|hy3/.test(m)) return '腾讯混元'
  return '其他'
}

/**
 * 从一行日志里抽取 usage 对象。
 * 支持位置（按优先级）：
 *  - providerData.rawUsage  ← WorkBuddy / Coding Copilot 真实格式
 *  - providerData.usage     ← 同上，标准汇总
 *  - message.usage          ← Claude Code / Anthropic
 *  - usage / response.usage ← OpenAI 直连
 *  - 顶层本身就是 usage（含 prompt_tokens 等）
 */
function locateUsage(o: any): { usage: any; raw: any } | null {
  if (!o || typeof o !== 'object') return null
  const pd = o.providerData || {}
  // 事件流包装：Codex / DeepSeek Harness 把真实 payload 放在 data 里
  const d = o.data && typeof o.data === 'object' ? o.data : {}
  const candidates = [
    pd.rawUsage,
    pd.usage,
    o.usage,
    o.message?.usage,
    o.response?.usage,
    o.data?.usage,
    d.usage,
    d.info?.last_token_usage,     // Codex CLI token_count 事件
    o.token_counts,               // Hermes sessions export
    d.token_counts,
    o.tokens,                     // 部分工具直接用 tokens:{input,output}
    d.tokens,
    o.usageMetadata,              // Gemini CLI usageMetadata:{promptTokenCount,...}
    d.usageMetadata,
  ]
  for (const u of candidates) {
    if (u && typeof u === 'object' && hasToken(u)) return { usage: u, raw: pd.rawUsage || u }
  }
  // 顶层对象本身携带 token 字段
  if (hasToken(o)) return { usage: o, raw: o }
  return null
}

function hasToken(u: any): boolean {
  const inTok = pickInt(u, ['input_tokens', 'prompt_tokens', 'inputTokens', 'promptTokens', 'input', 'input_tokens_count', 'n_input_tokens'])
    + pickDeep(u, ['prompt_tokens_details', 'cached_tokens'])
    + pickInt(u, ['prompt_cache_hit_tokens'])
  const outTok = pickInt(u, ['output_tokens', 'completion_tokens', 'outputTokens', 'completionTokens', 'output', 'output_tokens_count', 'candidatesTokenCount', 'n_output_tokens'])
  // token_counts: {input,output} / tokens:{in,out} / usageMetadata 已在上面覆盖
  // DeepSeek Harness 事件可能只有 total_tokens
  const totalTok = pickInt(u, ['total_tokens', 'totalTokens'])
  return inTok + outTok + totalTok > 0
}

/**
 * 解析一行 JSON（WorkBuddy / Claude Code / OpenAI / 账单导出）
 * 返回统一 UsageRecord；无有效用量返回 null。
 */
export function parseJSONLLine(line: string): UsageRecord | null {
  if (!line.trim()) return null
  let o: any
  try { o = JSON.parse(line) } catch { return null }

  const found = locateUsage(o)
  if (!found) return null
  const { usage, raw } = found

  // ---- 输入侧 ----
  // 各厂商口径不同：
  //  Anthropic: input_tokens 为「未缓存输入」；cache_read/cache_creation 另计
  //  OpenAI/WorkBuddy(rawUsage): prompt_tokens 常为「含缓存命中的总输入」，
  //    此时非缓存输入 = prompt_tokens - cache_read - cache_creation
  const promptRaw = pickInt(usage, ['input_tokens', 'prompt_tokens', 'inputTokens', 'promptTokens', 'input', 'input_tokens_count', 'promptTokenCount', 'n_input_tokens'])
    || pickInt(o?.usageMetadata, ['promptTokenCount'])
  let cacheRead = pickInt(raw, ['cache_read_input_tokens', 'prompt_cache_hit_tokens', 'cacheHit', 'cacheHitTokens'])
    || pickDeep(raw, ['prompt_tokens_details', 'cached_tokens'])
    || pickInt(usage, ['cache_read_input_tokens', 'prompt_cache_hit_tokens', 'cacheHit'])
    || pickDeep(usage, ['prompt_tokens_details', 'cached_tokens'])
  // OpenAI usage.inputTokensDetails 是数组：[{cached_tokens:n}]
  if (!cacheRead && Array.isArray(usage.inputTokensDetails)) {
    cacheRead = usage.inputTokensDetails.reduce((s: number, d: any) => s + pickInt(d, ['cached_tokens', 'cache_tokens']), 0)
  }
  let cacheWrite = pickInt(raw, ['cache_creation_input_tokens', 'prompt_cache_write_tokens', 'cacheWrite', 'cacheWriteTokens'])
    || pickInt(usage, ['cache_creation_input_tokens', 'prompt_cache_write_tokens', 'cacheWrite'])

  // 判断是否含缓存：只要出现任一缓存字段，就认为 promptRaw 是「含缓存的总输入」
  const hasCacheSplit = cacheRead > 0 || cacheWrite > 0
    || pickInt(raw, ['prompt_cache_hit_tokens']) > 0
    || pickInt(raw, ['prompt_cache_miss_tokens']) > 0
  let input = promptRaw
  if (hasCacheSplit && input >= cacheRead + cacheWrite) {
    input = input - cacheRead - cacheWrite
  }

  // ---- 输出侧 ----
  let output = pickInt(usage, ['output_tokens', 'completion_tokens', 'outputTokens', 'completionTokens', 'output', 'output_tokens_count', 'candidatesTokenCount', 'n_output_tokens'])
    || pickInt(o?.usageMetadata, ['candidatesTokenCount'])
  // 只有 total_tokens 时（部分事件流），粗略把总量当输出（保守，标注模型名由调用方识别）
  if (!promptRaw && !output) {
    const totalOnly = pickInt(usage, ['total_tokens', 'totalTokens'])
    if (totalOnly > 0) output = totalOnly
  }
  // reasoning 通常已计入 output，不重复累加；仅在 output=0 时才用 reasoning 兜底
  let reasoning = pickInt(raw, ['completion_thinking_tokens'])
    || pickDeep(raw, ['completion_tokens_details', 'reasoning_tokens'])
    || pickDeep(usage, ['output_tokens_details', 'reasoning_tokens'])
    || pickInt(usage, ['reasoning_tokens', 'reasoningTokens'])
  if (output > 0) reasoning = 0 // 已含在 output 内，避免重复计费

  if (input + output + cacheRead + cacheWrite + reasoning === 0) return null

  // ---- 模型名 ----
  const pd = o?.providerData || {}
  const d = o?.data && typeof o.data === 'object' ? o.data : {}
  const u: any = usage || {}
  const model = String(
    pd.model || pd.requestModelName || pd.requestModelId
    || o?.model || o?.model_id || o?.modelId || o?.model_name || o?.modelName
    || o?.message?.model || o?.response?.model || d.model
    || d.modelId || d.model_id || d.model_slug
    || o?.modelSlug || o?.modelVersion || d.modelVersion
    || o?.agentPreset?.model
    // usage 内部嵌套的模型名（如 OpenCode step-finish.usage.modelID）
    || u.model || u.modelID || u.model_id || u.modelId || u.modelName
    || '未知模型'
  )

  // 排除系统事件：如 message 类型里携带的压缩/摘要用量，没有模型名，
  // 不是一次真实的模型请求。只保留有明确模型名的行，或 function_call 行。
  const t = o?.type
  const hasExplicitModel = model !== '未知模型'
  if (!hasExplicitModel && (t === 'message' || t === 'summary' || t === 'compaction')) return null

  const ts = parseTime(o?.timestamp || o?.ts || o?.time || o?.created || o?.created_at || pd.timestamp || d.time)
  const session = String(
    o?.sessionId || o?.session_id || o?.conversationId || o?.conversation_id
    || d.session_id || d.sessionId || ''
  )
  // 工具/命令名：function_call 行顶层 name；兼容 tool_use 结构
  const tool = String(
    o?.name || o?.tool || o?.tool_name || o?.function?.name
    || o?.message?.content?.find?.((c: any) => c?.type === 'tool_use')?.name
    || d?.name || ''
  ) || undefined

  return {
    id: uid(),
    model,
    vendor: inferVendor(model),
    input, output, cacheRead, cacheWrite, reasoning,
    ts,
    tag: o?.workspace || o?.project || o?.cwd || undefined,
    session: session || undefined,
    tool,
    source: 'log' as DataSource,
  }
}

/** 解析整个 jsonl 文本（附带本地会话标题识别） */
export function parseJSONL(text: string): UsageRecord[] {
  const out: UsageRecord[] = []
  for (const line of text.split(/\r?\n/)) {
    const r = parseJSONLLine(line)
    if (r) out.push(r)
  }
  if (out.length) attachSessionTitles(out, extractSessionTitles(text))
  return out
}

/** 解析时间：支持 ISO 字符串、秒/毫秒时间戳 */
function parseTime(v: any): number {
  if (!v) return Date.now()
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    const n = Number(v)
    return n < 1e12 ? n * 1000 : n
  }
  const t = Date.parse(v)
  return isNaN(t) ? Date.now() : t
}

/** 智能解析 CSV（账单）：自动识别列 */
export function parseCSV(text: string): UsageRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const delim = lines[0].includes(',') ? ',' : lines[0].includes('\t') ? '\t' : ';'
  const header = splitCSVLine(lines[0], delim).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  const idx = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))
  const cModel = idx(['model', '模型'])
  const cIn = idx(['input', 'prompt', '输入', 'input_tokens', 'prompt_tokens'])
  const cOut = idx(['output', 'completion', '输出', 'output_tokens', 'completion_tokens'])
  const cCache = idx(['cache_read', 'cached', '缓存命中'])
  const cCacheW = idx(['cache_write', '缓存写入'])
  const cTotal = idx(['total', '总计'])
  const cTime = idx(['time', 'date', 'timestamp', '时间', '日期', 'created'])
  const cVendor = idx(['vendor', 'platform', '厂商', '平台'])
  const out: UsageRecord[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delim)
    const model = cModel >= 0 ? cols[cModel] : '未知模型'
    let input = pickInt({ v: cols[cIn] }, ['v'])
    let output = pickInt({ v: cols[cOut] }, ['v'])
    const cacheRead = cCache >= 0 ? pickInt({ v: cols[cCache] }, ['v']) : 0
    const cacheWrite = cCacheW >= 0 ? pickInt({ v: cols[cCacheW] }, ['v']) : 0
    // 若只有 total 没有分项，按 total 全记入输出（保守）
    if (!input && !output && !cacheRead && cTotal >= 0) output = pickInt({ v: cols[cTotal] }, ['v'])
    if (!input && !output && !cacheRead && !cacheWrite) continue
    const vTime = cTime >= 0 ? cols[cTime] : undefined
    out.push({
      id: uid(), model, vendor: (cVendor >= 0 ? cols[cVendor] : '') || inferVendor(model),
      input, output, cacheRead, cacheWrite, reasoning: 0,
      ts: parseTime(vTime), source: 'bill',
    })
  }
  return out
}

function splitCSVLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { quoted = !quoted; continue }
    if (ch === delim && !quoted) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

/** 解析账单/用量 JSON：支持数组、{data:[]}、OpenAI usage export */
export function parseBillJSON(text: string): UsageRecord[] {
  let o: any
  try { o = JSON.parse(text) } catch { return [] }
  let arr: any[] = Array.isArray(o) ? o
    : (o.data || o.items || o.results || o.records || o.messages || o.sessions || o.conversations || o.turns || [])
  if (!Array.isArray(arr)) {
    // 单个 usage 对象
    const single = parseJSONLLine(text)
    return single ? [single] : []
  }
  const out: UsageRecord[] = []
  for (const row of arr) {
    const r = parseJSONLLine(JSON.stringify(row))
    if (r) { r.source = 'bill'; out.push(r) }
  }
  return out
}

/**
 * Codex CLI rollout 解析：token_count 事件里是「累计」用量，需差分还原每次请求。
 * 行格式：{"timestamp", "type":"event_msg", "payload":{"type":"token_count","info":{...}}}
 * 模型名从最近的 turn_context.payload.model 继承。
 */
export function parseCodexRollout(text: string): UsageRecord[] {
  const out: UsageRecord[] = []
  let curModel = '未知模型'
  let lastIn = 0, lastOut = 0, lastCache = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    let o: any
    try { o = JSON.parse(line) } catch { continue }
    const payload = o.payload || {}
    // 记录当前模型
    if (o.type === 'turn_context' && payload.model) curModel = String(payload.model)
    if (o.type === 'session_meta' && payload.model_provider) {
      // 保留 provider 名，仅在没有更具体模型名时兜底
      if (curModel === '未知模型') curModel = String(payload.model_provider)
    }
    // token_count 事件：累计值差分
    const info = o.type === 'event_msg' && payload.type === 'token_count' ? payload.info : null
    if (!info) continue
    const usage = info.total_token_usage || info.last_token_usage || info
    const curIn = pickInt(usage, ['input_tokens', 'prompt_tokens'])
    const curOut = pickInt(usage, ['output_tokens', 'completion_tokens'])
    const curCache = pickInt(usage, ['cached_input_tokens'])
      + pickDeep(usage, ['input_tokens_details', 'cached_tokens'])
    const dIn = Math.max(0, curIn - lastIn)
    const dOut = Math.max(0, curOut - lastOut)
    const dCache = Math.max(0, curCache - lastCache)
    lastIn = curIn; lastOut = curOut; lastCache = curCache
    if (dIn + dOut + dCache === 0) continue
    // 输入含缓存：非缓存输入 = 差分输入 - 差分缓存
    const input = Math.max(0, dIn - dCache)
    out.push({
      id: uid(), model: curModel, vendor: inferVendor(curModel),
      input, output: dOut, cacheRead: dCache, cacheWrite: 0, reasoning: 0,
      ts: parseTime(o.timestamp), session: String(payload.session_id || o.session_id || ''),
      source: 'log',
    })
  }
  if (out.length) attachSessionTitles(out, extractSessionTitles(text))
  return out
}

/** 是否 Codex rollout 格式 */
function looksLikeCodex(text: string): boolean {
  return /"type"\s*:\s*"turn_context"|"type"\s*:\s*"token_count"|"type"\s*:\s*"session_meta"/.test(text)
}

/** 根据文本自动选择解析器 */
export function parseBillFile(name: string, text: string): UsageRecord[] {
  const lower = name.toLowerCase()
  // Codex rollout（按内容特征或文件名）
  if (lower.includes('rollout') || looksLikeCodex(text)) {
    const c = parseCodexRollout(text)
    if (c.length) return c
  }
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return parseCSV(text)
  if (lower.endsWith('.jsonl')) {
    const r = parseJSONL(text); if (r.length) return r
    const b = parseBillJSON(text); if (b.length) return b
    return parseCSV(text)
  }
  if (lower.endsWith('.json')) {
    const parsed = parseBillJSON(text)
    if (parsed.length) return parsed
    const rows = parseJSONL(text); if (rows.length) return rows
    return parseCSV(text)
  }
  // 兜底：先试 jsonl，再试 json，再试 csv
  let r = parseJSONL(text); if (r.length) return r
  r = parseBillJSON(text); if (r.length) return r
  return parseCSV(text)
}
