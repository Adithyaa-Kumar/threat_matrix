"""
build_dataset.py  —  ThreatMatrix: Dataset Builder
====================================================
Replaces the old CESNET/5G application-classifier pipeline.

Source datasets (place in data/raw/):
  data/raw/CICIDS2017_improved/*.csv     (CIC-IDS-2017, cleaned)
  data/raw/CSECICIDS2018_improved/*.csv  (CSE-CIC-IDS-2018, cleaned)

What this does:
  1. Stream-reads CICIDS CSVs in 50k-row chunks (safe for 8 GB RAM)
  2. Maps raw attack labels → 6 canonical threat classes
  3. Selects exactly 60 pre-defined features (no extraction from features)
  4. Cleans inf/nan values and clips extreme outliers
  5. Balances classes, splits 70/15/15, fits RobustScaler on train only
  6. Saves X_*.npy, y_*.npy, scaler.pkl, meta.json → data/prepared/

Usage:
  python3 build_dataset.py
  python3 build_dataset.py --min-per-class 5000
  python3 build_dataset.py --skip-extract      # reuse existing flows.parquet
"""

import argparse
import gc
import glob
import json
import os
import pickle
import time
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import RobustScaler

# ── Threat class definitions ──────────────────────────────────────────────────

KEEP_LABELS = {'benign', 'ddos', 'dos', 'portscan', 'botnet', 'bruteforce'}
LABEL_ORDER = ['benign', 'ddos', 'dos', 'portscan', 'botnet', 'bruteforce']

# Maps every raw CICIDS label → canonical threat class
# Covers both CIC-IDS-2017 and CSE-CIC-IDS-2018 label variants
ATTACK_MAP = {
    # ── Benign ────────────────────────────────────────────────────────────────
    'BENIGN':                     'benign',
    'Benign':                     'benign',
    'benign':                     'benign',
    'Normal':                     'benign',
    # ── DDoS ─────────────────────────────────────────────────────────────────
    'DDoS':                       'ddos',
    'DDOS attack-HOIC':           'ddos',
    'DDOS attack-LOIC-UDP':       'ddos',
    'DDoS attacks-LOIC-HTTP':     'ddos',
    'DoS attacks-LOIC-HTTP':      'ddos',
    'DoS attacks-HOIC':           'ddos',
    'DoS attacks-Hulk':           'ddos',
    'DoS attacks-GoldenEye':      'ddos',
    'DoS attacks-Slowloris':      'ddos',
    'Syn':                        'ddos',
    'UDP Flood':                  'ddos',
    'ICMP Flood':                 'ddos',
    # ── DoS ──────────────────────────────────────────────────────────────────
    'DoS Hulk':                   'dos',
    'DoS GoldenEye':              'dos',
    'DoS slowloris':              'dos',
    'DoS Slowhttptest':           'dos',
    'DoS slowhttptest':           'dos',
    'Heartbleed':                 'dos',
    # ── PortScan ─────────────────────────────────────────────────────────────
    'PortScan':                   'portscan',
    'Port Scan':                  'portscan',
    'Infilteration':              'portscan',
    'Infiltration':               'portscan',
    # ── Botnet ───────────────────────────────────────────────────────────────
    'Bot':                        'botnet',
    'Botnet ARES':                'botnet',
    # ── Brute Force ──────────────────────────────────────────────────────────
    'FTP-Patator':                'bruteforce',
    'SSH-Patator':                'bruteforce',
    'Brute Force':                'bruteforce',
    'Web Attack - Brute Force':   'bruteforce',
    'Web Attack - XSS':           'bruteforce',
    'Web Attack - Sql Injection': 'bruteforce',
    'XSS':                        'bruteforce',
    'SQL Injection':              'bruteforce',
}

# ── 60 selected features from CICIDS ─────────────────────────────────────────
# Chosen to maximise threat discriminability and avoid near-zero-variance cols.
# These names match the column headers in CIC-IDS-2017 (improved) and
# CSE-CIC-IDS-2018 (improved) after stripping leading/trailing whitespace.

FEATURE_NAMES = [
    # ── Flow volume ───────────────────────────────────────────────────────────
    'Flow Duration',
    'Total Fwd Packet',             # col 9  — note: no trailing 's'
    'Total Bwd packets',            # col 10 — lowercase 'p'
    'Total Length of Fwd Packet',  # col 11
    'Total Length of Bwd Packet',  # col 12
    # ── Per-packet sizes (fwd) ────────────────────────────────────────────────
    'Fwd Packet Length Max',
    'Fwd Packet Length Min',
    'Fwd Packet Length Mean',
    'Fwd Packet Length Std',
    # ── Per-packet sizes (bwd) ────────────────────────────────────────────────
    'Bwd Packet Length Max',
    'Bwd Packet Length Min',
    'Bwd Packet Length Mean',
    'Bwd Packet Length Std',
    # ── Flow rates ────────────────────────────────────────────────────────────
    'Flow Bytes/s',
    'Flow Packets/s',
    # ── Inter-arrival times ───────────────────────────────────────────────────
    'Flow IAT Mean',
    'Flow IAT Std',
    'Flow IAT Max',
    'Flow IAT Min',
    'Fwd IAT Total',
    'Fwd IAT Mean',
    'Fwd IAT Std',
    'Fwd IAT Max',
    'Fwd IAT Min',
    'Bwd IAT Total',
    'Bwd IAT Mean',
    'Bwd IAT Std',
    'Bwd IAT Max',
    'Bwd IAT Min',
    # ── Header sizes ──────────────────────────────────────────────────────────
    'Fwd Header Length',
    'Bwd Header Length',
    # ── Packet rates ──────────────────────────────────────────────────────────
    'Fwd Packets/s',
    'Bwd Packets/s',
    # ── Packet length stats ───────────────────────────────────────────────────
    'Packet Length Min',
    'Packet Length Max',
    'Packet Length Mean',
    'Packet Length Std',
    'Packet Length Variance',
    # ── TCP flags (per-direction + aggregate) ─────────────────────────────────
    'Fwd PSH Flags',
    'Bwd PSH Flags',
    'Fwd URG Flags',
    'FIN Flag Count',
    'SYN Flag Count',
    'RST Flag Count',
    'PSH Flag Count',
    'ACK Flag Count',
    'URG Flag Count',
    'ECE Flag Count',
    # ── Ratio / derived ───────────────────────────────────────────────────────
    'Down/Up Ratio',
    'Average Packet Size',
    'Fwd Segment Size Avg',         # col 62 — note reversed word order
    'Bwd Segment Size Avg',         # col 63
    # ── Bulk metrics (col names are reversed vs what I assumed) ───────────────
    'Fwd Bytes/Bulk Avg',           # col 64
    'Fwd Packet/Bulk Avg',          # col 65
    'Fwd Bulk Rate Avg',            # col 66
    'Bwd Bytes/Bulk Avg',           # col 67
    'Bwd Packet/Bulk Avg',          # col 68
    'Bwd Bulk Rate Avg',            # col 69
    # ── Sub-flow ──────────────────────────────────────────────────────────────
    'Subflow Fwd Packets',
    'Subflow Fwd Bytes',
]

N_FEATURES = len(FEATURE_NAMES)
assert N_FEATURES == 60, f"Expected 60 features, got {N_FEATURES}"

# ── Paths ─────────────────────────────────────────────────────────────────────

CICIDS2017_ROOT = Path('data/raw/CICIDS2017_improved')
CICIDS2018_ROOT = Path('data/raw/CSECICIDS2018_improved')
FEATURES_DIR    = Path('data/features')
PARQUET_PATH    = FEATURES_DIR / 'flows.parquet'
CHUNKS_DIR      = FEATURES_DIR / '_chunks'
PREPARED_DIR    = Path('data/prepared')

DEFAULT_MIN_PER_CLASS = 5000
CHUNKSIZE             = 50_000
FLUSH_ROWS            = 50_000


def _log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _find_csvs(*roots):
    csvs = []
    for root in roots:
        root = Path(root)
        if root.exists():
            csvs += sorted(root.glob('**/*.csv'))
    return csvs


# ── Column normaliser ─────────────────────────────────────────────────────────

def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Strip whitespace from column names (CICIDS has leading spaces)."""
    df.columns = [c.strip() for c in df.columns]
    return df


def _find_label_col(df: pd.DataFrame) -> str:
    """Locate the label column regardless of capitalisation or whitespace."""
    for candidate in ['Label', 'label', ' Label', 'LABEL']:
        if candidate in df.columns:
            return candidate
    # fuzzy fallback
    for col in df.columns:
        if 'label' in col.lower():
            return col
    raise KeyError(f"No label column found. Columns: {list(df.columns)[:10]}")


def _map_labels(series: pd.Series) -> pd.Series:
    return series.str.strip().map(ATTACK_MAP)


def _select_features(df: pd.DataFrame) -> tuple[np.ndarray, list]:
    """
    Select the 60 FEATURE_NAMES from df.
    Returns (X, feature_list_actually_used).

    Handles missing columns by substituting zeros and logs a warning.
    This keeps the feature vector at exactly 60 dims even if a CSV is missing some.
    """
    available = set(df.columns)
    missing   = [f for f in FEATURE_NAMES if f not in available]
    if missing:
        _log(f"    [WARN] Missing {len(missing)} cols: {missing[:5]}{'...' if len(missing)>5 else ''} — substituting zeros")
    cols = []
    for f in FEATURE_NAMES:
        if f in available:
            cols.append(df[f].values.astype(np.float32))
        else:
            cols.append(np.zeros(len(df), dtype=np.float32))
    X = np.stack(cols, axis=1)   # (N, 60)
    return X


def _clean(X: np.ndarray) -> np.ndarray:
    """Replace inf/-inf with 0, then clip to [-1e9, 1e9] before scaling."""
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    np.clip(X, -1e9, 1e9, out=X)
    return X


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE A — stream CICIDS CSVs → parquet chunks
# ══════════════════════════════════════════════════════════════════════════════

class _ChunkWriter:
    def __init__(self, chunks_dir: Path):
        self.dir      = chunks_dir
        self.buf_X:  list = []
        self.buf_y:  list = []
        self.chunk_id    = 0
        self.total       = 0
        self.counts      = Counter()

    def add(self, X: np.ndarray, y: list):
        for vec, lbl in zip(X, y):
            if lbl not in KEEP_LABELS:
                continue
            self.buf_X.append(vec)
            self.buf_y.append(lbl)
            self.counts[lbl] += 1
        if len(self.buf_X) >= FLUSH_ROWS:
            self._flush()

    def _flush(self):
        if not self.buf_X:
            return
        df = pd.DataFrame(np.stack(self.buf_X), columns=FEATURE_NAMES)
        df['label'] = self.buf_y
        out = self.dir / f'chunk_{self.chunk_id:07d}.parquet'
        df.to_parquet(out, index=False)
        self.chunk_id += 1
        self.total    += len(self.buf_X)
        self.buf_X.clear()
        self.buf_y.clear()
        del df
        gc.collect()

    def finish(self):
        self._flush()


def stream_to_parquet(cicids2017_root, cicids2018_root):
    FEATURES_DIR.mkdir(parents=True, exist_ok=True)
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)
    for p in CHUNKS_DIR.glob('*.parquet'):
        p.unlink()
    if PARQUET_PATH.exists():
        PARQUET_PATH.unlink()

    csvs = _find_csvs(cicids2017_root, cicids2018_root)
    if not csvs:
        raise FileNotFoundError(
            f"No CSV files found in:\n  {cicids2017_root}\n  {cicids2018_root}\n"
            "Please download CICIDS2017/2018 improved datasets and place them there."
        )

    _log(f"Found {len(csvs)} CSV files across both datasets")
    writer   = _ChunkWriter(CHUNKS_DIR)
    skipped  = 0
    total_rows_read = 0

    for file_i, fpath in enumerate(csvs):
        fname = fpath.name
        file_rows = 0
        try:
            for chunk_df in pd.read_csv(fpath, chunksize=CHUNKSIZE,
                                         low_memory=False, encoding='latin-1',
                                         on_bad_lines='skip'):
                chunk_df = _normalise_columns(chunk_df)

                # Find label column
                try:
                    label_col = _find_label_col(chunk_df)
                except KeyError:
                    _log(f"  [SKIP chunk] {fname}: no label column")
                    continue

                # Map labels
                labels = _map_labels(chunk_df[label_col])
                valid  = labels.notna()

                chunk_df = chunk_df[valid]
                labels   = labels[valid].tolist()

                if len(chunk_df) == 0:
                    continue

                # Select features
                X = _select_features(chunk_df)
                X = _clean(X)

                writer.add(X, labels)
                file_rows      += len(chunk_df)
                total_rows_read += len(chunk_df)

        except Exception as e:
            _log(f"  [SKIP file] {fname}: {e}")
            skipped += 1
            continue

        _log(
            f"  [{file_i+1}/{len(csvs)}] {fname} — {file_rows:,} rows | "
            f"total kept: {writer.total + len(writer.buf_X):,} | "
            f"dist: {dict(writer.counts)}"
        )
        gc.collect()

    writer.finish()
    _log(f"\nExtraction done. {skipped} files skipped. {total_rows_read:,} rows read.")
    _log(f"Kept: {writer.total:,} flows | dist: {dict(writer.counts)}")

    if writer.total == 0:
        raise RuntimeError(
            "Zero flows extracted. Check that your CSVs have a 'Label' column "
            "and at least one label matching ATTACK_MAP."
        )

    # Merge chunks → single parquet
    chunks = sorted(CHUNKS_DIR.glob('chunk_*.parquet'))
    _log(f"Merging {len(chunks)} chunk(s) → {PARQUET_PATH}")
    BATCH = 20
    tmp_paths = []

    for start in range(0, len(chunks), BATCH):
        batch  = chunks[start:start + BATCH]
        merged = pd.concat([pd.read_parquet(p) for p in batch], ignore_index=True)
        if len(chunks) <= BATCH:
            merged.to_parquet(PARQUET_PATH, index=False)
        else:
            tp = CHUNKS_DIR / f'_m_{start:07d}.parquet'
            merged.to_parquet(tp, index=False)
            tmp_paths.append(tp)
        del merged
        gc.collect()
        for p in batch:
            p.unlink()

    if tmp_paths:
        final = pd.concat([pd.read_parquet(p) for p in tmp_paths], ignore_index=True)
        final.to_parquet(PARQUET_PATH, index=False)
        del final
        gc.collect()
        for p in tmp_paths:
            p.unlink()

    try:
        CHUNKS_DIR.rmdir()
    except Exception:
        pass

    _log(f"flows.parquet written: {writer.total:,} rows")
    return writer.counts


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE B — balance → split → scale → save
# ══════════════════════════════════════════════════════════════════════════════

def build_splits(min_per_class: int):
    _log("── Loading flows.parquet ────────────────────────────────────────────")
    df        = pd.read_parquet(PARQUET_PATH)
    n_raw     = len(df)
    raw_counts = Counter(df['label'])
    _log(f"  {n_raw:,} rows | {dict(raw_counts)}")

    # Validate every label exists with at least 200 samples
    for lbl in LABEL_ORDER:
        n = int((df['label'] == lbl).sum())
        if n < 200:
            raise ValueError(
                f"'{lbl}' has only {n} samples (need ≥ 200). "
                f"Check ATTACK_MAP or increase your dataset."
            )

    # Balance
    target = min(int(df['label'].value_counts().min()), min_per_class)
    _log(f"── Balancing to {target} per class ──────────────────────────────────")
    parts  = [
        df[df['label'] == lbl].sample(n=target, random_state=42)
        for lbl in LABEL_ORDER
    ]
    df_bal = pd.concat(parts, ignore_index=True).sample(frac=1, random_state=42)
    del df, parts
    gc.collect()

    X     = df_bal[FEATURE_NAMES].values.astype(np.float32)
    y_str = df_bal['label'].tolist()
    del df_bal
    gc.collect()

    # Split 70 / 15 / 15
    _log("── Stratified 70/15/15 split ────────────────────────────────────────")
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(
        X, y_str, test_size=0.30, stratify=y_str, random_state=42)
    X_val, X_te, y_val, y_te = train_test_split(
        X_tmp, y_tmp, test_size=0.50, stratify=y_tmp, random_state=42)
    del X, X_tmp, y_tmp
    gc.collect()
    _log(f"  Train {len(y_tr):,}  Val {len(y_val):,}  Test {len(y_te):,}")

    # Scale (fit on train only)
    _log("── RobustScaler ─────────────────────────────────────────────────────")
    scaler   = RobustScaler()
    X_tr_s   = np.clip(scaler.fit_transform(X_tr).astype(np.float32),  -10, 10)
    X_val_s  = np.clip(scaler.transform(X_val).astype(np.float32),     -10, 10)
    X_te_s   = np.clip(scaler.transform(X_te).astype(np.float32),      -10, 10)
    del X_tr, X_val, X_te
    gc.collect()

    # Encode labels
    label_map = {lbl: i for i, lbl in enumerate(LABEL_ORDER)}
    def enc(lst): return np.array([label_map[l] for l in lst], dtype=np.int64)
    y_tr_i, y_val_i, y_te_i = enc(y_tr), enc(y_val), enc(y_te)

    # Save
    _log("── Saving ───────────────────────────────────────────────────────────")
    PREPARED_DIR.mkdir(parents=True, exist_ok=True)
    np.save(PREPARED_DIR / 'X_train.npy', X_tr_s)
    np.save(PREPARED_DIR / 'X_val.npy',   X_val_s)
    np.save(PREPARED_DIR / 'X_test.npy',  X_te_s)
    np.save(PREPARED_DIR / 'y_train.npy', y_tr_i)
    np.save(PREPARED_DIR / 'y_val.npy',   y_val_i)
    np.save(PREPARED_DIR / 'y_test.npy',  y_te_i)
    with open(PREPARED_DIR / 'scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)

    meta = {
        'label_map':          label_map,
        'label_order':        LABEL_ORDER,
        'feature_names':      FEATURE_NAMES,
        'n_features':         N_FEATURES,
        'n_classes':          len(LABEL_ORDER),
        'embed_dim':          128,
        'd_model':            64,
        'n_heads':            4,
        'n_layers':           3,
        'architecture':       'FlowTransformer',
        'dataset':            'CICIDS2017+CSECICIDS2018',
        'task':               'threat_classification',
        'n_train':            len(y_tr),
        'n_val':              len(y_val),
        'n_test':             len(y_te),
        'samples_per_class':  int(target),
        'n_total_raw':        int(n_raw),
        'raw_class_counts':   {k: int(v) for k, v in raw_counts.items()},
        'scaler':             'RobustScaler',
        'clip':               '[-10,10]',
        'split':              '70/15/15',
        'seed':               42,
    }
    with open(PREPARED_DIR / 'meta.json', 'w') as f:
        json.dump(meta, f, indent=2)

    _log("─" * 68)
    _log("✅  build_dataset.py complete")
    _log(f"    X_train {X_tr_s.shape}  X_val {X_val_s.shape}  X_test {X_te_s.shape}")
    _log(f"    Classes: {label_map}")
    _log("    Next → python3 train_encoder.py --epochs 100")


# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='ThreatMatrix dataset builder — CICIDS2017 + CSECICIDS2018')
    parser.add_argument('--cicids2017-root', default=str(CICIDS2017_ROOT),
                        help='Path to CICIDS2017_improved CSVs')
    parser.add_argument('--cicids2018-root', default=str(CICIDS2018_ROOT),
                        help='Path to CSECICIDS2018_improved CSVs')
    parser.add_argument('--min-per-class', type=int, default=DEFAULT_MIN_PER_CLASS,
                        help='Max samples per class after balancing')
    parser.add_argument('--skip-extract', action='store_true',
                        help='Skip Phase A and reuse existing flows.parquet')
    args = parser.parse_args()

    if not args.skip_extract:
        _log("── Phase A: CICIDS stream-extract ───────────────────────────────────")
        stream_to_parquet(args.cicids2017_root, args.cicids2018_root)
    else:
        _log("--skip-extract: reusing flows.parquet")

    _log("── Phase B: balance → split → scale → save ──────────────────────────")
    build_splits(args.min_per_class)