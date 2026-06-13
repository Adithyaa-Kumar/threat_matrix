import React from 'react';

// ── Class metadata ──────────────────────────────────────────────────────────

export const CLASS_META = {
  browsing:   { color: '#3b82f6', label: 'Browsing',   icon: '🌐', short: 'B' },
  streaming:  { color: '#10b981', label: 'Streaming',  icon: '📺', short: 'S' },
  video_call: { color: '#a78bfa', label: 'Video Call', icon: '📹', short: 'V' },
  gaming:     { color: '#f59e0b', label: 'Gaming',     icon: '🎮', short: 'G' },
  unknown:    { color: '#ef4444', label: 'Unknown',    icon: '⚠',  short: '?' },
};

export function classColor(label) {
  return CLASS_META[label]?.color || '#64748b';
}

// ── HUD card wrapper ────────────────────────────────────────────────────────

export function HudCard({ children, title, accent, style, className = '' }) {
  const accentColor = accent || 'var(--teal)';
  return (
    <div className={`hud-card ${className}`} style={{
      background:   'var(--bg-card)',
      border:       `1px solid var(--border)`,
      borderTop:    `1px solid ${accentColor}33`,
      borderRadius: '4px',
      position:     'relative',
      overflow:     'hidden',
      ...style,
    }}>
      {/* Corner decorations */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 8, height: 8,
        borderTop:  `1px solid ${accentColor}`,
        borderLeft: `1px solid ${accentColor}`,
      }} />
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 8, height: 8,
        borderTop:   `1px solid ${accentColor}`,
        borderRight: `1px solid ${accentColor}`,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        width: 8, height: 8,
        borderBottom: `1px solid ${accentColor}`,
        borderLeft:   `1px solid ${accentColor}`,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 8, height: 8,
        borderBottom: `1px solid ${accentColor}`,
        borderRight:  `1px solid ${accentColor}`,
      }} />

      {title && (
        <div style={{
          padding:       '8px 14px 6px',
          borderBottom:  'var(--border)',
          fontFamily:    'var(--font-hud)',
          fontSize:      '9px',
          letterSpacing: '0.15em',
          color:         accentColor,
          opacity:       0.8,
          display:       'flex',
          alignItems:    'center',
          gap:           6,
        }}>
          <span style={{
            display:      'inline-block',
            width:         5,
            height:        5,
            borderRadius:  '50%',
            background:    accentColor,
            animation:     'pulse-teal 2s infinite',
          }} />
          {title}
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Stat metric ─────────────────────────────────────────────────────────────

export function StatMetric({ label, value, unit, accent, size = 'md' }) {
  const color = accent || 'var(--teal)';
  const fs    = size === 'lg' ? 28 : size === 'sm' ? 16 : 22;
  return (
    <div>
      <div style={{
        fontFamily:    'var(--font-hud)',
        fontSize:      fs,
        fontWeight:    700,
        color,
        lineHeight:    1,
        letterSpacing: '0.02em',
      }}>
        {value}
        {unit && <span style={{ fontSize: fs * 0.55, marginLeft: 3, opacity: 0.7 }}>{unit}</span>}
      </div>
      <div style={{
        fontFamily:    'var(--font-mono)',
        fontSize:      10,
        color:         'var(--text-secondary)',
        marginTop:     4,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Confidence bar ───────────────────────────────────────────────────────────

export function ConfBar({ value, color, width = 80 }) {
  const pct  = Math.round(value * 100);
  const col  = color || (value >= 0.7 ? 'var(--teal)' : value >= 0.5 ? 'var(--amber)' : 'var(--red)');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width,
        height:       4,
        background:   'rgba(255,255,255,0.05)',
        borderRadius: 2,
        overflow:     'hidden',
      }}>
        <div style={{
          width:        `${pct}%`,
          height:       '100%',
          background:   col,
          borderRadius: 2,
          transition:   'width 0.3s ease',
          boxShadow:    `0 0 6px ${col}66`,
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize:   11,
        color:      col,
        minWidth:   32,
      }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Status dot ───────────────────────────────────────────────────────────────

export function StatusDot({ active, color }) {
  const c = color || (active ? 'var(--teal)' : 'var(--text-dim)');
  return (
    <span style={{
      display:      'inline-block',
      width:         7,
      height:        7,
      borderRadius:  '50%',
      background:    c,
      boxShadow:     active ? `0 0 6px ${c}` : 'none',
      animation:     active ? 'pulse-teal 2s infinite' : 'none',
      flexShrink:    0,
    }} />
  );
}

// ── Traffic badge ────────────────────────────────────────────────────────────

export function TrafficBadge({ label }) {
  const meta  = CLASS_META[label] || CLASS_META.unknown;
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:            4,
      padding:       '2px 8px',
      background:    `${meta.color}18`,
      border:        `1px solid ${meta.color}44`,
      borderRadius:  '2px',
      fontFamily:    'var(--font-mono)',
      fontSize:      11,
      color:         meta.color,
      whiteSpace:    'nowrap',
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ── Privacy score ring ───────────────────────────────────────────────────────

export function PrivacyRing({ score }) {
  const size  = 110;
  const r     = 44;
  const circ  = 2 * Math.PI * r;
  const fill  = (score / 100) * circ;
  const color = score < 30 ? '#10b981' : score < 60 ? '#f59e0b' : '#ef4444';
  const label = score < 30 ? 'SAFE' : score < 60 ? 'MODERATE' : 'AT RISK';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: 'all 0.8s ease' }}
        />
      </svg>
      <div style={{
        position:  'absolute', inset: 0,
        display:   'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 2,
      }}>
        <div style={{
          fontFamily: 'var(--font-hud)',
          fontSize:   22,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}>{score}</div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize:    9,
          color,
          letterSpacing: '0.1em',
        }}>{label}</div>
      </div>
    </div>
  );
}

// ── Scanline overlay ─────────────────────────────────────────────────────────

export function ScanlineOverlay() {
  return (
    <div style={{
      position:   'fixed', inset: 0,
      pointerEvents: 'none',
      zIndex:     1000,
      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.015) 2px, rgba(0,0,0,0.015) 4px)',
    }} />
  );
}

// ── Top nav bar ──────────────────────────────────────────────────────────────

export function TopBar({ connected, streaming, session, onStart, onStop }) {
  return (
    <div style={{
      height:         48,
      background:     'var(--bg-secondary)',
      borderBottom:   '1px solid var(--border)',
      display:        'flex',
      alignItems:     'center',
      padding:        '0 20px',
      gap:            16,
      position:       'sticky',
      top:            0,
      zIndex:         100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
        <div style={{
          width: 28, height: 28,
          border: '1.5px solid var(--teal)',
          borderRadius: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-hud)', fontSize: 11, color: 'var(--teal)',
          fontWeight: 700,
        }}>NG</div>
        <div>
          <div style={{ fontFamily: 'var(--font-hud)', fontSize: 11, color: 'var(--teal)', letterSpacing: '0.12em', fontWeight: 700 }}>
            NETGUARD
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
            NETWORK INTELLIGENCE
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusDot active={connected} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: connected ? 'var(--teal)' : 'var(--text-secondary)' }}>
          {streaming ? 'LIVE' : connected ? 'CONNECTED' : 'OFFLINE'}
        </span>
      </div>

      {/* Quick stats */}
      {session && (
        <div style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
          {[
            { l: 'FLOWS',    v: session.total },
            { l: 'ACC',      v: `${Math.round(session.accuracy * 100)}%` },
            { l: 'P99',      v: `${session.p99_latency}ms` },
            { l: 'ANOMALIES',v: session.anomaly_count, warn: session.anomaly_count > 0 },
          ].map(({ l, v, warn }) => (
            <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>{l}</span>
              <span style={{ fontFamily: 'var(--font-hud)', fontSize: 12, color: warn ? 'var(--red)' : 'var(--teal)', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Controls */}
      <button
        onClick={streaming ? onStop : onStart}
        style={{
          padding:       '6px 16px',
          background:    streaming ? 'var(--red-dim)' : 'var(--teal-dim)',
          border:        `1px solid ${streaming ? 'var(--red)' : 'var(--teal)'}44`,
          borderRadius:  '3px',
          color:         streaming ? 'var(--red)' : 'var(--teal)',
          fontFamily:    'var(--font-hud)',
          fontSize:      10,
          letterSpacing: '0.12em',
          cursor:        'pointer',
          transition:    'all 0.2s',
        }}
      >
        {streaming ? '■ STOP' : '▶ ANALYSE'}
      </button>
    </div>
  );
}