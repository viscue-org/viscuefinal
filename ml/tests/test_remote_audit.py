import hashlib
import importlib.util
import json
from pathlib import Path

import pytest


MODULE_PATH = Path(__file__).parents[1] / "sagemaker" / "remote_audit.py"
SPEC = importlib.util.spec_from_file_location("viscue_remote_audit", MODULE_PATH)
remote_audit = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(remote_audit)


def _manifest():
    seed = 17
    start = seed * 1_000_003
    return {
        "total_samples": 3,
        "configuration": {"samples": 3, "seed": seed},
        "shards": [
            {"path": "shards/shard-00000.jsonl.gz", "sha256": "a" * 64, "records": 2,
             "seed_range": {"start": str(start), "end_exclusive": str(start + 2)}},
            {"path": "shards/shard-00001.jsonl.gz", "sha256": "b" * 64, "records": 1,
             "seed_range": {"start": str(start + 2), "end_exclusive": str(start + 3)}},
        ],
    }


def test_manifest_shards_are_contiguous_and_path_confined():
    result = remote_audit.validate_manifest_shards(_manifest())
    assert result == {
        "shards/shard-00000.jsonl.gz": "a" * 64,
        "shards/shard-00001.jsonl.gz": "b" * 64,
    }


@pytest.mark.parametrize("mutation", ["escape", "gap"])
def test_manifest_shards_reject_escape_and_seed_gaps(mutation):
    manifest = _manifest()
    if mutation == "escape":
        manifest["shards"][0]["path"] = "../outside.jsonl.gz"
    else:
        manifest["shards"][1]["seed_range"]["start"] = "999"
    with pytest.raises(ValueError):
        remote_audit.validate_manifest_shards(manifest)


def test_freeze_binds_exact_manifest_audit_and_shard_hashes():
    manifest_bytes = b'{"manifest":true}\n'
    audit_bytes = b'{"audit":true}\n'
    hashes = {"shards/a.jsonl.gz": "c" * 64}
    freeze = remote_audit.build_freeze(manifest_bytes, audit_bytes, hashes)
    assert freeze == {
        "schema_version": "dataset-freeze/1.0",
        "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "shard_hashes": hashes,
        "audit_sha256": hashlib.sha256(audit_bytes).hexdigest(),
    }
