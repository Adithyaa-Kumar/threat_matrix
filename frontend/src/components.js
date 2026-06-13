import React from 'react';

// ── Class metadata ────────────────────────────────────────────────────────────
export const CLASS_META = {
  browsing:   { color: '#82aaff', label: 'BROWSING',    short: 'B' },
  streaming:  { color: '#00f5a0', label: 'STREAMING',   short: 'S' },
  video_call: { color: '#c792ea', label: 'VIDEO_CALL',  short: 'V' },
  gaming:     { color: '#fdbb2c', label: 'GAMING',      short: 'G' },
  unknown:    { color: '#ff5370', label: 'UNKNOWN',     short: '?' },
};

export function classColor(label) {
  return CLASS_META[label]?.color || '#5a7a6a';
}

// ── Corner bracket decoration ─────────────────────────────────────────────────
function Brackets({ color = 'var(--teal)', size = 8 }) {
  const s = { position: 'absolute', width: size, height: size, borderColor: color };
  return (
    <>
      <div style={{ ...s, top: 0, left: 0, borderTop: `1px solid`, borderLeft: `1px solid` }} />
      <div style={{ ...s, top: 0, right: 0, borderTop: `1px solid`, borderRight: `1px solid` }} />
      <div style={{ ...s, bottom: 0, left: 0, borderBottom: `1px solid`, borderLeft: `1px solid` }} />
      <div style={{ ...s, bottom: 0, right: 0, borderBottom: `1px solid`, borderRight: `1px solid` }} />
    </>
  );
}

// ── HUD card wrapper ──────────────────────────────────────────────────────────
export function HudCard({ children, title, accent, style, className = '' }) {
  const color = accent || 'var(--teal)';
  return (
    <div className={className} style={{
      background:   'var(--bg-card)',
      border:       '1px solid var(--border)',
      borderRadius: 2,
      position:     'relative',
      overflow:     'hidden',
      ...style,
    }}>
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(to right, ${color}66, transparent 70%)` }} />
      <Brackets color={color} />

      {title && (
        <div style={{
          padding:       '7px 14px 6px',
          borderBottom:  '1px solid var(--border)',
          display:       'flex',
          alignItems:    'center',
          gap:            8,
        }}>
          <span style={{
            display:    'inline-block',
            width:       4,
            height:      12,
            background:  color,
            flexShrink:  0,
          }} />
          <span style={{
            fontFamily:    'var(--font-hud)',
            fontSize:      9,
            letterSpacing: '0.18em',
            color,
            opacity:       0.85,
          }}>{title}</span>
          <span style={{
            marginLeft:  'auto',
            fontFamily:  'var(--font-mono)',
            fontSize:     8,
            color:        'var(--text-secondary)',
            letterSpacing:'0.1em',
          }}>▸</span>
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Stat metric ───────────────────────────────────────────────────────────────
export function StatMetric({ label, value, unit, accent, size = 'md' }) {
  const color = accent || 'var(--teal)';
  const fs    = size === 'lg' ? 30 : size === 'sm' ? 16 : 24;
  return (
    <div>
      <div style={{
        fontFamily:    'var(--font-hud)',
        fontSize:      fs,
        fontWeight:    700,
        color,
        lineHeight:    1,
        letterSpacing: '0.01em',
        textShadow:    `0 0 20px ${color}55`,
      }}>
        {value}
        {unit && <span style={{ fontSize: fs * 0.5, marginLeft: 3, opacity: 0.6 }}>{unit}</span>}
      </div>
      <div style={{
        fontFamily:    'var(--font-mono)',
        fontSize:      9,
        color:         'var(--text-secondary)',
        marginTop:     5,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────
export function ConfBar({ value, color, width = 80 }) {
  const pct = Math.round(value * 100);
  const col = color || (value >= 0.7 ? 'var(--teal)' : value >= 0.5 ? 'var(--amber)' : 'var(--red)');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{
        width, height: 3,
        background:   'var(--border-dim)',
        borderRadius:  1,
        overflow:      'hidden',
        position:      'relative',
      }}>
        <div style={{
          width:      `${pct}%`,
          height:     '100%',
          background:  col,
          transition: 'width 0.4s ease',
          boxShadow:  `0 0 8px ${col}88`,
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize:   10,
        color:       col,
        minWidth:    30,
        tabularNums: true,
      }}>{pct}%</span>
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────
export function StatusDot({ active, color }) {
  const c = color || (active ? 'var(--teal)' : 'var(--text-dim)');
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {active && (
        <span style={{
          position: 'absolute',
          width: 14, height: 14,
          borderRadius: '50%',
          border: `1px solid ${c}`,
          animation: 'pulse-ring 1.5s ease-out infinite',
        }} />
      )}
      <span style={{
        display:      'inline-block',
        width:         7, height: 7,
        borderRadius:  '50%',
        background:    c,
        boxShadow:     active ? `0 0 8px ${c}` : 'none',
      }} />
    </span>
  );
}

// ── Traffic badge ─────────────────────────────────────────────────────────────
export function TrafficBadge({ label }) {
  const meta = CLASS_META[label] || CLASS_META.unknown;
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:            5,
      padding:       '2px 8px',
      background:    `${meta.color}14`,
      border:        `1px solid ${meta.color}33`,
      borderRadius:   1,
      fontFamily:    'var(--font-mono)',
      fontSize:       9,
      letterSpacing: '0.12em',
      color:          meta.color,
      whiteSpace:    'nowrap',
      fontWeight:     700,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: meta.color, display: 'inline-block', flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}

// ── Privacy score ring ────────────────────────────────────────────────────────
export function PrivacyRing({ score }) {
  const size  = 112;
  const r     = 44;
  const circ  = 2 * Math.PI * r;
  const fill  = (score / 100) * circ;
  const color = score < 30 ? '#00f5a0' : score < 60 ? '#fdbb2c' : '#ff5370';
  const label = score < 30 ? 'SAFE' : score < 60 ? 'MODERATE' : 'AT RISK';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={6} />
        {/* Tick marks */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x1 = size/2 + Math.cos(angle) * (r - 10);
          const y1 = size/2 + Math.sin(angle) * (r - 10);
          const x2 = size/2 + Math.cos(angle) * (r + 2);
          const y2 = size/2 + Math.sin(angle) * (r + 2);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`${color}33`} strokeWidth={1} />;
        })}
        {/* Progress arc */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="butt"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: 'all 0.8s ease' }}
        />
      </svg>
      <div style={{
        position:  'absolute', inset: 0,
        display:   'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--font-hud)',
          fontSize:   24, fontWeight: 700,
          color, lineHeight: 1,
          textShadow: `0 0 20px ${color}88`,
        }}>{score}</div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize:    8, color,
          letterSpacing: '0.15em',
          marginTop: 3,
        }}>{label}</div>
      </div>
    </div>
  );
}

// ── Scanline overlay ──────────────────────────────────────────────────────────
export function ScanlineOverlay() {
  return (
    <>
      {/* CRT scanlines */}
      <div style={{
        position:   'fixed', inset: 0,
        pointerEvents: 'none', zIndex: 1000,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.012) 2px, rgba(0,0,0,0.012) 4px)',
      }} />
      {/* Moving scan beam */}
      <div style={{
        position:    'fixed', left: 0, right: 0,
        height:       80,
        pointerEvents:'none', zIndex: 999,
        background:  'linear-gradient(to bottom, transparent 0%, rgba(0,245,160,0.03) 50%, transparent 100%)',
        animation:   'scanline 12s linear infinite',
      }} />
    </>
  );
}

// ── Top nav bar ───────────────────────────────────────────────────────────────
export function TopBar({ connected, streaming, session, onStart, onStop }) {
  return (
    <div style={{
      height:       52,
      background:   'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      display:      'flex',
      alignItems:   'center',
      padding:      '0 24px',
      gap:           16,
      position:     'sticky',
      top:           0,
      zIndex:        100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
        <div style={{
          width: 32, height: 32,
          border: '1px solid var(--teal-border)',
          borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-hud)', fontSize: 11,
          color: 'var(--teal)', fontWeight: 700,
          background: 'var(--teal-dim)',
          position: 'relative',
        }}>
          NG
          <span style={{ position: 'absolute', bottom: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: 'var(--teal)', animation: 'pulse-emerald 2s infinite' }} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-hud)', fontSize: 12, color: 'var(--teal)', letterSpacing: '0.2em', fontWeight: 700 }}>
            NETGUARD
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            INTEL_NODE_09
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* Connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 10px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 2 }}>
        <StatusDot active={connected} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
          color: streaming ? 'var(--teal)' : connected ? 'var(--teal-mid)' : 'var(--text-secondary)' }}>
          {streaming ? 'LIVE' : connected ? 'CONNECTED' : 'OFFLINE'}
        </span>
      </div>

      {/* Quick stats pill strip */}
      {session && (
        <div style={{ display: 'flex', gap: 1, marginLeft: 4 }}>
          {[
            { l: 'FLOWS',     v: session.total,                                          w: 'var(--teal)' },
            { l: 'ACC',       v: `${Math.round((session.accuracy||0) * 100)}%`,           w: 'var(--teal)' },
            { l: 'P99',       v: `${session.p99_latency||0}ms`,                          w: 'var(--blue)' },
            { l: 'ANOMALIES', v: session.anomaly_count||0, warn: session.anomaly_count>0, w: session.anomaly_count>0 ? 'var(--red)' : 'var(--teal)' },
          ].map(({ l, v, w }) => (
            <div key={l} style={{
              padding: '4px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 1,
              display: 'flex', flexDirection: 'column', gap: 1,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>{l}</span>
              <span style={{ fontFamily: 'var(--font-hud)', fontSize: 12, color: w, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* System latency */}
      {session && (
        <div style={{ textAlign: 'right', marginRight: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>SYS_LATENCY</div>
          <div style={{ fontFamily: 'var(--font-hud)', fontSize: 14, color: 'var(--teal)', fontWeight: 700 }}>
            {session.avg_latency||0}<span style={{ fontSize: 8, opacity: 0.6, marginLeft: 2 }}>ms</span>
          </div>
        </div>
      )}

      {/* CTA button */}
      <button
        onClick={streaming ? onStop : onStart}
        style={{
          padding:       '8px 20px',
          background:    streaming ? 'var(--red-dim)' : 'var(--teal-dim)',
          border:        `1px solid ${streaming ? 'rgba(255,83,112,0.35)' : 'rgba(0,245,160,0.35)'}`,
          borderRadius:   2,
          color:          streaming ? 'var(--red)' : 'var(--teal)',
          fontFamily:    'var(--font-hud)',
          fontSize:       10,
          letterSpacing: '0.18em',
          cursor:        'pointer',
          transition:    'all 0.2s',
          display:       'flex', alignItems: 'center', gap: 6,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = streaming ? 'rgba(255,83,112,0.2)' : 'rgba(0,245,160,0.2)';
          e.currentTarget.style.boxShadow  = streaming ? '0 0 16px rgba(255,83,112,0.3)' : '0 0 16px rgba(0,245,160,0.3)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = streaming ? 'var(--red-dim)' : 'var(--teal-dim)';
          e.currentTarget.style.boxShadow  = 'none';
        }}
      >
        <span style={{ fontSize: 8 }}>{streaming ? '■' : '▶'}</span>
        {streaming ? 'STOP_STREAM' : 'ANALYSE_STREAM'}
      </button>
    </div>
  );
}