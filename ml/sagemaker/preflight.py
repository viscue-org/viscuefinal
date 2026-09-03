"""Read-only, redacted AWS/Docker preflight for gesture simulation jobs."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path


SECRET_PATTERNS = (
    re.compile(rb"AKIA[0-9A-Z]{16}"),
    re.compile(rb"aws_secret_access_key", re.I),
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


def build_context_has_no_credentials(workspace: Path) -> bool:
    included = [
        workspace / "gesture",
        workspace / "scripts" / "source-manifest.mjs",
        workspace / "artifacts" / "manifests" / "source-current.json",
        workspace / "ml" / "sagemaker" / "simulator",
    ]
    files = []
    for path in included:
        if path.is_file():
            files.append(path)
        elif path.is_dir():
            files.extend(candidate for candidate in path.rglob("*") if candidate.is_file())
    for path in files:
        lowered = path.name.lower()
        if lowered in {"credentials", ".env", "id_rsa", "id_ed25519"}:
            return False
        if path.stat().st_size <= 2_000_000:
            content = path.read_bytes()
            if any(pattern.search(content) for pattern in SECRET_PATTERNS):
                return False
    return True


def docker_available() -> bool:
    if not shutil.which("docker"):
        return False
    result = subprocess.run(
        ["docker", "version", "--format", "{{.Server.Version}}"],
        capture_output=True, text=True, timeout=10, check=False,
    )
    return result.returncode == 0 and bool(result.stdout.strip())


def run_preflight(config: dict, workspace: Path, *, session=None) -> dict:
    checks = {
        "credentials_in_build_context_absent": build_context_has_no_credentials(workspace),
        "docker_available": docker_available(),
        "region_configured": bool(config.get("region")),
        "caller_identity_readable": False,
        "execution_role_readable": False,
        "bucket_versioning_enabled": False,
        "bucket_encryption_enabled": False,
        "ecr_repository_readable": False,
        "sagemaker_list_permission": False,
        "service_quotas_readable": False,
    }
    failures = []
    def attempt(name, operation, predicate=lambda value: True):
        try:
            checks[name] = bool(predicate(operation()))
            if not checks[name]:
                failures.append(f"{name}:RequirementNotMet")
        except Exception as error:
            checks[name] = False
            failures.append(f"{name}:{type(error).__name__}")

    try:
        if session is None:
            import boto3
            session = boto3.Session(region_name=config.get("region"))
        attempt("caller_identity_readable", lambda: session.client("sts").get_caller_identity())
        role_name = str(config.get("role_arn", "")).rsplit("/", 1)[-1]
        attempt("execution_role_readable", lambda: session.client("iam").get_role(RoleName=role_name))
        s3 = session.client("s3")
        attempt(
            "bucket_versioning_enabled",
            lambda: s3.get_bucket_versioning(Bucket=config["bucket"]),
            lambda value: value.get("Status") == "Enabled",
        )
        attempt(
            "bucket_encryption_enabled",
            lambda: s3.get_bucket_encryption(Bucket=config["bucket"]),
            lambda value: bool(value.get("ServerSideEncryptionConfiguration", {}).get("Rules")),
        )
        attempt(
            "ecr_repository_readable",
            lambda: session.client("ecr").describe_repositories(
                repositoryNames=[config["ecr_repository"]]
            ),
        )
        sage = session.client("sagemaker")
        attempt(
            "sagemaker_list_permission",
            lambda: (sage.list_processing_jobs(MaxResults=1), sage.list_training_jobs(MaxResults=1)),
        )
        attempt(
            "service_quotas_readable",
            lambda: session.client("service-quotas").list_service_quotas(
                ServiceCode="sagemaker", MaxResults=1
            ),
        )
    except Exception as error:  # Session/client construction only; never expose details.
        failures.append(f"aws_session:{type(error).__name__}")
    return {
        "schema_version": "sagemaker-preflight/1.0",
        "read_only": True,
        "checks": checks,
        "failure_codes": sorted(set(failures)),
        "passed": all(checks.values()),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--workspace", default=str(Path(__file__).resolve().parents[2]))
    args = parser.parse_args(argv)
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    report = run_preflight(config, Path(args.workspace).resolve())
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
