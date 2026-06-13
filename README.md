# NetGuard: AI-Powered Network Privacy & Anomaly Detection System

NetGuard is a futuristic, full-stack network monitoring dashboard and deep learning pipeline. It is engineered to perform real-time traffic classification and cryptographic anomaly detection using metadata-driven features (packet timings, sizes, and directional frequencies) rather than deep packet inspection (DPI)—preserving user privacy while identifying active security risks.

The system processes large-scale data structures (such as the 5G Traffic Dataset and CESNET framework) through a multi-stage machine learning architecture and streams inferences natively to a responsive, cyberpunk-inspired terminal HUD.

---

## 🛰️ System Architecture Overview

NetGuard is split cleanly into a decoupled, data-driven Python backend pipeline and an optimized React frontend architecture:

    [ Raw Network Traffic ] -> (scapy / Live Capture)
               │
               ▼
     [ flow_extractor.py ]   -> Extracts 5-tuple sequence variables
               │
               ▼
    [ ML Pipeline / Models ] -> PyTorch FlowTransformer Encoder -> Classifiers (SVM / KNN)
               │
               ▼
       [ server/main.py ]    -> FastAPI Server + WebSockets Stream
               │
               ▼
      [ React Dashboard ]    -> Cyberpunk HUD / Recharts Real-Time UI

📂 Project Structure
Plaintext

.
├── data/
│   ├── raw/                      # Undistributed benchmark source logs
│   │   ├── 5g_traffic_dataset/   # App profiles (Zoom, Teams, Netflix, Roblox)
│   │   └── cesnet_dataset/       # Core historical flow sequences
│   ├── prepared/                 # Train/Val/Test matrix splits (.npy) & scaler.pkl
│   ├── captures/                 # Sample live packet trace files (.pcap)
│   └── features/                 # Extracted pipeline feature stores (.parquet/.csv)
├── models/
│   ├── encoder_best.pt           # Pre-trained PyTorch FlowTransformer model weights
│   ├── clf_head.pt               # Main neural network classification layer
│   ├── svm_classifier.pkl        # Vector machine fallback classifier
│   └── knn_classifier.pkl        # K-Nearest Neighbor similarity reference model
├── server/
│   ├── main.py                   # FastAPI application layer & WebSocket hub
│   └── requirements.txt          # Python virtual environment backend dependencies
├── frontend/
│   ├── public/                   # App mount skeleton templates (index.html)
│   ├── src/
│   │   ├── App.js                # High-level UI Router and global UI frame
│   │   ├── components.js         # Atomic HUD components (PrivacyRing, Scanlines, Tables)
│   │   ├── useNetGuard.js        # State engine hook managing active WebSocket tickers
│   │   ├── index.js              # Production React entry configuration DOM anchor
│   │   └── index.css             # Main styling layer (Neon palettes, layout matrices)
│   └── package.json              # Client dependency configurations
├── flow_extractor.py             # Feature extractor engine mapping raw packets to vectors
├── build_dataset.py              # Data alignment script converting parquet datasets
├── train_encoder.py              # PyTorch Deep Learning training loop executor
└── live_demo.py                  # Live simulation engine mimicking runtime stream inputs

⚡ Core Tech Stack

    Backend Engine: Python 3.12, PyTorch (Deep Learning Framework), Scikit-Learn, Scapy (Packet Parsing), FastAPI, Uvicorn, WatchFiles.

    Frontend UI: React 18, Recharts (Data Visualizations Engine), Native HTML5 Canvas / CSS Variables (Dynamic Glow Filters).

🛠️ Step-by-Step Installation & Setup
Prerequisites

Make sure you have Python 3.12+, Node.js (v18+), and native Linux build tools (if using WSL) configured globally on your machine.
1. Backend Server Setup

From your terminal, navigate to the root folder, spin up your environment, and pull down your system dependencies:
Bash

# Initialize and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install backend dependencies
cd server
pip install -r requirements.txt
cd ..

2. Frontend Interface Setup

Initialize Node modules and configure dependencies natively for your UI rendering:
Bash

# Navigate to the workspace layer
cd frontend

# Install client packages
npm install
cd ..

🚀 Execution Guide

To run the full-scale interactive live setup, you must launch both the backend server engine and the frontend visualizer synchronously.
Step 1: Boot Up the FastAPI Backend

Always launch the backend execution node from the root workspace directory to ensure relative component lookups (data/prepared/meta.json) resolve properly.
Bash

# Make sure you are in the root directory (~/cafe_project)
source venv/bin/activate
uvicorn server.main:app --reload --port 8000

The endpoint will spin up at: http://127.0.0.1:8000
Step 2: Boot Up the React Dashboard HUD

Open a separate secondary terminal pane, navigate to your interface path, and execute the development server compile pipeline:
Bash

cd frontend
npm start

Your browser will launch automatically at: http://localhost:3000
📡 Live Traffic Testing & Evaluation

NetGuard is capable of evaluating preprocessed historical data logs as well as live diagnostic validation checks.
Option A: Simulating Live Streams via Trace Replays (Recommended)

You can replay existing network trace snapshots (.pcap) packet-by-packet through the model directly to mimic production traffic:
Bash

python live_demo.py --input data/captures/youtube.pcap --stream-fps 10

Option B: Raw Blind Dataset Testing

To evaluate your models against a completely unseen raw file out of your dataset directory to check generalized metrics:
Bash

python flow_extractor.py --input data/raw/5g_traffic_dataset/5G_Traffic_Datasets/Video_Conferencing/Zoom/Zoom_3.csv --predict

🖥️ Dashboard Module Breakdown

Once you initialize the "BEGIN ANALYSIS" workflow routine, the UI transitions across four system viewpoints:

    LIVE MONITOR: High-frequency grid logs compiling traffic inputs. Contains real-time interactive charting components computing the intersection between overall classification accuracy and systemic risk indexes.

    DIGITAL FOOTPRINT: Cumulative usage evaluation layouts tracking overall resource utilization distributions sorted strictly by protocol classification blocks.

    THREAT FEED: Isolation queue tracking identified baseline anomalies. Includes an asynchronous structural evaluation module summarizing why structural metadata profiles triggered classification rules.

    SYSTEM INTEL: Architectural design tracking panel displaying parameters for active hidden dimension attention heads alongside live runtime execution latencies compared against operational KPIs.

⚖️ License

Distributed under the MIT License. Systems built explicitly for data auditing, networking research, and telemetry analysis applications.
