import { useMemo, useState } from 'react'
import {
  History, Trash2, Pencil, Check, X, Database, AlertTriangle, Eye,
  Coins, Zap, Activity, MessageSquare, Repeat, Percent, ShieldCheck, LayoutDashboard,
} from 'lucide-react'
import type { ImportBatch } from '../lib/storage'
import type { UsageRecord, Price } from '../types'
import { fmtInt, fmtCompact, fmtMoney } from '../lib/format'
import { matchPrice, calcCost, toCNY, aggregate } from '../lib/pricing'

interface Props {
  batches: ImportBatch[]
  prices: Record<string, Price>
  rate: number
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onClearAll: () => void
  onOpenBatch: (ids: string[]) => void
}

const tok = (r: UsageRecord) => r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning

/** 单批次详情弹窗：复用首页 7 项 KPI 与逐模型表口径 */
function BatchDetail({ batch, prices, rate, onClose, onOpenInDashboard }: { batch: ImportBatch; prices: Record<string, Price>; rate: number; onClose: () => void; onOpenInDashboard: () => void }) {
  const recs = batch.records
  const aggs = useMemo(() => aggregate(recs, prices, rate), [recs, prices, rate])
  const s = useMemo(() => {
    const totalToken = recs.reduce((a, r) => a + tok(r), 0)
    const cacheWrite = recs.reduce((a, r) => a + r.cacheWrite, 0)
    const sessions = new Set(recs.filter(r => r.session).map(r => r.session)).size || (recs.length ? 1 : 0)
    const input = recs.reduce((a, r) => a + r.input, 0)
    const output = recs.reduce((a, r) => a + r.output + r.reasoning, 0)
    const cacheRead = recs.reduce((a, r) => a + r.cacheRead, 0)
    const hitRate = cacheRead + input > 0 ? cacheRead / (cacheRead + input) : 0
    const ioRatio = output > 0 ? (input + cacheRead + cacheWrite) / output : 0
    let totalCost = 0
    for (const r of recs) totalCost += toCNY(calcCost(r, matchPrice(r.model, prices).price), rate)
    return { totalToken, cacheWrite, sessions, input, output, cacheRead, hitRate, ioRatio, totalCost }
  }, [recs, prices, rate])

  const kpis = [
    { icon: <Zap size={16} />, label: '总 TOKEN', value: fmtCompact(s.totalToken), sub: `${fmtInt(s.totalToken)} 枚`, color: '#4f46e5' },
    { icon: <Activity size={16} />, label: '活跃（缓存写入）', value: fmtCompact(s.cacheWrite), sub: `${fmtInt(s.cacheWrite)} tok`, color: '#e0524d' },
    { icon: <MessageSquare size={16} />, label: '会话', value: fmtInt(s.sessions), sub: '个独立会话', color: '#0ea5e9' },
    { icon: <Repeat size={16} />, label: '请求', value: fmtInt(recs.length), sub: `${aggs.length} 个模型`, color: '#8b5cf6' },
    { icon: <Repeat size={16} />, label: '输入 / 输出', value: `${s.ioRatio.toFixed(0)} : 1`, sub: `入 ${fmtCompact(s.input + s.cacheRead + s.cacheWrite)} · 出 ${fmtCompact(s.output)}`, color: '#0891b2' },
    { icon: <Percent size={16} />, label: '缓存命中率', value: `${(s.hitRate * 100).toFixed(1)}%`, sub: `命中 ${fmtCompact(s.cacheRead)} tok`, color: '#16a34a' },
    { icon: <Coins size={16} />, label: '费用估算', value: fmtMoney(s.totalCost), sub: '按官方单价计算', color: '#ea580c' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 flex items-start gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate">{batch.name}</div>
            <div className="text-[11px] faint">导入于 {new Date(batch.createdAt).toLocaleString('zh-CN')} · {fmtInt(batch.count)} 条请求</div>
          </div>
          <button className="btn btn-primary btn-sm flex items-center gap-1" onClick={onOpenInDashboard}>
            <LayoutDashboard size={14} /> 在总览看板中查看
          </button>
          <button className="btn !px-2" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {kpis.map((k, i) => (
              <div key={i} className={'rounded-xl border border-slate-200 p-3 ' + (i === 6 ? 'md:col-span-2' : '')}>
                <div className="text-[11px] muted flex items-center gap-1.5" style={{ color: k.color }}>{k.icon}{k.label}</div>
                <div className="kpi-num text-xl font-bold mt-1" style={{ color: k.color }}>{k.value}</div>
                <div className="text-[10px] faint mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="dt">
              <thead><tr>
                <th>模型 / 厂商</th><th>请求</th><th>输入</th><th>输出</th><th>缓存命中</th><th>缓存写入</th><th>总 Token</th><th>费用 ¥</th>
              </tr></thead>
              <tbody>
                {aggs.map(a => (
                  <tr key={a.model}>
                    <td><div className="font-semibold">{a.model}</div><div className="text-[11px] faint">{a.vendor}</div></td>
                    <td>{fmtInt(a.records)}</td>
                    <td>{fmtCompact(a.input)}</td>
                    <td>{fmtCompact(a.output + a.reasoning)}</td>
                    <td>{fmtCompact(a.cacheRead)}</td>
                    <td>{fmtCompact(a.cacheWrite)}</td>
                    <td className="font-semibold">{fmtCompact(a.totalTokens)}</td>
                    <td className="font-bold text-green-700">{fmtMoney(a.costCNY)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-800">
            <ShieldCheck size={14} className="shrink-0" />
            这是你保存的历史数据，仍只存在本机浏览器，未上传任何服务器。
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BatchHistory({ batches, prices, rate, onRemove, onRename, onClearAll, onOpenBatch }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [viewing, setViewing] = useState<ImportBatch | null>(null)

  const totalRecords = batches.reduce((s, b) => s + b.count, 0)
  const totalTokens = batches.reduce((s, b) => s + b.records.reduce((t, r) => t + tok(r), 0), 0)

  function startEdit(b: ImportBatch) { setEditing(b.id); setDraft(b.name) }
  function saveEdit(id: string) { if (draft.trim()) onRename(id, draft.trim()); setEditing(null) }

  return (
    <>
      <div className="card">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <History size={16} className="text-indigo-600" />
          <div className="flex-1">
            <div className="font-bold text-sm">已保存的数据</div>
            <div className="text-[11px] faint">点「查看」可随时打开历史数据，刷新网页也不会丢失</div>
          </div>
          {batches.length > 0 && (
            <button className="btn btn-ghost btn-sm text-red-600" onClick={onClearAll}><Trash2 size={13} /> 清空</button>
          )}
        </div>

        {batches.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs faint">
            <Database size={22} className="mx-auto mb-2 text-slate-300" />
            还没有保存的数据。导入一次日志后，这里会保留记录，刷新也不会丢。
          </div>
        ) : (
          <div className="p-3">
            <div className="flex gap-3 mb-3 px-1">
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 flex-1">
                <div className="text-[10px] faint">数据批次</div>
                <div className="font-bold text-base kpi-num">{batches.length}</div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 flex-1">
                <div className="text-[10px] faint">请求记录</div>
                <div className="font-bold text-base kpi-num">{fmtInt(totalRecords)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 flex-1">
                <div className="text-[10px] faint">总 Token</div>
                <div className="font-bold text-base kpi-num">{fmtCompact(totalTokens)}</div>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[280px] overflow-auto">
              {batches.map(b => (
                <div key={b.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <button className="flex-1 min-w-0 text-left" onClick={() => setViewing(b)} title="点击查看该批数据">
                    {editing === b.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input className="input !py-1 !text-xs" value={draft} autoFocus
                          onChange={e => setDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(b.id); if (e.key === 'Escape') setEditing(null) }} />
                        <button className="btn btn-sm !px-1.5" onClick={() => saveEdit(b.id)}><Check size={13} /></button>
                        <button className="btn btn-ghost btn-sm !px-1.5" onClick={() => setEditing(null)}><X size={13} /></button>
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-xs truncate text-indigo-700 hover:underline" title={b.name}>{b.name}</div>
                        <div className="text-[10px] faint">
                          {new Date(b.createdAt).toLocaleString('zh-CN')} · {fmtInt(b.count)} 条 · 点击查看
                        </div>
                      </>
                    )}
                  </button>
                  <button className="btn btn-sm !px-2 flex items-center gap-1" onClick={() => setViewing(b)} title="查看历史数据">
                    <Eye size={13} /> 查看
                  </button>
                  <button className="btn btn-sm btn-primary !px-2 flex items-center gap-1" onClick={() => onOpenBatch([b.id])} title="在总览看板中查看该批数据">
                    <LayoutDashboard size={13} /> 看板
                  </button>
                  <button className="btn btn-ghost btn-sm !px-1.5" title="重命名" onClick={() => startEdit(b)}><Pencil size={13} className="text-slate-400" /></button>
                  <button className="btn btn-ghost btn-sm !px-1.5" title="删除该批" onClick={() => onRemove(b.id)}><Trash2 size={13} className="text-red-500" /></button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-start gap-1.5 text-[10px] faint">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>数据仅存于当前浏览器，不上传服务器。换电脑、换浏览器或清理浏览器数据会丢失；重要数据请保留原始日志文件。</span>
            </div>
          </div>
        )}
      </div>

      {viewing && (
        <BatchDetail
          batch={viewing} prices={prices} rate={rate}
          onClose={() => setViewing(null)}
          onOpenInDashboard={() => { onOpenBatch([viewing.id]); setViewing(null) }}
        />
      )}
    </>
  )
}
