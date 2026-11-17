import { useMemo, useRef, useState } from 'react'
import {
  UploadCloud, FolderOpen, Loader2, CheckCircle2, X, Trash2,
  Coins, Zap, Activity, MessageSquare, Repeat, Percent, ArrowRight,
  Info, AlertTriangle, ShieldCheck, ChevronRight, FlaskConical,
} from 'lucide-react'
import type { UsageRecord, Price } from '../types'
import { parseBillFile } from '../lib/parsers'
import { matchPrice, calcCost, toCNY, aggregate } from '../lib/pricing'
import { fmtInt, fmtCompact, fmtMoney } from '../lib/format'
import { makeDemoRecords } from '../data/demo'
import { isZstd, isSQLite, parseZstdLog, parseSQLiteDB } from '../lib/binary'
import AgentLocations from './AgentLocations'
import BillingGuide from './BillingGuide'
import BatchHistory from './BatchHistory'
import type { ImportBatch } from '../lib/storage'

interface Props {
  prices: Record<string, Price>
  rate: number
  batches: ImportBatch[]
  onData: (records: UsageRecord[], name?: string) => void
  onToast: (msg: string) => void
  onGoDashboard: () => void
  onGoPrices: () => void
  onRemoveBatch: (id: string) => void
  onRenameBatch: (id: string, name: string) => void
  onClearAll: () => void
  onOpenBatch: (ids: string[]) => void
}

interface FileStat { name: string; count: number }

export default function FileAnalysis({ prices, rate, batches, onData, onToast, onGoDashboard, onGoPrices, onRemoveBatch, onRenameBatch, onClearAll, onOpenBatch }: Props) {
  const [records, setRecords] = useState<UsageRecord[]>([])
  const [files, setFiles] = useState<FileStat[]>([])
  const [parsing, setParsing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [showBilling, setShowBilling] = useState(false)
  const dirRef = useRef<HTMLInputElement>(null)

  function loadDemo() {
    const recs = makeDemoRecords()
    setRecords(prev => [...prev, ...recs])
    setFiles(prev => [...prev, { name: '演示数据', count: recs.length }])
    onData(recs, '演示数据')
    onToast(`已载入演示数据 · ${fmtInt(recs.length)} 条`)
    setTimeout(onGoDashboard, 400)
  }

  async function handleFiles(input: FileList | File[]) {
    const arr = Array.from(input).filter(f => /\.(jsonl|json|csv|tsv|log|txt|zstd|db|sqlite|vscdb)$/i.test(f.name))
    if (!arr.length) { onToast('未找到可识别的文件（支持 .jsonl/.json/.csv/.zstd/.db）'); return }
    setParsing(true)
    try {
      const added: UsageRecord[] = []
      const stats: FileStat[] = []
      for (const f of arr) {
        let recs: UsageRecord[] = []
        const ab = await f.arrayBuffer()
        const bytes = new Uint8Array(ab)
        if (isZstd(bytes)) {
          recs = parseZstdLog(bytes)
        } else if (isSQLite(bytes)) {
          recs = await parseSQLiteDB(bytes)
        } else {
          const text = new TextDecoder().decode(bytes)
          recs = parseBillFile(f.name, text)
        }
        if (recs.length) {
          added.push(...recs)
          stats.push({ name: f.name, count: recs.length })
        } else {
          stats.push({ name: f.name, count: 0 })
        }
      }
      if (!added.length) {
        onToast('文件里没解析出用量。请确认是含 usage/token 字段的会话日志或账单')
      } else {
        setRecords(prev => [...prev, ...added])
        setFiles(prev => [...prev, ...stats])
        const label = arr.length === 1 ? arr[0].name : `${arr[0].name} 等 ${arr.length} 个文件`
        onData(added, label)
        const models = new Set(added.map(r => r.model)).size
        onToast(`识别 ${fmtInt(added.length)} 条请求 · ${models} 个模型，正在打开看板…`)
        // 分析完成直接跳到总览看板，避免停留在本页的长结果区
        setTimeout(onGoDashboard, 400)
      }
    } catch (e: any) {
      onToast('解析失败：' + (e?.message || '未知错误'))
    } finally {
      setParsing(false)
    }
  }

  function parsePaste() {
    if (!pasteText.trim()) return
    const recs = parseBillFile('pasted.jsonl', pasteText)
    if (!recs.length) { onToast('粘贴内容里没解析出用量'); return }
    setRecords(prev => [...prev, ...recs])
    setFiles(prev => [...prev, { name: '粘贴内容', count: recs.length }])
    onData(recs, '粘贴内容')
    onToast(`识别 ${fmtInt(recs.length)} 条请求 · ${new Set(recs.map(r => r.model)).size} 个模型，正在打开看板…`)
    setPasteText(''); setShowPaste(false)
    setTimeout(onGoDashboard, 400)
  }

  function clearAll() {
    setRecords([]); setFiles([]); setPasteText('')
    if (batches.length) onClearAll()
    else onToast('已清空')
  }

  const aggs = useMemo(() => aggregate(records, prices, rate), [records, prices, rate])

  const stats = useMemo(() => {
    const totalToken = records.reduce((s, r) => s + r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning, 0)
    const cacheWrite = records.reduce((s, r) => s + r.cacheWrite, 0)
    const sessions = new Set(records.filter(r => r.session).map(r => r.session)).size || (records.length ? 1 : 0)
    const input = records.reduce((s, r) => s + r.input, 0)
    const output = records.reduce((s, r) => s + r.output + r.reasoning, 0)
    const cacheRead = records.reduce((s, r) => s + r.cacheRead, 0)
    const hitRate = cacheRead + input > 0 ? cacheRead / (cacheRead + input) : 0
    // 成本按分项拆开算，统一折算人民币
    let costIn = 0, costOut = 0, costRead = 0, costWrite = 0, costTotal = 0
    for (const r of records) {
      const mp = matchPrice(r.model, prices)
      const c = calcCost(r, mp.price)
      costIn += toCNY({ ...c, total: c.inputCost }, rate)
      costOut += toCNY({ ...c, total: c.outputCost }, rate)
      costRead += toCNY({ ...c, total: c.cacheReadCost }, rate)
      costWrite += toCNY({ ...c, total: c.cacheWriteCost }, rate)
      costTotal += toCNY(c, rate)
    }
    // 输入输出比按「含缓存的总输入 : 输出」口径，与参考站看板一致
    const totalInputForRatio = input + cacheRead + cacheWrite
    const ioRatio = output > 0 ? totalInputForRatio / output : 0
    return { totalToken, cacheWrite, sessions, input, output, cacheRead, hitRate, ioRatio,
             costIn, costOut, costRead, costWrite, costTotal }
  }, [records, prices, rate, aggs])

  return (
    <div className="flex flex-col gap-4">
      {/* ===== 数据安全提示（放在最前，第一眼看到） ===== */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-emerald-700" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm text-emerald-900">数据安全：所有内容只留在你的设备上</div>
          <div className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
            文件解析、用量统计、价格计算<b>全部在你的浏览器本地完成，不上传、不联网、不经过任何服务器</b>。
            导入的数据只保存在本机浏览器中，随时可清除。请放心使用。
          </div>
        </div>
        <span className="tag !bg-white !border-emerald-200 !text-emerald-700 shrink-0 hidden sm:inline-flex">100% 本地运行</span>
      </div>

      {/* ===== 文件选择区 ===== */}
      <div className="card card-pad">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2"><FolderOpen size={18} className="text-indigo-600" /> 选择用量日志，自动识别模型与成本</h2>
            <p className="muted text-xs mt-1">本地解析不上传，自动识别模型与用量，按官方单价计费。</p>
          </div>
          {records.length > 0 && <button className="btn btn-ghost btn-sm shrink-0" onClick={clearAll}><Trash2 size={13} /> 清空</button>}
        </div>

        <input ref={dirRef} type="file" {...{ webkitdirectory: '', directory: '' } as any} multiple className="hidden"
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />

        <div className={'dropzone mb-0 ' + (dragging ? 'active' : '')}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}>
          {parsing ? <Loader2 size={28} className="mx-auto mb-2 text-indigo-500 animate-spin" />
                    : <UploadCloud size={28} className="mx-auto mb-2 text-indigo-500" />}
          <div className="font-semibold text-sm mb-1">{parsing ? '正在解析…' : '拖拽日志文件 / 整个日志目录到这里'}</div>
          <div className="text-[11px] faint mb-3">可一次拖入多个 · 自动识别模型与用量 · 完成后自动打开看板</div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button className="btn btn-primary btn-sm" disabled={parsing} onClick={() => dirRef.current?.click()}>
              <FolderOpen size={14} /> 选择日志目录
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPaste(v => !v)}>
              {showPaste ? '收起' : '粘贴文本'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowBilling(v => !v)}>
              {showBilling ? '收起' : 'API 导入'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={loadDemo}>
              <FlaskConical size={14} /> 演示数据
            </button>
          </div>
        </div>

        {showBilling && <BillingGuide onToast={onToast} />}

        {showPaste && (
          <div className="mt-3">
            <textarea className="textarea" placeholder={'可直接粘贴 JSONL 日志行或账单 CSV，例如：\n{"type":"function_call","providerData":{"model":"gpt-5","rawUsage":{"prompt_tokens":1200,"completion_tokens":340,"prompt_cache_hit_tokens":800}}}\n…'}
              value={pasteText} onChange={e => setPasteText(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <button className="btn btn-primary btn-sm" onClick={parsePaste} disabled={!pasteText.trim()}><CheckCircle2 size={13} /> 解析文本</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setPasteText(''); setShowPaste(false) }}><X size={13} /> 取消</button>
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className="text-[11px] faint">已载入 {files.length} 个来源：</span>
            {files.map((f, i) => (
              <span key={i} className={'tag ' + (f.count ? '' : 'opacity-50')} title={f.name}>
                {f.count ? <CheckCircle2 size={11} className="text-green-600" /> : <AlertTriangle size={11} className="text-amber-500" />}
                {f.name.length > 28 ? f.name.slice(0, 26) + '…' : f.name} · {f.count ? fmtInt(f.count) + ' 条' : '无用量'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ===== 已保存的数据批次 ===== */}
      <BatchHistory batches={batches} prices={prices} rate={rate} onRemove={onRemoveBatch} onRename={onRenameBatch} onClearAll={onClearAll} onOpenBatch={onOpenBatch} />

      {/* ===== 常用 Agent 日志位置指南 ===== */}
      <AgentLocations />

      {/* ===== 空状态 ===== */}
      {records.length === 0 && (
        <div className="card card-pad text-center py-14">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Activity size={26} />
          </div>
          <h3 className="font-bold mb-1">还没有识别到数据</h3>
          <p className="muted text-sm max-w-lg mx-auto mb-4">
            在上面选择日志文件后，这里会自动识别出用了哪些模型、各消耗多少 token，并按官方价格算费用。
          </p>
          <button className="btn btn-primary" onClick={() => dirRef.current?.click()}><FolderOpen size={15} /> 选择日志目录</button>
        </div>
      )}

      {/* ===== 结果 ===== */}
      {records.length > 0 && (
        <>
          {/* 7 个 KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<Zap size={18} />} accent="#4f46e5" label="总 TOKEN" value={fmtCompact(stats.totalToken)}
              sub={`${fmtInt(stats.totalToken)} 枚`} />
            <Kpi icon={<Activity size={18} />} accent="#e0524d" label="活跃（缓存写入）" value={fmtCompact(stats.cacheWrite)}
              sub={`${fmtInt(stats.cacheWrite)} tok`} />
            <Kpi icon={<MessageSquare size={18} />} accent="#0ea5e9" label="会话" value={fmtInt(stats.sessions)}
              sub="个独立会话" />
            <Kpi icon={<Repeat size={18} />} accent="#8b5cf6" label="请求" value={fmtInt(records.length)}
              sub={`${aggs.length} 个模型`} />
            <Kpi icon={<ArrowRight size={18} />} accent="#0891b2" label="输入 / 输出" value={`${stats.ioRatio.toFixed(0)} : 1`}
              sub={`入 ${fmtCompact(stats.input + stats.cacheRead + stats.cacheWrite)} · 出 ${fmtCompact(stats.output)}`} />
            <Kpi icon={<Percent size={18} />} accent="#16a34a" label="缓存命中率" value={`${(stats.hitRate * 100).toFixed(1)}%`}
              sub={`命中 ${fmtCompact(stats.cacheRead)} tok`} />
            <Kpi icon={<Coins size={18} />} accent="#ea580c" label="费用估算" value={fmtMoney(stats.costTotal)}
              sub="按官方单价计算" wide big />
          </div>

          {/* 成本拆分 */}
          <div className="card card-pad">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2"><Coins size={16} className="text-orange-500" /> 成本拆分（输入 / 输出 / 缓存分别计价）</h3>
              <button className="btn btn-ghost btn-sm" onClick={onGoPrices}>价格明细 <ChevronRight size={13} /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <CostCell label="输入" value={stats.costIn} pct={stats.costTotal ? stats.costIn / stats.costTotal : 0} color="#4f46e5" />
              <CostCell label="输出" value={stats.costOut} pct={stats.costTotal ? stats.costOut / stats.costTotal : 0} color="#8b5cf6" />
              <CostCell label="缓存命中" value={stats.costRead} pct={stats.costTotal ? stats.costRead / stats.costTotal : 0} color="#16a34a" />
              <CostCell label="缓存写入" value={stats.costWrite} pct={stats.costTotal ? stats.costWrite / stats.costTotal : 0} color="#e0524d" />
            </div>
            <p className="text-[11px] faint mt-3 flex items-start gap-1">
              <Info size={12} className="mt-0.5 shrink-0" />
              费用按各模型官方单价计算，缓存命中的单价远低于常规输入，故高命中率时费用较低。实际费用以平台账单为准。
            </p>
          </div>

          {/* 逐模型明细 */}
          <div className="card card-pad overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">按模型识别的用量与成本</h3>
              <span className="tag flex gap-1"><ShieldCheck size={11} className="text-green-600" /> 官方单价 · 人民币</span>
            </div>
            <table className="dt">
              <thead>
                <tr>
                  <th>模型 / 厂商</th><th>请求</th><th>输入</th><th>输出</th><th>缓存命中</th>
                  <th>缓存写入</th><th>总 Token</th><th>占比</th><th>单价 入/出/缓</th><th>费用 ¥</th>
                </tr>
              </thead>
              <tbody>
                {aggs.map(a => {
                  const mp = matchPrice(a.model, prices)
                  return (
                    <tr key={a.model}>
                      <td>
                        <div className="font-semibold">{a.model}</div>
                        <div className="text-[11px] faint">{a.vendor}</div>
                      </td>
                      <td>{fmtInt(a.records)}</td>
                      <td>{fmtCompact(a.input)}</td>
                      <td>{fmtCompact(a.output + a.reasoning)}</td>
                      <td>{fmtCompact(a.cacheRead)}</td>
                      <td>{fmtCompact(a.cacheWrite)}</td>
                      <td className="font-semibold">{fmtCompact(a.totalTokens)}</td>
                      <td>{(stats.totalToken ? a.totalTokens / stats.totalToken * 100 : 0).toFixed(1)}%</td>
                      <td className="text-[11px] mono muted">¥{mp.price.input}/{mp.price.output}/{mp.price.cacheRead}</td>
                      <td className="font-bold text-green-700">{fmtMoney(a.costCNY)}</td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--panel-2)' }}>
                  <td className="font-bold">合计</td>
                  <td className="font-bold">{fmtInt(records.length)}</td>
                  <td className="font-bold">{fmtCompact(stats.input)}</td>
                  <td className="font-bold">{fmtCompact(stats.output)}</td>
                  <td className="font-bold">{fmtCompact(stats.cacheRead)}</td>
                  <td className="font-bold">{fmtCompact(stats.cacheWrite)}</td>
                  <td className="font-bold">{fmtCompact(stats.totalToken)}</td>
                  <td>100%</td><td></td>
                  <td className="font-bold text-green-700">{fmtMoney(stats.costTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={onGoDashboard}>查看趋势看板 <ArrowRight size={15} /></button>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, sub, accent, wide, big }: any) {
  return (
    <div className={'card card-pad flex items-start gap-3 ' + (wide ? 'col-span-2' : '')}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: accent + '18', color: accent }}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs muted mb-1">{label}</div>
        <div className={'kpi-num font-bold leading-tight ' + (big ? 'text-[26px]' : 'text-[22px]')} style={{ color: accent }}>{value}</div>
        {sub && <div className="text-[11px] faint mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function CostCell({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] muted flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}</span>
        <span className="text-[10px] faint">{(pct * 100).toFixed(0)}%</span>
      </div>
      <div className="kpi-num font-bold text-base" style={{ color }}>{fmtMoney(value)}</div>
      <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} />
      </div>
    </div>
  )
}
