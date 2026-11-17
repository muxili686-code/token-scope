import type { UsageRecord } from '../types'

/** 演示数据：覆盖 OpenAI / Claude / 豆包 / DeepSeek / GLM，供未接入真实数据时预览 */
const seed: Array<[string, string, number, number, number, number, number]> = [
  // [model, vendor, input, output, cacheRead, cacheWrite, daysAgo]
  ['claude-opus-4-8', 'Anthropic', 182000, 24300, 96000, 21000, 0],
  ['claude-sonnet-5.5', 'Anthropic', 264000, 41200, 121000, 0, 0],
  ['gpt-5', 'OpenAI', 135000, 22800, 0, 0, 0],
  ['gpt-4.1', 'OpenAI', 98000, 15600, 42000, 0, 0],
  ['doubao-seed-2.0-pro', '字节/豆包', 320000, 46700, 88000, 0, 0],
  ['deepseek-chat', 'DeepSeek', 156000, 21300, 0, 0, 0],
  ['claude-opus-4-8', 'Anthropic', 121000, 18700, 74000, 15000, 1],
  ['gpt-5.6-sol', 'OpenAI', 76000, 11200, 33000, 0, 1],
  ['glm-5.3', '智谱GLM', 188000, 26400, 0, 0, 1],
  ['doubao-seed-2.0-lite', '字节/豆包', 410000, 53800, 0, 0, 1],
  ['gpt-4o-mini', 'OpenAI', 222000, 33100, 0, 0, 2],
  ['claude-haiku-5.5', 'Anthropic', 305000, 44200, 0, 0, 2],
  ['kimi', 'Kimi', 143000, 19800, 0, 0, 2],
  ['gpt-5', 'OpenAI', 88000, 13200, 41000, 0, 3],
  ['doubao-2.1-pro', '字节/豆包', 267000, 35100, 62000, 0, 3],
  ['deepseek-reasoner', 'DeepSeek', 99000, 42700, 0, 0, 3],
  ['claude-sonnet-5.5', 'Anthropic', 176000, 24900, 91000, 0, 4],
  ['gpt-4.1-mini', 'OpenAI', 198000, 28700, 0, 0, 4],
  ['glm-5.3-flash', '智谱GLM', 233000, 31600, 0, 0, 5],
  ['doubao-seed-2.0-pro', '字节/豆包', 152000, 20300, 44000, 0, 5],
  ['gpt-5.2', 'OpenAI', 81000, 12400, 29000, 0, 6],
  ['claude-opus-4-8', 'Anthropic', 64000, 9800, 31000, 7000, 6],
]

export function makeDemoRecords(): UsageRecord[] {
  const now = Date.now()
  return seed.map((s, i) => {
    const [model, vendor, input, output, cacheRead, cacheWrite, daysAgo] = s
    // 让同一天的数据有多个时间点
    const hour = 9 + (i % 10)
    const ts = now - daysAgo * 86400000 - (24 - hour) * 3600000 - (i % 5) * 600000
    return {
      id: `demo-${i}`,
      model, vendor, input, output, cacheRead, cacheWrite, reasoning: 0,
      ts, tag: `项目 ${String.fromCharCode(65 + (i % 4))}`,
      source: 'demo' as const,
    }
  })
}
