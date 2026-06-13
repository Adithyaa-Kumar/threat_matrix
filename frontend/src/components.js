import React from 'react';

// ── Threat class metadata ────────────────────────────────────────────────────

export const CLASS_META = {
  benign:     { color: '#10b981', label: 'Benign',      icon: '✅', severity: 0, category: 'NORMAL'   },
  ddos:       { color: '#ef4444', label: 'DDoS',        icon: '💥', severity: 4, category: 'CRITICAL'  },
  dos:        { color: '#f97316', label: 'DoS',         icon: '⚡', severity: 3, category: 'HIGH'      },
  portscan:   { color: '#f59e0b', label: 'Port Scan',   icon: '🔍', severity: 2, category: 'MEDIUM'    },
  botnet:     { color: '#a78bfa', label: 'Botnet',      icon: '🤖', severity: 4, category: 'CRITICAL'  },
  bruteforce: { color: '#3b82f6', label: 'Brute Force', icon: '🔓', severity: 3, category: 'HIGH'      },
  unknown:    { color: '#64748b', label: 'Unknown',     icon: '⚠',  severity: 2, category: 'SUSPECT'   },
};

export const SEVERITY_META = {
  SAFE:     { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)'  },
  LOW:      { color: '#84cc16', bg: 'rgba(132,204,22,0.1)',  border: 'rgba(132,204,22,0.3)'  },
  MEDIUM:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)'  },
  HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)'  },
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
  UNKNOWN:  { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
};

export function classColor(label) {
  return CLASS_META[label]?.color || '#64748b';
}

export function severityColor(score) {
  if (score < 20)  return '#10b981';
  if (score < 40)  return '#84cc16';
  if (score < 60)  return '#f59e0b';
  if (score < 80)  return '#f97316';
  return '#ef4444';
}

// ── HUD card wrapper ────────────────────────────────────────────────────────

export function HudCard({ children, title, accent, style, className = '' }) {
  const accentColor = accent || 'var(--teal)';
  return (
    <div className={`hud-card ${className}`} style={{
      background:   'var(--bg-card)',
      border:       `1px solid var(--border)`,
      borderTop:    `1px solid ${accentColor}44`,
      borderRadius: '4px',
      position:     'relative',
      overflow:     'hidden',
      ...style,
    }}>
      <div style={{ position:'absolute',top:0,left:0,width:8,height:8,borderTop:`1px solid ${accentColor}`,borderLeft:`1px solid ${accentColor}` }} />
      <div style={{ position:'absolute',top:0,right:0,width:8,height:8,borderTop:`1px solid ${accentColor}`,borderRight:`1px solid ${accentColor}` }} />
      <div style={{ position:'absolute',bottom:0,left:0,width:8,height:8,borderBottom:`1px solid ${accentColor}`,borderLeft:`1px solid ${accentColor}` }} />
      <div style={{ position:'absolute',bottom:0,right:0,width:8,height:8,borderBottom:`1px solid ${accentColor}`,borderRight:`1px solid ${accentColor}` }} />

      {title && (
        <div style={{
          padding:'8px 14px 6px', borderBottom:'1px solid var(--border)',
          fontFamily:'var(--font-hud)', fontSize:9, letterSpacing:'0.15em',
          color:accentColor, opacity:0.85,
          display:'flex', alignItems:'center', gap:6,
        }}>
          <span style={{ display:'inline-block',width:5,height:5,borderRadius:'50%',background:accentColor,animation:'pulse-teal 2s infinite' }} />
          {title}
        </div>
      )}

      <div style={{ padding:'12px 14px' }}>{children}</div>
    </div>
  );
}

// ── Stat metric ─────────────────────────────────────────────────────────────

export function StatMetric({ label, value, unit, accent, size = 'md' }) {
  const color = accent || 'var(--teal)';
  const fs    = size === 'lg' ? 28 : size === 'sm' ? 16 : 22;
  return (
    <div>
      <div style={{ fontFamily:'var(--font-hud)',fontSize:fs,fontWeight:700,color,lineHeight:1,letterSpacing:'0.02em' }}>
        {value}
        {unit && <span style={{ fontSize:fs*0.55,marginLeft:3,opacity:0.7 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-secondary)',marginTop:4,letterSpacing:'0.1em',textTransform:'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

// ── Confidence bar ───────────────────────────────────────────────────────────

export function ConfBar({ value, color, width = 80 }) {
  const pct = Math.round(value * 100);
  const col = color || (value >= 0.7 ? '#10b981' : value >= 0.5 ? '#f59e0b' : '#ef4444');
  return (
    <div style={{ display:'flex',alignItems:'center',gap:6 }}>
      <div style={{ width,height:4,background:'rgba(255,255,255,0.05)',borderRadius:2,overflow:'hidden' }}>
        <div style={{ width:`${pct}%`,height:'100%',background:col,borderRadius:2,transition:'width 0.3s ease',boxShadow:`0 0 6px ${col}66` }} />
      </div>
      <span style={{ fontFamily:'var(--font-mono)',fontSize:11,color:col,minWidth:32 }}>{pct}%</span>
    </div>
  );
}

// ── Status dot ───────────────────────────────────────────────────────────────

export function StatusDot({ active, color }) {
  const c = color || (active ? 'var(--teal)' : 'var(--text-dim)');
  return (
    <span style={{ display:'inline-block',width:7,height:7,borderRadius:'50%',background:c,boxShadow:active?`0 0 6px ${c}`:'none',animation:active?'pulse-teal 2s infinite':'none',flexShrink:0 }} />
  );
}

// ── Threat badge ─────────────────────────────────────────────────────────────

export function ThreatBadge({ label }) {
  const meta = CLASS_META[label] || CLASS_META.unknown;
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',gap:4,
      padding:'2px 8px',
      background:`${meta.color}18`,border:`1px solid ${meta.color}44`,
      borderRadius:'2px',fontFamily:'var(--font-mono)',fontSize:11,color:meta.color,whiteSpace:'nowrap',
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ── Severity badge ────────────────────────────────────────────────────────────

export function SeverityBadge({ category }) {
  const meta = SEVERITY_META[category] || SEVERITY_META.UNKNOWN;
  return (
    <span style={{
      display:'inline-block',padding:'2px 8px',
      background:meta.bg,border:`1px solid ${meta.border}`,
      borderRadius:'2px',fontFamily:'var(--font-hud)',fontSize:8,
      color:meta.color,letterSpacing:'0.12em',
    }}>
      {category}
    </span>
  );
}

// ── Threat level ring ─────────────────────────────────────────────────────────

export function ThreatRing({ score, level }) {
  const size  = 110;
  const r     = 44;
  const circ  = 2 * Math.PI * r;
  const fill  = (score / 100) * circ;
  const color = severityColor(score);
  const lbl   = level || (score < 20 ? 'SAFE' : score < 40 ? 'LOW' : score < 60 ? 'MEDIUM' : score < 80 ? 'HIGH' : 'CRITICAL');

  return (
    <div style={{ position:'relative',width:size,height:size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ filter:`drop-shadow(0 0 6px ${color}88)`,transition:'all 0.8s ease' }} />
      </svg>
      <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2 }}>
        <div style={{ fontFamily:'var(--font-hud)',fontSize:22,fontWeight:700,color,lineHeight:1 }}>{score}</div>
        <div style={{ fontFamily:'var(--font-mono)',fontSize:9,color,letterSpacing:'0.1em' }}>{lbl}</div>
      </div>
    </div>
  );
}

// ── Scanline overlay ─────────────────────────────────────────────────────────

export function ScanlineOverlay() {
  return (
    <div style={{
      position:'fixed',inset:0,pointerEvents:'none',zIndex:1000,
      background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.015) 2px,rgba(0,0,0,0.015) 4px)',
    }} />
  );
}

// ── Top nav bar ──────────────────────────────────────────────────────────────

export function TopBar({ connected, streaming, session, onStart, onStop }) {
  const threatColor = session ? severityColor(session.threat_score || 0) : 'var(--teal)';
  return (
    <div style={{
      height:48,background:'var(--bg-secondary)',borderBottom:'1px solid var(--border)',
      display:'flex',alignItems:'center',padding:'0 20px',gap:16,
      position:'sticky',top:0,zIndex:100,
    }}>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginRight:12 }}>
        <div style={{
          width:28,height:28,border:'1.5px solid var(--teal)',borderRadius:'4px',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontFamily:'var(--font-hud)',fontSize:11,color:'var(--teal)',fontWeight:700,
        }}>TM</div>
        <div>
          <div style={{ fontFamily:'var(--font-hud)',fontSize:11,color:'var(--teal)',letterSpacing:'0.12em',fontWeight:700 }}>
            THREAT MATRIX
          </div>
          <div style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-secondary)',letterSpacing:'0.08em' }}>
            AI THREAT INTELLIGENCE
          </div>
        </div>
      </div>

      <div style={{ width:1,height:28,background:'var(--border)' }} />

      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
        <StatusDot active={connected} />
        <span style={{ fontFamily:'var(--font-mono)',fontSize:11,color:connected?'var(--teal)':'var(--text-secondary)' }}>
          {streaming ? '● SCANNING' : connected ? 'CONNECTED' : 'OFFLINE'}
        </span>
      </div>

      {session && (
        <div style={{ display:'flex',gap:20,marginLeft:8 }}>
          {[
            { l:'FLOWS',    v: session.total },
            { l:'ACC',      v: `${Math.round(session.accuracy*100)}%` },
            { l:'P99',      v: `${session.p99_latency}ms` },
            { l:'THREATS',  v: session.anomaly_count, warn: session.anomaly_count > 0 },
            { l:'LEVEL',    v: session.threat_level || 'SAFE', warn: session.threat_level !== 'SAFE' },
          ].map(({ l, v, warn }) => (
            <div key={l} style={{ display:'flex',alignItems:'baseline',gap:5 }}>
              <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-secondary)',letterSpacing:'0.1em' }}>{l}</span>
              <span style={{ fontFamily:'var(--font-hud)',fontSize:12,color:warn?threatColor:'var(--teal)',fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex:1 }} />

      <button onClick={streaming ? onStop : onStart} style={{
        padding:'6px 16px',
        background:streaming?'rgba(239,68,68,0.1)':'var(--teal-dim)',
        border:`1px solid ${streaming?'rgba(239,68,68,0.4)':'rgba(0,212,170,0.4)'}`,
        borderRadius:'3px',color:streaming?'#ef4444':'var(--teal)',
        fontFamily:'var(--font-hud)',fontSize:10,letterSpacing:'0.12em',
        cursor:'pointer',transition:'all 0.2s',
      }}>
        {streaming ? '■ STOP' : '▶ SCAN'}
      </button>
    </div>
  );
}