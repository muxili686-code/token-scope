import { useMemo, useState } from 'react'
import { MessageSquarePlus, Info, Repeat2, TrendingUp } from 'lucide-react'
import { estimateConversationDetail } from '../lib/estimate'
import { fmtInt, fmtCompact, fmtMoney } from '../lib/format'
import type { Price } from '../types'
import { FALLBACK_PRICE } from '../data/prices'

interface Props { prices: Record<string, Price>; rate: number }

/** 解析粘贴的多轮对话：支持 "我: / AI:"、"用户: / 助手:"、"User: / Assistant:"，或整段当一轮用户输入 */
function parseTurns(text: string): { role: string; text: string }[] {
  const lines = text.split(/\r?\n/)
  const turns: { role: string; text: string }[] = []
  const re = /^\s*(我|用户|助手|AI|GPT|user|assistant|system)\s*[:：]\s*(.*)$/i
  for (const line of lines) {
    if (!line.trim()) continue
    const m = line.match(re)
    if (m) {
      const raw = m[1].toLowerCase()
      const role = (raw === 'ai' || raw === 'gpt' || raw === '助手' || raw === 'assistant') ? 'assistant'
        : raw === 'system' ? 'system' : 'user'
      turns.push({ role, text: m[2] })
    } else if (turns.length) {
      // 无标记的行并入上一轮
      turns[turns.length - 1].text += '\n' + line
    } else {
      turns.push({ role: 'user', text: line })
    }
  }
  return turns
}

export default function ContextReplay({ prices, rate }: Props) {
  const [text, setText] = useState('')
  const [model, setModel] = useState('gpt-5')
  const turns = useMemo(() => parseTurns(text), [text])
  const d = useMemo(() => estimateConversationDetail(turns), [turns])

  const price = prices[model] || FALLBACK_PRICE
  const costOf = (tok: number) => (tok / 1e6) * price.input * (price.currency === 'USD' ? rate : 1)
  const extraCost = costOf(d.totalReplay)
  const maxSent = Math.max(...d.turns.filter(t => t.role !== 'assistant').map(t => t.sent), 1)

  const sample = `我: 帮我看看这份合同有没有风险\nAI: 这份合同需要关注三点……\n我: 第二条能再详细说说吗\nAI: 第二条主要涉及违约责任……\n我: 那如果对方不签补充协议呢`

  return (
    <div className="card card-pad">
      <div className="flex items-start gap-2 mb-1">
        <MessageSquarePlus size={17} className="text-indigo-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-sm">多轮对话 · 上下文重复分析</h3>
          <p className="text-[11px] faint mt-0.5">为什么聊得越久越贵？每轮请求都会把之前全部历史重新发一遍</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs muted">粘贴对话（每行一轮，用「我:」「AI:」开头）</label>
            <button className="text-[11px] text-indigo-600 hover:underline" onClick={() => setText(sample)}>填入示例</button>
          </div>
          <textarea className="textarea" style={{ minHeight: 220 }}
            placeholder={sample} value={text} onChange={e => setText(e.target.value)} />
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs muted">计价模型</label>
            <select className="select !w-auto" value={model} onChange={e => setModel(e.target.value)}>
              {Object.keys(prices).sort().map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>

        <div>
          {turns.length === 0 ? (
            <div className="h-full min-h-[220px] rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center p-6">
              <Repeat2 size={28} className="text-slate-300 mb-3" />
              <div className="text-xs faint">粘贴一段多轮对话，看看历史上下文被重复发送了多少 token</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5">
                  <div className="text-[10px] text-indigo-700/80">实际发送</div>
                  <div className="font-bold text-lg kpi-num text-indigo-700">{fmtCompact(d.totalSent)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                  <div className="text-[10px] faint">内容本身</div>
                  <div className="font-bold text-lg kpi-num text-slate-700">{fmtCompact(d.totalOwn)}</div>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5">
                  <div className="text-[10px] text-amber-700/80">重复发送</div>
                  <div className="font-bold text-lg kpi-num text-amber-700">{fmtCompact(d.totalReplay)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <TrendingUp size={14} className="text-red-500" />
                <span>放大 <b className="text-red-600">{d.multiplier.toFixed(1)}×</b> · 多付约 <b className="text-red-600">{fmtMoney(extraCost)}</b></span>
                <span className="ml-auto text-[10px] faint">{d.turns.filter(t => t.role !== 'assistant').length} 轮</span>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                {d.turns.filter(t => t.role !== 'assistant').map(t => (
                  <div key={t.index} className="flex items-center gap-2">
                    <span className="w-6 text-[10px] faint mono shrink-0">{String(t.index).padStart(2, '0')}</span>
                    <div className="flex-1 h-5 rounded flex overflow-hidden bg-slate-100" title={`本轮 ${fmtInt(t.own)} + 重放 ${fmtInt(t.replay)}`}>
                      <div style={{ width: `${(t.own / maxSent) * 100}%`, background: '#6366f1' }} className="h-full" />
                      <div style={{ width: `${(t.replay / maxSent) * 100}%`, background: '#fbbf24' }} className="h-full" />
                    </div>
                    <span className="w-[70px] text-right text-[10px] mono faint shrink-0">{fmtCompact(t.sent)}</span>
                    {t.replay > 0 && <span className="w-[50px] text-right text-[10px] mono text-amber-600 shrink-0">+{fmtCompact(t.replay)}</span>}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 text-[10px] faint">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> 本轮新增</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> 历史重放</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3 text-[11px] text-amber-800">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          这就是"聊得越久越贵"的原因：第 N 轮请求会把前面 N−1 轮的全部内容再发一次。
          <b> 紫色是本轮真正新增的内容，黄色是重复发送的历史。</b>
          减少方式：及时开新会话、精简历史、或用支持上下文缓存的模型（缓存命中单价远低于常规输入）。
        </span>
      </div>
    </div>
  )
}
