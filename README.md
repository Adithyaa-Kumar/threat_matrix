CyberSight (ThreatMatrix) 🛡️
AI-Powered Digital Footprint Intelligence & Privacy Threat Detection

CyberSight transforms raw, high-throughput network telemetry into human-understandable digital footprint intelligence. By pivoting away from traditional Deep Packet Inspection (DPI) and obfuscated security logs, CyberSight leverages a custom FlowTransformer Encoder to parse behavioral session metadata, evaluate user privacy risk, and generate immediate, natural-language mitigation workflows.
📑 Table of Contents

    The Problem vs. Our Solution

    CyberTech Challenge Alignment

    System Architecture

    AI & Machine Learning Architecture

    Core UI Elements & Live Telemetry

    Deterministic Demo Storyline

    Technical Highlights & Performance

    Project Structure

    Installation & Quickstart

🔍 The Problem vs. Our Solution
The Problem

Every connected device exchanges thousands of complex network flows daily. Standard users are completely blind to their data footprint: what external apps are calling out, where data goes geographically, or if localized background processes are subtly exfiltrating assets. Traditional enterprise monitoring software fumbles at the consumer level—swamping users with raw packet dumps, Wireshark logs, and cryptically labeled indicators that require deep domain expertise to parse.
Our Solution

CyberSight introduces a privacy-first, metadata-only network analytics window. Instead of stripping packet payloads (preserving absolute user confidentiality), CyberSight isolates 60 behavioral features across sliding time-series flow boundaries—such as forward/backward inter-arrival times (IAT), packet size variances, and packet ratios. The underlying ML engine converts these signals into localized, explainable human metrics.
🏆 CyberTech Challenge Alignment

CyberSight is explicitly engineered around the core triad of modern cybersecurity defense:

    UNDERSTAND: Users monitor their real-time behavioral data footprint via concrete user-space indicators: live external application tracking, aggregated data upload volumes, destination country tracking, and a comprehensive Privacy Score.

    DETECT: A deep-learning network sequences incoming metadata frames to isolate zero-day anomalies, malicious automated scripts, and multi-stage exploit patterns before lateral propagation occurs.

    RESPOND: Instead of raw exceptions, CyberSight outputs a dedicated tri-part response script explaining exactly What happened, Why it matters, and provides One-Click actionable UI tools (e.g., [Block Source IP], [Isolate Asset]) to neutralize threats dynamically.

🛠️ System Architecture

   [ Network Traffic Stream ]
               │
               ▼
       [ Flow Extractor ]  ──► (Aggregates 60 Behavioral Packet Features)
               │
               ▼
  [ FlowTransformer Encoder ] ──► (Generates 128-Dim Contextual Embeddings)
               │
      ┌────────┴────────┬────────────────────────┐
      ▼                 ▼                        ▼
[Classification]  [Anomaly Detection]  [Similarity Embed Search]
(RobustScaler)    (Vector Distance)     (Novel Vector Clusters)
      │                 │                        │
      └────────┬────────┴────────────────────────┘
               ▼
       [ FastAPI Backend ] ──► (State Tracking & Telemetry Translation)
               │
               ▼
     [ WebSockets Stream ] ──► (Low-Latency Reactive Binary Payload)
               │
               ▼
     [ React UI Dashboard ] ──► (Live Monitor, Footprint Map & Action Handlers)

🧠 AI & Machine Learning Architecture

The pipeline avoids traditional, static point-in-time signature checks by handling network traffic as contextual language sequences.
1. FlowTransformer Encoder

    Feature Conditioning: The ingress pipeline filters exactly 60 pre-defined network features (e.g., Flow Duration, Fwd Packet Length Std, Flow IAT Max, Bwd Packets/s).

    Pipeline Cleanliness: Outliers are clipped cleanly to [−10,10] via an upstream RobustScaler fitted strictly on training baselines to completely eliminate validation data leakage.

    Representation Learning: The sequential data runs through a 3-layer, 4-head Multi-Head Attention (MHA) Transformer network (dmodel​=64) to build high-dimensional 128-dimensional temporal sequence embeddings tracking long-range traffic dependencies.

2. Multi-Class Canonical Mapping

Embeddings feed into a tuned multi-class head mapping raw, fragmented dataset labels (e.g., DDOS attack-HOIC, SSH-Patator, Infiltration) into 6 highly stable, target canonical classes:
Output Classes={benign,ddos,dos,portscan,botnet,bruteforce}
📊 Core UI Elements & Live Telemetry

The platform drops technical noise in favor of instantaneous, highly scannable tactical telemetry:
Baseline Monitoring (CyberSight Mode)

When the network behavior is uncompromised, the interface acts as a passive guardian:

    Real-Time Flow Classification: Displays incoming system streams categorized by high-level user activities (Browsing, Gaming, Video Call, Streaming) alongside model confidence ratings.

    Privacy Risk Score: Features a unified circular telemetry visualization demonstrating behavioral baselines. It contextualizes data state transparency with simple status cards (e.g., "SAFE: Your network behaviour looks normal. No suspicious patterns detected.").

    Traffic Breakdown: Aggregates background protocols into proportional, colored distributions to easily parse background volume.

Active Attack Interception (ThreatMatrix Mode)

When automated exploit scripts are introduced, the dashboard escalates to a high-alert mitigation console:

    Volumetric Threat Tracking: Prominently indexes malicious spikes via clear counter blocks, tracking total live threats alongside latency degradation and safe traffic ratios.

    Live Attack Streams: Flags dangerous flows in red alert blocks, itemizing the precise malicious classification type (Flood attack, Bot activity, Probe detected) and severity parameters.

    Explainable Mitigation Panel: Translates model outputs directly into direct technical context (e.g., "Someone is trying to overwhelm your connection with junk traffic. -> Restart your router and contact your ISP.") to make response steps fully clear.

🎬 Deterministic Demo Storyline

To guarantee an impactful presentation format for hackathon evaluation teams, CyberSight features a deterministic test harness sequence:

    The Baseline: The session initiates in a pristine state. The interface reads 100% green: Cyber Health: 96%, showing regular safe background traffic.

    The Attack Injection: A hidden hotkey simulation script fires a tight burst of automated adversarial frames (Flood attack + Bot activity).

    Real-Time Detection: The sliding tracking window catches the anomaly. Cyber Health immediately collapses to 19% (Status: HIGH RISK).

    Explainable AI Generation: The threat panel parses the classification vector and populates consumer-actionable text blocks:

        What happened: "Someone is trying to overwhelm your connection with junk traffic."

        Why it matters: "Your bandwidth is actively being starved by volumetric exploits."

        What to do: "Restart your router and contact your ISP."

    One-Click Remediation: The presenter hits the interactive [Block Source IP] action button. The interface updates its local state cache, drops the malicious stream vectors, and the Cyber Health score safely climbs back up to 90%.

⚡ Technical Highlights & Performance

    Memory Optimized Streaming: Streams massive CSV files in deterministic 50,000-row chunks, running safely within restrictive 8 GB system RAM profiles.

    Zero Payload Snooping: Operates purely on OSI Layer 3/4 header stats, achieving absolute zero-trust user confidentiality compliance.

    Sub-10ms Inference Latency: Engineered with lightweight matrix operations guaranteeing a P99 inference cycle of ∼7.97 ms, satisfying strict real-time live monitor thresholds.

📂 Project Structure

├── data/
│   ├── raw/                 # Cleaned source CSV chunks (CICIDS2017 / 2018)
│   ├── features/            # Intermediary compiled parquet file maps
│   └── prepared/            # Downstream scaled .npy vectors, scaler.pkl, meta.json
├── server/
│   ├── main.py              # FastAPI core app engine handling WebSockets
│   └── tracker.py           # Stateful translation manager (Telemetry Translator)
├── frontend/
│   src/components/          # Live Monitor panels, Privacy Score cards & Alert feeds
├── build_dataset.py         # Stream-reads, normalizes, scales, and balances datasets
├── train_encoder.py         # Formulates custom multi-head FlowTransformer embeddings
└── live_demo.py             # Streaming simulation replay traffic engine

🚀 Installation & Quickstart
1. Data Preparation Pipeline

Isolate raw files inside data/raw/ and compile the balanced, scaled dataset splits:
Bash

# Clean, balance, scale, and output local matrix files
python3 build_dataset.py --min-per-class 5000

# Optimization pass: Bypass extraction if flows.parquet is already local
python3 build_dataset.py --skip-extract

2. Launch the Backend Server Array

Spin up the FastAPI data streamer:
Bash

cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

Launch the web monitor client console:
Bash

cd frontend
npm install
npm run start

    Note on Contributions: We welcome pull requests and feature extensions to our explainable core. For major architectural modifications, please open an issue first to discuss your proposals.