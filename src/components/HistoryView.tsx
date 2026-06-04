import { useState } from 'react'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useActivityStore } from '../store/useActivityStore'
import { formatDuration } from './LiveTimer'

function toLocalDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function HistoryView() {
  const [date, setDate] = useState(() => toLocalDateString(new Date()))
  const { entries, loading } = useTimeEntries(date)
  const activities = useActivityStore((s) => s.activities)

  const activityMap = Object.fromEntries(activities.map((a) => [a.id, a]))

  const totals: Record<string, number> = {}
  for (const e of entries) {
    const stopped = e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now()
    const ms = stopped - new Date(e.started_at).getTime()
    totals[e.activity_id] = (totals[e.activity_id] ?? 0) + ms
  }

  function prevDay() {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    setDate(toLocalDateString(d))
  }
  function nextDay() {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    const today = toLocalDateString(new Date())
    if (toLocalDateString(d) <= today) setDate(toLocalDateString(d))
  }

  const isToday = date === toLocalDateString(new Date())

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevDay} className="text-slate-400 hover:text-white px-2 py-1">‹</button>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={toLocalDateString(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-white text-sm text-center outline-none cursor-pointer"
          />
          {isToday && <span className="text-xs text-slate-400">Today</span>}
        </div>
        <button
          onClick={nextDay}
          disabled={isToday}
          className="text-slate-400 hover:text-white disabled:opacity-20 px-2 py-1"
        >›</button>
      </div>

      {/* Totals */}
      {Object.keys(totals).length > 0 && (
        <div className="space-y-1">
          {Object.entries(totals).map(([actId, ms]) => {
            const act = activityMap[actId]
            if (!act) return null
            return (
              <div key={actId} className="flex justify-between text-sm">
                <span className="text-slate-300">{act.name}</span>
                <span className="font-mono text-slate-400">{formatDuration(ms)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Entry list */}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500 text-sm">No entries for this day.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => {
            const act = activityMap[e.activity_id]
            const stopped = e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now()
            const ms = stopped - new Date(e.started_at).getTime()
            const startTime = new Date(e.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-slate-800">
                <span className="text-slate-500 text-xs font-mono w-12">{startTime}</span>
                <span className="flex-1 text-sm text-slate-200">{act?.name ?? 'Unknown'}</span>
                <span className="text-xs font-mono text-slate-400">{formatDuration(ms)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
