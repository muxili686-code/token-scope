/** 用量截图（token.daeai.cn 看板，2026-11-16 16:27 数据）识别结果 */

/** 截图顶部 KPI */
export const CASE_KPI = {
  totalTokens: 2.219e9,   // 总 TOKEN 22.19 亿
  activeTokens: 1.06e8,   // 活跃（缓存写入）1.06 亿
  sessions: 99,
  requests: 9655,
  inOutRatio: 221,        // 输入 / 输出 221:1
  hitRate: 0.97,          // 缓存命中率 97.0%
  refCost: 1432.1,        // 参考站"费用估算(元)"
  workspace: 'd-workbuddy-2026-10-30-16-27-12',
  capturedAt: '2026-11-16 16:27',
}

/** 从"单次请求大小分布"识别的 TOP 8 模型（p50/p90 为单次请求 token 分位数） */
export const CASE_MODELS = [
  { model: 'deepseek-v4.1-flash', vendor: 'DeepSeek', requests: 7208, p50: 228000, p90: 457000, note: '主力模型，占请求 74.7%' },
  { model: 'hy4-free',            vendor: '腾讯混元', requests: 1358, p50: 161000, p90: 396000, note: 'WorkBuddy 免费档（11/4-11/15），实际成本 0' },
  { model: 'hy3',                 vendor: '腾讯混元', requests: 473,  p50: 87000,  p90: 178000 },
  { model: 'mimo-v2.6-pro',       vendor: '小米 MiMo', requests: 193, p50: 100000, p90: 123000 },
  { model: 'step-5-preview',      vendor: '阶跃星辰', requests: 176,  p50: 158000, p90: 233000 },
  { model: 'minimax-m3.1-flash',  vendor: 'MiniMax',  requests: 139,  p50: 132000, p90: 170000 },
  { model: 'hy4',                 vendor: '腾讯混元', requests: 91,   p50: 270000, p90: 302000 },
  { model: 'deepseek-v4-pro',     vendor: 'DeepSeek', requests: 14,   p50: 167000, p90: 202000 },
]

/** 免费档模型（活动期不计成本） */
export const FREE_MODELS = ['hy4-free']

/**
 * 参考站写死的单价表（从 token.daeai.cn 源码提取，元/百万token：[输入,输出,缓存命中]）
 * 用于复原它的 ¥1432.1 报价，验证我们的分摊口径是否准确。
 */
export const REF_PRICES: Record<string, [number, number, number]> = {
  'deepseek-v4-flash': [1, 4, 0.2], 'deepseek-v4-pro': [2, 8, 0.5], 'deepseek': [2, 8, 0.5],
  'glm-5.3': [2, 8, 0.4], 'glm': [1, 4, 0.2], 'kimi': [1.5, 6, 0.3],
  'claude-opus-5': [150, 750, 15], 'claude': [110, 550, 11],
  'qwen': [2.4, 9.6, 0.48], 'hy3': [4, 16, 0.8], 'hy': [4, 16, 0.8],
  'minimax': [1, 5, 0.2], 'm3': [1, 5, 0.2],
}

/** 参考站的模型匹配逻辑：小写 + startsWith（取任意匹配），无匹配用兜底 */
export function refPriceOf(model: string): [number, number, number] {
  const n = model.toLowerCase()
  for (const k of Object.keys(REF_PRICES)) if (n.startsWith(k)) return REF_PRICES[k]
  return [2, 8, 0.4]
}
