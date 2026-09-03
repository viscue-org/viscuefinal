"""Package and submit Docker-free managed synthetic generation."""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import tarfile
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import boto3

from viscue_ml.dataset_program import plan_medium


IMAGE = "683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3"
NODE_VERSION = "v24.17.0"
NODE_FILE = f"node-{NODE_VERSION}-linux-x64.tar.xz"
NODE_ROOT = f"https://nodejs.org/dist/{NODE_VERSION}"


def digest(path: Path) -> tuple[str, str]:
    raw = hashlib.sha256(path.read_bytes()).digest()
    return raw.hex(), base64.b64encode(raw).decode("ascii")


def source_archive(workspace: Path, destination: Path) -> str:
    with tarfile.open(destination, "w:gz") as archive:
        archive.add(workspace / "gesture", arcname="gesture")
        archive.add(workspace / "scripts" / "source-manifest.mjs", arcname="scripts/source-manifest.mjs")
    return digest(destination)[0]


def fetch_node(destination: Path) -> str:
    sums = urllib.request.urlopen(f"{NODE_ROOT}/SHASUMS256.txt", timeout=30).read().decode()
    expected = next(line.split()[0] for line in sums.splitlines() if line.endswith(f"  {NODE_FILE}"))
    with urllib.request.urlopen(f"{NODE_ROOT}/{NODE_FILE}", timeout=60) as response, destination.open("wb") as stream:
        while chunk := response.read(1024 * 1024):
            stream.write(chunk)
    if digest(destination)[0] != expected:
        raise RuntimeError("official Node checksum mismatch")
    return expected


def build_spec(config, program, job_name, source_sha, node_sha):
    root = config["output_prefix"].strip("/")
    code_prefix = f"{root}/managed-generator/{job_name}/code"
    args = [
        "/opt/ml/processing/input/code/generator_bootstrap.py",
        "--source-archive", "/opt/ml/processing/input/code/source.tar.gz", "--source-sha256", source_sha,
        "--node-archive", f"/opt/ml/processing/input/code/{NODE_FILE}", "--node-sha256", node_sha,
        "--phase", program["phase"], "--personas", str(program["personas"]),
        "--samples", str(program["samples"]), "--seed", str(program["seed"]),
    ]
    return {
        "ProcessingJobName": job_name, "RoleArn": config["role_arn"],
        "AppSpecification": {"ImageUri": IMAGE, "ContainerEntrypoint": ["python3"], "ContainerArguments": args},
        "ProcessingInputs": [{"InputName": "code", "S3Input": {
            "S3Uri": f"s3://{config['bucket']}/{code_prefix}/", "LocalPath": "/opt/ml/processing/input/code",
            "S3DataType": "S3Prefix", "S3InputMode": "File", "S3DataDistributionType": "FullyReplicated"}}],
        "ProcessingOutputConfig": {"Outputs": [{"OutputName": "dataset", "S3Output": {
            "S3Uri": f"s3://{config['bucket']}/{root}/{program['phase']}/{job_name}",
            "LocalPath": "/opt/ml/processing/output", "S3UploadMode": "EndOfJob"}}]},
        "ProcessingResources": {"ClusterConfig": {"InstanceCount": program["instance_count"],
            "InstanceType": program["instance_type"], "VolumeSizeInGB": 30}},
        "StoppingCondition": {"MaxRuntimeInSeconds": program["max_runtime_seconds"]},
        "NetworkConfig": {"EnableInterContainerTrafficEncryption": True, "EnableNetworkIsolation": True},
        "Tags": [{"Key": "Project", "Value": "viscue-gesture-resolver"},
                 {"Key": "Phase", "Value": program["phase"]}, {"Key": "SyntheticOnly", "Value": "true"},
                 {"Key": "ApprovedCostCeilingUSD", "Value": f"{program['approved_cost_usd']:.2f}"}],
    }, code_prefix


def submit(config_path: Path, approved: float, receipt_path: Path):
    program = plan_medium(approved_cost_usd=approved, require_approval=True)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    workspace = Path(__file__).resolve().parents[2]
    job = f"viscue-medium-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    with tempfile.TemporaryDirectory(prefix="viscue-package-") as directory:
        directory = Path(directory)
        source = directory / "source.tar.gz"; node = directory / NODE_FILE
        source_sha = source_archive(workspace, source); node_sha = fetch_node(node)
        spec, code_prefix = build_spec(config, program, job, source_sha, node_sha)
        s3 = boto3.Session(region_name=config["region"]).client("s3")
        files = [(source, "source.tar.gz"), (node, NODE_FILE),
                 (Path(__file__).with_name("generator_bootstrap.py"), "generator_bootstrap.py")]
        for path, name in files:
            sha, checksum = digest(path)
            with path.open("rb") as stream:
                s3.put_object(Bucket=config["bucket"], Key=f"{code_prefix}/{name}", Body=stream,
                              ServerSideEncryption="AES256", ChecksumSHA256=checksum,
                              Metadata={"sha256": sha, "synthetic-only": "true"})
        boto3.Session(region_name=config["region"]).client("sagemaker").create_processing_job(**spec)
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps({"job_name": job, "phase": "medium", "program": program}, indent=2)+"\n")
    return {"submitted": True, "status": "Starting", "phase": "medium",
            "samples": program["samples"], "estimated_max_cost_usd": program["estimated_max_cost_usd"]}


def main(argv=None):
    workspace = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).with_name("config.local.json")))
    parser.add_argument("--receipt", default=str(workspace / "ml-runs" / "medium-generation" / "job.json"))
    parser.add_argument("--approved-cost-usd", type=float, required=True)
    args = parser.parse_args(argv)
    print(json.dumps(submit(Path(args.config), args.approved_cost_usd, Path(args.receipt)), indent=2))


if __name__ == "__main__":
    main()
