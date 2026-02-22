import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { theme } from '../../styles/theme'
import { useAuth } from '../../lib/useAuth'
import { useWindowSize } from '../../lib/useWindowSize'

const O = theme.colors

export default function DashboardLayout() {
  const navigate = useNavigate()
  const { user, isSuperuser, isClassAdmin } = useAuth()
  const { isMobile } = useWindowSize()

  // Auth guard
  const token = localStorage.getItem('unitap_token')
  if (!token) {
    return <Navigate to="/auth?redirect=/dashboard" replace />
  }

  // Build nav items based on role
  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: '◉', end: true },
    ...(isClassAdmin() ? [{ to: '/dashboard/attendance', label: 'Attendance', icon: '◎' }] : []),
    { to: '/dashboard/equipment', label: 'Equipment', icon: '⚙' },
    { to: '/dashboard/societies', label: 'Societies', icon: '☆' },
    { to: '/dashboard/leaderboard', label: 'Leaderboard', icon: '△' },
    { to: '/dashboard/profile', label: 'Profile', icon: '○' },
  ]

  const roleBadgeColor = () => {
    if (isSuperuser()) return O.orange
    if (user?.role === 'class_admin') return O.blue
    if (user?.role === 'society_admin') return O.warning
    if (user?.role === 'professor') return O.success
    return O.dim
  }

  const roleLabel = () => {
    if (isSuperuser()) return 'SUPERUSER'
    if (user?.role === 'class_admin') return 'CLASS ADMIN'
    if (user?.role === 'society_admin') return 'SOCIETY ADMIN'
    if (user?.role === 'professor') return 'PROFESSOR'
    return 'STUDENT'
  }

  // ─── Mobile Layout ───────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: O.black, fontFamily: theme.fonts.sans }}>
        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', height: 52, background: O.ink,
          borderBottom: `1px solid ${O.rule}`, position: 'sticky', top: 0, zIndex: 100,
          flexShrink: 0,
        }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <div style={{
              width: 24, height: 24, borderRadius: 5, background: O.orange,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 12px ${O.orangeDim}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: O.black, fontFamily: theme.fonts.mono }}>U</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', fontFamily: theme.fonts.mono, color: O.white }}>UNITAP</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user && (
              <NavLink to="/dashboard/profile" style={{ textDecoration: 'none' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `${roleBadgeColor()}26`,
                  border: `1px solid ${roleBadgeColor()}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: roleBadgeColor(), fontFamily: theme.fonts.mono }}>
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </NavLink>
            )}
          </div>
        </header>

        {/* Main content — padded above bottom nav */}
        <main style={{ flex: 1, padding: '20px 16px 80px' }}>
          <Outlet />
        </main>

        {/* Bottom tab bar */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: O.ink, borderTop: `1px solid ${O.rule}`,
          display: 'flex', alignItems: 'stretch',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              style={({ isActive }) => ({
                flex: 1, display: 'flex', flexDirection: 'column' as const,
                alignItems: 'center', justifyContent: 'center',
                padding: '8px 2px', gap: 3, textDecoration: 'none',
                color: isActive ? O.orange : O.dim,
                borderTop: isActive ? `2px solid ${O.orange}` : '2px solid transparent',
                background: isActive ? `${O.orange}0D` : 'transparent',
                transition: 'all 0.15s',
                minHeight: 52,
              })}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ fontSize: 8, fontFamily: theme.fonts.mono, fontWeight: 600, letterSpacing: '0.04em' }}>
                {item.label.toUpperCase()}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>
    )
  }

  // ─── Desktop Layout ──────────────────────────────────
  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px', borderRadius: 6, border: 'none',
    background: isActive ? O.orangeDim : 'transparent',
    color: isActive ? O.orange : O.muted,
    fontSize: 13, fontWeight: isActive ? 600 : 500,
    textDecoration: 'none', transition: 'all 0.15s',
    fontFamily: theme.fonts.sans, letterSpacing: '-0.01em',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: O.black, fontFamily: theme.fonts.sans }}>
      {/* ─── Sidebar ─── */}
      <aside style={{
        width: 220, background: O.ink, borderRight: `1px solid ${O.rule}`,
        padding: '20px 0', display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', flexShrink: 0,
      }}>
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', marginBottom: 40, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <div style={{
            width: 26, height: 26, borderRadius: 5, background: O.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 16px ${O.orangeDim}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: O.black, fontFamily: theme.fonts.mono }}>U</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', fontFamily: theme.fonts.mono, color: O.white }}>UNITAP</span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px', flex: 1 }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              style={({ isActive }) => linkStyle(isActive)}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Identity */}
        {user && (
          <div style={{
            padding: '12px 14px', margin: '0 10px 12px',
            borderRadius: 6, background: O.black,
            border: `1px solid ${O.rule}`,
          }}>
            <NavLink to="/dashboard/profile" style={{ textDecoration: 'none' }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: O.white,
                fontFamily: theme.fonts.sans, marginBottom: 4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.name}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, fontFamily: theme.fonts.mono,
                letterSpacing: '0.1em', color: roleBadgeColor(),
                padding: '2px 6px', borderRadius: 3,
                background: `${roleBadgeColor()}26`,
              }}>
                {roleLabel()}
              </span>
            </NavLink>
          </div>
        )}

        {/* Bottom */}
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <NavLink
            to="/link-card"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 6,
              border: `1px dashed ${O.rule}`, color: O.dim,
              fontSize: 12, fontFamily: theme.fonts.mono,
              letterSpacing: '0.04em', textDecoration: 'none',
            }}
          >
            + LINK NFC CARD
          </NavLink>

          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px', borderRadius: 6, border: `1px solid ${O.rule}`,
              background: 'transparent', color: O.dim, fontSize: 12,
              fontFamily: theme.fonts.mono, letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            ← BACK TO SITE
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1000, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
