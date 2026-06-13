import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useNetGuard } from './useNetGuard';
import {
  Card, Tile, ConfBar, ThreatBadge, SevPill,
  ShieldRing, TopBar, Dot,
  CLASS_META, SEVERITY_COLOR, threatColor,
} from './components';

// ── Recharts custom tooltip ──────────────────────────────────────────────────
function HudTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'var(--bg-card)', border:'1px solid var(--border-bright)',
      borderRadius:3, padding:'6px 10px',
      fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-primary)',
    }}>
      <div style={{ color:'var(--text-secondary)', marginBottom:3 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

// ── Landing / idle screen ────────────────────────────────────────────────────
function LandingScreen({ onStart }) {
  const bullets = [
    { icon:'👁', text:'Detect port scans, flood attacks & login probes in real time' },
    { icon:'🔒', text:'Zero payload inspection — your data stays private' },
    { icon:'💬', text:'AI explains every threat in plain English' },
    { icon:'⚡', text:'Sub-5ms detection, 98% accuracy' },
  ];
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight:'calc(100vh - 50px)',
      gap:36, textAlign:'center', padding:'40px 20px',
    }}>
      {/* Animated shield */}
      <div style={{ position:'relative', width:160, height:160 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            position:'absolute',
            inset: i * 22,
            border:`1px solid rgba(0,245,160,${0.25 - i*0.07})`,
            borderRadius:'50%',
            animation:`shield-pulse ${2.5+i*0.6}s ease-in-out infinite`,
            animationDelay:`${i*0.35}s`,
          }}/>
        ))}
        <div style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'var(--font-hud)', fontSize:13,
          color:'var(--teal)', letterSpacing:'0.12em',
        }}>
          STANDBY
        </div>
      </div>

      {/* Headline */}
      <div>
        <div style={{
          fontFamily:'var(--font-hud)', fontSize:32,
          color:'var(--teal)', letterSpacing:'0.06em',
          fontWeight:700, marginBottom:12,
        }}>
          YOUR NETWORK SHIELD
        </div>
        <div style={{
          fontFamily:'var(--font-body)', fontSize:16,
          color:'var(--text-secondary)', maxWidth:520,
          lineHeight:1.7, margin:'0 auto',
        }}>
          Your data is being harvested, probed, and weaponised — right now, without your knowledge.
          <br/>
          <span style={{ color:'var(--teal)', opacity:0.85 }}>
            Threat Matrix watches your traffic and tells you exactly what's happening — in plain English.
          </span>
        </div>
      </div>

      {/* Feature bullets */}
      <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'flex-start', maxWidth:420 }}>
        {bullets.map(b => (
          <div key={b.text} style={{ display:'flex', alignItems:'flex-start', gap:12, textAlign:'left' }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{b.icon}</span>
            <span style={{ fontFamily:'var(--font-body)', fontSize:14, color:'var(--text-secondary)', lineHeight:1.5 }}>
              {b.text}
            </span>
          </div>
        ))}
      </div>

      <button onClick={onStart} style={{
        padding:'14px 40px',
        background:'rgba(0,245,160,0.10)', border:'1px solid rgba(0,245,160,0.35)',
        borderRadius:4, color:'var(--teal)',
        fontFamily:'var(--font-hud)', fontSize:13,
        letterSpacing:'0.14em', cursor:'pointer', transition:'all 0.2s',
      }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(0,245,160,0.18)'}
        onMouseLeave={e => e.currentTarget.style.background='rgba(0,245,160,0.10)'}
      >
        ▶ START PROTECTION SCAN
      </button>
    </div>
  );
}

// ── Flow feed row ─────────────────────────────────────────────────────────────
function FlowRow({ flow, isNew }) {
  const m       = CLASS_META[flow.label] || CLASS_META.unknown;
  const isThreat = flow.label !== 'benign';
  return (
    <tr style={{
      borderBottom:'1px solid rgba(255,255,255,0.03)',
      background: isThreat ? `${m.color}07` : isNew ? 'rgba(0,245,160,0.02)' : 'transparent',
      animation:  isNew ? 'slide-in 0.25s ease-out' : 'none',
    }}>
      <td style={{ padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)' }}>{flow.id}</td>
      <td style={{ padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)' }}>{flow.time}</td>
      <td style={{ padding:'5px 8px' }}><ThreatBadge label={flow.label}/></td>
      <td style={{ padding:'5px 8px' }}><SevPill severity={m.severity}/></td>
      <td style={{ padding:'5px 8px' }}><ConfBar value={flow.confidence} color={m.color} width={56}/></td>
      <td style={{ padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)' }}>
        {flow.latency_ms?.toFixed(1)}ms
      </td>
      <td style={{ padding:'5px 8px' }}>
        {isThreat
          ? <span style={{ fontFamily:'var(--font-hud)', fontSize:8, color:m.color, letterSpacing:'0.08em' }}>⚠ {m.label}</span>
          : <span style={{ color:'var(--teal)', fontSize:13 }}>✓</span>
        }
      </td>
    </tr>
  );
}

// ── Threat event card (user-friendly) ────────────────────────────────────────
function ThreatCard({ anomaly, onExplain, explanation }) {
  const m          = CLASS_META[anomaly.label] || CLASS_META.unknown;
  const isActive   = explanation?.flow_id === anomaly.id;
  return (
    <div className="animate-threat" style={{
      background:`${m.color}06`, border:`1px solid ${m.color}30`,
      borderRadius:5, padding:'12px 14px', marginBottom:8,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
        <div style={{ flex:1 }}>
          {/* Header row */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ fontSize:15 }}>{m.icon}</span>
            <span style={{ fontFamily:'var(--font-hud)', fontSize:10, color:m.color, letterSpacing:'0.08em' }}>
              {m.label.toUpperCase()}
            </span>
            <SevPill severity={m.severity}/>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)', marginLeft:'auto' }}>
              #{anomaly.id} · {anomaly.time}
            </span>
          </div>

          {/* Plain-English message — THIS is the hackathon differentiator */}
          <div style={{
            fontFamily:'var(--font-body)', fontSize:13,
            color:'var(--text-primary)', lineHeight:1.55, marginBottom:7,
          }}>
            {m.userMsg}
          </div>

          {/* Action tip */}
          {m.action && (
            <div style={{
              fontFamily:'var(--font-body)', fontSize:12,
              color:m.color, opacity:0.8,
            }}>
              → {m.action}
            </div>
          )}

          <div style={{ marginTop:7 }}>
            <ConfBar value={anomaly.confidence} color={m.color} width={64}/>
          </div>

          {/* Claude AI explanation box */}
          {isActive && (
            <div style={{
              marginTop:10, padding:'10px 12px',
              background:'rgba(0,245,160,0.05)', border:'1px solid rgba(0,245,160,0.18)',
              borderRadius:4,
              fontFamily:'var(--font-body)', fontSize:13,
              color:'var(--text-primary)', lineHeight:1.6,
            }}>
              {explanation.loading
                ? <span style={{ color:'var(--teal)', fontFamily:'var(--font-mono)', fontSize:10 }}>● AI is analysing this threat...</span>
                : explanation.text
              }
            </div>
          )}
        </div>

        <button onClick={() => onExplain(anomaly)} style={{
          padding:'5px 11px', flexShrink:0,
          background:`${m.color}15`, border:`1px solid ${m.color}30`,
          borderRadius:3, cursor:'pointer',
          fontFamily:'var(--font-hud)', fontSize:8,
          color:m.color, letterSpacing:'0.1em',
        }}>
          {isActive && explanation?.loading ? '...' : 'EXPLAIN'}
        </button>
      </div>
    </div>
  );
}

// ── Attack breakdown bar ──────────────────────────────────────────────────────
function AttackBar({ label, count, total }) {
  const m   = CLASS_META[label];
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:m.color }}>
          {m.icon} {m.label}
        </span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)' }}>
          {count} · {pct.toFixed(1)}%
        </span>
      </div>
      <div style={{ height:5, background:'rgba(255,255,255,0.04)', borderRadius:3 }}>
        <div style={{
          width:`${Math.min(pct,100)}%`, height:'100%',
          background:m.color, borderRadius:3, transition:'width 0.8s ease',
        }}/>
      </div>
    </div>
  );
}

// ── Privacy / data exposure card ──────────────────────────────────────────────
function ExposureCard({ session }) {
  const score   = session?.threat_score || 0;
  const attacks = session?.attack_breakdown || {};
  const total   = session?.total || 1;

  // Derive what an attacker could learn from detected probes
  const exposures = [];
  if ((attacks.portscan || 0) > 0)   exposures.push({ icon:'🗺', text:'Open ports mapped — attacker knows your services' });
  if ((attacks.bruteforce || 0) > 0) exposures.push({ icon:'🔑', text:'Login credentials under brute-force attack' });
  if ((attacks.botnet || 0) > 0)     exposures.push({ icon:'📡', text:'Possible data exfiltration to external servers' });
  if ((attacks.ddos || 0) > 0)       exposures.push({ icon:'🌊', text:'Connection being flooded — service disruption risk' });
  if ((attacks.dos || 0) > 0)        exposures.push({ icon:'⚡', text:'Targeted service exhaustion attempt detected' });
  if (exposures.length === 0)         exposures.push({ icon:'✅', text:'No active data harvesting detected' });

  return (
    <div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:12 }}>
        Based on detected threats, here is what attackers may know or be attempting to access:
      </div>
      {exposures.map(e => (
        <div key={e.text} style={{
          display:'flex', gap:10, alignItems:'flex-start',
          padding:'8px 10px', marginBottom:6,
          background:'rgba(255,255,255,0.02)',
          border:'1px solid rgba(255,255,255,0.05)',
          borderRadius:4,
        }}>
          <span style={{ fontSize:15, flexShrink:0 }}>{e.icon}</span>
          <span style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-primary)', lineHeight:1.5 }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function App() {
  const ng      = useNetGuard();
  const [tab, setTab] = useState('monitor');

  // Show landing if not started yet
  if (!ng.streaming && !ng.done && ng.flows.length === 0) {
    return (
      <>
        <TopBar connected={ng.connected} streaming={ng.streaming} session={ng.session}
          onStart={ng.startStream} onStop={ng.stopStream}/>
        <LandingScreen onStart={ng.startStream}/>
      </>
    );
  }

  const session    = ng.session || {};
  const counts     = session.counts || {};
  const total      = session.total || 0;
  const breakdown  = session.attack_breakdown || {};
  const score      = session.threat_score || 0;
  const ringColor  = threatColor(score);
  const safeTraffic = total > 0 ? Math.round(((counts.benign || 0) / total) * 100) : 0;

  const pieData = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: CLASS_META[k]?.label || k, value:v, color:(CLASS_META[k]?.color || '#5a7a6a') }));

  const TABS = [
    { id:'monitor',   label:'LIVE MONITOR'   },
    { id:'threats',   label:'THREAT FEED',   badge: ng.anomalies.length },
    { id:'exposure',  label:'YOUR EXPOSURE'  },
    { id:'analysis',  label:'ATTACK ANALYSIS'},
    { id:'intel',     label:'SYSTEM INTEL'   },
  ];

  return (
    <>
      <TopBar connected={ng.connected} streaming={ng.streaming} session={session}
        onStart={ng.startStream} onStop={ng.stopStream}/>

      {/* Tab bar */}
      <div style={{
        display:'flex', borderBottom:'1px solid var(--border)',
        background:'var(--bg-secondary)', padding:'0 20px',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 18px', background:'transparent', border:'none',
            borderBottom: tab===t.id ? '2px solid var(--teal)' : '2px solid transparent',
            color: tab===t.id ? 'var(--teal)' : 'var(--text-secondary)',
            fontFamily:'var(--font-hud)', fontSize:9,
            letterSpacing:'0.12em', cursor:'pointer', transition:'all 0.2s',
          }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{
                marginLeft:6, background:'var(--red)', borderRadius:8,
                padding:'1px 5px', fontSize:8, color:'#fff',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── LIVE MONITOR ──────────────────────────────────────────────────── */}
      {tab === 'monitor' && (
        <div style={{ padding:16, display:'grid', gridTemplateColumns:'1fr 320px', gap:12, alignItems:'start', overflowY:'auto', maxHeight:'calc(100vh - 100px)' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* KPI row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
              {[
                { label:'TOTAL FLOWS',  value:total,                                       color:'var(--teal)' },
                { label:'SAFE TRAFFIC', value:`${safeTraffic}%`,                           color: safeTraffic>80?'var(--teal)':'var(--amber)', sub: safeTraffic>80?'All clear':'Review needed' },
                { label:'ACCURACY',     value:`${Math.round((session.accuracy||0)*100)}%`, color:'var(--teal)' },
                { label:'P99 LATENCY',  value:session.p99_latency||0, unit:'ms',           color:'var(--blue)' },
                { label:'THREATS FOUND',value:session.anomaly_count||0,                    color: session.anomaly_count?'var(--red)':'var(--teal)', sub: session.anomaly_count ? 'See Threat Feed' : 'None detected' },
              ].map(m => (
                <Card key={m.label} accent={m.color} style={{ padding:0 }}>
                  <Tile {...m}/>
                </Card>
              ))}
            </div>

            {/* Flow table */}
            <Card title="REAL-TIME TRAFFIC CLASSIFICATION" accent="var(--teal)">
              <div style={{ overflowY:'auto', maxHeight:330 }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border)' }}>
                      {['#','TIME','TRAFFIC TYPE','SEVERITY','CONFIDENCE','LATENCY','STATUS'].map(h => (
                        <th key={h} style={{
                          padding:'4px 8px', textAlign:'left',
                          fontFamily:'var(--font-mono)', fontSize:8,
                          color:'var(--text-secondary)', letterSpacing:'0.1em', fontWeight:400,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...ng.flows].reverse().slice(0,18).map((f, i) => (
                      <FlowRow key={f.id} flow={f} isNew={i===0}/>
                    ))}
                  </tbody>
                </table>
                {ng.flows.length === 0 && (
                  <div style={{ padding:24, textAlign:'center', color:'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:11 }}>
                    AWAITING TRAFFIC DATA...
                  </div>
                )}
              </div>
            </Card>

            {/* Telemetry chart */}
            <Card title="SESSION TELEMETRY" accent="#3b82f6">
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={ng.chartData} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                  <defs>
                    <linearGradient id="gSafe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00f5a0" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#00f5a0" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ff5370" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ff5370" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fontFamily:'JetBrains Mono', fontSize:9, fill:'#5a7a6a' }} interval="preserveStartEnd"/>
                  <YAxis tick={{ fontFamily:'JetBrains Mono', fontSize:9, fill:'#5a7a6a' }}/>
                  <Tooltip content={<HudTip/>}/>
                  <Area type="monotone" dataKey="safe"  stroke="#00f5a0" fill="url(#gSafe)" strokeWidth={1.5} dot={false} name="Accuracy %"/>
                  <Area type="monotone" dataKey="risk"  stroke="#ff5370" fill="url(#gRisk)" strokeWidth={1.5} dot={false} name="Risk Score"/>
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:16, marginTop:4 }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--teal)' }}>── Detection accuracy</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--red)' }}>── Risk score</span>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Shield / protection ring */}
            <Card title="PROTECTION STATUS" accent={ringColor}>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <ShieldRing score={score}/>
                <div>
                  <div style={{ fontFamily:'var(--font-hud)', fontSize:14, color:ringColor, marginBottom:6, letterSpacing:'0.06em' }}>
                    {session.threat_level || 'SAFE'}
                  </div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-secondary)', lineHeight:1.6, maxWidth:140 }}>
                    {score < 15 ? 'Your network looks clean. Keep it that way.'
                     : score < 35 ? 'Minor suspicious activity detected. Stay alert.'
                     : score < 55 ? 'Multiple threat signals. Check the Threat Feed.'
                     : score < 75 ? 'Active attacks in progress. Review immediately.'
                     : 'Critical: Severe attack underway. Take action now.'}
                  </div>
                </div>
              </div>
            </Card>

            {/* Traffic distribution */}
            <Card title="TRAFFIC BREAKDOWN" accent="#a78bfa">
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={26} outerRadius={46} dataKey="value" strokeWidth={0}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1 }}>
                  {pieData.map(d => (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <div style={{ width:5, height:5, borderRadius:1, background:d.color, flexShrink:0 }}/>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)', flex:1 }}>{d.name}</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:d.color }}>
                        {total > 0 ? Math.round((d.value/total)*100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Recent threats — plain English */}
            <Card title="RECENT THREATS" accent="var(--red)">
              <div style={{ maxHeight:240, overflowY:'auto' }}>
                {ng.anomalies.slice(0,4).map(a => (
                  <ThreatCard key={a.id} anomaly={a} onExplain={ng.explain} explanation={ng.explanation}/>
                ))}
                {ng.anomalies.length === 0 && (
                  <div style={{ padding:'16px 0', textAlign:'center', color:'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:11 }}>
                    NO THREATS DETECTED — NETWORK CLEAN
                  </div>
                )}
              </div>
            </Card>

            {/* Model badge */}
            <Card title="ENGINE" accent="var(--text-dim)">
              {[
                ['Model',   'FlowTransformer'],
                ['Dataset', 'CICIDS2017+2018'],
                ['Classes', '5 threat types'],
                ['Features','60-dim vector'],
                ['Device',  session.device || 'CPU'],
              ].map(([k,v]) => (
                <div key={k} style={{
                  display:'flex', justifyContent:'space-between',
                  borderBottom:'1px solid var(--border)', padding:'5px 0',
                }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* ── THREAT FEED ───────────────────────────────────────────────────── */}
      {tab === 'threats' && (
        <div style={{ padding:16, maxWidth:800, margin:'0 auto', overflowY:'auto', maxHeight:'calc(100vh - 100px)' }}>
          <Card title="ACTIVE THREAT EVENTS" accent="var(--red)">
            {ng.anomalies.length === 0
              ? <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:11 }}>
                  NO THREATS DETECTED — YOUR NETWORK IS CLEAN
                </div>
              : ng.anomalies.map(a => (
                  <ThreatCard key={a.id} anomaly={a} onExplain={ng.explain} explanation={ng.explanation}/>
                ))
            }
          </Card>
        </div>
      )}

      {/* ── YOUR EXPOSURE ─────────────────────────────────────────────────── */}
      {tab === 'exposure' && (
        <div style={{ padding:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, overflowY:'auto', maxHeight:'calc(100vh - 100px)' }}>
          <Card title="WHAT ATTACKERS MAY KNOW ABOUT YOU" accent="var(--red)">
            <ExposureCard session={session}/>
          </Card>

          <Card title="YOUR DIGITAL FOOTPRINT SCORE" accent="var(--amber)">
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'8px 0' }}>
              <ShieldRing score={score} size={140}/>
              <div style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-secondary)', textAlign:'center', lineHeight:1.6, maxWidth:260 }}>
                Your protection level is based on the ratio of safe to malicious flows detected during this session.
              </div>
              <div style={{ width:'100%' }}>
                {[
                  { label:'Safe traffic',     pct: total>0 ? Math.round((counts.benign||0)/total*100) : 100, color:'var(--teal)'  },
                  { label:'Threat traffic',   pct: total>0 ? Math.round((total-(counts.benign||0))/total*100) : 0, color:'var(--red)'   },
                  { label:'Detection rate',   pct: Math.round((session.accuracy||0)*100), color:'var(--blue)'  },
                ].map(r => (
                  <div key={r.label} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)' }}>{r.label}</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:r.color }}>{r.pct}%</span>
                    </div>
                    <div style={{ height:5, background:'rgba(255,255,255,0.04)', borderRadius:3 }}>
                      <div style={{ width:`${r.pct}%`, height:'100%', background:r.color, borderRadius:3, transition:'width 1s' }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="HOW TO PROTECT YOURSELF" accent="var(--teal)" style={{ gridColumn:'1 / -1' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
              {[
                { icon:'🔒', title:'Enable your firewall', body:'A firewall blocks unsolicited connections and hides your open ports from scanners.' },
                { icon:'🔑', title:'Use strong, unique passwords', body:'Brute-force attacks try millions of common passwords. A password manager makes this easy.' },
                { icon:'📡', title:'Keep devices updated', body:'Most botnet infections exploit old software. Updates patch the holes attackers use.' },
                { icon:'🌐', title:'Use a VPN on public Wi-Fi', body:'Public networks are hunting grounds for attackers. A VPN encrypts your traffic.' },
                { icon:'📧', title:'Watch for phishing', body:'Most attacks start with a malicious link or attachment. Verify before you click.' },
                { icon:'📊', title:'Monitor regularly', body:'Run Threat Matrix periodically — early detection is the difference between a warning and a breach.' },
              ].map(t => (
                <div key={t.title} style={{
                  padding:'12px 14px',
                  background:'rgba(255,255,255,0.02)',
                  border:'1px solid var(--border)',
                  borderRadius:5,
                }}>
                  <div style={{ fontSize:18, marginBottom:7 }}>{t.icon}</div>
                  <div style={{ fontFamily:'var(--font-hud)', fontSize:10, color:'var(--teal)', letterSpacing:'0.08em', marginBottom:5 }}>
                    {t.title.toUpperCase()}
                  </div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-secondary)', lineHeight:1.55 }}>
                    {t.body}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── ATTACK ANALYSIS ───────────────────────────────────────────────── */}
      {tab === 'analysis' && (
        <div style={{ padding:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, overflowY:'auto', maxHeight:'calc(100vh - 100px)' }}>
          <Card title="ATTACK TYPE BREAKDOWN" accent="var(--red)">
            <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
              <ShieldRing score={score}/>
              <div style={{ flex:1 }}>
                {['ddos','botnet','dos','bruteforce','portscan'].map(cls => (
                  <AttackBar key={cls} label={cls} count={breakdown[cls]||0} total={total}/>
                ))}
              </div>
            </div>
          </Card>

          <Card title="FLOW VOLUME BY CLASS" accent="#a78bfa">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={Object.entries(counts).map(([k,v]) => ({ name:CLASS_META[k]?.label||k, flows:v, color:CLASS_META[k]?.color||'#5a7a6a' }))}
                margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <XAxis dataKey="name" tick={{ fontFamily:'JetBrains Mono', fontSize:9, fill:'#5a7a6a' }}/>
                <YAxis tick={{ fontFamily:'JetBrains Mono', fontSize:9, fill:'#5a7a6a' }}/>
                <Tooltip content={<HudTip/>}/>
                <Bar dataKey="flows" radius={[2,2,0,0]}>
                  {Object.entries(counts).map(([k], i) => (
                    <Cell key={i} fill={CLASS_META[k]?.color||'#5a7a6a'} fillOpacity={0.85}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="SESSION SUMMARY" accent="var(--teal)" style={{ gridColumn:'1 / -1' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24 }}>
              {[
                { label:'Flows analysed',     value:total },
                { label:'Detection accuracy', value:`${Math.round((session.accuracy||0)*100)}%` },
                { label:'Threats detected',   value:session.anomaly_count||0 },
                { label:'Safe traffic',       value:`${safeTraffic}%` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:'var(--font-hud)', fontSize:26, color:'var(--teal)', marginBottom:4 }}>{value}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)', letterSpacing:'0.08em' }}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── SYSTEM INTEL ─────────────────────────────────────────────────── */}
      {tab === 'intel' && (
        <div style={{ padding:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, overflowY:'auto', maxHeight:'calc(100vh - 100px)' }}>
          <Card title="MODEL ARCHITECTURE" accent="#3b82f6">
            {[
              ['Architecture',    'FlowTransformer'],
              ['Task',            'Threat Classification'],
              ['Dataset',         'CICIDS2017 + CSECICIDS2018'],
              ['Classes',         'benign, ddos, dos, portscan, bruteforce'],
              ['Parameters',      '178,880'],
              ['Layers',          '3 Transformer encoder layers'],
              ['Attention heads', '4'],
              ['Hidden dim',      '64 → 128-dim embedding'],
              ['Loss',            '0.3 × SupCon + 0.7 × CrossEntropy + 0.2 × Margin'],
              ['Accuracy',        '98.15% (k-NN on test set)'],
              ['P99 latency',     '2.64ms'],
            ].map(([k,v]) => (
              <div key={k} style={{
                display:'flex', justifyContent:'space-between', gap:12,
                borderBottom:'1px solid var(--border)', paddingBottom:7, marginBottom:7,
              }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)', flexShrink:0 }}>{k}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--teal)', textAlign:'right' }}>{v}</span>
              </div>
            ))}
          </Card>

          <Card title="THREAT CLASS REFERENCE" accent="var(--red)">
            {Object.entries(CLASS_META).filter(([k]) => k !== 'unknown').map(([key, m]) => (
              <div key={key} style={{
                background:`${m.color}07`, border:`1px solid ${m.color}22`,
                borderRadius:4, padding:'10px 12px', marginBottom:8,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                  <span style={{ fontSize:14 }}>{m.icon}</span>
                  <span style={{ fontFamily:'var(--font-hud)', fontSize:10, color:m.color, letterSpacing:'0.08em' }}>
                    {m.label.toUpperCase()}
                  </span>
                  <SevPill severity={m.severity}/>
                </div>
                <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>
                  {m.userMsg}
                </div>
                {m.action && (
                  <div style={{ fontFamily:'var(--font-body)', fontSize:11, color:m.color, marginTop:5, opacity:0.75 }}>
                    Action: {m.action}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}
    </>
  );
}