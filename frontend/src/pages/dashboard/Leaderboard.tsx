import { useState, useEffect } from 'react'
import { theme } from '../../styles/theme'
import { gamification as gamificationApi, subscribeTapFeed } from '../../lib/api'
import { useAuth } from '../../lib/useAuth'
import { useWindowSize } from '../../lib/useWindowSize'
import type { LeaderboardEntry, LeaderboardResponse } from '../../types'

const O = theme.colors

// ─── Badge definitions ───────────────────────────────
const BADGE_META: Record<string, { label: string; color: string }> = {
  early_bird:   { label: 'Early Bird',   color: O.warning },
  streak_3:     { label: '3-Day Streak', color: O.success },
  streak_7:     { label: 'Week Warrior', color: O.orange },
  streak_30:    { label: 'Month Master', color: O.error },
  century:      { label: '100+ XP',      color: O.blue },
  society_star: { label: 'Society Star', color: O.success },
  top_10:       { label: 'Top 10',       color: O.warning },
}

// ─── Level system ────────────────────────────────────
const LEVELS = [
  { min: 0,    label: 'FRESHMAN',    color: O.dim },
  { min: 50,   label: 'SOPHOMORE',   color: O.muted },
  { min: 150,  label: 'JUNIOR',      color: O.body },
  { min: 300,  label: 'SENIOR',      color: O.blue },
  { min: 500,  label: "DEAN'S LIST", color: O.success },
  { min: 1000, label: 'LEGEND',      color: O.orange },
]
function getLevel(pts: number) {
  return LEVELS.filter(l => pts >= l.min).pop()!
}

// ─── Helpers ─────────────────────────────────────────
function BadgePill({ badge }: { badge: string }) {
  const meta = BADGE_META[badge]
  if (!meta) return null
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, fontFamily: theme.fonts.mono,
      letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 3,
      color: meta.color, background: `${meta.color}20`,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

function StreakBar({ streak, max }: { streak: number; max: number }) {
  const pct = max > 0 ? Math.min((streak / Math.max(max, 30)) * 100, 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: O.rule, minWidth: 40 }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 2,
          background: streak >= 7 ? O.orange : streak >= 3 ? O.success : O.muted,
        }} />
      </div>
      <span style={{
        fontSize: 11, fontFamily: theme.fonts.mono, color: O.muted,
        minWidth: 40, textAlign: 'right',
      }}>
        {streak}d
      </span>
    </div>
  )
}

// ─── Podium card ─────────────────────────────────────
function PodiumCard({
  entry, position, isMe,
}: {
  entry: LeaderboardEntry
  position: 1 | 2 | 3
  isMe: boolean
}) {
  const level = getLevel(entry.points)
  const rankColors: Record<number, string> = { 1: O.orange, 2: '#9ca3af', 3: '#b08040' }
  const rankColor = rankColors[position]
  const isFirst = position === 1

  return (
    <div style={{
      background: O.ink,
      border: `1px solid ${isMe ? O.orange : isFirst ? `${O.orange}44` : O.rule}`,
      borderRadius: 8,
      padding: isFirst ? '28px 24px' : '20px 18px',
      flex: 1,
      marginTop: isFirst ? 0 : 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      position: 'relative',
      boxShadow: isFirst ? `0 0 32px ${O.orange}18` : 'none',
      transition: 'all 0.2s',
    }}>
      {/* Rank badge */}
      <div style={{
        width: isFirst ? 40 : 32, height: isFirst ? 40 : 32,
        borderRadius: '50%',
        background: isFirst ? O.orange : `${rankColor}22`,
        border: `2px solid ${rankColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: isFirst ? 16 : 13, fontWeight: 900,
          fontFamily: theme.fonts.mono,
          color: isFirst ? O.black : rankColor,
        }}>
          #{position}
        </span>
      </div>

      {/* Name */}
      <div style={{
        fontSize: isFirst ? 15 : 13, fontWeight: 700, color: O.white,
        textAlign: 'center', lineHeight: 1.2,
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {entry.name.split(' ')[0]} {entry.name.split(' ')[1]?.[0]}.
      </div>

      {/* Level */}
      <span style={{
        fontSize: 8, fontWeight: 700, fontFamily: theme.fonts.mono,
        letterSpacing: '0.12em', color: level.color,
        padding: '2px 6px', borderRadius: 3, background: `${level.color}18`,
      }}>
        {level.label}
      </span>

      {/* Points */}
      <div style={{
        fontSize: isFirst ? 28 : 22, fontWeight: 900,
        fontFamily: theme.fonts.mono,
        color: isFirst ? O.orange : O.white,
        letterSpacing: '-0.03em',
      }}>
        {entry.points.toLocaleString()}
        <span style={{ fontSize: isFirst ? 11 : 9, color: O.dim, fontWeight: 400, marginLeft: 3 }}>XP</span>
      </div>

      {/* Streak */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: entry.current_streak >= 7 ? O.orange : entry.current_streak >= 3 ? O.success : O.dim,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, fontFamily: theme.fonts.mono, color: O.muted }}>
          {entry.current_streak}d streak
        </span>
        {entry.first_arrivals > 0 && (
          <span style={{
            fontSize: 9, fontFamily: theme.fonts.mono, color: O.warning,
            marginLeft: 4, padding: '1px 5px', borderRadius: 2,
            background: `${O.warning}18`,
          }}>
            {entry.first_arrivals} first
          </span>
        )}
      </div>

      {/* Badges (show first 3) */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {entry.badges.slice(0, 3).map(b => <BadgePill key={b} badge={b} />)}
      </div>

      {isMe && (
        <div style={{
          position: 'absolute', top: -1, right: 10,
          fontSize: 8, fontWeight: 700, fontFamily: theme.fonts.mono,
          letterSpacing: '0.1em', color: O.black,
          padding: '2px 6px', borderRadius: '0 0 4px 4px',
          background: O.orange,
        }}>
          YOU
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────
export default function Leaderboard() {
  const { user } = useAuth()
  const { isMobile } = useWindowSize()
  const [period, setPeriod] = useState<'all' | 'week'>('all')
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await gamificationApi.leaderboard(period) as LeaderboardResponse
      setData(res)
    } catch { /* backend unavailable */ }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh on SSE tap events (points may change)
  useEffect(() => {
    const unsub = subscribeTapFeed(() => { fetchData() })
    return unsub
  }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  const board = data?.leaderboard ?? []
  const me = data?.me ?? null
  const top3 = board.slice(0, 3)
  const rest = board.slice(3)
  const maxStreak = Math.max(...board.map(e => e.current_streak), 1)

  // Reorder podium: #2, #1, #3
  const podium = top3.length >= 3
    ? [top3[1], top3[0], top3[2]] as [LeaderboardEntry, LeaderboardEntry, LeaderboardEntry]
    : null
  const podiumPositions: (1 | 2 | 3)[] = [2, 1, 3]

  return (
    <>
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: O.white }}>
            Leaderboard
          </h1>
          <p style={{ fontSize: 13, color: O.dim, marginTop: 4, fontFamily: theme.fonts.mono }}>
            Campus attendance rankings &amp; achievements
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 6, padding: 4, flexShrink: 0 }}>
          {(['all', 'week'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px', borderRadius: 4, border: 'none',
                background: period === p ? O.orange : 'transparent',
                color: period === p ? O.black : O.muted,
                fontSize: 11, fontWeight: 700, fontFamily: theme.fonts.mono,
                letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              {p === 'all' ? 'ALL TIME' : 'THIS WEEK'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: O.dim, fontSize: 13, fontFamily: theme.fonts.mono, padding: 40 }}>
          Loading...
        </div>
      )}

      {!loading && board.length === 0 && (
        <div style={{
          background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
          padding: '48px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, color: O.muted }}>No data yet</div>
          <div style={{ fontSize: 12, color: O.dim, fontFamily: theme.fonts.mono, marginTop: 6 }}>
            Tap your NFC card to earn XP and appear here
          </div>
        </div>
      )}

      {/* ─── Podium ─── */}
      {podium && (
        <div style={{
          background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8,
          padding: '24px 24px 28px', marginBottom: 12,
        }}>
          <div style={{
            fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
            letterSpacing: '0.12em', marginBottom: 16,
          }}>
            TOP 3
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            {podium.map((entry, i) => (
              <PodiumCard
                key={entry._id}
                entry={entry}
                position={podiumPositions[i]}
                isMe={user?._id === entry._id}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Rankings #4–20 ─── */}
      {rest.length > 0 && (
        <div style={{ background: O.ink, border: `1px solid ${O.rule}`, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '40px 1fr 80px' : '48px 1fr 110px 130px 1fr',
            gap: isMobile ? 8 : 12, padding: isMobile ? '10px 14px' : '10px 20px',
            borderBottom: `1px solid ${O.rule}`,
            fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em',
          }}>
            <span>RANK</span>
            <span>STUDENT</span>
            <span style={{ textAlign: 'right' }}>XP</span>
            {!isMobile && <span>STREAK</span>}
            {!isMobile && <span>BADGES</span>}
          </div>

          {rest.map((entry, i) => {
            const level = getLevel(entry.points)
            const isMe = user?._id === entry._id
            return (
              <div
                key={entry._id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '40px 1fr 80px' : '48px 1fr 110px 130px 1fr',
                  gap: isMobile ? 8 : 12,
                  padding: isMobile ? '12px 14px' : '14px 20px',
                  alignItems: 'center',
                  borderBottom: i < rest.length - 1 ? `1px solid ${O.rule}` : 'none',
                  background: isMe ? `${O.orange}08` : 'transparent',
                  borderLeft: isMe ? `2px solid ${O.orange}` : '2px solid transparent',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: theme.fonts.mono, color: O.muted, textAlign: 'center' }}>
                  #{entry.rank}
                </span>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? O.white : O.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isMobile ? entry.name.split(' ')[0] : entry.name}
                    {isMe && (
                      <span style={{ fontSize: 8, fontWeight: 700, fontFamily: theme.fonts.mono, color: O.black, background: O.orange, padding: '1px 5px', borderRadius: 2 }}>YOU</span>
                    )}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: theme.fonts.mono, color: level.color, marginTop: 2, letterSpacing: '0.08em' }}>
                    {level.label}{isMobile && entry.current_streak > 0 && <span style={{ color: O.dim }}> · {entry.current_streak}d</span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, fontFamily: theme.fonts.mono, color: isMe ? O.orange : O.white }}>
                    {entry.points.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 10, color: O.dim, fontFamily: theme.fonts.mono, marginLeft: 2 }}>XP</span>
                </div>

                {!isMobile && <StreakBar streak={entry.current_streak} max={maxStreak} />}

                {!isMobile && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {entry.badges.slice(0, 3).map(b => <BadgePill key={b} badge={b} />)}
                    {entry.badges.length > 3 && (
                      <span style={{ fontSize: 9, color: O.dim, fontFamily: theme.fonts.mono }}>+{entry.badges.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Your Standing ─── */}
      {me && (
        <div style={{
          background: O.ink, border: `1px solid ${O.orange}44`,
          borderRadius: 8, padding: '20px 24px',
          boxShadow: `0 0 24px ${O.orange}10`,
        }}>
          <div style={{
            fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
            letterSpacing: '0.12em', marginBottom: 12,
          }}>
            YOUR STANDING
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{
                fontSize: 36, fontWeight: 900, fontFamily: theme.fonts.mono,
                color: O.orange, letterSpacing: '-0.04em',
              }}>
                #{me.rank}
              </span>
              {me.total_users && (
                <span style={{ fontSize: 12, fontFamily: theme.fonts.mono, color: O.dim }}>
                  of {me.total_users}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: isMobile ? 14 : 20, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 24, fontWeight: 900, fontFamily: theme.fonts.mono,
                  color: O.white, letterSpacing: '-0.03em',
                }}>
                  {me.points.toLocaleString()}
                  <span style={{ fontSize: 10, color: O.dim, marginLeft: 2 }}>XP</span>
                </div>
                <div style={{ fontSize: 9, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em' }}>
                  TOTAL
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 24, fontWeight: 900, fontFamily: theme.fonts.mono,
                  color: me.current_streak >= 7 ? O.orange : O.white,
                  letterSpacing: '-0.03em',
                }}>
                  {me.current_streak}
                  <span style={{ fontSize: 10, color: O.dim, marginLeft: 2 }}>days</span>
                </div>
                <div style={{ fontSize: 9, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em' }}>
                  STREAK
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 24, fontWeight: 900, fontFamily: theme.fonts.mono,
                  color: me.best_streak >= 7 ? O.success : O.white,
                  letterSpacing: '-0.03em',
                }}>
                  {me.best_streak}
                  <span style={{ fontSize: 10, color: O.dim, marginLeft: 2 }}>best</span>
                </div>
                <div style={{ fontSize: 9, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em' }}>
                  BEST STREAK
                </div>
              </div>
              {me.first_arrivals > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 24, fontWeight: 900, fontFamily: theme.fonts.mono,
                    color: O.warning, letterSpacing: '-0.03em',
                  }}>
                    {me.first_arrivals}
                    <span style={{ fontSize: 10, color: O.dim, marginLeft: 2 }}>×</span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: theme.fonts.mono, color: O.dim, letterSpacing: '0.1em' }}>
                    FIRST ARRIVAL
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Level + Badges */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(() => {
              const lv = getLevel(me.points)
              return (
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: theme.fonts.mono,
                  letterSpacing: '0.1em', color: lv.color,
                  padding: '3px 8px', borderRadius: 4, background: `${lv.color}18`,
                  border: `1px solid ${lv.color}33`,
                }}>
                  {lv.label}
                </span>
              )
            })()}
            {me.badges.map(b => <BadgePill key={b} badge={b} />)}
            {me.badges.length === 0 && (
              <span style={{ fontSize: 11, color: O.dim, fontFamily: theme.fonts.mono }}>
                No badges yet — tap your card to earn XP
              </span>
            )}
          </div>

          {/* XP to next level */}
          {(() => {
            const nextLevel = LEVELS.find(l => l.min > me.points)
            if (!nextLevel) return null
            const prevLevel = LEVELS.filter(l => l.min <= me.points).pop()!
            const progress = ((me.points - prevLevel.min) / (nextLevel.min - prevLevel.min)) * 100
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
                  marginBottom: 5, letterSpacing: '0.08em',
                }}>
                  <span>PROGRESS TO {nextLevel.label}</span>
                  <span>{me.points} / {nextLevel.min} XP</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: O.rule }}>
                  <div style={{
                    width: `${progress}%`, height: '100%', borderRadius: 2,
                    background: `linear-gradient(90deg, ${O.orange}aa, ${O.orange})`,
                    transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ─── How to Earn XP ─── */}
      <div style={{
        marginTop: 12, background: O.ink, border: `1px solid ${O.rule}`,
        borderRadius: 8, padding: '16px 24px',
      }}>
        <div style={{
          fontSize: 10, fontFamily: theme.fonts.mono, color: O.dim,
          letterSpacing: '0.12em', marginBottom: 12,
        }}>
          HOW TO EARN XP
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {[
            { label: 'Attend a lecture', xp: '+10 XP' },
            { label: 'First to arrive', xp: '+25 XP' },
            { label: 'Event check-in', xp: '+15 XP' },
            { label: 'Equipment use', xp: '+5 XP' },
            { label: '3-day streak', xp: '+20 XP bonus' },
            { label: '7-day streak', xp: '+50 XP bonus' },
            { label: '30-day streak', xp: '+200 XP bonus' },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 5, background: O.black,
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: O.muted }}>{item.label}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: theme.fonts.mono,
                color: O.orange,
              }}>
                {item.xp}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
