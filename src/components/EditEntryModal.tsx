import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useActivityStore } from '../store/useActivityStore'
import type { TimeEntry } from '../types'

interface Props {
  entry?: TimeEntry | null   // null = new entry
  date: string               // YYYY-MM-DD, used for new entries
  onClose: () => void
  onSaved: () => void
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  // Format as local time for datetime-local input
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export function EditEntryModal({ entry, date, onClose, onSaved }: Props) {
  const activities = useActivityStore((s) => s.activities)

  const parents = activities.filter(
    (a) => a.parent_id === null && activities.some((c) => c.parent_id === a.id)
  )
  const leafActivities = activities.filter(
    (a) => !activities.some((c) => c.parent_id === a.id)
  )
  const standalones = activities.filter(
    (a) => a.parent_id === null && !activities.some((c) => c.parent_id === a.id)
  )

  const defaultActivityId = entry?.activity_id ?? leafActivities[0]?.id ?? standalones[0]?.id ?? ''
  const defaultStart = entry ? toDateTimeLocal(entry.started_at) : `${date}T09:00`
  const defaultStop = entry?.stopped_at ? toDateTimeLocal(entry.stopped_at) : `${date}T09:30`

  const [activityId, setActivityId] = useState(defaultActivityId)
  const [startedAt, setStartedAt] = useState(defaultStart)
  const [stoppedAt, setStoppedAt] = useState(defaultStop)
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!activityId) { setError('Select an activity'); return }
    const start = new Date(startedAt)
    const stop = new Date(stoppedAt)
    if (isNaN(start.getTime()) || isNaN(stop.getTime())) { setError('Invalid time'); return }
    if (stop <= start) { setError('Stop time must be after start time'); return }

    setSaving(true)
    if (entry) {
      await supabase.from('time_entries').update({
        activity_id: activityId,
        started_at: start.toISOString(),
        stopped_at: stop.toISOString(),
        notes: notes || null,
      }).eq('id', entry.id)
    } else {
      await supabase.from('time_entries').insert({
        activity_id: activityId,
        started_at: start.toISOString(),
        stopped_at: stop.toISOString(),
        notes: notes || null,
      })
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!entry) return
    if (!confirm('Delete this time entry?')) return
    await supabase.from('time_entries').delete().eq('id', entry.id)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-slate-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">
          {entry ? 'Edit entry' : 'Add missing entry'}
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Activity picker */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Activity</label>
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/20 text-sm"
            >
              {parents.map((parent) => (
                <optgroup key={parent.id} label={parent.name}>
                  {leafActivities
                    .filter((a) => a.parent_id === parent.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </optgroup>
              ))}
              {standalones.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Start</label>
              <input
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-white/20 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Stop</label>
              <input
                type="datetime-local"
                value={stoppedAt}
                onChange={(e) => setStoppedAt(e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-white/20 text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note…"
              className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/20 text-sm"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            {entry && (
              <button type="button" onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-red-400 hover:bg-red-900/30 text-sm">
                Delete
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold disabled:opacity-40 text-sm">
              {saving ? 'Saving…' : entry ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
