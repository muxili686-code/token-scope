/**
 * 文本 → token 估算（启发式）
 * ------------------------------------------------------------------
 * 消费端 ChatGPT / 豆包 App 不暴露精确 token，只能估算。
 * 经验规则：
 *  - 中文字符：约 1~1.5 token/字（取 1.3，偏保守）
 *  - 日文韩文：约 1.5 token/字
 *  - 英文：约 1 token / 4 字符，或 1.3 token/单词
 *  - 数字：约 1 token / 3 字符（但连续数字常被合并）
 *  - 标点/空格：约 0.3 token
 * 结果仅供参考，精确计数以各模型 tokenizer / API usage 为准。
 */
export interface EstimateResult {
  chinese: number
  cjkOther: number
  englishWords: number
  numbers: number
  punctuation: number
  total: number
  chars: number
}

export function estimateTokens(text: string): EstimateResult {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const cjkOther = (text.match(/[\u3040-\u30ff\uac00-\ud7af]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  const numbers = (text.match(/\d+/g) || []).length
  const punctuation = (text.match(/[\s\p{P}\p{S}]/gu) || []).length

  const total = Math.round(
    chinese * 1.3 +
    cjkOther * 1.5 +
    englishWords * 1.3 +
    numbers * 1.1 +
    punctuation * 0.3
  )
  return {
    chinese, cjkOther, englishWords, numbers, punctuation,
    total: Math.max(0, total),
    chars: text.length,
  }
}

/** 每一轮的 token 明细：新增 vs 历史重放 */
export interface TurnDetail {
  index: number
  role: string
  own: number        // 本轮文本自身 token
  replay: number     // 本轮被重新发送的历史 token
  sent: number       // 本轮实际发送给模型的输入 token = own + replay
  output: number     // 本轮输出 token
}

/**
 * 多轮对话估算：每轮请求都会把之前全部历史重新发送一遍。
 * 返回一个逐轮明细，replay 累计即为"重复发送"造成的额外 token。
 */
export function estimateConversationDetail(turns: { role: string; text: string }[]): {
  turns: TurnDetail[]
  totalSent: number
  totalOwn: number
  totalReplay: number
  totalOutput: number
  multiplier: number
} {
  const details: TurnDetail[] = []
  let history = 0 // 截至当前轮之前，已在上下文中的 token
  let totalSent = 0, totalOwn = 0, totalReplay = 0, totalOutput = 0
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]
    const own = estimateTokens(t.text).total
    if (t.role === 'user' || t.role === 'system') {
      const replay = history
      const sent = own + replay
      details.push({ index: i + 1, role: t.role, own, replay, sent, output: 0 })
      totalSent += sent; totalOwn += own; totalReplay += replay
      history += own
    } else {
      // assistant 回复算输出，同时进入下一轮上下文
      details.push({ index: i + 1, role: t.role, own, replay: 0, sent: 0, output: own })
      totalOutput += own
      history += own
    }
  }
  return {
    turns: details,
    totalSent, totalOwn, totalReplay, totalOutput,
    multiplier: totalOwn > 0 ? totalSent / totalOwn : 1,
  }
}

/** 多轮对话估算：把历史上下文重复计入（每轮都会带上历史） */
export function estimateConversation(turns: { role: string; text: string }[]): { input: number; output: number } {
  const d = estimateConversationDetail(turns)
  return { input: d.totalSent, output: d.totalOutput }
}
