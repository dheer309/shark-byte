import { useState, useEffect, useCallback } from 'react'
import { theme } from '../../styles/theme'
import { attendance, subscribeTapFeed } from '../../lib/api'
import { useWindowSize } from '../../lib/useWindowSize'
import type { Lecture } from '../../types'

const O = theme.colors

function StatusBadge({ status }: { status: 'live' | 'ended' | 'upcoming' }) {
  const config = {
    live: { bg: O.orangeDim, color: O.orange },
    ended: { bg: `${O.dim}15`, color: O.dim },
    upcoming: { bg: 'rgba(59,130,246,0.15)', color: O.blue },
  }
  const c = config[status]
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 4,
      fontFamily: theme.fonts.mono, letterSpacing: '0.08em', textTransform: 'uppercase',
      background: c.bg, color: c.color,
    }}>
      {status}
    </span>
  )
}

export default function Attendance() {
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const { isMobile } = useWindowSize()

  const fetchLectures = useCallback(() => {
    attendance.getLectures()
      .then((data) => setLectures(data as Lecture[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLectures() }, [fetchLectures])

  useEffect(() => {
    const unsubscribe = subscribeTapFeed((event) => {
      const tap = event as { action: string }
      if (tap.action === 'attendance') fetchLectures()
    })
    return unsubscribe
  }, [fetchLectures])

  const totalCheckedIn = lectures.reduce((s, l) => s + l.checked_in, 0)
  const totalExpected = lectures.reduce((s, l) => s + l.expected_students, 0)
  const avgAttendance = totalExpected > 0 ? Math.round((totalCheckedIn / totalExpected) * 100) : 0

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: O.white }}>Attendance</h1>
        <p style={{ fontSize: 13, color: O.dim, marginTop: 4, fontFamily: theme.fonts.mono }}>Today's lectures</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'CHECK-INS', value: String(totalCheckedIn) },
          { label: 'AVG ATTEND.', value: `${avgAttendance}%` },
          { label: 'LECTURES', value: String(lectures.length) },
        ].map((s, i) => (
          <div key={i} style={{ background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8, padding: isMobile ? '14px 12px' : '18px 22px' }}>
            <div style={{ fontSize: 9, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.12em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, fontFamily: theme.fonts.mono, color: O.white }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: O.dim, fontSize: 13, fontFamily: theme.fonts.mono }}>Loading...</div>
      )}

      {/* Mobile: card list */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lectures.map((lec) => {
            const time = new Date(lec.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={lec._id} style={{
                background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8, padding: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, marginRight: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: O.text, marginBottom: 2 }}>{lec.name}</div>
                    <div style={{ fontSize: 12, color: O.dim }}>{lec.professor}</div>
                  </div>
                  <StatusBadge status={lec.status} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, fontFamily: theme.fonts.mono, color: O.muted }}>{time} · {lec.room}</div>
                  <div style={{ fontFamily: theme.fonts.mono, fontSize: 14 }}>
                    <span style={{ fontWeight: 700, color: O.white }}>{lec.checked_in}</span>
                    <span style={{ color: O.dim }}>/{lec.expected_students}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Desktop: table */
        <div style={{ background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '60px 1fr 1fr 100px 80px',
            gap: 12, padding: '12px 24px', borderBottom: `1px solid ${O.rule}`,
            fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em',
          }}>
            <span>TIME</span><span>LECTURE</span><span>ROOM</span><span>STUDENTS</span><span>STATUS</span>
          </div>
          {lectures.map((lec, i) => {
            const time = new Date(lec.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={lec._id} style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 1fr 100px 80px',
                gap: 12, padding: '16px 24px', alignItems: 'center',
                borderBottom: i < lectures.length - 1 ? `1px solid ${O.rule}` : 'none',
              }}>
                <span style={{ fontSize: 13, fontFamily: theme.fonts.mono, color: O.muted }}>{time}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: O.text }}>{lec.name}</div>
                  <div style={{ fontSize: 12, color: O.dim }}>{lec.professor}</div>
                </div>
                <span style={{ fontSize: 13, color: O.muted }}>{lec.room}</span>
                <div style={{ fontFamily: theme.fonts.mono, fontSize: 14 }}>
                  <span style={{ fontWeight: 700, color: O.white }}>{lec.checked_in}</span>
                  <span style={{ color: O.dim }}>/{lec.expected_students}</span>
                </div>
                <StatusBadge status={lec.status} />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
