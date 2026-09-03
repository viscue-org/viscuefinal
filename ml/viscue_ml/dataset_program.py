"""Phase and cost gates for scaled synthetic dataset generation."""

from __future__ import annotations


class PhaseGateError(RuntimeError):
    pass


class CostApprovalError(RuntimeError):
    pass


MEDIUM = {
    "phase": "medium", "personas": 10_000, "samples": 300_000,
    "seed": 20260901, "instance_type": "ml.t3.large", "instance_count": 1,
    "max_runtime_seconds": 3600, "hourly_ceiling_usd": 4.0,
    "estimated_max_cost_usd": 4.0, "shard_size": 1_000, "synthetic_only": True,
}

FULL = {
    "phase": "full", "personas": 100_000, "samples": 3_000_000,
    "seed": 20260902, "instance_type": "ml.t3.xlarge", "instance_count": 1,
    "max_runtime_seconds": 14_400, "hourly_ceiling_usd": 4.0,
    "estimated_max_cost_usd": 16.0, "shard_size": 1_000, "synthetic_only": True,
}


def plan_medium(*, approved_cost_usd: float | None = None, require_approval=False):
    if require_approval and float(approved_cost_usd or 0) < MEDIUM["estimated_max_cost_usd"]:
        raise CostApprovalError("medium generation requires a numeric $4.00 approval")
    return dict(MEDIUM, approved_cost_usd=approved_cost_usd)


def plan_full(medium_report: dict, *, approved_cost_usd: float | None):
    if not medium_report.get("passed") or medium_report.get("blocking_findings"):
        raise PhaseGateError("full generation requires a clean medium audit")
    if float(approved_cost_usd or 0) < FULL["estimated_max_cost_usd"]:
        raise CostApprovalError("full generation requires a numeric $16.00 approval")
    return dict(FULL, approved_cost_usd=approved_cost_usd)
