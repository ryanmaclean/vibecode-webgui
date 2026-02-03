#!/usr/bin/env python3
"""Package Lima/Colima IDE benchmark artifacts for release."""

from __future__ import annotations

import hashlib
import shutil
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

README_CONTENT = """\
# IDE Virtualization Benchmarks

This package contains configuration and measurement artifacts for the Lima and Colima fast-IDE experiments on Intel macOS (October 2, 2025).

## Contents

- `config/ide-lima.yaml` – Lima instance definition (Alpine, no containerd, vim preinstalled).
- `config/aegis/` – (optional) cloud-init user/meta-data used by the secure QEMU prototype.
- `results/vim-lima.json` – Vim launch timings (native vs. Lima variants) from `scripts/benchmarks/vim_hypervisor_bench.py`.
- `results/vim-bench.json` – Previous QEMU timings (if available).

## Reproduction Notes

1. `limactl create --name ide-lima config/ide-lima.yaml`
2. `limactl start ide-lima`
3. `scripts/benchmarks/vim_hypervisor_bench.py --runs 3 --output results.json`
4. `colima start --cpu 2 --memory 4 --disk 20`
5. `docker run -d -p 127.0.0.1:24444:8080 codercom/code-server:latest --auth none --disable-telemetry`

Adjust DNS to Quad9 (`9.9.9.9`) for best performance.
"""


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


def compute_sha256(path: Path) -> str:
    """Compute SHA256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def copy_if_exists(src: Path, dst: Path) -> bool:
    """Copy file if it exists, return True if copied."""
    if src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, dst)
        return True
    return False


def main() -> int:
    """Main entry point."""
    root_dir = get_project_root()
    dist_dir = root_dir / "dist"
    asset_dir = root_dir / "vm-assets"

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_path = dist_dir / f"ide-benchmarks-{timestamp}.tar.gz"
    sha_path = Path(str(archive_path) + ".sha256")

    dist_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        config_dir = tmp_path / "config"
        results_dir = tmp_path / "results"

        config_dir.mkdir(parents=True, exist_ok=True)
        results_dir.mkdir(parents=True, exist_ok=True)

        # Copy Lima config
        lima_config = asset_dir / "ide-lima.yaml"
        if lima_config.exists():
            shutil.copy(lima_config, config_dir / "ide-lima.yaml")

        # Copy aegis cloud-init files if present
        aegis_dir = asset_dir / "aegis"
        if aegis_dir.exists():
            aegis_config_dir = config_dir / "aegis"
            aegis_config_dir.mkdir(parents=True, exist_ok=True)
            copy_if_exists(aegis_dir / "user-data", aegis_config_dir / "user-data")
            copy_if_exists(aegis_dir / "meta-data", aegis_config_dir / "meta-data")

        # Copy recent benchmark outputs if they exist
        copy_if_exists(Path("/tmp/vim-lima.json"), results_dir / "vim-lima.json")
        copy_if_exists(Path("/tmp/vim-bench.json"), results_dir / "vim-bench.json")

        # Create README
        (tmp_path / "README.md").write_text(README_CONTENT)

        # Create archive
        with tarfile.open(archive_path, "w:gz") as tar:
            for item in tmp_path.iterdir():
                tar.add(item, arcname=item.name)

    # Create checksum
    checksum = compute_sha256(archive_path)
    sha_content = f"{checksum}  {archive_path.name}\n"
    sha_path.write_text(sha_content)

    print(f"Created {archive_path}")
    print(sha_content.strip())

    return 0


if __name__ == "__main__":
    sys.exit(main())
