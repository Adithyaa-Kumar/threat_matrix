"""
CAFE — Live Demo  (final)
==========================
Usage:
    python3 live_demo.py --replay          # replay test set, no root needed
    python3 live_demo.py --replay --fast   # fast mode for judges
    sudo python3 live_demo.py --live       # live capture (auto-detects interface)
    sudo python3 live_demo.py --live --iface wlan0
"""

import os, sys, json, time, pickle, argparse, collections, warnings
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from datetime import datetime

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# ARGS
# ─────────────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument("--replay", action="store_true")
parser.add_argument("--fast",   action="store_true")
parser.add_argument("--live",   action="store_true")
parser.add_argument("--iface",  default="")
args = parser.parse_args()

# ─────────────────────────────────────────────────────────────────────────────
# COLORS
# ─────────────────────────────────────────────────────────────────────────────

R  = "\033[0m";  B  = "\033[1m";  DIM = "\033[2m"
CY = "\033[96m"; GR = "\033[92m"; YL  = "\033[93m"
RD = "\033[91m"; BL = "\033[94m"; GY  = "\033[90m"

CLASS_COL = {"browsing": BL, "streaming": GR, "video_call": CY, "gaming": RD}
CLASS_ICO = {"browsing": "🌐", "streaming": "📺", "video_call": "📹", "gaming": "🎮"}

# ─────────────────────────────────────────────────────────────────────────────
# LOAD META  — reads actual keys from data/prepared/meta.json
# ─────────────────────────────────────────────────────────────────────────────

with open("data/prepared/meta.json") as f:
    meta = json.load(f)

# Support every key variant seen across runs
NAMES = (meta.get("class_names")
      or meta.get("label_order")
      or list(meta.get("label_map", {}).keys()))

NF    = int(meta.get("n_features") or meta.get("num_features") or 60)
NC    = int(meta.get("n_classes")  or meta.get("num_classes")  or len(NAMES))
EMBED = int(meta.get("embed_dim", 128))
FEAT_NAMES = meta.get("feature_names", [f"f{i}" for i in range(NF)])

# Class index lookup  {name → int}
if "label_map" in meta:
    NAME_TO_IDX = meta["label_map"]
else:
    NAME_TO_IDX = {n: i for i, n in enumerate(NAMES)}

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ─────────────────────────────────────────────────────────────────────────────
# SCALER  — handles RobustScaler, StandardScaler, or (PT, SS) tuple
# ─────────────────────────────────────────────────────────────────────────────

with open("data/prepared/scaler.pkl", "rb") as f:
    _sc = pickle.load(f)

if isinstance(_sc, tuple):
    _pre_scaler, _main_scaler = _sc   # (PowerTransformer, StandardScaler)
else:
    _pre_scaler  = None
    _main_scaler = _sc                # RobustScaler or StandardScaler

def scale_features(x: np.ndarray) -> np.ndarray:
    """Apply saved scaling pipeline — transform only, never fit."""
    x = np.array(x, dtype=np.float64).reshape(1, -1)
    x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
    if _pre_scaler is not None:
        x = _pre_scaler.transform(x)
        x = np.clip(x, -4, 4)
    x = _main_scaler.transform(x)
    # RobustScaler output can be clipped more loosely
    x = np.clip(x, -10, 10)
    return x.astype(np.float32)

def unscale_features(X: np.ndarray) -> np.ndarray:
    """Reverse scaling on the whole test array for replay mode."""
    x = _main_scaler.inverse_transform(X)
    if _pre_scaler is not None:
        x = _pre_scaler.inverse_transform(x)
    return x.astype(np.float32)

# ─────────────────────────────────────────────────────────────────────────────
# ENCODER  — FlowTransformer (matches training architecture)
# ─────────────────────────────────────────────────────────────────────────────

class FlowTransformer(nn.Module):
    def __init__(self, nf, d=64, h=4, L=3, e=128):
        super().__init__()
        self.feature_embed = nn.Linear(1, d)                        # matches saved weights
        self.pos_enc       = nn.Parameter(torch.randn(1, nf, d) * 0.02)
        enc_layer          = nn.TransformerEncoderLayer(
            d, h, d * 4, 0.1, "gelu", batch_first=True, norm_first=True)
        self.transformer   = nn.TransformerEncoder(enc_layer, L, nn.LayerNorm(d))
        self.proj          = nn.Sequential(
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


encoder = FlowTransformer(NF, e=EMBED).to(DEVICE)
encoder.load_state_dict(torch.load(
    "models/encoder_best.pt", map_location=DEVICE, weights_only=True))
encoder.eval()

head = ClassifierHead(EMBED, NC).to(DEVICE)
head.load_state_dict(torch.load(
    "models/clf_head.pt", map_location=DEVICE, weights_only=True))
head.eval()

# Optional SVM backup
try:
    with open("models/best_classifier.pkl", "rb") as f:
        _svm = pickle.load(f)
except Exception:
    _svm = None

# ─────────────────────────────────────────────────────────────────────────────
# CLASSIFY  — raw feature vector → (label, confidence, latency_ms)
# ─────────────────────────────────────────────────────────────────────────────

CONF_THRESHOLD = 0.45   # below this → "unknown"

def classify(raw_features: np.ndarray) -> tuple:
    t0 = time.perf_counter()

    x  = scale_features(raw_features)
    xt = torch.tensor(x).to(DEVICE)

    with torch.no_grad():
        emb   = encoder(xt)
        prob  = F.softmax(head(emb), dim=-1).cpu().numpy()[0]

    ms       = (time.perf_counter() - t0) * 1000
    best_idx = int(prob.argmax())
    best_conf= float(prob[best_idx])

    if best_conf < CONF_THRESHOLD:
        return "unknown", best_conf, ms

    return NAMES[best_idx], best_conf, ms

# ─────────────────────────────────────────────────────────────────────────────
# UI HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def clear():
    os.system("cls" if os.name == "nt" else "clear")

def conf_bar(val, width=16, color=GR):
    n = int(val * width)
    return f"{color}{'█'*n}{'░'*(width-n)}{R}"

def print_header(mode):
    print(f"\n{B}{CY}"
          "╔══════════════════════════════════════════════════════════════╗\n"
          "║     CAFE — Context-Aware Flow Embeddings                     ║\n"
          "║     Real-Time Encrypted Traffic Classification               ║\n"
          f"╚══════════════════════════════════════════════════════════════╝{R}")
    tag = f"{YL}▶ REPLAY{R}" if mode == "replay" else f"{RD}● LIVE{R}"
    gpu = f"{GR}GPU{R}" if DEVICE == "cuda" else f"{YL}CPU{R}"
    print(f"  {tag}   Device:{gpu}   Features:{NF}   "
          + "  ".join(CLASS_ICO[n]+n for n in NAMES if n in CLASS_ICO) + "\n")

def print_dashboard(history, counts, total, latencies, acc=None):
    # Recent flows
    print(f"{B}  RECENT FLOWS{R}")
    print(f"  {'Time':<10} {'Predicted':<14} {'Confidence':<23} {'ms':>6}  {'✓/✗':>4}")
    print(f"  {'─'*62}")
    for r in list(history)[-12:]:
        col = CLASS_COL.get(r["cls"], GY)
        ico = CLASS_ICO.get(r["cls"], "·")
        chk = ""
        if "true" in r:
            chk = f"  {GR}✓{R}" if r["cls"]==r["true"] else f"  {RD}✗{r['true']}{R}"
        print(f"  {GY}{r['time']}{R}  {col}{ico} {r['cls']:<12}{R}  "
              f"{conf_bar(r['conf'],14,col)} {r['conf']*100:>3.0f}%  "
              f"{r['lat']:>5.1f}ms{chk}")

    # Stats line
    print(f"\n{B}  SESSION STATS{R}   flows:{B}{total}{R}", end="")
    if acc is not None:
        c = GR if acc >= 0.90 else YL
        print(f"   acc:{c}{B}{acc*100:.1f}%{R}", end="")
    if latencies:
        print(f"   avg:{CY}{np.mean(latencies):.1f}ms{R}  "
              f"p99:{CY}{np.percentile(latencies,99):.1f}ms{R}", end="")
    print()

    # Class distribution
    print(f"\n  {'Class':<14}{'Count':>7}  {'Share':>6}  Distribution")
    print(f"  {'─'*54}")
    for cls in NAMES:
        cnt = counts.get(cls, 0)
        pct = cnt / max(total, 1)
        col = CLASS_COL.get(cls, GY)
        ico = CLASS_ICO.get(cls, "·")
        bar = "█" * int(pct * 28)
        print(f"  {col}{ico} {cls:<12}{R}  {cnt:>6}  {pct*100:>5.1f}%  {col}{bar}{R}")
    print()

# ─────────────────────────────────────────────────────────────────────────────
# REPLAY MODE
# ─────────────────────────────────────────────────────────────────────────────

def run_replay():
    X_scaled = np.load("data/prepared/X_test.npy")
    y_test   = np.load("data/prepared/y_test.npy")
    X_raw    = unscale_features(X_scaled)

    history   = collections.deque(maxlen=60)
    counts    = collections.defaultdict(int)
    latencies = []
    correct   = 0
    total     = 0

    clear(); print_header("replay")
    print(f"  {YL}Loaded {len(X_raw):,} test flows  ({NC} classes, {NF} features){R}\n")
    time.sleep(1)

    for raw, true_idx in zip(X_raw, y_test):
        cls, conf, lat = classify(raw)
        true_cls = NAMES[int(true_idx)]

        counts[cls] += 1
        latencies.append(lat)
        total   += 1
        correct += int(cls == true_cls)

        history.append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "cls": cls, "conf": conf, "lat": lat, "true": true_cls,
        })

        if total % 5 == 0:
            clear(); print_header("replay")
            print(f"  {YL}▶{R}  Flow {B}#{total}{R}  "
                  f"{DIM}{datetime.now().strftime('%H:%M:%S')}{R}\n")
            print_dashboard(history, counts, total, latencies,
                            acc=correct/total)

        if not args.fast:
            time.sleep(0.10)

    # Final screen
    clear(); print_header("replay")
    final_acc = correct / max(total, 1)
    ac = GR if final_acc >= 0.90 else YL
    print(f"  {GR}{B}✅ COMPLETE — {total:,} flows{R}\n")
    print_dashboard(history, counts, total, latencies, acc=final_acc)
    print(f"  Final accuracy : {ac}{B}{final_acc*100:.2f}%{R}  "
          f"{'✅ TARGET MET' if final_acc >= 0.90 else '⚠️  below 90%'}")
    print(f"  Avg latency    : {CY}{np.mean(latencies):.1f}ms{R}")
    print(f"  P99 latency    : {CY}{np.percentile(latencies,99):.1f}ms{R}")
    print(f"\n  {GY}Ctrl+C to exit{R}")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n{GY}  Exiting CAFE.{R}\n")

# ─────────────────────────────────────────────────────────────────────────────
# LIVE CAPTURE MODE
# ─────────────────────────────────────────────────────────────────────────────

def auto_iface():
    import subprocess
    try:
        out = subprocess.check_output(
            ["ip", "-o", "link", "show", "up"], text=True, stderr=subprocess.DEVNULL)
        for line in out.splitlines():
            name = line.split(":")[1].strip().split("@")[0]
            if name != "lo":
                return name
    except Exception:
        pass
    return "eth0"

def build_live_features(times, lengths, n_fwd, n_rev, b_fwd, b_rev) -> np.ndarray:
    """
    Build the 60-feature vector that matches data/prepared/meta.json feature_names.
    Features in exact order as FEAT_NAMES.
    """
    feat = np.zeros(NF, dtype=np.float32)

    # Guard
    if len(times) < 2:
        return feat

    n        = len(lengths)
    tot_b    = float(lengths.sum())
    dur      = max(float(times[-1] - times[0]), 1e-3)
    pkt_rate = n / dur
    byte_rate= tot_b / dur

    iats = np.diff(np.sort(times))
    iats = iats[iats >= 0]
    if len(iats) < 2:
        iats = np.array([1e-3, 1e-3])

    iat_mean = float(iats.mean())
    iat_std  = float(iats.std())
    iat_min  = float(iats.min())
    iat_max  = float(iats.max())
    iat_cv   = iat_std / (iat_mean + 1e-6)

    # Skewness
    iat_skew = 0.0
    if iat_std > 0:
        iat_skew = float(((iats - iat_mean)**3).mean() / (iat_std**3 + 1e-9))

    tot_pkt = n_fwd + n_rev
    bpp     = (b_fwd + b_rev) / max(tot_pkt, 1)
    fwd_r   = n_fwd / max(tot_pkt, 1)
    b_asym  = (b_fwd - b_rev) / ((b_fwd + b_rev) + 1e-6)
    burst   = pkt_rate / (dur + 1e-3)

    # Packet size histogram — 8 src bins (forward direction approximation)
    sz_breaks = [0, 100, 300, 600, 1000, 1400, 2000, 5000, np.inf]
    sz_src = np.array(
        [((lengths >= sz_breaks[i]) & (lengths < sz_breaks[i+1])).sum()
         for i in range(8)], dtype=np.float32)
    sz_src /= max(sz_src.sum(), 1)
    sz_dst  = sz_src * 0.8   # approximation — no per-direction lengths from scapy

    # IPT histogram — 8 src bins (ms)
    ipt_ms = iats * 1000
    ipt_breaks = [0, 1, 5, 20, 50, 100, 500, 1000, np.inf]
    ipt_src = np.array(
        [((ipt_ms >= ipt_breaks[i]) & (ipt_ms < ipt_breaks[i+1])).sum()
         for i in range(8)], dtype=np.float32)
    ipt_src /= max(ipt_src.sum(), 1)
    ipt_dst  = ipt_src * 0.8

    # PPI stats (same as packet-level stats here)
    ppi_len_mean = float(lengths.mean())
    ppi_len_std  = float(lengths.std())
    ppi_len_max  = float(lengths.max())
    ppi_iat_mean = iat_mean

    # Entropy of packet sizes
    hist, _ = np.histogram(lengths, bins=16, density=True)
    hist    = hist[hist > 0]
    entropy = float(-np.sum(hist * np.log2(hist + 1e-9))) if len(hist) > 0 else 0.0

    # Map each named feature to its value
    val_map = {
        "packet_count"  : float(n),
        "total_bytes"   : tot_b,
        "duration"      : dur,
        "pkt_rate"      : pkt_rate,
        "byte_rate"     : byte_rate,
        "bytes_per_pkt" : bpp,
        "iat_mean"      : iat_mean,
        "iat_std"       : iat_std,
        "iat_min"       : iat_min,
        "iat_max"       : iat_max,
        "jitter"        : iat_std,
        "rtt_estimate"  : iat_mean * 2,
        "iat_cv"        : iat_cv,
        "iat_skew"      : iat_skew,
        "fwd_ratio"     : fwd_r,
        "byte_asym"     : b_asym,
        "dir_changes"   : 0.0,
        "burst_score"   : burst,
        "ppi_len_mean"  : ppi_len_mean,
        "ppi_len_std"   : ppi_len_std,
        "ppi_len_max"   : ppi_len_max,
        "ppi_iat_mean"  : ppi_iat_mean,
        "has_tls"       : 0.0,           # set per-packet if TCP:443 detected
        "pkt_size_entropy": entropy,
        "tcp_fin_ratio" : 0.0,
        "tcp_syn_ratio" : 0.0,
        "tcp_rst_ratio" : 0.0,
        "tcp_psh_ratio" : 0.0,
    }
    # Histogram bins
    for i in range(8):
        val_map[f"sz_src_bin{i}"]  = float(sz_src[i])
        val_map[f"sz_dst_bin{i}"]  = float(sz_dst[i])
        val_map[f"ipt_src_bin{i}"] = float(ipt_src[i])
        val_map[f"ipt_dst_bin{i}"] = float(ipt_dst[i])

    # Fill in order
    for i, name in enumerate(FEAT_NAMES):
        feat[i] = val_map.get(name, 0.0)

    return np.nan_to_num(feat, nan=0.0, posinf=0.0, neginf=0.0)


def run_live():
    try:
        from scapy.all import sniff, IP, TCP, UDP
    except ImportError:
        print(f"\n{RD}  scapy not installed → pip install scapy{R}\n")
        sys.exit(1)

    if os.geteuid() != 0:
        iface = args.iface or auto_iface()
        print(f"\n{RD}  Live capture needs root.{R}")
        print(f"  Run: {B}sudo python3 live_demo.py --live --iface {iface}{R}\n")
        sys.exit(1)

    iface = args.iface or auto_iface()

    history   = collections.deque(maxlen=60)
    counts    = collections.defaultdict(int)
    latencies = [1.0]
    total     = 0

    flow_buf = collections.defaultdict(lambda: {
        "times": [], "lengths": [],
        "fwd_pkts": 0, "rev_pkts": 0,
        "fwd_bytes": 0.0, "rev_bytes": 0.0,
        "first_src": None, "has_tls": False,
        "tcp_flags": []})

    MIN_PKTS   = 10
    RESET_AFTER= 50

    clear(); print_header("live")
    print(f"  {RD}● Capturing on {B}{iface}{R}  "
          f"(classifies after {MIN_PKTS} packets/flow)\n")
    print(f"  {YL}Open YouTube, start a game, make a Zoom call...{R}\n")

    def on_packet(pkt):
        nonlocal total
        if not pkt.haslayer(IP): return
        ip    = pkt[IP]
        proto = "TCP" if pkt.haslayer(TCP) else ("UDP" if pkt.haslayer(UDP) else None)
        if proto is None: return

        src, dst = ip.src, ip.dst
        key = (min(src, dst), max(src, dst), proto)
        buf = flow_buf[key]

        ts  = time.time()
        pl  = len(pkt)

        if buf["first_src"] is None:
            buf["first_src"] = src

        if src == buf["first_src"]:
            buf["fwd_pkts"]  += 1
            buf["fwd_bytes"] += pl
        else:
            buf["rev_pkts"]  += 1
            buf["rev_bytes"] += pl

        # TLS detection (TCP port 443)
        if pkt.haslayer(TCP):
            tcp = pkt[TCP]
            if tcp.dport == 443 or tcp.sport == 443:
                buf["has_tls"] = True
            buf["tcp_flags"].append(int(tcp.flags))

        buf["times"].append(ts)
        buf["lengths"].append(pl)

        n = len(buf["times"])
        if n < MIN_PKTS:
            return

        t_arr = np.array(buf["times"],   dtype=np.float64)
        l_arr = np.array(buf["lengths"], dtype=np.float32)

        feat = build_live_features(
            t_arr, l_arr,
            buf["fwd_pkts"], buf["rev_pkts"],
            buf["fwd_bytes"], buf["rev_bytes"])

        # Patch TLS and TCP flag features
        if "has_tls" in FEAT_NAMES:
            feat[FEAT_NAMES.index("has_tls")] = 1.0 if buf["has_tls"] else 0.0
        if buf["tcp_flags"] and "tcp_syn_ratio" in FEAT_NAMES:
            flags = np.array(buf["tcp_flags"])
            nf    = len(flags)
            for flag_name, bit in [("tcp_fin_ratio",1),("tcp_syn_ratio",2),
                                    ("tcp_rst_ratio",4),("tcp_psh_ratio",8)]:
                if flag_name in FEAT_NAMES:
                    feat[FEAT_NAMES.index(flag_name)] = float((flags & bit).astype(bool).sum()/nf)

        cls, conf, lat = classify(feat)

        if cls != "unknown":
            counts[cls] += 1
            latencies.append(lat)
            total += 1
            history.append({
                "time": datetime.now().strftime("%H:%M:%S"),
                "cls": cls, "conf": conf, "lat": lat,
            })

        if n >= RESET_AFTER:
            flow_buf[key] = {
                "times": [], "lengths": [],
                "fwd_pkts": 0, "rev_pkts": 0,
                "fwd_bytes": 0.0, "rev_bytes": 0.0,
                "first_src": None, "has_tls": False,
                "tcp_flags": []}

        if total > 0 and total % 3 == 0:
            clear(); print_header("live")
            print(f"  {RD}● LIVE{R}  {B}{iface}{R}  "
                  f"Flow #{B}{total}{R}  "
                  f"{DIM}{datetime.now().strftime('%H:%M:%S')}{R}\n")
            print_dashboard(history, counts, total, latencies)

    try:
        sniff(iface=iface, prn=on_packet, store=False)
    except KeyboardInterrupt:
        print(f"\n{GY}  Capture stopped.{R}\n")
    except Exception as e:
        print(f"\n{RD}  Capture error: {e}{R}")
        print(f"  Try: {B}sudo python3 live_demo.py --live --iface eth0{R}\n")

# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if args.live:
        run_live()
    elif args.replay:
        run_replay()
    else:
        print(f"\n{B}CAFE — Context-Aware Flow Embeddings{R}")
        print(f"  Classes  : {' '.join(CLASS_ICO.get(n,'·')+' '+n for n in NAMES)}")
        print(f"  Features : {NF}   Embed: {EMBED}D   Device: {DEVICE}")
        print(f"\n  {YL}Usage:{R}")
        print(f"    python3 live_demo.py --replay")
        print(f"    python3 live_demo.py --replay --fast")
        print(f"    sudo python3 live_demo.py --live")
        print(f"    sudo python3 live_demo.py --live --iface wlan0\n")
