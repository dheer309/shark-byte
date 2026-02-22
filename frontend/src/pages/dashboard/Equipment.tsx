import { useState, useEffect } from 'react'
import { theme } from '../../styles/theme'
import { equipment as equipmentApi } from '../../lib/api'
import { useWindowSize } from '../../lib/useWindowSize'
import type { Equipment } from '../../types'

const O = theme.colors

const statusColors = {
  'available': { bg: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '#22C55E' },
  'in-use': { bg: O.orangeDim, color: O.orange, border: O.orange },
  'maintenance': { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '#EF4444' },
}

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const { isMobile } = useWindowSize()

  useEffect(() => {
    equipmentApi.getAll()
      .then((data) => setItems(data as Equipment[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: O.white }}>Equipment</h1>
        <p style={{ fontSize: 13, color: O.dim, marginTop: 4, fontFamily: theme.fonts.mono }}>Lab equipment status & queues</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 8 : 12, marginBottom: 20 }}>
        {[
          { label: 'AVAILABLE', value: String(items.filter(e => e.status === 'available').length), color: '#22C55E' },
          { label: 'IN USE', value: String(items.filter(e => e.status === 'in-use').length), color: O.orange },
          { label: 'IN QUEUE', value: String(items.reduce((s, e) => s + e.queue.length, 0)), color: O.blue },
        ].map((s, i) => (
          <div key={i} style={{ background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8, padding: isMobile ? '12px 14px' : '18px 22px' }}>
            <div style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.12em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: theme.fonts.mono, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: O.dim, fontSize: 13, fontFamily: theme.fonts.mono }}>
          Loading...
        </div>
      )}

      {/* Equipment Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        {items.map((eq) => {
          const sc = statusColors[eq.status]
          return (
            <div
              key={eq._id}
              style={{
                background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
                padding: '22px 24px', borderLeft: `3px solid ${sc.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: O.white }}>{eq.name}</div>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '3px 10px', borderRadius: 4,
                  fontFamily: theme.fonts.mono, letterSpacing: '0.08em', textTransform: 'uppercase',
                  background: sc.bg, color: sc.color,
                }}>
                  {eq.status}
                </span>
              </div>

              <div style={{ fontSize: 12, color: O.dim, fontFamily: theme.fonts.mono, marginBottom: 8 }}>{eq.location}</div>

              {eq.current_user && (
                <div style={{ fontSize: 13, color: O.muted, marginBottom: 4 }}>
                  Current: <span style={{ color: O.text }}>{eq.current_user}</span>
                </div>
              )}

              {eq.queue.length > 0 && (
                <div style={{ fontSize: 12, fontFamily: theme.fonts.mono, color: O.dim, marginTop: 6 }}>
                  Queue: {eq.queue.length} {eq.queue.length === 1 ? 'student' : 'students'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
