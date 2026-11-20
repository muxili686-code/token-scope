import { useMemo, useState } from 'react'
import {
  Coins, Zap, Layers3, Percent, Info, RefreshCw, FolderOpen, CalendarRange, Download, FileSpreadsheet, Image as ImageIcon, Database, ChevronDown, Check, MessageSquare, Activity,
} from 'lucide-react'
import { exportAggsCSV, exportRecordsCSV, exportReportPNG } from '../lib/export'
import type { UsageRecord, ModelAgg } from '../types'
import type { ImportBatch } from '../lib/storage'
import { fmtInt, fmtCompact, fmtMoney, fmtDateTime } from '../lib/format'
import { DailyCostChart, VendorPieChart, DailyTokenStack, TokenComposition, CostTreemap, ToolRanking } from './Charts'
import { WorkspaceDistribution, DailyHeatmap, RequestSizeDistribution, SessionTable } from './AnalysisPanels'

interface Props {
  records: UsageRecord[]
  aggs: ModelAgg[]
  batches: ImportBatch[]
  selectedIds: string[]
  onSelectBatches: (ids: string[]) => void
  onGoSource: () => void
}

type Range = 'all' | '1' | '3' | '7' | '30' | 'custom'

function Kpi({ icon, label, value, sub, accent }: any) {
  return (
    <div className="card card-pad flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: accent + '18', color: accent }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs muted mb-1">{label}</div>
        <div className="kpi-num text-[22px] font-bold leading-tight">{value}</div>
        {sub && <div className="text-[11px] faint mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function Dashboard({ records, aggs, batches, selectedIds, onSelectBatches, onGoSource }: Props) {
  const [range, setRange] = useState<Range>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)

  const sourceLabel = selectedIds.length === 0 ? '全部数据'
    : selectedIds.length === 1 ? (batches.find(b => b.id === selectedIds[0])?.name || '历史数据')
    : `${selectedIds.length} 个批次`

  function toggleBatch(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]
    onSelectBatches(next)
  }

  // 以数据中最新时间为锚（导入的多是历史日志，用电脑当前时间会筛空）
  const anchor = useMemo(() => {
    const ts = records.map(r => r.ts).filter(t => t > 0)
    return ts.length ? Math.max(...ts) : 0
  }, [records])

  const filtered = useMemo(() => {
    if (range === 'all' || !anchor) return records
    if (range === 'custom') {
      const from = customFrom ? new Date(customFrom + 'T00:00:00').getTime() : 0
      const to = customTo ? new Date(customTo + 'T23:59:59').getTime() : Infinity
      return records.filter(r => r.ts >= from && r.ts <= to)
    }
    const days = Number(range)
    const cutoff = anchor - days * 86400_000
    return records.filter(r => r.ts >= cutoff)
  }, [records, range, anchor, customFrom, customTo])

  // 筛选后重算聚合与成本（按每条记录摊分）
  const scoped = useMemo(() => {
    const costByModel = new Map<string, number>()
    for (const a of aggs) costByModel.set(a.model, a.records ? a.costCNY / a.records : 0)
    const costOf = (r: UsageRecord) => costByModel.get(r.model) || 0
    const totalCost = filtered.reduce((s, r) => s + costOf(r), 0)
    return { costOf, totalCost }
  }, [aggs, filtered])

  const stats = useMemo(() => {
    const totalTokens = filtered.reduce((s, r) => s + r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning, 0)
    const cacheHit = filtered.reduce((s, r) => s + r.cacheRead, 0)
    const cacheTotal = cacheHit + filtered.reduce((s, r) => s + r.input, 0)
    const hitRate = cacheTotal > 0 ? cacheHit / cacheTotal : 0
    return { totalTokens, totalCost: scoped.totalCost, hitRate, cacheHit }
  }, [filtered, scoped])

  const vendorCost = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filtered) map.set(r.vendor, (map.get(r.vendor) || 0) + scoped.costOf(r))
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filtered, scoped])

  const vendorTokens = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filtered) map.set(r.vendor, (map.get(r.vendor) || 0) + (r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning))
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filtered])

  // 筛选后按模型的明细
  const scopedAggs = useMemo(() => {
    const map = new Map<string, ModelAgg>()
    for (const r of filtered) {
      if (!map.has(r.model)) map.set(r.model, {
        model: r.model, vendor: r.vendor, records: 0, input: 0, output: 0,
        cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0,
        costCNY: 0, currency: 'CNY', rawCost: 0,
      })
      const a = map.get(r.model)!
      a.records++; a.input += r.input; a.output += r.output; a.cacheRead += r.cacheRead
      a.cacheWrite += r.cacheWrite; a.reasoning += r.reasoning
      a.totalTokens += r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning
      a.costCNY += scoped.costOf(r)
    }
    return [...map.values()].sort((a, b) => b.costCNY - a.costCNY)
  }, [filtered, scoped])

  if (records.length === 0) {
    return (
      <div className="card card-pad flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Layers3 size={26} />
        </div>
        <h2 className="text-lg font-bold mb-1">还没有数据</h2>
        <p className="muted mb-5 max-w-md">在「数据接入」选择日志文件、整个目录或账单，即可自动识别并查看用量与成本。</p>
        <button className="btn btn-primary" onClick={onGoSource}>去接入数据</button>
      </div>
    )
  }

  const ranges: Array<{ id: Range; label: string }> = [
    { id: 'all', label: '全部' }, { id: '1', label: '1 天' }, { id: '3', label: '3 天' },
    { id: '7', label: '近 7 天' }, { id: '30', label: '近 30 天' }, { id: 'custom', label: '自定义' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* 工具栏：时间范围 + 重新接入 */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-sm flex items-center gap-1" onClick={onGoSource} title="返回数据接入重新选择文件">
            <FolderOpen size={13} /> 重选文件
          </button>
          <button className="btn btn-sm flex items-center gap-1" onClick={onGoSource} title="重新选择文件并导入">
            <RefreshCw size={13} /> 重新扫描
          </button>
          <span className="w-px h-5 bg-slate-200 mx-1" />
          {/* 数据源选择：可切换/组合历史批次 */}
          <div className="relative">
            <button className="btn btn-sm flex items-center gap-1.5" onClick={() => setSourceOpen(v => !v)}>
              <Database size={13} className="text-indigo-600" />
              <span className="max-w-[160px] truncate">{sourceLabel}</span>
              <ChevronDown size={12} />
            </button>
            {sourceOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSourceOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-20 w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl p-2 max-h-[340px] overflow-auto">
                  <div className="text-[10px] faint px-2 py-1">选择要看的数据（可多选组合）</div>
                  <button className={'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left hover:bg-slate-50 ' + (selectedIds.length === 0 ? 'bg-indigo-50 text-indigo-700 font-semibold' : '')}
                    onClick={() => { onSelectBatches([]); setSourceOpen(false) }}>
                    <span className={'w-4 h-4 rounded border flex items-center justify-center ' + (selectedIds.length === 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300')}>
                      {selectedIds.length === 0 && <Check size={11} />}
                    </span>
                    全部数据
                    <span className="ml-auto faint">{fmtInt(batches.reduce((s, b) => s + b.count, 0))} 条</span>
                  </button>
                  <div className="h-px bg-slate-100 my-1" />
                  {batches.map(b => {
                    const on = selectedIds.includes(b.id)
                    return (
                      <button key={b.id} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left hover:bg-slate-50"
                        onClick={() => toggleBatch(b.id)}>
                        <span className={'w-4 h-4 rounded border flex items-center justify-center shrink-0 ' + (on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300')}>
                          {on && <Check size={11} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate font-medium">{b.name}</span>
                          <span className="block text-[10px] faint">{new Date(b.createdAt).toLocaleString('zh-CN')} · {fmtInt(b.count)} 条</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <CalendarRange size={15} className="text-slate-400" />
          {ranges.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={'px-3 py-1.5 rounded-lg text-xs font-semibold transition ' +
                (range === r.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100')}>
              {r.label}
            </button>
          ))}
          {range === 'custom' && (
            <div className="flex items-center gap-1.5 ml-1">
              <input type="date" className="input !w-36 !py-1 !text-xs" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span className="text-xs faint">至</span>
              <input type="date" className="input !w-36 !py-1 !text-xs" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}
          <span className="ml-auto text-[11px] faint hidden md:inline">
            数据截至 {anchor ? fmtDateTime(anchor) : '—'} · 当前显示 {fmtInt(filtered.length)} / {fmtInt(records.length)} 条
          </span>
          <span className="w-px h-5 bg-slate-200 mx-1" />
          <div className="flex items-center gap-1">
            <Download size={13} className="text-slate-400" />
            <button className="btn btn-sm !px-2" title="导出报告图片"
              onClick={() => exportReportPNG({
                totalCost: stats.totalCost, totalTokens: stats.totalTokens,
                requests: filtered.length, models: scopedAggs.length, hitRate: stats.hitRate,
                aggs: scopedAggs,
              })}><ImageIcon size={13} /> 报告图</button>
            <button className="btn btn-sm !px-2" title="导出逐模型明细 CSV"
              onClick={() => exportAggsCSV(scopedAggs)}><FileSpreadsheet size={13} /> 模型CSV</button>
            <button className="btn btn-sm !px-2" title="导出逐条用量 CSV"
              onClick={() => exportRecordsCSV(filtered)}><FileSpreadsheet size={13} /> 明细CSV</button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<Coins size={18} />} accent="#4f46e5" label="总费用" value={fmtMoney(stats.totalCost)} sub="按官方单价计算" />
        <Kpi icon={<Zap size={18} />} accent="#e0524d" label="总 Token" value={fmtCompact(stats.totalTokens)} sub={`${fmtInt(stats.totalTokens)} 枚`} />
        <Kpi icon={<Layers3 size={18} />} accent="#0ea5e9" label="请求 / 模型" value={`${fmtInt(filtered.length)} / ${scopedAggs.length}`} sub="条记录 / 个模型" />
        <Kpi icon={<Percent size={18} />} accent="#16a34a" label="缓存命中率" value={`${(stats.hitRate * 100).toFixed(1)}%`} sub={`命中 ${fmtCompact(stats.cacheHit)} tok`} />
        <Kpi icon={<MessageSquare size={18} />} accent="#8b5cf6" label="会话" value={fmtInt(new Set(filtered.filter(r => r.session).map(r => r.session)).size || (filtered.length ? 1 : 0))} sub="个独立会话" />
        <Kpi icon={<Activity size={18} />} accent="#f59e0b" label="工具调用" value={fmtInt(filtered.filter(r => r.tool).length)} sub="次工具/命令调用" />
      </div>

      {/* 活跃分布 + 日分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <WorkspaceDistribution records={filtered} />
        <DailyHeatmap records={filtered} />
      </div>

      {/* 单次请求大小分布 */}
      <RequestSizeDistribution records={filtered} />

      {/* 趋势 + 占比 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card card-pad lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm">每日成本趋势</h3>
            <span className="tag">按天 · 人民币</span>
          </div>
          <DailyCostChart records={filtered} costOf={scoped.costOf} />
        </div>
        <div className="card card-pad">
          <h3 className="font-bold text-sm mb-2">厂商费用 / Token 占比</h3>
          <VendorPieChart data={vendorCost} tokenData={vendorTokens} />
        </div>
      </div>

      {/* Token 构成 + 费用构成 Treemap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <h3 className="font-bold text-sm mb-3">Token 构成</h3>
          <TokenComposition records={filtered} />
        </div>
        <div className="card card-pad">
          <h3 className="font-bold text-sm mb-2">费用构成</h3>
          <CostTreemap records={filtered} costOf={scoped.costOf} />
        </div>
      </div>

      {/* 工具调用排行 + 会话明细 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <h3 className="font-bold text-sm mb-2">工具 / 命令调用</h3>
          <ToolRanking records={filtered} costOf={scoped.costOf} />
        </div>
        <div className="card card-pad">
          <h3 className="font-bold text-sm mb-2">会话明细</h3>
          <SessionTable records={filtered} costOf={scoped.costOf} />
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm">每日 Token 用量（按厂商堆叠）</h3>
          <span className="tag">token / 天</span>
        </div>
        <DailyTokenStack records={filtered} />
      </div>

      {/* 按模型明细 */}
      <div className="card card-pad overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">按模型明细</h3>
          <span className="tag flex gap-1"><Info size={11} /> 按输入/输出/缓存分别计价</span>
        </div>
        <table className="dt">
          <thead>
            <tr>
              <th>模型</th><th>请求</th><th>输入</th><th>输出</th><th>缓存命中</th>
              <th>总 Token</th><th>费用 ¥</th>
            </tr>
          </thead>
          <tbody>
            {scopedAggs.map(a => (
              <tr key={a.model}>
                <td>
                  <div className="font-semibold">{a.model}</div>
                  <div className="text-[11px] faint">{a.vendor}</div>
                </td>
                <td>{fmtInt(a.records)}</td>
                <td>{fmtCompact(a.input)}</td>
                <td>{fmtCompact(a.output)}</td>
                <td>{fmtCompact(a.cacheRead)}</td>
                <td className="font-semibold">{fmtCompact(a.totalTokens)}</td>
                <td className="font-bold">{fmtMoney(a.costCNY)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
