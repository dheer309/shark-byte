import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { theme } from '../styles/theme'
import { auth } from '../lib/api'
import type { User } from '../types'

const O = theme.colors

type LinkState = 'idle' | 'scanning' | 'success' | 'error'
type LinkMode = 'self' | 'friend'
type ScanMethod = 'nfc' | 'manual'

export default function LinkCard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [state, setState] = useState<LinkState>('idle')
  const [cardUid, setCardUid] = useState('')
  const [manualUid, setManualUid] = useState('')
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [linkMode, setLinkMode] = useState<LinkMode>('self')
  const [scanMethod, setScanMethod] = useState<ScanMethod>('nfc')
  const [nfcSupported, setNfcSupported] = useState(false)

  // Friend linking fields
  const [friendEmail, setFriendEmail] = useState('')
  const [friendLinked, setFriendLinked] = useState(false)

  // Check NFC support + logged in user
  useEffect(() => {
    const stored = localStorage.getItem('sharkbyte_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
    }

    if (searchParams.get('mode') === 'friend') {
      setLinkMode('friend')
    }

    // Check if Web NFC is available (Android Chrome + HTTPS only)
    const hasNfc = 'NDEFReader' in window && window.isSecureContext
    setNfcSupported(hasNfc)
    if (!hasNfc) setScanMethod('manual')
  }, [searchParams])

  const startScan = async () => {
    setState('scanning')
    setError('')

    try {
      // @ts-expect-error NDEFReader is not in TS types yet
      const ndef = new NDEFReader()
      await ndef.scan()

      ndef.addEventListener('reading', ({ serialNumber }: { serialNumber: string }) => {
        const uid = serialNumber.replace(/:/g, '').toUpperCase()
        handleUidCaptured(uid)
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start NFC scan'
      // If NFC fails, suggest manual entry
      setError(`${msg}. Mifare Classic cards may not be readable via Web NFC — try entering the UID manually instead.`)
      setState('error')
    }
  }

  const handleUidCaptured = async (uid: string) => {
    setCardUid(uid)
    setState('success')

    // If linking own card, send to API and update stored user
    if (linkMode === 'self' && user) {
      try {
        const updated = await auth.linkCard({ user_id: user._id, card_uid: uid }) as User
        setUser(updated)
        localStorage.setItem('sharkbyte_user', JSON.stringify(updated))
      } catch { /* best effort */ }
    }
  }

  const handleManualSubmit = () => {
    const uid = manualUid.replace(/[^A-Fa-f0-9]/g, '').toUpperCase()
    if (uid.length < 4) {
      setError('UID must be at least 4 hex characters (e.g. A1B2C3D4)')
      return
    }
    handleUidCaptured(uid)
  }

  // Link a friend's card using the scanned UID + their email
  const linkFriendCard = async () => {
    if (!cardUid || !friendEmail) return
    setError('')

    try {
      const res = await fetch('/api/auth/link-card-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: friendEmail, card_uid: cardUid }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Failed to link card' }))
        throw new Error(data.message)
      }

      setFriendLinked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link card')
    }
  }

  // If not logged in and linking own card, redirect to auth
  const requireAuth = () => {
    if (!user && linkMode === 'self') {
      navigate('/auth?redirect=/link-card')
      return true
    }
    return false
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', background: O.ink,
    border: `1px solid ${O.rule}`, borderRadius: 6, color: O.white,
    fontSize: 14, fontFamily: theme.fonts.mono, outline: 'none',
    boxSizing: 'border-box', letterSpacing: '0.1em',
  }

  return (
    <div style={{
      background: O.black, color: O.text, minHeight: '100vh',
      fontFamily: theme.fonts.sans, display: 'flex', alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 420, width: '100%', padding: '0 24px', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 48 }}>
          <img src="/logo.png" alt="SharkByte" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.12em', fontFamily: theme.fonts.mono }}>SHARKBYTE</span>
        </div>

        {/* ─── Idle State ─── */}
        {state === 'idle' && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
              {linkMode === 'self' ? 'Link Your Card' : 'Link a Friend\'s Card'}
            </h1>
            <p style={{ fontSize: 15, color: O.muted, lineHeight: 1.6, marginBottom: 24 }}>
              {linkMode === 'self'
                ? 'Pair your student ID card with your SharkByte account.'
                : 'Help a friend (iPhone user) link their student ID card.'
              }
            </p>

            {/* Mode Toggle: Self / Friend */}
            <div style={{
              display: 'flex', gap: 0, marginBottom: 24,
              border: `1px solid ${O.rule}`, borderRadius: 8, overflow: 'hidden',
            }}>
              {(['self', 'friend'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setLinkMode(m)}
                  style={{
                    flex: 1, padding: '12px 0', background: linkMode === m ? O.orangeDim : O.ink,
                    border: 'none', color: linkMode === m ? O.orange : O.dim,
                    fontSize: 10, fontWeight: 700, fontFamily: theme.fonts.mono,
                    letterSpacing: '0.1em', cursor: 'pointer',
                  }}
                >
                  {m === 'self' ? 'MY CARD' : 'LINK A FRIEND'}
                </button>
              ))}
            </div>

            {/* Method Toggle: NFC / Manual */}
            <div style={{
              display: 'flex', gap: 0, marginBottom: 24,
              border: `1px solid ${O.rule}`, borderRadius: 8, overflow: 'hidden',
            }}>
              <button
                onClick={() => setScanMethod('nfc')}
                disabled={!nfcSupported}
                style={{
                  flex: 1, padding: '12px 0',
                  background: scanMethod === 'nfc' ? O.orangeDim : O.ink,
                  border: 'none',
                  color: !nfcSupported ? `${O.dim}66` : scanMethod === 'nfc' ? O.orange : O.dim,
                  fontSize: 10, fontWeight: 700, fontFamily: theme.fonts.mono,
                  letterSpacing: '0.1em', cursor: nfcSupported ? 'pointer' : 'default',
                }}
              >
                NFC SCAN {!nfcSupported && '(N/A)'}
              </button>
              <button
                onClick={() => setScanMethod('manual')}
                style={{
                  flex: 1, padding: '12px 0',
                  background: scanMethod === 'manual' ? O.orangeDim : O.ink,
                  border: 'none', color: scanMethod === 'manual' ? O.orange : O.dim,
                  fontSize: 10, fontWeight: 700, fontFamily: theme.fonts.mono,
                  letterSpacing: '0.1em', cursor: 'pointer',
                }}
              >
                ENTER UID MANUALLY
              </button>
            </div>

            {user && linkMode === 'self' && (
              <div style={{
                padding: '10px 16px', borderRadius: 6, marginBottom: 24,
                background: O.ink, border: `1px solid ${O.rule}`,
                fontSize: 12, fontFamily: theme.fonts.mono, color: O.muted,
                textAlign: 'left',
              }}>
                Logged in as <span style={{ color: O.orange }}>{user.name}</span>
                {user.card_uid && (
                  <span style={{ color: O.dim }}> · Card linked: {user.card_uid}</span>
                )}
              </div>
            )}

            {/* NFC Scan Button */}
            {scanMethod === 'nfc' && (
              <>
                <button
                  onClick={() => {
                    if (linkMode === 'self' && requireAuth()) return
                    startScan()
                  }}
                  style={{
                    width: '100%', padding: '18px', background: O.orange, color: O.black,
                    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                    fontFamily: theme.fonts.mono, letterSpacing: '0.06em',
                    boxShadow: `0 0 40px ${O.orangeDim}`, cursor: 'pointer',
                  }}
                >
                  START NFC SCAN
                </button>

                {!window.isSecureContext && (
                  <div style={{
                    marginTop: 16, padding: '10px 14px', borderRadius: 6,
                    background: 'rgba(245,158,11,0.1)', border: `1px solid ${O.warning}33`,
                    color: O.warning, fontSize: 12, fontFamily: theme.fonts.mono, textAlign: 'left',
                  }}>
                    Web NFC requires HTTPS. Access this page via https:// or use manual UID entry.
                  </div>
                )}
              </>
            )}

            {/* Manual UID Entry */}
            {scanMethod === 'manual' && (
              <div style={{ textAlign: 'left' }}>
                <label style={{
                  display: 'block', fontSize: 10, fontFamily: theme.fonts.mono,
                  color: O.dim, letterSpacing: '0.12em', marginBottom: 6,
                }}>
                  CARD UID (HEX)
                </label>
                <input
                  type="text"
                  value={manualUid}
                  onChange={e => setManualUid(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3D4"
                  maxLength={20}
                  style={inputStyle}
                />
                <p style={{ fontSize: 11, color: O.dim, marginTop: 8, marginBottom: 16, fontFamily: theme.fonts.mono }}>
                  Find this printed on your card, or use an NFC reader app like "NFC Tools"
                </p>

                {error && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 6, marginBottom: 16,
                    background: 'rgba(239,68,68,0.1)', border: `1px solid ${O.error}33`,
                    color: O.error, fontSize: 12, fontFamily: theme.fonts.mono,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={() => {
                    if (linkMode === 'self' && requireAuth()) return
                    handleManualSubmit()
                  }}
                  disabled={!manualUid}
                  style={{
                    width: '100%', padding: '18px',
                    background: manualUid ? O.orange : O.dim,
                    color: O.black, border: 'none', borderRadius: 8, fontSize: 14,
                    fontWeight: 700, fontFamily: theme.fonts.mono, letterSpacing: '0.06em',
                    cursor: manualUid ? 'pointer' : 'default',
                  }}
                >
                  LINK CARD
                </button>
              </div>
            )}

            <div style={{
              marginTop: 32, padding: '16px 20px', borderRadius: 8,
              border: `1px solid ${O.rule}`, background: O.ink, textAlign: 'left',
            }}>
              <div style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em', marginBottom: 8 }}>
                HOW TO FIND YOUR UID
              </div>
              <div style={{ fontSize: 13, color: O.muted, lineHeight: 1.8 }}>
                ▸ Check the back of your student ID card<br />
                ▸ Use "NFC Tools" app (Android/iOS) to read it<br />
                ▸ Ask your university IT helpdesk
              </div>
            </div>

            {linkMode === 'self' && (
              <p style={{ fontSize: 12, color: O.dim, marginTop: 24, lineHeight: 1.6 }}>
                iPhone? Ask a friend with Android to switch to "Link a Friend" mode, or enter the UID manually.
              </p>
            )}
          </>
        )}

        {/* ─── Scanning State ─── */}
        {state === 'scanning' && (
          <>
            <div style={{
              width: 160, height: 160, margin: '0 auto 32px',
              borderRadius: '50%', border: `2px dashed ${O.rule}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', width: '100%', height: '100%',
                borderRadius: '50%', border: `2px solid ${O.orange}`,
                opacity: 0.3, animation: 'nfcRing 2s ease-out infinite',
              }} />
              <div style={{
                position: 'absolute', width: '100%', height: '100%',
                borderRadius: '50%', border: `2px solid ${O.orange}`,
                opacity: 0.2, animation: 'nfcRing 2s ease-out infinite 0.6s',
              }} />
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={O.orange} strokeWidth="1.5">
                <path d="M6 8.5a6 6 0 0 1 12 0" />
                <path d="M8 11a3 3 0 0 1 8 0" />
                <circle cx="12" cy="13" r="1" fill={O.orange} />
                <path d="M12 14v4" />
              </svg>
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Scanning...</h2>
            <p style={{ fontSize: 15, color: O.muted }}>
              Hold {linkMode === 'friend' ? "your friend's" : 'your'} student ID card against the back of your phone.
            </p>

            <button
              onClick={() => setState('idle')}
              style={{
                marginTop: 32, padding: '12px 24px', background: 'none',
                border: `1px solid ${O.rule}`, color: O.muted, borderRadius: 6,
                fontSize: 13, fontFamily: theme.fonts.mono, cursor: 'pointer',
              }}
            >
              CANCEL
            </button>
          </>
        )}

        {/* ─── Success State ─── */}
        {state === 'success' && (
          <>
            <div style={{
              width: 80, height: 80, margin: '0 auto 24px', borderRadius: '50%',
              background: O.orangeDim, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 36 }}>✓</span>
            </div>

            {linkMode === 'self' ? (
              <>
                <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: O.orange }}>Card Linked!</h2>
                <p style={{ fontSize: 15, color: O.muted, marginBottom: 24 }}>
                  Your student ID card is now linked to your SharkByte account. Just tap any SharkByte device on campus and it'll recognise you.
                </p>

                <div style={{
                  padding: '14px 20px', borderRadius: 8, background: O.ink,
                  border: `1px solid ${O.rule}`, fontFamily: theme.fonts.mono,
                  fontSize: 14, color: O.white, letterSpacing: '0.08em',
                }}>
                  UID: {cardUid}
                </div>

                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    marginTop: 32, width: '100%', padding: '16px', background: O.orange,
                    color: O.black, border: 'none', borderRadius: 8, fontSize: 14,
                    fontWeight: 700, fontFamily: theme.fonts.mono, letterSpacing: '0.06em',
                    cursor: 'pointer',
                  }}
                >
                  GO TO DASHBOARD →
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: O.orange }}>
                  {friendLinked ? 'Friend\'s Card Linked!' : 'Card Captured!'}
                </h2>

                <div style={{
                  padding: '14px 20px', borderRadius: 8, background: O.ink,
                  border: `1px solid ${O.rule}`, fontFamily: theme.fonts.mono,
                  fontSize: 14, color: O.white, letterSpacing: '0.08em', marginBottom: 24,
                }}>
                  UID: {cardUid}
                </div>

                {!friendLinked ? (
                  <>
                    <p style={{ fontSize: 15, color: O.muted, marginBottom: 20 }}>
                      Now enter your friend's SharkByte email to link this card to their account.
                    </p>

                    <div style={{ textAlign: 'left', marginBottom: 16 }}>
                      <label style={{
                        display: 'block', fontSize: 10, fontFamily: theme.fonts.mono,
                        color: O.dim, letterSpacing: '0.12em', marginBottom: 6,
                      }}>
                        FRIEND'S EMAIL
                      </label>
                      <input
                        type="email"
                        value={friendEmail}
                        onChange={e => setFriendEmail(e.target.value)}
                        placeholder="friend@kcl.ac.uk"
                        style={{
                          width: '100%', padding: '14px 16px', background: O.ink,
                          border: `1px solid ${O.rule}`, borderRadius: 6, color: O.white,
                          fontSize: 14, fontFamily: theme.fonts.sans, outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {error && (
                      <div style={{
                        padding: '10px 14px', borderRadius: 6, marginBottom: 16,
                        background: 'rgba(239,68,68,0.1)', border: `1px solid ${O.error}33`,
                        color: O.error, fontSize: 13, fontFamily: theme.fonts.mono,
                      }}>
                        {error}
                      </div>
                    )}

                    <button
                      onClick={linkFriendCard}
                      disabled={!friendEmail}
                      style={{
                        width: '100%', padding: '16px',
                        background: friendEmail ? O.orange : O.dim,
                        color: O.black, border: 'none', borderRadius: 8, fontSize: 13,
                        fontWeight: 700, fontFamily: theme.fonts.mono, letterSpacing: '0.06em',
                        cursor: friendEmail ? 'pointer' : 'default',
                      }}
                    >
                      LINK TO FRIEND'S ACCOUNT
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 15, color: O.muted, marginBottom: 24 }}>
                      Card successfully linked to <span style={{ color: O.orange }}>{friendEmail}</span>. They can now tap any SharkByte device on campus.
                    </p>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={() => {
                          setState('idle')
                          setCardUid('')
                          setManualUid('')
                          setFriendEmail('')
                          setFriendLinked(false)
                        }}
                        style={{
                          flex: 1, padding: '14px', background: 'none',
                          border: `1px solid ${O.rule}`, color: O.text, borderRadius: 8,
                          fontSize: 13, fontFamily: theme.fonts.mono, cursor: 'pointer',
                        }}
                      >
                        LINK ANOTHER
                      </button>
                      <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                          flex: 1, padding: '14px', background: O.orange,
                          color: O.black, border: 'none', borderRadius: 8,
                          fontSize: 13, fontWeight: 700, fontFamily: theme.fonts.mono,
                          cursor: 'pointer',
                        }}
                      >
                        DONE →
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ─── Error State ─── */}
        {state === 'error' && (
          <>
            <div style={{
              width: 80, height: 80, margin: '0 auto 24px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 36, color: O.error }}>✕</span>
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: O.error }}>NFC Error</h2>
            <p style={{ fontSize: 15, color: O.muted, marginBottom: 32 }}>{error}</p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setState('idle'); setError('') }}
                style={{
                  flex: 1, padding: '14px', background: 'none', border: `1px solid ${O.rule}`,
                  color: O.text, borderRadius: 6, fontSize: 13, fontFamily: theme.fonts.mono,
                  cursor: 'pointer',
                }}
              >
                TRY AGAIN
              </button>
              <button
                onClick={() => { setState('idle'); setScanMethod('manual'); setError('') }}
                style={{
                  flex: 1, padding: '14px', background: O.orange,
                  color: O.black, border: 'none', borderRadius: 6, fontSize: 13,
                  fontWeight: 700, fontFamily: theme.fonts.mono, cursor: 'pointer',
                }}
              >
                ENTER MANUALLY
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
