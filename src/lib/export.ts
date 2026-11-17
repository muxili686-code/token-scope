import type { UsageRecord, ModelAgg } from '../types'
import { fmtCompact, fmtMoney, fmtInt } from './format'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出逐模型明细 CSV */
export function exportAggsCSV(aggs: ModelAgg[], filename = 'tokenscope-模型明细.csv') {
  const head = ['模型', '厂商', '请求数', '输入token', '输出token', '缓存命中', '缓存写入', '总token', '费用CNY']
  const rows = aggs.map(a => [
    a.model, a.vendor, a.records, a.input, a.output, a.cacheRead, a.cacheWrite, a.totalTokens, a.costCNY.toFixed(4),
  ])
  const csv = '\uFEFF' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
}

/** 导出逐条记录 CSV */
export function exportRecordsCSV(records: UsageRecord[], filename = 'tokenscope-用量明细.csv') {
  const head = ['时间', '模型', '厂商', '输入token', '输出token', '缓存命中', '缓存写入', '会话']
  const rows = records.map(r => [
    new Date(r.ts).toLocaleString('zh-CN'), r.model, r.vendor, r.input, r.output, r.cacheRead, r.cacheWrite, r.session || '',
  ])
  const csv = '\uFEFF' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
}

/** 用 canvas 自绘一张报告卡 PNG（KPI + 模型表），无第三方依赖 */
export function exportReportPNG(opts: {
  totalCost: number
  totalTokens: number
  requests: number
  models: number
  hitRate: number
  aggs: ModelAgg[]
  filename?: string
}) {
  const { totalCost, totalTokens, requests, models, hitRate, aggs } = opts
  const W = 1000
  const headerH = 150
  const rowH = 34
  const tableTop = headerH + 60
  const H = tableTop + Math.min(aggs.length, 15) * rowH + 70
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = W * scale
  canvas.height = H * scale
  const c = canvas.getContext('2d')!
  c.scale(scale, scale)

  // 背景
  c.fillStyle = '#f4f6fb'
  c.fillRect(0, 0, W, H)
  // 顶部渐变条
  const grad = c.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, '#4f46e5'); grad.addColorStop(1, '#7c3aed')
  c.fillStyle = grad
  c.fillRect(0, 0, W, 8)
  // 标题
  c.fillStyle = '#1a2233'
  c.font = 'bold 26px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
  c.fillText('TokenScope · 用量与成本报告', 40, 52)
  c.fillStyle = '#93a0b4'
  c.font = '13px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
  c.fillText(`生成时间：${new Date().toLocaleString('zh-CN')}`, 40, 78)

  // KPI 卡片
  const kpis = [
    { label: '总费用', value: fmtMoney(totalCost), color: '#4f46e5' },
    { label: '总 Token', value: fmtCompact(totalTokens), color: '#e0524d' },
    { label: '请求数', value: fmtInt(requests), color: '#0ea5e9' },
    { label: '模型数', value: String(models), color: '#8b5cf6' },
    { label: '缓存命中率', value: `${(hitRate * 100).toFixed(1)}%`, color: '#16a34a' },
  ]
  const cardW = (W - 80 - 4 * 12) / 5
  kpis.forEach((k, i) => {
    const x = 40 + i * (cardW + 12)
    c.fillStyle = '#fff'
    roundRect(c, x, 100, cardW, 72, 10); c.fill()
    c.strokeStyle = '#e6eaf2'; c.lineWidth = 1; c.stroke()
    c.fillStyle = '#93a0b4'
    c.font = '12px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
    c.fillText(k.label, x + 14, 124)
    c.fillStyle = k.color
    c.font = 'bold 22px -apple-system, "Segoe UI", sans-serif'
    c.fillText(k.value, x + 14, 156)
  })

  // 表头
  c.fillStyle = '#f8fafc'
  roundRect(c, 40, headerH + 20, W - 80, tableTop - headerH - 20 + Math.min(aggs.length, 15) * rowH, 10); c.fill()
  c.fillStyle = '#93a0b4'
  c.font = 'bold 12px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
  const rightEdges = [0, 290, 390, 510, 650, 790, W - 100]
  const heads = ['模型', '请求', '输入', '输出', '缓存命中', '总Token', '费用¥']
  heads.forEach((h, i) => {
    c.textAlign = i === 0 ? 'left' : 'right'
    c.fillText(h, i === 0 ? 56 : 40 + rightEdges[i], tableTop - 10)
  })
  c.textAlign = 'left'

  // 表格行
  aggs.slice(0, 15).forEach((a, i) => {
    const y = tableTop + i * rowH
    if (i % 2 === 1) { c.fillStyle = '#fff'; c.fillRect(48, y, W - 96, rowH) }
    c.fillStyle = '#1a2233'
    c.font = '13px -apple-system, "Segoe UI", sans-serif'
    c.textAlign = 'left'
    c.fillText(a.model.slice(0, 24), 56, y + 22)
    c.textAlign = 'right'
    const vals = [
      fmtInt(a.records), fmtCompact(a.input), fmtCompact(a.output),
      fmtCompact(a.cacheRead), fmtCompact(a.totalTokens), fmtMoney(a.costCNY),
    ]
    vals.forEach((v, j) => c.fillText(v, 40 + rightEdges[j + 1], y + 22))
    c.textAlign = 'left'
  })

  // 页脚
  c.fillStyle = '#93a0b4'
  c.font = '11px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
  c.fillText('费用按官方单价计算，仅供参考，以平台账单为准 · TokenScope', 40, H - 24)

  canvas.toBlob(blob => {
    if (blob) download(blob, opts.filename || 'tokenscope-报告.png')
  }, 'image/png')
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}
