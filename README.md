<div align="center">

# CAFE — Context-Aware Flow Embeddings
### Adaptive AI-Based Network Traffic Classification

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C?logo=pytorch)](https://pytorch.org)
[![CUDA](https://img.shields.io/badge/CUDA-12.1-76B900?logo=nvidia)](https://developer.nvidia.com/cuda-toolkit)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen)]()

**Real-time, DPI-free classification of encrypted network traffic using contrastive embedding learning.**

[Overview](#overview) · [Results](#results) · [Architecture](#architecture) · [Datasets](#datasets) · [Setup](#setup) · [Usage](#usage) · [Live Demo](#live-demo)

---

| KPI | Target | Achieved |
|-----|--------|----------|
| Classification Accuracy | ≥ 90% | **94.04%** ✅ |
| Intra-class Cosine Similarity | > 0.70 | **0.914** ✅ |
| Inter-class Cosine Similarity | < 0.30 | **0.173** ✅ |
| Inference Latency (P99) | < 100ms | **2.7ms** ✅ |

</div>

---

## Overview

Over **80% of internet traffic is now encrypted** (TLS 1.3, QUIC). Traditional classifiers rely on Deep Packet Inspection — which is defeated by encryption, computationally expensive, and illegal under GDPR.

**CAFE** solves this by learning *behavioural embeddings* from flow-level statistics — packet timing, inter-arrival times, jitter, RTT, and packet-size distributions — without ever touching payload bytes.

### How it works

```
Raw Packets (tshark / CESNET / Wireshark CSV)
        ↓
Universal Feature Extractor  →  60-feature behavioural vector
        ↓
FlowTransformer Encoder      →  128-dim L2-normalised embedding
        ↓
Contrastive Loss Training    →  Similar traffic clusters together
        ↓
k-NN / SVM Classifier        →  Traffic class + confidence score
        ↓
Result: < 3ms  ·  94% accuracy  ·  No DPI required
```

### Key capabilities

- **DPI-free** — classifies encrypted TLS 1.3 and QUIC traffic with no payload access
- **Real-time** — full pipeline P99 latency of 2.7ms (37× faster than the 100ms target)
- **Source-agnostic** — one extractor handles CESNET PPI sequences, Wireshark CSVs, and live tshark captures
- **Zero-shot extension** — new traffic types added via embedding prototype registration, no retraining needed
- **Live demo** — classifies Windows browser traffic in real time via tshark on WSL2

---

## Results

### Embedding Space Visualisation (t-SNE)

The FlowTransformer learns to separate traffic types in 128-dimensional space. t-SNE projection shows clean clusters across all four classes.

```
browsing ●    gaming ■    streaming ▲    video_call ◆

  Each class forms a tight, well-separated cluster.
  Intra-class sim: 0.914   Inter-class sim: 0.173
```

> *Add your t-SNE plot image here: `results/tsne_final.png`*

### Per-Class Performance

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| 🎮 Gaming | 0.98 | 0.98 | **0.98** | 1,200 |
| 📹 Video Call | 0.96 | 0.96 | **0.96** | 1,200 |
| 📺 Streaming | 0.92 | 0.92 | **0.92** | 1,201 |
| 🌐 Browsing | 0.91 | 0.90 | **0.91** | 1,200 |
| **Overall** | **0.94** | **0.94** | **0.94** | **4,801** |

### Training Convergence

| Epoch | Accuracy | Intra-class Sim | Inter-class Sim |
|-------|----------|-----------------|-----------------|
| 1 | 33.65% | 0.996 | 0.995 |
| 50 | 88.15% | 0.958 | 0.728 |
| 100 | 92.40% | 0.948 | 0.396 |
| 200 | 93.10% | 0.924 | 0.228 |
| 300 | **93.81%** | **0.914** | **0.173** |

Inter-class similarity dropped below the 0.3 target at epoch 140 and converged to **0.173** — demonstrating effective contrastive separation.

### Latency Benchmark

| Metric | Value |
|--------|-------|
| Mean inference | 0.99ms |
| P95 latency | 2.1ms |
| P99 latency | **2.7ms** |
| Target | < 100ms |
| Speedup | **37×** faster than target |

Hardware: NVIDIA GeForce RTX 3050 6GB Laptop GPU

---

## Architecture

### FlowTransformer Encoder

```
Input: 60 scalar features per flow
         │
         ▼
FeatureEmbedding:  Linear(1 → 64) per feature
                   → 60 tokens × 64-dim each
         │
         ▼
Positional Encoding (learnable, 60 × 64)
         │
         ▼
Transformer Encoder ×3 layers:
  ├─ Multi-Head Self-Attention (4 heads, d=64)
  ├─ Feed-Forward Network (FFN=256, GELU activation)
  ├─ Pre-norm LayerNorm
  └─ Dropout (p=0.1)
         │
         ▼
Global Mean Pooling  →  64-dim vector
         │
         ▼
Projection Head:  Linear(64 → 256) → GELU → Linear(256 → 128)
         │
         ▼
L2 Normalisation  →  128-dim unit-sphere embedding

Total parameters: 178,880
```

### Training Objective

```
Loss = 0.3 × SupCon(T=0.05)  +  0.5 × CrossEntropy  +  0.2 × Margin(0.20)

SupCon:   pulls same-class embeddings together on the unit sphere
CE:       ensures discriminative classification boundaries
Margin:   explicitly penalises inter-class pairs with similarity > 0.20
```

### 60-Feature Vector Composition

| Group | Count | Features |
|-------|-------|----------|
| **Timing** | 12 | IAT mean, std, min, max, CV · jitter · RTT estimate · skewness |
| **Volume** | 6 | packet count · total bytes · duration · pkt rate · byte rate · bytes/pkt |
| **Packet Size Histograms** | 16 | 8 log-scale bins × 2 directions (client→server, server→client) |
| **Inter-Packet Time Histograms** | 16 | 8 log-scale bins × 2 directions |
| **Directionality** | 10 | fwd ratio · byte asymmetry · dir changes · burst score · TCP flags |
| **Total** | **60** | All extracted without payload access |

---

## Datasets

### 1. 5G Traffic Dataset
- **Source:** [Kaggle — kimdaegyeom](https://www.kaggle.com/datasets/kimdaegyeom/5g-traffic-datasets)
- **Size:** 75 Wireshark CSV packet captures (~190k flows extracted)
- **Classes:** Streaming, Gaming, Video Conferencing, Metaverse/XR
- **Why used:** Real 5G Korean network captures with protocol-level diversity (QUIC, RakNet, RTCP, TLS 1.3)

### 2. CESNET Advanced Flow Dataset
- **Source:** CESNET3 ISP Backbone Network, August 2022
- **Size:** 72 hourly CSV files (~4.5M flows available)
- **Classes:** Browsing, Streaming, Gaming, Video Call, Cloud
- **Why used:** Large-scale real ISP traffic with PPI per-packet sequences — actual timestamps, packet lengths, and flow directions for rich feature extraction

### 3. Live Capture (Manual)
- **Tool:** tshark on WSL2 (eth0 interface)
- **Traffic:** YouTube, online gaming, Zoom, browser navigation from Windows Chrome
- **Purpose:** Validates model on real encrypted production traffic outside training distribution

---

## Setup

### Prerequisites

```bash
# Python 3.12 + CUDA 12.x
# WSL2 (for live capture on Windows)
```

### Installation

```bash
git clone https://github.com/Adithyaa-Kumar/cafe-flow-embeddings.git
cd cafe-flow-embeddings

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install scikit-learn pandas numpy matplotlib tqdm pyarrow
pip install scapy dpkt  # for live capture
```

### Download Datasets

```bash
# 5G Kaggle dataset
pip install kaggle
kaggle datasets download -d kimdaegyeom/5g-traffic-datasets
unzip 5g-traffic-datasets.zip -d data/raw/5g_traffic/

# CESNET dataset
# Download from: https://data.cesnet.cz/
# Place in: data/raw/cesnet_dataset/
```

---

## Usage

### Step 1 — Build Dataset

```bash
python3 build_dataset.py
```

Extracts 60-feature vectors from both datasets, balances classes, applies RobustScaler, and creates train/val/test splits.

```
Output:
  data/prepared/X_train.npy   (22,399 × 60)
  data/prepared/X_val.npy     (4,800 × 60)
  data/prepared/X_test.npy    (4,801 × 60)
  data/prepared/meta.json
```

### Step 2 — Train Encoder

```bash
# Standard training (recommended)
python3 train_encoder.py --epochs 300 --lr 3e-4 \
  --w-sc 0.3 --w-ce 0.5 --w-mg 0.2 \
  --margin 0.20 --temp 0.05

# Quick training (fewer epochs)
python3 train_encoder.py --epochs 150 --batch 512
```

Training prints live KPIs every 5 epochs:

```
  Ep   loss   val_acc    intra    inter     gap
  140  1.567  0.9256✅   0.939✅   0.299✅   0.640
  165  1.524  0.9352✅   0.939✅   0.264✅   0.675
  300  1.462  0.9323✅   0.909✅   0.151✅   0.758
```

### Step 3 — Evaluate

```bash
python3 evaluate.py
```

Generates full KPI report, t-SNE plot, confusion matrix, and per-class breakdown.

### Step 4 — Live Demo

```bash
# Replay test data (no root needed — works anywhere)
python3 live_demo.py --replay

# Fast mode for presentation
python3 live_demo.py --replay --fast

# Live capture (requires tshark + WSL2/Linux)
sudo python3 live_demo.py --live --iface eth0
```

---

## Live Demo

The terminal dashboard classifies flows in real time with confidence scores and latency stats:

```
╔══════════════════════════════════════════════════════════════╗
║     CAFE — Real-Time Encrypted Traffic Classification        ║
╚══════════════════════════════════════════════════════════════╝

  ● LIVE  |  Flow #847  |  14:32:07

  TIME       CLASS          CONFIDENCE            LATENCY
  ─────────────────────────────────────────────────────────
  14:32:05  📺 streaming    ████████████████  98%    1.2ms
  14:32:05  🎮 gaming       ████████████████  97%    0.9ms
  14:32:06  📹 video_call   ████████████████  99%    1.1ms
  14:32:06  🌐 browsing     ████████████░░░░  82%    1.4ms
  14:32:07  📺 streaming    ████████████████  96%    1.0ms

  SESSION STATS
  ────────────────────────────────────────
  Total flows : 847    Avg latency : 1.1ms    P99 : 2.7ms

  📺 streaming    352   41.6%  ██████████████████████
  🎮 gaming       289   34.1%  ████████████████████
  📹 video_call   148   17.5%  ██████████
  🌐 browsing      58    6.8%  ████
```

---

## Project Structure

```
cafe-flow-embeddings/
│
├── build_dataset.py        # Dataset pipeline: extract → normalise → split
├── train_encoder.py        # FlowTransformer training with SupCon + Margin loss
├── evaluate.py             # Full KPI evaluation + t-SNE + confusion matrix
├── live_demo.py            # Real-time terminal dashboard
│
├── data/
│   ├── raw/                # Raw dataset files (not committed)
│   │   ├── 5g_traffic/
│   │   └── cesnet_dataset/
│   ├── features/           # Extracted flow parquet files
│   └── prepared/           # Train/val/test numpy arrays + meta.json
│
├── models/
│   ├── encoder_best.pt     # Best FlowTransformer checkpoint
│   ├── clf_head.pt         # Classifier head weights
│   ├── knn_classifier.pkl  # Fitted k-NN classifier
│   ├── svm_classifier.pkl  # Fitted SVM classifier
│   └── meta.json           # Model config (features, classes, architecture)
│
├── results/
│   ├── tsne_final.png      # Embedding cluster visualisation
│   ├── training_curves.png # Loss + accuracy + cosine KPI curves
│   ├── confusion_matrix.png
│   └── kpi_report.txt      # Full numeric KPI summary
│
└── requirements.txt
```

---

## Comparison with Prior Work

| System          | DPI-Free | Encrypted | Real-Time | Embeddings | New Classes |
|-----------------|----------|-----------|-----------|------------|-------------|
| nPrintML        | ❌       | ❌       | ⚠️        | ❌        | ❌          |
| FlowPic         | ✅       | ⚠️       | ⚠️        | ❌        | ❌          | 
| CESNET-TLS22    | ✅       | ✅       | ⚠️        | ❌        | ❌          |
| PacketCLIP      | ✅       | ✅       | ❌        | ✅        | ❌          |
| **CAFE (ours)** | ✅       | ✅       | ✅        | ✅        | ✅          |

CAFE is the only system that is simultaneously DPI-free, encrypted-traffic native, real-time capable, embedding-based, and extensible to new traffic classes without retraining.

---

## Hardware

| Component | Spec |
|-----------|------|
| GPU | NVIDIA GeForce RTX 3050 6GB Laptop |
| RAM | 16GB DDR5 |
| OS | Ubuntu 22.04 (WSL2 on Windows 11) |
| CUDA | 12.1 |
| Python | 3.12 |
| Training time | ~45 minutes (300 epochs) |

---

## Citation

If you use CAFE in your research or project, please cite:

```bibtex
@misc{cafe2025,
  title   = {CAFE: Context-Aware Flow Embeddings for Adaptive AI-Based Network Traffic Classification},
  author  = {Harshita K and Adithyaa K},
  year    = {2025},
  school  = {VIT Chennai},
  note    = {National Level Hackathon Project}
}
```

---

## Acknowledgements

- [Khosla et al. (2020)](https://arxiv.org/abs/2004.11362) — Supervised Contrastive Learning (SupCon loss)
- [CESNET](https://www.cesnet.cz/) — Advanced Flow Dataset
- [kimdaegyeom](https://www.kaggle.com/datasets/kimdaegyeom/5g-traffic-datasets) — 5G Traffic Dataset

---
Built with PyTorch · Trained on RTX 3050 · No payload bytes harmed

