import { useEffect, useMemo, useState } from 'react'
import { Scale, TrendingUp, TrendingDown, Info, CheckCircle2 } from 'lucide-react'
import type { UsageRecord } from '../types'
import { fmtInt, fmtCompact, fmtMoney } from '../lib/format'
import { isFreeModel, matchPrice } from '../lib/pricing'
import type { Price } from '../types'

interface Props {
  records: UsageRecord[]
  estimated: number
  prices: Record<string, Price>
}

const KEY = 'ts-actual-bill'

export default function Reconciliation({ records, estimated, prices }: Props) {
  const [actual, setActual] = useState<string>(() => localStorage.getItem(KEY) || '')
  const [period, setPeriod] = useState('')

  useEffect(() => { if (actual) localStorage.setItem(KEY, actual) }, [actual])

  const actualNum = Number(actual) || 0
  const diff = actualNum - estimated
  const diffPct = estimated > 0 ? diff / estimated * 100 : 0

  // 差异原因线索
  const hints = useMemo(() => {
    const out: string[] = []
    const cacheRead = records.reduce((s, r) => s + r.cacheRead, 0)
    const cacheWrite = records.reduce((s, r) => s + r.cacheWrite, 0)
    const input = records.reduce((s, r) => s + r.input, 0)
    const hitRate = cacheRead + input > 0 ? cacheRead / (cacheRead + input) : 0
    if (hitRate >= 0.5) out.push(`缓存命中率 ${(hitRate * 100).toFixed(0)}%，若平台缓存计价与本地口径不同，会造成差异`)
    if (cacheWrite > 0) out.push(`存在缓存写入 ${fmtCompact(cacheWrite)} tok，写入单价通常高于普通输入`)
    const freeReqs = records.filter(r => isFreeModel(r.model)).length
    if (freeReqs > 0) out.push(`含 ${fmtInt(freeReqs)} 条免费档请求（模型名含 free），已按 0 成本计`)
    const unmatched = new Set(records.filter(r => !matchPrice(r.model, prices).matched).map(r => r.model))
    if (unmatched.size) out.push(`有 ${unmatched.size} 个模型未匹配到官方价，用了参考价`)
    // 账单可能含税/服务费
    out.push('平台账单可能含税、服务费或阶梯价，与按刊例价的估算存在差异')
    return out
  }, [records, prices])

  return (
    <div className="card card-pad">
      <div className="flex items-start gap-2 mb-3">
        <Scale size={17} className="text-amber-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-sm">账单对账 · 估算 vs 实际</h3>
          <p className="text-[11px] faint mt-0.5">填入平台账单的实际金额，与上方估算对比，核对计费是否准确</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs muted block mb-1">本工具估算</label>
          <div className="kpi-num text-xl font-bold text-indigo-600 py-1.5">{fmtMoney(estimated)}</div>
          <div className="text-[10px] faint">按官方单价计算</div>
        </div>
        <div>
          <label className="text-xs muted block mb-1">平台账单实际金额（¥）</label>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">¥</span>
            <input className="input" inputMode="decimal" placeholder="如 128.50"
              value={actual} onChange={e => setActual(e.target.value)} />
          </div>
          <input className="input !mt-1.5 !py-1 !text-[11px]" placeholder="账期备注（可选，如 11月1日-11月17日）"
            value={period} onChange={e => setPeriod(e.target.value)} />
        </div>
        <div>
          <label className="text-xs muted block mb-1">差额（实际 − 估算）</label>
          <div className={'kpi-num text-xl font-bold py-1.5 ' + (diffPct > 10 ? 'text-red-600' : diffPct < -10 ? 'text-emerald-600' : 'text-slate-700')}>
            {actualNum ? (diff >= 0 ? '+' : '−') + fmtMoney(Math.abs(diff)) : '—'}
          </div>
          <div className="text-[10px] faint">
            {actualNum ? `差异 ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%` : '填入实际金额后显示'}
          </div>
        </div>
      </div>

      {actualNum > 0 && (
        <div className="mt-3">
          {Math.abs(diffPct) <= 5 ? (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-[11px] text-emerald-800">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <span>估算与实际相差 {Math.abs(diffPct).toFixed(1)}%，在合理范围内。说明本地价格表与平台口径基本一致。</span>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <div className="flex items-start gap-2 text-[11px] text-amber-800 font-semibold mb-2">
                {diffPct > 0 ? <TrendingUp size={14} className="mt-0.5 shrink-0" /> : <TrendingDown size={14} className="mt-0.5 shrink-0" />}
                相差 {Math.abs(diffPct).toFixed(1)}%，可能的原因：
              </div>
              <ul className="space-y-1 text-[11px] text-amber-800 ml-5 list-disc">
                {hints.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
          <p className="text-[10px] faint mt-2 flex items-start gap-1"><Info size={11} className="mt-0.5 shrink-0" /> 对账金额保存在本机浏览器，仅供核对参考，不构成结算依据。</p>
        </div>
      )}
    </div>
  )
}
