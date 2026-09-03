"""Run the deterministic Node generator inside an AWS-managed Python image."""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import subprocess
import tarfile
import tempfile
import warnings
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_extract(archive: tarfile.TarFile, destination: Path) -> None:
    root = destination.resolve()
    members = archive.getmembers()
    member_names = {posixpath.normpath(member.name) for member in members}
    for member in members:
        resolved = (root / member.name).resolve()
        if root != resolved and root not in resolved.parents:
            raise RuntimeError("archive path escape rejected")
        if member.islnk():
            raise RuntimeError("archive hard links are rejected")
        if member.issym():
            if posixpath.isabs(member.linkname):
                raise RuntimeError("archive link target escape rejected")
            target = posixpath.normpath(
                posixpath.join(posixpath.dirname(member.name), member.linkname)
            )
            if target == ".." or target.startswith("../") or target not in member_names:
                raise RuntimeError("archive link target escape rejected")
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Python 3.14 will, by default, filter extracted tar archives",
            category=DeprecationWarning,
        )
        archive.extractall(root)


def run(args) -> dict:
    source_archive = Path(args.source_archive)
    node_archive = Path(args.node_archive)
    if sha256(source_archive) != args.source_sha256:
        raise RuntimeError("source archive hash mismatch")
    if sha256(node_archive) != args.node_sha256:
        raise RuntimeError("Node runtime hash mismatch")
    output = Path(args.output).resolve()
    allowed = Path("/opt/ml/processing/output/dataset").resolve()
    if output != allowed:
        raise RuntimeError("output must be the SageMaker dataset directory")
    with tempfile.TemporaryDirectory(prefix="viscue-managed-") as temporary:
        temporary = Path(temporary)
        source = temporary / "source"
        runtime = temporary / "runtime"
        source.mkdir(); runtime.mkdir()
        with tarfile.open(source_archive, "r:gz") as archive:
            safe_extract(archive, source)
        with tarfile.open(node_archive, "r:xz") as archive:
            safe_extract(archive, runtime)
        nodes = list(runtime.glob("node-*/bin/node"))
        if len(nodes) != 1:
            raise RuntimeError("Node runtime layout is invalid")
        cli = source / "gesture" / "dataset" / "cli.mjs"
        commands = [
            [str(nodes[0]), str(cli), "generate", "--personas", str(args.personas),
             "--samples", str(args.samples), "--seed", str(args.seed), "--out", str(output)],
            [str(nodes[0]), str(cli), "audit", "--dataset", str(output)],
            [str(nodes[0]), str(cli), "freeze", "--dataset", str(output)],
        ]
        for command in commands:
            subprocess.run(command, cwd=source, check=True)
    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    report = {
        "schema_version": "managed-generation/1.0", "passed": True,
        "phase": args.phase, "samples": manifest["total_samples"],
        "manifest_sha256": sha256(output / "manifest.json"), "synthetic_only": True,
        "production_accuracy_claim": False,
    }
    (output / "managed-job-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-archive", required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--node-archive", required=True)
    parser.add_argument("--node-sha256", required=True)
    parser.add_argument("--phase", choices=("medium", "full"), required=True)
    parser.add_argument("--personas", type=int, required=True)
    parser.add_argument("--samples", type=int, required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--output", default="/opt/ml/processing/output/dataset")
    args = parser.parse_args(argv)
    print(json.dumps(run(args), sort_keys=True))


if __name__ == "__main__":
    main()
