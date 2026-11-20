/**
 * 会话标题识别（纯本地，不联网）
 * 从会话日志里按 sessionId 抓第一条用户提问，清洗成可读的中文短标题。
 * 用量行与用户提问行带同一个 sessionId，据此把标题关联到用量记录。
 */

/** 宽松匹配 user 消息行 / 官方标题行，避免每行都 JSON.parse */
const USER_LINE = /"role"\s*:\s*"user"/
const AI_TITLE_LINE = /"type"\s*:\s*"ai-title"/

/** 把一条原始提问清洗成短标题 */
function cleanTitle(raw: string): string {
  let s = raw
  // 若抓取兜底混入了系统提示块，先剔除
  s = s.replace(/<system-reminder[\s\S]*?<\/system-reminder>/g, ' ')
  s = s.replace(/<[^>]+>/g, ' ')
  const hasCJK = /[\u4e00-\u9fa5]/.test(s)
  // 链接：有中文意图时直接去掉；纯链接会话（如贴个 GitHub 仓库）保留域名后一段做标题
  s = s.replace(/https?:\/\/[^\s<>"']+/g, (u) => {
    if (hasCJK) return ' '
    const seg = u.split('/').filter(Boolean).pop() || ''
    return seg ? ' ' + seg.replace(/[-_]/g, ' ') + ' ' : ' '
  })
  // 附件/引用噪音：@image#1:xx  @skill:xx  @"路径"  @普通词
  s = s.replace(/@image#?\d*:[^\s@]+/gi, ' ')
  s = s.replace(/@"[^"]*"/g, ' ')
  s = s.replace(/@[\w.\-/]+:[^\s@]+/g, ' ')
  s = s.replace(/@[^\s@"']+/g, ' ')
  // 换行与多余空白
  s = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  // 取第一句（中英文句末/分号截断）
  const first = s.split(/[。！？!?；;]/)[0].trim()
  let title = first || s
  if (title.length > 24) title = title.slice(0, 23).trimEnd() + '…'
  return title
}

/** 无信息量的开场白——遇到就跳到下一条提问 */
const NOISE = /^(请继续|继续|继续执行|请继续执行任务|好的|嗯+|测试|test|hi|hello|谢谢|收到)/i

/**
 * 从 jsonl 文本提取 sessionId → 中文标题。
 * 每个会话只认第一条有效提问。
 */
export function extractSessionTitles(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/)
  const official: Record<string, string> = {}   // 官方 ai-title（最准）
  const fallback: Record<string, string> = {}   // 首条提问兜底

  for (const line of lines) {
    if (!line.trim()) continue
    // 官方标题行：优先级最高
    if (AI_TITLE_LINE.test(line)) {
      let o: any
      try { o = JSON.parse(line) } catch { continue }
      const sid = String(o.sessionId || o.session_id || '')
      if (sid && o.aiTitle && !official[sid]) official[sid] = String(o.aiTitle).trim()
      continue
    }
    if (!USER_LINE.test(line)) continue
    let o: any
    try { o = JSON.parse(line) } catch { continue }
    if (o?.role !== 'user') continue
    const sid = String(o.sessionId || o.session_id || o.conversationId || o.conversation_id || '')
    if (!sid || official[sid] || fallback[sid]) continue
    const content = Array.isArray(o.content) ? o.content : []
    const textParts = content.map((c: any) => (typeof c?.text === 'string' ? c.text : '')).join('\n')
    if (!textParts) continue
    const m = textParts.match(/<user_query>([\s\S]*?)<\/user_query>/)
    const q = (m ? m[1] : textParts).trim()
    const title = cleanTitle(q)
    if (!title || NOISE.test(title)) continue
    fallback[sid] = title
  }
  // 官方标题缺失的会话，用首句提问补齐
  return { ...fallback, ...official }
}

/** 把识别到的标题挂到用量记录上（只写有会话号的记录） */
export function attachSessionTitles(records: { session?: string; sessionTitle?: string }[], titles: Record<string, string>): void {
  if (!Object.keys(titles).length) return
  for (const r of records) {
    if (r.session && titles[r.session]) r.sessionTitle = titles[r.session]
  }
}
