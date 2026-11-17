import type { Price, UsageRecord, Cost, ModelAgg } from '../types'
import { DEFAULT_PRICES, FALLBACK_PRICE, DEFAULT_USD_CNY } from '../data/prices'

/** 从 localStorage 读取价格表（用户校正后） */
export function loadPrices(): Record<string, Price> {
  try {
    const raw = localStorage.getItem('ts-prices')
    if (raw) return { ...DEFAULT_PRICES, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_PRICES }
}

export function savePrices(prices: Record<string, Price>) {
  // 只存与默认不同的项，避免冗余
  const diff: Record<string, Price> = {}
  for (const k in prices) {
    if (JSON.stringify(prices[k]) !== JSON.stringify(DEFAULT_PRICES[k])) diff[k] = prices[k]
  }
  localStorage.setItem('ts-prices', JSON.stringify(diff))
}

export function loadRate(): number {
  const raw = localStorage.getItem('ts-usd-cny')
  const v = Number(raw)
  // 没有记录，或仍是旧默认值(7.15，用户未手动改过)时，采用最新内置汇率
  if (!raw || !(v > 0) || Math.abs(v - 7.15) < 0.001) return DEFAULT_USD_CNY
  return v
}

export function saveRate(rate: number) {
  localStorage.setItem('ts-usd-cny', String(rate))
}

/** 模型名归一化：小写、去版本后缀，用于模糊匹配价格表 */
export function normalizeModel(name: string): string {
  if (!name) return ''
  return name.toLowerCase()
    .replace(/^accounts\/[^\/]+\/models\//, '')  // vertex ai 前缀
    .replace(/[-_]202\d{4}$/, '')                 // -20241120 日期尾缀
    .trim()
}

/** 免费档判定：模型名含 free（如 hy4-flash-free / hy4-free） */
export function isFreeModel(model: string): boolean {
  return /(^|[-_])free([-_]|$)/i.test(model) || /free$/i.test(model)
}

/** 找到匹配的价格。先精确，再前缀匹配（取最长key），免费档优先归零，再兜底 */
export function matchPrice(model: string, prices: Record<string, Price>): { price: Price; key: string; matched: boolean } {
  const n = normalizeModel(model)
  if (prices[n]) return { price: prices[n], key: n, matched: true }
  // 免费档：匹配到任意含 free 的 key（如 hy4-free），或没有精确项时按 0 成本
  if (isFreeModel(n)) {
    const freeKeys = Object.keys(prices).filter(k => isFreeModel(k))
    const keysDesc = freeKeys.sort((a, b) => b.length - a.length)
    for (const k of keysDesc) {
      if (n === k || n.startsWith(k + '-') || n.startsWith(k + '.') || n.startsWith(k + '_')) {
        return { price: prices[k], key: k, matched: true }
      }
    }
    // 没匹配到具体免费档，返回零成本价格
    return { price: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, currency: 'CNY', source: '模型名含 free，按免费档 0 成本', updated: '2026-11-16' }, key: 'free', matched: true }
  }
  // 按 key 长度降序，尽量最长匹配，避免 gpt-5 抢先匹配 gpt-5.6
  const keys = Object.keys(prices).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (n === k || n.startsWith(k + '-') || n.startsWith(k + '.') || n.startsWith(k + '_')) {
      return { price: prices[k], key: k, matched: true }
    }
  }
  return { price: FALLBACK_PRICE, key: '', matched: false }
}

/** 计算单条记录成本（返回模型原生币种的成本） */
export function calcCost(rec: UsageRecord, price: Price): Cost {
  const inputCost = (rec.input / 1e6) * price.input
  const outputCost = ((rec.output + rec.reasoning) / 1e6) * price.output
  const cacheReadCost = (rec.cacheRead / 1e6) * price.cacheRead
  const cw = price.cacheWrite ?? price.input * 1.25
  const cacheWriteCost = (rec.cacheWrite / 1e6) * cw
  return {
    inputCost, outputCost, cacheReadCost, cacheWriteCost,
    total: inputCost + outputCost + cacheReadCost + cacheWriteCost,
    currency: price.currency,
  }
}

/** 折算成人民币 */
export function toCNY(cost: Cost, rate: number): number {
  return cost.currency === 'USD' ? cost.total * rate : cost.total
}

/** 聚合到模型维度，成本统一折算为 CNY */
export function aggregate(records: UsageRecord[], prices: Record<string, Price>, rate: number): ModelAgg[] {
  const map = new Map<string, ModelAgg>()
  const mkeys = new Map<string, string>() // model -> matched price key
  for (const r of records) {
    const m = r.model || '未知模型'
    const { price, key } = matchPrice(m, prices)
    const c = calcCost(r, price)
    const cny = toCNY(c, rate)
    mkeys.set(m, key)
    if (!map.has(m)) {
      map.set(m, { model: m, vendor: r.vendor, records: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, costCNY: 0, currency: price.currency, rawCost: 0 })
    }
    const a = map.get(m)!
    a.records++
    a.input += r.input
    a.output += r.output
    a.cacheRead += r.cacheRead
    a.cacheWrite += r.cacheWrite
    a.reasoning += r.reasoning
    a.totalTokens += r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning
    a.costCNY += cny
    a.rawCost += c.total
  }
  return [...map.values()].sort((a, b) => b.costCNY - a.costCNY)
}
