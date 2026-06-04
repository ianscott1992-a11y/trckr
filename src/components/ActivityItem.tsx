import { useActivityStore } from '../store/useActivityStore'
import { LiveTimer } from './LiveTimer'
import type { Activity, TimeEntry } from '../types'

export const COLORS: Record<string, string> = {
  slate: 'bg-slate-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  green: 'bg-green-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
}

export const TEXT_COLORS: Record<string, string> = {
  slate: 'text-slate-400',
  red: 'text-red-400',
  orange: 'text-orange-400',
  amber: 'text-amber-400',
  green: 'text-green-400',
  teal: 'text-teal-400',
  blue: 'text-blue-400',
  violet: 'text-violet-400',
  pink: 'text-pink-400',
}

interface Props {
  activity: Activity
  activeEntry: TimeEntry | null
  onEdit: (activity: Activity) => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  indent?: boolean
}

export function ActivityItem({
  activity, activeEntry, onEdit, onMoveUp, onMoveDown, isFirst, isLast, indent = false,
}: Props) {
  const startActivity = useActivityStore((s) => s.startActivity)
  const stopAll = useActivityStore((s) => s.stopAll)
  const isActive = activeEntry?.activity_id === activity.id
  const dotColor = COLORS[activity.color ?? 'slate'] ?? 'bg-slate-500'

  function handleTap() {
    if (isActive) stopAll()
    else startActivity(activity.id)
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer select-none transition-all duration-150 ${
        indent ? 'ml-4' : ''
      } ${
        isActive
          ? 'bg-slate-700 ring-2 ring-white/20'
          : 'bg-slate-800 hover:bg-slate-700/60 active:scale-[0.98]'
      }`}
      onClick={handleTap}
    >
      <div className={`relative h-3 w-3 rounded-full flex-shrink-0 ${dotColor}`}>
        {isActive && (
          <span className={`absolute inset-0 rounded-full ${dotColor} animate-ping opacity-75`} />
        )}
      </div>

      <span className="flex-1 text-sm font-medium text-white">{activity.name}</span>

      {isActive && (
        <span className="text-xs font-mono text-slate-300">
          <LiveTimer startedAt={activeEntry!.started_at} />
        </span>
      )}

      <div className="flex flex-col gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
        <button disabled={isFirst} onClick={onMoveUp}
          className="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-xs leading-none"
          aria-label="Move up">▲</button>
        <button disabled={isLast} onClick={onMoveDown}
          className="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-xs leading-none"
          aria-label="Move down">▼</button>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onEdit(activity) }}
        className="text-slate-500 hover:text-slate-300 text-sm px-1"
        aria-label="Edit"
      >⋯</button>
    </div>
  )
}
