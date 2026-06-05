import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { TimeEntry } from '../types'

export function useTimeEntries(date: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    // Parse as local time (no Z) so boundaries respect the device timezone
    const start = new Date(`${date}T00:00:00`).toISOString()
    const end   = new Date(`${date}T23:59:59.999`).toISOString()
    supabase
      .from('time_entries')
      .select('*')
      .gte('started_at', start)
      .lte('started_at', end)
      .order('started_at', { ascending: true })
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [date])

  useEffect(() => { fetch() }, [fetch])

  return { entries, loading, refresh: fetch }
}
