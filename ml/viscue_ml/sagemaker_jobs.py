"""Cost-bounded, dry-run-first SageMaker job specifications."""

from __future__ import annotations

import copy
import hashlib
import json
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any


class CostApprovalError(RuntimeError):
    """Raised before any AWS mutation when the numeric cost gate is not met."""


REQUIRED = {
    "region", "role_arn", "image_uri", "bucket", "output_prefix",
    "dataset_version", "source_sha256", "dataset_sha256", "cost_center",
    "instance_type", "instance_count", "max_runtime_seconds", "hourly_ceiling_usd",
}


def _validate(config: dict[str, Any]) -> None:
    missing = sorted(REQUIRED - set(config))
    if missing:
        raise ValueError(f"missing required configuration: {', '.join(missing)}")
    if not config["cost_center"]:
        raise ValueError("cost_center must be non-empty")
    if int(config["instance_count"]) < 1:
        raise ValueError("instance_count must be at least 1")
    if int(config["max_runtime_seconds"]) < 60:
        raise ValueError("max runtime must be at least 60 seconds")
    if Decimal(str(config["hourly_ceiling_usd"])) <= 0:
        raise ValueError("hourly cost ceiling must be positive")
    for key in ("source_sha256", "dataset_sha256"):
        if not re.fullmatch(r"[0-9a-f]{64}", str(config[key])):
            raise ValueError(f"{key} must be a lowercase SHA-256")


def estimate_max_cost(config: dict[str, Any]) -> float:
    _validate(config)
    hours = Decimal(int(config["max_runtime_seconds"])) / Decimal(3600)
    cost = Decimal(int(config["instance_count"])) * hours * Decimal(
        str(config["hourly_ceiling_usd"])
    )
    return float(cost.quantize(Decimal("0.0001")))


def _name(prefix: str, config: dict[str, Any]) -> str:
    version = re.sub(r"[^A-Za-z0-9-]", "-", str(config["dataset_version"]))
    digest = hashlib.sha256(
        f"{config['source_sha256']}:{config['dataset_sha256']}".encode()
    ).hexdigest()[:10]
    return f"{prefix}-{version}-{digest}"[:63].rstrip("-")


def _tags(config: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {"Key": "Project", "Value": "viscue-gesture-resolver"},
        {"Key": "DatasetVersion", "Value": str(config["dataset_version"])},
        {"Key": "CostCenter", "Value": str(config["cost_center"])},
        {"Key": "SourceSHA256", "Value": str(config["source_sha256"])},
        {"Key": "DatasetSHA256", "Value": str(config["dataset_sha256"])},
        {"Key": "SyntheticOnly", "Value": "true"},
    ]


def build_processing_spec(config: dict[str, Any]) -> dict[str, Any]:
    _validate(config)
    prefix = str(config["output_prefix"]).strip("/")
    return {
        "ProcessingJobName": _name("viscue-sim", config),
        "RoleArn": config["role_arn"],
        "AppSpecification": {
            "ImageUri": config["image_uri"],
            "ContainerArguments": ["generate-audit-freeze"],
        },
        "ProcessingResources": {"ClusterConfig": {
            "InstanceCount": int(config["instance_count"]),
            "InstanceType": config["instance_type"],
            "VolumeSizeInGB": int(config.get("volume_size_gb", 30)),
        }},
        "StoppingCondition": {"MaxRuntimeInSeconds": int(config["max_runtime_seconds"])},
        "ProcessingOutputConfig": {"Outputs": [{
            "OutputName": "dataset",
            "S3Output": {
                "S3Uri": f"s3://{config['bucket']}/{prefix}",
                "LocalPath": "/opt/ml/processing/output/dataset",
                "S3UploadMode": "EndOfJob",
            },
        }]},
        "Environment": {
            "DATASET_VERSION": str(config["dataset_version"]),
            "PERSONAS": str(config.get("personas", 1000)),
            "SAMPLES": str(config.get("samples", 10000)),
            "SEED": str(config.get("seed", 20260827)),
            "SOURCE_SHA256": str(config["source_sha256"]),
        },
        "Tags": _tags(config),
        "_Guard": {"EstimatedMaxCostUSD": estimate_max_cost(config)},
    }


def build_training_spec(config: dict[str, Any]) -> dict[str, Any]:
    _validate(config)
    prefix = str(config["output_prefix"]).strip("/")
    return {
        "TrainingJobName": _name("viscue-train", config),
        "RoleArn": config["role_arn"],
        "AlgorithmSpecification": {
            "TrainingImage": config["image_uri"], "TrainingInputMode": "File"
        },
        "InputDataConfig": [{
            "ChannelName": "dataset",
            "DataSource": {"S3DataSource": {
                "S3DataType": "S3Prefix",
                "S3Uri": f"s3://{config['bucket']}/{prefix}",
                "S3DataDistributionType": "FullyReplicated",
            }},
        }],
        "OutputDataConfig": {"S3OutputPath": f"s3://{config['bucket']}/{prefix}/training"},
        "ResourceConfig": {
            "InstanceCount": int(config["instance_count"]),
            "InstanceType": config["instance_type"],
            "VolumeSizeInGB": int(config.get("volume_size_gb", 30)),
        },
        "StoppingCondition": {"MaxRuntimeInSeconds": int(config["max_runtime_seconds"])},
        "EnableManagedSpotTraining": bool(config.get("managed_spot", False)),
        "Tags": _tags(config),
        "_Guard": {"EstimatedMaxCostUSD": estimate_max_cost(config)},
    }


def _redacted(spec: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(spec)
    result["RoleArn"] = "<redacted-role>"
    app = result.get("AppSpecification", {})
    if "ImageUri" in app:
        app["ImageUri"] = f"<private-ecr>/{app['ImageUri'].split('/', 1)[-1]}"
    algorithm = result.get("AlgorithmSpecification", {})
    if "TrainingImage" in algorithm:
        algorithm["TrainingImage"] = f"<private-ecr>/{algorithm['TrainingImage'].split('/', 1)[-1]}"
    serialized = json.dumps(result)
    bucket_pattern = re.compile(r"s3://[^/\"']+")
    return json.loads(bucket_pattern.sub("s3://<private-bucket>", serialized))


def _approval(spec: dict[str, Any], approved_cost_usd: float | None) -> float:
    estimate = float(spec.get("_Guard", {}).get("EstimatedMaxCostUSD", -1))
    if estimate < 0:
        raise CostApprovalError("job spec has no trusted cost estimate")
    approved = float(approved_cost_usd or 0)
    if approved < estimate:
        raise CostApprovalError(
            f"approved cost ${approved:.2f} is below bounded estimate ${estimate:.2f}"
        )
    return estimate


def submit_processing_job(
    spec: dict[str, Any], *, approved_cost_usd: float | None, client=None, dry_run: bool = True
):
    estimate = _approval(spec, approved_cost_usd)
    api_spec = copy.deepcopy(spec)
    api_spec.pop("_Guard", None)
    if dry_run:
        redacted = _redacted(api_spec)
        redacted.pop("RoleArn", None)
        return {"dry_run": True, "estimated_max_cost_usd": estimate, "spec": redacted}
    if client is None:
        import boto3
        client = boto3.client("sagemaker")
    response = client.create_processing_job(**api_spec)
    return {"dry_run": False, "submitted": bool(response), "job_alias": api_spec["ProcessingJobName"]}


def submit_training_job(
    spec: dict[str, Any], *, approved_cost_usd: float | None, client=None, dry_run: bool = True
):
    estimate = _approval(spec, approved_cost_usd)
    api_spec = copy.deepcopy(spec)
    api_spec.pop("_Guard", None)
    if dry_run:
        redacted = _redacted(api_spec)
        redacted.pop("RoleArn", None)
        return {"dry_run": True, "estimated_max_cost_usd": estimate, "spec": redacted}
    if client is None:
        import boto3
        client = boto3.client("sagemaker")
    response = client.create_training_job(**api_spec)
    return {"dry_run": False, "submitted": bool(response), "job_alias": api_spec["TrainingJobName"]}


def render_dry_run(spec: dict[str, Any]) -> dict[str, Any]:
    """Render a redacted specification without treating it as submission approval."""
    estimate = float(spec.get("_Guard", {}).get("EstimatedMaxCostUSD", -1))
    if estimate < 0:
        raise CostApprovalError("job spec has no trusted cost estimate")
    api_spec = copy.deepcopy(spec)
    api_spec.pop("_Guard", None)
    redacted = _redacted(api_spec)
    redacted.pop("RoleArn", None)
    return {"dry_run": True, "estimated_max_cost_usd": estimate, "spec": redacted}


def run_processing_job(config, approved_cost_usd, *, dry_run=True, client=None):
    return submit_processing_job(
        build_processing_spec(config), approved_cost_usd=approved_cost_usd,
        dry_run=dry_run, client=client,
    )
