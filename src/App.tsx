import { useEffect, useState } from 'react'
import { ActivityList } from './components/ActivityList'
import { HistoryView } from './components/HistoryView'
import { ReportsView } from './components/ReportsView'
import { AuthScreen } from './components/AuthScreen'
import { useActivities } from './hooks/useActivities'
import { useAuthStore } from './store/useAuthStore'
import { setupRealtimeSync, flushOfflineQueue } from './lib/sync'

type Tab = 'track' | 'history' | 'reports'

const TAB_LABELS: Record<Tab, string> = {
  track: 'Activities',
  history: 'History',
  reports: 'Reports',
}

function MainApp() {
  const [tab, setTab] = useState<Tab>('track')
  const { signOut, user } = useAuthStore()
  useActivities()

  useEffect(() => {
    setupRealtimeSync()
    function handleOnline() { flushOfflineQueue() }
    window.addEventListener('online', handleOnline)
    if (navigator.onLine) flushOfflineQueue()
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col max-w-2xl mx-auto w-full">
      <header className="px-4 sm:px-6 pt-6 sm:pt-10 pb-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Trckr</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:block">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="flex gap-1 px-4 sm:px-6 pb-3 flex-shrink-0">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              tab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      <main className="flex-1 px-4 sm:px-6 pb-6 overflow-y-auto min-h-0">
        {tab === 'track' && <ActivityList />}
        {tab === 'history' && <HistoryView />}
        {tab === 'reports' && <ReportsView />}
      </main>
    </div>
  )
}

export default function App() {
  const { user, loading, init } = useAuthStore()

  useEffect(() => { init() }, [init])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    )
  }

  return user ? <MainApp /> : <AuthScreen />
}
