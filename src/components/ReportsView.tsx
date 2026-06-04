import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useActivityStore, groupActivities } from '../store/useActivityStore'
import { formatDuration } from './LiveTimer'
import type { TimeEntry } from '../types'

type Period = 'day' | 'week' | 'month'

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day // Monday start
  const result = new Date(d)
  result.setDate(d.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function getRangeForPeriod(period: Period, offset: number): { start: Date; end: Date; label: string } {
  const now = new Date()

  if (period === 'day') {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    d.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)
    const label = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    return { start: d, end, label }
  }

  if (period === 'week') {
    const monday = startOfWeek(now)
    monday.setDate(monday.getDate() + offset * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    const label = offset === 0 ? 'This week'
      : `${monday.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
    return { start: monday, end: sunday, label }
  }

  // month
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  const label = offset === 0 ? 'This month' : d.toLocaleDateString([], { month: 'long', year: 'numeric' })
  return { start: d, end, label }
}

export function ReportsView() {
  const [period, setPeriod] = useState<Period>('day')
  const [offset, setOffset] = useState(0)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)

  const activities = useActivityStore((s) => s.activities)
  const grouped = groupActivities(activities)
  const activityMap = Object.fromEntries(activities.map((a) => [a.id, a]))

  const { start, end, label } = getRangeForPeriod(period, offset)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('time_entries')
      .select('*')
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString())
      .order('started_at', { ascending: true })
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, offset])

  // Compute ms per activity
  const activityMs: Record<string, number> = {}
  for (const e of entries) {
    const stopped = e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now()
    const ms = Math.max(0, stopped - new Date(e.started_at).getTime())
    activityMs[e.activity_id] = (activityMs[e.activity_id] ?? 0) + ms
  }

  // Roll up to parents
  const parentMs: Record<string, number> = {}
  for (const [actId, ms] of Object.entries(activityMs)) {
    const act = activityMap[actId]
    if (!act) continue
    const parentId = act.parent_id ?? actId
    parentMs[parentId] = (parentMs[parentId] ?? 0) + ms
  }

  const totalMs = Object.values(parentMs).reduce((a, b) => a + b, 0)

  const maxMs = Math.max(...Object.values(activityMs), 1)

  // Day breakdown: entries in chronological order
  const dayEntries = [...entries].sort((a, b) =>
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )

  return (
    <div className="space-y-5">
      {/* Period tabs */}
      <div className="flex gap-1">
        {(['day', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setOffset(0) }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              period === p ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset((o) => o - 1)}
          className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800">
          ‹
        </button>
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <button
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= 0}
          className="text-slate-400 hover:text-white disabled:opacity-20 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800"
        >›</button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : totalMs === 0 ? (
        <p className="text-slate-500 text-sm">No time tracked for this period.</p>
      ) : (
        <>
          {/* Total */}
          <div className="bg-slate-800 rounded-2xl px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-slate-400">Total tracked</span>
            <span className="font-mono font-semibold text-white">{formatDuration(totalMs)}</span>
          </div>

          {/* By group / parent */}
          <div className="space-y-4">
            {grouped.map(({ parent, children }) => {
              const pMs = parentMs[parent.id] ?? 0
              if (pMs === 0) return null
              const pct = totalMs > 0 ? Math.round((pMs / totalMs) * 100) : 0

              return (
                <div key={parent.id} className="space-y-2">
                  {/* Parent row */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-200 flex-1 uppercase tracking-wide text-xs">
                      {parent.name}
                    </span>
                    <span className="text-xs text-slate-500">{pct}%</span>
                    <span className="font-mono text-sm text-slate-300 w-20 text-right">{formatDuration(pMs)}</span>
                  </div>
                  {/* Parent bar */}
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Children */}
                  {children.map((child) => {
                    const cMs = activityMs[child.id] ?? 0
                    if (cMs === 0) return null
                    const cPct = maxMs > 0 ? Math.round((cMs / maxMs) * 100) : 0
                    const colorKey = child.color ?? 'slate'
                    const barColor = {
                      slate: 'bg-slate-500', red: 'bg-red-500', orange: 'bg-orange-500',
                      amber: 'bg-amber-500', green: 'bg-green-500', teal: 'bg-teal-500',
                      blue: 'bg-blue-500', violet: 'bg-violet-500', pink: 'bg-pink-500',
                    }[colorKey] ?? 'bg-slate-500'

                    return (
                      <div key={child.id} className="ml-3 space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-400 flex-1">{child.name}</span>
                          <span className="font-mono text-xs text-slate-500 w-20 text-right">{formatDuration(cMs)}</span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor} rounded-full`} style={{ width: `${cPct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Standalone activities */}
            {activities
              .filter((a) => a.parent_id === null && !activities.some((c) => c.parent_id === a.id))
              .map((act) => {
                const ms = activityMs[act.id] ?? 0
                if (ms === 0) return null
                const pct = totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0
                const barColor = {
                  slate: 'bg-slate-500', red: 'bg-red-500', orange: 'bg-orange-500',
                  amber: 'bg-amber-500', green: 'bg-green-500', teal: 'bg-teal-500',
                  blue: 'bg-blue-500', violet: 'bg-violet-500', pink: 'bg-pink-500',
                }[act.color ?? 'slate'] ?? 'bg-slate-500'
                return (
                  <div key={act.id} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-200 flex-1">{act.name}</span>
                      <span className="text-xs text-slate-500">{pct}%</span>
                      <span className="font-mono text-sm text-slate-300 w-20 text-right">{formatDuration(ms)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Day timeline (only shown for day view) */}
          {period === 'day' && dayEntries.length > 0 && (
            <div className="pt-2 space-y-1">
              <p className="text-xs uppercase tracking-widest text-slate-500 pb-1">Timeline</p>
              {dayEntries.map((e) => {
                const act = activityMap[e.activity_id]
                const stopped = e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now()
                const ms = Math.max(0, stopped - new Date(e.started_at).getTime())
                const startTime = new Date(e.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={e.id} className="flex items-center gap-3 py-1.5 border-b border-slate-800">
                    <span className="text-slate-500 text-xs font-mono w-12 flex-shrink-0">{startTime}</span>
                    <span className="flex-1 text-sm text-slate-300">{act?.name ?? 'Unknown'}</span>
                    <span className="text-xs font-mono text-slate-500">{formatDuration(ms)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
