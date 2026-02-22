// ─── UniTap Design Tokens ───────────────────────────
// Black + Orange industrial theme
// Every color, spacing, and font decision lives here.

export const theme = {
  colors: {
    black: '#0B0B0B',
    ink: '#111111',
    slab: '#161616',
    rule: '#222222',
    ruleLight: '#2a2a2a',
    dim: '#555555',
    muted: '#888888',
    body: '#b0b0b0',
    text: '#e8e8e8',
    white: '#f5f5f0',
    orange: '#FF5F1F',
    orangeHot: '#FF7A40',
    orangeDim: 'rgba(255,95,31,0.15)',
    orangeGlow: 'rgba(255,95,31,0.08)',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    blue: '#3B82F6',
  },
  fonts: {
    mono: "'IBM Plex Mono', monospace",
    sans: "'Instrument Sans', system-ui, sans-serif",
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '16px',
  },
} as const

export type Theme = typeof theme
