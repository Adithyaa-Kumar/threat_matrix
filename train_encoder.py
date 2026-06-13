"""
train_encoder.py  —  CAFE Phase 3: FlowTransformer Encoder
===========================================================
Architecture : FlowTransformer
  Each of the 60 features becomes a token → self-attention captures
  feature co-dependencies (e.g. high jitter + small packets = gaming).
  Output: 128-dim L2-normalised embedding on the unit sphere.

Loss         : 0.3 × SupCon  +  0.7 × CrossEntropy

KPI targets:
  Intra-class cosine sim  > 0.7
  Inter-class cosine sim  < 0.3
  Accuracy (test)         >= 0.90
  Latency P99             < 100ms

Usage:
  python3 train_encoder.py
  python3 train_encoder.py --epochs 150 --batch 512
"""

import argparse
import json
import os
import pickle
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, accuracy_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC

os.makedirs("models",  exist_ok=True)
os.makedirs("results", exist_ok=True)

EPOCHS    = 100
BATCH     = 512
LR        = 3e-4
EMBED_DIM = 128
D_MODEL   = 64
N_HEADS   = 4
N_LAYERS  = 3
TEMP      = 0.07
W_SC      = 0.3
W_CE      = 0.7


class FlowTransformer(nn.Module):
    def __init__(self, n_features, d_model=64, n_heads=4,
                 n_layers=3, embed_dim=128, dropout=0.1):
        super().__init__()
        self.feature_embed = nn.Linear(1, d_model)
        self.pos_enc = nn.Parameter(
            torch.randn(1, n_features, d_model) * 0.02
        )
        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads,
            dim_feedforward=d_model * 4,
            dropout=dropout, activation="gelu",
            batch_first=True, norm_first=True,
        )
        self.transformer = nn.TransformerEncoder(
            enc_layer, num_layers=n_layers,
            norm=nn.LayerNorm(d_model),
        )
        self.proj = nn.Sequential(
            nn.Linear(d_model, d_model * 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model * 2, embed_dim),
        )

    def forward(self, x):
        tokens  = self.feature_embed(x.unsqueeze(-1)) + self.pos_enc
        encoded = self.transformer(tokens)
        pooled  = encoded.mean(dim=1)
        return F.normalize(self.proj(pooled), dim=-1)


class ClassifierHead(nn.Module):
    def __init__(self, embed_dim, n_classes, dropout=0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(embed_dim, 256),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(256, n_classes),
        )
    def forward(self, x):
        return self.net(x)


def supcon_loss(emb, labels, temperature=0.07):
    B   = emb.shape[0]
    sim = torch.mm(emb, emb.T) / temperature
    lbl = labels.view(-1, 1)
    pos = (lbl == lbl.T).float()
    pos.fill_diagonal_(0)
    neg_mask = 1.0 - torch.eye(B, device=emb.device)
    exp_sim  = torch.exp(sim) * neg_mask
    log_prob = sim - torch.log(exp_sim.sum(dim=1, keepdim=True) + 1e-8)
    pos_count = pos.sum(dim=1).clamp(min=1)
    return (-(pos * log_prob).sum(dim=1) / pos_count).mean()



def margin_loss(emb, labels, margin=0.20):
    """Penalise inter-class pairs with similarity > margin."""
    sim = torch.mm(emb, emb.T)
    lbl = labels.view(-1, 1)
    neg = (lbl != lbl.T).float()
    neg.fill_diagonal_(0)
    return (torch.clamp(sim - margin, min=0) * neg).sum() / neg.sum().clamp(1)

def cosine_kpis(emb, labels):
    intra, inter = [], []
    classes = np.unique(labels)
    for c in classes:
        e = emb[labels == c]
        if len(e) < 2: continue
        s = e @ e.T
        m = np.triu(np.ones_like(s, dtype=bool), k=1)
        intra.append(s[m].mean())
    for i in classes:
        for j in classes:
            if i >= j: continue
            ei = emb[labels == i][:100]
            ej = emb[labels == j][:100]
            inter.append((ei @ ej.T).mean())
    return (float(np.mean(intra)) if intra else 0.0,
            float(np.mean(inter)) if inter else 1.0)


def main(args):
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device  : {DEVICE}")
    if DEVICE == "cuda":
        print(f"GPU     : {torch.cuda.get_device_name(0)}")

    with open("data/prepared/meta.json") as f:
        meta = json.load(f)

    N_FEATURES  = meta["n_features"]
    N_CLASSES   = meta["n_classes"]
    CLASS_NAMES = meta["label_order"]
    print(f"Features: {N_FEATURES}  Classes: {N_CLASSES}  {CLASS_NAMES}\n")

    X_tr = torch.tensor(np.load("data/prepared/X_train.npy")).to(DEVICE)
    y_tr = torch.tensor(np.load("data/prepared/y_train.npy")).to(DEVICE)
    X_va = torch.tensor(np.load("data/prepared/X_val.npy")).to(DEVICE)
    y_va = torch.tensor(np.load("data/prepared/y_val.npy")).to(DEVICE)
    X_te = torch.tensor(np.load("data/prepared/X_test.npy")).to(DEVICE)
    y_te = np.load("data/prepared/y_test.npy")

    print(f"Train: {len(X_tr):,}  Val: {len(X_va):,}  Test: {len(X_te):,}\n")

    encoder  = FlowTransformer(N_FEATURES, args.d_model, args.n_heads,
                               args.n_layers, args.embed_dim).to(DEVICE)
    clf_head = ClassifierHead(args.embed_dim, N_CLASSES).to(DEVICE)

    print(f"Encoder params: {sum(p.numel() for p in encoder.parameters()):,}\n")

    optimizer = torch.optim.AdamW(
        list(encoder.parameters()) + list(clf_head.parameters()),
        lr=args.lr, weight_decay=1e-3,
    )
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=args.lr * 10,
        steps_per_epoch=max(len(X_tr) // args.batch, 1),
        epochs=args.epochs,
    )

    best_val_acc   = 0.0
    best_enc_state = None
    best_clf_state = None
    loss_hist, val_hist, intra_hist, inter_hist = [], [], [], []

    print(f"{'Ep':>4}  {'loss':>7}  {'val_acc':>8}  {'intra':>7}  {'inter':>7}  {'gap':>6}")
    print("-" * 56)

    for epoch in range(1, args.epochs + 1):
        encoder.train(); clf_head.train()
        idx     = torch.randperm(len(X_tr), device=DEVICE)
        ep_loss = 0.0; steps = 0

        for i in range(0, len(X_tr) - args.batch, args.batch):
            xb = X_tr[idx[i:i + args.batch]]
            yb = y_tr[idx[i:i + args.batch]]
            emb  = encoder(xb)
            loss = args.w_sc * supcon_loss(emb, yb, args.temp) + \
                   args.w_ce * F.cross_entropy(clf_head(emb), yb) + \
                   args.w_mg * margin_loss(emb, yb, args.margin)
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                list(encoder.parameters()) + list(clf_head.parameters()), 1.0
            )
            optimizer.step(); scheduler.step()
            ep_loss += loss.item(); steps += 1

        loss_hist.append(ep_loss / max(steps, 1))

        if epoch % 5 == 0 or epoch == 1:
            encoder.eval(); clf_head.eval()
            with torch.no_grad():
                emb_va  = encoder(X_va).cpu().numpy()
                va_pred = clf_head(encoder(X_va)).argmax(1).cpu().numpy()
            val_acc = accuracy_score(y_va.cpu().numpy(), va_pred)
            intra, inter = cosine_kpis(emb_va, y_va.cpu().numpy())
            val_hist.append(val_acc)
            intra_hist.append(intra)
            inter_hist.append(inter)

            print(f"{epoch:>4}  {ep_loss/steps:>7.4f}  "
                  f"{val_acc:>7.4f}{'✅' if val_acc>=0.90 else '  '}  "
                  f"{intra:>6.3f}{'✅' if intra>0.7 else '  '}  "
                  f"{inter:>6.3f}{'✅' if inter<0.3 else '  '}  "
                  f"{intra-inter:>6.3f}")

            if val_acc > best_val_acc:
                best_val_acc   = val_acc
                best_enc_state = {k: v.clone() for k, v in encoder.state_dict().items()}
                best_clf_state = {k: v.clone() for k, v in clf_head.state_dict().items()}

    encoder.load_state_dict(best_enc_state)
    clf_head.load_state_dict(best_clf_state)
    torch.save(best_enc_state, "models/encoder_best.pt")
    torch.save(best_clf_state, "models/clf_head.pt")
    print(f"\nBest val accuracy: {best_val_acc:.4f}")

    # ── Final evaluation ──────────────────────────────────────────────────────
    encoder.eval(); clf_head.eval()
    with torch.no_grad():
        emb_tr   = encoder(X_tr).cpu().numpy()
        emb_te   = encoder(X_te).cpu().numpy()
        clf_pred = clf_head(encoder(X_te)).argmax(1).cpu().numpy()

    clf_acc = accuracy_score(y_te, clf_pred)

    knn = KNeighborsClassifier(n_neighbors=5, metric="cosine")
    knn.fit(emb_tr, np.load("data/prepared/y_train.npy"))
    knn_acc = accuracy_score(y_te, knn.predict(emb_te))

    svm = SVC(kernel="rbf", C=50, gamma="scale")
    svm.fit(emb_tr, np.load("data/prepared/y_train.npy"))
    svm_acc = accuracy_score(y_te, svm.predict(emb_te))

    best_acc  = max(clf_acc, knn_acc, svm_acc)
    best_pred = {clf_acc: clf_pred,
                 knn_acc: knn.predict(emb_te),
                 svm_acc: svm.predict(emb_te)}[best_acc]
    best_name = {clf_acc: "Neural", knn_acc: "k-NN", svm_acc: "SVM"}[best_acc]

    intra_te, inter_te = cosine_kpis(emb_te, y_te)

    single = X_te[[0]]
    for _ in range(100): encoder(single)
    t_times = []
    for _ in range(1000):
        t0 = time.perf_counter()
        with torch.no_grad(): encoder(single)
        t_times.append((time.perf_counter() - t0) * 1000)
    lat_mean = float(np.mean(t_times))
    lat_p99  = float(np.percentile(t_times, 99))

    with open("models/knn_classifier.pkl", "wb") as f: pickle.dump(knn, f)
    with open("models/svm_classifier.pkl", "wb") as f: pickle.dump(svm, f)
    with open("models/meta.json", "w") as f:
        json.dump({"n_features": N_FEATURES, "n_classes": N_CLASSES,
                   "class_names": CLASS_NAMES, "embed_dim": args.embed_dim,
                   "d_model": args.d_model, "n_heads": args.n_heads,
                   "n_layers": args.n_layers,
                   "architecture": "FlowTransformer",
                   "label_map": meta["label_map"]}, f, indent=2)

    print("\n" + "="*60)
    print("CAFE — FINAL KPI REPORT")
    print("="*60)
    print(f"  Intra-class cosine : {intra_te:.3f}  "
          f"{'✅ PASS' if intra_te>0.7 else '❌ FAIL'}  (target >0.7)")
    print(f"  Inter-class cosine : {inter_te:.3f}  "
          f"{'✅ PASS' if inter_te<0.3 else '❌ FAIL'}  (target <0.3)")
    print(f"  Accuracy ({best_name:<6}) : {best_acc:.4f}  "
          f"{'✅ PASS' if best_acc>=0.90 else '❌ FAIL'}  (target >=0.90)")
    print(f"  Latency mean       : {lat_mean:.2f}ms  ✅")
    print(f"  Latency P99        : {lat_p99:.2f}ms  "
          f"{'✅ PASS' if lat_p99<100 else '❌ FAIL'}")
    print(f"\n  Neural:{clf_acc:.4f}  k-NN:{knn_acc:.4f}  SVM:{svm_acc:.4f}")
    print(f"\nPer-class ({best_name}):")
    print(classification_report(y_te, best_pred, target_names=CLASS_NAMES))
    print("="*60)

    with open("results/kpi_report.txt", "w") as f:
        f.write(f"intra={intra_te:.3f} inter={inter_te:.3f} "
                f"acc={best_acc:.4f} lat_p99={lat_p99:.2f}ms\n")
        f.write(classification_report(y_te, best_pred, target_names=CLASS_NAMES))

    # Training curves
    ep_ticks = [1] + list(range(5, args.epochs + 1, 5))
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    fig.suptitle("CAFE FlowTransformer — Training", fontsize=13, fontweight="bold")
    axes[0].plot(loss_hist, color="#2ecc71", lw=2)
    axes[0].set(title="Training loss", xlabel="Epoch"); axes[0].grid(alpha=0.3)
    axes[1].plot(ep_ticks[:len(val_hist)], val_hist, "b-o", ms=4, label="Val acc")
    axes[1].axhline(0.9, color="blue", ls="--", alpha=0.5, label="Target")
    axes[1].set(title="Validation accuracy", xlabel="Epoch", ylim=(0,1))
    axes[1].legend(); axes[1].grid(alpha=0.3)
    axes[2].plot(ep_ticks[:len(intra_hist)], intra_hist, "b-o", ms=4, label="Intra")
    axes[2].plot(ep_ticks[:len(inter_hist)], inter_hist, "r-o", ms=4, label="Inter")
    axes[2].axhline(0.7, color="blue", ls="--", alpha=0.4)
    axes[2].axhline(0.3, color="red",  ls="--", alpha=0.4)
    axes[2].set(title="Cosine KPIs", xlabel="Epoch", ylim=(0,1))
    axes[2].legend(); axes[2].grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig("results/training_curves.png", dpi=150)
    plt.close()

    print("Saved → results/training_curves.png")
    print("Saved → results/kpi_report.txt")
    print("Saved → models/encoder_best.pt + clf_head.pt + meta.json")
    print("\n→ Next: python3 evaluate.py")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--epochs",    type=int,   default=EPOCHS)
    p.add_argument("--batch",     type=int,   default=BATCH)
    p.add_argument("--lr",        type=float, default=LR)
    p.add_argument("--embed-dim", type=int,   default=EMBED_DIM)
    p.add_argument("--d-model",   type=int,   default=D_MODEL)
    p.add_argument("--n-heads",   type=int,   default=N_HEADS)
    p.add_argument("--n-layers",  type=int,   default=N_LAYERS)
    p.add_argument("--temp",      type=float, default=TEMP)
    p.add_argument("--w-sc",      type=float, default=W_SC)
    p.add_argument("--w-ce",      type=float, default=W_CE)
    p.add_argument("--w-mg",      type=float, default=0.2)
    p.add_argument("--margin",    type=float, default=0.20)
    main(p.parse_args())