import { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Treemap,
} from 'recharts'
import type { UsageRecord } from '../types'
import { fmtDate, fmtCompact, fmtInt } from '../lib/format'

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

/** Token 构成：输入/输出/缓存命中/缓存写入/推理 占比环形图 + 图例 */
export function TokenComposition({ records }: { records: UsageRecord[] }) {
  const parts = useMemo(() => {
    const sum = (k: keyof UsageRecord) => records.reduce((s, r) => s + (Number(r[k]) || 0), 0)
    const rows = [
      { name: '输入', value: sum('input'), color: '#4f46e5' },
      { name: '输出', value: records.reduce((s, r) => s + r.output + r.reasoning, 0), color: '#e0524d' },
      { name: '缓存命中', value: sum('cacheRead'), color: '#0ea5e9' },
      { name: '缓存写入', value: sum('cacheWrite'), color: '#16a34a' },
    ].filter(r => r.value > 0)
    const total = rows.reduce((s, r) => s + r.value, 0) || 1
    return rows.map(r => ({ ...r, pct: r.value / total * 100 }))
  }, [records])
  const total = parts.reduce((s, r) => s + r.value, 0)
  if (!total) return <div className="text-center text-xs faint py-8">暂无 Token 数据</div>
  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={parts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {parts.map(r => <Cell key={r.name} fill={r.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [fmtCompact(Number(v)) + ' tok', n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-bold kpi-num" style={{ fontSize: 18 }}>{fmtCompact(total)}</span>
            <span className="text-[10px] faint">总 Token</span>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] space-y-1.5">
          {parts.map(r => (
            <div key={r.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
              <span className="text-slate-600 flex-1">{r.name}</span>
              <span className="font-semibold kpi-num">{r.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 费用构成 Treemap：按模型切块，可切换按模型/按厂商 */
export function CostTreemap({ records, costOf }: { records: UsageRecord[]; costOf: (r: UsageRecord) => number }) {
  const [dim, setDim] = useState<'model' | 'vendor'>('model')
  const data = useMemo(() => {
    const map = new Map<string, { name: string; size: number }>()
    for (const r of records) {
      const key = dim === 'model' ? r.model : r.vendor
      const c = Math.max(0, costOf(r))
      map.set(key, { name: key, size: (map.get(key)?.size || 0) + c })
    }
    return [...map.values()].filter(d => d.size > 0).sort((a, b) => b.size - a.size)
  }, [records, costOf, dim])
  if (!data.length) return <div className="text-center text-xs faint py-8">暂无费用数据</div>
  return (
    <div>
      <div className="flex justify-end mb-1">
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          <button className={'px-2.5 py-1 text-[11px] font-semibold ' + (dim === 'model' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600')} onClick={() => setDim('model')}>按模型</button>
          <button className={'px-2.5 py-1 text-[11px] font-semibold ' + (dim === 'vendor' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600')} onClick={() => setDim('vendor')}>按厂商</button>
        </div>
      </div>
      <div style={{ width: '100%', height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" nameKey="name" stroke="#fff"
            content={(({ x, y, width, height, name, index }: any) => {
              if (width < 24 || height < 18) return null
              const color = stableColor(String(name))
              const item = data[index]
              return (
                <g>
                  <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.88} rx={4} />
                  {width > 56 && height > 34 && (
                    <>
                      <text x={x + 7} y={y + 17} fill="#fff" fontSize={11} fontWeight={700} className="select-none">
                        {String(name).length > 12 ? String(name).slice(0, 11) + '…' : name}
                      </text>
                      <text x={x + 7} y={y + 32} fill="#fff" fillOpacity={0.9} fontSize={10} className="select-none">
                        ¥{item?.size?.toFixed(2)}
                      </text>
                    </>
                  )}
                </g>
              )
            }) as any} />
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** 工具调用排行：横向条形 + 次数/费用 */
export function ToolRanking({ records, costOf }: { records: UsageRecord[]; costOf: (r: UsageRecord) => number }) {
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; count: number; cost: number; tokens: number }>()
    for (const r of records) {
      if (!r.tool) continue
      const cur = map.get(r.tool) || { name: r.tool, count: 0, cost: 0, tokens: 0 }
      cur.count++
      cur.cost += Math.max(0, costOf(r))
      cur.tokens += r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning
      map.set(r.tool, cur)
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 12)
  }, [records, costOf])
  const max = rows[0]?.count || 1
  const totalCount = rows.reduce((s, r) => s + r.count, 0)
  if (!rows.length) return <div className="text-center text-xs faint py-8">日志中未识别到工具调用</div>
  return (
    <div>
      <div className="text-[11px] faint mb-2">{fmtInt(totalCount)} 次调用 · {rows.length} 个工具</div>
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-[92px] truncate text-[11px] text-slate-600 shrink-0" title={r.name}>{r.name}</span>
            <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${Math.max(3, r.count / max * 100)}%`, background: stableColor(r.name) }} />
            </div>
            <span className="w-10 text-right text-[11px] font-semibold kpi-num shrink-0">{fmtInt(r.count)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
