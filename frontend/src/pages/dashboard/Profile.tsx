import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { theme } from '../../styles/theme'
import { useAuth } from '../../lib/useAuth'
import { useWindowSize } from '../../lib/useWindowSize'
import { auth } from '../../lib/api'
import type { User } from '../../types'

const O = theme.colors

interface AttendanceRecord {
  _id: string; name: string; professor: string; room: string
  start_time: string; end_time: string; status: string
}

interface MySociety {
  _id: string; name: string; description: string
  members: string[]; admins: string[]
}

interface MyEvent {
  _id: string; society_name: string; name: string
  date: string; location: string
}

export default function Profile() {
  const { user, logout, isSuperuser } = useAuth()
  const { isMobile } = useWindowSize()
  const navigate = useNavigate()

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [mySocieties, setMySocieties] = useState<MySociety[]>([])
  const [myEvents, setMyEvents] = useState<MyEvent[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({})
  const [promoting, setPromoting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [att, soc] = await Promise.all([
        auth.myAttendance() as Promise<AttendanceRecord[]>,
        auth.mySocieties() as Promise<{ societies: MySociety[]; events: MyEvent[] }>,
      ])
      setAttendance(att)
      setMySocieties(soc.societies)
      setMyEvents(soc.events)
    } catch { /* ignore */ }
  }, [])

  const fetchUsers = useCallback(async () => {
    if (!isSuperuser()) return
    try {
      const users = await auth.listUsers() as User[]
      setAllUsers(users)
    } catch { /* ignore */ }
  }, [isSuperuser])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handlePromote = async (targetId: string) => {
    const newRole = roleEdits[targetId]
    if (!newRole) return
    setPromoting(targetId)
    try {
      await auth.promoteUser({ target_user_id: targetId, new_role: newRole })
      await fetchUsers()
    } catch { /* ignore */ }
    setPromoting(null)
  }

  if (!user) return null

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
    letterSpacing: '0.12em', marginBottom: 4,
  }

  const valueStyle: React.CSSProperties = {
    fontSize: 14, fontFamily: theme.fonts.mono, color: O.text,
  }

  const cardStyle: React.CSSProperties = {
    background: O.ink, border: `1px solid ${O.rule}`,
    borderRadius: 8, padding: 24, marginBottom: 24,
  }

  const roleBadgeColor = (role: string) => {
    if (role === 'superuser') return O.orange
    if (role === 'class_admin') return O.blue
    if (role === 'society_admin') return O.warning
    if (role === 'professor') return O.success
    return O.dim
  }

  const roleLabel = (role: string) => {
    if (role === 'superuser') return 'SUPERUSER'
    if (role === 'class_admin') return 'CLASS ADMIN'
    if (role === 'society_admin') return 'SOCIETY ADMIN'
    if (role === 'professor') return 'PROFESSOR'
    return 'STUDENT'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
          margin: 0, color: O.white, fontFamily: theme.fonts.sans,
        }}>
          Profile
        </h1>
        <p style={{ margin: '6px 0 0', color: O.muted, fontSize: 14 }}>
          Your account and activity
        </p>
      </div>

      {/* ─── Identity Card ─── */}
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 14 : 20, marginBottom: 20 }}>
          <div>
            <div style={labelStyle}>NAME</div>
            <div style={valueStyle}>{user.name}</div>
          </div>
          <div>
            <div style={labelStyle}>EMAIL</div>
            <div style={valueStyle}>{user.email}</div>
          </div>
          <div>
            <div style={labelStyle}>UNIVERSITY</div>
            <div style={valueStyle}>{user.university || '—'}</div>
          </div>
          <div>
            <div style={labelStyle}>CARD UID</div>
            <div style={{
              ...valueStyle,
              color: user.card_uid ? O.text : O.dim,
              fontStyle: user.card_uid ? 'normal' : 'italic',
            }}>
              {user.card_uid || 'Not linked'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={labelStyle}>ROLE</div>
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: theme.fonts.mono,
              letterSpacing: '0.1em', color: roleBadgeColor(user.role),
              padding: '3px 8px', borderRadius: 4,
              background: `${roleBadgeColor(user.role)}26`,
            }}>
              {roleLabel(user.role)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/link-card')}
              style={{
                padding: '10px 16px', borderRadius: 6,
                border: `1px solid ${O.orange}44`,
                background: `${O.orange}14`,
                color: O.orange, fontSize: 11, fontWeight: 700,
                fontFamily: theme.fonts.mono, letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              {user.card_uid ? 'RELINK CARD' : 'LINK CARD'}
            </button>
            <button
              onClick={logout}
              style={{
                padding: '10px 20px', borderRadius: 6,
                border: `1px solid ${O.error}44`,
                background: `${O.error}14`,
                color: O.error, fontSize: 11, fontWeight: 700,
                fontFamily: theme.fonts.mono, letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </div>

      {/* ─── My Societies ─── */}
      <div style={cardStyle}>
        <h2 style={{
          fontSize: 16, fontWeight: 700, color: O.white,
          margin: '0 0 16px', fontFamily: theme.fonts.sans,
        }}>
          My Societies
        </h2>

        {mySocieties.length === 0 ? (
          <p style={{ color: O.dim, fontSize: 13, fontFamily: theme.fonts.mono }}>
            Not a member of any societies yet
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {mySocieties.map(s => (
              <div key={s._id} style={{
                padding: 16, borderRadius: 6, background: O.black,
                border: `1px solid ${O.rule}`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: O.white, marginBottom: 4 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono }}>
                  {s.members.length} members
                  {user && s.admins.includes(user._id) && (
                    <span style={{ color: O.orange, marginLeft: 8 }}>· ADMIN</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {myEvents.length > 0 && (
          <>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: O.muted,
              margin: '16px 0 10px', fontFamily: theme.fonts.mono,
              letterSpacing: '0.08em',
            }}>
              UPCOMING EVENTS
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {myEvents.map(e => (
                <div key={e._id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 6, background: O.black,
                  border: `1px solid ${O.rule}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: O.text }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono }}>{e.society_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: O.body, fontFamily: theme.fonts.mono }}>
                      {new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono }}>{e.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── User Management (Superuser Only) ─── */}
      {isSuperuser() && (
        <div style={cardStyle}>
          <h2 style={{
            fontSize: 16, fontWeight: 700, color: O.white,
            margin: '0 0 16px', fontFamily: theme.fonts.sans,
          }}>
            User Management
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Header */}
            {!isMobile && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px',
                gap: 12, padding: '8px 12px',
                fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
                letterSpacing: '0.1em', borderBottom: `1px solid ${O.rule}`,
              }}>
                <span>NAME</span><span>EMAIL</span><span>ROLE</span><span></span>
              </div>
            )}

            {allUsers.map(u => (
              <div key={u._id} style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 110px 72px' : '1fr 1fr 120px 100px',
                gap: isMobile ? 8 : 12, padding: '10px 12px', alignItems: 'center',
                borderBottom: `1px solid ${O.rule}11`,
              }}>
                <div>
                  <div style={{ fontSize: 13, color: O.text }}>{u.name}</div>
                  {isMobile && <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono }}>{u.email}</div>}
                </div>
                {!isMobile && (
                  <span style={{ fontSize: 12, color: O.body, fontFamily: theme.fonts.mono }}>{u.email}</span>
                )}
                <select
                  value={roleEdits[u._id] ?? u.role}
                  onChange={e => setRoleEdits(prev => ({ ...prev, [u._id]: e.target.value }))}
                  style={{
                    padding: '6px 4px', borderRadius: 4,
                    background: O.black, border: `1px solid ${O.rule}`,
                    color: O.text, fontSize: isMobile ? 10 : 11, fontFamily: theme.fonts.mono,
                    cursor: 'pointer', width: '100%',
                  }}
                >
                  <option value="student">student</option>
                  <option value="professor">professor</option>
                  <option value="society_admin">soc_admin</option>
                  <option value="class_admin">class_admin</option>
                  <option value="superuser">superuser</option>
                </select>
                <button
                  onClick={() => handlePromote(u._id)}
                  disabled={promoting === u._id || (roleEdits[u._id] ?? u.role) === u.role}
                  style={{
                    padding: '6px 8px', borderRadius: 4,
                    border: `1px solid ${O.orange}44`,
                    background: (roleEdits[u._id] ?? u.role) !== u.role ? O.orange : O.rule,
                    color: (roleEdits[u._id] ?? u.role) !== u.role ? O.black : O.dim,
                    fontSize: 10, fontWeight: 700, fontFamily: theme.fonts.mono,
                    letterSpacing: '0.06em',
                    cursor: (roleEdits[u._id] ?? u.role) !== u.role ? 'pointer' : 'default',
                  }}
                >
                  {promoting === u._id ? '...' : 'SAVE'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
