"""
build_dataset.py  —  CAFE Phase 3: Dataset Builder  (fully streaming)
======================================================================
Peak RAM ≈ one CSV chunk at a time.  Safe for 16 GB machines.

Phase A  stream-extract
  CESNET: up to --max-cesnet-rows per file
  5G    : 50k-row pandas chunks (via extract_5g in flow_extractor.py)
  Both  : flush to parquet chunk every FLUSH_ROWS flows, then gc.collect()

Phase B  balance → split → scale → save
  RobustScaler fit on train only; clip to [-10, 10]

Usage
-----
  python3 build_dataset.py
  python3 build_dataset.py --min-per-class 1500 --max-cesnet-rows 15000
  python3 build_dataset.py --skip-extract   # reuse existing flows.parquet
"""

import argparse
import gc
import glob
import json
import os
import pickle
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import RobustScaler

sys.path.insert(0, str(Path(__file__).parent))
from flow_extractor import FEATURE_NAMES, N_FEATURES, extract_cesnet, extract_5g

# ── constants ─────────────────────────────────────────────────────────────────
KEEP_LABELS = {'browsing', 'streaming', 'video_call', 'gaming'}
LABEL_ORDER = ['browsing', 'streaming', 'video_call', 'gaming']
TRAIN_FRAC  = 0.70
VAL_FRAC    = 0.15

DEFAULT_CESNET_ROOT     = 'data/raw/cesnet_dataset'
DEFAULT_5G_ROOT         = 'data/raw/5g_traffic_dataset'
DEFAULT_MIN_PER_CLASS   = 8000
DEFAULT_WINDOW_SEC      = 5.0
DEFAULT_MAX_CESNET_ROWS = 15_000

FEATURES_DIR = Path('data/features')
PARQUET_PATH = FEATURES_DIR / 'flows.parquet'
CHUNKS_DIR   = FEATURES_DIR / '_chunks'
PREPARED_DIR = Path('data/prepared')
FLUSH_ROWS   = 20_000


def _log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _find_csvs(root):
    return sorted(glob.glob(os.path.join(root, '**', '*.csv'), recursive=True))


# ══════════════════════════════════════════════════════════════════════════════
#  Chunk-flush writer
# ══════════════════════════════════════════════════════════════════════════════

class _ChunkWriter:
    def __init__(self, chunks_dir):
        self.dir      = chunks_dir
        self.buf_X    = []
        self.buf_y    = []
        self.buf_src  = []
        self.chunk_id = 0
        self.total    = 0
        self.counts   = Counter()

    def add(self, X, y, tag):
        for vec, lbl in zip(X, y):
            if lbl not in KEEP_LABELS:
                continue
            self.buf_X.append(vec)
            self.buf_y.append(lbl)
            self.buf_src.append(tag)
            self.counts[lbl] += 1
        if len(self.buf_X) >= FLUSH_ROWS:
            self._flush()

    def _flush(self):
        if not self.buf_X:
            return
        df = pd.DataFrame(np.stack(self.buf_X), columns=FEATURE_NAMES)
        df['label']  = self.buf_y
        df['source'] = self.buf_src
        out = self.dir / f'chunk_{self.chunk_id:07d}.parquet'
        df.to_parquet(out, index=False)
        self.chunk_id += 1
        self.total    += len(self.buf_X)
        self.buf_X.clear(); self.buf_y.clear(); self.buf_src.clear()
        del df; gc.collect()

    def finish(self):
        self._flush()


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE A
# ══════════════════════════════════════════════════════════════════════════════

def stream_to_parquet(cesnet_root, g5_root, max_cesnet_rows, window_sec):
    FEATURES_DIR.mkdir(parents=True, exist_ok=True)
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)
    for p in CHUNKS_DIR.glob('*.parquet'):
        p.unlink()
    if PARQUET_PATH.exists():
        PARQUET_PATH.unlink()

    writer = _ChunkWriter(CHUNKS_DIR)

    # CESNET
    cesnet_files = _find_csvs(cesnet_root)
    _log(f"  CESNET: {len(cesnet_files)} files | max {max_cesnet_rows} rows each")
    for i, fpath in enumerate(cesnet_files):
        try:
            X, y = extract_cesnet(fpath, max_rows=max_cesnet_rows)
        except Exception as e:
            _log(f"    [SKIP] {os.path.basename(fpath)}: {e}")
            continue
        if len(y):
            writer.add(X, y, 'cesnet')
        del X, y; gc.collect()
        if (i + 1) % 10 == 0 or (i + 1) == len(cesnet_files):
            _log(f"    {i+1}/{len(cesnet_files)} | flushed {writer.total:,} | buf {len(writer.buf_X):,} | {dict(writer.counts)}")
    writer.finish()
    _log(f"  CESNET done. Flushed: {writer.total:,}")
    cesnet_n = writer.total

    # 5G — extract_5g now streams internally, no full-file load
    g5_files = _find_csvs(g5_root)
    _log(f"  5G: {len(g5_files)} files | window={window_sec}s")
    for i, fpath in enumerate(g5_files):
        try:
            X, y = extract_5g(fpath, window_sec=window_sec)
        except Exception as e:
            _log(f"    [SKIP] {os.path.basename(fpath)}: {e}")
            X, y = np.zeros((0, N_FEATURES), np.float32), []
        if len(y):
            writer.add(X, y, '5g')
        del X, y; gc.collect()
        if (i + 1) % 5 == 0 or (i + 1) == len(g5_files):
            _log(f"    {i+1}/{len(g5_files)} | flushed {writer.total:,} | buf {len(writer.buf_X):,} | {dict(writer.counts)}")
    writer.finish()
    _log(f"  5G done. 5G flows: {writer.total - cesnet_n:,}  Total: {writer.total:,}")

    # Merge chunks → single parquet (batched to avoid RAM spike)
    chunks = sorted(CHUNKS_DIR.glob('chunk_*.parquet'))
    _log(f"  Merging {len(chunks)} chunks → {PARQUET_PATH}")
    if not chunks:
        raise RuntimeError("No data extracted. Check dataset paths.")

    BATCH = 20
    tmp_paths = []
    for start in range(0, len(chunks), BATCH):
        batch = chunks[start:start + BATCH]
        dfs   = [pd.read_parquet(p) for p in batch]
        merged = pd.concat(dfs, ignore_index=True)
        del dfs; gc.collect()
        if len(chunks) <= BATCH:
            merged.to_parquet(PARQUET_PATH, index=False)
        else:
            tp = CHUNKS_DIR / f'_m_{start:07d}.parquet'
            merged.to_parquet(tp, index=False)
            tmp_paths.append(tp)
        del merged; gc.collect()
        for p in batch:
            p.unlink()

    if tmp_paths:
        dfs   = [pd.read_parquet(p) for p in tmp_paths]
        final = pd.concat(dfs, ignore_index=True)
        del dfs; gc.collect()
        final.to_parquet(PARQUET_PATH, index=False)
        n_total = len(final)
        del final; gc.collect()
        for p in tmp_paths:
            p.unlink()
    else:
        n_total = writer.total

    try:
        CHUNKS_DIR.rmdir()
    except Exception:
        pass

    _log(f"  flows.parquet: {n_total:,} rows")
    return writer.counts


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE B
# ══════════════════════════════════════════════════════════════════════════════

def build_splits(min_per_class):
    _log("── Loading flows.parquet ────────────────────────────────────────────")
    df    = pd.read_parquet(PARQUET_PATH)
    n_raw = len(df)
    counts_raw = Counter(df['label'])
    _log(f"  {n_raw:,} rows | {dict(counts_raw)}")

    for lbl in LABEL_ORDER:
        n = int((df['label'] == lbl).sum())
        if n < 200:
            raise ValueError(f"'{lbl}' has only {n} samples (need ≥ 200).")

    target = min(int(df['label'].value_counts().min()), min_per_class)
    _log(f"── Balancing to {target} per class ──────────────────────────────────")
    parts  = [df[df['label'] == lbl].sample(n=target, random_state=42) for lbl in LABEL_ORDER]
    df_bal = pd.concat(parts, ignore_index=True).sample(frac=1, random_state=42)
    del df, parts; gc.collect()

    X     = df_bal[FEATURE_NAMES].values.astype(np.float32)
    y_str = df_bal['label'].tolist()
    del df_bal; gc.collect()

    _log("── Stratified 70 / 15 / 15 split ───────────────────────────────────")
    X_train, X_tmp, y_train, y_tmp = train_test_split(
        X, y_str, test_size=1 - TRAIN_FRAC, stratify=y_str, random_state=42)
    X_val, X_test, y_val, y_test = train_test_split(
        X_tmp, y_tmp, test_size=0.5, stratify=y_tmp, random_state=42)
    del X, X_tmp, y_tmp; gc.collect()
    _log(f"  Train {len(y_train):,}  Val {len(y_val):,}  Test {len(y_test):,}")

    _log("── RobustScaler (fit on train) ──────────────────────────────────────")
    scaler    = RobustScaler()
    X_train_s = scaler.fit_transform(X_train).astype(np.float32)
    X_val_s   = scaler.transform(X_val).astype(np.float32)
    X_test_s  = scaler.transform(X_test).astype(np.float32)
    for arr in (X_train_s, X_val_s, X_test_s):
        np.clip(arr, -10, 10, out=arr)
    del X_train, X_val, X_test; gc.collect()

    label_map = {lbl: i for i, lbl in enumerate(LABEL_ORDER)}
    def enc(lst): return np.array([label_map[l] for l in lst], dtype=np.int64)
    y_train_i, y_val_i, y_test_i = enc(y_train), enc(y_val), enc(y_test)

    _log("── Saving ───────────────────────────────────────────────────────────")
    PREPARED_DIR.mkdir(parents=True, exist_ok=True)
    np.save(PREPARED_DIR / 'X_train.npy', X_train_s)
    np.save(PREPARED_DIR / 'X_val.npy',   X_val_s)
    np.save(PREPARED_DIR / 'X_test.npy',  X_test_s)
    np.save(PREPARED_DIR / 'y_train.npy', y_train_i)
    np.save(PREPARED_DIR / 'y_val.npy',   y_val_i)
    np.save(PREPARED_DIR / 'y_test.npy',  y_test_i)
    with open(PREPARED_DIR / 'scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)

    meta = {
        'label_map':          label_map,
        'label_order':        LABEL_ORDER,
        'feature_names':      FEATURE_NAMES,
        'n_features':         N_FEATURES,
        'n_classes':          len(LABEL_ORDER),
        'n_train':            int(len(y_train)),
        'n_val':              int(len(y_val)),
        'n_test':             int(len(y_test)),
        'samples_per_class':  int(target),
        'n_total_raw':        int(n_raw),
        'raw_class_counts':   {k: int(v) for k, v in counts_raw.items()},
        'class_counts_train': {l: int((y_train_i==i).sum()) for l,i in label_map.items()},
        'class_counts_val':   {l: int((y_val_i  ==i).sum()) for l,i in label_map.items()},
        'class_counts_test':  {l: int((y_test_i ==i).sum()) for l,i in label_map.items()},
        'scaler': 'RobustScaler', 'clip': '[-10,10]', 'split': '70/15/15', 'seed': 42,
    }
    with open(PREPARED_DIR / 'meta.json', 'w') as f:
        json.dump(meta, f, indent=2)

    _log("─" * 68)
    _log("✅  build_dataset.py complete")
    _log(f"    X_train {X_train_s.shape}  X_val {X_val_s.shape}  X_test {X_test_s.shape}")
    _log(f"    label_map: {label_map}")
    _log("    Next → python3 train_encoder.py")


# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cesnet-root',     default=DEFAULT_CESNET_ROOT)
    parser.add_argument('--g5-root',         default=DEFAULT_5G_ROOT)
    parser.add_argument('--min-per-class',   type=int,   default=DEFAULT_MIN_PER_CLASS)
    parser.add_argument('--window-sec',      type=float, default=DEFAULT_WINDOW_SEC)
    parser.add_argument('--max-cesnet-rows', type=int,   default=DEFAULT_MAX_CESNET_ROWS)
    parser.add_argument('--skip-extract',    action='store_true')
    args = parser.parse_args()

    if not args.skip_extract:
        _log("── Phase A: stream-extract ───────────────────────────────────────────")
        stream_to_parquet(args.cesnet_root, args.g5_root,
                          args.max_cesnet_rows, args.window_sec)
    else:
        _log("--skip-extract: reusing flows.parquet")

    _log("── Phase B: balance → split → scale → save ──────────────────────────")
    build_splits(args.min_per_class)
