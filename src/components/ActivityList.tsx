import { useState } from 'react'
import { useActivityStore, groupActivities } from '../store/useActivityStore'
import { ActivityTile } from './ActivityTile'
import { AddActivityModal } from './AddActivityModal'
import { LiveTimer } from './LiveTimer'
import type { Activity } from '../types'

const BG_BANNER: Record<string, string> = {
  slate:  'bg-slate-600',
  red:    'bg-red-600',
  orange: 'bg-orange-500',
  amber:  'bg-amber-500',
  green:  'bg-green-600',
  teal:   'bg-teal-600',
  blue:   'bg-blue-600',
  violet: 'bg-violet-600',
  pink:   'bg-pink-600',
}

export function ActivityList() {
  const { activities, activeEntry, stopAll } = useActivityStore()
  const [editing, setEditing] = useState<Activity | null>(null)
  const [addParentId, setAddParentId] = useState<string | null | undefined>(undefined)

  const grouped = groupActivities(activities)
  const groupsWithChildren = grouped.filter((g) => g.children.length > 0)
  const standalones = activities.filter(
    (a) => a.parent_id === null && !activities.some((c) => c.parent_id === a.id)
  )

  const activeActivity = activeEntry
    ? activities.find((a) => a.id === activeEntry.activity_id)
    : null
  const bannerBg = BG_BANNER[activeActivity?.color ?? 'slate'] ?? 'bg-slate-600'

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* Active banner */}
      {activeEntry && activeActivity ? (
        <div
          className={`${bannerBg} rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer active:opacity-80 flex-shrink-0`}
          onClick={stopAll}
        >
          <div>
            <p className="text-white/70 text-xs mb-0.5">Now tracking — tap to stop</p>
            <p className="text-white font-semibold text-sm">{activeActivity.name}</p>
          </div>
          <div className="text-white font-mono text-lg font-bold">
            <LiveTimer startedAt={activeEntry.started_at} />
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl px-4 py-3 flex-shrink-0">
          <p className="text-slate-500 text-xs">Tap an activity to start tracking</p>
        </div>
      )}

      {/* Scrollable grid area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2">

        {/* Grouped activities */}
        {groupsWithChildren.map(({ parent, children }) => (
          <div key={parent.id}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {parent.name}
              </span>
              <button
                onClick={() => setEditing(parent)}
                className="text-slate-600 hover:text-slate-400 text-xs"
              >⋯</button>
              <button
                onClick={() => setAddParentId(parent.id)}
                className="ml-auto text-slate-600 hover:text-slate-400 text-xs"
              >+ add</button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {children.map((child) => (
                <ActivityTile
                  key={child.id}
                  activity={child}
                  activeEntry={activeEntry}
                  onEdit={setEditing}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Standalone activities */}
        {standalones.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {standalones.map((activity) => (
              <ActivityTile
                key={activity.id}
                activity={activity}
                activeEntry={activeEntry}
                onEdit={setEditing}
              />
            ))}
          </div>
        )}

        {/* Add buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setAddParentId(null)}
            className="flex-1 rounded-2xl border-2 border-dashed border-slate-700 py-2.5 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors text-xs"
          >
            + New group
          </button>
          <button
            onClick={() => setAddParentId(null)}
            className="flex-1 rounded-2xl border-2 border-dashed border-slate-700 py-2.5 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors text-xs"
          >
            + New activity
          </button>
        </div>
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
