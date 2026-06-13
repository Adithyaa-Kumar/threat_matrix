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

// ── Custom Recharts tooltip ──────────────────────────────────────────────────
function HudTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
      borderRadius: 3, padding: '6px 10px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)',
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

// ── Landing / idle screen ────────────────────────────────────────────────────
function IdleScreen({ onStart }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 48px)',
      gap: 32, textAlign: 'center',
    }}>
      {/* Animated ring */}
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: i * 20,
            border: `1px solid rgba(0,212,170,${0.3 - i * 0.08})`,
            borderRadius: '50%',
            animation: `pulse-teal ${2 + i * 0.5}s infinite`,
            animationDelay: `${i * 0.3}s`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-hud)', fontSize: 13, color: 'var(--teal)',
          letterSpacing: '0.1em',
        }}>STANDBY</div>
      </div>

      <div>
        <div style={{
          fontFamily: 'var(--font-hud)', fontSize: 28,
          color: 'var(--teal)', letterSpacing: '0.08em',
          fontWeight: 700, marginBottom: 8,
        }}>NETGUARD</div>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 15,
          color: 'var(--text-secondary)', maxWidth: 420, lineHeight: 1.6,
        }}>
          Every app on your device is sending data right now.<br />
          NetGuard watches <em style={{ color: 'var(--teal)' }}>what</em> they're doing —
          without reading a single byte of your private content.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32 }}>
        {['94% Accuracy', '2.7ms P99', 'Zero payload inspection'].map(f => (
          <div key={f} style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-secondary)', letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: 'var(--teal)' }}>▸</span> {f}
          </div>
        ))}
      </div>

      <button onClick={onStart} style={{
        padding: '12px 32px',
        background: 'var(--teal-dim)',
        border: '1px solid rgba(0,212,170,0.4)',
        borderRadius: 3,
        color: 'var(--teal)',
        fontFamily: 'var(--font-hud)',
        fontSize: 12, letterSpacing: '0.15em',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
        onMouseEnter={e => e.target.style.background = 'rgba(0,212,170,0.25)'}
        onMouseLeave={e => e.target.style.background = 'var(--teal-dim)'}
      >
        ▶ BEGIN ANALYSIS
      </button>
    </div>
  );
}

// ── Live flow table ──────────────────────────────────────────────────────────
function FlowTable({ flows }) {
  const recent = [...flows].reverse().slice(0, 18);
  return (
    <div style={{ overflowY: 'auto', maxHeight: 340 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['#', 'TIME', 'CLASSIFICATION', 'CONFIDENCE', 'LATENCY', 'STATUS'].map(h => (
              <th key={h} style={{
                padding: '4px 8px', textAlign: 'left',
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--text-secondary)', letterSpacing: '0.1em',
                fontWeight: 400,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recent.map((f, i) => {
            const isNew = i === 0;
            return (
              <tr key={f.id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background:   f.is_anomaly
                    ? 'rgba(239,68,68,0.04)'
                    : isNew ? 'rgba(0,212,170,0.03)' : 'transparent',
                  animation: isNew ? 'slide-in-right 0.3s ease-out' : 'none',
                  transition: 'background 0.3s',
                }}>
                <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                  {f.id}
                </td>
                <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                  {f.time}
                </td>
                <td style={{ padding: '5px 8px' }}>
                  <TrafficBadge label={f.label} />
                </td>
                <td style={{ padding: '5px 8px' }}>
                  <ConfBar value={f.confidence} width={70} />
                </td>
                <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                  {f.latency_ms.toFixed(1)}ms
                </td>
                <td style={{ padding: '5px 8px' }}>
                  {f.is_anomaly
                    ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--red)', letterSpacing: '0.08em' }}>⚠ ANOMALY</span>
                    : f.true_label === f.label
                      ? <span style={{ color: 'var(--teal)', fontSize: 12 }}>✓</span>
                      : <span style={{ color: 'var(--amber)', fontSize: 12 }}>≈</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {flows.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          AWAITING FLOW DATA...
        </div>
      )}
    </div>
  );
}

// ── Anomaly feed ─────────────────────────────────────────────────────────────
function AnomalyFeed({ anomalies, onExplain, explanation }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
      {anomalies.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          NO ANOMALIES DETECTED
        </div>
      )}
      {anomalies.slice(0, 8).map(a => {
        const isExplaining = explanation?.flow_id === a.id;
        return (
          <div key={a.id} style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 3, padding: '10px 12px',
            animation: 'anomaly-flash 1.5s ease-in-out 1',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: 'var(--red)', fontSize: 13 }}>⚠</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--red)', letterSpacing: '0.08em' }}>
                    ANOMALY #{a.id}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>{a.time}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <TrafficBadge label={a.label} />
                  <ConfBar value={a.confidence} width={50} />
                </div>
                {/* Prob breakdown */}
                {a.probs && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {Object.entries(a.probs)
                      .sort(([,a],[,b]) => b - a)
                      .map(([cls, p]) => (
                        <span key={cls} style={{
                          fontFamily: 'var(--font-mono)', fontSize: 9,
                          color: classColor(cls), opacity: 0.7,
                        }}>
                          {cls}: {Math.round(p * 100)}%
                        </span>
                      ))}
                  </div>
                )}
                {/* AI explanation */}
                {isExplaining && explanation && (
                  <div style={{
                    marginTop: 8, padding: '8px 10px',
                    background: 'rgba(0,212,170,0.05)',
                    border: '1px solid rgba(0,212,170,0.2)',
                    borderRadius: 3,
                    fontFamily: 'var(--font-body)', fontSize: 12,
                    color: 'var(--text-primary)', lineHeight: 1.5,
                  }}>
                    {explanation.loading
                      ? <span style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>AI ANALYSING...</span>
                      : explanation.text
                    }
                  </div>
                )}
              </div>
              <button onClick={() => onExplain(a)} style={{
                padding: '4px 10px', flexShrink: 0,
                background: 'rgba(0,212,170,0.08)',
                border: '1px solid rgba(0,212,170,0.25)',
                borderRadius: 3, cursor: 'pointer',
                fontFamily: 'var(--font-hud)', fontSize: 8,
                color: 'var(--teal)', letterSpacing: '0.1em',
              }}>
                {isExplaining && explanation?.loading ? '...' : 'EXPLAIN'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Traffic distribution pie ─────────────────────────────────────────────────
function TrafficPie({ counts, total }) {
  const data = Object.entries(counts)
    .filter(([,v]) => v > 0)
    .map(([k, v]) => ({
      name:  CLASS_META[k]?.label || k,
      value: v,
      color: classColor(k),
      pct:   Math.round((v / total) * 100),
    }));

  if (data.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
      NO DATA
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <ResponsiveContainer width={110} height={110}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={50}
            dataKey="value" strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 1, background: d.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: d.color }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────────
export default function App() {
  const ng = useNetGuard();
  const [activeTab, setActiveTab] = useState('monitor');

  if (!ng.streaming && !ng.done && ng.flows.length === 0) {
    return (
      <>
        <ScanlineOverlay />
        <TopBar
          connected={ng.connected} streaming={ng.streaming}
          session={ng.session}
          onStart={ng.startStream} onStop={ng.stopStream}
        />
        <IdleScreen onStart={ng.startStream} />
      </>
    );
  }

  const session = ng.session || {};
  const counts  = session.counts || {};
  const total   = session.total  || 0;

  return (
    <>
      <ScanlineOverlay />
      <TopBar
        connected={ng.connected} streaming={ng.streaming}
        session={session}
        onStart={ng.startStream} onStop={ng.stopStream}
      />

      {/* Tab nav */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        padding: '0 20px',
      }}>
        {[
          { id: 'monitor',  label: 'LIVE MONITOR' },
          { id: 'footprint', label: 'DIGITAL FOOTPRINT' },
          { id: 'threats',  label: 'THREAT FEED' },
          { id: 'intel',    label: 'SYSTEM INTEL' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--teal)' : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--teal)' : 'var(--text-secondary)',
            fontFamily: 'var(--font-hud)',
            fontSize: 9, letterSpacing: '0.12em',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {tab.label}
            {tab.id === 'threats' && ng.anomalies.length > 0 && (
              <span style={{
                marginLeft: 6, background: 'var(--red)',
                borderRadius: 8, padding: '1px 5px',
                fontSize: 8, color: '#fff',
              }}>{ng.anomalies.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: LIVE MONITOR ──────────────────────────────────────────────── */}
      {activeTab === 'monitor' && (
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, alignItems: 'start' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {[
                { label: 'TOTAL FLOWS',  value: total,                                     accent: 'var(--teal)' },
                { label: 'ACCURACY',     value: `${Math.round((session.accuracy||0)*100)}%`, accent: 'var(--teal)' },
                { label: 'AVG LATENCY',  value: session.avg_latency || 0,  unit: 'ms',      accent: 'var(--blue)' },
                { label: 'P99 LATENCY',  value: session.p99_latency || 0,  unit: 'ms',      accent: 'var(--blue)' },
                { label: 'ANOMALIES',    value: session.anomaly_count || 0,                 accent: session.anomaly_count ? 'var(--red)' : 'var(--teal)' },
              ].map(m => (
                <HudCard key={m.label} accent={m.accent} style={{ padding: 0 }}>
                  <StatMetric {...m} size="md" />
                </HudCard>
              ))}
            </div>

            {/* Flow table */}
            <HudCard title="REAL-TIME FLOW CLASSIFICATION" accent="var(--teal)">
              <FlowTable flows={ng.flows} />
            </HudCard>

            {/* Accuracy + Privacy chart */}
            <HudCard title="SESSION TELEMETRY" accent="var(--blue)">
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={ng.chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fontFamily: 'Share Tech Mono', fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontFamily: 'Share Tech Mono', fontSize: 9, fill: '#64748b' }} />
                  <Tooltip content={<HudTooltip />} />
                  <Area type="monotone" dataKey="acc"   stroke="#00d4aa" fill="url(#gAcc)"   strokeWidth={1.5} dot={false} name="Accuracy %" />
                  <Area type="monotone" dataKey="score" stroke="#ef4444" fill="url(#gScore)" strokeWidth={1.5} dot={false} name="Risk Score" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)' }}>── Accuracy %</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--red)' }}>── Risk Score</span>
              </div>
            </HudCard>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Privacy score */}
            <HudCard title="PRIVACY RISK SCORE" accent="var(--amber)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <PrivacyRing score={session.privacy_score || 0} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {(session.privacy_score || 0) < 30
                      ? 'Your network behaviour looks normal. No suspicious patterns detected.'
                      : (session.privacy_score || 0) < 60
                        ? 'Some unusual traffic patterns detected. Review the threat feed.'
                        : 'High risk. Multiple anomalous flows detected. Immediate review recommended.'
                    }
                  </div>
                </div>
              </div>
            </HudCard>

            {/* Traffic breakdown */}
            <HudCard title="TRAFFIC BREAKDOWN" accent="var(--purple)">
              <TrafficPie counts={counts} total={total} />
            </HudCard>

            {/* Recent anomalies (mini) */}
            <HudCard title="LATEST ANOMALIES" accent="var(--red)">
              <AnomalyFeed
                anomalies={ng.anomalies}
                onExplain={ng.explain}
                explanation={ng.explanation}
              />
            </HudCard>

            {/* Model info */}
            <HudCard title="MODEL INFO" accent="var(--text-dim)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  ['Architecture', 'FlowTransformer'],
                  ['Parameters',  '178,880'],
                  ['Features',    '60-dim vector'],
                  ['Embedding',   '128-dim L2'],
                  ['Device',      session.device || 'CPU'],
                  ['Classes',     (session.class_names || []).join(', ')],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </HudCard>
          </div>
        </div>
      )}

      {/* ── TAB: DIGITAL FOOTPRINT ─────────────────────────────────────────── */}
      {activeTab === 'footprint' && (
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <HudCard title="PRIVACY RISK BREAKDOWN" accent="var(--amber)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <PrivacyRing score={session.privacy_score || 0} />
                <div>
                  <div style={{ fontFamily: 'var(--font-hud)', fontSize: 11, color: 'var(--amber)', marginBottom: 8 }}>
                    WHAT THIS MEANS
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, maxWidth: 280 }}>
                    Your privacy score is calculated from anomaly rate, unknown traffic volume, and low-confidence classifications. A higher score means your device's network behaviour is harder to explain — and potentially more at risk.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Unknown traffic', value: counts.unknown || 0, total, color: 'var(--red)' },
                  { label: 'Anomaly events',  value: session.anomaly_count || 0, total: Math.max(total, 1), color: 'var(--amber)' },
                ].map(({ label, value, total: t, color }) => {
                  const pct = Math.round((value / Math.max(t, 1)) * 100);
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color }}>{value} ({pct}%)</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, boxShadow: `0 0 6px ${color}66` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </HudCard>

          <HudCard title="TRAFFIC VOLUME BY TYPE" accent="var(--purple)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={Object.entries(counts).map(([k, v]) => ({ name: CLASS_META[k]?.label || k, flows: v, color: classColor(k) }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontFamily: 'Share Tech Mono', fontSize: 9, fill: '#64748b' }} />
                <YAxis tick={{ fontFamily: 'Share Tech Mono', fontSize: 9, fill: '#64748b' }} />
                <Tooltip content={<HudTooltip />} />
                <Bar dataKey="flows" radius={[2, 2, 0, 0]}>
                  {Object.entries(counts).map(([k], i) => (
                    <Cell key={i} fill={classColor(k)} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </HudCard>

          <HudCard title="SESSION SUMMARY" accent="var(--teal)" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              {[
                { label: 'Flows analysed',   value: total },
                { label: 'Classification accuracy', value: `${Math.round((session.accuracy||0)*100)}%` },
                { label: 'Anomalies detected',      value: session.anomaly_count || 0 },
                { label: 'Avg inference speed',     value: `${session.avg_latency || 0}ms` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-hud)', fontSize: 24, color: 'var(--teal)', marginBottom: 4 }}>{value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{label}</div>
                </div>
              ))}
            </div>
          </HudCard>
        </div>
      )}

      {/* ── TAB: THREAT FEED ───────────────────────────────────────────────── */}
      {activeTab === 'threats' && (
        <div style={{ padding: 16, maxWidth: 860, margin: '0 auto' }}>
          <HudCard title="ANOMALY DETECTION FEED" accent="var(--red)">
            <AnomalyFeed
              anomalies={ng.anomalies}
              onExplain={ng.explain}
              explanation={ng.explanation}
            />
          </HudCard>
        </div>
      )}

      {/* ── TAB: SYSTEM INTEL ──────────────────────────────────────────────── */}
      {activeTab === 'intel' && (
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <HudCard title="MODEL ARCHITECTURE" accent="var(--blue)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Model',            'FlowTransformer'],
                ['Parameters',       '178,880'],
                ['Transformer layers','3'],
                ['Attention heads',  '4'],
                ['Hidden dimension', '64'],
                ['FFN dimension',    '256'],
                ['Embedding size',   '128-dim L2-normalised'],
                ['Input features',   '60 behavioural features'],
                ['Dropout',          '0.1'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)' }}>{v}</span>
                </div>
              ))}
            </div>
          </HudCard>

          <HudCard title="PERFORMANCE BENCHMARKS" accent="var(--teal)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Classification Accuracy', target: '≥ 90%', achieved: '94.04%', ok: true },
                { label: 'Intra-class Cosine Sim',  target: '> 0.70', achieved: '0.914',  ok: true },
                { label: 'Inter-class Cosine Sim',  target: '< 0.30', achieved: '0.173',  ok: true },
                { label: 'P99 Inference Latency',   target: '< 100ms', achieved: '2.7ms', ok: true },
              ].map(({ label, target, achieved, ok }) => (
                <div key={label} style={{ background: ok ? 'rgba(0,212,170,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${ok ? 'rgba(0,212,170,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 3, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: ok ? 'var(--teal)' : 'var(--red)' }}>
                      {ok ? '✓ KPI MET' : '✗ MISSED'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>TARGET: {target}</span>
                    <span style={{ fontFamily: 'var(--font-hud)', fontSize: 11, color: ok ? 'var(--teal)' : 'var(--red)' }}>{achieved}</span>
                  </div>
                </div>
              ))}
            </div>
          </HudCard>

          <HudCard title="HOW IT WORKS — FOR EVERYONE" accent="var(--amber)" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {[
                {
                  step: '01',
                  title: 'Capture flow metadata',
                  body: 'NetGuard looks at how data moves — packet timing, size patterns, and direction — not what the data says. Your messages, passwords, and files are never read.',
                },
                {
                  step: '02',
                  title: 'AI classifies behaviour',
                  body: 'A Transformer AI model (the same architecture behind ChatGPT) analyses 60 behavioural signals and classifies what type of traffic each flow is.',
                },
                {
                  step: '03',
                  title: 'You see the threat',
                  body: 'When something looks unusual — low confidence, ambiguous patterns — NetGuard flags it and Claude explains what it might mean in plain English.',
                },
              ].map(({ step, title, body }) => (
                <div key={step}>
                  <div style={{ fontFamily: 'var(--font-hud)', fontSize: 28, color: 'rgba(0,212,170,0.2)', marginBottom: 6 }}>{step}</div>
                  <div style={{ fontFamily: 'var(--font-hud)', fontSize: 11, color: 'var(--teal)', marginBottom: 6, letterSpacing: '0.08em' }}>{title}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{body}</div>
                </div>
              ))}
            </div>
          </HudCard>
        </div>
      )}
    </>
  );
}