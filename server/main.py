"""
NetGuard — Backend API
======================
FastAPI server that wraps the CAFE FlowTransformer classifier.

Endpoints:
  GET  /                      health check
  GET  /api/status            model + session info
  POST /api/classify          classify a single raw feature vector
  WS   /ws/stream             real-time replay stream → React dashboard
  GET  /api/session           aggregated session stats + privacy score
  GET  /api/embeddings        last N embeddings for UMAP scatter
  POST /api/explain           Claude-powered threat explanation

Run from your CAFE project root:
  cd /path/to/cafe_project
  uvicorn netguard.backend.main:app --reload --port 8000

Or symlink / adjust CAFE_ROOT below.
"""

import os
import sys
import json
import time
import pickle
import asyncio
import warnings
import collections
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# PATH SETUP
# Point CAFE_ROOT to the root of your cafe_project folder.
# When running from cafe_project root: CAFE_ROOT = "."
# ─────────────────────────────────────────────────────────────────────────────

CAFE_ROOT = Path(os.getenv("CAFE_ROOT", "."))
sys.path.insert(0, str(CAFE_ROOT))

# ─────────────────────────────────────────────────────────────────────────────
# LOAD META
# ─────────────────────────────────────────────────────────────────────────────

with open(CAFE_ROOT / "data/prepared/meta.json") as f:
    meta = json.load(f)

NAMES      = (meta.get("class_names") or meta.get("label_order")
              or list(meta.get("label_map", {}).keys()))
NF         = int(meta.get("n_features") or meta.get("num_features") or 60)
NC         = int(meta.get("n_classes")  or meta.get("num_classes")  or len(NAMES))
EMBED_DIM  = int(meta.get("embed_dim", 128))
FEAT_NAMES = meta.get("feature_names", [f"f{i}" for i in range(NF)])

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ─────────────────────────────────────────────────────────────────────────────
# SCALER
# ─────────────────────────────────────────────────────────────────────────────

with open(CAFE_ROOT / "data/prepared/scaler.pkl", "rb") as f:
    _sc = pickle.load(f)

if isinstance(_sc, tuple):
    _pre_scaler, _main_scaler = _sc
else:
    _pre_scaler  = None
    _main_scaler = _sc

def scale_features(x: np.ndarray) -> np.ndarray:
    x = np.array(x, dtype=np.float64).reshape(1, -1)
    x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
    if _pre_scaler is not None:
        x = _pre_scaler.transform(x)
        x = np.clip(x, -4, 4)
    x = _main_scaler.transform(x)
    return np.clip(x, -10, 10).astype(np.float32)

def unscale_features(X: np.ndarray) -> np.ndarray:
    x = _main_scaler.inverse_transform(X)
    if _pre_scaler is not None:
        x = _pre_scaler.inverse_transform(x)
    return x.astype(np.float32)

# ─────────────────────────────────────────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────────────────────────────────────────

class FlowTransformer(nn.Module):
    def __init__(self, nf, d=64, h=4, L=3, e=128):
        super().__init__()
        self.feature_embed = nn.Linear(1, d)
        self.pos_enc       = nn.Parameter(torch.randn(1, nf, d) * 0.02)
        enc_layer = nn.TransformerEncoderLayer(
            d, h, d * 4, 0.1, "gelu", batch_first=True, norm_first=True)
        self.transformer = nn.TransformerEncoder(enc_layer, L, nn.LayerNorm(d))
        self.proj = nn.Sequential(
            nn.Linear(d, d * 2), nn.GELU(), nn.Dropout(0.1), nn.Linear(d * 2, e))

    def forward(self, x):
        t = self.feature_embed(x.unsqueeze(-1)) + self.pos_enc
        return F.normalize(self.proj(self.transformer(t).mean(1)), dim=-1)


class ClassifierHead(nn.Module):
    def __init__(self, e, nc):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(e, 256), nn.GELU(), nn.Dropout(0.2), nn.Linear(256, nc))

    def forward(self, x):
        return self.net(x)


encoder = FlowTransformer(NF, e=EMBED_DIM).to(DEVICE)
encoder.load_state_dict(torch.load(
    CAFE_ROOT / "models/encoder_best.pt", map_location=DEVICE, weights_only=True))
encoder.eval()

head = ClassifierHead(EMBED_DIM, NC).to(DEVICE)
head.load_state_dict(torch.load(
    CAFE_ROOT / "models/clf_head.pt", map_location=DEVICE, weights_only=True))
head.eval()

# Optional KNN backup
try:
    with open(CAFE_ROOT / "models/knn_classifier.pkl", "rb") as f:
        _knn = pickle.load(f)
except Exception:
    _knn = None

print(f"✅ Models loaded — device:{DEVICE}  classes:{NAMES}  features:{NF}")

# ─────────────────────────────────────────────────────────────────────────────
# CLASSIFY
# ─────────────────────────────────────────────────────────────────────────────

CONF_THRESHOLD = 0.45

def classify_raw(raw_features: np.ndarray) -> dict:
    """
    Returns:
      label, confidence, latency_ms, all_probs, embedding (128-d list)
    """
    t0 = time.perf_counter()

    x  = scale_features(raw_features)
    xt = torch.tensor(x).to(DEVICE)

    with torch.no_grad():
        emb  = encoder(xt)                               # (1, 128)
        prob = F.softmax(head(emb), dim=-1).cpu().numpy()[0]

    ms       = (time.perf_counter() - t0) * 1000
    best_idx = int(prob.argmax())
    best_conf= float(prob[best_idx])
    label    = NAMES[best_idx] if best_conf >= CONF_THRESHOLD else "unknown"

    return {
        "label":     label,
        "confidence": round(best_conf, 4),
        "latency_ms": round(ms, 3),
        "probs":      {NAMES[i]: round(float(p), 4) for i, p in enumerate(prob)},
        "embedding":  emb.cpu().numpy()[0].tolist(),
    }

# ─────────────────────────────────────────────────────────────────────────────
# SESSION STATE  (in-memory, reset on server restart)
# ─────────────────────────────────────────────────────────────────────────────

class SessionState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.flows:      list  = []          # last 500 flow dicts
        self.embeddings: list  = []          # last 200 embeddings (for UMAP)
        self.counts:     dict  = collections.defaultdict(int)
        self.latencies:  list  = []
        self.anomalies:  list  = []          # anomaly events
        self.total:      int   = 0
        self.correct:    int   = 0
        self.started_at: str   = datetime.now().isoformat()

    def add(self, result: dict, true_label: Optional[str] = None):
        self.total += 1
        label = result["label"]
        self.counts[label] += 1
        self.latencies.append(result["latency_ms"])

        if true_label:
            self.correct += int(label == true_label)

        flow = {
            "id":         self.total,
            "time":       datetime.now().strftime("%H:%M:%S"),
            "label":      label,
            "confidence": result["confidence"],
            "latency_ms": result["latency_ms"],
            "probs":      result["probs"],
            "true_label": true_label,
            "is_anomaly": self._is_anomaly(result),
        }
        self.flows = (self.flows + [flow])[-500:]

        # Store embedding (trimmed for memory)
        emb_entry = {"label": label, "vec": result["embedding"][:2]}  # raw; UMAP done frontend
        self.embeddings = (self.embeddings + [emb_entry])[-200:]

        if flow["is_anomaly"]:
            self.anomalies = (self.anomalies + [{
                **flow,
                "probs": result["probs"],
                "explained": False,
            }])[-50:]

        return flow

    # Threat severity weights — benign = 0, unknown = medium, attacks = high
    THREAT_SEVERITY = {
        "benign":     0,
        "unknown":    2,
        "portscan":   2,
        "bruteforce": 3,
        "dos":        3,
        "botnet":     4,
        "ddos":       4,
    }
    # Severity labels for frontend display
    SEVERITY_LABEL = {
        0: "SAFE",
        1: "LOW",
        2: "MEDIUM",
        3: "HIGH",
        4: "CRITICAL",
    }

    def _is_anomaly(self, result: dict) -> bool:
        label = result["label"]
        conf  = result["confidence"]
        # Any non-benign prediction is a threat event
        if label != "benign":
            return True
        # Low-confidence benign is still suspicious
        if conf < 0.60:
            return True
        # Ambiguous between benign and a threat class
        sorted_probs = sorted(result["probs"].values(), reverse=True)
        if len(sorted_probs) >= 2 and (sorted_probs[0] - sorted_probs[1]) < 0.12:
            return True
        return False

    def threat_score(self) -> int:
        """0–100 threat level. Higher = more attacks detected."""
        if self.total == 0:
            return 0
        score = 0
        # Weighted attack ratio (0–50 pts)
        for label, cnt in self.counts.items():
            weight = self.THREAT_SEVERITY.get(label, 0)
            score += min(50, int((cnt / max(self.total, 1)) * weight * 25))
        # Unknown traffic ratio (0–20 pts)
        unknown_ratio = self.counts.get("unknown", 0) / max(self.total, 1)
        score += min(20, int(unknown_ratio * 80))
        # High-severity attack presence (0–20 pts)
        for label in ("ddos", "botnet"):
            if self.counts.get(label, 0) > 0:
                score += 10
        # Low average confidence (0–10 pts)
        if self.flows:
            avg_conf = float(np.mean([f["confidence"] for f in self.flows[-50:]]))
            score += max(0, int((1.0 - avg_conf) * 20))
        return min(100, score)

    # Keep privacy_score as alias for backwards compatibility with frontend
    def privacy_score(self) -> int:
        return self.threat_score()

    def summary(self) -> dict:
        lats = self.latencies or [0]
        ts   = self.threat_score()
        return {
            "total":         self.total,
            "accuracy":      round(self.correct / max(self.total, 1), 4),
            "privacy_score": ts,               # kept for frontend compat
            "threat_score":  ts,
            "threat_level":  self.SEVERITY_LABEL.get(min(ts // 25, 4), "UNKNOWN"),
            "anomaly_count": len([f for f in self.flows if f["is_anomaly"]]),
            "attack_breakdown": {
                lbl: int(self.counts.get(lbl, 0))
                for lbl in ["ddos", "dos", "portscan", "botnet", "bruteforce"]
            },
            "counts":        dict(self.counts),
            "avg_latency":   round(float(np.mean(lats)), 2),
            "p99_latency":   round(float(np.percentile(lats, 99)), 2),
            "started_at":    self.started_at,
            "device":        DEVICE,
            "class_names":   NAMES,
        }


session = SessionState()

# ─────────────────────────────────────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="NetGuard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── REST endpoints ───────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "model": "FlowTransformer", "device": DEVICE}


@app.get("/api/status")
def status():
    return {
        "model":    "FlowTransformer",
        "device":   DEVICE,
        "classes":  NAMES,
        "features": NF,
        "embed_dim": EMBED_DIM,
        "session":  session.summary(),
    }


class ClassifyRequest(BaseModel):
    features: list[float]

@app.post("/api/classify")
def classify_endpoint(req: ClassifyRequest):
    raw = np.array(req.features, dtype=np.float32)
    if len(raw) != NF:
        return {"error": f"Expected {NF} features, got {len(raw)}"}
    result = classify_raw(raw)
    flow   = session.add(result)
    return {**result, "flow": flow, "session": session.summary()}


@app.get("/api/session")
def get_session():
    return {
        "summary":    session.summary(),
        "recent_flows": session.flows[-20:],
        "anomalies":  session.anomalies[-10:],
    }


@app.get("/api/embeddings")
def get_embeddings():
    return {"embeddings": session.embeddings}


@app.post("/api/session/reset")
def reset_session():
    session.reset()
    return {"status": "reset"}


# ─── Claude explain endpoint ──────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    flow_id:    int
    label:      str
    confidence: float
    probs:      dict
    latency_ms: float

@app.post("/api/explain")
async def explain(req: ExplainRequest):
    """
    Calls Claude API to explain a detected anomaly in plain English.
    Returns a streaming-compatible explanation string.
    """
    import httpx

    # Threat context descriptions for Claude
    THREAT_CONTEXT = {
        "ddos":       "a Distributed Denial-of-Service (DDoS) attack — an attempt to overwhelm a server with traffic",
        "dos":        "a Denial-of-Service (DoS) attack — an attempt to make a service unavailable",
        "portscan":   "a port scan — someone is probing your device to find open services to exploit",
        "botnet":     "botnet command-and-control activity — your device may be communicating with attacker infrastructure",
        "bruteforce": "a brute-force attack — repeated login attempts trying to guess a password",
        "unknown":    "an unrecognised traffic pattern that doesn't match known application or attack profiles",
    }
    threat_desc = THREAT_CONTEXT.get(req.label, f"suspicious traffic classified as {req.label}")

    prob_lines = "\n".join(
        f"  {cls}: {round(p*100,1)}%" for cls, p in sorted(
            req.probs.items(), key=lambda x: -x[1])
    )
    prompt = f"""You are ThreatMatrix, a network security AI that explains cyber threats to everyday users.

A network flow was detected and classified as a potential threat:
- Threat type: {req.label.upper()}
- What this means: {threat_desc}
- Detection confidence: {round(req.confidence * 100, 1)}%
- Model probability breakdown:
{prob_lines}

Explain to someone with no technical background:
1. What this threat means in plain English and what an attacker could be trying to do (1-2 sentences)
2. How serious this is and whether immediate action is needed (be honest but calm)
3. One specific, concrete action they can take right now

Keep it under 90 words. Write as a short paragraph, no bullet points."""

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"Content-Type": "application/json"},
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 200,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        data = resp.json()
        explanation = data["content"][0]["text"]
    except Exception as e:
        fallback_map = {
            "ddos":       "A DDoS attack floods your network with traffic to knock servers offline. This is high severity — check if your upstream provider has DDoS protection enabled.",
            "dos":        "A DoS attack tries to overwhelm a specific service to make it unavailable. Consider blocking the source IP in your firewall immediately.",
            "portscan":   "Someone is scanning your device for open ports — a common first step before a targeted attack. Enable your firewall and close any unnecessary open ports.",
            "botnet":     "Botnet traffic suggests your device may be talking to attacker servers without your knowledge. Run a malware scan and consider isolating this device from your network.",
            "bruteforce": "A brute-force attack is repeatedly trying passwords to break into a service. Enable rate-limiting or two-factor authentication on any exposed login pages.",
        }
        explanation = fallback_map.get(req.label,
            f"Suspicious traffic ({req.label}) detected with {round(req.confidence*100,1)}% confidence. "
            "Review your active connections and consider restarting the affected service."
        )

    # Mark anomaly as explained
    for a in session.anomalies:
        if a["id"] == req.flow_id:
            a["explained"] = True
            a["explanation"] = explanation
            break

    return {"explanation": explanation, "flow_id": req.flow_id}


# ─── WebSocket stream ─────────────────────────────────────────────────────────

ACTIVE_CONNECTIONS: list[WebSocket] = []

@app.websocket("/ws/stream")
async def websocket_stream(ws: WebSocket):
    """
    Streams replay flows to connected React clients.
    Each message is a JSON object:
      { type: "flow" | "anomaly" | "session" | "done", payload: {...} }
    """
    await ws.accept()
    ACTIVE_CONNECTIONS.append(ws)

    try:
        # Load test set
        X_scaled = np.load(CAFE_ROOT / "data/prepared/X_test.npy")
        y_test   = np.load(CAFE_ROOT / "data/prepared/y_test.npy")
        X_raw    = unscale_features(X_scaled)

        session.reset()

        await ws.send_json({
            "type": "init",
            "payload": {
                "total_flows": len(X_raw),
                "classes":     NAMES,
                "features":    NF,
                "device":      DEVICE,
            }
        })

        for i, (raw, true_idx) in enumerate(zip(X_raw, y_test)):
            # Check client still connected
            try:
                # Non-blocking check for incoming messages (pause/stop commands)
                data = await asyncio.wait_for(ws.receive_text(), timeout=0.001)
                msg  = json.loads(data)
                if msg.get("cmd") == "stop":
                    break
                if msg.get("cmd") == "pause":
                    await asyncio.sleep(2)
            except asyncio.TimeoutError:
                pass
            except Exception:
                break

            true_label = NAMES[int(true_idx)]
            result     = classify_raw(raw)
            flow       = session.add(result, true_label)

            # Send flow event
            await ws.send_json({"type": "flow", "payload": flow})

            # Send anomaly event separately so UI can react
            if flow["is_anomaly"]:
                await ws.send_json({
                    "type": "anomaly",
                    "payload": {
                        **flow,
                        "probs": result["probs"],
                    }
                })

            # Send session summary every 10 flows
            if (i + 1) % 10 == 0:
                await ws.send_json({
                    "type": "session",
                    "payload": session.summary()
                })

            # Pacing: ~10 flows/sec feels live without flooding the UI
            await asyncio.sleep(0.10)

        # Final summary
        await ws.send_json({"type": "done", "payload": session.summary()})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "payload": str(e)})
        except Exception:
            pass
    finally:
        if ws in ACTIVE_CONNECTIONS:
            ACTIVE_CONNECTIONS.remove(ws)