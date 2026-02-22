import { useState, useEffect } from 'react'
import { theme } from '../../styles/theme'
import { societies as societiesApi, auth as authApi, devices as devicesApi } from '../../lib/api'
import { useAuth } from '../../lib/useAuth'
import { useWindowSize } from '../../lib/useWindowSize'
import type { Society, SocietyEvent, User, Device } from '../../types'

const O = theme.colors

export default function Societies() {
  const { user, isSuperuser, isSocietyAdmin } = useAuth()
  const { isMobile } = useWindowSize()
  const [societies, setSocieties] = useState<Society[]>([])
  const [events, setEvents] = useState<SocietyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showSocietyModal, setShowSocietyModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Manage society admins state
  const [managingSociety, setManagingSociety] = useState<string | null>(null)
  const [adminSearch, setAdminSearch] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminError, setAdminError] = useState('')

  // Create event form state
  const [newEvent, setNewEvent] = useState({
    society_id: '', name: '', description: '', location: '', date: '', capacity: 50,
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Create society form state
  const [newSociety, setNewSociety] = useState({ name: '', description: '' })
  const [creatingSociety, setCreatingSociety] = useState(false)
  const [societyError, setSocietyError] = useState('')

  // Discover societies
  const [discoverQuery, setDiscoverQuery] = useState('')
  const [joiningId, setJoiningId] = useState<string | null>(null)

  // Device locations for the event location dropdown
  const [deviceLocations, setDeviceLocations] = useState<string[]>([])

  // Edit event state
  const [editingEvent, setEditingEvent] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    society_id: '', name: '', description: '', location: '', date: '', capacity: 50,
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Enroll / unenroll state
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [unenrolling, setUnenrolling] = useState<string | null>(null)

  const fetchData = () => {
    Promise.all([
      societiesApi.getAll().then((data) => setSocieties(data as Society[])),
      societiesApi.getEvents().then((data) => setEvents(data as SocietyEvent[])),
      devicesApi.getAll().then((data) => {
        const locs = [...new Set((data as Device[]).map(d => d.location).filter(Boolean))]
        setDeviceLocations(locs)
      }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  // Societies the current user can manage
  const adminSocieties = societies.filter(s => isSocietyAdmin(s.admins))
  const canCreateEvent = adminSocieties.length > 0 || isSuperuser()

  // Only superuser/class_admin can create societies
  const canCreateSociety = isSuperuser() || user?.role === 'class_admin'

  // Only show events from societies the user is a member of
  // (superuser and class_admin see all)
  const isGlobalAdmin = isSuperuser() || user?.role === 'class_admin'
  const mySocietyIds = new Set(
    societies.filter(s => user && s.members.includes(user._id)).map(s => s._id)
  )
  const visibleEvents = isGlobalAdmin ? events : events.filter(ev => mySocietyIds.has(ev.society_id))

  // Search users by email (debounced)
  useEffect(() => {
    if (adminSearch.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await authApi.searchUsers(adminSearch)
        setSearchResults(results)
      } catch { setSearchResults([]) }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [adminSearch])

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      await societiesApi.createEvent({
        ...newEvent,
        capacity: Number(newEvent.capacity),
      })
      setShowEventModal(false)
      setNewEvent({ society_id: '', name: '', description: '', location: '', date: '', capacity: 50 })
      fetchData()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setCreating(false)
    }
  }

  const handleCreateSociety = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingSociety(true)
    setSocietyError('')
    try {
      await societiesApi.create(newSociety)
      setShowSocietyModal(false)
      setNewSociety({ name: '', description: '' })
      fetchData()
    } catch (err) {
      setSocietyError(err instanceof Error ? err.message : 'Failed to create society')
    } finally {
      setCreatingSociety(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    setDeleting(eventId)
    try {
      await societiesApi.deleteEvent(eventId)
      fetchData()
    } catch { /* ignore */ }
    setDeleting(null)
  }

  const handleAddAdmin = async (societyId: string, email: string) => {
    setAddingAdmin(true)
    setAdminError('')
    try {
      await societiesApi.addAdminByEmail(societyId, email)
      setAdminSearch('')
      setSearchResults([])
      fetchData()
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to add society admin')
    }
    setAddingAdmin(false)
  }

  const handleRemoveAdmin = async (societyId: string, userId: string) => {
    try {
      await societiesApi.removeAdmin(societyId, userId)
      fetchData()
    } catch { /* ignore */ }
  }

  const handleTransferPresidency = async (societyId: string, userId: string) => {
    try {
      await societiesApi.transferPresidency(societyId, userId)
      fetchData()
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to transfer presidency')
    }
  }

  const handleJoinSociety = async (societyId: string) => {
    setJoiningId(societyId)
    try {
      await societiesApi.joinSociety(societyId)
      fetchData()
    } catch { /* ignore */ }
    setJoiningId(null)
  }

  const handleLeaveSociety = async (societyId: string) => {
    setJoiningId(societyId)
    try {
      await societiesApi.leaveSociety(societyId)
      fetchData()
    } catch { /* ignore */ }
    setJoiningId(null)
  }

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvent) return
    setSaving(true)
    setEditError('')
    try {
      await societiesApi.updateEvent(editingEvent, {
        name: editForm.name,
        description: editForm.description,
        location: editForm.location,
        date: editForm.date,
        capacity: Number(editForm.capacity),
      })
      setEditingEvent(null)
      fetchData()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update event')
    } finally {
      setSaving(false)
    }
  }

  const handleEnroll = async (eventId: string) => {
    if (!user) return
    setEnrolling(eventId)
    try {
      await societiesApi.register(eventId)
      fetchData()
    } catch { /* ignore */ }
    setEnrolling(null)
  }

  const handleUnenroll = async (eventId: string) => {
    if (!user) return
    setUnenrolling(eventId)
    try {
      await societiesApi.unregister(eventId)
      fetchData()
    } catch { /* ignore */ }
    setUnenrolling(null)
  }

  const isEnrolled = (ev: SocietyEvent) => user ? ev.registered.includes(user._id) : false

  // Check if user can manage a specific event's society
  const canManageEvent = (ev: SocietyEvent) => {
    const soc = societies.find(s => s._id === ev.society_id)
    return soc ? isSocietyAdmin(soc.admins) : false
  }

  // Build society card data by enriching with event info
  const societyCards = societies.map(soc => {
    const socEvents = events.filter(e => e.society_id === soc._id)
    const nextEvent = socEvents[0]
    const totalSignups = socEvents.reduce((s, e) => s + e.registered.length, 0)
    const totalCheckins = socEvents.reduce((s, e) => s + e.checked_in.length, 0)

    let dateLabel = ''
    if (nextEvent) {
      const eventDate = new Date(nextEvent.date)
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      if (eventDate.toDateString() === today.toDateString()) dateLabel = 'Today'
      else if (eventDate.toDateString() === tomorrow.toDateString()) dateLabel = 'Tomorrow'
      else dateLabel = eventDate.toLocaleDateString('en-GB', { weekday: 'short' })
    }

    return {
      ...soc,
      nextEvent: nextEvent?.name || 'No upcoming events',
      dateLabel,
      eventCount: socEvents.length,
      signups: totalSignups,
      checkins: totalCheckins,
    }
  })

  // Split: societies user is a member of vs. others
  const mySocietyCards = isGlobalAdmin
    ? societyCards
    : societyCards.filter(s => user && s.members.includes(user._id))

  const otherSocieties = isGlobalAdmin
    ? []
    : societyCards.filter(s => user && !s.members.includes(user._id))

  const filteredOther = discoverQuery.trim().length > 0
    ? otherSocieties.filter(s =>
        s.name.toLowerCase().includes(discoverQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(discoverQuery.toLowerCase())
      )
    : otherSocieties

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', background: O.ink,
    border: `1px solid ${O.rule}`, borderRadius: 6, color: O.white,
    fontSize: 13, fontFamily: theme.fonts.sans, outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, fontFamily: theme.fonts.mono,
    color: O.dim, letterSpacing: '0.12em', marginBottom: 4,
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: O.white }}>Societies</h1>
            <p style={{ fontSize: 13, color: O.dim, marginTop: 4, fontFamily: theme.fonts.mono }}>Events & engagement tracking</p>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', gap: 10 }}>
              {canCreateSociety && (
                <button
                  onClick={() => setShowSocietyModal(true)}
                  style={{
                    background: 'transparent', color: O.orange, border: `1px solid ${O.orange}44`, borderRadius: 6,
                    padding: '10px 20px', fontSize: 12, fontWeight: 700,
                    fontFamily: theme.fonts.mono, letterSpacing: '0.04em', cursor: 'pointer',
                  }}
                >
                  + ADD SOCIETY
                </button>
              )}
              {canCreateEvent && (
                <button
                  onClick={() => {
                    if (adminSocieties.length > 0) setNewEvent(prev => ({ ...prev, society_id: adminSocieties[0]._id }))
                    setShowEventModal(true)
                  }}
                  style={{
                    background: O.orange, color: O.black, border: 'none', borderRadius: 6,
                    padding: '10px 20px', fontSize: 12, fontWeight: 700,
                    fontFamily: theme.fonts.mono, letterSpacing: '0.04em', cursor: 'pointer',
                  }}
                >
                  + CREATE EVENT
                </button>
              )}
            </div>
          )}
        </div>
        {/* Mobile action buttons */}
        {isMobile && (canCreateSociety || canCreateEvent) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {canCreateSociety && (
              <button
                onClick={() => setShowSocietyModal(true)}
                style={{
                  flex: 1, background: 'transparent', color: O.orange, border: `1px solid ${O.orange}44`,
                  borderRadius: 6, padding: '10px', fontSize: 12, fontWeight: 700,
                  fontFamily: theme.fonts.mono, letterSpacing: '0.04em', cursor: 'pointer',
                }}
              >
                + ADD SOCIETY
              </button>
            )}
            {canCreateEvent && (
              <button
                onClick={() => {
                  if (adminSocieties.length > 0) setNewEvent(prev => ({ ...prev, society_id: adminSocieties[0]._id }))
                  setShowEventModal(true)
                }}
                style={{
                  flex: 1, background: O.orange, color: O.black, border: 'none', borderRadius: 6,
                  padding: '10px', fontSize: 12, fontWeight: 700,
                  fontFamily: theme.fonts.mono, letterSpacing: '0.04em', cursor: 'pointer',
                }}
              >
                + CREATE EVENT
              </button>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: O.dim, fontSize: 13, fontFamily: theme.fonts.mono }}>
          Loading...
        </div>
      )}

      {/* My Societies */}
      {mySocietyCards.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
            letterSpacing: '0.12em', marginBottom: 12,
          }}>
            MY SOCIETIES
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            {mySocietyCards.map((soc) => {
              const isAdmin = user ? isSocietyAdmin(soc.admins) : false
              const isManaging = managingSociety === soc._id

              return (
                <div key={soc._id} style={{
              background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8, padding: '22px 24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: O.white }}>{soc.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {user && soc.admins.includes(user._id) && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, fontFamily: theme.fonts.mono,
                      letterSpacing: '0.1em', color: O.orange,
                      padding: '2px 6px', borderRadius: 3, background: `${O.orange}26`,
                    }}>
                      SOCIETY ADMIN
                    </span>
                  )}
                  {user && soc.lead_id === user._id && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, fontFamily: theme.fonts.mono,
                      letterSpacing: '0.1em', color: O.warning,
                      padding: '2px 6px', borderRadius: 3, background: `${O.warning}26`,
                    }}>
                      PRESIDENT
                    </span>
                  )}
                  <span style={{ fontSize: 11, fontFamily: theme.fonts.mono, color: O.orange }}>{soc.members.length} members</span>
                </div>
              </div>

              <div style={{
                background: O.black, borderRadius: 6, padding: '12px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: O.dim, marginBottom: 2 }}>Next event</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: O.text }}>{soc.nextEvent}</div>
                </div>
                <span style={{
                  fontSize: 11, fontFamily: theme.fonts.mono, fontWeight: 600,
                  color: soc.dateLabel === 'Today' ? O.orange : O.muted,
                }}>
                  {soc.dateLabel}
                </span>
              </div>

              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontFamily: theme.fonts.mono, color: O.dim }}>
                  {soc.eventCount} events · {soc.signups} signed up · {soc.checkins} checked in
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* Non-presidents can leave */}
                  {user && soc.lead_id !== user._id && (
                    <button
                      onClick={() => handleLeaveSociety(soc._id)}
                      disabled={joiningId === soc._id}
                      style={{
                        padding: '4px 10px', borderRadius: 4,
                        border: `1px solid ${O.error}44`, background: 'transparent',
                        color: O.error, fontSize: 10, fontFamily: theme.fonts.mono,
                        cursor: 'pointer', fontWeight: 700, letterSpacing: '0.06em',
                      }}
                    >
                      LEAVE
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setManagingSociety(isManaging ? null : soc._id)
                        setAdminSearch('')
                        setSearchResults([])
                        setAdminError('')
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 4,
                        border: `1px solid ${O.orange}44`, background: isManaging ? `${O.orange}26` : 'transparent',
                        color: O.orange, fontSize: 10, fontFamily: theme.fonts.mono,
                        cursor: 'pointer', fontWeight: 700, letterSpacing: '0.06em',
                      }}
                    >
                      {isManaging ? 'CLOSE' : 'MANAGE SOCIETY ADMINS'}
                    </button>
                  )}
                </div>
              </div>

              {/* ─── Manage Society Admins Panel ─── */}
              {isManaging && (
                <div style={{
                  marginTop: 14, padding: 16, borderRadius: 6,
                  background: O.black, border: `1px solid ${O.rule}`,
                }}>
                  <div style={{ ...labelStyle, marginBottom: 10 }}>CURRENT SOCIETY ADMINS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {(soc.admin_details || []).map(admin => {
                      const isLead = admin._id === soc.lead_id
                      const canTransfer = user && (soc.lead_id === user._id || isSuperuser()) && !isLead
                      return (
                        <div key={admin._id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 10px', borderRadius: 4, background: O.ink,
                        }}>
                          <div>
                            <div style={{ fontSize: 13, color: O.text, fontWeight: 600 }}>{admin.name || admin._id}</div>
                            <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono }}>{admin.email}</div>
                            {isLead && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, fontFamily: theme.fonts.mono,
                                color: O.warning, letterSpacing: '0.1em',
                              }}>
                                PRESIDENT
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {canTransfer && (
                              <button
                                onClick={() => handleTransferPresidency(soc._id, admin._id)}
                                style={{
                                  padding: '4px 8px', borderRadius: 3,
                                  border: `1px solid ${O.warning}44`, background: 'transparent',
                                  color: O.warning, fontSize: 9, fontFamily: theme.fonts.mono,
                                  cursor: 'pointer', fontWeight: 700,
                                }}
                              >
                                MAKE PRESIDENT
                              </button>
                            )}
                            {!isLead && soc.admins.length > 1 && (
                              <button
                                onClick={() => handleRemoveAdmin(soc._id, admin._id)}
                                style={{
                                  padding: '4px 8px', borderRadius: 3,
                                  border: `1px solid ${O.error}44`, background: 'transparent',
                                  color: O.error, fontSize: 9, fontFamily: theme.fonts.mono,
                                  cursor: 'pointer', fontWeight: 700,
                                }}
                              >
                                REMOVE
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ ...labelStyle, marginBottom: 6 }}>ADD SOCIETY ADMIN BY EMAIL</div>
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    placeholder="Search by email..."
                    style={{ ...inputStyle, background: O.ink, marginBottom: 6 }}
                  />

                  {searching && (
                    <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono, padding: '4px 0' }}>
                      Searching...
                    </div>
                  )}

                  {adminSearch.length >= 2 && !searching && searchResults.length === 0 && (
                    <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono, padding: '4px 0' }}>
                      No users found
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      {searchResults.map(u => {
                        const alreadyAdmin = soc.admins.includes(u._id)
                        return (
                          <div key={u._id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 10px', borderRadius: 4, background: O.ink,
                            border: `1px solid ${O.rule}`,
                          }}>
                            <div>
                              <div style={{ fontSize: 12, color: O.text }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono }}>{u.email}</div>
                            </div>
                            {alreadyAdmin ? (
                              <span style={{
                                fontSize: 9, fontWeight: 700, fontFamily: theme.fonts.mono,
                                color: O.dim, letterSpacing: '0.1em',
                              }}>
                                ALREADY ADMIN
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddAdmin(soc._id, u.email)}
                                disabled={addingAdmin}
                                style={{
                                  padding: '4px 10px', borderRadius: 4,
                                  border: 'none', background: O.orange,
                                  color: O.black, fontSize: 10, fontWeight: 700,
                                  fontFamily: theme.fonts.mono, cursor: 'pointer',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                {addingAdmin ? '...' : 'ADD'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {adminError && (
                    <div style={{
                      marginTop: 8, padding: '8px 10px', borderRadius: 4,
                      background: `${O.error}14`, border: `1px solid ${O.error}33`,
                      color: O.error, fontSize: 11, fontFamily: theme.fonts.mono,
                    }}>
                      {adminError}
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          })}
          </div>
        </div>
      )}

      {mySocietyCards.length === 0 && !loading && !isGlobalAdmin && (
        <div style={{
          background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
          padding: '32px', textAlign: 'center', marginBottom: 32,
        }}>
          <div style={{ fontSize: 14, color: O.muted, marginBottom: 8 }}>You haven't joined any societies yet.</div>
          <div style={{ fontSize: 12, color: O.dim, fontFamily: theme.fonts.mono }}>
            Discover societies below or create your own.
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      <div style={{ background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 24px', borderBottom: `1px solid ${O.rule}`,
          fontSize: 13, fontWeight: 700, color: O.white,
        }}>
          Upcoming Events
        </div>

        {!isMobile && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px 120px',
            gap: 12, padding: '10px 24px', borderBottom: `1px solid ${O.rule}`,
            fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em',
          }}>
            <span>EVENT</span><span>WHEN / WHERE</span><span>SIGN-UPS</span><span>CAPACITY</span><span></span>
          </div>
        )}

        {visibleEvents.length === 0 && !loading && (
          <div style={{ padding: '24px', textAlign: 'center', color: O.dim, fontSize: 13, fontFamily: theme.fonts.mono }}>
            {mySocietyIds.size === 0 && !isGlobalAdmin ? 'Join a society to see its events' : 'No events yet'}
          </div>
        )}

        {visibleEvents.map((ev, i) => {
          const fill = ev.capacity > 0 ? (ev.registered.length / ev.capacity) * 100 : 0
          const eventDate = new Date(ev.date)
          const dateStr = eventDate.toLocaleDateString('en-GB', { weekday: 'short' }) +
            ' ' + eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          const canManage = canManageEvent(ev)

          const openEdit = () => {
            const d = new Date(ev.date)
            const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            setEditForm({ society_id: ev.society_id, name: ev.name, description: ev.description || '', location: ev.location || '', date: localDate, capacity: ev.capacity })
            setEditError('')
            setEditingEvent(ev._id)
          }

          const actionButtons = (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {canManage && (
                <button onClick={openEdit} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${O.orange}44`, background: 'transparent', color: O.orange, fontSize: 10, fontFamily: theme.fonts.mono, cursor: 'pointer', fontWeight: 700 }}>
                  EDIT
                </button>
              )}
              {!isEnrolled(ev) && ev.registered.length < ev.capacity ? (
                <button onClick={() => handleEnroll(ev._id)} disabled={enrolling === ev._id} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${O.success}44`, background: 'transparent', color: O.success, fontSize: 10, fontFamily: theme.fonts.mono, cursor: 'pointer', fontWeight: 700 }}>
                  {enrolling === ev._id ? '...' : 'JOIN'}
                </button>
              ) : isEnrolled(ev) ? (
                <button onClick={() => handleUnenroll(ev._id)} disabled={unenrolling === ev._id} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${O.muted}44`, background: 'transparent', color: O.muted, fontSize: 10, fontFamily: theme.fonts.mono, cursor: 'pointer', fontWeight: 700 }}>
                  {unenrolling === ev._id ? '...' : '✓ LEAVE'}
                </button>
              ) : (
                <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 10, fontFamily: theme.fonts.mono, color: O.error, fontWeight: 700 }}>FULL</span>
              )}
              {canManage && (
                <button onClick={() => handleDeleteEvent(ev._id)} disabled={deleting === ev._id} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${O.error}44`, background: 'transparent', color: O.error, fontSize: 10, fontFamily: theme.fonts.mono, cursor: 'pointer', fontWeight: 700 }}>
                  {deleting === ev._id ? '...' : '×'}
                </button>
              )}
            </div>
          )

          if (isMobile) {
            return (
              <div key={ev._id} style={{ padding: '14px 16px', borderBottom: i < visibleEvents.length - 1 ? `1px solid ${O.rule}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: O.text }}>{ev.name}</div>
                    <div style={{ fontSize: 12, color: O.dim }}>{ev.society_name}</div>
                  </div>
                  <div style={{ fontFamily: theme.fonts.mono, fontSize: 13, whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700, color: O.white }}>{ev.registered.length}</span>
                    <span style={{ color: O.dim }}>/{ev.capacity}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: O.muted, marginBottom: 8 }}>{dateStr} · {ev.location}</div>
                {actionButtons}
              </div>
            )
          }

          return (
            <div key={ev._id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px 120px', gap: 12, padding: '16px 24px', alignItems: 'center', borderBottom: i < visibleEvents.length - 1 ? `1px solid ${O.rule}` : 'none' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: O.text }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: O.dim }}>{ev.society_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: O.muted }}>{dateStr}</div>
                <div style={{ fontSize: 12, color: O.dim }}>{ev.location}</div>
              </div>
              <div style={{ fontFamily: theme.fonts.mono, fontSize: 14 }}>
                <span style={{ fontWeight: 700, color: O.white }}>{ev.registered.length}</span>
                <span style={{ color: O.dim }}>/{ev.capacity}</span>
              </div>
              <div>
                <div style={{ width: '100%', height: 4, borderRadius: 2, background: O.rule, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(fill, 100)}%`, height: '100%', background: fill > 90 ? O.error : fill > 70 ? O.warning : O.orange, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, marginTop: 4 }}>{Math.round(fill)}% full</div>
              </div>
              {actionButtons}
            </div>
          )
        })}
      </div>

      {/* ─── Discover Societies ─── */}
      {!isGlobalAdmin && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{
              fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.12em',
            }}>
              DISCOVER SOCIETIES
            </div>
            <div style={{ fontSize: 11, fontFamily: theme.fonts.mono, color: O.dim }}>
              {otherSocieties.length} available
            </div>
          </div>

          <input
            type="text"
            value={discoverQuery}
            onChange={e => setDiscoverQuery(e.target.value)}
            placeholder="Search societies..."
            style={{
              ...inputStyle,
              marginBottom: 12,
              background: O.ink,
            }}
          />

          {filteredOther.length === 0 && !loading && (
            <div style={{
              padding: '24px', textAlign: 'center', color: O.dim,
              fontSize: 13, fontFamily: theme.fonts.mono,
              background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
            }}>
              {discoverQuery ? 'No societies match your search' : 'No other societies to discover'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            {filteredOther.map(soc => {
              const upcomingEvents = events
                .filter(e => e.society_id === soc._id)
                .slice(0, 3)

              return (
                <div key={soc._id} style={{
                  background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
                  padding: '20px 22px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: O.white, marginBottom: 4 }}>{soc.name}</div>
                      {soc.description && (
                        <div style={{ fontSize: 12, color: O.dim, lineHeight: 1.4 }}>{soc.description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleJoinSociety(soc._id)}
                      disabled={joiningId === soc._id}
                      style={{
                        padding: '6px 14px', borderRadius: 5,
                        border: `1px solid ${O.orange}66`, background: 'transparent',
                        color: O.orange, fontSize: 10, fontWeight: 700,
                        fontFamily: theme.fonts.mono, cursor: 'pointer',
                        letterSpacing: '0.04em', whiteSpace: 'nowrap', marginLeft: 12,
                      }}
                    >
                      {joiningId === soc._id ? '...' : 'JOIN'}
                    </button>
                  </div>

                  <div style={{
                    fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
                    letterSpacing: '0.1em', marginBottom: 6,
                  }}>
                    {soc.members.length} MEMBERS
                  </div>

                  {upcomingEvents.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                      {upcomingEvents.map(ev => (
                        <div key={ev._id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '7px 10px', borderRadius: 5, background: O.black,
                        }}>
                          <div style={{ fontSize: 12, color: O.text }}>{ev.name}</div>
                          <div style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.muted }}>
                            {new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {upcomingEvents.length === 0 && (
                    <div style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono, marginTop: 8 }}>
                      No upcoming events
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Edit Event Modal ─── */}
      {editingEvent && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setEditingEvent(null)}
        >
          <div
            style={{
              background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 12,
              padding: isMobile ? 20 : 32, maxWidth: 460, width: '92%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: 18, fontWeight: 800, color: O.white, margin: '0 0 24px',
              fontFamily: theme.fonts.sans, letterSpacing: '-0.02em',
            }}>
              Edit Event
            </h2>

            <form onSubmit={handleUpdateEvent}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>EVENT NAME</label>
                <input
                  type="text" value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>DESCRIPTION</label>
                <input
                  type="text" value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>LOCATION</label>
                  <select
                    value={editForm.location}
                    onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                    required
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Select location...</option>
                    {deviceLocations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>CAPACITY</label>
                  <input
                    type="number" value={editForm.capacity}
                    onChange={e => setEditForm(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    min={1} required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>DATE & TIME</label>
                <input
                  type="datetime-local" value={editForm.date}
                  onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                  required
                  style={inputStyle}
                />
              </div>

              {editError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, marginBottom: 14,
                  background: `${O.error}14`, border: `1px solid ${O.error}33`,
                  color: O.error, fontSize: 12, fontFamily: theme.fonts.mono,
                }}>
                  {editError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 6,
                    border: `1px solid ${O.rule}`, background: 'transparent',
                    color: O.muted, fontSize: 12, fontWeight: 700,
                    fontFamily: theme.fonts.mono, cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 6,
                    border: 'none', background: saving ? O.dim : O.orange,
                    color: O.black, fontSize: 12, fontWeight: 700,
                    fontFamily: theme.fonts.mono, cursor: saving ? 'default' : 'pointer',
                  }}
                >
                  {saving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Create Event Modal ─── */}
      {showEventModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowEventModal(false)}
        >
          <div
            style={{
              background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 12,
              padding: isMobile ? 20 : 32, maxWidth: 460, width: '92%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: 18, fontWeight: 800, color: O.white, margin: '0 0 24px',
              fontFamily: theme.fonts.sans, letterSpacing: '-0.02em',
            }}>
              Create Event
            </h2>

            <form onSubmit={handleCreateEvent}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>SOCIETY</label>
                <select
                  value={newEvent.society_id}
                  onChange={e => setNewEvent(prev => ({ ...prev, society_id: e.target.value }))}
                  required
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">Select society...</option>
                  {(isSuperuser() ? societies : adminSocieties).map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>EVENT NAME</label>
                <input
                  type="text" value={newEvent.name}
                  onChange={e => setNewEvent(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Intro to Rust Workshop" required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>DESCRIPTION</label>
                <input
                  type="text" value={newEvent.description}
                  onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Learn the basics of Rust"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>LOCATION</label>
                  <select
                    value={newEvent.location}
                    onChange={e => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                    required
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Select location...</option>
                    {deviceLocations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>CAPACITY</label>
                  <input
                    type="number" value={newEvent.capacity}
                    onChange={e => setNewEvent(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    min={1} required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>DATE & TIME</label>
                <input
                  type="datetime-local" value={newEvent.date}
                  onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                  required
                  style={inputStyle}
                />
              </div>

              {createError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, marginBottom: 14,
                  background: `${O.error}14`, border: `1px solid ${O.error}33`,
                  color: O.error, fontSize: 12, fontFamily: theme.fonts.mono,
                }}>
                  {createError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 6,
                    border: `1px solid ${O.rule}`, background: 'transparent',
                    color: O.muted, fontSize: 12, fontWeight: 700,
                    fontFamily: theme.fonts.mono, cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 6,
                    border: 'none', background: creating ? O.dim : O.orange,
                    color: O.black, fontSize: 12, fontWeight: 700,
                    fontFamily: theme.fonts.mono, cursor: creating ? 'default' : 'pointer',
                  }}
                >
                  {creating ? 'CREATING...' : 'CREATE EVENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Create Society Modal ─── */}
      {showSocietyModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowSocietyModal(false)}
        >
          <div
            style={{
              background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 12,
              padding: isMobile ? 20 : 32, maxWidth: 460, width: '92%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: 18, fontWeight: 800, color: O.white, margin: '0 0 8px',
              fontFamily: theme.fonts.sans, letterSpacing: '-0.02em',
            }}>
              Add Your Society
            </h2>
            <p style={{
              fontSize: 12, color: O.dim, fontFamily: theme.fonts.mono,
              margin: '0 0 24px',
            }}>
              You'll become the president and first society admin.
            </p>

            <form onSubmit={handleCreateSociety}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>SOCIETY NAME</label>
                <input
                  type="text" value={newSociety.name}
                  onChange={e => setNewSociety(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="KCL Robotics" required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>DESCRIPTION</label>
                <input
                  type="text" value={newSociety.description}
                  onChange={e => setNewSociety(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Building robots and competing in challenges"
                  style={inputStyle}
                />
              </div>

              {societyError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, marginBottom: 14,
                  background: `${O.error}14`, border: `1px solid ${O.error}33`,
                  color: O.error, fontSize: 12, fontFamily: theme.fonts.mono,
                }}>
                  {societyError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowSocietyModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 6,
                    border: `1px solid ${O.rule}`, background: 'transparent',
                    color: O.muted, fontSize: 12, fontWeight: 700,
                    fontFamily: theme.fonts.mono, cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={creatingSociety}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 6,
                    border: 'none', background: creatingSociety ? O.dim : O.orange,
                    color: O.black, fontSize: 12, fontWeight: 700,
                    fontFamily: theme.fonts.mono, cursor: creatingSociety ? 'default' : 'pointer',
                  }}
                >
                  {creatingSociety ? 'CREATING...' : 'CREATE SOCIETY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
