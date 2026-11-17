import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { UsageRecord } from '../types'
import { fmtDate, fmtCompact } from '../lib/format'

const COLORS = ['#4f46e5', '#e0524d', '#0ea5e9', '#16a34a', '#f59e0b', '#9333ea', '#14b8a6', '#ec4899', '#6366f1', '#84cc16']

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

export function VendorPieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => ['¥' + Number(v).toFixed(2), '成本']} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#5b6678' }} />
      </PieChart>
    </ResponsiveContainer>
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
        {vendors.map((v, i) => <Bar key={v} dataKey={v} stackId="a" fill={COLORS[i % COLORS.length]} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}
