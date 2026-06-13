"""
flow_extractor.py  —  Universal Flow Feature Extractor
=======================================================
Phase 1 of the CAFE pipeline.

Outputs a consistent 60-feature vector from ANY source:
  • CESNET QUIC22 raw CSVs  (PPI sequences + PHISTS + SNI + TCP flags)
  • 5G Kaggle Wireshark CSVs (packet-level relative-time CSVs)
  • Live packets             (list of (timestamp_s, length, direction) tuples)

Feature vector (60 total):
  [0-5]   Bulk stats     : packet_count, total_bytes, duration,
                           pkt_rate, byte_rate, bytes_per_pkt
  [6-9]   Timing         : iat_mean, iat_std, iat_min, iat_max
  [10-13] Jitter/RTT     : jitter, rtt_estimate, iat_cv, iat_skew
  [14-17] Directionality : fwd_ratio, byte_asym, dir_changes, burst_score
  [18-25] Src size hist  : sz_src_bin0..7
  [26-33] Dst size hist  : sz_dst_bin0..7
  [34-41] Src IPT hist   : ipt_src_bin0..7
  [42-49] Dst IPT hist   : ipt_dst_bin0..7
  [50-53] TCP flags      : fin_ratio, syn_ratio, rst_ratio, psh_ratio
  [54-57] PPI stats      : ppi_len_mean, ppi_len_std, ppi_len_max, ppi_iat_mean
  [58-59] TLS/entropy    : has_tls, pkt_size_entropy
"""

import re
import math
import numpy as np
import pandas as pd
from datetime import datetime
from typing import List, Tuple, Optional

# ── Histogram bin edges ───────────────────────────────────────────────────────
SIZE_EDGES   = [0, 64, 128, 256, 512, 1024, 1500, 9000]   # bytes
IPT_EDGES_MS = [0, 1, 10, 50, 100, 500, 1000, 5000]        # milliseconds

N_BINS     = 8
N_FEATURES = 60


# ══════════════════════════════════════════════════════════════════════════════
#  Low-level helpers
# ══════════════════════════════════════════════════════════════════════════════

def _hist(values: np.ndarray, edges: List[float]) -> np.ndarray:
    if len(values) == 0:
        return np.zeros(N_BINS, dtype=np.float32)
    counts = np.zeros(N_BINS, dtype=np.float32)
    for v in values:
        placed = False
        for i in range(len(edges) - 1):
            if edges[i] <= v < edges[i + 1]:
                counts[i] += 1
                placed = True
                break
        if not placed:
            counts[-1] += 1
    total = counts.sum()
    return counts / total if total > 0 else counts


def _parse_pipe_floats(s) -> np.ndarray:
    if not isinstance(s, str) or not s:
        return np.array([], dtype=np.float32)
    s = s.strip().lstrip('[').rstrip(']')
    out = []
    for p in re.split(r'[|\s,]+', s):
        try:
            out.append(float(p))
        except ValueError:
            pass
    return np.array(out, dtype=np.float32)


def _parse_pipe_ints(s) -> np.ndarray:
    return _parse_pipe_floats(s).astype(np.int32)


def _parse_pipe_times(s) -> np.ndarray:
    if not isinstance(s, str) or not s:
        return np.array([], dtype=np.float64)
    s = s.strip().lstrip('[').rstrip(']')
    times = []
    for p in re.split(r'\|', s):
        p = p.strip()
        try:
            times.append(datetime.fromisoformat(p).timestamp())
        except Exception:
            try:
                times.append(float(p))
            except Exception:
                pass
    return np.array(times, dtype=np.float64)


def _parse_phist(s) -> np.ndarray:
    arr = _parse_pipe_floats(s)
    if len(arr) == N_BINS:
        total = arr.sum()
        return arr / total if total > 0 else arr
    return np.zeros(N_BINS, dtype=np.float32)


def _shannon_entropy(values: np.ndarray) -> float:
    if len(values) == 0:
        return 0.0
    h = _hist(values, SIZE_EDGES)
    return float(-sum(p * math.log2(p) for p in h if p > 1e-9))


def _iat_from_times(times: np.ndarray) -> np.ndarray:
    if len(times) < 2:
        return np.array([0.0], dtype=np.float32)
    iats = np.diff(np.sort(times)).astype(np.float32)
    return iats[iats >= 0]


def _bulk_stats(total_pkts, total_bytes, duration):
    dur  = max(duration, 1e-9)
    pkts = max(total_pkts, 1)
    return (float(total_pkts), float(total_bytes), float(duration),
            total_pkts / dur, total_bytes / dur, total_bytes / pkts)


def _timing_features(iats):
    if len(iats) == 0:
        return 0.0, 0.0, 0.0, 0.0
    return float(np.mean(iats)), float(np.std(iats)), float(np.min(iats)), float(np.max(iats))


def _jitter_rtt(iats):
    if len(iats) < 2:
        return 0.0, 0.0, 0.0, 0.0
    jitter = float(np.mean(np.abs(np.diff(iats))))
    pos    = iats[iats > 0]
    rtt    = float(np.min(pos)) * 2 if len(pos) > 0 else 0.0
    mean   = float(np.mean(iats))
    std    = float(np.std(iats))
    cv     = std / mean if mean > 1e-9 else 0.0
    skew   = float(np.mean(((iats - mean) / std) ** 3)) if std > 1e-9 else 0.0
    return jitter, rtt, cv, skew


def _dir_features(directions, fwd_bytes, total_bytes, fwd_pkts, total_pkts):
    fwd_ratio  = fwd_pkts / total_pkts if total_pkts > 0 else 0.5
    byte_asym  = (fwd_bytes - (total_bytes - fwd_bytes)) / (total_bytes + 1e-9)
    dir_changes = float(np.sum(np.diff(directions) != 0)) / len(directions) \
                  if len(directions) > 1 else 0.0
    burst_score = 0.0
    if len(directions) > 3:
        run_len = long_runs = 1
        total_runs = 1
        for i in range(1, len(directions)):
            if directions[i] == directions[i - 1]:
                run_len += 1
            else:
                if run_len > 3:
                    long_runs += 1
                run_len = 1
                total_runs += 1
        burst_score = long_runs / total_runs
    return fwd_ratio, byte_asym, dir_changes, burst_score


def _tcp_flag_features(flags: np.ndarray) -> np.ndarray:
    n = len(flags)
    if n == 0:
        return np.zeros(4, dtype=np.float32)
    flags = flags.astype(np.int32)
    return np.array([
        np.sum((flags & 0x01) > 0) / n,
        np.sum((flags & 0x02) > 0) / n,
        np.sum((flags & 0x04) > 0) / n,
        np.sum((flags & 0x08) > 0) / n,
    ], dtype=np.float32)


def _assemble(bulk, timing, jrtt, dirfeat,
              sz_src, sz_dst, ipt_src, ipt_dst,
              tcp_flags, ppi_stats, has_tls, entropy) -> np.ndarray:
    vec = np.concatenate([
        np.array(bulk,       dtype=np.float32),
        np.array(timing,     dtype=np.float32),
        np.array(jrtt,       dtype=np.float32),
        np.array(dirfeat,    dtype=np.float32),
        sz_src.astype(np.float32),
        sz_dst.astype(np.float32),
        ipt_src.astype(np.float32),
        ipt_dst.astype(np.float32),
        tcp_flags.astype(np.float32),
        np.array(ppi_stats,  dtype=np.float32),
        np.array([float(has_tls), float(entropy)], dtype=np.float32),
    ])
    assert len(vec) == N_FEATURES
    return vec


# ══════════════════════════════════════════════════════════════════════════════
#  SOURCE 1: CESNET QUIC22
# ══════════════════════════════════════════════════════════════════════════════

_SNI_MAP = {
    'browsing': [
        'google', 'bing', 'yahoo', 'duckduckgo', 'wikipedia', 'reddit',
        'facebook', 'twitter', 'instagram', 'linkedin', 'pinterest',
        'news', 'bbc', 'cnn', 'nytimes', 'theguardian', 'medium',
        'stackoverflow', 'github', 'gitlab', 'doubleclick', 'analytics',
        'gstatic', 'googleapis', 'cloudflare', 'fastly', 'akamai',
        'amazon', 'ebay', 'shopify', 'etsy', 'alibaba',
    ],
    'streaming': [
        'youtube', 'netflix', 'hulu', 'disneyplus', 'hbomax', 'primevideo',
        'twitch', 'dailymotion', 'vimeo', 'tiktok', 'spotify', 'soundcloud',
        'pandora', 'deezer', 'apple', 'icloud', 'appstore',
    ],
    'video_call': [
        'zoom', 'teams', 'meet.google', 'webex', 'skype', 'discord',
        'whereby', 'jitsi', 'gotomeeting', 'ringcentral',
    ],
    'gaming': [
        'steam', 'epicgames', 'battlenet', 'riotgames', 'ea.com',
        'ubisoft', 'minecraft', 'roblox', 'xbox', 'playstation',
        'nvidia', 'geforce', 'gameloft', 'supercell',
    ],
}


def _sni_to_label(sni: str) -> Optional[str]:
    if not isinstance(sni, str) or len(sni) < 3:
        return None
    sni_lower = sni.lower()
    for label, keywords in _SNI_MAP.items():
        for kw in keywords:
            if kw in sni_lower:
                return label
    return None


def extract_cesnet_row(row: pd.Series) -> Optional[np.ndarray]:
    ppi_lengths    = _parse_pipe_floats(row.get('PPI_PKT_LENGTHS',    ''))
    ppi_directions = _parse_pipe_ints(  row.get('PPI_PKT_DIRECTIONS', ''))
    ppi_times      = _parse_pipe_times( row.get('PPI_PKT_TIMES',      ''))
    ppi_flags      = _parse_pipe_ints(  row.get('PPI_PKT_FLAGS',      ''))

    n_ppi = len(ppi_lengths)
    if n_ppi < 3:
        return None

    fwd_pkts  = int(row.get('PACKETS',     0))
    bwd_pkts  = int(row.get('PACKETS_REV', 0))
    fwd_bytes = int(row.get('BYTES',       0))
    bwd_bytes = int(row.get('BYTES_REV',   0))
    total_pkts  = fwd_pkts + bwd_pkts
    total_bytes = fwd_bytes + bwd_bytes

    try:
        t0 = datetime.fromisoformat(str(row['TIME_FIRST'])).timestamp()
        t1 = datetime.fromisoformat(str(row['TIME_LAST'])).timestamp()
        duration = max(t1 - t0, 1e-6)
    except Exception:
        if len(ppi_times) >= 2:
            duration = max(float(ppi_times[-1] - ppi_times[0]), 1e-6)
        else:
            return None

    bulk = _bulk_stats(total_pkts, total_bytes, duration)

    iats_all = _iat_from_times(ppi_times) if len(ppi_times) >= 2 else \
               np.array([duration / max(total_pkts - 1, 1)], dtype=np.float32)

    timing = _timing_features(iats_all)
    jrtt   = _jitter_rtt(iats_all)

    if len(ppi_directions) >= 3:
        dirs          = np.sign(ppi_directions)
        fwd_pkts_eff  = int(np.sum(dirs > 0))
        fwd_bytes_eff = fwd_bytes
    else:
        dirs          = np.array([1] * fwd_pkts + [-1] * bwd_pkts)
        fwd_pkts_eff  = fwd_pkts
        fwd_bytes_eff = fwd_bytes
    dirfeat = _dir_features(dirs, fwd_bytes_eff, total_bytes, fwd_pkts_eff, total_pkts)

    sz_src = _parse_phist(row.get('S_PHISTS_SIZES', ''))
    sz_dst = _parse_phist(row.get('D_PHISTS_SIZES', ''))
    if sz_src.sum() == 0 and n_ppi >= 3:
        if len(ppi_directions) == n_ppi:
            src_lens = ppi_lengths[np.array(ppi_directions) > 0]
            dst_lens = ppi_lengths[np.array(ppi_directions) < 0]
        else:
            src_lens = ppi_lengths[:n_ppi // 2]
            dst_lens = ppi_lengths[n_ppi // 2:]
        sz_src = _hist(src_lens, SIZE_EDGES)
        sz_dst = _hist(dst_lens, SIZE_EDGES)

    ipt_src = _parse_phist(row.get('S_PHISTS_IPT', ''))
    ipt_dst = _parse_phist(row.get('D_PHISTS_IPT', ''))
    if ipt_src.sum() == 0 and len(ppi_times) >= 4:
        if len(ppi_directions) == len(ppi_times):
            dirs_t = np.array(ppi_directions)
            src_t  = ppi_times[dirs_t > 0]
            dst_t  = ppi_times[dirs_t < 0]
        else:
            mid   = len(ppi_times) // 2
            src_t = ppi_times[:mid]
            dst_t = ppi_times[mid:]
        ipt_src = _hist(np.diff(np.sort(src_t)) * 1000 if len(src_t) >= 2 else np.array([]), IPT_EDGES_MS)
        ipt_dst = _hist(np.diff(np.sort(dst_t)) * 1000 if len(dst_t) >= 2 else np.array([]), IPT_EDGES_MS)

    if len(ppi_flags) >= 3:
        tcp_flags = _tcp_flag_features(ppi_flags)
    else:
        combined  = int(row.get('TCP_FLAGS', 0)) | int(row.get('TCP_FLAGS_REV', 0))
        tcp_flags = _tcp_flag_features(np.array([combined] * max(total_pkts, 1)))

    ppi_stats = (
        float(np.mean(ppi_lengths)), float(np.std(ppi_lengths)),
        float(np.max(ppi_lengths)),  float(np.mean(iats_all)),
    )
    has_tls = 1.0 if isinstance(row.get('TLS_SNI', ''), str) \
                     and len(str(row.get('TLS_SNI', ''))) > 2 else 0.0
    entropy = _shannon_entropy(ppi_lengths)

    return _assemble(bulk, timing, jrtt, dirfeat,
                     sz_src, sz_dst, ipt_src, ipt_dst,
                     tcp_flags, ppi_stats, has_tls, entropy)


def extract_cesnet(csv_path: str, max_rows: int = 50000) -> Tuple[np.ndarray, list]:
    df = pd.read_csv(csv_path, nrows=max_rows, low_memory=False)
    X_rows, y_rows = [], []
    for _, row in df.iterrows():
        label = _sni_to_label(str(row.get('TLS_SNI', '')))
        if label is None:
            continue
        vec = extract_cesnet_row(row)
        if vec is None:
            continue
        X_rows.append(vec)
        y_rows.append(label)
    if not X_rows:
        return np.zeros((0, N_FEATURES), dtype=np.float32), []
    return np.stack(X_rows).astype(np.float32), y_rows


# ══════════════════════════════════════════════════════════════════════════════
#  SOURCE 2: 5G Kaggle Wireshark — streaming chunk reader
#
#  Wireshark CSVs use RELATIVE time (t=0.000000 at first packet).
#  We MUST NOT skip packets where t==0; that is always the first packet.
#
#  Strategy:
#    1. Detect encoding (utf-8 / latin-1) from first 4 KB
#    2. Read CSV in 50k-row pandas chunks — never load full file
#    3. Carry a 'tail' buffer of packets from the previous chunk that
#       belong to an incomplete window
#    4. Emit completed windows; incomplete final window flushed at EOF
# ══════════════════════════════════════════════════════════════════════════════

_5G_FOLDER_MAP = {
    'Video_Conferencing': 'video_call',
    'Stored_Streaming':   'streaming',
    'Game_Streaming':     'gaming',
    'Live_Streaming':     'streaming',
    'Online_Game':        'gaming',
    'Metaverse':          'browsing',
}

_5G_CHUNK_ROWS  = 50_000   # pandas rows per read — ~10 MB per chunk
_PRIVATE = ('10.', '192.168.','192.0.' ,'172.16.', '172.17.', '172.18.',
            '172.19.', '172.2', '172.3')


def _label_from_5g_path(csv_path: str) -> Optional[str]:
    for part in csv_path.replace('\\', '/').split('/'):
        if part in _5G_FOLDER_MAP:
            return _5G_FOLDER_MAP[part]
    return None


def _is_private(ip: str) -> bool:
    return any(str(ip).startswith(p) for p in _PRIVATE)


def _wireshark_time(t_str: str) -> float:
    """Parse Wireshark Time column — handles relative float OR absolute ISO."""
    s = str(t_str).strip()
    try:
        return datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f').timestamp()
    except Exception:
        pass
    try:
        return float(s)      # relative time e.g. 0.000000, 3.141592
    except Exception:
        return -1.0          # sentinel: skip this packet


def _tcp_flags_from_info(info: str) -> int:
    u = str(info).upper()
    f = 0
    if 'FIN' in u: f |= 0x01
    if 'SYN' in u: f |= 0x02
    if 'RST' in u: f |= 0x04
    if 'PSH' in u: f |= 0x08
    return f


def _window_vec(times, lengths, dirs, flags, has_tls) -> Optional[np.ndarray]:
    """Build one 60-feature vector from arrays for a single time window."""
    if len(times) < 3:
        return None
    total_pkts  = len(times)
    total_bytes = int(np.sum(lengths))
    duration    = max(float(times[-1] - times[0]), 1e-6)

    fwd_mask  = dirs > 0
    fwd_pkts  = int(np.sum(fwd_mask))
    fwd_bytes = int(np.sum(lengths[fwd_mask]))

    iats    = _iat_from_times(times)
    bulk    = _bulk_stats(total_pkts, total_bytes, duration)
    timing  = _timing_features(iats)
    jrtt    = _jitter_rtt(iats)
    dirfeat = _dir_features(dirs, fwd_bytes, total_bytes, fwd_pkts, total_pkts)

    fwd_lens    = lengths[fwd_mask]
    bwd_lens    = lengths[dirs < 0]
    sz_src      = _hist(fwd_lens, SIZE_EDGES)
    sz_dst      = _hist(bwd_lens, SIZE_EDGES)

    fwd_t       = times[fwd_mask]
    bwd_t       = times[dirs < 0]
    ipt_src = _hist(np.diff(np.sort(fwd_t)) * 1000 if len(fwd_t) >= 2 else np.array([]), IPT_EDGES_MS)
    ipt_dst = _hist(np.diff(np.sort(bwd_t)) * 1000 if len(bwd_t) >= 2 else np.array([]), IPT_EDGES_MS)

    tcp_flags   = _tcp_flag_features(flags.astype(np.int32))
    ppi_stats   = (float(np.mean(lengths)), float(np.std(lengths)),
                   float(np.max(lengths)),  float(np.mean(iats)) if len(iats) > 0 else 0.0)
    entropy     = _shannon_entropy(lengths)

    return _assemble(bulk, timing, jrtt, dirfeat,
                     sz_src, sz_dst, ipt_src, ipt_dst,
                     tcp_flags, ppi_stats, has_tls, entropy)


def extract_5g(csv_path: str, window_sec: float = 10.0) -> Tuple[np.ndarray, list]:
    """
    Stream-extract flow features from a 5G Wireshark CSV.

    Reads the file in 50k-row pandas chunks. Wireshark relative timestamps
    start at 0.0 — this is valid and must not be filtered out.
    """
    label = _label_from_5g_path(csv_path)
    if label is None:
        return np.zeros((0, N_FEATURES), dtype=np.float32), []

    # ── Detect encoding ───────────────────────────────────────────────────────
    encoding = 'utf-8'
    try:
        with open(csv_path, 'rb') as fh:
            fh.read(16384).decode('utf-8')
    except UnicodeDecodeError:
        encoding = 'latin-1'

    # ── Sample first chunk: check columns, detect TLS, find client IP ─────────
    try:
        sample = pd.read_csv(csv_path, nrows=2000, encoding=encoding, low_memory=False)
    except Exception:
        return np.zeros((0, N_FEATURES), dtype=np.float32), []

    if not {'Time', 'Length'}.issubset(sample.columns):
        return np.zeros((0, N_FEATURES), dtype=np.float32), []

    has_tls = 0.0
    if 'Protocol' in sample.columns:
        if sample['Protocol'].astype(str).str.upper().str.contains('TLS|QUIC').any():
            has_tls = 1.0

    client_ip = None
    if 'Source' in sample.columns:
        priv = [s for s in sample['Source'].astype(str) if _is_private(s)]
        if priv:
            client_ip = max(set(priv), key=priv.count)
    del sample

    # ── State for streaming window aggregation ────────────────────────────────
    # tail_* : packets from previous chunk that belong to an unfinished window
    tail_t   = np.array([], dtype=np.float64)
    tail_l   = np.array([], dtype=np.float32)
    tail_d   = np.array([], dtype=np.int32)
    tail_f   = np.array([], dtype=np.int32)
    t_win_start = None    # float; set on first valid packet seen
    vectors     = []

    def _emit_completed_windows(times, lengths, dirs, flags):
        """Consume all complete windows from arrays; return leftover tail."""
        nonlocal t_win_start
        if len(times) == 0:
            return times, lengths, dirs, flags

        if t_win_start is None:
            t_win_start = float(times[0])

        while True:
            t_end    = t_win_start + window_sec
            in_win   = (times >= t_win_start) & (times < t_end)
            after    = times >= t_end

            if not np.any(after):
                # Window end is beyond all remaining packets — save as tail
                break

            # Complete window exists
            idx = np.where(in_win)[0]
            vec = _window_vec(times[idx], lengths[idx], dirs[idx],
                              flags[idx].astype(np.float32), has_tls)
            if vec is not None:
                vectors.append(vec)
            t_win_start = t_end

            # Advance: drop processed packets
            keep = times >= t_end
            times   = times[keep]
            lengths = lengths[keep]
            dirs    = dirs[keep]
            flags   = flags[keep]

            if len(times) == 0:
                break

        return times, lengths, dirs, flags   # leftover tail

    # ── Stream CSV ────────────────────────────────────────────────────────────
    try:
        reader = pd.read_csv(csv_path, chunksize=_5G_CHUNK_ROWS,
                             encoding=encoding, low_memory=False)
        for chunk in reader:
            if chunk.empty:
                continue

            # Parse times — Wireshark relative float or absolute ISO
            times_raw = chunk['Time'].apply(_wireshark_time).values
            valid     = times_raw >= 0
            if not np.any(valid):
                continue

            times_raw = times_raw[valid]
            lengths   = pd.to_numeric(chunk['Length'], errors='coerce').fillna(0).values[valid].astype(np.float32)

            srcs = chunk['Source'].astype(str).values[valid] if 'Source' in chunk.columns \
                   else np.full(valid.sum(), '', dtype=object)
            infos = chunk['Info'].astype(str).values[valid] if 'Info' in chunk.columns \
                    else np.full(valid.sum(), '', dtype=object)

            # Sort by time within chunk (Wireshark is usually pre-sorted but verify)
            order   = np.argsort(times_raw)
            times_c = times_raw[order]
            lens_c  = lengths[order]
            dirs_c  = np.array([1 if _is_private(s) else -1 for s in srcs[order]], dtype=np.int32)
            flags_c = np.array([_tcp_flags_from_info(inf) for inf in infos[order]], dtype=np.int32)

            # Prepend tail from previous chunk
            if len(tail_t) > 0:
                times_c = np.concatenate([tail_t, times_c])
                lens_c  = np.concatenate([tail_l, lens_c])
                dirs_c  = np.concatenate([tail_d, dirs_c])
                flags_c = np.concatenate([tail_f, flags_c])

            # Emit completed windows; get back leftover tail
            tail_t, tail_l, tail_d, tail_f = _emit_completed_windows(
                times_c, lens_c, dirs_c, flags_c)

            del chunk, times_raw, times_c, lens_c, dirs_c, flags_c

    except Exception as e:
        pass  # Return whatever we have so far

    # ── Flush final (possibly short) window ───────────────────────────────────
    if len(tail_t) >= 5:
        vec = _window_vec(tail_t, tail_l, tail_d,
                          tail_f.astype(np.float32), has_tls)
        if vec is not None:
            vectors.append(vec)

    if not vectors:
        return np.zeros((0, N_FEATURES), dtype=np.float32), []

    return np.stack(vectors).astype(np.float32), [label] * len(vectors)


# ══════════════════════════════════════════════════════════════════════════════
#  SOURCE 3: Live packets
# ══════════════════════════════════════════════════════════════════════════════

def extract_live(packets: List[Tuple[float, int, int]],
                 has_tls: bool = False) -> Optional[np.ndarray]:
    """
    Extract 60-feature vector from a live capture window.

    packets : list of (timestamp_s, length_bytes, direction)
              direction  +1 = client→server   -1 = server→client
    """
    if len(packets) < 5:
        return None

    times      = np.array([p[0] for p in packets], dtype=np.float64)
    lengths    = np.array([p[1] for p in packets], dtype=np.float32)
    directions = np.array([p[2] for p in packets], dtype=np.int32)

    order      = np.argsort(times)
    times      = times[order];  lengths = lengths[order];  directions = directions[order]

    total_pkts  = len(packets)
    total_bytes = int(np.sum(lengths))
    duration    = max(float(times[-1] - times[0]), 1e-6)

    fwd_mask  = directions > 0
    fwd_pkts  = int(np.sum(fwd_mask))
    fwd_bytes = int(np.sum(lengths[fwd_mask]))

    iats    = _iat_from_times(times)
    bulk    = _bulk_stats(total_pkts, total_bytes, duration)
    timing  = _timing_features(iats)
    jrtt    = _jitter_rtt(iats)
    dirfeat = _dir_features(directions, fwd_bytes, total_bytes, fwd_pkts, total_pkts)

    fwd_lens = lengths[fwd_mask]
    bwd_lens = lengths[directions < 0]
    sz_src   = _hist(fwd_lens, SIZE_EDGES)
    sz_dst   = _hist(bwd_lens, SIZE_EDGES)

    fwd_t = times[fwd_mask];  bwd_t = times[directions < 0]
    ipt_src = _hist(np.diff(np.sort(fwd_t)) * 1000 if len(fwd_t) >= 2 else np.array([]), IPT_EDGES_MS)
    ipt_dst = _hist(np.diff(np.sort(bwd_t)) * 1000 if len(bwd_t) >= 2 else np.array([]), IPT_EDGES_MS)

    tcp_flags = np.zeros(4, dtype=np.float32)   # caller may enrich if flags known
    ppi_stats = (float(np.mean(lengths)), float(np.std(lengths)),
                 float(np.max(lengths)),  float(np.mean(iats)) if len(iats) > 0 else 0.0)
    entropy   = _shannon_entropy(lengths)

    return _assemble(bulk, timing, jrtt, dirfeat,
                     sz_src, sz_dst, ipt_src, ipt_dst,
                     tcp_flags, ppi_stats, float(has_tls), entropy)


# ══════════════════════════════════════════════════════════════════════════════
#  Authoritative feature name list
# ══════════════════════════════════════════════════════════════════════════════

FEATURE_NAMES = [
    'packet_count', 'total_bytes', 'duration', 'pkt_rate', 'byte_rate', 'bytes_per_pkt',
    'iat_mean', 'iat_std', 'iat_min', 'iat_max',
    'jitter', 'rtt_estimate', 'iat_cv', 'iat_skew',
    'fwd_ratio', 'byte_asym', 'dir_changes', 'burst_score',
    'sz_src_bin0', 'sz_src_bin1', 'sz_src_bin2', 'sz_src_bin3',
    'sz_src_bin4', 'sz_src_bin5', 'sz_src_bin6', 'sz_src_bin7',
    'sz_dst_bin0', 'sz_dst_bin1', 'sz_dst_bin2', 'sz_dst_bin3',
    'sz_dst_bin4', 'sz_dst_bin5', 'sz_dst_bin6', 'sz_dst_bin7',
    'ipt_src_bin0', 'ipt_src_bin1', 'ipt_src_bin2', 'ipt_src_bin3',
    'ipt_src_bin4', 'ipt_src_bin5', 'ipt_src_bin6', 'ipt_src_bin7',
    'ipt_dst_bin0', 'ipt_dst_bin1', 'ipt_dst_bin2', 'ipt_dst_bin3',
    'ipt_dst_bin4', 'ipt_dst_bin5', 'ipt_dst_bin6', 'ipt_dst_bin7',
    'tcp_fin_ratio', 'tcp_syn_ratio', 'tcp_rst_ratio', 'tcp_psh_ratio',
    'ppi_len_mean', 'ppi_len_std', 'ppi_len_max', 'ppi_iat_mean',
    'has_tls', 'pkt_size_entropy',
]

assert len(FEATURE_NAMES) == N_FEATURES


# ══════════════════════════════════════════════════════════════════════════════
#  Sanity-check
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import glob, time as _t
    from collections import Counter

    print(f"Feature vector length : {N_FEATURES}\n")

    cesnet_files = sorted(glob.glob(
        'data/raw/cesnet_dataset/advanced_similarity_flow_dataset/**/*.csv', recursive=True))
    if cesnet_files:
        print(f"Testing CESNET on {cesnet_files[0]} ...")
        X, y = extract_cesnet(cesnet_files[0], max_rows=500)
        print(f"  Extracted : {X.shape[0]} flows | {Counter(y)}")
        if len(y):
            print(f"  Non-zero  : {(X!=0).sum(axis=1).mean():.1f}/{N_FEATURES}")
            for name, val in zip(FEATURE_NAMES, X[0]):
                print(f"    {name:<25} {val:.6f}")
    else:
        print("[WARN] No CESNET files found.")

    print()

    g5_files = sorted(glob.glob('data/raw/5g_traffic_dataset/**/*.csv', recursive=True))
    if g5_files:
        print(f"Testing 5G on {g5_files[0]} ...")
        X5, y5 = extract_5g(g5_files[0], window_sec=10.0)
        print(f"  Extracted : {X5.shape[0]} flows, label={y5[0] if y5 else 'none'}")
        if len(y5):
            print(f"  Non-zero  : {(X5!=0).sum(axis=1).mean():.1f}/{N_FEATURES}")
            # Show sample window
            for name, val in zip(FEATURE_NAMES, X5[0]):
                print(f"    {name:<25} {val:.6f}")
    else:
        print("[WARN] No 5G files found.")

    print()

    rng = np.random.default_rng(42)
    fake = [(_t.time() + i * rng.exponential(0.05),
             int(rng.choice([64, 200, 512, 1400])),
             1 if i % 3 != 0 else -1) for i in range(50)]
    vec = extract_live(fake, has_tls=True)
    print(f"Live test : shape={vec.shape} non-zero={int((vec!=0).sum())}/{N_FEATURES}")
    print("\n✅ flow_extractor.py sanity check passed")
