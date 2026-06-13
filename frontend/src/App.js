import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useNetGuard } from './useNetGuard';
import {
  HudCard, StatMetric, ConfBar, TrafficBadge,
  PrivacyRing, ScanlineOverlay, TopBar,
  CLASS_META, classColor, StatusDot,
} from './components';

// ── Custom Recharts tooltip ───────────────────────────────────────────────────
function HudTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
      borderRadius: 2, padding: '6px 10px',
      fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)',
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 9, letterSpacing: '0.1em' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{p.name}</span><span>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Idle / landing screen ─────────────────────────────────────────────────────
function IdleScreen({ onStart }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 52px)',
      gap: 36, textAlign: 'center',
      position: 'relative',
    }}>
      {/* Grid bg */}
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }} />

      {/* Pulsing rings */}
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: i * 18,
            border: `1px solid rgba(0,245,160,${0.35 - i * 0.10})`,
            borderRadius: '50%',
            animation: `pulse-ring ${2 + i * 0.6}s ease-out infinite`,
            animationDelay: `${i * 0.4}s`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontFamily: 'var(--font-hud)', fontSize: 10, color: 'var(--teal)', letterSpacing: '0.2em' }}>STANDBY</div>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', animation: 'pulse-emerald 2s infinite' }} />
        </div>
      </div>

      {/* Title block */}
      <div>
        <div style={{
          fontFamily: 'var(--font-hud)', fontSize: 36,
          color: 'var(--teal)', letterSpacing: '0.15em',
          fontWeight: 700, marginBottom: 6,
          textShadow: '0 0 40px rgba(0,245,160,0.4)',
        }}>NETGUARD</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.2em', marginBottom: 16 }}>
          NETWORK INTELLIGENCE PLATFORM // OP_CENTER_01
        </div>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 14,
          color: 'var(--text-secondary)', maxWidth: 440, lineHeight: 1.7,
        }}>
          Every app on your device is sending data right now.
          NetGuard watches <em style={{ color: 'var(--teal)', fontStyle: 'normal' }}>what</em> they're
          doing — without reading a single byte of your private content.
        </div>
      </div>

      {/* KPI pills */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { v: '94%',    l: 'ACCURACY' },
          { v: '2.7ms',  l: 'P99_LATENCY' },
          { v: '0',      l: 'PAYLOAD_READS' },
        ].map(({ v, l }) => (
          <div key={l} style={{
            padding: '10px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 2,
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-hud)', fontSize: 18, color: 'var(--teal)', fontWeight: 700 }}>{v}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', letterSpacing: '0.12em', marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      <button onClick={onStart} style={{
        padding: '12px 36px',
        background: 'var(--teal-dim)',
        border: '1px solid rgba(0,245,160,0.35)',
        borderRadius: 2,
        color: 'var(--teal)',
        fontFamily: 'var(--font-hud)',
        fontSize: 11, letterSpacing: '0.2em',
        cursor: 'pointer', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,245,160,0.2)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(0,245,160,0.25)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--teal-dim)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <span>▶</span> BEGIN_ANALYSIS
      </button>
    </div>
  );
}

// ── Flow table ────────────────────────────────────────────────────────────────
function FlowTable({ flows }) {
  const recent = [...flows].reverse().slice(0, 18);
  const headers = ['ID_REF', 'HEX_TIMESTAMP', 'FLOW_CLASS', 'CONFIDENCE_MAP', 'LATENCY', 'INTEGRITY'];
  return (
    <div style={{ overflowY: 'auto', maxHeight: 340 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {headers.map(h => (
              <th key={h} style={{
                padding: '5px 10px', textAlign: 'left',
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: 'var(--text-secondary)', letterSpacing: '0.12em', fontWeight: 400,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recent.map((f, i) => {
            const isNew = i === 0;
            return (
              <tr key={f.id} style={{
                borderBottom: '1px solid rgba(0,245,160,0.03)',
                background:   f.is_anomaly ? 'rgba(255,83,112,0.04)' : isNew ? 'rgba(0,245,160,0.02)' : 'transparent',
                animation:    isNew ? 'slide-in-right 0.25s ease-out' : 'none',
                transition:   'background 0.3s',
              }}>
                <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>#{f.id}</td>
                <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{f.time}</td>
                <td style={{ padding: '5px 10px' }}><TrafficBadge label={f.label} /></td>
                <td style={{ padding: '5px 10px' }}><ConfBar value={f.confidence} width={72} /></td>
                <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)' }}>{f.latency_ms?.toFixed(1)}ms</td>
                <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                  {f.is_anomaly
                    ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--red)', letterSpacing: '0.08em' }}>⚠ ANOM</span>
                    : f.true_label === f.label
                      ? <span style={{ color: 'var(--teal)', fontSize: 13 }}>✓</span>
                      : <span style={{ color: 'var(--amber)', fontSize: 13 }}>≈</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {flows.length === 0 && (
        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>
          AWAITING_FLOW_DATA...
        </div>
      )}
    </div>
  );
}

// ── Anomaly feed ──────────────────────────────────────────────────────────────
function AnomalyFeed({ anomalies, onExplain, explanation }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
      {anomalies.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>
          NO_ANOMALIES_DETECTED
        </div>
      )}
      {anomalies.slice(0, 8).map(a => {
        const isExplaining = explanation?.flow_id === a.id;
        return (
          <div key={a.id} className="animate-anomaly" style={{
            background:  'rgba(255,83,112,0.04)',
            border:      '1px solid rgba(255,83,112,0.15)',
            borderLeft:  '2px solid var(--red)',
            borderRadius: 2,
            padding:     '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'pulse-emerald 1.5s infinite' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--red)', letterSpacing: '0.12em' }}>
                    SIG_ANOMALY_{a.id}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)' }}>{a.time}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <TrafficBadge label={a.label} />
                  <ConfBar value={a.confidence} width={52} />
                </div>
                {a.probs && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(a.probs).sort(([,a],[,b]) => b-a).map(([cls, p]) => (
                      <span key={cls} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: classColor(cls), opacity: 0.7 }}>
                        {cls}: {Math.round(p * 100)}%
                      </span>
                    ))}
                  </div>
                )}
                {isExplaining && explanation && (
                  <div style={{
                    marginTop: 8, padding: '8px 10px',
                    background: 'rgba(0,245,160,0.04)',
                    border: '1px solid rgba(0,245,160,0.15)',
                    borderRadius: 2,
                    fontFamily: 'var(--font-body)', fontSize: 12,
                    color: 'var(--text-primary)', lineHeight: 1.6,
                  }}>
                    {explanation.loading
                      ? <span style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em' }}>AI_ANALYSING...</span>
                      : explanation.text
                    }
                  </div>
                )}
              </div>
              <button onClick={() => onExplain(a)} style={{
                padding: '5px 10px', flexShrink: 0,
                background: 'rgba(0,245,160,0.06)',
                border: '1px solid rgba(0,245,160,0.2)',
                borderRadius: 2, cursor: 'pointer',
                fontFamily: 'var(--font-hud)', fontSize: 8,
                color: 'var(--teal)', letterSpacing: '0.12em',
                transition: 'all 0.2s',
              }}>
                {isExplaining && explanation?.loading ? '...' : 'DECRYPT'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Traffic pie ───────────────────────────────────────────────────────────────
function TrafficPie({ counts, total }) {
  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name:  CLASS_META[k]?.label || k,
      value: v,
      color: classColor(k),
      pct:   Math.round((v / total) * 100),
    }));

  if (data.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
      NO_DATA
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <ResponsiveContainer width={106} height={106}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={48}
            dataKey="value" strokeWidth={0} paddingAngle={2}>
            {data.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.82} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 5, height: 5, borderRadius: 1, background: d.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', flex: 1, letterSpacing: '0.06em' }}>{d.name}</span>
            <span style={{ fontFamily: 'var(--font-hud)', fontSize: 10, color: d.color, fontWeight: 700 }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ activeTab, setActiveTab, anomalyCount }) {
  const tabs = [
    { id: 'monitor',   label: 'LIVE_MONITOR' },
    { id: 'footprint', label: 'DIGITAL_FOOTPRINT' },
    { id: 'threats',   label: 'THREAT_FEED' },
    { id: 'intel',     label: 'SYSTEM_INTEL' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      padding: '0 24px',
    }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
          padding: '10px 16px',
          background: 'transparent',
          border: 'none',
          borderBottom: activeTab === tab.id ? '2px solid var(--teal)' : '2px solid transparent',
          color: activeTab === tab.id ? 'var(--teal)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-hud)',
          fontSize: 9, letterSpacing: '0.15em',
          cursor: 'pointer', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {tab.label}
          {tab.id === 'threats' && anomalyCount > 0 && (
            <span style={{
              background: 'var(--red)', borderRadius: 8,
              padding: '1px 5px', fontSize: 8, color: '#fff', fontFamily: 'var(--font-mono)',
            }}>{anomalyCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const ng = useNetGuard();
  const [activeTab, setActiveTab] = useState('monitor');

  if (!ng.streaming && !ng.done && ng.flows.length === 0) {
    return (
      <>
        <ScanlineOverlay />
        <div className="grid-bg" style={{ position: 'fixed', inset: 0, opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />
        <TopBar connected={ng.connected} streaming={ng.streaming} session={ng.session} onStart={ng.startStream} onStop={ng.stopStream} />
        <IdleScreen onStart={ng.startStream} />
      </>
    );
  }

  const session = ng.session || {};
  const counts  = session.counts || {};
  const total   = session.total  || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <ScanlineOverlay />
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />

      <TopBar connected={ng.connected} streaming={ng.streaming} session={session} onStart={ng.startStream} onStop={ng.stopStream} />
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} anomalyCount={ng.anomalies.length} />

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>

        {/* ── LIVE MONITOR ─────────────────────────────────────────────────── */}
        {activeTab === 'monitor' && (
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, alignItems: 'start' }}>
            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* KPI strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {[
                  { label: 'TOTAL_FLOWS',   value: total,                                       accent: 'var(--teal)' },
                  { label: 'ACCURACY',      value: `${Math.round((session.accuracy||0)*100)}%`, accent: 'var(--teal)' },
                  { label: 'AVG_LATENCY',   value: session.avg_latency || 0, unit: 'ms',        accent: 'var(--blue)' },
                  { label: 'P99_LATENCY',   value: session.p99_latency || 0, unit: 'ms',        accent: 'var(--blue)' },
                  { label: 'ANOMALIES',     value: session.anomaly_count || 0,                  accent: session.anomaly_count ? 'var(--red)' : 'var(--teal)' },
                ].map(m => (
                  <HudCard key={m.label} accent={m.accent} style={{ padding: 0 }}>
                    <StatMetric {...m} size="md" />
                  </HudCard>
                ))}
              </div>

              {/* Flow table */}
              <HudCard title="LIVE_NETWORK_CLASSIFICATION" accent="var(--teal)">
                <FlowTable flows={ng.flows} />
              </HudCard>

              {/* Telemetry chart */}
              <HudCard title="TRAJECTORY_MAP [ACCURACY_VS_RISK]" accent="var(--blue)">
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={ng.chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00f5a0" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#00f5a0" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ff5370" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#ff5370" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" tick={{ fontFamily: 'JetBrains Mono', fontSize: 8, fill: '#5a7a6a' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontFamily: 'JetBrains Mono', fontSize: 8, fill: '#5a7a6a' }} />
                    <Tooltip content={<HudTooltip />} />
                    <Area type="monotone" dataKey="acc"   stroke="#00f5a0" fill="url(#gAcc)"   strokeWidth={1.5} dot={false} name="Accuracy %" />
                    <Area type="monotone" dataKey="score" stroke="#ff5370" fill="url(#gScore)" strokeWidth={1.5} dot={false} name="Risk Score" strokeDasharray="5 3" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)' }}>── Accuracy %</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--red)' }}>- - Risk Score</span>
                </div>
              </HudCard>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <HudCard title="RISK_ASSESSMENT" accent="var(--amber)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <PrivacyRing score={session.privacy_score || 0} />
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {(session.privacy_score || 0) < 30
                      ? 'No excessive bursts detected. All channels verified.'
                      : (session.privacy_score || 0) < 60
                        ? 'Unusual traffic patterns detected. Review threat feed.'
                        : 'High risk. Immediate review recommended.'}
                  </div>
                </div>
              </HudCard>

              <HudCard title="TRAFFIC_BREAKDOWN_V2" accent="var(--violet)">
                <TrafficPie counts={counts} total={total} />
              </HudCard>

              <HudCard title="THREAT_LOGS_STREAM" accent="var(--red)">
                <AnomalyFeed anomalies={ng.anomalies} onExplain={ng.explain} explanation={ng.explanation} />
              </HudCard>

              <HudCard title="MODEL_INFO" accent="var(--text-secondary)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    ['Architecture', 'FlowTransformer'],
                    ['Parameters',  '178,880'],
                    ['Features',    '60-dim vector'],
                    ['Embedding',   '128-dim L2'],
                    ['Device',      session.device || 'CPU'],
                    ['Classes',     (session.class_names || []).join(', ')],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 5 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{k}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </HudCard>
            </div>
          </div>
        )}

        {/* ── DIGITAL FOOTPRINT ────────────────────────────────────────────── */}
        {activeTab === 'footprint' && (
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <HudCard title="PRIVACY_RISK_BREAKDOWN" accent="var(--amber)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <PrivacyRing score={session.privacy_score || 0} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-hud)', fontSize: 9, color: 'var(--amber)', marginBottom: 8, letterSpacing: '0.15em' }}>
                      WHAT_THIS_MEANS
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 260 }}>
                      Score is calculated from anomaly rate, unknown traffic volume, and low-confidence classifications. Higher score = harder to explain network behaviour.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Unknown traffic', value: counts.unknown || 0, total, color: 'var(--red)' },
                    { label: 'Anomaly events',  value: session.anomaly_count || 0, total: Math.max(total, 1), color: 'var(--amber)' },
                  ].map(({ label, value, total: t, color }) => {
                    const pct = Math.round((value / Math.max(t, 1)) * 100);
                    return (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>{value} ({pct}%)</span>
                        </div>
                        <div style={{ height: 3, background: 'var(--border-dim)', borderRadius: 1 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 1, boxShadow: `0 0 8px ${color}66` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </HudCard>

            <HudCard title="TRAFFIC_VOLUME_BY_TYPE" accent="var(--violet)">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart
                  data={Object.entries(counts).map(([k, v]) => ({ name: CLASS_META[k]?.label || k, flows: v }))}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontFamily: 'JetBrains Mono', fontSize: 8, fill: '#5a7a6a' }} />
                  <YAxis tick={{ fontFamily: 'JetBrains Mono', fontSize: 8, fill: '#5a7a6a' }} />
                  <Tooltip content={<HudTooltip />} />
                  <Bar dataKey="flows" radius={[2, 2, 0, 0]}>
                    {Object.entries(counts).map(([k], i) => (
                      <Cell key={i} fill={classColor(k)} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </HudCard>

            <HudCard title="SESSION_SUMMARY" accent="var(--teal)" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
                {[
                  { label: 'Flows Analysed',    value: total },
                  { label: 'Classification Acc', value: `${Math.round((session.accuracy||0)*100)}%` },
                  { label: 'Anomalies Detected', value: session.anomaly_count || 0 },
                  { label: 'Avg Inference',      value: `${session.avg_latency || 0}ms` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '12px 0', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-hud)', fontSize: 28, color: 'var(--teal)', marginBottom: 6, textShadow: '0 0 20px rgba(0,245,160,0.4)' }}>{value}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>{label}</div>
                  </div>
                ))}
              </div>
            </HudCard>
          </div>
        )}

        {/* ── THREAT FEED ──────────────────────────────────────────────────── */}
        {activeTab === 'threats' && (
          <div style={{ padding: '16px 20px', maxWidth: 860, margin: '0 auto' }}>
            <HudCard title="ANOMALY_DETECTION_FEED" accent="var(--red)">
              <AnomalyFeed anomalies={ng.anomalies} onExplain={ng.explain} explanation={ng.explanation} />
            </HudCard>
          </div>
        )}

        {/* ── SYSTEM INTEL ─────────────────────────────────────────────────── */}
        {activeTab === 'intel' && (
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <HudCard title="MODEL_ARCHITECTURE" accent="var(--blue)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Model',             'FlowTransformer'],
                  ['Parameters',        '178,880'],
                  ['Transformer Layers','3'],
                  ['Attention Heads',   '4'],
                  ['Hidden Dim',        '64'],
                  ['FFN Dim',           '256'],
                  ['Embedding Size',    '128-dim L2-normalised'],
                  ['Input Features',    '60 behavioural features'],
                  ['Dropout',           '0.1'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </HudCard>

            <HudCard title="PERFORMANCE_BENCHMARKS" accent="var(--teal)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Classification Accuracy', target: '≥ 90%',  achieved: '94.04%', ok: true },
                  { label: 'Intra-class Cosine Sim',  target: '> 0.70', achieved: '0.914',  ok: true },
                  { label: 'Inter-class Cosine Sim',  target: '< 0.30', achieved: '0.173',  ok: true },
                  { label: 'P99 Inference Latency',   target: '< 100ms', achieved: '2.7ms', ok: true },
                ].map(({ label, target, achieved, ok }) => (
                  <div key={label} style={{
                    background: ok ? 'rgba(0,245,160,0.04)' : 'rgba(255,83,112,0.04)',
                    border:     `1px solid ${ok ? 'rgba(0,245,160,0.12)' : 'rgba(255,83,112,0.12)'}`,
                    borderLeft: `2px solid ${ok ? 'var(--teal)' : 'var(--red)'}`,
                    borderRadius: 2, padding: '8px 12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: ok ? 'var(--teal)' : 'var(--red)', letterSpacing: '0.1em' }}>
                        {ok ? '✓ KPI_MET' : '✗ MISSED'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)' }}>TARGET: {target}</span>
                      <span style={{ fontFamily: 'var(--font-hud)', fontSize: 12, color: ok ? 'var(--teal)' : 'var(--red)', fontWeight: 700 }}>{achieved}</span>
                    </div>
                  </div>
                ))}
              </div>
            </HudCard>

            <HudCard title="HOW_IT_WORKS" accent="var(--amber)" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                {[
                  {
                    step: '01',
                    title: 'Capture flow metadata',
                    body: 'NetGuard looks at how data moves — packet timing, size patterns, direction — not what the data says. Your messages, passwords, and files are never read.',
                  },
                  {
                    step: '02',
                    title: 'AI classifies behaviour',
                    body: 'A FlowTransformer model analyses 60 behavioural signals and classifies what type of traffic each flow is using the same attention mechanism behind LLMs.',
                  },
                  {
                    step: '03',
                    title: 'You see the threat',
                    body: 'When something looks unusual — low confidence, ambiguous patterns — NetGuard flags it and Claude explains what it might mean in plain English.',
                  },
                ].map(({ step, title, body }) => (
                  <div key={step} style={{ borderLeft: '2px solid rgba(253,187,44,0.2)', paddingLeft: 16 }}>
                    <div style={{ fontFamily: 'var(--font-hud)', fontSize: 32, color: 'rgba(253,187,44,0.15)', marginBottom: 6, lineHeight: 1 }}>{step}</div>
                    <div style={{ fontFamily: 'var(--font-hud)', fontSize: 10, color: 'var(--amber)', marginBottom: 8, letterSpacing: '0.1em' }}>{title}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{body}</div>
                  </div>
                ))}
              </div>
            </HudCard>
          </div>
        )}

      </div>

      {/* Status bar */}
      <div style={{
        height: 28, flexShrink: 0,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 24,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', gap: 20, flex: 1 }}>
          {[
            { label: 'CPU', value: '24.2%' },
            { label: 'SRAM', value: '4.2 GB' },
            { label: 'GEO', value: 'US_EAST_01' },
          ].map(({ label, value }) => (
            <span key={label} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)' }}>
              {label}: <span style={{ color: 'var(--teal)' }}>{value}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)' }}>
            CAPTURE_RATE: <span style={{ color: 'var(--teal)' }}>1.2 GB/s</span>
          </span>
          <span style={{ width: 1, height: 12, background: 'var(--border)' }} />
          <span style={{ fontFamily: 'var(--font-hud)', fontSize: 8, color: 'rgba(0,245,160,0.6)', letterSpacing: '0.15em' }}>
            Kernel_v4.2.1-stable
          </span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', animation: 'pulse-emerald 2s infinite' }} />
        </div>
      </div>
    </div>
  );
}