from viscue_ml.baselines import shortcut_findings


def test_metadata_and_one_field_shortcuts_block():
    report = {
        "majority": {"accuracy": 0.10},
        "metadata-only": {"accuracy": 0.55},
        "tool-only": {"accuracy": 0.51},
        "geometry-only": {"accuracy": 0.80},
    }
    findings = shortcut_findings(report, blocking_threshold=0.50)
    codes = {finding["code"] for finding in findings if finding["blocking"]}
    assert "forbidden_metadata_shortcut" in codes
    assert "one_field_shortcut" in codes
    assert not any(f["baseline"] == "geometry-only" and f["blocking"] for f in findings)
