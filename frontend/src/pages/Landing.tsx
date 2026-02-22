import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { theme } from '../styles/theme'
import { useWindowSize } from '../lib/useWindowSize'

const O = theme.colors

// ─── Circuit Trace Background ───────────────────────
function CircuitBg() {
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none' }}
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke={O.white} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <path d="M0 200 H300 V350 H500 V200 H800" fill="none" stroke={O.orange} strokeWidth="1.5" opacity="0.6">
        <animate attributeName="stroke-dashoffset" from="1600" to="0" dur="4s" fill="freeze" />
        <set attributeName="stroke-dasharray" to="1600" />
      </path>
      <path d="M400 0 V150 H650 V400 H900 V250" fill="none" stroke={O.orange} strokeWidth="1" opacity="0.4">
        <animate attributeName="stroke-dashoffset" from="1400" to="0" dur="5s" fill="freeze" begin="0.5s" />
        <set attributeName="stroke-dasharray" to="1400" />
      </path>
      {[[300, 200], [500, 350], [800, 200], [650, 150], [900, 250]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill={O.orange} opacity="0.5">
            <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
          </circle>
        </g>
      ))}
    </svg>
  )
}

// ─── Grain Overlay ──────────────────────────────────
function Grain() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    c.width = 256; c.height = 256
    const img = ctx.createImageData(256, 256)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 18
    }
    ctx.putImageData(img, 0, 0)
  }, [])
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999, opacity: 0.6, mixBlendMode: 'overlay' }} />
}

// ─── Live Ticker ────────────────────────────────────
function LiveTicker() {
  const pool = [
    { name: 'D. MAHESHWARI', ctx: 'DATABASE SYSTEMS — BUSH HOUSE' },
    { name: 'A. PATEL', ctx: '3D PRINTER #2 — QUEUE JOINED' },
    { name: 'T. CHEN', ctx: 'KCL TECH: RUST WORKSHOP — CHECK-IN' },
    { name: 'S. AHMED', ctx: 'LINEAR ALGEBRA — STRAND CAMPUS' },
    { name: 'J. O\'BRIEN', ctx: 'OSCILLOSCOPE #4 — RETURNED' },
    { name: 'P. SINGH', ctx: 'ROBOTICS: BUILD NIGHT — CHECK-IN' },
    { name: 'L. KOVACS', ctx: 'AI ETHICS LECTURE — BUSH HOUSE' },
    { name: 'M. WILLIAMS', ctx: 'LASER CUTTER — QUEUE JOINED' },
  ]

  const [taps, setTaps] = useState(pool.slice(0, 3).map((t, i) => ({ ...t, t: i === 0 ? 'NOW' : `${i * 5}S`, id: i })))

  useEffect(() => {
    const iv = setInterval(() => {
      const p = pool[Math.floor(Math.random() * pool.length)]
      setTaps(prev => [{ ...p, t: 'NOW', id: Date.now() }, ...prev.slice(0, 4)])
    }, 3500)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{ fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: '0.06em' }}>
      {taps.map((tap, i) => (
        <div
          key={tap.id}
          style={{
            display: 'grid', gridTemplateColumns: '48px 160px 1fr', gap: 16,
            padding: '10px 0', borderBottom: `1px solid ${O.rule}`,
            opacity: 1 - i * 0.18,
            color: i === 0 ? O.orange : O.muted,
            animation: i === 0 ? 'tapIn 0.4s cubic-bezier(0.16,1,0.3,1)' : 'none',
          }}
        >
          <span style={{ color: i === 0 ? O.orange : O.dim }}>{tap.t}</span>
          <span style={{ color: i === 0 ? O.white : O.muted, fontWeight: 600 }}>{tap.name}</span>
          <span style={{ color: i === 0 ? O.body : O.dim, textAlign: 'right' }}>{tap.ctx}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Device Illustration ────────────────────────────
function DeviceIllustration() {
  return (
    <div style={{ position: 'relative', width: 280, height: 360, margin: '0 auto' }}>
      <div style={{
        position: 'absolute', top: 40, left: 30, width: 220, height: 300,
        background: O.slab, borderRadius: 16, border: `1px solid ${O.ruleLight}`,
        boxShadow: `0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 ${O.ruleLight}`,
      }}>
        <div style={{
          margin: '20px 16px 0', height: 90, borderRadius: 8, background: O.black,
          border: `1px solid ${O.rule}`, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <div style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.orange, letterSpacing: '0.1em', marginBottom: 4 }}>SHARKBYTE v1.0</div>
          <div style={{ fontSize: 18, fontFamily: theme.fonts.mono, color: O.white, fontWeight: 700 }}>TAP ✓</div>
          <div style={{ fontSize: 9, fontFamily: theme.fonts.mono, color: O.dim, marginTop: 4 }}>D. MAHESHWARI — 09:01:34</div>
        </div>

        <div style={{
          margin: '24px auto 0', width: 120, height: 120, borderRadius: '50%',
          border: `2px dashed ${O.rule}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative',
        }}>
          <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: `1px solid ${O.orange}`, opacity: 0.2, animation: 'nfcRing 2s ease-out infinite' }} />
          <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: `1px solid ${O.orange}`, opacity: 0.15, animation: 'nfcRing 2s ease-out infinite 0.5s' }} />
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={O.orange} strokeWidth="1.5">
            <path d="M6 8.5a6 6 0 0 1 12 0" />
            <path d="M8 11a3 3 0 0 1 8 0" />
            <circle cx="12" cy="13" r="1" fill={O.orange} />
            <path d="M12 14v4" />
          </svg>
        </div>

        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%', background: O.orange,
          boxShadow: `0 0 12px ${O.orange}`, animation: 'ledPulse 2s infinite',
        }} />
      </div>
      <div style={{
        position: 'absolute', top: 10, right: -20, fontSize: 9,
        fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em',
        transform: 'rotate(90deg)', transformOrigin: 'left center',
      }}>
        ESP32-S3 + PN532
      </div>
    </div>
  )
}

// ─── Counter ────────────────────────────────────────
function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const animate = (now: number) => {
          const progress = Math.min((now - start) / 2000, 1)
          setVal(Math.floor((1 - Math.pow(1 - progress, 3)) * end))
          if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      }
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [end])

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}


// ═══════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════
export default function LandingPage() {
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()
  const [loaded, setLoaded] = useState(false)
  const [activeModule, setActiveModule] = useState(0)

  useEffect(() => { setTimeout(() => setLoaded(true), 100) }, [])

  const modules = [
    {
      id: 'ATTENDANCE', num: '01', title: 'Lecture Attendance',
      desc: 'Student taps at the door. Prof sees a live headcount. Department gets exportable reports. No QR codes, no sign-in sheets, no friction.',
    },
    {
      id: 'EQUIPMENT', num: '02', title: 'Equipment Queues',
      desc: 'Tap to check out. Tap to return. Current sensing auto-detects usage. Students join queues remotely and get notified when their turn arrives.',
    },
    {
      id: 'SOCIETIES', num: '03', title: 'Society Events',
      desc: 'Societies create events on the portal. Students sign up online. On-site check-in is a single tap. Student Unions get real engagement data for funding.',
    },
  ]

  return (
    <div style={{ background: O.black, color: O.text, minHeight: '100vh', fontFamily: theme.fonts.sans }}>
      <Grain />

      {/* ═══ NAV ═══ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: isMobile ? '0 16px' : '0 48px', height: isMobile ? 52 : 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `${O.black}cc`, backdropFilter: 'blur(24px)', borderBottom: `1px solid ${O.rule}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="SharkByte" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', fontFamily: theme.fonts.mono, color: O.white }}>SHARKBYTE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 36 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none', border: `1px solid ${O.orange}`, color: O.orange,
              padding: isMobile ? '7px 14px' : '8px 20px', borderRadius: 4,
              fontSize: 11, fontFamily: theme.fonts.mono, letterSpacing: '0.08em', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {isMobile ? 'DEMO →' : 'DASHBOARD →'}
          </button>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{
        position: 'relative', minHeight: '100vh', display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        padding: isMobile ? '0 20px' : '0 48px', overflow: 'hidden',
        alignItems: 'center',
      }}>
        <CircuitBg />
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          paddingRight: isMobile ? 0 : 80, paddingTop: isMobile ? 80 : 0,
          position: 'relative', zIndex: 2,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 24 : 40,
            opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(12px)',
            transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s',
          }}>
          </div>

          <h1 style={{
            fontSize: isMobile ? 'clamp(36px, 10vw, 52px)' : 'clamp(52px, 5.5vw, 80px)',
            fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.04em', margin: 0,
            opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(30px)',
            transition: 'all 1s cubic-bezier(0.16,1,0.3,1) 0.4s',
          }}>
            <span style={{ color: O.white }}>Every campus interaction. </span>
            <br />
            <span style={{ color: O.orange, textShadow: `0 0 60px ${O.orangeDim}` }}>One tap.</span>
          </h1>

          <p style={{
            fontSize: isMobile ? 15 : 17, color: O.muted, lineHeight: 1.7,
            maxWidth: 440, margin: isMobile ? '24px 0 32px' : '36px 0 48px',
            opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.7s',
          }}>
            NFC-powered infrastructure for universities. Attendance, equipment, societies — unified through a single hardware platform and the student ID cards already in every pocket.
          </p>

          <div style={{
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(16px)',
            transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.9s',
          }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: O.orange, color: O.black, border: 'none',
                padding: isMobile ? '14px 28px' : '16px 40px',
                fontSize: 13, fontFamily: theme.fonts.mono,
                fontWeight: 700, letterSpacing: '0.06em', borderRadius: 4, cursor: 'pointer',
                boxShadow: `0 0 40px ${O.orangeDim}, 0 4px 20px rgba(0,0,0,0.4)`,
              }}
            >
              GO TO DASHBOARD
            </button>
          </div>
        </div>

        {/* Device illustration — hidden on mobile to keep hero clean */}
        {!isMobile && (
          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            position: 'relative', zIndex: 2,
            opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(40px)',
            transition: 'all 1.2s cubic-bezier(0.16,1,0.3,1) 0.6s',
          }}>
            <DeviceIllustration />
            <div style={{
              width: '100%', maxWidth: 420, marginTop: 40, padding: '16px 20px',
              background: `${O.ink}ee`, border: `1px solid ${O.rule}`, borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${O.rule}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: O.orange, boxShadow: `0 0 8px ${O.orange}`, animation: 'ledPulse 2s infinite' }} />
                  <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.muted, letterSpacing: '0.12em' }}>LIVE FEED</span>
                </div>
                <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em' }}>KCL — STRAND CAMPUS</span>
              </div>
              <LiveTicker />
            </div>
          </div>
        )}

        {/* Mobile: compact live feed below hero text */}
        {isMobile && (
          <div style={{
            paddingTop: 32, paddingBottom: 40, position: 'relative', zIndex: 2,
            opacity: loaded ? 1 : 0, transition: 'opacity 0.8s 1s',
          }}>
            <div style={{ padding: '14px 16px', background: `${O.ink}ee`, border: `1px solid ${O.rule}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${O.rule}` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: O.orange, animation: 'ledPulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.muted, letterSpacing: '0.12em' }}>LIVE FEED</span>
              </div>
              <LiveTicker />
            </div>
          </div>
        )}

      </section>
      {/* ═══ MODULES ═══ */}
      <section style={{ padding: isMobile ? '60px 20px' : '120px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: isMobile ? 40 : 80 }}>
          <div style={{ width: 32, height: 1, background: O.orange, marginTop: 8, flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.orange, letterSpacing: '0.15em' }}>SYSTEM MODULES</span>
            <h2 style={{ fontSize: isMobile ? 28 : 'clamp(32px, 3.5vw, 48px)', fontWeight: 800, letterSpacing: '-0.035em', margin: '10px 0 0', lineHeight: 1.1, color: O.white }}>
              Same hardware.<br /><span style={{ color: O.muted }}>Infinite contexts.</span>
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, marginBottom: isMobile ? 32 : 60, borderBottom: `1px solid ${O.rule}` }}>
          {modules.map((mod, i) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(i)}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                padding: isMobile ? '14px 8px' : '24px 32px', textAlign: 'left',
                borderBottom: activeModule === i ? `2px solid ${O.orange}` : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? 6 : 16 }}>
                {!isMobile && <span style={{ fontSize: 11, fontFamily: theme.fonts.mono, color: activeModule === i ? O.orange : O.dim, letterSpacing: '0.1em' }}>{mod.num}</span>}
                <span style={{ fontSize: isMobile ? 13 : 22, fontWeight: 700, color: activeModule === i ? O.white : O.dim, letterSpacing: '-0.02em', fontFamily: isMobile ? theme.fonts.mono : undefined }}>{mod.id}</span>
              </div>
            </button>
          ))}
        </div>

        <div key={activeModule} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 32 : 80, animation: 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
          <div>
            <h3 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 16px', color: O.white }}>{modules[activeModule].title}</h3>
            <p style={{ fontSize: isMobile ? 14 : 16, color: O.body, lineHeight: 1.75 }}>{modules[activeModule].desc}</p>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section style={{ borderTop: `1px solid ${O.rule}`, borderBottom: `1px solid ${O.rule}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
          {[
            { step: '01', label: 'TAP', desc: 'Student holds existing NFC-enabled ID card to SharkByte device. Sub-second read.', icon: '◎' },
            { step: '02', label: 'ROUTE', desc: 'ESP32 identifies student, checks device mode, sends context to SharkByte API over WiFi.', icon: '⇉' },
            { step: '03', label: 'ACT', desc: 'Attendance marked. Queue joined. Event registered. Action depends on context.', icon: '⚡' },
            { step: '04', label: 'DISPLAY', desc: 'Real-time data flows to admin dashboard. Profs, lab managers, and societies see everything live.', icon: '◉' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: isMobile ? '32px 20px' : '60px 36px',
              borderRight: isMobile ? (i % 2 === 0 ? `1px solid ${O.rule}` : 'none') : (i < 3 ? `1px solid ${O.rule}` : 'none'),
              borderBottom: isMobile && i < 2 ? `1px solid ${O.rule}` : 'none',
              position: 'relative', overflow: 'hidden',
            }}>
              {!isMobile && <div style={{ position: 'absolute', top: 20, right: 24, fontSize: 72, fontWeight: 900, color: O.rule, fontFamily: theme.fonts.mono, lineHeight: 1, userSelect: 'none' }}>{s.step}</div>}
              <div style={{ fontSize: isMobile ? 24 : 32, marginBottom: 14, color: O.orange }}>{s.icon}</div>
              <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, letterSpacing: '0.08em', fontFamily: theme.fonts.mono, color: O.white, marginBottom: 10 }}>{s.label}</div>
              <p style={{ fontSize: isMobile ? 12 : 14, color: O.muted, lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ padding: isMobile ? '64px 24px' : '120px 48px', textAlign: 'center', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: isMobile ? 280 : 500, height: isMobile ? 280 : 500, borderRadius: '50%',
          background: `radial-gradient(ellipse, ${O.orangeGlow} 0%, transparent 70%)`,
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <h2 style={{ fontSize: isMobile ? 28 : 'clamp(36px, 4vw, 56px)', fontWeight: 800, letterSpacing: '-0.04em', margin: '0 0 20px', color: O.white, position: 'relative' }}>
          <span style={{ color: O.orange }}>Scale to any campus.</span>
        </h2>
        <p style={{ fontSize: isMobile ? 14 : 16, color: O.muted, maxWidth: 460, margin: '0 auto 32px', lineHeight: 1.7 }}>
          Open source hardware. Simple SaaS platform. Zero friction for students. Real data for institutions.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: O.orange, color: O.black, border: 'none',
            padding: isMobile ? '14px 36px' : '18px 56px', fontSize: 13, fontFamily: theme.fonts.mono,
            fontWeight: 700, letterSpacing: '0.06em', borderRadius: 4, cursor: 'pointer',
            boxShadow: `0 0 60px ${O.orangeDim}`, position: 'relative',
          }}
        >
          GO TO DASHBOARD →
        </button>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ borderTop: `1px solid ${O.rule}`, padding: isMobile ? '24px 20px' : '32px 48px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.08em' }}>SHARKBYTE — HACKLONDON 2025</span>
        <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.08em' }}>ESP32 · REACT · MONGODB · NFC</span>
      </footer>
    </div>
  )
}
