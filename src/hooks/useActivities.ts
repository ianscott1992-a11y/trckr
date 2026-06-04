import { useEffect } from 'react'
import { useActivityStore } from '../store/useActivityStore'

export function useActivities() {
  const { fetchActivities, fetchActiveEntry, activities, activeEntry, loading } = useActivityStore()

  useEffect(() => {
    fetchActivities()
    fetchActiveEntry()
  }, [fetchActivities, fetchActiveEntry])

  return { activities, activeEntry, loading }
}
