import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { theme } from '../styles/theme'
import { auth } from '../lib/api'
import type { User } from '../types'

const O = theme.colors

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [university, setUniversity] = useState('KCL')

  // OTP fields
  const [otp, setOtp] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        const result = await auth.login({ email, password }) as { token: string; user: User }
        localStorage.setItem('unitap_token', result.token)
        localStorage.setItem('unitap_user', JSON.stringify(result.user))
        navigate(redirectTo)
      } else {
        await auth.register({ email, name, university, password }) as { message: string; email: string }
        setStep('otp')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await auth.verifyOtp({ email, otp }) as { token: string; user: User }
      localStorage.setItem('unitap_token', result.token)
      localStorage.setItem('unitap_user', JSON.stringify(result.user))
      navigate(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setError('')

    try {
      await auth.resendOtp({ email })
      setResendCooldown(30)
      const interval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0 }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', background: O.ink,
    border: `1px solid ${O.rule}`, borderRadius: 6, color: O.white,
    fontSize: 14, fontFamily: theme.fonts.sans, outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, fontFamily: theme.fonts.mono,
    color: O.dim, letterSpacing: '0.12em', marginBottom: 6,
  }

  return (
    <div style={{
      background: O.black, color: O.text, minHeight: '100vh',
      fontFamily: theme.fonts.sans, display: 'flex', alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6, background: O.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: O.black, fontFamily: theme.fonts.mono }}>U</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.12em', fontFamily: theme.fonts.mono }}>UNITAP</span>
        </div>

        {step === 'otp' ? (
          /* ─── OTP Verification Screen ─── */
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2 style={{
                fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em',
                margin: '0 0 8px', color: O.white, fontFamily: theme.fonts.sans,
              }}>
                Verify your email
              </h2>
              <p style={{ fontSize: 13, color: O.muted, fontFamily: theme.fonts.mono, margin: 0 }}>
                We sent a 6-digit code to
              </p>
              <p style={{ fontSize: 13, color: O.orange, fontFamily: theme.fonts.mono, margin: '4px 0 0' }}>
                {email}
              </p>
            </div>

            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>VERIFICATION CODE</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoFocus
                  style={{
                    ...inputStyle,
                    fontSize: 28, fontWeight: 800, fontFamily: theme.fonts.mono,
                    letterSpacing: '0.3em', textAlign: 'center', padding: '18px 16px',
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
                type="submit"
                disabled={loading || otp.length !== 6}
                style={{
                  width: '100%', padding: '16px',
                  background: (loading || otp.length !== 6) ? O.dim : O.orange,
                  color: O.black, border: 'none', borderRadius: 8, fontSize: 13,
                  fontWeight: 700, fontFamily: theme.fonts.mono, letterSpacing: '0.06em',
                  cursor: (loading || otp.length !== 6) ? 'default' : 'pointer',
                }}
              >
                {loading ? 'VERIFYING...' : 'VERIFY'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                style={{
                  background: 'none', border: 'none', padding: '8px',
                  color: resendCooldown > 0 ? O.dim : O.muted,
                  fontSize: 12, fontFamily: theme.fonts.mono, cursor: resendCooldown > 0 ? 'default' : 'pointer',
                }}
              >
                {resendCooldown > 0 ? `RESEND IN ${resendCooldown}S` : 'RESEND CODE'}
              </button>
            </div>

            <button
              onClick={() => { setStep('form'); setOtp(''); setError('') }}
              style={{
                display: 'block', margin: '16px auto 0', padding: '10px',
                background: 'none', border: 'none', color: O.dim,
                fontSize: 12, fontFamily: theme.fonts.mono, cursor: 'pointer',
              }}
            >
              ← BACK
            </button>
          </>
        ) : (
          /* ─── Login / Register Form ─── */
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: `1px solid ${O.rule}` }}>
              {(['login', 'register'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setMode(tab); setError('') }}
                  style={{
                    flex: 1, padding: '12px 0', background: 'none', border: 'none',
                    borderBottom: mode === tab ? `2px solid ${O.orange}` : '2px solid transparent',
                    color: mode === tab ? O.orange : O.dim,
                    fontSize: 11, fontWeight: 700, fontFamily: theme.fonts.mono,
                    letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {mode === 'register' && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>FULL NAME</label>
                    <input
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Dheer Maheshwari" required
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>UNIVERSITY</label>
                    <input
                      type="text" value={university} onChange={e => setUniversity(e.target.value)}
                      placeholder="KCL" required
                      style={inputStyle}
                    />
                  </div>
                </>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>EMAIL</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@kcl.ac.uk" required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>PASSWORD</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={inputStyle}
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
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '16px', background: loading ? O.dim : O.orange,
                  color: O.black, border: 'none', borderRadius: 8, fontSize: 13,
                  fontWeight: 700, fontFamily: theme.fonts.mono, letterSpacing: '0.06em',
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? 'LOADING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <button
              onClick={() => navigate('/')}
              style={{
                display: 'block', margin: '24px auto 0', padding: '10px',
                background: 'none', border: 'none', color: O.dim,
                fontSize: 12, fontFamily: theme.fonts.mono, cursor: 'pointer',
              }}
            >
              ← BACK TO SITE
            </button>
          </>
        )}
      </div>
    </div>
  )
}
