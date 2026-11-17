export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('zh-CN')
}

/**
 * Token 数量紧凑显示：统一用中文「亿 / 万」。
 * 全站所有 token 数字都走这里，保证单位一致（不再出现 B/M/K）。
 */
export function fmtCompact(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e8) {
    const v = n / 1e8
    return (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2)) + '亿'
  }
  if (a >= 1e4) {
    const v = n / 1e4
    return v.toFixed(2) + '万'
  }
  return fmtInt(n)
}

export function fmtMoney(n: number, currency: 'USD' | 'CNY' = 'CNY'): string {
  const sym = currency === 'USD' ? '$' : '¥'
  if (Math.abs(n) >= 1000) return sym + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return sym + n.toFixed(currency === 'USD' ? 4 : 3)
}

export function fmtDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
