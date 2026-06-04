import { useState } from 'react'
import { useActivityStore } from '../store/useActivityStore'
import type { Activity } from '../types'

const PALETTE = [
  { id: 'slate', label: 'Grey', cls: 'bg-slate-500' },
  { id: 'red', label: 'Red', cls: 'bg-red-500' },
  { id: 'orange', label: 'Orange', cls: 'bg-orange-500' },
  { id: 'amber', label: 'Amber', cls: 'bg-amber-500' },
  { id: 'green', label: 'Green', cls: 'bg-green-500' },
  { id: 'teal', label: 'Teal', cls: 'bg-teal-500' },
  { id: 'blue', label: 'Blue', cls: 'bg-blue-500' },
  { id: 'violet', label: 'Violet', cls: 'bg-violet-500' },
  { id: 'pink', label: 'Pink', cls: 'bg-pink-500' },
]

interface Props {
  onClose: () => void
  editing?: Activity | null
  defaultParentId?: string | null
}

export function AddActivityModal({ onClose, editing, defaultParentId = null }: Props) {
  const [name, setName] = useState(editing?.name ?? '')
  const [color, setColor] = useState<string>(editing?.color ?? 'slate')
  const [parentId, setParentId] = useState<string | null>(editing?.parent_id ?? defaultParentId)
  const { addActivity, updateActivity, deleteActivity, activities } = useActivityStore()

  const parents = activities.filter((a) => a.parent_id === null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (editing) {
      await updateActivity(editing.id, { name: trimmed, color, parent_id: parentId })
    } else {
      await addActivity(trimmed, color, parentId)
    }
    onClose()
  }

  async function handleDelete() {
    if (!editing) return
    const hasChildren = activities.some((a) => a.parent_id === editing.id)
    const msg = hasChildren
      ? `Delete "${editing.name}" and all its sub-activities? This cannot be undone.`
      : `Delete "${editing.name}"? All time entries for it will also be deleted.`
    if (confirm(msg)) {
      await deleteActivity(editing.id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-slate-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">
          {editing ? 'Edit activity' : 'New activity'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Activity name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
          />

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Group (optional)</label>
            <select
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/20 text-sm"
            >
              <option value="">— No group (top level) —</option>
              {parents
                .filter((p) => p.id !== editing?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                onClick={() => setColor(c.id)}
                className={`h-7 w-7 rounded-full ${c.cls} transition-transform ${color === c.id ? 'scale-125 ring-2 ring-white' : ''}`}
              />
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            {editing && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-red-400 hover:bg-red-900/30 text-sm"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold disabled:opacity-40 text-sm"
            >
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
