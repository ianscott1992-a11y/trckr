import { useState } from 'react'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useActivityStore } from '../store/useActivityStore'
import { supabase } from '../lib/supabase'
import { formatDuration } from './LiveTimer'

const DOT_COLORS: Record<string, string> = {
  slate: 'bg-slate-500', red: 'bg-red-500', orange: 'bg-orange-500',
  amber: 'bg-amber-500', green: 'bg-green-500', teal: 'bg-teal-500',
  blue: 'bg-blue-500', violet: 'bg-violet-500', pink: 'bg-pink-500',
}

function toLocalDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function HistoryView() {
  const [date, setDate] = useState(() => toLocalDateString(new Date()))
  const { entries, loading, refresh } = useTimeEntries(date)
  const activities = useActivityStore((s) => s.activities)
  const activityMap = Object.fromEntries(activities.map((a) => [a.id, a]))

  // Track which entry is being edited and its draft value
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')

  const totals: Record<string, number> = {}
  for (const e of entries) {
    const stopped = e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now()
    const ms = stopped - new Date(e.started_at).getTime()
    totals[e.activity_id] = (totals[e.activity_id] ?? 0) + ms
  }

  function prevDay() {
    const d = new Date(date); d.setDate(d.getDate() - 1); setDate(toLocalDateString(d))
  }
  function nextDay() {
    const d = new Date(date); d.setDate(d.getDate() + 1)
    const today = toLocalDateString(new Date())
    if (toLocalDateString(d) <= today) setDate(toLocalDateString(d))
  }

  function startEdit(id: string, currentNote: string | null) {
    setEditingId(id)
    setDraftNote(currentNote ?? '')
  }

  async function saveNote(id: string) {
    await supabase.from('time_entries').update({ notes: draftNote || null }).eq('id', id)
    setEditingId(null)
    refresh()
  }

  function handleNoteKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter') { e.preventDefault(); saveNote(id) }
    if (e.key === 'Escape') setEditingId(null)
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
        <button onClick={nextDay} disabled={isToday}
          className="text-slate-400 hover:text-white disabled:opacity-20 px-2 py-1">›</button>
      </div>

      {/* Totals */}
      {Object.keys(totals).length > 0 && (
        <div className="space-y-1">
          {Object.entries(totals).map(([actId, ms]) => {
            const act = activityMap[actId]
            if (!act) return null
            const dot = DOT_COLORS[act.color ?? 'slate'] ?? 'bg-slate-500'
            return (
              <div key={actId} className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                <span className="text-slate-300 flex-1">{act.name}</span>
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
        <div className="space-y-0">
          {entries.map((e) => {
            const act = activityMap[e.activity_id]
            const stopped = e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now()
            const ms = stopped - new Date(e.started_at).getTime()
            const startTime = new Date(e.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const dot = DOT_COLORS[act?.color ?? 'slate'] ?? 'bg-slate-500'
            const isEditing = editingId === e.id

            return (
              <div key={e.id} className="py-2 border-b border-slate-800">
                {/* Main row */}
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs font-mono w-12 flex-shrink-0">{startTime}</span>
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                  <span className="flex-1 text-sm text-slate-200">{act?.name ?? 'Unknown'}</span>
                  <span className="text-xs font-mono text-slate-400">{formatDuration(ms)}</span>
                </div>

                {/* Note row */}
                <div className="ml-16 mt-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        onKeyDown={(e) => handleNoteKeyDown(e, e.currentTarget.closest('[data-id]')?.getAttribute('data-id') ?? editingId!)}
                        onBlur={() => saveNote(e.id)}
                        placeholder="Add a note…"
                        className="flex-1 bg-slate-800 text-white placeholder-slate-500 text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-slate-500"
                      />
                      <button onClick={() => saveNote(e.id)} className="text-xs text-slate-400 hover:text-white">✓</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-600 hover:text-slate-400">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(e.id, e.notes)}
                      className="text-left w-full group"
                    >
                      {e.notes ? (
                        <span className="text-xs text-slate-400 italic group-hover:text-slate-300">"{e.notes}"</span>
                      ) : (
                        <span className="text-xs text-slate-700 group-hover:text-slate-500">+ add note</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
