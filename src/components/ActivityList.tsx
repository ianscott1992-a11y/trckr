import { useState } from 'react'
import { useActivityStore, groupActivities } from '../store/useActivityStore'
import { ActivityItem } from './ActivityItem'
import { AddActivityModal } from './AddActivityModal'
import type { Activity } from '../types'

export function ActivityList() {
  const { activities, activeEntry, reorderActivities } = useActivityStore()
  const [editing, setEditing] = useState<Activity | null>(null)
  // undefined = modal closed; null = add top-level; string = add under that parent
  const [addParentId, setAddParentId] = useState<string | null | undefined>(undefined)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const grouped = groupActivities(activities)
  const groupsWithChildren = grouped.filter((g) => g.children.length > 0)

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function moveChild(parentId: string, childIndex: number, direction: -1 | 1) {
    const siblings = activities.filter((a) => a.parent_id === parentId)
    const target = childIndex + direction
    if (target < 0 || target >= siblings.length) return
    const next = [...activities]
    const ai = next.findIndex((a) => a.id === siblings[childIndex].id)
    const bi = next.findIndex((a) => a.id === siblings[target].id)
    ;[next[ai], next[bi]] = [next[bi], next[ai]]
    reorderActivities(next)
  }

  function moveParent(parentIndex: number, direction: -1 | 1) {
    const target = parentIndex + direction
    if (target < 0 || target >= groupsWithChildren.length) return
    const newGrouped = [...groupsWithChildren]
    ;[newGrouped[parentIndex], newGrouped[target]] = [newGrouped[target], newGrouped[parentIndex]]
    const next = newGrouped.flatMap(({ parent, children }) => [parent, ...children])
    reorderActivities(next)
  }

  // Standalone = top-level with no children
  const standalones = activities.filter(
    (a) => a.parent_id === null && !activities.some((c) => c.parent_id === a.id)
  )

  return (
    <div className="space-y-2">
      {/* Grouped activities */}
      {groupsWithChildren.map(({ parent, children }, gi) => {
        const isOpen = !collapsed.has(parent.id)
        return (
          <div key={parent.id} className="space-y-1">
            {/* Parent header */}
            <div className="flex items-center gap-2 px-2">
              <button
                onClick={() => toggleCollapse(parent.id)}
                className="text-slate-400 hover:text-white text-xs w-4"
              >
                {isOpen ? '▾' : '▸'}
              </button>
              <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {parent.name}
              </span>
              <div className="flex flex-col gap-0.5">
                <button
                  disabled={gi === 0}
                  onClick={() => moveParent(gi, -1)}
                  className="text-slate-600 hover:text-slate-400 disabled:opacity-20 text-xs leading-none"
                >▲</button>
                <button
                  disabled={gi === groupsWithChildren.length - 1}
                  onClick={() => moveParent(gi, 1)}
                  className="text-slate-600 hover:text-slate-400 disabled:opacity-20 text-xs leading-none"
                >▼</button>
              </div>
              <button
                onClick={() => setEditing(parent)}
                className="text-slate-600 hover:text-slate-400 text-sm px-1"
              >⋯</button>
            </div>

            {/* Children */}
            {isOpen && (
              <div className="space-y-1">
                {children.map((child, ci) => (
                  <ActivityItem
                    key={child.id}
                    activity={child}
                    activeEntry={activeEntry}
                    onEdit={setEditing}
                    onMoveUp={() => moveChild(parent.id, ci, -1)}
                    onMoveDown={() => moveChild(parent.id, ci, 1)}
                    isFirst={ci === 0}
                    isLast={ci === children.length - 1}
                    indent
                  />
                ))}
                <button
                  onClick={() => setAddParentId(parent.id)}
                  className="ml-4 w-[calc(100%-1rem)] rounded-xl border border-dashed border-slate-700 py-2 text-slate-600 hover:text-slate-400 hover:border-slate-500 transition-colors text-xs"
                >
                  + Add to {parent.name}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Standalone activities */}
      {standalones.map((activity, i) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          activeEntry={activeEntry}
          onEdit={setEditing}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
          isFirst={i === 0}
          isLast={i === standalones.length - 1}
        />
      ))}

      {/* Add buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setAddParentId(null)}
          className="flex-1 rounded-2xl border-2 border-dashed border-slate-700 py-3 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors text-sm"
        >
          + New group
        </button>
        <button
          onClick={() => setAddParentId(null)}
          className="flex-1 rounded-2xl border-2 border-dashed border-slate-700 py-3 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors text-sm"
        >
          + New activity
        </button>
      </div>

      {addParentId !== undefined && (
        <AddActivityModal
          onClose={() => setAddParentId(undefined)}
          defaultParentId={addParentId}
        />
      )}
      {editing && (
        <AddActivityModal
          onClose={() => setEditing(null)}
          editing={editing}
        />
      )}
    </div>
  )
}
