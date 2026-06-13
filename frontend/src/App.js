import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useNetGuard } from './useNetGuard';
import {
  HudCard, StatMetric, ConfBar, ThreatBadge, SeverityBadge,
  ThreatRing, ScanlineOverlay, TopBar,
  CLASS_META, SEVERITY_META, classColor, severityColor, StatusDot,
} from './components';

// ── Recharts tooltip ─────────────────────────────────────────────────────────

function HudTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-bright)',borderRadius:3,padding:'6px 10px',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-primary)' }}>
      <div style={{ color:'var(--text-secondary)',marginBottom:4 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ color:p.color }}>{p.name}: {p.value}</div>)}
    </div>
  );
}

// ── Idle / landing screen ────────────────────────────────────────────────────

function IdleScreen({ onStart }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'calc(100vh - 48px)',gap:32,textAlign:'center' }}>
      <div style={{ position:'relative',width:160,height:160 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            position:'absolute',inset:i*20,
            border:`1px solid rgba(239,68,68,${0.3-i*0.08})`,borderRadius:'50%',
            animation:`pulse-teal ${2+i*0.5}s infinite`,animationDelay:`${i*0.3}s`,
          }} />
        ))}
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-hud)',fontSize:11,color:'#ef4444',letterSpacing:'0.1em' }}>
          STANDBY
        </div>
      </div>

      <div>
        <div style={{ fontFamily:'var(--font-hud)',fontSize:26,color:'var(--teal)',letterSpacing:'0.08em',fontWeight:700,marginBottom:8 }}>
          THREAT MATRIX
        </div>
        <div style={{ fontFamily:'var(--font-body)',fontSize:15,color:'var(--text-secondary)',maxWidth:460,lineHeight:1.6 }}>
          Your network is being probed, flooded, and harvested — right now, without your knowledge.<br />
          ThreatMatrix uses AI to detect <em style={{ color:'#ef4444' }}>DDoS, DoS, botnets, port scans, and brute-force attacks</em> in real time — without reading your private data.
        </div>
      </div>

      <div style={{ display:'flex',gap:28,flexWrap:'wrap',justifyContent:'center' }}>
        {['6 threat classes', '60-feature analysis', 'Zero payload inspection', 'Claude AI explanations'].map(f => (
          <div key={f} style={{ fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:6 }}>
            <span style={{ color:'#ef4444' }}>▸</span> {f}
          </div>
        ))}
      </div>

      <button onClick={onStart} style={{
        padding:'12px 32px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.4)',
        borderRadius:3,color:'#ef4444',fontFamily:'var(--font-hud)',
        fontSize:12,letterSpacing:'0.15em',cursor:'pointer',transition:'all 0.2s',
      }}
        onMouseEnter={e => e.target.style.background='rgba(239,68,68,0.2)'}
        onMouseLeave={e => e.target.style.background='rgba(239,68,68,0.1)'}
      >
        ▶ BEGIN THREAT SCAN
      </button>
    </div>
  );
}

// ── Live threat table ─────────────────────────────────────────────────────────

function ThreatTable({ flows }) {
  const recent = [...flows].reverse().slice(0, 18);
  return (
    <div style={{ overflowY:'auto',maxHeight:340 }}>
      <table style={{ width:'100%',borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border)' }}>
            {['#','TIME','THREAT TYPE','SEVERITY','CONFIDENCE','LATENCY','STATUS'].map(h => (
              <th key={h} style={{ padding:'4px 8px',textAlign:'left',fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-secondary)',letterSpacing:'0.1em',fontWeight:400 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recent.map((f, i) => {
            const meta    = CLASS_META[f.label] || CLASS_META.unknown;
            const isNew   = i === 0;
            const isThreat = f.label !== 'benign';
            return (
              <tr key={f.id} style={{
                borderBottom:'1px solid rgba(255,255,255,0.03)',
                background: isThreat ? `${meta.color}08` : isNew ? 'rgba(0,212,170,0.03)' : 'transparent',
                animation:  isNew ? 'slide-in-right 0.3s ease-out' : 'none',
              }}>
                <td style={{ padding:'5px 8px',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-dim)' }}>{f.id}</td>
                <td style={{ padding:'5px 8px',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-secondary)' }}>{f.time}</td>
                <td style={{ padding:'5px 8px' }}><ThreatBadge label={f.label} /></td>
                <td style={{ padding:'5px 8px' }}><SeverityBadge category={meta.category} /></td>
                <td style={{ padding:'5px 8px' }}><ConfBar value={f.confidence} width={60} color={meta.color} /></td>
                <td style={{ padding:'5px 8px',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-secondary)' }}>{f.latency_ms.toFixed(1)}ms</td>
                <td style={{ padding:'5px 8px' }}>
                  {isThreat
                    ? <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:meta.color,letterSpacing:'0.08em',animation:'pulse-teal 1.5s infinite' }}>⚠ {meta.category}</span>
                    : <span style={{ color:'#10b981',fontSize:12 }}>✓</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {flows.length === 0 && (
        <div style={{ padding:'24px',textAlign:'center',color:'var(--text-dim)',fontFamily:'var(--font-mono)',fontSize:11 }}>
          AWAITING TRAFFIC DATA...
        </div>
      )}
    </div>
  );
}

// ── Threat event card ─────────────────────────────────────────────────────────

function ThreatEventCard({ anomaly, onExplain, explanation }) {
  const meta       = CLASS_META[anomaly.label] || CLASS_META.unknown;
  const isExplaining = explanation?.flow_id === anomaly.id;

  return (
    <div style={{
      background:`${meta.color}06`,border:`1px solid ${meta.color}33`,
      borderRadius:3,padding:'10px 12px',
      animation:'anomaly-flash 1.5s ease-in-out 1',
    }}>
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:5 }}>
            <span style={{ fontSize:14 }}>{meta.icon}</span>
            <span style={{ fontFamily:'var(--font-hud)',fontSize:10,color:meta.color,letterSpacing:'0.08em' }}>
              {meta.label.toUpperCase()} DETECTED
            </span>
            <SeverityBadge category={meta.category} />
            <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-dim)',marginLeft:'auto' }}>
              #{anomaly.id} · {anomaly.time}
            </span>
          </div>

          <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:5 }}>
            <ConfBar value={anomaly.confidence} width={60} color={meta.color} />
          </div>

          {/* Probability breakdown */}
          {anomaly.probs && (
            <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:isExplaining?8:0 }}>
              {Object.entries(anomaly.probs)
                .sort(([,a],[,b]) => b-a)
                .map(([cls,p]) => (
                  <span key={cls} style={{ fontFamily:'var(--font-mono)',fontSize:9,color:classColor(cls),opacity:0.75 }}>
                    {CLASS_META[cls]?.icon} {cls}: {Math.round(p*100)}%
                  </span>
                ))}
            </div>
          )}

          {/* Claude explanation */}
          {isExplaining && (
            <div style={{
              marginTop:8,padding:'8px 10px',
              background:'rgba(0,212,170,0.05)',border:'1px solid rgba(0,212,170,0.2)',
              borderRadius:3,fontFamily:'var(--font-body)',fontSize:12,
              color:'var(--text-primary)',lineHeight:1.5,
            }}>
              {explanation.loading
                ? <span style={{ color:'var(--teal)',fontFamily:'var(--font-mono)',fontSize:10 }}>● AI ANALYSING THREAT...</span>
                : explanation.text
              }
            </div>
          )}
        </div>

        <button onClick={() => onExplain(anomaly)} style={{
          padding:'5px 10px',flexShrink:0,
          background:`${meta.color}15`,border:`1px solid ${meta.color}33`,
          borderRadius:3,cursor:'pointer',fontFamily:'var(--font-hud)',
          fontSize:8,color:meta.color,letterSpacing:'0.1em',
        }}>
          {isExplaining && explanation?.loading ? '...' : 'EXPLAIN'}
        </button>
      </div>
    </div>
  );
}

// ── Attack breakdown bar ──────────────────────────────────────────────────────

function AttackBreakdown({ breakdown, total }) {
  const attacks = ['ddos','botnet','dos','bruteforce','portscan'];
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
      {attacks.map(cls => {
        const meta = CLASS_META[cls];
        const cnt  = breakdown?.[cls] || 0;
        const pct  = total > 0 ? (cnt/total)*100 : 0;
        return (
          <div key={cls}>
            <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
              <span style={{ fontFamily:'var(--font-mono)',fontSize:10,color:meta.color }}>
                {meta.icon} {meta.label}
              </span>
              <span style={{ fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-secondary)' }}>
                {cnt} flows · {pct.toFixed(1)}%
              </span>
            </div>
            <div style={{ height:5,background:'rgba(255,255,255,0.04)',borderRadius:2 }}>
              <div style={{
                width:`${Math.min(pct,100)}%`,height:'100%',background:meta.color,borderRadius:2,
                boxShadow:`0 0 8px ${meta.color}66`,transition:'width 0.8s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function App() {
  const ng        = useNetGuard();
  const [tab, setTab] = useState('monitor');

  if (!ng.streaming && !ng.done && ng.flows.length === 0) {
    return (
      <>
        <ScanlineOverlay />
        <TopBar connected={ng.connected} streaming={ng.streaming} session={ng.session} onStart={ng.startStream} onStop={ng.stopStream} />
        <IdleScreen onStart={ng.startStream} />
      </>
    );
  }

  const session   = ng.session || {};
  const counts    = session.counts || {};
  const total     = session.total  || 0;
  const breakdown = session.attack_breakdown || {};
  const threatScore = session.threat_score || 0;
  const threatLevel = session.threat_level || 'SAFE';
  const ringColor   = severityColor(threatScore);

  const pieData = Object.entries(counts)
    .filter(([,v]) => v > 0)
    .map(([k,v]) => ({ name:CLASS_META[k]?.label||k, value:v, color:classColor(k) }));

  return (
    <>
      <ScanlineOverlay />
      <TopBar connected={ng.connected} streaming={ng.streaming} session={session} onStart={ng.startStream} onStop={ng.stopStream} />

      {/* Tabs */}
      <div style={{ display:'flex',gap:0,borderBottom:'1px solid var(--border)',background:'var(--bg-secondary)',padding:'0 20px' }}>
        {[
          { id:'monitor',   label:'LIVE MONITOR'   },
          { id:'threats',   label:'THREAT FEED',   badge: ng.anomalies.length },
          { id:'footprint', label:'ATTACK ANALYSIS' },
          { id:'intel',     label:'SYSTEM INTEL'   },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 18px',background:'transparent',border:'none',
            borderBottom:tab===t.id?'2px solid var(--teal)':'2px solid transparent',
            color:tab===t.id?'var(--teal)':'var(--text-secondary)',
            fontFamily:'var(--font-hud)',fontSize:9,letterSpacing:'0.12em',cursor:'pointer',transition:'all 0.2s',
          }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{ marginLeft:6,background:'#ef4444',borderRadius:8,padding:'1px 5px',fontSize:8,color:'#fff' }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── LIVE MONITOR ─────────────────────────────────────────────────────── */}
      {tab === 'monitor' && (
        <div style={{ padding:16,display:'grid',gridTemplateColumns:'1fr 320px',gap:12,alignItems:'start' }}>
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            {/* KPI row */}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10 }}>
              {[
                { label:'TOTAL FLOWS',  value:total,                                        accent:'var(--teal)' },
                { label:'ACCURACY',     value:`${Math.round((session.accuracy||0)*100)}%`,  accent:'var(--teal)' },
                { label:'P99 LATENCY',  value:session.p99_latency||0, unit:'ms',             accent:'var(--blue)' },
                { label:'THREATS',      value:session.anomaly_count||0,                     accent:session.anomaly_count?'#ef4444':'var(--teal)' },
                { label:'THREAT SCORE', value:threatScore,                                  accent:ringColor },
              ].map(m => (
                <HudCard key={m.label} accent={m.accent} style={{ padding:0 }}>
                  <StatMetric {...m} />
                </HudCard>
              ))}
            </div>

            {/* Flow table */}
            <HudCard title="REAL-TIME THREAT CLASSIFICATION" accent="var(--teal)">
              <ThreatTable flows={ng.flows} />
            </HudCard>

            {/* Accuracy + threat score chart */}
            <HudCard title="SESSION TELEMETRY" accent="#3b82f6">
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={ng.chartData} margin={{ top:4,right:4,left:-24,bottom:0 }}>
                  <defs>
                    <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fontFamily:'Share Tech Mono',fontSize:9,fill:'#64748b' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontFamily:'Share Tech Mono',fontSize:9,fill:'#64748b' }} />
                  <Tooltip content={<HudTooltip />} />
                  <Area type="monotone" dataKey="acc"   stroke="#00d4aa" fill="url(#gAcc)"   strokeWidth={1.5} dot={false} name="Accuracy %" />
                  <Area type="monotone" dataKey="score" stroke="#ef4444" fill="url(#gScore)" strokeWidth={1.5} dot={false} name="Threat Score" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display:'flex',gap:16,marginTop:4 }}>
                <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--teal)' }}>── Accuracy %</span>
                <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'#ef4444' }}>── Threat Score</span>
              </div>
            </HudCard>
          </div>

          {/* Right column */}
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            {/* Threat level ring */}
            <HudCard title="THREAT LEVEL" accent={ringColor}>
              <div style={{ display:'flex',alignItems:'center',gap:16 }}>
                <ThreatRing score={threatScore} level={threatLevel} />
                <div>
                  <div style={{ fontFamily:'var(--font-hud)',fontSize:14,color:ringColor,marginBottom:6,letterSpacing:'0.08em' }}>
                    {threatLevel}
                  </div>
                  <div style={{ fontFamily:'var(--font-body)',fontSize:12,color:'var(--text-secondary)',lineHeight:1.5,maxWidth:140 }}>
                    {threatScore < 20 ? 'Network traffic appears normal. No active threats detected.'
                     : threatScore < 40 ? 'Minor suspicious activity. Continue monitoring.'
                     : threatScore < 60 ? 'Multiple threat signals detected. Review threat feed.'
                     : threatScore < 80 ? 'Active attacks in progress. Immediate review required.'
                     : 'CRITICAL: Severe ongoing attack. Take immediate defensive action.'}
                  </div>
                </div>
              </div>
            </HudCard>

            {/* Traffic type pie */}
            <HudCard title="TRAFFIC DISTRIBUTION" accent="#a78bfa">
              <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={26} outerRadius={46} dataKey="value" strokeWidth={0}>
                      {pieData.map((d,i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1,display:'flex',flexDirection:'column',gap:4 }}>
                  {pieData.map(d => (
                    <div key={d.name} style={{ display:'flex',alignItems:'center',gap:6 }}>
                      <div style={{ width:5,height:5,borderRadius:1,background:d.color,flexShrink:0 }} />
                      <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-secondary)',flex:1 }}>{d.name}</span>
                      <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:d.color }}>{Math.round((d.value/total)*100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </HudCard>

            {/* Recent threats */}
            <HudCard title="RECENT THREATS" accent="#ef4444">
              <div style={{ display:'flex',flexDirection:'column',gap:6,maxHeight:220,overflowY:'auto' }}>
                {ng.anomalies.slice(0,4).map(a => (
                  <ThreatEventCard key={a.id} anomaly={a} onExplain={ng.explain} explanation={ng.explanation} />
                ))}
                {ng.anomalies.length === 0 && (
                  <div style={{ padding:'16px',textAlign:'center',color:'var(--text-dim)',fontFamily:'var(--font-mono)',fontSize:11 }}>
                    NO THREATS DETECTED
                  </div>
                )}
              </div>
            </HudCard>

            {/* Model badge */}
            <HudCard title="ENGINE" accent="var(--text-dim)">
              {[
                ['Model', 'FlowTransformer'],['Dataset','CICIDS2017+2018'],
                ['Classes','6 threat types'],['Features','60-dim vector'],
                ['Device', session.device||'CPU'],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex',justifyContent:'space-between',borderBottom:'1px solid var(--border)',padding:'5px 0' }}>
                  <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </HudCard>
          </div>
        </div>
      )}

      {/* ── THREAT FEED ───────────────────────────────────────────────────────── */}
      {tab === 'threats' && (
        <div style={{ padding:16,maxWidth:860,margin:'0 auto' }}>
          <HudCard title="ACTIVE THREAT EVENTS" accent="#ef4444">
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {ng.anomalies.length === 0
                ? <div style={{ padding:'24px',textAlign:'center',color:'var(--text-dim)',fontFamily:'var(--font-mono)',fontSize:11 }}>NO THREATS DETECTED — NETWORK CLEAN</div>
                : ng.anomalies.map(a => (
                    <ThreatEventCard key={a.id} anomaly={a} onExplain={ng.explain} explanation={ng.explanation} />
                  ))
              }
            </div>
          </HudCard>
        </div>
      )}

      {/* ── ATTACK ANALYSIS ──────────────────────────────────────────────────── */}
      {tab === 'footprint' && (
        <div style={{ padding:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
          <HudCard title="ATTACK TYPE BREAKDOWN" accent="#ef4444">
            <div style={{ display:'flex',alignItems:'flex-start',gap:20 }}>
              <ThreatRing score={threatScore} level={threatLevel} />
              <AttackBreakdown breakdown={breakdown} total={total} />
            </div>
          </HudCard>

          <HudCard title="FLOW VOLUME BY CLASS" accent="#a78bfa">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={Object.entries(counts).map(([k,v]) => ({ name:CLASS_META[k]?.label||k, flows:v, color:classColor(k) }))}
                margin={{ top:4,right:4,left:-20,bottom:0 }}>
                <XAxis dataKey="name" tick={{ fontFamily:'Share Tech Mono',fontSize:9,fill:'#64748b' }} />
                <YAxis tick={{ fontFamily:'Share Tech Mono',fontSize:9,fill:'#64748b' }} />
                <Tooltip content={<HudTooltip />} />
                <Bar dataKey="flows" radius={[2,2,0,0]}>
                  {Object.entries(counts).map(([k],i) => <Cell key={i} fill={classColor(k)} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </HudCard>

          <HudCard title="SESSION SUMMARY" accent="var(--teal)" style={{ gridColumn:'1 / -1' }}>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24 }}>
              {[
                { label:'Flows analysed',    value:total },
                { label:'Classification acc',value:`${Math.round((session.accuracy||0)*100)}%` },
                { label:'Threats detected',  value:session.anomaly_count||0 },
                { label:'Threat score',      value:`${threatScore}/100` },
              ].map(({ label,value }) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:'var(--font-hud)',fontSize:24,color:'var(--teal)',marginBottom:4 }}>{value}</div>
                  <div style={{ fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-secondary)',letterSpacing:'0.08em' }}>{label}</div>
                </div>
              ))}
            </div>
          </HudCard>
        </div>
      )}

      {/* ── SYSTEM INTEL ─────────────────────────────────────────────────────── */}
      {tab === 'intel' && (
        <div style={{ padding:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
          <HudCard title="MODEL ARCHITECTURE" accent="#3b82f6">
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {[
                ['Architecture',    'FlowTransformer'],
                ['Task',            'Threat Classification'],
                ['Dataset',         'CICIDS2017 + CSECICIDS2018'],
                ['Classes',         'benign, ddos, dos, portscan, botnet, bruteforce'],
                ['Parameters',      '178,880'],
                ['Layers',          '3 Transformer encoder layers'],
                ['Attention heads', '4'],
                ['Hidden dim',      '64'],
                ['FFN dim',         '256'],
                ['Embedding',       '128-dim L2-normalised'],
                ['Input',           '60 CICIDS features'],
                ['Loss',            '0.3 × SupCon + 0.7 × CrossEntropy'],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex',justifyContent:'space-between',gap:12,borderBottom:'1px solid var(--border)',paddingBottom:6 }}>
                  <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-secondary)',flexShrink:0 }}>{k}</span>
                  <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--teal)',textAlign:'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </HudCard>

          <HudCard title="THREAT CLASS REFERENCE" accent="#ef4444">
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {Object.entries(CLASS_META).filter(([k]) => k !== 'unknown').map(([key,meta]) => (
                <div key={key} style={{
                  background:`${meta.color}08`,border:`1px solid ${meta.color}25`,
                  borderRadius:3,padding:'8px 10px',
                }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3 }}>
                    <span>{meta.icon}</span>
                    <span style={{ fontFamily:'var(--font-hud)',fontSize:10,color:meta.color,letterSpacing:'0.08em' }}>{meta.label}</span>
                    <SeverityBadge category={meta.category} />
                  </div>
                  <div style={{ fontFamily:'var(--font-body)',fontSize:11,color:'var(--text-secondary)',lineHeight:1.4 }}>
                    {key === 'benign'     && 'Normal network traffic. No threat indicators detected.'}
                    {key === 'ddos'       && 'Distributed Denial-of-Service. Floods target with traffic from multiple sources to knock services offline.'}
                    {key === 'dos'        && 'Denial-of-Service (single-source). Overwhelms a service to make it unavailable — Hulk, GoldenEye, Slowloris variants.'}
                    {key === 'portscan'   && 'Systematic probing of ports to map open services — reconnaissance step before a targeted attack.'}
                    {key === 'botnet'     && 'Command-and-control communication. Device may be compromised and receiving instructions from attacker infrastructure.'}
                    {key === 'bruteforce' && 'Repeated login attempts to crack passwords. Includes FTP, SSH, web brute-force and SQL injection patterns.'}
                  </div>
                </div>
              ))}
            </div>
          </HudCard>
        </div>
      )}
    </>
  );
}