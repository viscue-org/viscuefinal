"""Selective-classification and calibration metrics for gesture resolution."""

from __future__ import annotations

from math import sqrt
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)


def _wilson(successes: int, total: int, z: float = 1.959963984540054) -> list[float]:
    if total == 0:
        return [0.0, 0.0]
    proportion = successes / total
    denominator = 1 + z * z / total
    centre = proportion + z * z / (2 * total)
    margin = z * sqrt(proportion * (1 - proportion) / total + z * z / (4 * total * total))
    return [max(0.0, (centre - margin) / denominator), min(1.0, (centre + margin) / denominator)]


def _classification(y_true: np.ndarray, y_pred: np.ndarray, labels: list[Any]) -> dict[str, Any]:
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, zero_division=0
    )
    _, _, macro_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )
    per_intent = {
        str(label): {
            "precision": float(precision[index]),
            "recall": float(recall[index]),
            "f1": float(f1[index]),
            "support": int(support[index]),
        }
        for index, label in enumerate(labels)
    }
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "macro_f1": float(macro_f1),
        "per_intent": per_intent,
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
        "confusion_labels": [str(label) for label in labels],
    }


def selective_metrics(
    y_true, y_pred, accepted, *, families=None, labels=None, ood=None
) -> dict[str, Any]:
    truth = np.asarray(y_true)
    prediction = np.asarray(y_pred)
    accepted_mask = np.asarray(accepted, dtype=bool)
    if not (len(truth) == len(prediction) == len(accepted_mask)):
        raise ValueError("truth, predictions, and accepted must have equal length")
    label_order = list(labels) if labels is not None else list(dict.fromkeys(truth.tolist()))
    accepted_total = int(accepted_mask.sum())
    accepted_correct = int(np.sum((truth == prediction) & accepted_mask))
    base = _classification(truth, prediction, label_order)
    result: dict[str, Any] = {
        "overall_accuracy": base["accuracy"],
        "macro_f1": base["macro_f1"],
        "per_intent": base["per_intent"],
        "confusion_matrix": base["confusion_matrix"],
        "confusion_labels": base["confusion_labels"],
        "coverage": accepted_total / len(truth) if len(truth) else 0.0,
        "accepted_precision": accepted_correct / accepted_total if accepted_total else 0.0,
        "accepted_correct": accepted_correct,
        "accepted_total": accepted_total,
        "accepted_precision_ci95": _wilson(accepted_correct, accepted_total),
    }
    if families is not None:
        family_values = np.asarray(families)
        if len(family_values) != len(truth):
            raise ValueError("families must have the same length as truth")
        result["family"] = {}
        for family in dict.fromkeys(family_values.tolist()):
            mask = family_values == family
            result["family"][str(family)] = _classification(
                truth[mask], prediction[mask], label_order
            )
    if ood is not None:
        ood_mask = np.asarray(ood, dtype=bool)
        if len(ood_mask) != len(truth):
            raise ValueError("ood must have the same length as truth")
        count = int(ood_mask.sum())
        result["ood_false_accept_rate"] = float(np.sum(accepted_mask & ood_mask) / count) if count else 0.0
        result["ood_count"] = count
    return result


def calibration_metrics(y_true, probabilities, *, labels=None, n_bins: int = 15) -> dict[str, Any]:
    truth = np.asarray(y_true)
    probabilities = np.asarray(probabilities, dtype=float)
    if probabilities.ndim != 2 or len(probabilities) != len(truth):
        raise ValueError("probabilities must have shape [samples, classes]")
    label_order = list(labels) if labels is not None else list(range(probabilities.shape[1]))
    if probabilities.shape[1] != len(label_order):
        raise ValueError("labels must match probability columns")
    label_index = {label: index for index, label in enumerate(label_order)}
    indices = np.asarray([label_index[label] for label in truth])
    confidence = probabilities.max(axis=1)
    predicted = probabilities.argmax(axis=1)
    correct = predicted == indices
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    bins = []
    ece = 0.0
    for index in range(n_bins):
        lower, upper = edges[index], edges[index + 1]
        mask = (confidence >= lower) & ((confidence <= upper) if index == n_bins - 1 else (confidence < upper))
        count = int(mask.sum())
        if not count:
            continue
        accuracy = float(correct[mask].mean())
        average_confidence = float(confidence[mask].mean())
        ece += count / len(truth) * abs(accuracy - average_confidence)
        bins.append({"lower": float(lower), "upper": float(upper), "count": count,
                     "accuracy": accuracy, "confidence": average_confidence})
    targets = np.eye(len(label_order))[indices]
    brier = float(np.mean(np.sum((probabilities - targets) ** 2, axis=1)))
    order = np.argsort(-confidence, kind="stable")
    risk_coverage = []
    cumulative_correct = np.cumsum(correct[order])
    for count in range(1, len(truth) + 1):
        risk_coverage.append({
            "coverage": count / len(truth),
            "risk": float(1.0 - cumulative_correct[count - 1] / count),
            "threshold": float(confidence[order[count - 1]]),
        })
    return {"ece": float(ece), "brier": brier, "bins": bins, "risk_coverage": risk_coverage}
