"""Training script for GestureFusionModel on frozen dataset splits."""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score
from torch.utils.data import DataLoader, Dataset

from .data import GestureDataset
from .models.fusion import GestureFusionModel

INTENTS = [
    "select_region", "lasso_select", "apply_instruction", "connect", "move",
    "resize", "group", "emphasize", "remove", "replace",
    "point_to", "rough_layout", "crop_region", "reorder", "insert_between",
    "align", "distribute", "duplicate", "rotate", "zoom",
    "pan", "approve", "reject", "compare", "sequence",
    "flow_direction", "bracket_group", "annotate", "draw_layout", "unknown",
]
LABEL_TO_IDX = {intent: idx for idx, intent in enumerate(INTENTS)}


class TorchGestureDataset(Dataset):
    """In-memory or cached tensor dataset from GestureDataset records."""

    def __init__(self, manifest_path: str | Path, split: str):
        dataset = GestureDataset(manifest_path, split=split)
        self.records: list[dict[str, Any]] = []
        for record in dataset._iter_records():
            inputs = record["model_input"]
            truth = record["ground_truth"]
            label_name = truth.get("intent", "unknown")
            label_idx = LABEL_TO_IDX.get(label_name, LABEL_TO_IDX["unknown"])
            self.records.append({
                "sequence": np.asarray(inputs["sequence"], dtype=np.float32),
                "sequence_mask": np.asarray(inputs.get("sequence_mask", np.ones((4, 128))), dtype=np.float32),
                "geometry": np.asarray(inputs["geometry"], dtype=np.float32),
                "nodes": np.asarray(inputs["nodes"], dtype=np.float32),
                "node_mask": np.asarray(inputs.get("node_mask", np.ones(32)), dtype=np.float32),
                "context": np.asarray(inputs["context"], dtype=np.float32),
                "label": label_idx,
            })

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        item = self.records[idx]
        return {
            "sequence": torch.from_numpy(item["sequence"]),
            "sequence_mask": torch.from_numpy(item["sequence_mask"]),
            "geometry": torch.from_numpy(item["geometry"]),
            "nodes": torch.from_numpy(item["nodes"]),
            "node_mask": torch.from_numpy(item["node_mask"]),
            "context": torch.from_numpy(item["context"]),
            "label": torch.tensor(item["label"], dtype=torch.long),
        }


def collate_fn(batch: list[dict[str, Any]]) -> dict[str, torch.Tensor]:
    return {
        "sequence": torch.stack([item["sequence"] for item in batch]),
        "sequence_mask": torch.stack([item["sequence_mask"] for item in batch]),
        "geometry": torch.stack([item["geometry"] for item in batch]),
        "nodes": torch.stack([item["nodes"] for item in batch]),
        "node_mask": torch.stack([item["node_mask"] for item in batch]),
        "context": torch.stack([item["context"] for item in batch]),
        "label": torch.stack([item["label"] for item in batch]),
    }


def train_gesture_model(
    manifest_path: str | Path,
    output_dir: str | Path,
    epochs: int = 20,
    batch_size: int = 64,
    lr: float = 1e-3,
    device: str | None = None,
) -> dict[str, Any]:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    print(f"Loading training and validation datasets using device: {device}...")
    train_data = TorchGestureDataset(manifest_path, split="train")
    val_data = TorchGestureDataset(manifest_path, split="validation")
    print(f"Train samples: {len(train_data)}, Validation samples: {len(val_data)}")

    train_loader = DataLoader(train_data, batch_size=batch_size, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(val_data, batch_size=batch_size, shuffle=False, collate_fn=collate_fn)

    # Class weights for balanced loss
    labels = [r["label"] for r in train_data.records]
    counts = Counter(labels)
    total_samples = len(labels)
    num_classes = len(INTENTS)
    weights = np.ones(num_classes, dtype=np.float32)
    for idx in range(num_classes):
        c = counts.get(idx, 1)
        weights[idx] = total_samples / (num_classes * c)
    class_weights = torch.from_numpy(weights).to(device)

    model = GestureFusionModel(num_classes=num_classes).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_f1 = 0.0
    best_checkpoint_path = out / "best_fusion_model.pt"

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for batch in train_loader:
            seq = batch["sequence"].to(device)
            seq_mask = batch["sequence_mask"].to(device)
            geom = batch["geometry"].to(device)
            nodes = batch["nodes"].to(device)
            node_mask = batch["node_mask"].to(device)
            ctx = batch["context"].to(device)
            target = batch["label"].to(device)

            optimizer.zero_grad()
            logits = model(seq, geom, nodes, ctx, sequence_mask=seq_mask, node_mask=node_mask)
            loss = criterion(logits, target)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()
            total_loss += loss.item() * seq.size(0)

        scheduler.step()
        avg_train_loss = total_loss / len(train_data)

        # Validation
        model.eval()
        val_loss = 0.0
        all_preds = []
        all_targets = []
        with torch.no_grad():
            for batch in val_loader:
                seq = batch["sequence"].to(device)
                seq_mask = batch["sequence_mask"].to(device)
                geom = batch["geometry"].to(device)
                nodes = batch["nodes"].to(device)
                node_mask = batch["node_mask"].to(device)
                ctx = batch["context"].to(device)
                target = batch["label"].to(device)

                logits = model(seq, geom, nodes, ctx, sequence_mask=seq_mask, node_mask=node_mask)
                loss = criterion(logits, target)
                val_loss += loss.item() * seq.size(0)

                preds = torch.argmax(logits, dim=-1)
                all_preds.extend(preds.cpu().numpy().tolist())
                all_targets.extend(target.cpu().numpy().tolist())

        avg_val_loss = val_loss / len(val_data)
        acc = accuracy_score(all_targets, all_preds)
        macro_f1 = f1_score(all_targets, all_preds, average="macro", zero_division=0)

        print(f"Epoch [{epoch:02d}/{epochs:02d}] Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f} | Val Acc: {acc*100:.2f}% | Val Macro F1: {macro_f1*100:.2f}%")

        if macro_f1 > best_val_f1 or epoch == epochs:
            best_val_f1 = macro_f1
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_accuracy": acc,
                "val_macro_f1": macro_f1,
                "intents": INTENTS,
            }, best_checkpoint_path)

    print(f"Training complete! Best Validation Macro F1: {best_val_f1*100:.2f}%. Saved to {best_checkpoint_path}")
    return {
        "best_checkpoint": str(best_checkpoint_path),
        "best_val_macro_f1": float(best_val_f1),
        "val_accuracy": float(acc),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="datasets/gesture-smoke-v1/manifest.json")
    parser.add_argument("--out", default="ml/checkpoints")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    train_gesture_model(
        manifest_path=args.manifest,
        output_dir=args.out,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
    )


if __name__ == "__main__":
    main()
