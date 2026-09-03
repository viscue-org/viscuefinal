import pytest

from viscue_ml.dataset_program import (
    CostApprovalError,
    PhaseGateError,
    plan_full,
    plan_medium,
)


def test_medium_requires_numeric_ceiling_at_submission_gate():
    with pytest.raises(CostApprovalError):
        plan_medium(approved_cost_usd=3.99, require_approval=True)
    assert plan_medium(approved_cost_usd=4.0, require_approval=True)["samples"] == 300_000


def test_full_requires_clean_medium_and_cost_approval():
    with pytest.raises(PhaseGateError):
        plan_full({"passed": False, "blocking_findings": ["leak"]}, approved_cost_usd=16)
    with pytest.raises(CostApprovalError):
        plan_full({"passed": True, "blocking_findings": []}, approved_cost_usd=15.99)
