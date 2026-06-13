import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://localhost:8000';
const WS  = 'ws://localhost:8000/ws/stream';

export function useNetGuard() {
  const [connected,    setConnected]    = useState(false);
  const [streaming,    setStreaming]    = useState(false);
  const [flows,        setFlows]        = useState([]);        // last 60 flows for table
  const [anomalies,    setAnomalies]    = useState([]);        // anomaly feed
  const [session,      setSession]      = useState(null);      // summary stats
  const [initInfo,     setInitInfo]     = useState(null);      // total_flows, classes etc
  const [done,         setDone]         = useState(false);
  const [embeddings,   setEmbeddings]   = useState([]);
  const [explanation,  setExplaining]   = useState(null);      // { flow_id, text, loading }
  const [chartData,    setChartData]    = useState([]);        // time-series for accuracy/score

  const wsRef    = useRef(null);
  const chartRef = useRef([]);

  // ── Connect & start stream ─────────────────────────────────────────────────
  const startStream = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setFlows([]); setAnomalies([]); setSession(null);
    setDone(false); setChartData([]); chartRef.current = [];

    const ws = new WebSocket(WS);
    wsRef.current = ws;

    ws.onopen  = () => { setConnected(true); setStreaming(true); };
    ws.onclose = () => { setConnected(false); setStreaming(false); };
    ws.onerror = () => { setConnected(false); setStreaming(false); };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'init') {
        setInitInfo(msg.payload);
      }

      if (msg.type === 'flow') {
        const flow = msg.payload;
        setFlows(prev => [...prev.slice(-59), flow]);
        // Update embeddings from flow (embedding not in WS flow, fetch separately)
      }

      if (msg.type === 'anomaly') {
        setAnomalies(prev => [msg.payload, ...prev.slice(0, 49)]);
      }

      if (msg.type === 'session') {
        const s = msg.payload;
        setSession(s);
        // Append to chart data (keep last 60 points)
        const point = {
          t:     new Date().toLocaleTimeString('en', { hour12: false }),
          acc:   Math.round(s.accuracy * 100),
          score: s.privacy_score,
          flows: s.total,
        };
        chartRef.current = [...chartRef.current.slice(-59), point];
        setChartData([...chartRef.current]);
      }

      if (msg.type === 'done') {
        setSession(msg.payload);
        setDone(true);
        setStreaming(false);
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ cmd: 'stop' })); } catch {}
      wsRef.current.close();
    }
    setStreaming(false);
  }, []);

  // ── Fetch embeddings periodically ─────────────────────────────────────────
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/embeddings`);
        const d = await r.json();
        setEmbeddings(d.embeddings || []);
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [streaming]);

  // ── Explain anomaly via Claude ─────────────────────────────────────────────
  const explain = useCallback(async (anomaly) => {
    setExplaining({ flow_id: anomaly.id, text: '', loading: true });
    try {
      const r = await fetch(`${API}/api/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow_id:    anomaly.id,
          label:      anomaly.label,
          confidence: anomaly.confidence,
          probs:      anomaly.probs || {},
          latency_ms: anomaly.latency_ms,
        }),
      });
      const d = await r.json();
      setExplaining({ flow_id: anomaly.id, text: d.explanation, loading: false });
    } catch {
      setExplaining({
        flow_id: anomaly.id,
        text: 'Unable to reach AI explainer. Check backend connection.',
        loading: false,
      });
    }
  }, []);

  const clearExplanation = useCallback(() => setExplaining(null), []);

  return {
    connected, streaming, flows, anomalies, session,
    initInfo, done, embeddings, chartData,
    explanation, explain, clearExplanation,
    startStream, stopStream,
  };
}