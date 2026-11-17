import { useMemo, useState } from 'react'
import { Camera, AlertTriangle, TrendingDown, Info, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { CASE_KPI, CASE_MODELS, FREE_MODELS, refPriceOf } from '../data/case'
import { matchPrice, loadPrices } from '../lib/pricing'
import type { Price } from '../types'
import { fmtInt, fmtCompact, fmtMoney } from '../lib/format'

interface ModelRow {
  model: string
  vendor: string
  requests: number
  p50: number
  p90: number
  note?: string
  /** 估算该模型总 token = 请求数 × p50（单次中位大小） */
  tokens: number
  share: number
  input: number
  output: number
  cacheRead: number
  officialCost: number
  refCost: number
  free: boolean
  officialPrice: Price
  refPrice: [number, number, number]
}

export default function CaseAnalysis() {
  const prices = useMemo(() => loadPrices(), [])
  const [hitRate, setHitRate] = useState(CASE_KPI.hitRate)
  const [pFactor, setPFactor] = useState(1) // token 估算系数：p50 × 系数

  const rows = useMemo<ModelRow[]>(() => {
    // 用 请求数×p50 估算各模型 token，再按全局总量校准
    const raw = CASE_MODELS.map(m => ({ ...m, rawTokens: m.requests * m.p50 * pFactor }))
    const sumRaw = raw.reduce((s, m) => s + m.rawTokens, 0)
    return raw.map(m => {
      const tokens = CASE_KPI.totalTokens * (m.rawTokens / sumRaw)
      const share = tokens / CASE_KPI.totalTokens
      // 缓存命中率作用于输入侧：inputTotal = tokens - output；output 按 221:1 反推
      const inputTotal = tokens * (CASE_KPI.inOutRatio / (CASE_KPI.inOutRatio + 1))
      const output = tokens * (1 / (CASE_KPI.inOutRatio + 1))
      const cacheRead = inputTotal * hitRate
      const input = inputTotal - cacheRead
      const free = FREE_MODELS.includes(m.model)

      const op = matchPrice(m.model, prices).price
      const officialCost = free ? 0
        : (input / 1e6) * op.input + (output / 1e6) * op.output + (cacheRead / 1e6) * op.cacheRead
      const rp = refPriceOf(m.model)
      const refCost = (input / 1e6) * rp[0] + (output / 1e6) * rp[1] + (cacheRead / 1e6) * rp[2]

      return { ...m, tokens, share, input, output, cacheRead, officialCost, refCost, free, officialPrice: op, refPrice: rp }
    })
  }, [prices, hitRate, pFactor])

  const totalOfficial = rows.reduce((s, r) => s + r.officialCost, 0)
  const totalRef = rows.reduce((s, r) => s + r.refCost, 0)
  const overpay = CASE_KPI.refCost - totalOfficial
  const overpayPct = overpay / CASE_KPI.refCost * 100

  return (
    <div className="flex flex-col gap-4">
      {/* 结论横幅 */}
      <div className="card card-pad" style={{ background: 'linear-gradient(120deg,#fff7ed,#fef2f2)', borderColor: '#fed7aa' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#fff', color: '#ea580c' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-base mb-1">结论：参考站的 ¥{fmtInt(CASE_KPI.refCost)} 报价明显偏高</h2>
            <p className="text-xs text-slate-700 leading-relaxed mb-3">
              识别到 <b>8 个模型</b>。按各厂商<b>官方真实单价</b>重算，这批用量（{fmtCompact(CASE_KPI.totalTokens)} token）的实际成本约{' '}
              <b className="text-red-600 text-base">¥{totalOfficial.toFixed(0)}</b>，仅为参考站报价的{' '}
              <b>{(totalOfficial / CASE_KPI.refCost * 100).toFixed(0)}%</b> —— 参考站<b>高估约 ¥{overpay.toFixed(0)}（{overpayPct.toFixed(0)}%）</b>。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MiniKpi label="参考站报价" value={`¥${CASE_KPI.refCost.toLocaleString()}`} sub="写死单价表" tone="red" />
              <MiniKpi label="官方价重算" value={`¥${totalOfficial.toFixed(0)}`} sub="含免费档" tone="green" />
              <MiniKpi label="高估金额" value={`¥${overpay.toFixed(0)}`} sub={`约 ${overpayPct.toFixed(0)}%`} tone="amber" />
              <MiniKpi label="我的复原校验" value={`¥${totalRef.toFixed(0)}`} sub="用参考站价复算" tone="slate" />
            </div>
          </div>
        </div>
      </div>

      {/* 为什么高估 */}
      <div className="card card-pad">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><TrendingDown size={16} className="text-red-500" /> 为什么相差这么大？三个原因</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <Reason title="① 缓存命中价被写高 3~30 倍"
            body={`这批用量缓存命中率高达 ${(hitRate * 100).toFixed(0)}%，绝大部分 token 走缓存价。参考站给的缓存价普遍是 ¥0.2~0.8/百万，而官方实际多为 ¥0.025~0.3（如小米 MiMo 仅 ¥0.025、DeepSeek ¥0.05）。缓存价哪怕差几毛，乘以十几亿 token 就是上千元的差距。`} />
          <Reason title="② 免费档被当成付费计费"
            body="hy4-free 是 WorkBuddy 11/4–11/15 活动免费档，实际成本为 0，但参考站按 ¥4/16/0.8 的付费价计算，凭空多算了一笔。" />
          <Reason title="③ 部分模型用旧价 / 兜底价"
            body="mimo-v2.6-pro、step-5-preview 等 2026 新模型在参考站价格表里没有，直接用了兜底价 ¥2/8/0.4，与官方价（如 step-5 输出 ¥20）差异明显。" />
        </div>
      </div>

      {/* 参数微调 */}
      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal size={16} className="text-slate-500" />
          <h3 className="font-bold text-sm">估算参数（截图只给分位数，可自行校准）</h3>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { setHitRate(CASE_KPI.hitRate); setPFactor(1) }}>
            <RotateCcw size={12} /> 还原
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Slider label={`缓存命中率：${(hitRate * 100).toFixed(0)}%`} value={hitRate} min={0} max={1} step={0.01} onChange={setHitRate} />
          <Slider label={`单次用量系数：${pFactor.toFixed(1)}×（p50 中位数）`} value={pFactor} min={0.5} max={2} step={0.1} onChange={setPFactor} />
        </div>
        <p className="text-[11px] faint mt-3 flex items-start gap-1">
          <Info size={12} className="mt-0.5 shrink-0" />
          截图只提供每个模型的请求次数和单次请求大小的 50%/90% 分位数，没有逐条 usage。这里用「请求数 × p50 × 系数」估算用量并按总量 {fmtCompact(CASE_KPI.totalTokens)} 校准。系数 1.0 = 按中位数，长尾分布实际均值更高，可调到 1.3~1.5 更接近真实。
        </p>
      </div>

      {/* 逐模型明细 */}
      <div className="card card-pad overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">逐模型用量与成本对照</h3>
          <span className="tag flex gap-1"><Camera size={11} /> 识别自截图 · {CASE_KPI.capturedAt}</span>
        </div>
        <table className="dt">
          <thead>
            <tr>
              <th>模型 / 厂商</th><th>请求数</th><th>p50 / p90</th><th>估算 Token</th><th>占比</th>
              <th>官方价 入/出/缓存</th><th>官方成本</th><th>参考站成本</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.model}>
                <td>
                  <div className="font-semibold">{r.model}</div>
                  <div className="text-[11px] faint">{r.vendor}{r.free && <span className="text-green-600"> · 免费档</span>}</div>
                </td>
                <td>{fmtInt(r.requests)}</td>
                <td className="text-[11px] mono">{fmtCompact(r.p50)} / {fmtCompact(r.p90)}</td>
                <td className="font-semibold">{fmtCompact(r.tokens)}</td>
                <td>{(r.share * 100).toFixed(1)}%</td>
                <td className="text-[11px] mono muted">
                  ¥{r.officialPrice.input}/{r.officialPrice.output}/{r.officialPrice.cacheRead}
                </td>
                <td className="font-bold text-green-700">{fmtMoney(r.officialCost)}</td>
                <td className="text-slate-400">{fmtMoney(r.refCost)}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--panel-2)' }}>
              <td className="font-bold">合计</td>
              <td className="font-bold">{fmtInt(rows.reduce((s, r) => s + r.requests, 0))}</td>
              <td></td>
              <td className="font-bold">{fmtCompact(rows.reduce((s, r) => s + r.tokens, 0))}</td>
              <td>100%</td><td></td>
              <td className="font-bold text-green-700">¥{totalOfficial.toFixed(2)}</td>
              <td className="font-bold">¥{totalRef.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[11px] faint mt-3 leading-relaxed">
          官方价列单位：元/百万 token（输入/输出/缓存命中）。「我的复原校验」用参考站写死的价格表重算得 ¥{totalRef.toFixed(0)}，与截图显示的 ¥{CASE_KPI.refCost} 对比，用于检验用量分摊口径是否合理——两者越接近，说明估算越可信。
        </p>
      </div>
    </div>
  )
}

function MiniKpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  const color: Record<string, string> = { red: '#dc2626', green: '#16a34a', amber: '#d97706', slate: '#475569' }
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3">
      <div className="text-[11px] muted mb-0.5">{label}</div>
      <div className="kpi-num text-lg font-bold" style={{ color: color[tone] }}>{value}</div>
      <div className="text-[10px] faint">{sub}</div>
    </div>
  )
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className="font-semibold text-slate-800 mb-1.5">{title}</div>
      <div className="text-slate-600 leading-relaxed">{body}</div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-xs muted mb-2">{label}</div>
      <input type="range" className="w-full accent-indigo-600" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}
