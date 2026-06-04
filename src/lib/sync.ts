import { supabase } from './supabase'
import { useActivityStore } from '../store/useActivityStore'
import { drainQueue, removeFromQueue } from './offlineQueue'

export function setupRealtimeSync() {
  // Remove any existing channels first (handles React StrictMode double-invoke)
  supabase.removeAllChannels()

  supabase
    .channel('time_entries_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
      useActivityStore.getState().fetchActiveEntry()
    })
    .subscribe()

  supabase
    .channel('activities_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
      useActivityStore.getState().fetchActivities()
    })
    .subscribe()
}

export async function flushOfflineQueue() {
  const items = await drainQueue()
  for (const { key, op } of items) {
    try {
      if (op.type === 'stop_open') {
        await supabase
          .from('time_entries')
          .update({ stopped_at: op.payload.stopped_at })
          .is('stopped_at', null)
      } else if (op.type === 'insert_entry') {
        await supabase.from('time_entries').insert(op.payload)
      }
      await removeFromQueue(key)
    } catch {
      // leave in queue, retry next time
    }
  }
  // refresh state after flush
  useActivityStore.getState().fetchActiveEntry()
}
