import copy

import boto3
import pytest
from botocore.stub import Stubber

from viscue_ml.sagemaker_jobs import (
    CostApprovalError,
    build_processing_spec,
    build_training_spec,
    estimate_max_cost,
    submit_processing_job,
)


CONFIG = {
    "region": "us-east-1",
    "role_arn": "arn:aws:iam::123456789012:role/viscue-gesture",
    "image_uri": "123456789012.dkr.ecr.us-east-1.amazonaws.com/viscue-gesture-simulator:v1",
    "bucket": "private-versioned-bucket",
    "output_prefix": "gesture/smoke-v1",
    "dataset_version": "gesture-smoke-v1",
    "source_sha256": "a" * 64,
    "dataset_sha256": "b" * 64,
    "cost_center": "research",
    "instance_type": "ml.m5.large",
    "instance_count": 1,
    "max_runtime_seconds": 1800,
    "hourly_ceiling_usd": 2.00,
}


def test_processing_job_defaults_to_dry_run_and_has_cost_tags():
    spec = build_processing_spec(CONFIG)
    assert spec["AppSpecification"]["ImageUri"].endswith("viscue-gesture-simulator:v1")
    assert {tag["Key"] for tag in spec["Tags"]} >= {
        "Project", "DatasetVersion", "CostCenter", "SourceSHA256", "DatasetSHA256"
    }
    assert spec["StoppingCondition"]["MaxRuntimeInSeconds"] == 1800
    assert spec["ProcessingOutputConfig"]["Outputs"][0]["S3Output"]["LocalPath"].startswith(
        "/opt/ml/processing/output"
    )


def test_cost_gate_refuses_zero_or_insufficient_approval():
    spec = build_processing_spec(CONFIG)
    with pytest.raises(CostApprovalError):
        submit_processing_job(spec, approved_cost_usd=0, client=object())
    assert estimate_max_cost(CONFIG) == 1.0
    with pytest.raises(CostApprovalError):
        submit_processing_job(spec, approved_cost_usd=0.99, client=object())


def test_dry_run_never_calls_client():
    class FailingClient:
        def create_processing_job(self, **kwargs):
            raise AssertionError("AWS must not be called during dry-run")

    spec = build_processing_spec(CONFIG)
    result = submit_processing_job(
        spec, approved_cost_usd=1.0, client=FailingClient(), dry_run=True
    )
    assert result["dry_run"] is True
    assert "RoleArn" not in result["spec"]


def test_explicitly_approved_submission_matches_boto3_contract():
    client = boto3.client(
        "sagemaker", region_name="us-east-1",
        aws_access_key_id="testing", aws_secret_access_key="testing",
    )
    spec = build_processing_spec(CONFIG)
    expected = copy.deepcopy(spec)
    expected.pop("_Guard")
    with Stubber(client) as stubber:
        stubber.add_response(
            "create_processing_job",
            {"ProcessingJobArn": "arn:aws:sagemaker:us-east-1:123456789012:processing-job/test"},
            expected,
        )
        result = submit_processing_job(
            spec, approved_cost_usd=1.0, client=client, dry_run=False
        )
    assert result["submitted"] is True


def test_training_builder_rejects_unbounded_or_untagged_config():
    broken = copy.deepcopy(CONFIG)
    broken["max_runtime_seconds"] = 0
    with pytest.raises(ValueError, match="runtime"):
        build_training_spec(broken)
    broken = copy.deepcopy(CONFIG)
    broken.pop("cost_center")
    with pytest.raises(ValueError, match="cost_center"):
        build_training_spec(broken)
