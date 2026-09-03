"""Phase and cost gates for Docker-free managed synthetic dataset generation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from viscue_ml.dataset_program import PhaseGateError, plan_full, plan_medium


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("medium", "full"))
    parser.add_argument("--approved-cost-usd", type=float)
    parser.add_argument("--medium-report")
    args = parser.parse_args(argv)
    if args.phase == "medium":
        result = plan_medium(approved_cost_usd=args.approved_cost_usd, require_approval=False)
    else:
        if not args.medium_report:
            raise PhaseGateError("--medium-report is required")
        result = plan_full(
            json.loads(Path(args.medium_report).read_text(encoding="utf-8")),
            approved_cost_usd=args.approved_cost_usd,
        )
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
