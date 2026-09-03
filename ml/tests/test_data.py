import hashlib
import json
from pathlib import Path

import pytest

from viscue_ml.data import GestureDataset, IntegrityError


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "datasets" / "gesture-smoke-v1" / "manifest.json"


def test_loader_exposes_only_model_contract_fields():
    row = next(iter(GestureDataset(MANIFEST, split="train")))
    assert set(row) == {
        "sequence", "sequence_mask", "geometry", "nodes", "node_mask",
        "context", "label", "family",
    }
    assert len(row["sequence"]) == 4
    assert len(row["sequence"][0]) == 128
    assert len(row["geometry"]) == 48
    assert len(row["nodes"]) == 32
    assert len(row["nodes"][0]) == 14
    assert len(row["context"]) == 24


def test_loader_refuses_manifest_tampering(tmp_path):
    dataset_dir = MANIFEST.parent
    copied_manifest = tmp_path / "manifest.json"
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    copied_manifest.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "frozen.json").write_text(
        (dataset_dir / "frozen.json").read_text(encoding="utf-8"), encoding="utf-8"
    )
    with pytest.raises(IntegrityError, match="manifest"):
        GestureDataset(copied_manifest, split="train")


def test_loader_refuses_shard_hash_mismatch(tmp_path):
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    source = MANIFEST.parent
    (tmp_path / "manifest.json").write_bytes(MANIFEST.read_bytes())
    (tmp_path / "frozen.json").write_bytes((source / "frozen.json").read_bytes())
    shard_dir = tmp_path / "shards"
    shard_dir.mkdir()
    for shard in manifest["shards"]:
        target = tmp_path / shard["path"]
        target.write_bytes((source / shard["path"]).read_bytes())
    first = tmp_path / manifest["shards"][0]["path"]
    first.write_bytes(first.read_bytes() + b"tampered")
    with pytest.raises(IntegrityError, match="shard"):
        GestureDataset(tmp_path / "manifest.json", split="train")
