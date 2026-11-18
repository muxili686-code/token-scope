import { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import type { UsageRecord } from '../types'
import { fmtDate, fmtCompact } from '../lib/format'

const COLORS = ['#4f46e5', '#e0524d', '#0ea5e9', '#16a34a', '#f59e0b', '#9333ea', '#14b8a6', '#ec4899', '#6366f1', '#84cc16']

/**
 * 按名称稳定映射颜色：同一厂商/模型在任何图表、任何筛选下颜色都一致，
 * 且同一批数据内不同名称不撞色。用模块级注册表按首次出现顺序分配，
 * 保证跨筛选稳定（不像 hash 会撞色，也不像数组下标会随排名串色）。
 */
const EXT_PALETTE = [...COLORS, '#0d9488', '#db2777', '#65a30d', '#7c3aed', '#0891b2', '#c2410c', '#4f46e5', '#059669', '#a21caf', '#0284c7', '#b45309', '#4338ca', '#be123c', '#3f6212', '#6d28d9', '#0e7490', '#9a3412']
const colorRegistry = new Map<string, string>()
export function stableColor(name: string, palette: string[] = EXT_PALETTE): string {
  const hit = colorRegistry.get(name)
  if (hit) return hit
  // 避免与已分配颜色重复：取第一个未被占用的色
  const used = new Set(colorRegistry.values())
  const color = palette.find(c => !used.has(c)) || palette[colorRegistry.size % palette.length]
  colorRegistry.set(name, color)
  return color
}

interface DailyPoint { date: string; tokens: number; cost: number; [k: string]: any }

/** 按天聚合，可选按模型堆叠 */
function buildDaily(records: UsageRecord[], costOf: (r: UsageRecord) => number, byModel: boolean): DailyPoint[] {
  const map = new Map<string, DailyPoint>()
  const modelSet = new Set(records.map(r => r.vendor))
  for (const r of records) {
    const key = fmtDate(r.ts)
    if (!map.has(key)) map.set(key, { date: key, tokens: 0, cost: 0 })
    const p = map.get(key)!
    const tok = r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning
    p.tokens += tok
    p.cost += costOf(r)
    if (byModel) p[r.vendor] = (p[r.vendor] || 0) + tok
  }
  const pts = [...map.values()].sort((a, b) => {
    const [am, ad] = a.date.split('/').map(Number)
    const [bm, bd] = b.date.split('/').map(Number)
    return am - bm || ad - bd
  })
  if (byModel) {
    ;(pts as any)._vendors = [...modelSet]
  }
  return pts
}

const tooltipStyle = {
  background: '#fff', border: '1px solid #e6eaf2', borderRadius: 10,
  boxShadow: '0 8px 24px rgba(20,30,60,.12)', fontSize: 12, color: '#1a2233',
}

export function DailyCostChart({ records, costOf }: { records: UsageRecord[]; costOf: (r: UsageRecord) => number }) {
  const data = useMemo(() => buildDaily(records, costOf, false), [records, costOf])
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#93a0b4', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#93a0b4', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => '¥' + fmtCompact(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => ['¥' + Number(v).toFixed(2), '成本']} />
        <Area type="monotone" dataKey="cost" stroke="#4f46e5" strokeWidth={2} fill="url(#costFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function VendorPieChart({
  data, tokenData,
}: {
  data: Array<{ name: string; value: number }>
  tokenData?: Array<{ name: string; value: number }>
}) {
  const [metric, setMetric] = useState<'cost' | 'token'>('cost')
  const hasToken = !!(tokenData && tokenData.length)

  // 合并两个维度的厂商；占比按当前所选维度的总量计算
  const names = [...new Set([...data.map(d => d.name), ...(tokenData || []).map(d => d.name)])]
  const totalCost = data.reduce((s, d) => s + d.value, 0) || 1
  const totalTok = (tokenData || []).reduce((s, d) => s + d.value, 0) || 1
  const rows = names.map(name => {
    const cost = data.find(d => d.name === name)?.value || 0
    const tok = tokenData?.find(d => d.name === name)?.value || 0
    return { name, cost, tok, costPct: cost / totalCost * 100, tokPct: tok / totalTok * 100, color: stableColor(name) }
  }).sort((a, b) => metric === 'cost' ? b.cost - a.cost : b.tok - a.tok)
  const sliceRows = rows.filter(r => (metric === 'cost' ? r.cost : r.tok) > 0)

  const isCost = metric === 'cost' || !hasToken
  const pctOf = (r: typeof rows[number]) => (isCost ? r.costPct : r.tokPct)

  return (
    <div>
      {/* 费用 / Token 维度切换（参考胶囊按钮样式） */}
      {hasToken && (
        <div className="flex justify-center mb-1">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            <button className={'px-3 py-1.5 text-xs font-semibold ' + (metric === 'cost' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600')}
              onClick={() => setMetric('cost')}>费用占比</button>
            <button className={'px-3 py-1.5 text-xs font-semibold ' + (metric === 'token' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600')}
              onClick={() => setMetric('token')}>Token 占比</button>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie data={sliceRows} dataKey={isCost ? 'cost' : 'tok'} nameKey="name" cx="50%" cy="50%"
            innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none" isAnimationActive={false}>
            {sliceRows.map(r => <Cell key={r.name} fill={r.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle}
            formatter={(v: any, _n: any, item: any) => {
              const name = item?.payload?.name || ''
              const row = rows.find(r => r.name === name)
              if (row && hasToken) {
                return [`费用 ¥${row.cost.toFixed(2)}（${row.costPct.toFixed(1)}%） · Token ${fmtCompact(row.tok)}（${row.tokPct.toFixed(1)}%）`, name]
              }
              return ['¥' + Number(v).toFixed(2), name]
            }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
        {rows.map(r => (
          <div key={r.name} className="flex items-center gap-1.5 text-[11px] text-slate-600"
            title={`${r.name}：费用 ${r.costPct.toFixed(1)}% · Token ${r.tokPct.toFixed(1)}%`}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color, opacity: pctOf(r) > 0 ? 1 : 0.35 }} />
            <span>{r.name}</span>
            <span className="font-semibold text-slate-800">{pctOf(r).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <div className="text-center text-[10px] faint mt-1.5">
        {isCost ? '按费用占比统计 · 数字为费用百分比' : '按 Token 占比统计 · 数字为 Token 百分比'}
      </div>
    </div>
  )
}

export function DailyTokenStack({ records }: { records: UsageRecord[] }) {
  const data = useMemo(() => buildDaily(records, () => 0, true), [records])
  const vendors = ((data as any)._vendors || []) as string[]
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#93a0b4', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#93a0b4', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmtCompact(Number(v)) + ' tok', '']} />
        {vendors.map(v => <Bar key={v} dataKey={v} stackId="a" fill={stableColor(v)} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}
