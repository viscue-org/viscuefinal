"""Thin dry-run-first CLI for VIS CUE SageMaker jobs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from viscue_ml.sagemaker_jobs import (
    build_processing_spec,
    build_training_spec,
    render_dry_run,
    submit_processing_job,
    submit_training_job,
)


def _load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("processing", "training"))
    parser.add_argument("--config", required=True)
    parser.add_argument("--approved-cost-usd", type=float)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args(argv)
    config = _load(args.config)
    spec = build_processing_spec(config) if args.command == "processing" else build_training_spec(config)
    if not args.execute:
        result = render_dry_run(spec)
    elif args.command == "processing":
        result = submit_processing_job(
            spec, approved_cost_usd=args.approved_cost_usd, dry_run=False
        )
    else:
        result = submit_training_job(
            spec, approved_cost_usd=args.approved_cost_usd, dry_run=False
        )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
