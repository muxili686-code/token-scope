import { useState } from 'react'
import {
  KeyRound, ChevronDown, ChevronRight, Download, ExternalLink, Info,
  CheckCircle2, Terminal, Copy, Globe2, FileJson,
} from 'lucide-react'

type Platform = 'openai' | 'doubao' | 'other'
type Tab = 'command' | 'web'

interface Step { n: number; text: React.ReactNode }

const PLATFORMS: Array<{ id: Platform; name: string; hint: string; steps: Step[]; note?: string }> = [
  {
    id: 'openai',
    name: 'ChatGPT / OpenAI API',
    hint: '网页导出 CSV · 无需命令行',
    steps: [
      { n: 1, text: <>浏览器打开 <a href="https://platform.openai.com/usage" target="_blank" rel="noreferrer">platform.openai.com/usage<ExternalLink size={11} /></a>，用你的账号登录。</> },
      { n: 2, text: <>右上角选好要统计的<b>日期范围</b>（如本月，或某月 1 日到月底）。</> },
      { n: 3, text: <>点右上角<b>「导出 / Export」</b>，类型选<b>「活动数据 Activity data」</b>；文件格式选 <b>CSV</b>，分组依据选<b>模型 Model</b>。</> },
      { n: 4, text: <>点<b>「下载 Download」</b>，等文件生成后保存到电脑（通常在「下载」文件夹）。</> },
      { n: 5, text: <>把下载好的 <b>.csv 文件拖到本页上方的导入区</b>，即可自动识别并统计。</> },
    ],
    note: '需要组织管理员或有「用量仪表板」权限的账号。导出的 CSV 里含模型名与 token 数，本工具会自动读取。',
  },
  {
    id: 'doubao',
    name: '豆包 / 火山方舟',
    hint: '控制台导出 CSV · 无需命令行',
    steps: [
      { n: 1, text: <>浏览器打开 <a href="https://console.volcengine.com/ark" target="_blank" rel="noreferrer">火山引擎控制台<ExternalLink size={11} /></a>，登录账号。</> },
      { n: 2, text: <>进入<b>「费用中心」→「账单管理」→「账单明细」</b>。</> },
      { n: 3, text: <>在产品筛选里选<b>「豆包大模型 / 字节跳动大模型服务」</b>，再选好<b>时间范围</b>。</> },
      { n: 4, text: <>点右上角<b>「导出」</b>，字段保持默认全选，确认后等系统生成文件，点下载保存 <b>.csv</b>。</> },
      { n: 5, text: <>把这个 <b>.csv 文件拖到本页上方的导入区</b>，即可自动识别。</> },
    ],
    note: '子账号若看不到费用中心，需主账号在访问控制里给「BillReadOnlyAccess」只读权限。若看不到 token 明细，可在方舟控制台的「接入点监控」里导出用量。',
  },
  {
    id: 'other',
    name: 'Claude / Gemini / 其他平台',
    hint: '把账单导出为 CSV 即可',
    steps: [
      { n: 1, text: <>登录对应平台的<b>控制台 / 账单中心</b>（如 Anthropic Console、Google AI Studio、云厂商费用中心）。</> },
      { n: 2, text: <>找到<b>「用量 Usage」或「账单 Billing」</b>页面，选择日期范围。</> },
      { n: 3, text: <>点<b>「导出 Export」</b>，下载 <b>.csv</b> 或 <b>.json</b> 文件。</> },
      { n: 4, text: <>把文件<b>拖到本页上方的导入区</b>，本工具会自动识别里面的模型名和 token 数。</> },
    ],
    note: '只要导出的文件里含「模型名 + 输入 token + 输出 token」（列名中英文都可），就能自动识别。列名不规范也没关系，可先粘贴文本导入。',
  },
]

/** OpenAI 用量 API 的本机命令（不同平台命令不同，这里给最通用的 OpenAI 版） */
const OPENAI_CMD = `curl -s "https://api.openai.com/v1/organization/usage/completions?start_time=$(date -d '30 days ago' +%s)&group_by=model" \\
  -H "Authorization: Bearer $OPENAI_ADMIN_KEY" \\
  -o openai-usage.json`

export default function BillingGuide({ onToast }: { onToast: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>('web')
  const [open, setOpen] = useState<Platform | null>(null)
  const [cmdPlatform, setCmdPlatform] = useState<'openai' | 'other'>('openai')

  function copy(text: string) {
    navigator.clipboard?.writeText(text)
    onToast('命令已复制，可在终端粘贴运行')
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-indigo-600" />
        <span className="font-bold text-sm">API 用量导入</span>
      </div>
      <p className="muted text-xs mb-3">
        把各平台的真实用量导进来统计。两种路径选一种即可：<b>网页导出</b>最简单（零基础推荐），<b>本机命令</b>适合要精确用量或自动化的场景。
      </p>

      {/* 两种路径 Tab */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab('web')}
          className={'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ' +
            (tab === 'web' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
          <Globe2 size={14} /> 网页导出（推荐）
        </button>
        <button onClick={() => setTab('command')}
          className={'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ' +
            (tab === 'command' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
          <Terminal size={14} /> 本机命令
        </button>
      </div>

      {tab === 'web' ? (
        <>
          <p className="text-[11px] faint mb-2">按平台展开步骤，全程在网页点选、无需命令行和 API Key。</p>
          <div className="space-y-2">
            {PLATFORMS.map(p => {
              const isOpen = open === p.id
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 overflow-hidden">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                    onClick={() => setOpen(isOpen ? null : p.id)}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      <Download size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-[11px] faint">{p.hint}</div>
                    </div>
                    {isOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                      <ol className="space-y-2.5 my-3">
                        {p.steps.map(s => (
                          <li key={s.n} className="flex gap-2.5 text-xs text-slate-700 leading-relaxed">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{s.n}</span>
                            <span className="pt-0.5">{s.text}</span>
                          </li>
                        ))}
                      </ol>
                      {p.note && (
                        <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-[11px] text-amber-800">
                          <Info size={13} className="mt-0.5 shrink-0" />
                          <span>{p.note}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-green-700">
                        <CheckCircle2 size={13} /> 拿到文件后，回到本页顶部把它拖进导入区即可
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div>
          <div className="flex gap-2 mb-3">
            <button className={'btn btn-sm ' + (cmdPlatform === 'openai' ? 'btn-primary' : '')} onClick={() => setCmdPlatform('openai')}>OpenAI</button>
            <button className={'btn btn-sm ' + (cmdPlatform === 'other' ? 'btn-primary' : '')} onClick={() => setCmdPlatform('other')}>其他平台</button>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-3 text-[11px] leading-relaxed">
            <div className="font-semibold text-slate-700 mb-2 flex items-center gap-1"><Terminal size={13} /> 在本机终端运行</div>
            <div className="space-y-1.5">
              <div>① 打开你电脑的终端（Windows 用 PowerShell，Mac 用「终端」）。</div>
              <div>② 先把密钥设为环境变量：<code className="mono bg-white px-1 rounded">$env:OPENAI_ADMIN_KEY=&quot;你的Key&quot;</code>（Windows）或 <code className="mono bg-white px-1 rounded">export OPENAI_ADMIN_KEY=&quot;你的Key&quot;</code>（Mac/Linux）。</div>
              <div>③ 粘贴下面命令运行，导出 <b>openai-usage.json</b>。</div>
              <div>④ 把该文件拖回本页顶部导入区，或直接把终端输出的 JSON 贴进「粘贴文本」。</div>
            </div>
          </div>

          {cmdPlatform === 'openai' ? (
            <div className="rounded-xl bg-slate-900 text-green-300 p-3 flex items-start gap-2">
              <code className="mono text-[11px] flex-1 whitespace-pre-wrap break-all">{OPENAI_CMD}</code>
              <button className="btn btn-sm !bg-slate-700 !text-white !border-slate-600 shrink-0" onClick={() => copy(OPENAI_CMD)}>
                <Copy size={12} /> 复制
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-[11px] text-emerald-800 flex items-start gap-2">
              <FileJson size={14} className="mt-0.5 shrink-0" />
              <span>其他平台请直接用上面的<b>「网页导出」</b>方式下载账单 CSV——多数平台没有像 OpenAI 这样开放的本机用量 API。若某平台提供了用量导出命令，把输出的 JSON/CSV 拖进来即可自动识别。</span>
            </div>
          )}

          <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-[11px] text-amber-800">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>密钥（Key）只在本机终端用于运行命令，<b>不经过本网站、不上传、不保存</b>。网页端直连各平台用量接口会被跨域限制拦截，所以走本机命令这条路。</span>
          </div>
        </div>
      )}
    </div>
  )
}
