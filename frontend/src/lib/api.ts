import type { User } from '../types'

// ─── API Client ─────────────────────────────────────
// All backend communication in one place.
// Base URL uses Vite's proxy in dev (/api → localhost:5000)

const BASE = '/api'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sharkbyte_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${res.status}`)
  }

  return res.json()
}

// ─── Auth ───────────────────────────────────────────
export const auth = {
  register: (data: { email: string; name: string; university: string; password?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  verifyOtp: (data: { email: string; otp: string }) =>
    request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),

  resendOtp: (data: { email: string }) =>
    request('/auth/resend-otp', { method: 'POST', body: JSON.stringify(data) }),

  linkCard: (data: { user_id: string; card_uid: string }) =>
    request('/auth/link-card', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request('/auth/me'),

  myAttendance: () => request('/auth/me/attendance'),

  mySocieties: () => request('/auth/me/societies'),

  listUsers: () => request('/auth/users'),

  promoteUser: (data: { target_user_id: string; new_role: string }) =>
    request('/auth/promote', { method: 'POST', body: JSON.stringify(data) }),

  searchUsers: (q: string) =>
    request<User[]>(`/auth/search?q=${encodeURIComponent(q)}`),
}

// ─── Tap ────────────────────────────────────────────
export const tap = {
  process: (data: { device_id: string; card_uid: string }) =>
    request('/tap', { method: 'POST', body: JSON.stringify(data) }),

  history: (limit = 50, userId?: string) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (userId) params.set('user_id', userId)
    return request(`/tap-events?${params}`)
  },

  stats: () =>
    request('/stats'),
}

// ─── Attendance ─────────────────────────────────────
export const attendance = {
  getLectures: (params?: { date?: string; status?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return request(`/attendance/lectures${query ? `?${query}` : ''}`)
  },

  getLectureDetail: (id: string) =>
    request(`/attendance/lectures/${id}`),
}

// ─── Equipment ──────────────────────────────────────
export const equipment = {
  getAll: () => request('/equipment'),

  getDetail: (id: string) => request(`/equipment/${id}`),

  joinQueue: (id: string, userId: string) =>
    request(`/equipment/${id}/queue`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),

  leaveQueue: (id: string, userId: string) =>
    request(`/equipment/${id}/queue`, { method: 'DELETE', body: JSON.stringify({ user_id: userId }) }),
}

// ─── Societies ──────────────────────────────────────
export const societies = {
  getAll: () => request('/societies'),

  create: (data: { name: string; description: string }) =>
    request('/societies', { method: 'POST', body: JSON.stringify(data) }),

  getEvents: (societyId?: string) => {
    const query = societyId ? `?society_id=${societyId}` : ''
    return request(`/societies/events${query}`)
  },

  createEvent: (data: {
    society_id: string; name: string; description: string;
    location: string; date: string; capacity: number;
  }) => request('/societies/events', { method: 'POST', body: JSON.stringify(data) }),

  updateEvent: (eventId: string, data: Record<string, unknown>) =>
    request(`/societies/events/${eventId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteEvent: (eventId: string) =>
    request(`/societies/events/${eventId}`, { method: 'DELETE' }),

  register: (eventId: string) =>
    request(`/societies/events/${eventId}/register`, { method: 'POST', body: JSON.stringify({}) }),

  unregister: (eventId: string) =>
    request(`/societies/events/${eventId}/register`, { method: 'DELETE' }),

  addAdmin: (societyId: string, userId: string) =>
    request(`/societies/${societyId}/admins`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),

  addAdminByEmail: (societyId: string, email: string) =>
    request(`/societies/${societyId}/admins`, { method: 'POST', body: JSON.stringify({ email }) }),

  removeAdmin: (societyId: string, userId: string) =>
    request(`/societies/${societyId}/admins/${userId}`, { method: 'DELETE' }),

  transferPresidency: (societyId: string, userId: string) =>
    request(`/societies/${societyId}/transfer`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),

  joinSociety: (societyId: string) =>
    request(`/societies/${societyId}/join`, { method: 'POST' }),

  leaveSociety: (societyId: string) =>
    request(`/societies/${societyId}/leave`, { method: 'POST' }),
}

// ─── Gamification ───────────────────────────────────
export const gamification = {
  leaderboard: (period: 'all' | 'week' = 'all') =>
    request(`/gamification/leaderboard?period=${period}`),

  me: () => request('/gamification/me'),
}

// ─── Devices ────────────────────────────────────────
export const devices = {
  getAll: () => request('/devices'),

  register: (data: { device_id: string; name: string; location: string; mode: string }) =>
    request('/devices', { method: 'POST', body: JSON.stringify(data) }),

  updateMode: (id: string, mode: string, config?: Record<string, unknown>) =>
    request(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify({ mode, config }) }),
}

// ─── SSE Stream ─────────────────────────────────────
export function subscribeTapFeed(onEvent: (event: unknown) => void): () => void {
  const source = new EventSource(`${BASE}/stream/taps`)

  source.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data))
    } catch {
      // ignore parse errors
    }
  }

  source.onerror = () => {
    // EventSource auto-reconnects
  }

  return () => source.close()
}
