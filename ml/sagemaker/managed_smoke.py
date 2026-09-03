"""Submit/status a bounded Docker-free SageMaker dataset verification job."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import boto3


AWS_SKLEARN_IMAGE = "683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3"
ESTIMATED_MAX_COST_USD = 2.0
INSTANCE_TYPE = "ml.t3.medium"


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def submit(config_path: Path, approved_cost_usd: float, receipt_path: Path):
    if approved_cost_usd < ESTIMATED_MAX_COST_USD:
        raise RuntimeError("numeric approval is below the bounded estimate")
    config = _load(config_path)
    region = config["region"]
    if region != "us-east-1":
        raise RuntimeError("managed image is pinned only for us-east-1")
    workspace = Path(__file__).resolve().parents[2]
    script = Path(__file__).resolve().with_name("managed_verify.py")
    raw = script.read_bytes()
    digest = hashlib.sha256(raw).digest()
    code_key = f"{config['output_prefix'].strip('/')}/code/managed_verify.py"
    session = boto3.Session(region_name=region)
    s3 = session.client("s3")
    s3.put_object(
        Bucket=config["bucket"], Key=code_key, Body=raw,
        ServerSideEncryption="AES256",
        ChecksumSHA256=base64.b64encode(digest).decode("ascii"),
        Metadata={"sha256": digest.hex(), "synthetic-only": "true"},
        Tagging="Project=viscue-gesture-resolver&DataClass=synthetic-private",
    )
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    job_name = f"viscue-managed-verify-{config['dataset_sha256'][:10]}-{timestamp}"
    root = config["output_prefix"].strip("/")
    spec = {
        "ProcessingJobName": job_name,
        "RoleArn": config["role_arn"],
        "AppSpecification": {
            "ImageUri": AWS_SKLEARN_IMAGE,
            "ContainerEntrypoint": ["python3"],
            "ContainerArguments": ["/opt/ml/processing/input/code/managed_verify.py"],
        },
        "ProcessingInputs": [
            {
                "InputName": "dataset",
                "S3Input": {
                    "S3Uri": f"s3://{config['bucket']}/{root}/dataset/",
                    "LocalPath": "/opt/ml/processing/input/dataset",
                    "S3DataType": "S3Prefix", "S3InputMode": "File",
                    "S3DataDistributionType": "FullyReplicated",
                },
            },
            {
                "InputName": "code",
                "S3Input": {
                    "S3Uri": f"s3://{config['bucket']}/{root}/code/",
                    "LocalPath": "/opt/ml/processing/input/code",
                    "S3DataType": "S3Prefix", "S3InputMode": "File",
                    "S3DataDistributionType": "FullyReplicated",
                },
            },
        ],
        "ProcessingOutputConfig": {"Outputs": [{
            "OutputName": "verification",
            "S3Output": {
                "S3Uri": f"s3://{config['bucket']}/{root}/managed-verify/{job_name}",
                "LocalPath": "/opt/ml/processing/output",
                "S3UploadMode": "EndOfJob",
            },
        }]},
        "ProcessingResources": {"ClusterConfig": {
            "InstanceCount": 1, "InstanceType": INSTANCE_TYPE, "VolumeSizeInGB": 30,
        }},
        "StoppingCondition": {"MaxRuntimeInSeconds": 1800},
        "NetworkConfig": {
            "EnableInterContainerTrafficEncryption": True,
            "EnableNetworkIsolation": True,
        },
        "Tags": [
            {"Key": "Project", "Value": "viscue-gesture-resolver"},
            {"Key": "DatasetVersion", "Value": config["dataset_version"]},
            {"Key": "DatasetSHA256", "Value": config["dataset_sha256"]},
            {"Key": "CostCenter", "Value": config["cost_center"]},
            {"Key": "SyntheticOnly", "Value": "true"},
            {"Key": "ApprovedCostCeilingUSD", "Value": f"{approved_cost_usd:.2f}"},
        ],
    }
    session.client("sagemaker").create_processing_job(**spec)
    receipt = {
        "schema_version": "managed-smoke-job/1.0",
        "job_name": job_name,
        "region": region,
        "output_key": f"{root}/managed-verify/{job_name}/report.json",
        "manifest_sha256": config["dataset_sha256"],
        "approved_cost_ceiling_usd": approved_cost_usd,
        "estimated_max_cost_usd": ESTIMATED_MAX_COST_USD,
        "instance_type": INSTANCE_TYPE,
        "synthetic_only": True,
    }
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return {"submitted": True, "status": "Starting", "instance_type": INSTANCE_TYPE,
            "estimated_max_cost_usd": ESTIMATED_MAX_COST_USD,
            "approved_cost_ceiling_usd": approved_cost_usd, "synthetic_only": True}


def status(config_path: Path, receipt_path: Path):
    config = _load(config_path)
    receipt = _load(receipt_path)
    session = boto3.Session(region_name=receipt["region"])
    description = session.client("sagemaker").describe_processing_job(
        ProcessingJobName=receipt["job_name"]
    )
    state = description["ProcessingJobStatus"]
    result = {"status": state, "terminal": state in {"Completed", "Failed", "Stopped"},
              "synthetic_only": True, "production_accuracy_claim": False}
    if state == "Completed":
        body = session.client("s3").get_object(
            Bucket=config["bucket"], Key=receipt["output_key"]
        )["Body"].read()
        report = json.loads(body)
        result.update({"verification_passed": report.get("passed") is True,
                       "records": report.get("records"), "manifest_sha256": report.get("manifest_sha256")})
    elif state == "Failed":
        result["failure_code"] = "ProcessingJobFailed"
    return result


def main(argv=None):
    workspace = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("submit", "status"))
    parser.add_argument("--config", default=str(Path(__file__).resolve().with_name("config.local.json")))
    parser.add_argument("--receipt", default=str(workspace / "ml-runs" / "managed-smoke" / "job.json"))
    parser.add_argument("--approved-cost-usd", type=float)
    args = parser.parse_args(argv)
    try:
        if args.command == "submit":
            if args.approved_cost_usd is None:
                raise RuntimeError("numeric cost approval is required")
            result = submit(Path(args.config), args.approved_cost_usd, Path(args.receipt))
        else:
            result = status(Path(args.config), Path(args.receipt))
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as error:
        print(json.dumps({"failure_code": type(error).__name__, "submitted": False,
                          "paid_compute_started": False}, indent=2, sort_keys=True))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
