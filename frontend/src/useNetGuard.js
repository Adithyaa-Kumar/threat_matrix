import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://localhost:8000';
const WS  = 'ws://localhost:8000/ws/stream';

export function useNetGuard() {
  const [connected,   setConnected]   = useState(false);
  const [streaming,   setStreaming]   = useState(false);
  const [flows,       setFlows]       = useState([]);
  const [anomalies,   setAnomalies]   = useState([]);
  const [session,     setSession]     = useState(null);
  const [done,        setDone]        = useState(false);
  const [explanation, setExplaining]  = useState(null);
  const [chartData,   setChartData]   = useState([]);

  const wsRef    = useRef(null);
  const chartRef = useRef([]);

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
      if (msg.type === 'flow') {
        setFlows(prev => [...prev.slice(-79), msg.payload]);
      }
      if (msg.type === 'anomaly') {
        setAnomalies(prev => [msg.payload, ...prev.slice(0, 49)]);
      }
      if (msg.type === 'session') {
        const s = msg.payload;
        setSession(s);
        const point = {
          t:      new Date().toLocaleTimeString('en', { hour12:false }),
          safe:   Math.round((s.accuracy || 0) * 100),
          risk:   Math.min(s.threat_score || 0, 100),
          flows:  s.total,
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
      try { wsRef.current.send(JSON.stringify({ cmd:'stop' })); } catch {}
      wsRef.current.close();
    }
    setStreaming(false);
  }, []);

  const explain = useCallback(async (anomaly) => {
    setExplaining({ flow_id:anomaly.id, text:'', loading:true });
    try {
      const r = await fetch(`${API}/api/explain`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          flow_id:    anomaly.id,
          label:      anomaly.label,
          confidence: anomaly.confidence,
          probs:      anomaly.probs || {},
          latency_ms: anomaly.latency_ms,
        }),
      });
      const d = await r.json();
      setExplaining({ flow_id:anomaly.id, text:d.explanation, loading:false });
    } catch {
      setExplaining({ flow_id:anomaly.id, text:'Could not reach AI explainer.', loading:false });
    }
  }, []);

  return {
    connected, streaming, flows, anomalies, session,
    done, chartData, explanation, explain,
    startStream, stopStream,
  };
}