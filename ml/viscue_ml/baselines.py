"""Leakage probes for the frozen synthetic gesture corpus.

These deliberately weak models are audit instruments, not production models and
their scores must never be presented as production accuracy.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .data import GestureDataset


def _score(y_true, y_pred) -> dict[str, float]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
    }


def _fit_numeric(train_x, train_y, validation_x):
    model = make_pipeline(
        StandardScaler(),
        LogisticRegression(max_iter=250, random_state=0, class_weight="balanced"),
    )
    model.fit(np.asarray(train_x, dtype=np.float32), train_y)
    return model.predict(np.asarray(validation_x, dtype=np.float32))


def _metadata(record: dict[str, Any]) -> dict[str, Any]:
    provenance = record.get("simulator_provenance", {})
    scenario = provenance.get("scenario", {})
    # Intentionally forbidden at inference. Kept separate from GestureDataset's
    # public rows so this probe can reveal generator/provenance shortcuts.
    return {
        "generator_version": record.get("generator_version", "missing"),
        "geometry_version": record.get("geometry_version", "missing"),
        "mechanism_id": provenance.get("mechanism_id", "missing"),
        "template_group": provenance.get("template_group", "missing"),
        "scenario_kind": scenario.get("kind", "missing"),
        "scenario_rare": bool(scenario.get("rare", False)),
        "has_ambiguity": provenance.get("ambiguity") is not None,
    }


def _load(dataset: GestureDataset):
    rows = []
    metadata = []
    for record in dataset._iter_records():
        inputs = record["model_input"]
        rows.append({
            "geometry": inputs["geometry"],
            "context": inputs["context"],
            "label": record["ground_truth"]["intent"],
        })
        metadata.append(_metadata(record))
    return rows, metadata


def shortcut_findings(report: dict[str, dict[str, float]], *, blocking_threshold: float = 0.50):
    findings = []
    metadata = report.get("metadata-only")
    if metadata and metadata["accuracy"] >= blocking_threshold:
        findings.append({
            "code": "forbidden_metadata_shortcut", "baseline": "metadata-only",
            "blocking": True, "accuracy": metadata["accuracy"],
            "threshold": blocking_threshold,
        })
    for name in ("tool-only", "single-field-max"):
        result = report.get(name)
        if result and result["accuracy"] >= blocking_threshold:
            findings.append({
                "code": "one_field_shortcut", "baseline": name, "blocking": True,
                "accuracy": result["accuracy"], "threshold": blocking_threshold,
            })
    for name in ("primitive-only", "start/end-hit-only", "geometry-only", "context-only"):
        result = report.get(name)
        if result and result["accuracy"] >= blocking_threshold:
            findings.append({
                "code": "strong_allowed_feature_signal", "baseline": name,
                "blocking": False, "accuracy": result["accuracy"],
                "threshold": blocking_threshold,
            })
    return findings


def _single_field_probe(train, validation, train_y, validation_y):
    """Find exact repeated-value shortcuts without fitting a flexible geometry model."""
    majority = Counter(train_y.tolist()).most_common(1)[0][0]
    names = [f"geometry[{index}]" for index in range(48)] + [
        f"context[{index}]" for index in range(24)
    ]
    train_values = np.asarray(
        [row["geometry"] + row["context"] for row in train], dtype=np.float64
    )
    validation_values = np.asarray(
        [row["geometry"] + row["context"] for row in validation], dtype=np.float64
    )
    best = {"accuracy": 0.0, "macro_f1": 0.0, "feature": names[0]}
    for index, name in enumerate(names):
        counts: dict[float, Counter] = {}
        for value, label in zip(train_values[:, index], train_y, strict=True):
            counts.setdefault(float(value), Counter())[label] += 1
        lookup = {value: labels.most_common(1)[0][0] for value, labels in counts.items()}
        prediction = np.asarray([
            lookup.get(float(value), majority) for value in validation_values[:, index]
        ])
        score = _score(validation_y, prediction)
        if score["accuracy"] > best["accuracy"]:
            best = {**score, "feature": name}
    return best


def train_suspicious_baselines(
    manifest_path: str | Path, out: str | Path, *, blocking_threshold: float = 0.50
) -> dict[str, Any]:
    manifest_path = Path(manifest_path).resolve()
    out = Path(out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    train, train_metadata = _load(GestureDataset(manifest_path, split="train"))
    validation, validation_metadata = _load(GestureDataset(manifest_path, split="validation"))
    train_y = np.asarray([row["label"] for row in train])
    validation_y = np.asarray([row["label"] for row in validation])

    results: dict[str, dict[str, float]] = {}
    majority = DummyClassifier(strategy="most_frequent")
    majority.fit(np.zeros((len(train), 1)), train_y)
    results["majority"] = _score(
        validation_y, majority.predict(np.zeros((len(validation), 1)))
    )

    feature_sets = {
        "primitive-only": (
            [row["geometry"][:12] for row in train],
            [row["geometry"][:12] for row in validation],
        ),
        "tool-only": (
            [[row["context"][19]] for row in train],
            [[row["context"][19]] for row in validation],
        ),
        "start/end-hit-only": (
            [row["context"][:8] + [row["context"][23]] for row in train],
            [row["context"][:8] + [row["context"][23]] for row in validation],
        ),
        "geometry-only": (
            [row["geometry"] for row in train],
            [row["geometry"] for row in validation],
        ),
        "context-only": (
            [row["context"] for row in train],
            [row["context"] for row in validation],
        ),
    }
    for name, (train_x, validation_x) in feature_sets.items():
        results[name] = _score(
            validation_y, _fit_numeric(train_x, train_y, validation_x)
        )

    results["single-field-max"] = _single_field_probe(
        train, validation, train_y, validation_y
    )

    vectorizer = DictVectorizer(sparse=True)
    metadata_train_x = vectorizer.fit_transform(train_metadata)
    metadata_validation_x = vectorizer.transform(validation_metadata)
    metadata_model = LogisticRegression(
        max_iter=250, random_state=0, class_weight="balanced"
    )
    metadata_model.fit(metadata_train_x, train_y)
    results["metadata-only"] = _score(
        validation_y, metadata_model.predict(metadata_validation_x)
    )

    findings = shortcut_findings(results, blocking_threshold=blocking_threshold)
    report = {
        "schema_version": "suspicious-baselines/1.0",
        "synthetic_only": True,
        "production_accuracy_claim": False,
        "fit_split": "train",
        "evaluation_split": "validation",
        "protected_splits_read": False,
        "manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "sample_counts": {"train": len(train), "validation": len(validation)},
        "label_counts": {
            "train": dict(sorted(Counter(train_y.tolist()).items())),
            "validation": dict(sorted(Counter(validation_y.tolist()).items())),
        },
        "baselines": results,
        "findings": findings,
        "blocking": any(finding["blocking"] for finding in findings),
        "warning": "Synthetic validation only; these figures are not production accuracy.",
    }
    (out / "report.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--blocking-threshold", type=float, default=0.50)
    args = parser.parse_args(argv)
    report = train_suspicious_baselines(
        args.manifest, args.out, blocking_threshold=args.blocking_threshold
    )
    print(json.dumps({
        "report": str(Path(args.out).resolve() / "report.json"),
        "blocking": report["blocking"],
        "findings": report["findings"],
        "production_accuracy_claim": False,
    }, indent=2))
    return 2 if report["blocking"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
