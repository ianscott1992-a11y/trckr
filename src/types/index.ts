export interface Activity {
  id: string
  name: string
  color: string | null
  sort_order: number
  parent_id: string | null
  created_at: string
}

export interface TimeEntry {
  id: string
  activity_id: string
  started_at: string
  stopped_at: string | null
  created_at: string
}

export interface GroupedActivity {
  parent: Activity
  children: Activity[]
}
