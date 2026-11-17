import { useMemo, useState } from 'react'
import { Search, ChevronDown, ChevronUp, Info, Activity, CalendarDays, BarChart3, Eye, EyeOff } from 'lucide-react'
import type { UsageRecord } from '../types'
import { fmtInt, fmtCompact } from '../lib/format'
import { stableColor } from './Charts'

const tok = (r: UsageRecord) => r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** 深色深浅：value/max → 颜色 */
function heatColor(v: number, max: number): string {
  if (v <= 0 || max <= 0) return '#f1f5f9'
  const t = Math.min(1, v / max)
  // 从浅到深的靛蓝
  const stops = [
    [224, 231, 255], [199, 210, 254], [165, 180, 252], [129, 140, 248], [99, 102, 241], [67, 56, 202],
  ]
  const pos = t * (stops.length - 1)
  const a = Math.floor(pos), b = Math.min(stops.length - 1, a + 1)
  const f = pos - a
  const c = stops[a].map((x, i) => Math.round(x + (stops[b][i] - x) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

// ============ 工作空间活跃分布 ============
export function WorkspaceDistribution({ records }: { records: UsageRecord[] }) {
  const [mode, setMode] = useState<'session' | 'workspace'>('session')
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState<'tokens' | 'sessions'>('tokens')
  const [expanded, setExpanded] = useState(false)
  const [showTitle, setShowTitle] = useState(true) // 会话：中文标题 / 原始编码 切换
  const DEFAULT_ROWS = 5 // 默认显示行数，与右侧日分布热力图高度协调

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; title?: string; tokens: number; sessions: Set<string>; req: number }>()
    for (const r of records) {
      const key = mode === 'session'
        ? (r.session || '未标记会话')
        : (r.tag || '未标记工作空间')
      if (!map.has(key)) map.set(key, { name: key, title: r.sessionTitle, tokens: 0, sessions: new Set(), req: 0 })
      const row = map.get(key)!
      row.tokens += tok(r)
      row.req++
      if (r.session) row.sessions.add(r.session)
    }
    const total = [...map.values()].reduce((s, r) => s + r.tokens, 0) || 1
    return [...map.values()]
      .map(r => ({ ...r, sessionsCount: r.sessions.size, share: r.tokens / total }))
      .filter(r => r.name.toLowerCase().includes(q.toLowerCase()) || (r.title || '').toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => sortBy === 'tokens' ? b.tokens - a.tokens : b.sessionsCount - a.sessionsCount)
      .slice(0, 20)
  }, [records, mode, q, sortBy])

  // 每天活跃条（全局时间跨度分 20 段）
  const buckets = useMemo(() => {
    const ts = records.map(r => r.ts).filter(t => t > 0)
    if (!ts.length) return { min: 0, max: 1 }
    return { min: Math.min(...ts), max: Math.max(...ts) }
  }, [records])
  const activity = useMemo(() => {
    const map = new Map<string, number[]>()
    const N = 20
    for (const r of records) {
      const key = mode === 'session' ? (r.session || '未标记会话') : (r.tag || '未标记工作空间')
      if (!map.has(key)) map.set(key, new Array(N).fill(0))
      const arr = map.get(key)!
      const span = Math.max(1, buckets.max - buckets.min)
      const idx = Math.min(N - 1, Math.max(0, Math.floor(((r.ts - buckets.min) / span) * N)))
      arr[idx] += tok(r)
    }
    return map
  }, [records, mode, buckets])

  const maxBucket = useMemo(() => {
    let m = 0
    for (const arr of activity.values()) for (const v of arr) if (v > m) m = v
    return m
  }, [activity])

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2 mr-auto"><Activity size={16} className="text-indigo-600" /> 工作空间活跃分布</h3>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button className={'px-3 py-1.5 text-xs font-semibold ' + (mode === 'session' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600')}
            onClick={() => setMode('session')}>按会话</button>
          <button className={'px-3 py-1.5 text-xs font-semibold ' + (mode === 'workspace' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600')}
            onClick={() => setMode('workspace')}>按工作空间</button>
        </div>
        {mode === 'session' && (
          <button className="btn btn-sm flex items-center gap-1" onClick={() => setShowTitle(v => !v)}
            title={showTitle ? '点击显示原始会话编码' : '点击显示中文标题'}>
            {showTitle ? <Eye size={13} /> : <EyeOff size={13} />}
            {showTitle ? '中文标题' : '原始编码'}
          </button>
        )}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
          <input className="input !w-40 !pl-7 !py-1.5 !text-xs" placeholder="搜索…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-sm flex items-center gap-1" onClick={() => setSortBy(sortBy === 'tokens' ? 'sessions' : 'tokens')}>
          按{sortBy === 'tokens' ? 'Token' : '会话数'} <ChevronDown size={12} />
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-xs faint py-8">没有可显示的数据</div>
      ) : (
        <div className="space-y-1">
          {(expanded ? rows : rows.slice(0, DEFAULT_ROWS)).map((row, i) => {
            const arr = activity.get(row.name) || []
            const useTitle = mode === 'session' && showTitle && row.title
            const label = useTitle ? row.title! : row.name
            const subLabel = mode === 'session' && useTitle
              ? `${row.sessionsCount} 会话 · ${fmtInt(row.req)} 次 · ${row.name.slice(0, 8)}`
              : `${row.sessionsCount} 会话 · ${fmtInt(row.req)} 次`
            return (
              <div key={row.name} className="flex items-center gap-3 py-1.5 rounded-lg hover:bg-slate-50 px-1.5">
                <span className="w-6 text-[11px] faint mono shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <div className="w-[150px] md:w-[210px] shrink-0 min-w-0">
                  <div className="font-semibold text-xs truncate" title={row.title ? `${row.title} · ${row.name}` : row.name}>
                    {label.length > 26 ? label.slice(0, 24) + '…' : label}
                  </div>
                  <div className="text-[10px] faint truncate" title={subLabel}>{subLabel}</div>
                </div>
                <div className="w-[88px] shrink-0 text-right">
                  <div className="font-bold text-xs kpi-num">{fmtCompact(row.tokens)}</div>
                  <div className="text-[10px] faint">{(row.share * 100).toFixed(1)}%</div>
                </div>
                <div className="flex-1 h-4 flex items-center gap-[1px] min-w-0">
                  {arr.map((v, j) => <div key={j} className="h-3 flex-1 rounded-[2px]" style={{ background: heatColor(v, maxBucket) }} title={`${fmtCompact(v)} tok`} />)}
                </div>
                <span className="tag !text-[10px] shrink-0">{fmtInt(row.sessionsCount)} 会话</span>
              </div>
            )
          })}
        </div>
      )}
      {rows.length > DEFAULT_ROWS && (
        <button className="w-full mt-2 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-1"
          onClick={() => setExpanded(v => !v)}>
          {expanded ? <>收起 <ChevronUp size={13} /></> : <>展开全部 {rows.length} 项 <ChevronDown size={13} /></>}
        </button>
      )}
      <p className="text-[10px] faint mt-2 flex items-center gap-1"><Info size={11} /> 按 Token 或会话数排序，色块表示各时段活跃强度；共 {rows.length} 项</p>
    </div>
  )
}

// ============ 日分布（日期 × 小时热力图） ============
export function DailyHeatmap({ records }: { records: UsageRecord[] }) {
  const data = useMemo(() => {
    const cell = new Map<string, number>()
    const dayTotal = new Map<string, number>()
    for (const r of records) {
      if (!r.ts) continue
      const d = new Date(r.ts)
      const day = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
      const h = d.getHours()
      const k = `${day}|${h}`
      const v = tok(r)
      cell.set(k, (cell.get(k) || 0) + v)
      dayTotal.set(day, (dayTotal.get(day) || 0) + v)
    }
    const days = [...dayTotal.keys()].sort((a, b) => {
      const [am, ad] = a.split('-').map(Number), [bm, bd] = b.split('-').map(Number)
      return am - bm || ad - bd
    }).slice(-14).reverse()
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const segments = [
      { label: '凌晨 0-8', from: 0, to: 8 },
      { label: '上午 8-12', from: 8, to: 12 },
      { label: '下午 12-18', from: 12, to: 18 },
      { label: '晚间 18-24', from: 18, to: 24 },
    ]
    const grand = [...dayTotal.values()].reduce((s, v) => s + v, 0) || 1
    const segStats = segments.map(s => {
      let sum = 0
      for (const [k, v] of cell) {
        const h = Number(k.split('|')[1])
        if (h >= s.from && h < s.to) sum += v
      }
      return { ...s, pct: sum / grand * 100 }
    })
    return { days, hours, cell, segStats }
  }, [records])

  const maxCell = useMemo(() => {
    let m = 0
    for (const v of data.cell.values()) if (v > m) m = v
    return m
  }, [data])

  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2"><CalendarDays size={16} className="text-sky-600" /> 日分布 · 活跃时段</h3>
        <span className="tag">近 {data.days.length} 天 · 按小时</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {data.segStats.map(s => (
          <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="text-[11px] muted">{s.label}</div>
            <div className="font-bold text-base kpi-num">{s.pct.toFixed(1)}%</div>
            <div className="h-1.5 rounded-full bg-slate-200 mt-1.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.pct)}%`, background: 'linear-gradient(90deg,#a5b4fc,#4f46e5)' }} />
            </div>
          </div>
        ))}
      </div>
      {data.days.length === 0 ? (
        <div className="text-center text-xs faint py-8">没有带时间的用量数据</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="flex items-center gap-[2px] mb-1 pl-11">
              {data.hours.map(h => <div key={h} className="flex-1 text-center text-[9px] faint">{h % 2 === 0 ? h : ''}</div>)}
            </div>
            {data.days.map(day => (
              <div key={day} className="flex items-center gap-[2px] mb-[2px]">
                <div className="w-10 text-[10px] faint mono shrink-0">{day}</div>
                {data.hours.map(h => {
                  const v = data.cell.get(`${day}|${h}`) || 0
                  return <div key={h} className="flex-1 h-4 rounded-[2px]" style={{ background: heatColor(v, maxCell) }} title={`${day} ${h}:00 · ${fmtCompact(v)} tok`} />
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] faint mt-3 flex items-center gap-1"><Info size={11} /> 颜色越深表示该时段用量越大，鼠标悬停可看具体数值</p>
    </div>
  )
}

// ============ 单次请求大小分布（模型 ridgeline） ============
export function RequestSizeDistribution({ records }: { records: UsageRecord[] }) {
  const models = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const r of records) {
      if (!map.has(r.model)) map.set(r.model, [])
      map.get(r.model)!.push(tok(r))
    }
    const all = [...map.entries()].map(([name, arr]) => {
      const s = [...arr].sort((a, b) => a - b)
      return { name, count: arr.length, p50: percentile(s, 0.5), p90: percentile(s, 0.9), max: s[s.length - 1], arr: s }
    }).sort((a, b) => b.count - a.count).slice(0, 6)
    return all
  }, [records])

  const globalP50 = useMemo(() => {
    const all = records.map(tok).sort((a, b) => a - b)
    return percentile(all, 0.5)
  }, [records])

  /** 生成平滑密度曲线路径 */
  function densityPath(arr: number[], width: number, height: number): { d: string; x50: number; x90: number; scaleMax: number } {
    if (!arr.length) return { d: '', x50: 0, x90: 0, scaleMax: 1 }
    const p90 = percentile(arr, 0.9)
    const scaleMax = Math.max(1, p90 * 1.25, percentile(arr, 0.5) * 2)
    const BINS = 40
    const bins = new Array(BINS).fill(0)
    for (const v of arr) {
      const idx = Math.min(BINS - 1, Math.floor((v / scaleMax) * BINS))
      bins[Math.max(0, idx)]++
    }
    // 移动平均平滑
    const sm = bins.map((_, i) => {
      let s = 0, n = 0
      for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < BINS) { s += bins[j]; n++ } }
      return s / n
    })
    const peak = Math.max(...sm, 1)
    const pts = sm.map((v, i) => ({ x: (i / (BINS - 1)) * width, y: height - (v / peak) * (height * 0.92) }))
    let d = `M 0 ${height} L ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], cur = pts[i]
      const mx = (prev.x + cur.x) / 2
      d += ` Q ${prev.x} ${prev.y} ${mx} ${(prev.y + cur.y) / 2}`
    }
    d += ` L ${width} ${pts[pts.length - 1].y} L ${width} ${height} Z`
    return { d, x50: (percentile(arr, 0.5) / scaleMax) * width, x90: (percentile(arr, 0.9) / scaleMax) * width, scaleMax }
  }

  const W = 460, H = 34
  const [hover, setHover] = useState<{ model: string; x: number; tok: number } | null>(null)

  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2"><BarChart3 size={16} className="text-emerald-600" /> 单次请求大小分布</h3>
        <span className="tag">TOP {models.length} 模型 · 共 {fmtInt(records.length)} 次</span>
      </div>
      {models.length === 0 ? (
        <div className="text-center text-xs faint py-8">没有请求数据</div>
      ) : (
        <div className="space-y-1.5">
          {models.map(m => {
            const g = densityPath(m.arr, W, H)
            const color = stableColor(m.name)
            return (
              <div key={m.name} className="flex items-center gap-3 py-1 border-b border-slate-50 last:border-0">
                <div className="w-[130px] md:w-[160px] shrink-0 min-w-0">
                  <div className="font-semibold text-xs truncate" title={m.name} style={{ color }}>{m.name}</div>
                  <div className="text-[10px] faint">{fmtInt(m.count)} 次</div>
                </div>
                <div className="w-[110px] shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="faint w-6">50%</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, m.p50 / g.scaleMax * 100)}%`, background: color }} /></div>
                    <span className="mono w-12 text-right">{fmtCompact(m.p50)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] mt-1">
                    <span className="faint w-6">90%</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full opacity-60" style={{ width: `${Math.min(100, m.p90 / g.scaleMax * 100)}%`, background: color }} /></div>
                    <span className="mono w-12 text-right">{fmtCompact(m.p90)}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 relative">
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
                    onMouseMove={e => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                      setHover({ model: m.name, x: ratio * rect.width, tok: ratio * g.scaleMax })
                    }}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: 'crosshair' }}>
                    <line x1="0" y1={H} x2={W} y2={H} stroke="#e2e8f0" strokeWidth="1" />
                    <line x1={(globalP50 / g.scaleMax) * W} y1="0" x2={(globalP50 / g.scaleMax) * W} y2={H} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
                    <path d={g.d} fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.2" />
                    <line x1={g.x50} y1={H * 0.2} x2={g.x50} y2={H} stroke={color} strokeWidth="1.5" />
                    <circle cx={g.x90} cy={H * 0.2} r="2.5" fill={color} />
                    {hover?.model === m.name && <line x1={(hover.tok / g.scaleMax) * W} y1="0" x2={(hover.tok / g.scaleMax) * W} y2={H} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />}
                  </svg>
                  {hover?.model === m.name && (
                    <div className="absolute top-0 z-10 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] mono pointer-events-none whitespace-nowrap"
                      style={{ left: `${Math.min(80, (hover.tok / g.scaleMax) * 100)}%` }}>
                      {fmtCompact(hover.tok)} token
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[10px] faint mt-3 flex items-center gap-1"><Info size={11} /> 每模型一条分布曲线（各自归一）；实线=中位数，圆点=90 分位，虚线=全局中位数 {fmtCompact(globalP50)}；鼠标悬停曲线可看对应 token 量</p>
    </div>
  )
}
