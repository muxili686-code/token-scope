import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, ScanSearch, Calculator, Tags, ShieldCheck, Menu, X,
} from 'lucide-react'
import type { UsageRecord, View, Price } from './types'
import { loadPrices, savePrices, loadRate, saveRate, aggregate } from './lib/pricing'
import {
  loadBatches, saveBatch, deleteBatch as dbDeleteBatch,
  renameBatch as dbRenameBatch, clearBatches, newBatchId, type ImportBatch,
} from './lib/storage'
import FileAnalysis from './components/FileAnalysis'
import Dashboard from './components/Dashboard'
import Estimator from './components/Estimator'
import PricesView from './components/PricesView'

const NAV: Array<{ id: View; label: string; icon: any; desc: string }> = [
  { id: 'analyze', label: '数据接入', icon: ScanSearch, desc: '选文件·识别·计费' },
  { id: 'dashboard', label: '总览看板', icon: LayoutDashboard, desc: '趋势与占比' },
  { id: 'estimator', label: 'Token 估算', icon: Calculator, desc: '文本换算' },
  { id: 'prices', label: '价格管理', icon: Tags, desc: '单价可校' },
]

export default function App() {
  const [view, setView] = useState<View>('analyze')
  const [batches, setBatches] = useState<ImportBatch[]>([])
  /** 看板数据源：选中的批次 id；空数组 = 全部数据 */
  const [boardBatchIds, setBoardBatchIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [prices, setPrices] = useState<Record<string, Price>>(() => loadPrices())
  const [rate, setRate] = useState<number>(() => loadRate())
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)

  // 启动时从 IndexedDB 恢复批次
  useEffect(() => {
    loadBatches().then(setBatches).finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // 全部记录（用于顶部计数）与看板数据源记录
  const allRecords = useMemo(() => batches.flatMap(b => b.records), [batches])
  const boardBatches = useMemo(() =>
    boardBatchIds.length ? batches.filter(b => boardBatchIds.includes(b.id)) : batches,
    [batches, boardBatchIds])
  const boardRecords = useMemo(() => boardBatches.flatMap(b => b.records), [boardBatches])
  const aggs = useMemo(() => aggregate(boardRecords, prices, rate), [boardRecords, prices, rate])

  /** 在总览看板中打开指定批次（或全部） */
  function openBatchesInDashboard(ids: string[]) {
    setBoardBatchIds(ids)
    setView('dashboard')
  }

  function handlePrices(p: Record<string, Price>, r: number) {
    setPrices(p); savePrices(p)
    setRate(r); saveRate(r)
  }

  async function addData(incoming: UsageRecord[], name?: string) {
    if (!incoming.length) return
    const batch: ImportBatch = {
      id: newBatchId(),
      name: name || `导入 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(),
      count: incoming.length,
      records: incoming,
    }
    setBatches(prev => [batch, ...prev])
    setBoardBatchIds([batch.id]) // 看板默认只显示刚导入的这批
    try { await saveBatch(batch) } catch { setToast('数据已载入，但保存到本机失败') }
  }

  async function removeBatch(id: string) {
    setBatches(prev => prev.filter(b => b.id !== id))
    setBoardBatchIds(prev => prev.filter(x => x !== id))
    try { await dbDeleteBatch(id); setToast('已删除该批数据') } catch { setToast('删除失败') }
  }

  async function renameBatch(id: string, name: string) {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, name } : b))
    try { await dbRenameBatch(id, name) } catch { /* 内存已更新 */ }
  }

  async function clearAll() {
    setBatches([])
    setBoardBatchIds([])
    try { await clearBatches(); setToast('已清空全部数据') } catch { setToast('清空失败') }
  }

  const title = NAV.find(n => n.id === view)!

  return (
    <div className="flex h-full min-h-screen">
      {/* sidebar */}
      <aside className={'fixed md:static inset-y-0 left-0 z-40 w-[230px] bg-white border-r border-slate-200 flex flex-col transition-transform md:translate-x-0 ' + (mobileNav ? 'translate-x-0' : '-translate-x-full')}>
        <div className="h-[70px] flex items-center gap-2.5 px-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>T</div>
          <div>
            <div className="font-extrabold text-[15px] leading-tight tracking-tight">TokenScope</div>
            <div className="text-[10px] faint">用量与成本看板</div>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => {
            const Icon = n.icon
            const on = view === n.id
            return (
              <button key={n.id} onClick={() => { setView(n.id); setMobileNav(false) }}
                className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ' + (on ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600')}>
                <Icon size={18} className={on ? 'text-indigo-600' : 'text-slate-400'} />
                <div>
                  <div className="text-sm font-semibold">{n.label}</div>
                  <div className={'text-[10px] ' + (on ? 'text-indigo-500/70' : 'faint')}>{n.desc}</div>
                </div>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 flex items-start gap-2">
            <ShieldCheck size={15} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] font-semibold text-emerald-900">数据安全</div>
              <div className="text-[10px] text-emerald-800 leading-snug mt-0.5">全部本地运行，数据不上传、不联网，只留在你的设备</div>
            </div>
          </div>
        </div>
      </aside>

      {mobileNav && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setMobileNav(false)} />}

      {/* main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[70px] shrink-0 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 md:px-7 sticky top-0 z-20">
          <button className="md:hidden" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div>
            <h1 className="font-bold text-base">{title.label}</h1>
            <p className="text-[11px] faint hidden sm:block">{title.desc}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {(view === 'dashboard' ? boardRecords : allRecords).length > 0 && (
              <span className="tag">{(view === 'dashboard' ? boardRecords : allRecords).length} 条记录</span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-7">
          <div className="max-w-[1200px] mx-auto">
            {!ready ? (
              <div className="card card-pad text-center py-24 text-sm faint">正在载入本机数据…</div>
            ) : (
              <>
                {view === 'analyze' && (
                  <FileAnalysis
                    prices={prices}
                    rate={rate}
                    batches={batches}
                    onData={addData}
                    onToast={setToast}
                    onGoDashboard={() => setView('dashboard')}
                    onGoPrices={() => setView('prices')}
                    onRemoveBatch={removeBatch}
                    onRenameBatch={renameBatch}
                    onClearAll={clearAll}
                    onOpenBatch={openBatchesInDashboard}
                  />
                )}
                {view === 'dashboard' && (
                  <Dashboard
                    records={boardRecords}
                    aggs={aggs}
                    batches={batches}
                    selectedIds={boardBatchIds}
                    onSelectBatches={setBoardBatchIds}
                    onGoSource={() => setView('analyze')}
                  />
                )}
                {view === 'estimator' && <Estimator prices={prices} rate={rate} />}
                {view === 'prices' && <PricesView prices={prices} rate={rate} onChange={handlePrices} onToast={setToast} />}
              </>
            )}
          </div>
        </main>

        <footer className="px-7 py-3 border-t border-slate-200 bg-white text-[11px] faint flex items-center justify-between">
          <span>TokenScope · 费用按官方单价计算，仅供参考，以平台账单为准</span>
        </footer>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
