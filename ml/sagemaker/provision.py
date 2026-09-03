"""Idempotently provision the minimal private AWS foundation for VIS CUE.

The command never creates or starts a SageMaker compute job. Output is redacted:
only action aliases and booleans are printed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


PROJECT = "viscue-gesture-resolver"
ROLE_NAME = "viscue-gesture-sagemaker-execution"
REPOSITORY_NAME = "viscue-gesture-simulator"


def _error_code(error: ClientError) -> str:
    return str(error.response.get("Error", {}).get("Code", "ClientError"))


def _failure_alias(error: Exception) -> str:
    if isinstance(error, ClientError):
        return f"ClientError:{_error_code(error)}"
    return type(error).__name__


def _tag_map(tags) -> dict[str, str]:
    return {str(tag.get("Key")): str(tag.get("Value")) for tag in tags or []}


def _require_owned(tags, resource_alias: str) -> None:
    if _tag_map(tags).get("Project") != PROJECT:
        raise RuntimeError(f"{resource_alias} exists but is not owned by this project")


def _ensure_bucket(session, bucket: str, region: str, dry_run: bool) -> bool:
    s3 = session.client("s3")
    exists = True
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as error:
        code = _error_code(error)
        if code in {"404", "NoSuchBucket", "NotFound"}:
            exists = False
        else:
            raise RuntimeError("private bucket alias is unavailable") from error
    if exists:
        try:
            tags = s3.get_bucket_tagging(Bucket=bucket).get("TagSet", [])
        except ClientError as error:
            if _error_code(error) == "NoSuchTagSet":
                tags = []
            else:
                raise
        _require_owned(tags, "dataset bucket")
        return False
    if dry_run:
        return True
    create = {"Bucket": bucket}
    if region != "us-east-1":
        create["CreateBucketConfiguration"] = {"LocationConstraint": region}
    s3.create_bucket(**create)
    s3.put_public_access_block(
        Bucket=bucket,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    s3.put_bucket_ownership_controls(
        Bucket=bucket,
        OwnershipControls={"Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}]},
    )
    s3.put_bucket_encryption(
        Bucket=bucket,
        ServerSideEncryptionConfiguration={"Rules": [{
            "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"},
            "BucketKeyEnabled": False,
        }]},
    )
    s3.put_bucket_versioning(
        Bucket=bucket, VersioningConfiguration={"Status": "Enabled"}
    )
    s3.put_bucket_tagging(
        Bucket=bucket,
        Tagging={"TagSet": [
            {"Key": "Project", "Value": PROJECT},
            {"Key": "DataClass", "Value": "synthetic-private"},
            {"Key": "ManagedBy", "Value": "viscue-provision-v1"},
        ]},
    )
    s3.put_bucket_policy(
        Bucket=bucket,
        Policy=json.dumps({
            "Version": "2012-10-17",
            "Statement": [{
                "Sid": "DenyInsecureTransport",
                "Effect": "Deny",
                "Principal": "*",
                "Action": "s3:*",
                "Resource": [f"arn:aws:s3:::{bucket}", f"arn:aws:s3:::{bucket}/*"],
                "Condition": {"Bool": {"aws:SecureTransport": "false"}},
            }],
        }),
    )
    return True


def _ensure_repository(session, dry_run: bool):
    ecr = session.client("ecr")
    try:
        repository = ecr.describe_repositories(
            repositoryNames=[REPOSITORY_NAME]
        )["repositories"][0]
        tags = ecr.list_tags_for_resource(
            resourceArn=repository["repositoryArn"]
        ).get("tags", [])
        _require_owned(tags, "container repository")
        return repository, False
    except ecr.exceptions.RepositoryNotFoundException:
        if dry_run:
            return None, True
        repository = ecr.create_repository(
            repositoryName=REPOSITORY_NAME,
            imageTagMutability="IMMUTABLE",
            imageScanningConfiguration={"scanOnPush": True},
            encryptionConfiguration={"encryptionType": "AES256"},
            tags=[
                {"Key": "Project", "Value": PROJECT},
                {"Key": "ManagedBy", "Value": "viscue-provision-v1"},
            ],
        )["repository"]
        ecr.put_lifecycle_policy(
            repositoryName=REPOSITORY_NAME,
            lifecyclePolicyText=json.dumps({
                "rules": [{
                    "rulePriority": 1,
                    "description": "Expire untagged development layers",
                    "selection": {
                        "tagStatus": "untagged", "countType": "sinceImagePushed",
                        "countUnit": "days", "countNumber": 7,
                    },
                    "action": {"type": "expire"},
                }]
            }),
        )
        return repository, True


def _ensure_role(session, bucket: str, repository_arn: str | None, region: str, account: str, dry_run: bool):
    iam = session.client("iam")
    try:
        role = iam.get_role(RoleName=ROLE_NAME)["Role"]
        tags = iam.list_role_tags(RoleName=ROLE_NAME).get("Tags", [])
        _require_owned(tags, "execution role")
        created = False
    except iam.exceptions.NoSuchEntityException:
        if dry_run:
            return None, True
        trust = {
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Service": "sagemaker.amazonaws.com"},
                "Action": "sts:AssumeRole",
            }],
        }
        role = iam.create_role(
            RoleName=ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(trust),
            Description="Least-privilege VIS CUE synthetic gesture jobs",
            MaxSessionDuration=3600,
            Tags=[
                {"Key": "Project", "Value": PROJECT},
                {"Key": "ManagedBy", "Value": "viscue-provision-v1"},
            ],
        )["Role"]
        created = True
    if dry_run:
        return role, created
    repository_resource = repository_arn or f"arn:aws:ecr:{region}:{account}:repository/{REPOSITORY_NAME}"
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "DatasetPrefixList",
                "Effect": "Allow",
                "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
                "Resource": f"arn:aws:s3:::{bucket}",
                "Condition": {"StringLike": {"s3:prefix": ["gesture", "gesture/*"]}},
            },
            {
                "Sid": "DatasetPrefixObjects",
                "Effect": "Allow",
                "Action": [
                    "s3:GetObject", "s3:GetObjectVersion", "s3:PutObject",
                    "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts",
                ],
                "Resource": f"arn:aws:s3:::{bucket}/gesture/*",
            },
            {
                "Sid": "EcrAuthorization",
                "Effect": "Allow",
                "Action": "ecr:GetAuthorizationToken",
                "Resource": "*",
            },
            {
                "Sid": "ProjectImagePull",
                "Effect": "Allow",
                "Action": [
                    "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage",
                ],
                "Resource": repository_resource,
            },
            {
                "Sid": "JobLogs",
                "Effect": "Allow",
                "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
                "Resource": f"arn:aws:logs:{region}:{account}:log-group:/aws/sagemaker/*:*",
            },
        ],
    }
    iam.put_role_policy(
        RoleName=ROLE_NAME,
        PolicyName="viscue-gesture-job-runtime",
        PolicyDocument=json.dumps(policy),
    )
    return role, created


def provision(region: str, config_path: Path, *, dry_run: bool) -> dict:
    session = boto3.Session(region_name=region)
    identity = session.client("sts").get_caller_identity()
    account = identity["Account"]
    account_hash = hashlib.sha256(account.encode()).hexdigest()[:12]
    bucket = f"viscue-gesture-{account_hash}-{region}".lower()
    try:
        bucket_created = _ensure_bucket(session, bucket, region, dry_run)
    except Exception as error:
        raise RuntimeError(f"private_dataset_bucket:{_failure_alias(error)}") from error
    try:
        repository, repository_created = _ensure_repository(session, dry_run)
    except Exception as error:
        raise RuntimeError(f"encrypted_container_repository:{_failure_alias(error)}") from error
    try:
        role, role_created = _ensure_role(
            session, bucket,
            repository.get("repositoryArn") if repository else None,
            region, account, dry_run,
        )
    except Exception as error:
        raise RuntimeError(f"least_privilege_execution_role:{_failure_alias(error)}") from error
    if not dry_run:
        manifest = json.loads(
            (config_path.parents[2] / "datasets" / "gesture-smoke-v1" / "manifest.json").read_text(encoding="utf-8")
        )
        config = {
            "region": region,
            "role_arn": role["Arn"],
            "image_uri": f"{account}.dkr.ecr.{region}.amazonaws.com/{REPOSITORY_NAME}:v1",
            "ecr_repository": REPOSITORY_NAME,
            "bucket": bucket,
            "output_prefix": "gesture/smoke-v1",
            "dataset_version": manifest["dataset_version"],
            "source_sha256": manifest["generator"]["source_tree_sha256"],
            "dataset_sha256": hashlib.sha256(
                (config_path.parents[2] / "datasets" / "gesture-smoke-v1" / "manifest.json").read_bytes()
            ).hexdigest(),
            "cost_center": "research",
            "instance_type": "ml.m5.large",
            "instance_count": 1,
            "volume_size_gb": 30,
            "max_runtime_seconds": 1800,
            "hourly_ceiling_usd": 4.0,
            "personas": 1000,
            "samples": 10000,
            "seed": 20260827,
        }
        config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    return {
        "dry_run": dry_run,
        "planned_or_created": {
            "private_dataset_bucket": bucket_created,
            "encrypted_container_repository": repository_created,
            "least_privilege_execution_role": role_created,
        },
        "configuration_written": not dry_run,
        "sagemaker_job_started": False,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument(
        "--config-out",
        default=str(Path(__file__).resolve().with_name("config.local.json")),
    )
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args(argv)
    try:
        result = provision(args.region, Path(args.config_out).resolve(), dry_run=not args.execute)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as error:
        print(json.dumps({
            "dry_run": not args.execute,
            "failure_code": type(error).__name__,
            "message": str(error) if isinstance(error, RuntimeError) else "AWS provisioning failed",
            "sagemaker_job_started": False,
        }, indent=2, sort_keys=True))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
