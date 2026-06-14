# 🛡️ CyberSight (ThreatMatrix)

### AI-Powered Digital Footprint Intelligence & Privacy Threat Detection

> **Understand your digital footprint. Detect threats. Respond with confidence.**

CyberSight transforms raw network telemetry into human-readable security intelligence. Instead of overwhelming users with packet captures, firewall logs, and cryptic alerts, CyberSight uses AI-powered behavioral analysis to explain what is happening on a device, why it matters, and what action should be taken.

Built using FlowTransformer embeddings, anomaly detection, FastAPI, React, and explainable AI, CyberSight makes cybersecurity accessible to everyone—not just security professionals.

---

## 📑 Table of Contents

* The Problem
* Our Solution
* CyberTech Challenge Alignment
* System Architecture
* AI & Machine Learning Architecture
* Core Features
* Demo Workflow
* Technical Highlights
* Project Structure
* Installation & Quick Start

---

# 🚨 The Problem

Every connected device generates thousands of network interactions every day.

Most users have little visibility into:

* Which applications are communicating externally
* How much data is leaving their device
* Whether suspicious activity is occurring in the background
* If their privacy is being compromised

Traditional cybersecurity tools are designed for analysts and security engineers. They expose packet captures, IDS alerts, and protocol-level telemetry that require specialized expertise to interpret.

As a result, many threats remain unnoticed until significant damage has already occurred.

---

# 💡 Our Solution

CyberSight provides a privacy-first intelligence layer for network activity.

Instead of inspecting packet contents, CyberSight analyzes behavioral metadata such as:

* Flow duration
* Packet timing
* Traffic directionality
* Communication frequency
* Statistical network patterns

This approach preserves user privacy while still enabling advanced threat detection.

CyberSight converts these signals into:

* 📊 Digital Footprint Intelligence
* 🛡️ Cyber Health Scoring
* 🚨 Real-Time Threat Alerts
* 🧠 Explainable Threat Analysis
* ⚡ Actionable Mitigation Recommendations

Users no longer need cybersecurity expertise to understand cybersecurity risks.

---
<img width="1918" height="912" alt="Screenshot 2026-06-14 013133" src="https://github.com/user-attachments/assets/580443d5-012c-4b3b-b568-7bc3a46f626d" />

# 🏆 CyberTech Challenge Alignment

CyberSight directly addresses the three pillars of modern cybersecurity:

## 👁️ Understand

Users gain visibility into their digital footprint through:

* Live traffic monitoring
* Behavioral activity tracking
* Privacy risk indicators
* Cyber Health scoring
<img width="413" height="743" alt="Screenshot 2026-06-14 013215" src="https://github.com/user-attachments/assets/f2eaa87e-9d22-4bfb-bb8f-fe82277e0ed0" />

## 🔍 Detect

AI-powered behavioral models identify:

* Botnet activity
* Port scanning
* Brute-force attacks
* DoS/DDoS attacks
* Suspicious anomalies

before they escalate into major incidents.
<img width="982" height="736" alt="Screenshot 2026-06-14 013324" src="https://github.com/user-attachments/assets/859bba90-e306-467b-9901-941d2f32219b" />

## ⚡ Respond

Every detected threat is translated into plain English and paired with:

* Threat explanations
* Risk assessments
* Recommended actions
* One-click mitigation controls

allowing users to respond confidently instead of guessing what an alert means.
<img width="1918" height="575" alt="Screenshot 2026-06-14 013416" src="https://github.com/user-attachments/assets/140f4b40-f21d-4b9a-9f32-4ed52636e73e" />

---

# 🏗️ System Architecture

```text
Network Traffic Stream
          │
          ▼
    Flow Extractor
 (60 Behavioral Features)
          │
          ▼
 FlowTransformer Encoder
 (128D Embeddings)
          │
 ┌────────┼───────────────┐
 │        │               │
 ▼        ▼               ▼
Classification   Anomaly Detection   Similarity Search
          │
          ▼
     FastAPI Backend
          │
          ▼
    WebSocket Stream
          │
          ▼
    React Dashboard
 ┌────────┬────────┬────────┐
 ▼        ▼        ▼        ▼
Live    Digital  Threat   System
Monitor Footprint Feed    Intel
```

---

# 🧠 AI & Machine Learning Architecture

CyberSight treats network behavior as a sequence-learning problem rather than relying on static signatures or payload inspection.

## Feature Extraction

Each network flow is represented using 60 metadata-based features including:

* Flow Duration
* Packet Length Statistics
* Flow Inter-Arrival Times (IAT)
* Packet Ratios
* Throughput Metrics
* Directional Communication Patterns

## Data Conditioning

The pipeline uses:

* RobustScaler normalization
* Outlier clipping
* Leakage-safe train/validation separation

to ensure stable model performance.

## FlowTransformer Encoder

The processed feature sequence is passed through a custom Transformer architecture:

* 3 Transformer Layers
* 4 Multi-Head Attention Heads
* Hidden Dimension: 64
* Embedding Dimension: 128

This allows CyberSight to learn long-range behavioral dependencies and temporal attack patterns.

## Traffic Classification

The generated embeddings are mapped into six canonical security classes:

```text
Benign
DDoS
DoS
Port Scan
Botnet
Brute Force
```

This provides a consistent threat taxonomy across multiple cybersecurity datasets.

---

# 📊 Core Features

## 👁️ Live Monitor

Real-time traffic classification showing:

* Active network behavior
* Confidence scores
* Threat counters
* System health indicators

---

## 🌐 Digital Footprint

Provides visibility into:

* Device activity
* Traffic categories
* Privacy exposure
* Behavioral patterns

---

## 🚨 Threat Feed

Generates explainable security alerts:

### What Happened?

A plain-language description of detected activity.

### Why It Matters?

Context explaining the potential impact.

### Recommended Action

Actionable guidance for mitigation.

---

## 🛡️ Cyber Health Score

Aggregates behavioral indicators into a simple security metric:

```text
Cyber Health: 92/100
Status: LOW RISK
```

---

# 🎬 Demo Workflow

CyberSight includes a deterministic demonstration mode for reliable presentations.

### Phase 1 — Normal Operation

* Cyber Health: 96%
* Safe traffic dominates activity
* No active threats detected

### Phase 2 — Attack Injection

Simulated attack traffic introduces:

* Botnet activity
* Port scanning
* Volumetric flood traffic

### Phase 3 — Detection

CyberSight automatically:

* Detects abnormal behavior
* Generates threat explanations
* Updates Cyber Health Score
* Displays mitigation recommendations

### Phase 4 — Response

The user applies:

```text
Block Source IP
```

The malicious activity is filtered from the active stream and Cyber Health recovers, demonstrating the complete:

```text
Understand
    ↓
Detect
    ↓
Respond
```

workflow.

---

# ⚡ Technical Highlights

### Privacy-First Design

* No Deep Packet Inspection
* No payload collection
* Metadata-only behavioral analysis

### Real-Time Performance

* Sub-10ms inference latency
* Live WebSocket streaming
* Low-overhead deployment architecture

### Efficient Processing

* Chunked dataset processing
* Memory-optimized pipelines
* Commodity hardware support

### Explainable Security Intelligence

* Human-readable threat explanations
* Transparent risk scoring
* Actionable recommendations

---

# 📂 Project Structure

```text
CyberSight
├── data/
│   ├── raw/
│   ├── features/
│   └── prepared/
│
├── server/
│   ├── main.py
│   └── tracker.py
│
├── frontend/
│   └── src/
│       ├── App.js
│       ├── components.js
│       ├── useNetGuard.js
│       └── index.css
│
├── models/
│   ├── encoder_best.pt
│   ├── svm_classifier.pkl
│   └── knn_classifier.pkl
│
├── build_dataset.py
├── train_encoder.py
├── flow_extractor.py
└── live_demo.py
```

---

# 🚀 Installation & Quick Start

## Prerequisites

* Python 3.10+
* Node.js 18+
* npm
* Git

## Backend Setup

```bash
python3 -m venv venv
source venv/bin/activate

cd server
pip install -r requirements.txt
cd ..
```

## Frontend Setup

```bash
cd frontend
npm install
cd ..
```

## Prepare Dataset

```bash
python3 build_dataset.py --min-per-class 5000
```

Skip extraction if features already exist:

```bash
python3 build_dataset.py --skip-extract
```

## Start Backend

```bash
source venv/bin/activate
uvicorn server.main:app --reload --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

## Start Frontend

```bash
cd frontend
npm start
```

Frontend:

```text
http://localhost:3000
```

## Run Live Demo

```bash
python live_demo.py
```

---

# 🛠️ Technology Stack

### Backend

* Python
* FastAPI
* PyTorch
* Scikit-Learn
* Scapy

### Frontend

* React
* Recharts
* WebSockets

### Machine Learning

* FlowTransformer
* Similarity Search
* Anomaly Detection
* Multi-Class Classification

---

# 🤝 Contributing

Contributions, feature requests, and improvements are welcome.

For major architectural changes, please open an issue first to discuss the proposed design and implementation.

---

# 📄 License

Released under the MIT License.

---

# 🌍 Impact

CyberSight demonstrates how advanced AI and cybersecurity techniques can be transformed into accessible tools that help users understand, detect, and respond to digital threats in real time.

By combining behavioral intelligence, privacy-preserving analytics, and explainable AI, CyberSight makes cybersecurity actionable rather than intimidating.
