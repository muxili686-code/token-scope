import { useMemo, useState } from 'react'
import { RotateCcw, Info, Pencil, Check, X, ExternalLink } from 'lucide-react'
import type { Price } from '../types'
import { DEFAULT_PRICES, DEFAULT_USD_CNY } from '../data/prices'
import { fmtMoney } from '../lib/format'

interface Props {
  prices: Record<string, Price>
  rate: number
  onChange: (prices: Record<string, Price>, rate: number) => void
  onToast: (m: string) => void
}

export default function PricesView({ prices, rate, onChange, onToast }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  /** 编辑草稿存的是界面上看到的人民币值，保存时按币种反算回底层原值 */
  const [draft, setDraft] = useState<{ input: string; output: string; cacheRead: string }>({ input: '', output: '', cacheRead: '' })
  const [rateDraft, setRateDraft] = useState(String(rate))
  const [q, setQ] = useState('')

  // 显示层：一律换算成人民币，底层仍保留原币种（计费引擎按原币种+汇率计算，保证准确）
  const toCNY = (v: number, cur: Price['currency']) => cur === 'USD' ? v * rate : v
  const fromCNY = (v: number, cur: Price['currency']) => cur === 'USD' ? v / rate : v

  const rows = useMemo(() => Object.entries(prices)
    .filter(([k]) => k.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0])), [prices, q])

  function startEdit(k: string) {
    const p = prices[k]
    setEditing(k)
    setDraft({
      input: String(Number(toCNY(p.input, p.currency).toFixed(4))),
      output: String(Number(toCNY(p.output, p.currency).toFixed(4))),
      cacheRead: String(Number(toCNY(p.cacheRead, p.currency).toFixed(4))),
    })
  }
  function saveEdit(k: string) {
    const p = prices[k]
    const next = {
      ...prices,
      [k]: {
        ...p,
        input: fromCNY(Number(draft.input) || 0, p.currency),
        output: fromCNY(Number(draft.output) || 0, p.currency),
        cacheRead: fromCNY(Number(draft.cacheRead) || 0, p.currency),
      } as Price,
    }
    onChange(next, rate); setEditing(null); onToast(`已更新 ${k} 的人民币单价`)
  }
  function saveRate() {
    const r = Number(rateDraft)
    if (!(r > 0)) { onToast('汇率必须是正数'); return }
    onChange(prices, r); onToast(`汇率已更新为 1 USD = ${r} CNY`)
  }
  function reset() {
    onChange({ ...DEFAULT_PRICES }, DEFAULT_USD_CNY)
    setRateDraft(String(DEFAULT_USD_CNY)); onToast('已恢复默认价格表与汇率')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 官方价格链接 */}
      <div className="card card-pad">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Info size={18} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold mb-2">官方价格查询</h2>
            <div className="flex flex-wrap gap-2">
              <a className="tag hover:bg-slate-100" href="https://openai.com/api/pricing/" target="_blank" rel="noreferrer">OpenAI 价格 <ExternalLink size={10} /></a>
              <a className="tag hover:bg-slate-100" href="https://anthropic.com/api" target="_blank" rel="noreferrer">Anthropic <ExternalLink size={10} /></a>
              <a className="tag hover:bg-slate-100" href="https://volcengine.com/docs/84458/1585097" target="_blank" rel="noreferrer">豆包/方舟 <ExternalLink size={10} /></a>
              <a className="tag hover:bg-slate-100" href="https://bigmodel.cn/pricing" target="_blank" rel="noreferrer">智谱 GLM <ExternalLink size={10} /></a>
              <a className="tag hover:bg-slate-100" href="https://api-docs.deepseek.com/quick_start/pricing" target="_blank" rel="noreferrer">DeepSeek <ExternalLink size={10} /></a>
            </div>
          </div>
        </div>
      </div>

      {/* 汇率 + 工具条 */}
      <div className="card card-pad flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs muted block mb-1">美元折算汇率 1 USD = ? CNY</label>
          <div className="flex gap-2">
            <input className="input w-24" value={rateDraft} onChange={e => setRateDraft(e.target.value)} inputMode="decimal" />
            <button className="btn btn-sm whitespace-nowrap" onClick={saveRate}><Check size={13} /> 应用</button>
          </div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs muted block mb-1">搜索模型</label>
          <input className="input" placeholder="如 gpt-5 / doubao / claude" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-sm" onClick={reset}><RotateCcw size={13} /> 恢复默认</button>
      </div>

      {/* 价格表 */}
      <div className="card card-pad overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">单价表（每百万 token，人民币）</h3>
          <span className="tag">{rows.length} 个模型</span>
        </div>
        <table className="dt">
          <thead>
            <tr>
              <th>模型</th><th>输入 ¥</th><th>输出 ¥</th><th>缓存命中 ¥</th><th>发布日期</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, p]) => (
              <tr key={k}>
                <td>
                  <div className="font-semibold">{k}</div>
                  {p.estimated && <span className="text-[10px] text-amber-600">估算·请校正</span>}
                </td>
                {editing === k ? (
                  <>
                    <td><input className="input w-20 !py-1 text-right" value={draft.input} onChange={e => setDraft({ ...draft, input: e.target.value })} /></td>
                    <td><input className="input w-20 !py-1 text-right" value={draft.output} onChange={e => setDraft({ ...draft, output: e.target.value })} /></td>
                    <td><input className="input w-20 !py-1 text-right" value={draft.cacheRead} onChange={e => setDraft({ ...draft, cacheRead: e.target.value })} /></td>
                    <td className="text-[11px] muted mono">{p.released || '—'}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="btn btn-sm btn-primary" onClick={() => saveEdit(k)}><Check size={13} /></button>
                        <button className="btn btn-sm" onClick={() => setEditing(null)}><X size={13} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="mono">{fmtMoney(toCNY(p.input, p.currency), 'CNY')}</td>
                    <td className="mono">{fmtMoney(toCNY(p.output, p.currency), 'CNY')}</td>
                    <td className="mono muted">{fmtMoney(toCNY(p.cacheRead, p.currency), 'CNY')}</td>
                    <td className="text-[11px] muted mono">{p.released || '—'}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => startEdit(k)}><Pencil size={13} /></button></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 维护说明：从客户界面移出的技术信息集中在这里 */}
      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-slate-500" />
          <h3 className="font-bold text-sm">计费口径与维护说明</h3>
          <span className="tag ml-auto">供维护参考</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="font-semibold text-slate-700 mb-1">单价标注含义</div>
            <div className="space-y-1 text-slate-600">
              <div><b className="text-amber-600">估算</b>：厂商未公开官方单价，暂用参考值，建议按实际账单校正。</div>
              <div><b className="text-green-600">免费档</b>：模型名含 free，按 0 成本计（如 hy4-free、hy4-flash-free）。</div>
              <div><b className="text-slate-500">发布日期</b>：模型官方发布日，联网核实；同系列变体沿用系列发布日。</div>
              <div><b className="text-slate-500">汇率说明</b>：表内单价一律显示为人民币；美元计价的模型按上方汇率实时折算，汇率变动后显示会自动更新。</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="font-semibold text-slate-700 mb-1">支持直接读取的格式</div>
            <div className="space-y-1 text-slate-600">
              <div><b>会话日志</b>：.jsonl / .json / .log，自动识别各工具字段。</div>
              <div><b>压缩日志</b>：.jsonl.zstd（如 DeepSeek Harness），浏览器内自动解压。</div>
              <div><b>数据库</b>：.db / .sqlite / .vscdb（如 Cursor、OpenCode），自动扫描其中用量数据。</div>
              <div><b>账单</b>：.csv / .tsv，自动识别列名。</div>
              <div className="faint mt-1.5">以上文件直接拖入「数据接入」即可，无需命令行。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
