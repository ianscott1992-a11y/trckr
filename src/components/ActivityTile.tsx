import { useActivityStore } from '../store/useActivityStore'
import type { Activity, TimeEntry } from '../types'

const BG_COLORS: Record<string, string> = {
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

const ACTIVE_BG_COLORS: Record<string, string> = {
  slate:  'bg-slate-500',
  red:    'bg-red-500',
  orange: 'bg-orange-400',
  amber:  'bg-amber-400',
  green:  'bg-green-500',
  teal:   'bg-teal-500',
  blue:   'bg-blue-500',
  violet: 'bg-violet-500',
  pink:   'bg-pink-500',
}

interface Props {
  activity: Activity
  activeEntry: TimeEntry | null
  onEdit: (activity: Activity) => void
}

export function ActivityTile({ activity, activeEntry, onEdit }: Props) {
  const startActivity = useActivityStore((s) => s.startActivity)
  const stopAll = useActivityStore((s) => s.stopAll)
  const isActive = activeEntry?.activity_id === activity.id
  const colorKey = activity.color ?? 'slate'
  const bg = isActive
    ? (ACTIVE_BG_COLORS[colorKey] ?? 'bg-slate-500')
    : (BG_COLORS[colorKey] ?? 'bg-slate-600')

  function handleTap() {
    if (isActive) stopAll()
    else startActivity(activity.id)
  }

  return (
    <div
      className={`relative rounded-xl px-2 py-2 cursor-pointer select-none transition-all duration-150 active:scale-95 flex flex-col items-center justify-center h-14 ${bg} ${
        isActive ? 'ring-2 ring-white/50 shadow-lg' : 'opacity-90 hover:opacity-100'
      }`}
      onClick={handleTap}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-2 right-2">
          <span className="block h-2 w-2 rounded-full bg-white animate-pulse" />
        </div>
      )}

      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(activity) }}
        className="absolute top-1 left-1.5 text-white/30 hover:text-white/70 text-xs leading-none"
        aria-label="Edit"
      >⋯</button>

      {/* Label */}
      <span className="text-white font-semibold text-xs text-center leading-tight line-clamp-2 px-1">
        {activity.name}
      </span>

    </div>
  )
}
