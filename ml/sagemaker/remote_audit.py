"""Stream the completed managed corpus through the bounded local audit.

Only one compressed shard is stored locally at a time. No SageMaker compute is
created, and no real-user or telemetry data is involved.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

import boto3


_BOOTSTRAP_PATH = Path(__file__).with_name("generator_bootstrap.py")
_BOOTSTRAP_SPEC = importlib.util.spec_from_file_location("viscue_generator_bootstrap_remote", _BOOTSTRAP_PATH)
_BOOTSTRAP = importlib.util.module_from_spec(_BOOTSTRAP_SPEC)
assert _BOOTSTRAP_SPEC.loader is not None
_BOOTSTRAP_SPEC.loader.exec_module(_BOOTSTRAP)
safe_extract = _BOOTSTRAP.safe_extract


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical(value: dict) -> bytes:
    return (json.dumps(value, indent=2) + "\n").encode("utf-8")


def validate_manifest_shards(manifest: dict) -> dict[str, str]:
    shards = manifest.get("shards")
    if not isinstance(shards, list) or not shards:
        raise ValueError("manifest shards must be non-empty")
    total = 0
    expected_start = int(manifest.get("configuration", {}).get("seed", 0)) * 1_000_003
    hashes: dict[str, str] = {}
    for shard in shards:
        if set(shard) != {"path", "sha256", "records", "seed_range"}:
            raise ValueError("shard declaration contract mismatch")
        name = shard["path"]
        pure = PurePosixPath(name)
        if (
            pure.is_absolute()
            or ".." in pure.parts
            or len(pure.parts) != 2
            or pure.parts[0] != "shards"
            or not pure.name.endswith(".jsonl.gz")
            or name in hashes
        ):
            raise ValueError("shard path is not confined")
        digest = shard["sha256"]
        records = shard["records"]
        seed_range = shard["seed_range"]
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise ValueError("shard hash is invalid")
        if not isinstance(records, int) or not 1 <= records <= 1000:
            raise ValueError("shard record count is invalid")
        if set(seed_range) != {"start", "end_exclusive"}:
            raise ValueError("shard seed range contract mismatch")
        start = int(seed_range["start"])
        end = int(seed_range["end_exclusive"])
        if start != expected_start or end != start + records:
            raise ValueError("shard seed ranges are not contiguous")
        expected_start = end
        total += records
        hashes[name] = digest
    if total != manifest.get("total_samples") or total != manifest.get("configuration", {}).get("samples"):
        raise ValueError("manifest sample total mismatch")
    return hashes


def build_freeze(manifest_bytes: bytes, audit_bytes: bytes, shard_hashes: dict[str, str]) -> dict:
    return {
        "schema_version": "dataset-freeze/1.0",
        "manifest_sha256": sha256_bytes(manifest_bytes),
        "shard_hashes": shard_hashes,
        "audit_sha256": sha256_bytes(audit_bytes),
    }


def _s3_location(uri: str) -> tuple[str, str]:
    parsed = urlparse(uri)
    if parsed.scheme != "s3" or not parsed.netloc:
        raise ValueError("invalid private S3 location")
    return parsed.netloc, parsed.path.lstrip("/").rstrip("/")


def _argument(arguments: list[str], name: str) -> str:
    try:
        return arguments[arguments.index(name) + 1]
    except (ValueError, IndexError) as error:
        raise ValueError(f"managed job is missing {name}") from error


def _put_json(s3, bucket: str, key: str, value: dict) -> tuple[bytes, str | None]:
    body = canonical(value)
    checksum = base64.b64encode(hashlib.sha256(body).digest()).decode("ascii")
    response = s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ServerSideEncryption="AES256",
        ChecksumSHA256=checksum,
        Metadata={"synthetic-only": "true", "sha256": sha256_bytes(body)},
    )
    return body, response.get("VersionId")


def run(config_path: Path, receipt_path: Path, output_receipt: Path) -> dict:
    workspace = Path(__file__).resolve().parents[2]
    config = json.loads(config_path.read_text(encoding="utf-8"))
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    session = boto3.Session(region_name=config["region"])
    s3 = session.client("s3")
    sm = session.client("sagemaker")
    job = sm.describe_processing_job(ProcessingJobName=receipt["job_name"])
    if job["ProcessingJobStatus"] != "Failed":
        raise RuntimeError("remote recovery requires the terminal failed generation job")
    if s3.get_bucket_versioning(Bucket=config["bucket"]).get("Status") != "Enabled":
        raise RuntimeError("private dataset bucket versioning is not enabled")

    arguments = job["AppSpecification"].get("ContainerArguments", [])
    expected_source_sha = _argument(arguments, "--source-sha256")
    input_bucket, input_prefix = _s3_location(job["ProcessingInputs"][0]["S3Input"]["S3Uri"])
    output_bucket, output_prefix = _s3_location(job["ProcessingOutputConfig"]["Outputs"][0]["S3Output"]["S3Uri"])
    if input_bucket != config["bucket"] or output_bucket != config["bucket"]:
        raise RuntimeError("managed job storage is outside the private project bucket")
    dataset_prefix = f"{output_prefix}/dataset"
    manifest_key = f"{dataset_prefix}/manifest.json"
    manifest_object = s3.get_object(Bucket=output_bucket, Key=manifest_key)
    manifest_bytes = manifest_object["Body"].read()
    manifest = json.loads(manifest_bytes)
    shard_hashes = validate_manifest_shards(manifest)

    listed = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=output_bucket, Prefix=f"{dataset_prefix}/"):
        listed.extend(item["Key"][len(dataset_prefix) + 1 :] for item in page.get("Contents", []))
    expected_objects = {"manifest.json", *shard_hashes}
    if set(listed) != expected_objects:
        raise RuntimeError("managed dataset prefix has missing or unexpected pre-audit objects")

    versions: dict[str, str | None] = {"manifest.json": manifest_object.get("VersionId")}
    with tempfile.TemporaryDirectory(prefix="viscue-remote-audit-") as temporary:
        temporary = Path(temporary)
        archive = temporary / "source.tar.gz"
        source_object = s3.get_object(Bucket=input_bucket, Key=f"{input_prefix}/source.tar.gz")
        with archive.open("wb") as target:
            for chunk in iter(lambda: source_object["Body"].read(1024 * 1024), b""):
                target.write(chunk)
        if sha256_file(archive) != expected_source_sha:
            raise RuntimeError("managed generation source archive hash mismatch")
        source = temporary / "source"
        source.mkdir()
        with tarfile.open(archive, "r:gz") as package:
            safe_extract(package, source)
        proof_file = temporary / "generation-source-manifest.json"
        subprocess.run(
            ["node", str(source / "scripts/source-manifest.mjs"), str(source), str(proof_file)],
            check=True,
        )
        proof = json.loads(proof_file.read_text(encoding="utf-8"))
        if proof["tree_sha256"] != manifest.get("generator", {}).get("source_tree_sha256"):
            raise RuntimeError("generation source tree does not match the dataset manifest")
        shutil.copy2(workspace / "gesture/dataset/audit.mjs", source / "gesture/dataset/audit.mjs")

        manifest_file = temporary / "manifest.json"
        manifest_file.write_bytes(manifest_bytes)
        report_file = temporary / "audit-report.json"
        worker = subprocess.Popen(
            [
                "node",
                str(Path(__file__).with_name("remote_audit_worker.mjs")),
                str(source),
                str(manifest_file),
                proof["tree_sha256"],
                str(report_file),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        assert worker.stdin is not None
        processed = 0
        actual_hashes: dict[str, str] = {}
        try:
            for index, shard in enumerate(manifest["shards"], start=1):
                local_shard = temporary / "current-shard.jsonl.gz"
                obj = s3.get_object(Bucket=output_bucket, Key=f"{dataset_prefix}/{shard['path']}")
                versions[shard["path"]] = obj.get("VersionId")
                with local_shard.open("wb") as target:
                    for chunk in iter(lambda: obj["Body"].read(1024 * 1024), b""):
                        target.write(chunk)
                actual = sha256_file(local_shard)
                if actual != shard["sha256"]:
                    raise RuntimeError("managed shard hash mismatch")
                actual_hashes[shard["path"]] = actual
                records = 0
                with gzip.open(local_shard, "rb") as stream:
                    for line in stream:
                        if line.strip():
                            worker.stdin.write(line if line.endswith(b"\n") else line + b"\n")
                            records += 1
                local_shard.unlink()
                if records != shard["records"]:
                    raise RuntimeError("managed shard record count mismatch")
                processed += records
                if index % 50 == 0 or index == len(manifest["shards"]):
                    print(json.dumps({"progress_shards": index, "records_streamed": processed}), flush=True)
            if actual_hashes != shard_hashes:
                raise RuntimeError("verified shard map does not match the manifest")
            worker.stdin.close()
            return_code = worker.wait()
            stderr = worker.stderr.read().decode("utf-8", errors="replace") if worker.stderr else ""
            if return_code != 0:
                raise RuntimeError(f"bounded audit worker failed: {stderr[-1000:]}")
        except Exception:
            worker.kill()
            raise

        report = json.loads(report_file.read_text(encoding="utf-8"))
        report["storage_verification"] = {
            "bucket_versioning": "Enabled",
            "manifest_version_recorded": bool(versions["manifest.json"]),
            "shards_verified": len(actual_hashes),
            "compressed_bytes_streamed": sum(
                item["Size"]
                for page in s3.get_paginator("list_objects_v2").paginate(Bucket=output_bucket, Prefix=f"{dataset_prefix}/shards/")
                for item in page.get("Contents", [])
            ),
            "full_record_validation": True,
            "exact_hash_validation": True,
        }
        audit_bytes, audit_version = _put_json(s3, output_bucket, f"{dataset_prefix}/audit-report.json", report)
        versions["audit-report.json"] = audit_version
        passed = not report.get("blocking_findings")
        frozen = False
        if passed:
            freeze = build_freeze(manifest_bytes, audit_bytes, shard_hashes)
            _, freeze_version = _put_json(s3, output_bucket, f"{dataset_prefix}/frozen.json", freeze)
            versions["frozen.json"] = freeze_version
            managed = {
                "schema_version": "managed-generation/1.0",
                "passed": True,
                "phase": "medium",
                "samples": manifest["total_samples"],
                "manifest_sha256": sha256_bytes(manifest_bytes),
                "synthetic_only": True,
                "production_accuracy_claim": False,
                "recovered_audit_without_regeneration": True,
            }
            _, managed_version = _put_json(s3, output_bucket, f"{dataset_prefix}/managed-job-report.json", managed)
            versions["managed-job-report.json"] = managed_version
            frozen = True

    output_receipt.parent.mkdir(parents=True, exist_ok=True)
    output_receipt.write_text(
        json.dumps(
            {
                "schema_version": "remote-audit-receipt/1.0",
                "passed": passed,
                "frozen": frozen,
                "records": manifest["total_samples"],
                "manifest_sha256": sha256_bytes(manifest_bytes),
                "audit_sha256": sha256_bytes(audit_bytes),
                "version_ids": versions,
                "synthetic_only": True,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return {
        "passed": passed,
        "frozen": frozen,
        "records": report["record_count"],
        "shards": len(shard_hashes),
        "blocking_findings": len(report.get("blocking_findings", [])),
        "warnings": len(report.get("warnings", [])),
        "new_sagemaker_compute_started": False,
        "synthetic_only": True,
    }


def main(argv=None) -> int:
    workspace = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).with_name("config.local.json")))
    parser.add_argument("--receipt", default=str(workspace / "ml-runs/medium-generation/job.json"))
    parser.add_argument("--out", default=str(workspace / "ml-runs/medium-generation/recovery-audit.json"))
    args = parser.parse_args(argv)
    result = run(Path(args.config), Path(args.receipt), Path(args.out))
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
