"""Stdlib-only frozen-dataset verifier for an AWS-managed Processing image."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify(input_dir: Path, output_dir: Path):
    manifest_path = input_dir / "manifest.json"
    freeze_path = input_dir / "frozen.json"
    audit_path = input_dir / "audit-report.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    freeze = json.loads(freeze_path.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != "dataset-manifest/1.0":
        raise RuntimeError("unsupported manifest schema")
    manifest_hash = sha256(manifest_path)
    if manifest_hash != freeze.get("manifest_sha256"):
        raise RuntimeError("frozen manifest hash mismatch")
    if sha256(audit_path) != freeze.get("audit_sha256"):
        raise RuntimeError("frozen audit hash mismatch")
    sealed = freeze.get("shard_hashes", {})
    records = 0
    split_counts = {}
    for shard in manifest["shards"]:
        relative = shard["path"]
        path = input_dir / relative
        actual = sha256(path)
        if actual != shard["sha256"] or actual != sealed.get(relative):
            raise RuntimeError("frozen shard hash mismatch")
        shard_records = 0
        with gzip.open(path, "rt", encoding="utf-8") as stream:
            for line in stream:
                row = json.loads(line)
                if not isinstance(row.get("model_input"), dict) or not isinstance(row.get("ground_truth"), dict):
                    raise RuntimeError("invalid dataset row")
                if "ground_truth" in row["model_input"] or "simulator_provenance" in row["model_input"]:
                    raise RuntimeError("label or provenance leaked into model input")
                split = row.get("split", "missing")
                split_counts[split] = split_counts.get(split, 0) + 1
                shard_records += 1
        if shard_records != shard["records"]:
            raise RuntimeError("shard record count mismatch")
        records += shard_records
    if records != manifest["total_samples"]:
        raise RuntimeError("manifest total sample count mismatch")
    report = {
        "schema_version": "managed-frozen-verification/1.0",
        "passed": True,
        "synthetic_only": True,
        "production_accuracy_claim": False,
        "manifest_sha256": manifest_hash,
        "records": records,
        "shards": len(manifest["shards"]),
        "split_counts": dict(sorted(split_counts.items())),
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "report.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="/opt/ml/processing/input/dataset")
    parser.add_argument("--output", default="/opt/ml/processing/output")
    args = parser.parse_args(argv)
    report = verify(Path(args.input), Path(args.output))
    print(json.dumps({"passed": report["passed"], "records": report["records"], "synthetic_only": True}))


if __name__ == "__main__":
    main()
