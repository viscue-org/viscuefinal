"""Upload only a verified frozen synthetic dataset to the private project bucket."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from viscue_ml.data import GestureDataset


def _digest(path: Path) -> tuple[str, str]:
    raw = hashlib.sha256(path.read_bytes()).digest()
    return raw.hex(), base64.b64encode(raw).decode("ascii")


def upload_frozen_dataset(config_path: Path, manifest_path: Path, receipt_path: Path):
    config = json.loads(config_path.read_text(encoding="utf-8"))
    manifest_path = manifest_path.resolve()
    dataset_root = manifest_path.parent
    # Construction verifies manifest, frozen seal, audit report, and every shard.
    GestureDataset(manifest_path, split="train")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest_sha, _ = _digest(manifest_path)
    if manifest_sha != config["dataset_sha256"]:
        raise RuntimeError("configured dataset hash does not match frozen manifest")

    relative_paths = [Path("manifest.json"), Path("frozen.json"), Path("audit-report.json")]
    relative_paths.extend(Path(shard["path"]) for shard in manifest["shards"])
    prefix = f"{str(config['output_prefix']).strip('/')}/dataset"
    s3 = boto3.Session(region_name=config["region"]).client("s3")
    uploaded = 0
    reused = 0
    total_bytes = 0
    versions = []
    for relative in relative_paths:
        source = dataset_root / relative
        sha256, checksum = _digest(source)
        key = f"{prefix}/{relative.as_posix()}"
        total_bytes += source.stat().st_size
        existing = None
        try:
            existing = s3.head_object(Bucket=config["bucket"], Key=key)
        except ClientError as error:
            if str(error.response.get("Error", {}).get("Code")) not in {"404", "NoSuchKey", "NotFound"}:
                raise
        if existing and existing.get("Metadata", {}).get("sha256") == sha256:
            reused += 1
            versions.append({"path": relative.as_posix(), "version_id": existing.get("VersionId")})
            continue
        with source.open("rb") as stream:
            response = s3.put_object(
                Bucket=config["bucket"], Key=key, Body=stream,
                ServerSideEncryption="AES256",
                ChecksumSHA256=checksum,
                Metadata={
                    "sha256": sha256,
                    "dataset-version": manifest["dataset_version"],
                    "synthetic-only": "true",
                },
                Tagging="Project=viscue-gesture-resolver&DataClass=synthetic-private",
            )
        uploaded += 1
        versions.append({"path": relative.as_posix(), "version_id": response.get("VersionId")})

    receipt = {
        "schema_version": "s3-dataset-upload/1.0",
        "dataset_version": manifest["dataset_version"],
        "manifest_sha256": manifest_sha,
        "synthetic_only": True,
        "encrypted": True,
        "bucket_versioning_required": True,
        "object_count": len(relative_paths),
        "uploaded": uploaded,
        "reused": reused,
        "total_bytes": total_bytes,
        "versions": versions,
    }
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return {
        "dataset_verified": True,
        "synthetic_only": True,
        "object_count": len(relative_paths),
        "uploaded": uploaded,
        "reused": reused,
        "total_bytes": total_bytes,
        "paid_compute_started": False,
    }


def main(argv=None):
    workspace = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).resolve().with_name("config.local.json")))
    parser.add_argument("--manifest", default=str(workspace / "datasets" / "gesture-smoke-v1" / "manifest.json"))
    parser.add_argument("--receipt", default=str(workspace / "ml-runs" / "s3-smoke-upload" / "receipt.json"))
    args = parser.parse_args(argv)
    try:
        result = upload_frozen_dataset(
            Path(args.config).resolve(), Path(args.manifest).resolve(), Path(args.receipt).resolve()
        )
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as error:
        print(json.dumps({
            "dataset_verified": False,
            "failure_code": type(error).__name__,
            "paid_compute_started": False,
        }, indent=2, sort_keys=True))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
