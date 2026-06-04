import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { enqueue } from '../lib/offlineQueue'
import type { Activity, TimeEntry } from '../types'

interface ActivityStore {
  activities: Activity[]
  activeEntry: TimeEntry | null
  loading: boolean
  fetchActivities: () => Promise<void>
  fetchActiveEntry: () => Promise<void>
  startActivity: (activityId: string) => Promise<void>
  stopAll: () => Promise<void>
  addActivity: (name: string, color: string | null, parentId: string | null) => Promise<void>
  updateActivity: (id: string, updates: Partial<Pick<Activity, 'name' | 'color' | 'sort_order' | 'parent_id'>>) => Promise<void>
  deleteActivity: (id: string) => Promise<void>
  reorderActivities: (activities: Activity[]) => Promise<void>
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  activeEntry: null,
  loading: false,

  fetchActivities: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('activities')
      .select('*')
      .order('sort_order', { ascending: true })
    set({ activities: data ?? [], loading: false })
  },

  fetchActiveEntry: async () => {
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .is('stopped_at', null)
      .maybeSingle()
    set({ activeEntry: data ?? null })
  },

  startActivity: async (activityId: string) => {
    const now = new Date().toISOString()
    const online = navigator.onLine

    if (online) {
      await supabase.from('time_entries').update({ stopped_at: now }).is('stopped_at', null)
      await supabase.from('time_entries').insert({ activity_id: activityId, started_at: now })
    } else {
      await enqueue({ type: 'stop_open', payload: { stopped_at: now }, timestamp: now })
      await enqueue({ type: 'insert_entry', payload: { activity_id: activityId, started_at: now }, timestamp: now })
    }

    set({
      activeEntry: {
        id: crypto.randomUUID(),
        activity_id: activityId,
        started_at: now,
        stopped_at: null,
        created_at: now,
      },
    })
  },

  stopAll: async () => {
    const now = new Date().toISOString()
    await supabase.from('time_entries').update({ stopped_at: now }).is('stopped_at', null)
    set({ activeEntry: null })
  },

  addActivity: async (name: string, color: string | null, parentId: string | null) => {
    const { activities } = get()
    const sort_order = activities.length
    const { data } = await supabase
      .from('activities')
      .insert({ name, color, sort_order, parent_id: parentId })
      .select()
      .single()
    if (data) set({ activities: [...activities, data] })
  },

  updateActivity: async (id, updates) => {
    await supabase.from('activities').update(updates).eq('id', id)
    set((s) => ({
      activities: s.activities.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }))
  },

  deleteActivity: async (id) => {
    await supabase.from('activities').delete().eq('id', id)
    set((s) => ({
      activities: s.activities.filter((a) => a.id !== id && a.parent_id !== id),
      activeEntry: s.activeEntry?.activity_id === id ? null : s.activeEntry,
    }))
  },

  reorderActivities: async (activities) => {
    set({ activities })
    await Promise.all(
      activities.map((a, i) =>
        supabase.from('activities').update({ sort_order: i }).eq('id', a.id)
      )
    )
  },
}))

// Helper: group flat activities into parent→children structure
export function groupActivities(activities: Activity[]) {
  const parents = activities.filter((a) => a.parent_id === null)
  return parents.map((parent) => ({
    parent,
    children: activities.filter((a) => a.parent_id === parent.id),
  }))
}
