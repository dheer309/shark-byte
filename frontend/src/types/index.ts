// ─── User & Auth ────────────────────────────────────
export interface User {
  _id: string
  email: string
  name: string
  card_uid: string | null
  role: 'student' | 'professor' | 'society_admin' | 'class_admin' | 'superuser'
  university: string
  created_at: string
}

// ─── Tap Events ─────────────────────────────────────
export type TapAction = 'attendance' | 'equipment_checkout' | 'equipment_return' | 'event_checkin'

export interface TapEvent {
  _id: string
  user_id: string
  user_name: string
  device_id: string
  action: TapAction
  context: string        // e.g. "Database Systems — Bush House 1.01"
  timestamp: string
  is_first_arrival?: boolean
}

// ─── Devices ────────────────────────────────────────
export type DeviceMode = 'attendance' | 'equipment' | 'event'

export interface Device {
  _id: string
  device_id: string
  name: string
  location: string
  mode: DeviceMode
  config: Record<string, unknown>  // mode-specific config
  is_online: boolean
  last_seen: string
}

// ─── Attendance ─────────────────────────────────────
export interface Lecture {
  _id: string
  name: string
  professor: string
  room: string
  start_time: string
  end_time: string
  device_id: string
  expected_students: number
  checked_in: number
  status: 'upcoming' | 'live' | 'ended'
}

// ─── Equipment ──────────────────────────────────────
export interface Equipment {
  _id: string
  name: string
  location: string
  device_id: string
  status: 'available' | 'in-use' | 'maintenance'
  current_user: string | null
  queue: string[]          // user_ids
  checkout_time: string | null
}

// ─── Societies & Events ─────────────────────────────
export interface SocietyAdminDetail {
  _id: string
  name: string
  email: string
}

export interface Society {
  _id: string
  name: string
  lead_id: string
  admins: string[]
  admin_details: SocietyAdminDetail[]
  members: string[]
  description: string
}

export interface SocietyEvent {
  _id: string
  society_id: string
  society_name: string
  name: string
  description: string
  location: string
  date: string
  capacity: number
  registered: string[]    // user_ids
  checked_in: string[]    // user_ids
  device_id: string | null
}

// ─── Gamification ────────────────────────────────────
export interface LeaderboardEntry {
  _id: string
  name: string
  university: string
  points: number
  current_streak: number
  best_streak: number
  first_arrivals: number
  badges: string[]
  rank: number
  total_users?: number
  weekly_taps?: number
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  me: LeaderboardEntry | null
}
