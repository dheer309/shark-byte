import { useState, useEffect, useCallback } from 'react'
import { theme } from '../../styles/theme'
import { subscribeTapFeed, tap as tapApi, auth as authApi } from '../../lib/api'
import { useAuth } from '../../lib/useAuth'
import { useWindowSize } from '../../lib/useWindowSize'
import type { TapEvent, TapAction } from '../../types'

const O = theme.colors

// ─── Stat Card ──────────────────────────────────────
function Stat({ label, value, sub, color = O.orange }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
      padding: '20px 24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 80, height: 80,
        borderRadius: '50%', background: color, opacity: 0.05,
      }} />
      <div style={{
        fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
        letterSpacing: '0.12em', marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 32, fontWeight: 800, color: O.white,
        fontFamily: theme.fonts.mono, letterSpacing: '-0.02em', lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: 11, fontFamily: theme.fonts.mono,
          color: sub.startsWith('↑') ? O.success : sub.startsWith('↓') ? O.error : O.dim,
          marginTop: 8,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ─── Type Badge ─────────────────────────────────────
function Badge({ type }: { type: TapAction }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    attendance: { bg: O.orangeDim, color: O.orange, label: 'ATTEND' },
    equipment_checkout: { bg: 'rgba(59,130,246,0.15)', color: O.blue, label: 'CHECKOUT' },
    equipment_return: { bg: 'rgba(34,197,94,0.15)', color: O.success, label: 'RETURN' },
    event_checkin: { bg: 'rgba(168,85,247,0.15)', color: '#A855F7', label: 'EVENT' },
  }
  const c = config[type] || config.attendance
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 9, fontWeight: 600, fontFamily: theme.fonts.mono,
      background: c.bg, color: c.color, letterSpacing: '0.08em',
    }}>
      {c.label}
    </span>
  )
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

interface AttendanceRecord {
  _id: string
  name: string
  professor: string
  room: string
  start_time: string
  end_time: string
  status: 'upcoming' | 'live' | 'ended'
}

interface Stats {
  taps_today: number
  attendance_rate: number
  active_queues: number
  queue_students: number
  events_this_week: number
  active_students: number
}

export default function Overview() {
  const { user, isSuperuser } = useAuth()
  const { isMobile } = useWindowSize()
  const isGlobalAdmin = isSuperuser() || user?.role === 'class_admin'
  const [feed, setFeed] = useState<TapEvent[]>([])
  const [stats, setStats] = useState<Stats>({
    taps_today: 0, attendance_rate: 0, active_queues: 0, queue_students: 0, events_this_week: 0, active_students: 0,
  })
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([])
  const [myEventDates, setMyEventDates] = useState<string[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  const fetchMyAttendance = useCallback(async () => {
    if (!user) return
    try {
      const data = await authApi.myAttendance() as AttendanceRecord[]
      setMyAttendance(data)
    } catch { /* not logged in */ }
  }, [user])

  const fetchMyEvents = useCallback(async () => {
    if (!user || isGlobalAdmin) return
    try {
      const data = await authApi.mySocieties() as { societies: unknown[]; events: { date: string }[] }
      setMyEventDates(data.events.map(e => e.date))
    } catch { /* ignore */ }
  }, [user, isGlobalAdmin])

  // Load initial history + stats + my attendance + my events
  useEffect(() => {
    const fetchInitial = async () => {
      setStatsLoading(true)
      try {
        // Non-admins only see their own tap history
        const historyUserId = isGlobalAdmin ? undefined : user?._id
        const [history, statsData] = await Promise.all([
          tapApi.history(50, historyUserId) as Promise<TapEvent[]>,
          tapApi.stats() as Promise<Stats>,
        ])
        setFeed(history)
        setStats(statsData)
      } catch { /* backend unavailable */ }
      setStatsLoading(false)
    }
    fetchInitial()
    fetchMyAttendance()
    fetchMyEvents()
  }, [fetchMyAttendance, fetchMyEvents]) // eslint-disable-line react-hooks/exhaustive-deps

  // SSE — prepend new events, refresh my attendance if it's an attendance tap for current user
  useEffect(() => {
    const unsubscribe = subscribeTapFeed((event) => {
      const tapEvent = event as TapEvent
      // Non-admins only see their own taps in the feed
      if (isGlobalAdmin || (user && tapEvent.user_id === user._id)) {
        setFeed(prev => [tapEvent, ...prev.slice(0, 49)])
      }
      setStats(prev => ({ ...prev, taps_today: prev.taps_today + 1 }))
      if (user && tapEvent.user_id === user._id && tapEvent.action === 'attendance') {
        fetchMyAttendance()
      }
    })
    return unsubscribe
  }, [user, isGlobalAdmin, fetchMyAttendance])

  // Personal stats for non-admins (derived from already-fetched data)
  const todayStr = new Date().toDateString()
  const myTapsToday = !isGlobalAdmin
    ? feed.filter(e => new Date(e.timestamp).toDateString() === todayStr).length
    : null
  const myAttendanceRate = !isGlobalAdmin && myAttendance.length > 0
    ? Math.round(myAttendance.filter(l => l.status !== 'upcoming').length / myAttendance.length * 100)
    : null
  const myEventsThisWeek = !isGlobalAdmin
    ? (() => {
        const now = new Date(); now.setHours(0, 0, 0, 0)
        const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + 7)
        return myEventDates.filter(d => { const dt = new Date(d); return dt >= now && dt < nextWeek }).length
      })()
    : null

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: O.white }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: O.dim, marginTop: 4, fontFamily: theme.fonts.mono }}>
            {isGlobalAdmin ? 'Real-time campus activity' : 'Your activity today'}
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          borderRadius: 100, background: O.orangeDim, border: `1px solid ${O.orange}33`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: O.orange, animation: 'ledPulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: O.orange, fontWeight: 600, fontFamily: theme.fonts.mono, letterSpacing: '0.08em' }}>LIVE</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <Stat
          label="TAPS TODAY"
          value={statsLoading ? '—' : String(isGlobalAdmin ? stats.taps_today : (myTapsToday ?? 0))}
        />
        <Stat
          label={isGlobalAdmin ? 'ATTENDANCE RATE' : 'MY ATTENDANCE'}
          value={
            statsLoading ? '—'
            : isGlobalAdmin ? `${stats.attendance_rate}%`
            : myAttendance.length === 0 ? '—'
            : `${myAttendanceRate ?? 0}%`
          }
        />
        <Stat
          label="EVENTS THIS WEEK"
          value={statsLoading ? '—' : String(isGlobalAdmin ? stats.events_this_week : (myEventsThisWeek ?? 0))}
          color="#A855F7"
        />
      </div>

      {/* Tap History Feed */}
      <div style={{
        background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
        padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${O.rule}`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: O.white }}>{isGlobalAdmin ? 'Tap History' : 'My Tap History'}</span>
          <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em' }}>
            {feed.length > 0 ? `${feed.length} EVENTS` : 'NO EVENTS YET'}
          </span>
        </div>

        {feed.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: O.dim, fontSize: 13, fontFamily: theme.fonts.mono }}>
            No tap events yet. Tap a card to generate activity.
          </div>
        )}

        {feed.map((item, i) => (
          <div
            key={item._id}
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '70px 1fr' : '80px 1fr auto',
              gap: isMobile ? 8 : 12,
              padding: '12px 0',
              borderBottom: i < feed.length - 1 ? `1px solid ${O.rule}` : 'none',
              animation: i === 0 ? 'tapIn 0.4s cubic-bezier(0.16,1,0.3,1)' : 'none',
            }}
          >
            <div style={{ paddingTop: 1 }}>
              <Badge type={item.action} />
            </div>
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: O.text }}>{item.user_name}</span>
                <span style={{ fontSize: 12, color: O.muted }}>{item.context}</span>
                {item.is_first_arrival && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, fontFamily: theme.fonts.mono,
                    letterSpacing: '0.1em', color: O.warning,
                    padding: '1px 5px', borderRadius: 2, background: `${O.warning}20`,
                  }}>
                    FIRST
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.08em', marginTop: 2 }}>
                {item.device_id}
                {isMobile && (
                  <span style={{ marginLeft: 8, color: O.dim }}>{timeAgo(item.timestamp)}</span>
                )}
              </div>
            </div>
            {!isMobile && (
              <span style={{ fontSize: 11, fontFamily: theme.fonts.mono, color: O.dim, whiteSpace: 'nowrap' }}>
                {timeAgo(item.timestamp)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ─── My Attendance (students only) ─── */}
      {!isGlobalAdmin && myAttendance.length > 0 && (
        <div style={{
          background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
          padding: '20px 24px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${O.rule}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: O.white }}>My Attendance</span>
            <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em' }}>
              {myAttendance.filter(l => l.status !== 'upcoming').length} ATTENDED
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {myAttendance.map((lec, i) => {
              const time = new Date(lec.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
              const statusColor = lec.status === 'live' ? O.orange : lec.status === 'upcoming' ? O.blue : O.success
              return (
                <div key={lec._id} style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr auto' : '60px 1fr 1fr auto',
                  gap: 12, padding: '12px 0', alignItems: 'center',
                  borderBottom: i < myAttendance.length - 1 ? `1px solid ${O.rule}` : 'none',
                }}>
                  {!isMobile && (
                    <span style={{ fontSize: 13, fontFamily: theme.fonts.mono, color: O.muted }}>{time}</span>
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: O.text }}>{lec.name}</div>
                    <div style={{ fontSize: 12, color: O.dim }}>{lec.professor}{isMobile ? ` · ${time}` : ''}</div>
                  </div>
                  {!isMobile && (
                    <span style={{ fontSize: 13, color: O.muted }}>{lec.room}</span>
                  )}
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                    fontFamily: theme.fonts.mono, letterSpacing: '0.08em', textTransform: 'uppercase',
                    background: `${statusColor}20`, color: statusColor,
                  }}>
                    {lec.status === 'ended' ? 'attended' : lec.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
