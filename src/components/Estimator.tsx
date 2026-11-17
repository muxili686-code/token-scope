import { useMemo, useState } from 'react'
import { Calculator, Info, Sparkles } from 'lucide-react'
import { estimateTokens } from '../lib/estimate'
import { FALLBACK_PRICE } from '../data/prices'
import type { Price } from '../types'
import { fmtInt, fmtMoney } from '../lib/format'
import ContextReplay from './ContextReplay'

interface Props { prices: Record<string, Price>; rate: number }

export default function Estimator({ prices, rate }: Props) {
  const [text, setText] = useState('')
  const [model, setModel] = useState('gpt-5')
  const result = useMemo(() => estimateTokens(text), [text])

  const price = prices[model] || matchFallback(model, prices)
  const cost = ((result.total / 1e6) * price.input) * (price.currency === 'USD' ? rate : 1)
  // 估算文本当作输入，用输入单价

  const options = Object.keys(prices).sort()

  return (
    <div className="flex flex-col gap-4">
      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-1">
          <Calculator size={18} className="text-indigo-600" />
          <h2 className="text-base font-bold">文本 Token 估算器</h2>
        </div>
        <p className="muted text-xs mb-4">
          ChatGPT / 豆包等应用不显示 token 用量。把对话文本粘贴进来，可估算它大约消耗多少 token、按所选模型值多少钱。
          <span className="text-amber-700"> 结果为近似值，精确用量请以平台账单为准。</span>
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <label className="text-xs muted block mb-1">粘贴文本 / 对话内容</label>
            <textarea className="textarea" style={{ minHeight: 260 }}
              placeholder={'把一段提示词、文章或对话粘进来…\n例如：请帮我分析这份合同的法律风险……'}
              value={text} onChange={e => setText(e.target.value)} />
            <div className="text-[11px] faint mt-1">共 {fmtInt(result.chars)} 字符</div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-3">
            <div>
              <label className="text-xs muted block mb-1">按哪个模型计价</label>
              <select className="select" value={model} onChange={e => setModel(e.target.value)}>
                {options.map(k => <option key={k} value={k}>{k} · {prices[k].currency}</option>)}
              </select>
            </div>

            <div className="card card-pad" style={{ boxShadow: 'none', background: 'var(--accent-soft)', borderColor: '#c7d2fe' }}>
              <div className="text-xs muted mb-1">估算 Token</div>
              <div className="kpi-num text-4xl font-bold text-indigo-700">{fmtInt(result.total)}</div>
              <div className="text-xs text-indigo-700/80 mt-1">按输入计价约 {fmtMoney(cost)}</div>
            </div>

            <div className="card card-pad" style={{ boxShadow: 'none' }}>
              <div className="text-xs muted mb-2 flex items-center gap-1"><Sparkles size={12} /> 拆分明细</div>
              <div className="space-y-1.5 text-xs">
                <Row label="中文字符" value={`${result.chinese} 字`} />
                <Row label="英文单词" value={`${result.englishWords} 词`} />
                <Row label="数字串" value={`${result.numbers} 组`} />
                <Row label="日韩字符" value={`${result.cjkOther} 字`} />
                <Row label="标点/空格" value={`${result.punctuation} 个`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad flex items-start gap-2 text-xs text-slate-600">
        <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <div className="space-y-1">
          <div>估算参考：中文约 1.3 token/字，英文约 1.3 token/词，数字约 1.1 token/组。不同模型的计算方式有差异，中文通常比英文占用更多 token。</div>
          <div>多轮对话中历史上下文会被<b>反复发送</b>，实际 token 远高于单轮文本长度——这也是"计费看着不准"的常见原因。下方工具可以直观看到这个放大效应。</div>
        </div>
      </div>

      <ContextReplay prices={prices} rate={rate} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="muted">{label}</span><span className="mono font-semibold">{value}</span></div>
}

function matchFallback(model: string, prices: Record<string, Price>): Price {
  const n = model.toLowerCase()
  for (const k of Object.keys(prices).sort((a, b) => b.length - a.length)) {
    if (n.startsWith(k)) return prices[k]
  }
  return FALLBACK_PRICE
}
