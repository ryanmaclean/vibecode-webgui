#!/usr/bin/env python3
"""Quick validation test for musl builds.

Tests BusyBox binary functionality and Docker image builds.
"""

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# Colors for output
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
NC = '\033[0m'


@dataclass
class TestResults:
    """Test results."""

    passed: int = 0
    failed: int = 0


def log(msg: str) -> None:
    """Print log message."""
    print(f"[INFO] {msg}")


def success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}+{NC} {msg}")


def error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}x{NC} {msg}")


def warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}!{NC} {msg}")


def run_command(cmd: list[str], capture: bool = True) -> tuple[int, str, str]:
    """Run a command."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True
        )
        return result.returncode, result.stdout or "", result.stderr or ""
    except FileNotFoundError:
        return -1, "", "command not found"


def run_test(name: str, test_func: callable, results: TestResults) -> bool:
    """Run a test and track results."""
    log(f"Testing: {name}")
    try:
        if test_func():
            success(name)
            results.passed += 1
            return True
        else:
            error(f"{name} FAILED")
            results.failed += 1
            return False
    except Exception as e:
        error(f"{name} FAILED: {e}")
        results.failed += 1
        return False


def find_busybox_binary(busybox_dir: Path) -> Optional[Path]:
    """Find BusyBox binary in directory."""
    for f in busybox_dir.glob("busybox-*-musl-*"):
        if f.is_file() and not f.name.endswith((".json", ".gz")):
            return f
    return None


def run_tests(project_root: Path) -> TestResults:
    """Run all tests."""
    results = TestResults()

    log("=" * 60)
    log("Musl Build Validation Tests")
    log("=" * 60)
    print()

    # Test 1: Check if build scripts exist
    build_script = project_root / "scripts" / "benchmarks" / "build-busybox-musl.sh"
    run_test(
        "Build scripts exist",
        lambda: build_script.exists(),
        results
    )

    docker_script = project_root / "scripts" / "benchmarks" / "docker-musl-vs-glibc.sh"
    run_test(
        "Docker comparison script exists",
        lambda: docker_script.exists(),
        results
    )

    if build_script.exists():
        import os
        run_test(
            "Scripts are executable",
            lambda: os.access(build_script, os.X_OK),
            results
        )

    # Test 2: Check for BusyBox binary
    busybox_dir = project_root / "bench-images" / "busybox"
    if busybox_dir.is_dir():
        busybox_bin = find_busybox_binary(busybox_dir)

        if busybox_bin:
            success(f"Found BusyBox binary: {busybox_bin}")

            # Test executable
            import os
            run_test(
                "BusyBox is executable",
                lambda: os.access(busybox_bin, os.X_OK),
                results
            )

            # Test basic commands
            run_test(
                "BusyBox --help",
                lambda: run_command([str(busybox_bin), "--help"])[0] == 0,
                results
            )

            run_test(
                "BusyBox echo",
                lambda: "test" in run_command([str(busybox_bin), "echo", "test"])[1],
                results
            )

            run_test(
                "BusyBox ls",
                lambda: run_command([str(busybox_bin), "ls", "/tmp"])[0] == 0,
                results
            )

            # Check static linking
            rc, stdout, _ = run_command(["file", str(busybox_bin)])
            if "statically linked" in stdout:
                success("BusyBox is statically linked")
                results.passed += 1
            else:
                warning("BusyBox is NOT statically linked")
                print(f"  {stdout.strip()}")
                results.failed += 1

            # Check size
            size = busybox_bin.stat().st_size
            size_mb = size / 1024 / 1024
            if size_mb < 3:
                success(f"BusyBox size is optimal: {size_mb:.2f}MB")
                results.passed += 1
            else:
                warning(f"BusyBox size is larger than expected: {size_mb:.2f}MB")
                results.failed += 1

            # Check metadata
            metadata_files = list(busybox_dir.glob("*.json"))
            if metadata_files:
                metadata = metadata_files[-1]
                rc, _, _ = run_command(["jq", "empty", str(metadata)])
                run_test(
                    "Metadata JSON is valid",
                    lambda: rc == 0,
                    results
                )
                success(f"Metadata found: {metadata}")
            else:
                error("No metadata JSON found")
                results.failed += 1

            # Check initramfs
            initramfs_files = list(busybox_dir.glob("*initramfs*.cpio.gz"))
            if initramfs_files:
                initramfs = initramfs_files[-1]
                success(f"Initramfs found: {initramfs}")
                size = initramfs.stat().st_size
                size_mb = size / 1024 / 1024
                log(f"Initramfs size: {size_mb:.2f}MB")

                # Verify it's a valid gzip archive
                rc, _, _ = run_command(["gzip", "-t", str(initramfs)])
                run_test(
                    "Initramfs is valid gzip",
                    lambda: rc == 0,
                    results
                )
                results.passed += 1
            else:
                error("No initramfs found")
                results.failed += 1
        else:
            error("No BusyBox binary found in bench-images/busybox")
            warning("Run: ./scripts/benchmarks/build-busybox-musl.sh")
            results.failed += 5
    else:
        error("bench-images/busybox directory not found")
        results.failed += 5

    # Test Docker comparison results
    docker_results_dir = project_root / "performance-results" / "docker-builds"
    if docker_results_dir.is_dir():
        results_files = list(docker_results_dir.glob("musl-vs-glibc-*.json"))
        if results_files:
            latest = results_files[-1]
            success(f"Found Docker comparison results: {latest}")

            rc, _, _ = run_command(["jq", "empty", str(latest)])
            run_test(
                "Docker results JSON is valid",
                lambda: rc == 0,
                results
            )

            # Check for build data
            rc, stdout, _ = run_command(["jq", "-e", ".builds.musl", str(latest)])
            if rc == 0:
                success("musl build data present")
                results.passed += 1
            else:
                warning("musl build data missing")
                results.failed += 1

            rc, stdout, _ = run_command(["jq", "-e", ".builds.glibc", str(latest)])
            if rc == 0:
                success("glibc build data present")
                results.passed += 1
            else:
                warning("glibc build data missing (may be expected)")
        else:
            warning("No Docker comparison results found")
            warning("Run: ./scripts/benchmarks/docker-musl-vs-glibc.sh")
    else:
        warning("performance-results/docker-builds directory not found")

    return results


def print_summary(results: TestResults) -> int:
    """Print test summary and return exit code."""
    print()
    log("=" * 60)
    log("Test Summary")
    log("=" * 60)
    log(f"Tests passed: {GREEN}{results.passed}{NC}")
    log(f"Tests failed: {RED}{results.failed}{NC}")

    if results.failed == 0:
        print()
        success("All tests passed!")
        print()
        log("Next steps:")
        log("  1. Review build artifacts in bench-images/busybox/")
        log("  2. Run Docker comparison: ./scripts/benchmarks/docker-musl-vs-glibc.sh")
        log("  3. Push to trigger CI: git push origin main")
        log("  4. Check Datadog for metrics: https://app.datadoghq.com")
        return 0
    else:
        print()
        error(f"{results.failed} test(s) failed")
        print()
        log("To fix:")
        log("  1. Run BusyBox build: ./scripts/benchmarks/build-busybox-musl.sh")
        log("  2. Run Docker comparison: ./scripts/benchmarks/docker-musl-vs-glibc.sh")
        log("  3. Check build logs for errors")
        return 1


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Quick validation test for musl builds"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=None,
        help="Project root directory"
    )

    args = parser.parse_args()

    if args.project_root:
        project_root = args.project_root
    else:
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent.parent

    results = run_tests(project_root)
    return print_summary(results)


if __name__ == "__main__":
    sys.exit(main())
