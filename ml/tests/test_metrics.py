import numpy as np

from viscue_ml.metrics import calibration_metrics, selective_metrics


def test_selective_metrics_measure_accepted_precision_and_coverage():
    result = selective_metrics(
        [0, 1, 1, 0], [0, 1, 0, 0], [True, True, False, False],
        families=["a", "a", "b", "b"],
    )
    assert result["coverage"] == 0.5
    assert result["accepted_precision"] == 1.0
    assert result["accepted_precision_ci95"][0] < 1.0
    assert result["overall_accuracy"] == 0.75
    assert set(result["family"]) == {"a", "b"}


def test_calibration_metrics_are_zero_for_perfect_probabilities():
    probabilities = np.array([[1.0, 0.0], [0.0, 1.0]])
    result = calibration_metrics([0, 1], probabilities, labels=[0, 1], n_bins=2)
    assert result["ece"] == 0.0
    assert result["brier"] == 0.0
    assert result["risk_coverage"][-1]["risk"] == 0.0


def test_ood_false_accept_is_reported():
    result = selective_metrics(
        [0, 0, 1], [0, 1, 1], [True, True, False], ood=[False, True, True]
    )
    assert result["ood_false_accept_rate"] == 0.5
