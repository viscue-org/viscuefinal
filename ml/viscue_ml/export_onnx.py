"""Export trained GestureFusionModel to ONNX and generate calibration metadata."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
import torch
import torch.nn.functional as F

from .data import GestureDataset
from .models.fusion import GestureFusionModel
from .train import INTENTS, TorchGestureDataset


def export_to_onnx(
    checkpoint_path: str | Path,
    output_onnx_path: str | Path,
    calibration_output_path: str | Path,
    manifest_path: str | Path | None = None,
) -> dict[str, Any]:
    checkpoint_path = Path(checkpoint_path).resolve()
    output_onnx_path = Path(output_onnx_path).resolve()
    calibration_output_path = Path(calibration_output_path).resolve()
    output_onnx_path.parent.mkdir(parents=True, exist_ok=True)
    calibration_output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading PyTorch checkpoint from {checkpoint_path}...")
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    num_classes = len(checkpoint.get("intents", INTENTS))

    model = GestureFusionModel(num_classes=num_classes)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    dummy_inputs = (
        torch.zeros(1, 4, 128, 7, dtype=torch.float32),
        torch.zeros(1, 48, dtype=torch.float32),
        torch.zeros(1, 32, 14, dtype=torch.float32),
        torch.zeros(1, 24, dtype=torch.float32),
        torch.ones(1, 4, 128, dtype=torch.float32),
        torch.ones(1, 32, dtype=torch.float32),
    )

    print(f"Exporting ONNX model to {output_onnx_path}...")
    torch.onnx.export(
        model,
        dummy_inputs,
        str(output_onnx_path),
        input_names=["sequence", "geometry", "nodes", "context", "sequence_mask", "node_mask"],
        output_names=["logits"],
        dynamic_axes={
            "sequence": {0: "batch_size"},
            "geometry": {0: "batch_size"},
            "nodes": {0: "batch_size"},
            "context": {0: "batch_size"},
            "sequence_mask": {0: "batch_size"},
            "node_mask": {0: "batch_size"},
            "logits": {0: "batch_size"},
        },
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )

    file_size_mb = output_onnx_path.stat().st_size / (1024 * 1024)
    print(f"ONNX export succeeded! Model file size: {file_size_mb:.2f} MB")

    # Parity test
    ort_session = ort.InferenceSession(str(output_onnx_path))
    with torch.no_grad():
        torch_out = model(*dummy_inputs).numpy()
    ort_inputs = {
        "sequence": dummy_inputs[0].numpy(),
        "geometry": dummy_inputs[1].numpy(),
        "nodes": dummy_inputs[2].numpy(),
        "context": dummy_inputs[3].numpy(),
        "sequence_mask": dummy_inputs[4].numpy(),
        "node_mask": dummy_inputs[5].numpy(),
    }
    ort_out = ort_session.run(None, ort_inputs)[0]
    diff = np.max(np.abs(torch_out - ort_out))
    print(f"PyTorch vs ONNX output maximum delta: {diff:.6e}")

    # Generate calibration & acceptance thresholds
    calibration_data = {
        "schema_version": "gesture-calibration/1.0",
        "model_version": "gesture-fusion-v1",
        "intents": checkpoint.get("intents", INTENTS),
        "temperature": 1.0,
        "acceptance_threshold": 0.60,
        "abstention_threshold": 0.40,
        "input_shapes": {
            "sequence": [4, 128, 7],
            "geometry": [48],
            "nodes": [32, 14],
            "context": [24],
        },
        "metrics": {
            "val_accuracy": checkpoint.get("val_accuracy", 0.0),
            "val_macro_f1": checkpoint.get("val_macro_f1", 0.0),
            "size_mb": round(file_size_mb, 2),
        },
    }

    calibration_output_path.write_text(
        json.dumps(calibration_data, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Saved calibration metadata to {calibration_output_path}")

    return {
        "onnx_path": str(output_onnx_path),
        "calibration_path": str(calibration_output_path),
        "size_mb": file_size_mb,
        "parity_delta": float(diff),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default="ml/checkpoints/best_fusion_model.pt")
    parser.add_argument("--out-onnx", default="gesture/runtime/models/gesture-resolver-v1.onnx")
    parser.add_argument("--out-calibration", default="gesture/runtime/models/gesture-resolver-v1.calibration.json")
    args = parser.parse_args()

    export_to_onnx(
        checkpoint_path=args.checkpoint,
        output_onnx_path=args.out_onnx,
        calibration_output_path=args.out_calibration,
    )


if __name__ == "__main__":
    main()
