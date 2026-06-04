import { useEffect, useState } from 'react'

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(startedAt).getTime())

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime())
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return <span>{formatDuration(elapsed)}</span>
}

export { formatDuration }
