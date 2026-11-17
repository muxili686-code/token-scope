import { useState } from 'react'
import { MapPin, ChevronDown, ChevronRight, FileCode2, Cloud, Info, CheckCircle2, AlertCircle, FolderOpen } from 'lucide-react'

interface Agent {
  name: string
  path: string
  /** direct=可直接读取, convert=需先在工具内导出, blocked=需导出用量账单 */
  support: 'direct' | 'convert' | 'blocked'
}

/** 本地日志型工具：名称 + 常见位置 + 读取方式 */
const CODING_AGENTS: Agent[] = [
  { name: 'WorkBuddy / CodeBuddy', path: '~/.workbuddy/projects/', support: 'direct' },
  { name: 'Claude Code', path: '~/.claude/projects/', support: 'direct' },
  { name: 'Qoder CLI（阿里）', path: '~/.qoder/projects/', support: 'direct' },
  { name: 'OpenAI Codex CLI', path: '~/.codex/sessions/', support: 'direct' },
  { name: 'Gemini CLI', path: '~/.gemini/tmp/', support: 'direct' },
  { name: 'Continue', path: '~/.continue/sessions/', support: 'direct' },
  { name: 'Hermes Agent', path: '~/.hermes/sessions/（JSONL 直接读取；state.db 也可直接读取）', support: 'direct' },
  { name: 'Cline / Roo Code / Kilo', path: 'VS Code 用户目录 globalStorage/*/tasks/', support: 'convert' },
  { name: 'Kimi Code', path: '~/.kimi-code/sessions/', support: 'convert' },
  { name: 'GitHub Copilot CLI', path: '~/.copilot/session-state/', support: 'convert' },
  { name: 'Goose', path: '~/.local/share/goose/sessions/', support: 'convert' },
  { name: 'DeepSeek Harness', path: '~/.dsh/sessions/（.jsonl.zstd 自动解压）', support: 'direct' },
  { name: 'Aider', path: '项目目录/.aider.chat.history.md', support: 'convert' },
  { name: 'OpenCode / MiMoCode / ZCode', path: '各工具用户数据目录（数据库文件，直接读取）', support: 'direct' },
  { name: 'Qoder 桌面端', path: '应用数据目录（数据库文件，直接读取）', support: 'direct' },
  { name: 'Cursor / Windsurf', path: '编辑器用户数据目录 state.vscdb（直接读取）', support: 'direct' },
  { name: 'Trae', path: '应用数据目录（数据库文件）', support: 'convert' },
]

const CLOUD_APPS: Agent[] = [
  { name: 'ChatGPT（网页 / 桌面）', path: '数据存于云端，无本地用量文件', support: 'blocked' },
  { name: '豆包（网页 / 桌面 / 工作）', path: '数据存于云端，无本地用量文件', support: 'blocked' },
  { name: 'Claude / Gemini 网页版', path: '数据存于云端，无本地用量文件', support: 'blocked' },
  { name: 'Devin / Jules 等云端 Agent', path: '任务在云端运行，无本地用量文件', support: 'blocked' },
]

const SUPPORT_META = {
  direct: { label: '可直接读取', color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle2 },
  convert: { label: '需先导出', color: '#d97706', bg: '#fffbeb', Icon: AlertCircle },
  blocked: { label: '需导出用量账单', color: '#64748b', bg: '#f8fafc', Icon: Cloud },
}

function AgentRow({ a }: { a: Agent }) {
  const m = SUPPORT_META[a.support]
  const Icon = m.Icon
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="sm:w-[210px] shrink-0 font-semibold text-slate-700 flex items-center gap-1.5">
        <FileCode2 size={13} className="text-slate-400" /> {a.name}
      </div>
      <div className="flex-1 min-w-0 mono text-[11px] text-slate-600 break-all">{a.path}</div>
      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full self-start sm:self-auto"
        style={{ color: m.color, background: m.bg }}>
        <Icon size={11} /> {m.label}
      </span>
    </div>
  )
}

export default function AgentLocations() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card">
      <button className="w-full flex items-center gap-2 px-4 py-3 text-left" onClick={() => setOpen(v => !v)}>
        <MapPin size={16} className="text-indigo-600" />
        <div className="flex-1">
          <div className="font-bold text-sm">用量日志在哪找？</div>
          <div className="text-[11px] faint">常见工具的本地位置，以及获取用量数据的方式</div>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3 mb-3 flex items-start gap-2 text-[11px] text-slate-700">
            <Info size={14} className="text-indigo-500 mt-0.5 shrink-0" />
            <span>
              <b>路径中的 <span className="mono">~</span></b> 表示你的用户主目录：Windows 如 <span className="mono">C:\Users\你的名字</span>，
              macOS / Linux 如 <span className="mono">/Users/你的名字</span>。选择「选择日志目录」可一次导入整个目录。
              标「可直接读取」的，把文件整个拖进来即可——压缩日志（.zstd）会自动解压，数据库文件（.db/.vscdb）会自动读取其中的用量。
              标「需先导出」的，请在工具内导出为 JSON / JSONL 后再拖入。
            </span>
          </div>

          <div className="mb-1 text-xs font-bold text-slate-700">编程工具 · 本地用量记录</div>
          <div className="rounded-xl border border-slate-200 px-3">
            {CODING_AGENTS.map(a => <AgentRow key={a.name} a={a} />)}
          </div>

          <div className="mt-3 mb-1 text-xs font-bold text-slate-700">聊天与云端工具 · 需导出用量账单</div>
          <div className="rounded-xl border border-slate-200 px-3">
            {CLOUD_APPS.map(a => <AgentRow key={a.name} a={a} />)}
          </div>

          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-[11px] text-emerald-800 flex items-start gap-2">
            <FolderOpen size={14} className="mt-0.5 shrink-0" />
            <span>
              网页 / 桌面聊天工具不显示逐条用量。如需统计，请在对应平台的开放平台或控制台导出用量账单（CSV），
              拖入「数据接入」即可；也可把对话文本贴进「Token 估算」了解大致规模。
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
