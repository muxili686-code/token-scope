import { useRef, useState } from 'react'
import {
  FolderOpen, FileJson, KeyRound, FlaskConical, UploadCloud, X,
  Loader2, CheckCircle2, AlertCircle, Terminal, Copy, ChevronRight,
} from 'lucide-react'
import type { UsageRecord } from '../types'
import { parseBillFile } from '../lib/parsers'
import { makeDemoRecords } from '../data/demo'
import { fmtInt } from '../lib/format'

interface Props {
  onData: (records: UsageRecord[]) => void
  onToast: (msg: string) => void
  hasData: boolean
  onGoDashboard: () => void
}

type Tab = 'log' | 'bill' | 'api' | 'demo'

export default function SourcePanel({ onData, onToast, hasData, onGoDashboard }: Props) {
  const [tab, setTab] = useState<Tab>('bill')
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [billText, setBillText] = useState('')
  const [dirName, setDirName] = useState('')
  const dirInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tabs: Array<{ id: Tab; icon: any; label: string; desc: string }> = [
    { id: 'log', icon: FolderOpen, label: '本地日志', desc: '扫描 .jsonl' },
    { id: 'bill', icon: FileJson, label: '账单导入', desc: 'CSV / JSON' },
    { id: 'api', icon: KeyRound, label: 'API 拉取', desc: 'OpenAI / 豆包' },
    { id: 'demo', icon: FlaskConical, label: '演示数据', desc: '先看效果' },
  ]

  function finish(records: UsageRecord[], msg: string) {
    if (!records.length) { onToast('未识别到有效用量记录，请检查数据格式'); return }
    onData(records)
    onToast(`${msg} · 识别 ${fmtInt(records.length)} 条`)
  }

  async function handleFiles(files: FileList | File[]) {
    setParsing(true)
    try {
      const arr = Array.from(files)
      const all: UsageRecord[] = []
      for (const f of arr) {
        const text = await f.text()
        const recs = parseBillFile(f.name, text)
        all.push(...recs)
      }
      finish(all, `已解析 ${arr.length} 个文件`)
    } catch (e: any) {
      onToast('解析失败：' + (e?.message || '未知错误'))
    } finally {
      setParsing(false)
    }
  }

  function handleDir(files: FileList | null) {
    if (!files) return
    // webkitdirectory 会给出整个目录的文件列表，过滤 jsonl/json
    const picked = Array.from(files).filter(f => /\.(jsonl|json|log)$/i.test(f.name))
    setDirName(Array.from(files)[0]?.webkitRelativePath?.split('/')[0] || '已选目录')
    if (!picked.length) { onToast('目录里没找到 .jsonl / .json 日志文件'); return }
    handleFiles(picked)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card card-pad">
        <h2 className="text-base font-bold mb-1">接入用量数据</h2>
        <p className="muted text-xs mb-4">所有解析都在你的浏览器本地完成，数据不上传。三种方式可叠加，切入的数据会合并统计。</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={'flex flex-col items-center gap-2 p-4 rounded-xl border transition ' +
                  (tab === t.id ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 hover:bg-slate-50')}>
                <Icon size={22} className={tab === t.id ? 'text-indigo-600' : 'text-slate-500'} />
                <div className="font-semibold text-sm">{t.label}</div>
                <div className="text-[11px] faint">{t.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card card-pad min-h-[320px]">
        {/* ---------- 本地日志 ---------- */}
        {tab === 'log' && (
          <div>
            <h3 className="font-bold mb-1">扫描本地会话日志</h3>
            <p className="muted text-xs mb-4">
              选择 WorkBuddy / Claude Code 的日志目录（含 <code className="mono">.jsonl</code> 文件）。
              逐行解析请求级 usage，兼容 <code className="mono">input_tokens / prompt_tokens / cache_read_input_tokens</code> 等字段。
            </p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4 text-xs mono space-y-2">
              <div><span className="faint">macOS / Linux</span>　~/.workbuddy/projects/</div>
              <div><span className="faint">Windows</span>　%USERPROFILE%\.workbuddy\projects\</div>
              <div><span className="faint">Claude Code</span>　~/.claude/projects/</div>
            </div>
            <input ref={dirInputRef} type="file" {...{ webkitdirectory: '', directory: '' } as any} multiple
              className="hidden" onChange={e => handleDir(e.target.files)} />
            <button className="btn btn-primary" onClick={() => dirInputRef.current?.click()}>
              <FolderOpen size={16} /> 选择日志目录
            </button>
            {dirName && <div className="mt-3 text-xs muted flex items-center gap-1"><CheckCircle2 size={13} className="text-green-600" /> 已读取：{dirName}</div>}
            <div className="mt-4 flex items-start gap-2 text-[11px] faint">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              若浏览器不支持目录选择，会退回「选择多个文件」，可手动 <kbd>Ctrl/⌘</kbd> 多选 jsonl 文件。
            </div>
          </div>
        )}

        {/* ---------- 账单导入 ---------- */}
        {tab === 'bill' && (
          <div>
            <h3 className="font-bold mb-1">导入账单 / 用量文件</h3>
            <p className="muted text-xs mb-4">
              支持 OpenAI usage 导出、火山方舟/豆包账单、或任意含「模型名 + 输入 + 输出」的 CSV/JSON。
              自动识别常见列名，粘贴文本或直接拖拽文件。
            </p>
            <div className={'dropzone mb-4 ' + (dragging ? 'active' : '')}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}>
              <UploadCloud size={30} className="mx-auto mb-2 text-indigo-500" />
              <div className="font-semibold mb-1">拖拽 CSV / JSON / JSONL 文件到这里</div>
              <div className="text-xs faint mb-3">或点击下方按钮选择</div>
              <input ref={fileInputRef} type="file" multiple accept=".csv,.tsv,.json,.jsonl,.log"
                className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
              <button className="btn" onClick={() => fileInputRef.current?.click()}>选择文件</button>
            </div>
            <div className="text-xs muted mb-2 font-semibold">没有文件？直接粘贴内容：</div>
            <textarea className="textarea" placeholder={'model,input_tokens,output_tokens,cached_tokens,date\ngpt-5,12000,3400,5000,2026-11-16\ndoubao-seed-2.0-pro,88000,12000,0,2026-11-16'}
              value={billText} onChange={e => setBillText(e.target.value)} />
            <div className="flex items-center gap-2 mt-3">
              <button className="btn btn-primary" disabled={parsing || !billText.trim()}
                onClick={() => { setParsing(true); setTimeout(() => { finish(parseBillFile('pasted.json', billText), '已解析粘贴内容'); setParsing(false) }, 50) }}>
                {parsing ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />} 解析文本
              </button>
              {billText && <button className="btn btn-ghost btn-sm" onClick={() => setBillText('')}><X size={13} /> 清空</button>}
            </div>
          </div>
        )}

        {/* ---------- API 拉取 ---------- */}
        {tab === 'api' && <ApiPanel onToast={onToast} onGoBill={() => setTab('bill')} />}

        {/* ---------- 演示 ---------- */}
        {tab === 'demo' && (
          <div>
            <h3 className="font-bold mb-1">先看演示数据</h3>
            <p className="muted text-xs mb-4">
              载入一组覆盖 OpenAI / Claude / 豆包 / DeepSeek / GLM / Kimi 的示例记录，快速体验看板与成本折算。演示数据不会覆盖你已接入的数据，会追加合并。
            </p>
            <button className="btn btn-primary" onClick={() => finish(makeDemoRecords(), '已载入演示数据')}>
              <FlaskConical size={16} /> 载入演示数据
            </button>
          </div>
        )}
      </div>

      {hasData && (
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={onGoDashboard}>查看看板 <ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  )
}

/** API Key 拉取面板 */
function ApiPanel({ onToast, onGoBill }: { onToast: (m: string) => void; onGoBill: () => void }) {
  const [mode, setMode] = useState<'openai' | 'doubao'>('openai')
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)

  const curlOpenAI = `curl https://api.openai.com/v1/organization/usage/completions \\
  -H "Authorization: Bearer $OPENAI_ADMIN_KEY" \\
  -d "start_time=$(date -d '30 days ago' +%s)" \\
  -d "group_by=model"`

  async function pull() {
    if (!key.trim()) { onToast('请先填入 API Key'); return }
    setLoading(true)
    onToast('浏览器直连管理平台接口通常受 CORS 限制，已为你生成可在本机运行的命令')
    setLoading(false)
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text.replace('$OPENAI_ADMIN_KEY', key || '<你的Key>'))
    onToast('命令已复制，可在终端粘贴运行')
  }

  return (
    <div>
      <h3 className="font-bold mb-1">通过 API 拉取真实用量</h3>
      <p className="muted text-xs mb-4">
        用量属于账户私密数据，且各厂商管理平台接口有跨域(CORS)与安全限制，<b>网页端无法安全直连</b>。
        因此这里生成一条可在本机运行的命令，把导出的 JSON 再拖进「账单导入」即可。
      </p>
      <div className="flex gap-2 mb-4">
        <button className={'btn btn-sm ' + (mode === 'openai' ? 'btn-primary' : '')} onClick={() => setMode('openai')}>OpenAI</button>
        <button className={'btn btn-sm ' + (mode === 'doubao' ? 'btn-primary' : '')} onClick={() => setMode('doubao')}>豆包 / 火山方舟</button>
      </div>

      <label className="text-xs muted block mb-1">{mode === 'openai' ? 'OpenAI Admin Key（sk-admin-...）' : '火山方舟 API Key / AK'}</label>
      <input className="input mb-2" type="password" placeholder={mode === 'openai' ? 'sk-admin-...' : '请输入或留空，仅用于生成命令'}
        value={key} onChange={e => setKey(e.target.value)} />
      <div className="text-[11px] faint mb-4 flex items-start gap-1">
        <AlertCircle size={12} className="mt-0.5 shrink-0" />
        Key 只在本页内存中用于拼接命令，不会上传或保存。建议用只读/管理密钥。
      </div>

      <div className="rounded-xl bg-slate-900 text-slate-100 p-4 mb-3 relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1"><Terminal size={12} /> 本机终端执行</span>
          <button className="text-[11px] flex items-center gap-1 text-slate-300 hover:text-white" onClick={() => copy(curlOpenAI)}>
            <Copy size={12} /> 复制
          </button>
        </div>
        <pre className="mono text-[11px] leading-relaxed whitespace-pre-wrap text-green-300">{curlOpenAI}</pre>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 mb-3">
        <b>豆包 / 火山方舟</b>：目前没有公开的「按用量反查 token」API，请在方舟控制台导出用量/账单 CSV，再回到「账单导入」页拖入即可自动识别。
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" onClick={pull} disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} 我已导出，去导入
        </button>
        <button className="btn btn-primary" onClick={onGoBill}>打开账单导入 <ChevronRight size={15} /></button>
      </div>
    </div>
  )
}
