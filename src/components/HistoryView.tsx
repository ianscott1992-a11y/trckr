import { useState } from 'react'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useActivityStore } from '../store/useActivityStore'
import { formatDuration } from './LiveTimer'
import { EditEntryModal } from './EditEntryModal'
import type { TimeEntry } from '../types'

const DOT_COLORS: Record<string, string> = {
  slate: 'bg-slate-500', red: 'bg-red-500', orange: 'bg-orange-500',
  amber: 'bg-amber-500', green: 'bg-green-500', teal: 'bg-teal-500',
  blue: 'bg-blue-500', violet: 'bg-violet-500', pink: 'bg-pink-500',
}

const BLOCK_COLORS: Record<string, string> = {
  slate: 'bg-slate-600', red: 'bg-red-700', orange: 'bg-orange-600',
  amber: 'bg-amber-600', green: 'bg-green-700', teal: 'bg-teal-700',
  blue: 'bg-blue-700', violet: 'bg-violet-700', pink: 'bg-pink-700',
}

const HOUR_PX = 72    // pixels per hour
const START_HOUR = 6  // 6am
const END_HOUR = 23   // 11pm
const GAP_MIN = 3     // gaps smaller than this (minutes) are ignored

function toLocalDateString(date: Date) {
  return date.toISOString().split('T')[0]
}

function minuteOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}


function topPx(minutes: number): number {
  return Math.max(0, (minutes - START_HOUR * 60) / 60 * HOUR_PX)
}

function heightPx(startMin: number, stopMin: number): number {
  return Math.max(22, (stopMin - startMin) / 60 * HOUR_PX)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Gap {
  startIso: string
  endIso: string
  startMin: number
  endMin: number
}

export function HistoryView() {
  const [date, setDate] = useState(() => toLocalDateString(new Date()))
  const { entries, loading, refresh } = useTimeEntries(date)
  const activities = useActivityStore((s) => s.activities)
  const activityMap = Object.fromEntries(activities.map((a) => [a.id, a]))

  const [editingEntry, setEditingEntry] = useState<TimeEntry | null | undefined>(undefined)
  const [gapStart, setGapStart] = useState<string | undefined>()
  const [gapEnd, setGapEnd] = useState<string | undefined>()

  function prevDay() {
    const d = new Date(date); d.setDate(d.getDate() - 1); setDate(toLocalDateString(d))
  }
  function nextDay() {
    const d = new Date(date); d.setDate(d.getDate() + 1)
    const today = toLocalDateString(new Date())
    if (toLocalDateString(d) <= today) setDate(toLocalDateString(d))
  }

  function openGap(gap: Gap) {
    setGapStart(gap.startIso)
    setGapEnd(gap.endIso)
    setEditingEntry(null)
  }

  function openEdit(e: TimeEntry) {
    setGapStart(undefined)
    setGapEnd(undefined)
    setEditingEntry(e)
  }

  function openNew() {
    setGapStart(undefined)
    setGapEnd(undefined)
    setEditingEntry(null)
  }

  const isToday = date === toLocalDateString(new Date())

  // Sort entries by start time
  const sorted = [...entries].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )

  // Detect overlapping entries
  const overlappingIds = new Set<string>()
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const aStart = new Date(sorted[i].started_at).getTime()
      const aStop = sorted[i].stopped_at ? new Date(sorted[i].stopped_at!).getTime() : Date.now()
      const bStart = new Date(sorted[j].started_at).getTime()
      const bStop = sorted[j].stopped_at ? new Date(sorted[j].stopped_at!).getTime() : Date.now()
      if (aStart < bStop && bStart < aStop) {
        overlappingIds.add(sorted[i].id)
        overlappingIds.add(sorted[j].id)
      }
    }
  }

  // Compute gaps between consecutive entries
  const gaps: Gap[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const thisStop = sorted[i].stopped_at
    const nextStart = sorted[i + 1].started_at
    if (!thisStop) continue
    const stopMin = minuteOfDay(thisStop)
    const startMin = minuteOfDay(nextStart)
    if (startMin - stopMin > GAP_MIN) {
      gaps.push({
        startIso: thisStop,
        endIso: nextStart,
        startMin: stopMin,
        endMin: startMin,
      })
    }
  }

  // Totals
  const totals: Record<string, number> = {}
  for (const e of entries) {
    const stopped = e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now()
    const ms = stopped - new Date(e.started_at).getTime()
    totals[e.activity_id] = (totals[e.activity_id] ?? 0) + ms
  }

  const totalHours = END_HOUR - START_HOUR
  const containerHeight = totalHours * HOUR_PX

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Date navigation */}
      <div className="flex items-center justify-between flex-shrink-0">
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

      {/* Totals summary */}
      {Object.keys(totals).length > 0 && (
        <div className="flex-shrink-0 space-y-1">
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

      {/* Add missing entry button */}
      <button
        onClick={openNew}
        className="flex-shrink-0 w-full rounded-xl border border-dashed border-slate-700 py-1.5 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors text-xs"
      >
        + Add missing entry
      </button>

      {/* Timeline */}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="relative" style={{ height: containerHeight }}>

            {/* Hour grid lines + labels */}
            {Array.from({ length: totalHours + 1 }, (_, i) => {
              const hour = START_HOUR + i
              const top = i * HOUR_PX
              return (
                <div key={hour} className="absolute left-0 right-0 flex items-start pointer-events-none" style={{ top }}>
                  <span className="text-slate-600 text-xs w-10 flex-shrink-0 -mt-2 text-right pr-2 select-none">
                    {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
                  </span>
                  <div className="flex-1 border-t border-slate-800" />
                </div>
              )
            })}

            {/* Entry blocks */}
            {sorted.map((e) => {
              const act = activityMap[e.activity_id]
              const startMin = minuteOfDay(e.started_at)
              const stopMin = e.stopped_at ? minuteOfDay(e.stopped_at) : minuteOfDay(new Date().toISOString())
              const top = topPx(startMin)
              const height = heightPx(startMin, stopMin)
              const bg = BLOCK_COLORS[act?.color ?? 'slate'] ?? 'bg-slate-600'
              const isOverlap = overlappingIds.has(e.id)
              const ms = (stopMin - startMin) * 60000
              const showDetails = height > 36

              return (
                <div
                  key={e.id}
                  className={`absolute left-11 right-1 rounded-lg px-2 py-1 cursor-pointer overflow-hidden transition-opacity hover:opacity-90 ${bg} ${
                    isOverlap ? 'ring-2 ring-red-500' : ''
                  }`}
                  style={{ top, height }}
                  onClick={() => openEdit(e)}
                >
                  <p className="text-white text-xs font-semibold leading-tight truncate">
                    {act?.name ?? 'Unknown'}
                  </p>
                  {showDetails && (
                    <p className="text-white/60 text-xs leading-tight">
                      {formatTime(e.started_at)} · {formatDuration(ms)}
                    </p>
                  )}
                  {isOverlap && (
                    <span className="absolute top-1 right-1 text-red-300 text-xs">⚠</span>
                  )}
                  {e.notes && showDetails && (
                    <p className="text-white/50 text-xs italic truncate mt-0.5">"{e.notes}"</p>
                  )}
                </div>
              )
            })}

            {/* Gap blocks */}
            {gaps.map((gap, i) => {
              const top = topPx(gap.startMin)
              const height = heightPx(gap.startMin, gap.endMin)
              const gapMins = Math.round(gap.endMin - gap.startMin)
              if (height < 10) return null
              return (
                <div
                  key={i}
                  className="absolute left-11 right-1 rounded-lg border border-dashed border-slate-600 cursor-pointer hover:border-slate-400 hover:bg-slate-800/50 transition-colors flex items-center justify-center"
                  style={{ top, height }}
                  onClick={() => openGap(gap)}
                >
                  <span className="text-slate-600 hover:text-slate-400 text-xs">
                    + {gapMins}m gap
                  </span>
                </div>
              )
            })}

          </div>
        </div>
      )}

      {/* Overlap warning */}
      {overlappingIds.size > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 bg-red-900/30 rounded-xl px-3 py-2">
          <span className="text-red-400 text-xs">⚠ {overlappingIds.size / 2 | 0} overlapping {(overlappingIds.size / 2 | 0) === 1 ? 'entry' : 'entries'} — tap to edit</span>
        </div>
      )}

      {/* Edit / Add modal */}
      {editingEntry !== undefined && (
        <EditEntryModal
          entry={editingEntry}
          date={date}
          gapStart={gapStart}
          gapEnd={gapEnd}
          onClose={() => setEditingEntry(undefined)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
