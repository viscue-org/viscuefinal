"""Integrity-checked streaming access to frozen gesture datasets."""

from __future__ import annotations

import gzip
import hashlib
import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any


PUBLIC_FIELDS = (
    "sequence", "sequence_mask", "geometry", "nodes", "node_mask", "context",
)


class IntegrityError(RuntimeError):
    """Raised before dataset bytes are consumed when a freeze seal is invalid."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class GestureDataset:
    """A split-filtered, leakage-resistant view of a frozen JSONL dataset.

    Construction verifies the freeze, manifest, audit report, and every shard. The
    iterator then exposes only the model contract and the supervised target.
    """

    def __init__(self, manifest_path: str | Path, *, split: str):
        self.manifest_path = Path(manifest_path).resolve()
        self.root = self.manifest_path.parent
        self.split = split
        self.manifest = self._verify_freeze()
        if split not in self.manifest.get("splits", {}):
            raise ValueError(f"unknown dataset split: {split}")

    def _verify_freeze(self) -> dict[str, Any]:
        freeze_path = self.root / "frozen.json"
        if not freeze_path.is_file():
            raise IntegrityError("dataset has no frozen.json seal")
        freeze = json.loads(freeze_path.read_text(encoding="utf-8"))
        if freeze.get("schema_version") != "dataset-freeze/1.0":
            raise IntegrityError("unsupported freeze schema")
        if _sha256(self.manifest_path) != freeze.get("manifest_sha256"):
            raise IntegrityError("manifest hash does not match frozen seal")

        manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        if manifest.get("schema_version") != "dataset-manifest/1.0":
            raise IntegrityError("unsupported manifest schema")
        sealed_shards = freeze.get("shard_hashes", {})
        listed = {entry["path"]: entry for entry in manifest.get("shards", [])}
        if set(listed) != set(sealed_shards):
            raise IntegrityError("manifest shard set does not match frozen seal")
        for relative_path, entry in listed.items():
            shard_path = self.root / relative_path
            actual = _sha256(shard_path) if shard_path.is_file() else None
            expected = entry.get("sha256")
            if actual != expected or actual != sealed_shards[relative_path]:
                raise IntegrityError(f"shard hash mismatch: {relative_path}")

        audit_path = self.root / "audit-report.json"
        if freeze.get("audit_sha256") and (
            not audit_path.is_file() or _sha256(audit_path) != freeze["audit_sha256"]
        ):
            raise IntegrityError("audit report hash does not match frozen seal")
        return manifest

    def _iter_records(self) -> Iterator[dict[str, Any]]:
        for shard in self.manifest["shards"]:
            with gzip.open(self.root / shard["path"], "rt", encoding="utf-8") as stream:
                for line in stream:
                    record = json.loads(line)
                    if record.get("split") == self.split:
                        yield record

    def __iter__(self) -> Iterator[dict[str, Any]]:
        for record in self._iter_records():
            inputs = record["model_input"]
            truth = record["ground_truth"]
            yield {
                **{field: inputs[field] for field in PUBLIC_FIELDS},
                "label": truth["intent"],
                "family": truth["family"],
            }

    def __len__(self) -> int:
        split = self.manifest["splits"][self.split]
        if "records" in split:
            return int(split["records"])
        return sum(1 for _ in self._iter_records())
