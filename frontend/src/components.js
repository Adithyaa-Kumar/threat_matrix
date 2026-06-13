import React from 'react';

// ── Threat metadata — user-facing language ───────────────────────────────────
export const CLASS_META = {
  benign:     { color:'#00f5a0', label:'Safe traffic',   icon:'✓',  severity:0, userMsg:'Normal network activity. Nothing to worry about.',            action:null },
  ddos:       { color:'#ff5370', label:'Flood attack',   icon:'⚡', severity:4, userMsg:'Someone is trying to overwhelm your connection with junk traffic.', action:'Restart your router and contact your ISP.' },
  dos:        { color:'#fd7e47', label:'Service attack', icon:'⚡', severity:3, userMsg:'A targeted attack is trying to knock out a service you use.',   action:'Close unused apps and check if your firewall is active.' },
  portscan:   { color:'#fdbb2c', label:'Probe detected', icon:'👁', severity:2, userMsg:'Someone is quietly mapping your open ports — a recon step before a real attack.', action:'Enable your firewall and disable unused services.' },
  botnet:     { color:'#c792ea', label:'Bot activity',   icon:'🤖', severity:4, userMsg:'Your device may be sending data to attacker servers without your knowledge.', action:'Run a malware scan immediately and change your passwords.' },
  bruteforce: { color:'#82aaff', label:'Login attack',   icon:'🔑', severity:3, userMsg:'Repeated login attempts are trying to guess a password on your network.', action:'Enable two-factor authentication and check for weak passwords.' },
  unknown:    { color:'#5a7a6a', label:'Unknown',        icon:'?',  severity:1, userMsg:'Unusual traffic that does not match known patterns.',            action:'Keep monitoring.' },
};

export const SEVERITY_LABEL = { 0:'Safe', 1:'Low', 2:'Medium', 3:'High', 4:'Critical' };
export const SEVERITY_COLOR = {
  0:'#00f5a0', 1:'#a8e6cf', 2:'#fdbb2c', 3:'#fd7e47', 4:'#ff5370',
};

export function threatColor(score) {
  if (score < 15) return '#00f5a0';
  if (score < 35) return '#a8e6cf';
  if (score < 55) return '#fdbb2c';
  if (score < 75) return '#fd7e47';
  return '#ff5370';
}

// ── Card shell ───────────────────────────────────────────────────────────────
export function Card({ children, title, accent, style }) {
  const c = accent || 'var(--teal)';
  return (
    <div style={{
      background:'var(--bg-card)',
      border:`1px solid var(--border)`,
      borderTop:`2px solid ${c}`,
      borderRadius:6,
      overflow:'hidden',
      ...style,
    }}>
      {title && (
        <div style={{
          padding:'9px 14px 7px',
          borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:7,
          fontFamily:'var(--font-hud)', fontSize:9,
          letterSpacing:'0.14em', color:c, opacity:0.8,
        }}>
          <span style={{
            width:5, height:5, borderRadius:'50%',
            background:c, animation:'pulse-dot 2s infinite',
          }}/>
          {title}
        </div>
      )}
      <div style={{ padding:'12px 14px' }}>{children}</div>
    </div>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
export function Tile({ label, value, unit, color, sub }) {
  const c = color || 'var(--teal)';
  return (
    <div style={{ padding:'14px 16px' }}>
      <div style={{
        fontFamily:'var(--font-hud)', fontSize:28, fontWeight:700,
        color:c, lineHeight:1, letterSpacing:'0.01em',
      }}>
        {value}
        {unit && <span style={{ fontSize:13, marginLeft:4, opacity:0.65 }}>{unit}</span>}
      </div>
      <div style={{
        fontFamily:'var(--font-mono)', fontSize:9,
        color:'var(--text-secondary)', marginTop:5,
        letterSpacing:'0.12em', textTransform:'uppercase',
      }}>{label}</div>
      {sub && <div style={{ fontFamily:'var(--font-body)', fontSize:11, color:c, marginTop:3, opacity:0.7 }}>{sub}</div>}
    </div>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────
export function ConfBar({ value, color, width=72 }) {
  const pct = Math.round(value * 100);
  const c   = color || 'var(--teal)';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
      <div style={{ width, height:4, background:'rgba(255,255,255,0.05)', borderRadius:2 }}>
        <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:2, transition:'width 0.4s' }}/>
      </div>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:c, minWidth:28 }}>{pct}%</span>
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────
export function Dot({ on, color }) {
  const c = color || (on ? 'var(--teal)' : 'var(--text-dim)');
  return (
    <span style={{
      display:'inline-block', width:7, height:7, borderRadius:'50%',
      background:c, flexShrink:0,
      boxShadow: on ? `0 0 5px ${c}` : 'none',
      animation: on ? 'pulse-dot 2s infinite' : 'none',
    }}/>
  );
}

// ── Threat badge ──────────────────────────────────────────────────────────────
export function ThreatBadge({ label }) {
  const m = CLASS_META[label] || CLASS_META.unknown;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 9px',
      background:`${m.color}18`, border:`1px solid ${m.color}44`,
      borderRadius:3,
      fontFamily:'var(--font-mono)', fontSize:10, color:m.color,
      whiteSpace:'nowrap',
    }}>
      <span style={{ fontSize:11 }}>{m.icon}</span> {m.label}
    </span>
  );
}

// ── Severity pill ─────────────────────────────────────────────────────────────
export function SevPill({ severity }) {
  const label = SEVERITY_LABEL[severity] || 'Unknown';
  const color = SEVERITY_COLOR[severity] || '#5a7a6a';
  return (
    <span style={{
      padding:'2px 8px',
      background:`${color}18`, border:`1px solid ${color}44`,
      borderRadius:3, fontFamily:'var(--font-hud)',
      fontSize:8, color, letterSpacing:'0.12em',
    }}>
      {label.toUpperCase()}
    </span>
  );
}

// ── Shield ring ───────────────────────────────────────────────────────────────
export function ShieldRing({ score, size=120 }) {
  const r    = 46;
  const circ = 2 * Math.PI * r;
  const fill = ((100 - score) / 100) * circ;   // ring shows SAFETY not threat
  const safe = 100 - score;
  const color = threatColor(score);
  const label = score < 15 ? 'Protected' : score < 35 ? 'Low risk' :
                score < 55 ? 'Caution'   : score < 75 ? 'At risk'  : 'Under attack';
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      {/* pulse ring behind */}
      <div style={{
        position:'absolute', inset:-8,
        border:`1px solid ${color}`,
        borderRadius:'50%', opacity:0.15,
        animation:'shield-pulse 3s ease-in-out infinite',
      }}/>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth={8}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition:'all 1s ease', filter:`drop-shadow(0 0 4px ${color}66)` }}/>
      </svg>
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
      }}>
        <div style={{ fontFamily:'var(--font-hud)', fontSize:22, fontWeight:700, color, lineHeight:1 }}>
          {safe}<span style={{ fontSize:11 }}>%</span>
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color, letterSpacing:'0.1em', marginTop:3 }}>
          {label.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────
export function TopBar({ connected, streaming, session, onStart, onStop }) {
  const score = session?.threat_score || 0;
  const color = threatColor(score);
  return (
    <div style={{
      height:50, background:'var(--bg-secondary)',
      borderBottom:'1px solid var(--border)',
      display:'flex', alignItems:'center',
      padding:'0 20px', gap:16,
      position:'sticky', top:0, zIndex:100,
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:9, marginRight:8 }}>
        <div style={{
          width:30, height:30,
          border:'1.5px solid var(--teal)', borderRadius:5,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'var(--font-hud)', fontSize:11, color:'var(--teal)', fontWeight:700,
        }}>TM</div>
        <div>
          <div style={{ fontFamily:'var(--font-hud)', fontSize:11, color:'var(--teal)', letterSpacing:'0.12em', fontWeight:700 }}>
            THREAT MATRIX
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-secondary)', letterSpacing:'0.08em' }}>
            YOUR NETWORK SHIELD
          </div>
        </div>
      </div>

      <div style={{ width:1, height:30, background:'var(--border)' }}/>

      {/* Status */}
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <Dot on={connected}/>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color: connected ? 'var(--teal)' : 'var(--text-secondary)' }}>
          {streaming ? '● SCANNING' : connected ? 'CONNECTED' : 'OFFLINE'}
        </span>
      </div>

      {/* Live stats */}
      {session && (
        <div style={{ display:'flex', gap:22, marginLeft:8 }}>
          {[
            { l:'FLOWS',   v: session.total },
            { l:'ACC',     v: `${Math.round(session.accuracy*100)}%` },
            { l:'P99',     v: `${session.p99_latency}ms`, warn: session.p99_latency > 50 },
            { l:'THREATS', v: session.anomaly_count, warn: session.anomaly_count > 0 },
            { l:'STATUS',  v: session.threat_level || 'SAFE', warn: session.threat_level !== 'SAFE', col: color },
          ].map(({ l, v, warn, col }) => (
            <div key={l} style={{ display:'flex', alignItems:'baseline', gap:5 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)', letterSpacing:'0.1em' }}>{l}</span>
              <span style={{ fontFamily:'var(--font-hud)', fontSize:12, color: col || (warn ? color : 'var(--teal)'), fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex:1 }}/>

      <button onClick={streaming ? onStop : onStart} style={{
        padding:'7px 18px',
        background: streaming ? 'rgba(255,83,112,0.10)' : 'rgba(0,245,160,0.10)',
        border: `1px solid ${streaming ? 'rgba(255,83,112,0.35)' : 'rgba(0,245,160,0.35)'}`,
        borderRadius:4, color: streaming ? 'var(--red)' : 'var(--teal)',
        fontFamily:'var(--font-hud)', fontSize:10, letterSpacing:'0.12em',
        cursor:'pointer', transition:'all 0.2s',
      }}>
        {streaming ? '■ STOP' : '▶ SCAN'}
      </button>
    </div>
  );
}