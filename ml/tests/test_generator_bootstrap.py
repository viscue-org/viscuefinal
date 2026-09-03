import importlib.util
import io
import tarfile
from pathlib import Path

import pytest


MODULE_PATH = Path(__file__).parents[1] / "sagemaker" / "generator_bootstrap.py"
SPEC = importlib.util.spec_from_file_location("viscue_generator_bootstrap", MODULE_PATH)
generator_bootstrap = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(generator_bootstrap)


def _archive_with_link(path: Path, *, link_name: str, link_target: str) -> None:
    with tarfile.open(path, "w:gz") as archive:
        payload = b"console.log('ok')\n"
        file_info = tarfile.TarInfo("node/lib/tool.js")
        file_info.size = len(payload)
        archive.addfile(file_info, io.BytesIO(payload))

        link_info = tarfile.TarInfo(link_name)
        link_info.type = tarfile.SYMTYPE
        link_info.linkname = link_target
        archive.addfile(link_info)


def test_safe_extract_accepts_internal_relative_symlink(tmp_path):
    archive_path = tmp_path / "node.tar.gz"
    _archive_with_link(
        archive_path,
        link_name="node/bin/tool",
        link_target="../lib/tool.js",
    )

    with tarfile.open(archive_path, "r:gz") as archive:
        generator_bootstrap.safe_extract(archive, tmp_path / "out")

    assert (tmp_path / "out" / "node" / "lib" / "tool.js").read_bytes() == b"console.log('ok')\n"


@pytest.mark.parametrize("target", ["../../../outside", "/absolute/outside"])
def test_safe_extract_rejects_symlink_target_outside_archive(tmp_path, target):
    archive_path = tmp_path / "unsafe.tar.gz"
    _archive_with_link(
        archive_path,
        link_name="node/bin/tool",
        link_target=target,
    )

    with tarfile.open(archive_path, "r:gz") as archive:
        with pytest.raises(RuntimeError, match="link target escape"):
            generator_bootstrap.safe_extract(archive, tmp_path / "out")
