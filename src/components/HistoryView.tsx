import { useState, useRef, useEffect, useCallback } from 'react'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useActivityStore } from '../store/useActivityStore'
import { supabase } from '../lib/supabase'
import { formatDuration } from './LiveTimer'
import { EditEntryModal } from './EditEntryModal'
import type { TimeEntry } from '../types'

// ─── constants ───────────────────────────────────────────────────────────────
const START_HOUR = 5
const END_HOUR   = 23
const MIN_HR_PX  = 28
const MAX_HR_PX  = 240
const DEF_HR_PX  = 72
const SNAP       = 5   // minutes
const GAP_MIN    = 3   // ignore gaps smaller than this

const DOT_COLORS: Record<string, string> = {
  slate:'bg-slate-500', red:'bg-red-500', orange:'bg-orange-500',
  amber:'bg-amber-500', green:'bg-green-500', teal:'bg-teal-500',
  blue:'bg-blue-500', violet:'bg-violet-500', pink:'bg-pink-500',
}
const BLOCK_BG: Record<string, string> = {
  slate:'bg-slate-600', red:'bg-red-700', orange:'bg-orange-600',
  amber:'bg-amber-600', green:'bg-green-700', teal:'bg-teal-700',
  blue:'bg-blue-700', violet:'bg-violet-700', pink:'bg-pink-700',
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function toLocalDate(d: Date) { return d.toISOString().split('T')[0] }

function minOfDay(iso: string) {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

function minsToISO(date: string, mins: number): string {
  const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59))
  const h = Math.floor(clamped / 60)
  const m = Math.floor(clamped % 60)
  return new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).toISOString()
}

function snap(mins: number) { return Math.round(mins / SNAP) * SNAP }

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
}

// ─── component ───────────────────────────────────────────────────────────────
interface DragState {
  id: string
  kind: 'move' | 'top' | 'bottom'
  startY: number
  origStart: number
  origStop: number
  moved: boolean
}

interface LocalEntry { startMin: number; stopMin: number }

export function HistoryView() {
  const [date, setDate] = useState(() => toLocalDate(new Date()))
  const { entries, loading, refresh } = useTimeEntries(date)
  const activities = useActivityStore((s) => s.activities)
  const activityMap = Object.fromEntries(activities.map((a) => [a.id, a]))

  const [hourPx, setHourPx] = useState(DEF_HR_PX)
  const [locals, setLocals] = useState<Record<string, LocalEntry>>({})
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const drag = useRef<DragState | null>(null)
  const pinch = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const savedScroll = useRef<number>(0)

  // Restore scroll position after entries refresh
  useEffect(() => {
    if (containerRef.current && savedScroll.current > 0) {
      containerRef.current.scrollTop = savedScroll.current
    }
  }, [entries])

  function stableRefresh() {
    savedScroll.current = containerRef.current?.scrollTop ?? 0
    refresh()
  }

  // edit modal
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null | undefined>(undefined)
  const [gapStart, setGapStart] = useState<string>()
  const [gapEnd, setGapEnd]     = useState<string>()

  const isToday = date === toLocalDate(new Date())

  // ── zoom: ctrl+wheel — must attach to document to beat browser zoom ────────
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      // Only intercept when pointer is inside our container
      if (!containerRef.current?.contains(e.target as Node)) return
      e.preventDefault()
      setHourPx(p => Math.max(MIN_HR_PX, Math.min(MAX_HR_PX, p - e.deltaY * 0.4)))
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    return () => document.removeEventListener('wheel', onWheel)
  }, [])

  // ── zoom: touch pinch ─────────────────────────────────────────────────────
  function touchDist(t: React.TouchList) {
    const dx = t[0].clientX - t[1].clientX
    const dy = t[0].clientY - t[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) pinch.current = touchDist(e.touches)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinch.current !== null) {
      const newDist = touchDist(e.touches)
      const scale = newDist / pinch.current
      pinch.current = newDist
      setHourPx(p => Math.max(MIN_HR_PX, Math.min(MAX_HR_PX, p * scale)))
    }
  }

  function onTouchEnd() { pinch.current = null }

  // ── drag helpers ──────────────────────────────────────────────────────────
  function startDrag(
    e: React.PointerEvent,
    entry: TimeEntry,
    kind: DragState['kind'],
  ) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const origStart = minOfDay(entry.started_at)
    const origStop  = entry.stopped_at
      ? minOfDay(entry.stopped_at)
      : minOfDay(new Date().toISOString())
    drag.current = { id: entry.id, kind, startY: e.clientY, origStart, origStop, moved: false }
  }

  function onPointerMove(e: React.PointerEvent, entry: TimeEntry) {
    const d = drag.current
    if (!d || d.id !== entry.id) return
    const deltaMin = (e.clientY - d.startY) / hourPx * 60
    if (Math.abs(deltaMin) > 1) d.moved = true
    const dur = d.origStop - d.origStart

    let s = d.origStart, t = d.origStop
    if (d.kind === 'move') {
      s = snap(d.origStart + deltaMin)
      t = s + dur
    } else if (d.kind === 'top') {
      s = snap(Math.min(d.origStart + deltaMin, d.origStop - SNAP))
    } else {
      t = snap(Math.max(d.origStop + deltaMin, d.origStart + SNAP))
    }
    setLocals(prev => ({ ...prev, [entry.id]: { startMin: s, stopMin: t } }))
  }

  const stableRefreshRef = useRef(stableRefresh)
  useEffect(() => { stableRefreshRef.current = stableRefresh })

  const commitDrag = useCallback(async (entry: TimeEntry) => {
    const d = drag.current
    if (!d || d.id !== entry.id) return
    const local = locals[entry.id]
    drag.current = null
    if (!local || !d.moved) {
      setLocals(prev => { const n={...prev}; delete n[entry.id]; return n })
      if (!d.moved) setEditingEntry(entry) // treat as click
      return
    }
    setSaving(prev => new Set(prev).add(entry.id))
    await supabase.from('time_entries').update({
      started_at: minsToISO(date, local.startMin),
      stopped_at:  minsToISO(date, local.stopMin),
    }).eq('id', entry.id)
    setSaving(prev => { const n=new Set(prev); n.delete(entry.id); return n })
    setLocals(prev => { const n={...prev}; delete n[entry.id]; return n })
    stableRefreshRef.current()
  }, [locals, date])

  // ── derived data ──────────────────────────────────────────────────────────
  const totalHours = END_HOUR - START_HOUR
  const containerHeight = totalHours * hourPx

  const sorted = [...entries].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )

  // Column layout (Google Calendar algorithm)
  // Each entry assigned to leftmost column where it doesn't overlap previous entry
  const colEnds: number[] = []   // last stop-min of each column
  const entryCol = new Map<string, number>()

  for (const e of sorted) {
    const loc = locals[e.id]
    const sMin = loc?.startMin ?? minOfDay(e.started_at)
    const tMin = loc?.stopMin  ?? (e.stopped_at ? minOfDay(e.stopped_at) : minOfDay(new Date().toISOString()))
    let col = colEnds.findIndex(end => end <= sMin)
    if (col === -1) { col = colEnds.length; colEnds.push(tMin) }
    else colEnds[col] = tMin
    entryCol.set(e.id, col)
  }

  // For each entry, totalColumns = max column of all overlapping entries + 1
  const entryTotalCols = new Map<string, number>()
  for (const a of sorted) {
    const aCol = entryCol.get(a.id) ?? 0
    const aLoc = locals[a.id]
    const aS = aLoc?.startMin ?? minOfDay(a.started_at)
    const aT = aLoc?.stopMin  ?? (a.stopped_at ? minOfDay(a.stopped_at) : minOfDay(new Date().toISOString()))
    let maxCol = aCol
    for (const b of sorted) {
      if (b.id === a.id) continue
      const bLoc = locals[b.id]
      const bS = bLoc?.startMin ?? minOfDay(b.started_at)
      const bT = bLoc?.stopMin  ?? (b.stopped_at ? minOfDay(b.stopped_at) : minOfDay(new Date().toISOString()))
      if (aS < bT && bS < aT) maxCol = Math.max(maxCol, entryCol.get(b.id) ?? 0)
    }
    entryTotalCols.set(a.id, maxCol + 1)
  }

  const overlappingIds = new Set(
    [...entryTotalCols.entries()].filter(([, t]) => t > 1).map(([id]) => id)
  )

  const gaps = sorted.flatMap((e, i) => {
    if (i === sorted.length - 1 || !e.stopped_at) return []
    const stopMin  = minOfDay(e.stopped_at)
    const nextStart= minOfDay(sorted[i + 1].started_at)
    if (nextStart - stopMin < GAP_MIN) return []
    return [{ startIso: e.stopped_at, endIso: sorted[i+1].started_at, startMin: stopMin, endMin: nextStart }]
  })

  const totals: Record<string, number> = {}
  for (const e of entries) {
    const ms = (e.stopped_at ? new Date(e.stopped_at).getTime() : Date.now()) - new Date(e.started_at).getTime()
    totals[e.activity_id] = (totals[e.activity_id] ?? 0) + ms
  }

  function topPx(m: number)   { return Math.max(0, (m - START_HOUR * 60) / 60 * hourPx) }
  function hPx(s: number, t: number) { return Math.max(22, (t - s) / 60 * hourPx) }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-3">

      {/* Date nav */}
      <div className="flex items-center justify-between flex-shrink-0">
        <button onClick={() => { const d=new Date(date); d.setDate(d.getDate()-1); setDate(toLocalDate(d)) }}
          className="text-slate-400 hover:text-white px-2 py-1">‹</button>
        <div className="flex items-center gap-2">
          <input type="date" value={date} max={toLocalDate(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-white text-sm text-center outline-none cursor-pointer"/>
          {isToday && <span className="text-xs text-slate-400">Today</span>}
        </div>
        <button onClick={() => { const d=new Date(date); d.setDate(d.getDate()+1); if(toLocalDate(d)<=toLocalDate(new Date())) setDate(toLocalDate(d)) }}
          disabled={isToday} className="text-slate-400 hover:text-white disabled:opacity-20 px-2 py-1">›</button>
      </div>

      {/* Totals */}
      {Object.keys(totals).length > 0 && (
        <div className="flex-shrink-0 space-y-1">
          {Object.entries(totals).map(([id, ms]) => {
            const act = activityMap[id]; if (!act) return null
            return (
              <div key={id} className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${DOT_COLORS[act.color??'slate']}`}/>
                <span className="text-slate-300 flex-1">{act.name}</span>
                <span className="font-mono text-slate-400">{formatDuration(ms)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Zoom hint */}
      <p className="flex-shrink-0 text-slate-600 text-xs">
        Pinch or Ctrl+scroll to zoom · Drag edges to resize · Drag block to move
      </p>

      {/* Add missing */}
      <button onClick={() => { setGapStart(undefined); setGapEnd(undefined); setEditingEntry(null) }}
        className="flex-shrink-0 w-full rounded-xl border border-dashed border-slate-700 py-1.5 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors text-xs">
        + Add missing entry
      </button>

      {/* Overlap warning */}
      {overlappingIds.size > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 bg-red-900/30 rounded-xl px-3 py-2">
          <span className="text-red-400 text-xs">⚠ Overlapping entries — tap to edit</span>
        </div>
      )}

      {/* Timeline */}
      {loading ? <p className="text-slate-500 text-sm">Loading…</p> : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden select-none"
          style={{ touchAction: 'pan-y' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="relative" style={{ height: containerHeight, minHeight: containerHeight }}>

            {/* Hour grid */}
            {Array.from({ length: totalHours + 1 }, (_, i) => {
              const h = START_HOUR + i
              const label = h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h-12}pm`
              return (
                <div key={h} className="absolute left-0 right-0 flex items-start pointer-events-none"
                  style={{ top: i * hourPx }}>
                  <span className="text-slate-600 text-xs w-12 flex-shrink-0 -mt-2 text-right pr-2">{label}</span>
                  <div className="flex-1 border-t border-slate-800"/>
                </div>
              )
            })}

            {/* Gap blocks */}
            {gaps.map((g, i) => {
              const top = topPx(g.startMin)
              const h   = hPx(g.startMin, g.endMin)
              if (h < 8) return null
              return (
                <div key={i}
                  className="absolute left-13 right-1 rounded-lg border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-center"
                  style={{ top, height: h, left: 52 }}
                  onClick={() => { setGapStart(g.startIso); setGapEnd(g.endIso); setEditingEntry(null) }}
                >
                  <span className="text-slate-600 text-xs">+ {Math.round(g.endMin - g.startMin)}m gap</span>
                </div>
              )
            })}

            {/* Entry blocks */}
            {sorted.map((e) => {
              const act = activityMap[e.activity_id]
              const local = locals[e.id]
              const sMin = local?.startMin ?? minOfDay(e.started_at)
              const tMin = local?.stopMin  ?? (e.stopped_at ? minOfDay(e.stopped_at) : minOfDay(new Date().toISOString()))
              const top  = topPx(sMin)
              const h    = hPx(sMin, tMin)
              const bg   = BLOCK_BG[act?.color ?? 'slate'] ?? 'bg-slate-600'
              const isOverlap = overlappingIds.has(e.id)
              const isSaving  = saving.has(e.id)
              const isDragging= drag.current?.id === e.id
              const showDetail= h > 38

              // Column layout
              const col   = entryCol.get(e.id) ?? 0
              const total = entryTotalCols.get(e.id) ?? 1
              const colW  = `calc((100% - 52px - 4px) / ${total})`
              const colL  = `calc(52px + (100% - 52px - 4px) / ${total} * ${col})`

              return (
                <div
                  key={e.id}
                  className={`absolute rounded-lg overflow-hidden transition-shadow ${bg} ${
                    isOverlap ? 'ring-2 ring-red-500' : ''
                  } ${isDragging ? 'shadow-2xl ring-2 ring-white/30 z-20' : 'z-10'} ${
                    isSaving ? 'opacity-60' : ''
                  }`}
                  style={{ top, height: h, left: colL, width: colW, cursor: 'grab', touchAction: 'none' }}
                  onPointerDown={(ev) => startDrag(ev, e, 'move')}
                  onPointerMove={(ev) => onPointerMove(ev, e)}
                  onPointerUp={() => commitDrag(e)}
                >
                  {/* Top resize handle */}
                  <div
                    className="absolute top-0 left-0 right-0 h-2.5 cursor-ns-resize z-10 hover:bg-white/10"
                    onPointerDown={(ev) => { ev.stopPropagation(); startDrag(ev, e, 'top') }}
                  >
                    <div className="mx-auto mt-0.5 w-6 h-0.5 rounded-full bg-white/30"/>
                  </div>

                  {/* Content */}
                  <div className="px-2 pt-3 pb-2">
                    <p className="text-white text-xs font-semibold leading-tight truncate">
                      {act?.name ?? 'Unknown'}
                      {isOverlap && <span className="ml-1 text-red-300">⚠</span>}
                    </p>
                    {showDetail && (
                      <p className="text-white/60 text-xs">
                        {fmt(e.started_at)} → {e.stopped_at ? fmt(e.stopped_at) : 'now'} · {formatDuration((tMin - sMin) * 60000)}
                      </p>
                    )}
                    {e.notes && showDetail && (
                      <p className="text-white/40 text-xs italic truncate">"{e.notes}"</p>
                    )}
                  </div>

                  {/* Bottom resize handle */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize z-10 hover:bg-white/10"
                    onPointerDown={(ev) => { ev.stopPropagation(); startDrag(ev, e, 'bottom') }}
                  >
                    <div className="mx-auto mb-0.5 w-6 h-0.5 rounded-full bg-white/30"/>
                  </div>
                </div>
              )
            })}

          </div>
        </div>
      )}

      {/* Modal */}
      {editingEntry !== undefined && (
        <EditEntryModal
          entry={editingEntry}
          date={date}
          gapStart={gapStart}
          gapEnd={gapEnd}
          onClose={() => setEditingEntry(undefined)}
          onSaved={stableRefresh}
        />
      )}
    </div>
  )
}
