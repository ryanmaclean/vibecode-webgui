#!/usr/bin/env python3
"""CI helper: package microVM artifacts and capture readiness metrics for each arch.

Usage:
    scripts/ci/package_microvm.py [iterations]

Environment:
    MICROVM_CI_ARCHES   comma-separated list of arches (default: x86_64,arm64)
    MICROVM_CI_OUTPUT   directory for JSON metrics (default: reports/benchmarks)
    MICROVM_DIR_X86     optional override for x86_64 tree (default: fast-openvscode-vm)
    MICROVM_DIR_ARM64   optional override for arm64 tree (default: fast-openvscode-vm-arm64)
    MICROVM_SKIP_MEASURE if set, packaging runs without benchmarks (useful for dry runs)
"""

from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class ArchConfig:
    """Configuration for a specific architecture."""

    name: str
    directory: str
    port: int


@dataclass
class PackageConfig:
    """Package configuration."""

    iterations: int = 3
    arches: list[str] = field(default_factory=lambda: ["x86_64", "arm64"])
    output_root: Path = field(default_factory=lambda: Path("reports/benchmarks"))
    skip_measure: bool = False
    x86_dir: str = "fast-openvscode-vm"
    arm64_dir: str = "fast-openvscode-vm-arm64"
    scripts_dir: Path = field(
        default_factory=lambda: Path(__file__).parent.parent.resolve()
    )

    @property
    def timestamp(self) -> str:
        """Get UTC timestamp for filenames."""
        return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    def get_arch_config(self, arch: str) -> ArchConfig | None:
        """Get configuration for an architecture.

        Args:
            arch: Architecture name.

        Returns:
            ArchConfig or None if unknown arch.
        """
        if arch == "x86_64":
            return ArchConfig(name=arch, directory=self.x86_dir, port=3600)
        elif arch == "arm64":
            return ArchConfig(name=arch, directory=self.arm64_dir, port=4600)
        return None

    @classmethod
    def from_env(cls, iterations: int | None = None) -> "PackageConfig":
        """Create config from environment variables.

        Args:
            iterations: Optional iterations override.

        Returns:
            PackageConfig instance.
        """
        arches_str = os.environ.get("MICROVM_CI_ARCHES", "x86_64,arm64")
        arches = [a.strip() for a in arches_str.split(",") if a.strip()]

        output_str = os.environ.get("MICROVM_CI_OUTPUT", "reports/benchmarks")

        return cls(
            iterations=iterations or 3,
            arches=arches,
            output_root=Path(output_str),
            skip_measure=bool(os.environ.get("MICROVM_SKIP_MEASURE")),
            x86_dir=os.environ.get("MICROVM_DIR_X86", "fast-openvscode-vm"),
            arm64_dir=os.environ.get("MICROVM_DIR_ARM64", "fast-openvscode-vm-arm64"),
        )


def log(msg: str) -> None:
    """Print log message with prefix.

    Args:
        msg: Message to print.
    """
    print(f"[microvm-ci] {msg}")


def measure_arch(
    arch: str,
    outfile: Path,
    iterations: int,
    scripts_dir: Path,
    skip: bool = False,
) -> bool:
    """Run benchmark and save JSON.

    Args:
        arch: Architecture name.
        outfile: Output JSON file path.
        iterations: Number of iterations.
        scripts_dir: Path to scripts directory.
        skip: Whether to skip measurement.

    Returns:
        True if successful or skipped.
    """
    if skip:
        log(f"Skipping benchmark for {arch} (MICROVM_SKIP_MEASURE set)")
        return True

    log(f"Benchmarking {arch} (iterations={iterations})")

    benchmark_script = scripts_dir / "benchmarks" / "vscode_microvm.sh"

    if not benchmark_script.exists():
        log(f"Warning: benchmark script not found: {benchmark_script}")
        outfile.write_text("{}\n")
        return True

    try:
        env = os.environ.copy()
        env["MICROVM_ARCH"] = arch

        result = subprocess.run(
            [str(benchmark_script), "measure", str(iterations)],
            capture_output=True,
            text=True,
            timeout=600,
            env=env,
        )

        if result.returncode == 0:
            outfile.write_text(result.stdout)
            return True
        else:
            log(f"Warning: benchmark for {arch} failed; leaving empty JSON")
            outfile.write_text("{}\n")
            return True

    except subprocess.TimeoutExpired:
        log(f"Warning: benchmark for {arch} timed out; leaving empty JSON")
        outfile.write_text("{}\n")
        return True
    except OSError as e:
        log(f"Warning: failed to run benchmark for {arch}: {e}")
        outfile.write_text("{}\n")
        return True


def package_dir(directory: str, scripts_dir: Path) -> bool:
    """Package a directory.

    Args:
        directory: Directory name to package.
        scripts_dir: Path to scripts directory.

    Returns:
        True if successful.
    """
    log(f"Packaging {directory}")

    package_script = scripts_dir / "release" / "package-fast-openvscode-vm.sh"

    # Try shell script first, fall back to Python
    if not package_script.exists():
        package_script = scripts_dir / "release" / "package_fast_openvscode_vm.py"

    if not package_script.exists():
        log(f"Warning: package script not found")
        return False

    try:
        result = subprocess.run(
            [str(package_script), directory],
            timeout=300,
        )
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        log(f"Warning: packaging {directory} timed out")
        return False
    except OSError as e:
        log(f"Warning: failed to package {directory}: {e}")
        return False


def package_microvm(config: PackageConfig | None = None) -> int:
    """Package microVM artifacts for all architectures.

    Args:
        config: Package configuration (uses env if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = PackageConfig.from_env()

    # Create output directory
    try:
        config.output_root.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        log(f"Failed to create output directory: {e}")
        return 1

    timestamp = config.timestamp
    processed = 0

    for arch in config.arches:
        arch_config = config.get_arch_config(arch)

        if arch_config is None:
            log(f"Unknown arch {arch} – skipping")
            continue

        # Check if directory exists
        if not Path(arch_config.directory).is_dir():
            log(f"Directory {arch_config.directory} not found; skipping {arch}")
            continue

        # Run benchmark
        outfile = config.output_root / f"microvm-{arch}-{timestamp}.json"
        measure_arch(
            arch,
            outfile,
            config.iterations,
            config.scripts_dir,
            config.skip_measure,
        )

        # Package directory
        package_dir(arch_config.directory, config.scripts_dir)

        log(f"Completed {arch} (JSON + tarballs in dist/)")
        log(f"Endpoints: http://127.0.0.1:{arch_config.port}/healthz during benchmark")

        processed += 1

    return 0 if processed > 0 else 1


def main() -> int:
    """Main entry point."""
    iterations = None
    if len(sys.argv) > 1:
        try:
            iterations = int(sys.argv[1])
        except ValueError:
            print(f"Usage: {sys.argv[0]} [iterations]", file=sys.stderr)
            return 1

    config = PackageConfig.from_env(iterations)
    return package_microvm(config)


if __name__ == "__main__":
    sys.exit(main())
