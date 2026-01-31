#!/usr/bin/env python3
"""Quick validation test for musl builds.

Tests BusyBox binary functionality and Docker image builds.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        file_size_bytes,
        log,
        run_cmd,
        success,
        warn,
        error as log_error,
        Colors,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        file_size_bytes,
        log,
        run_cmd,
        success,
        warn,
        error as log_error,
        Colors,
    )


class TestRunner:
    """Test runner for musl builds."""

    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0

    def run_test(self, name: str, condition: bool) -> bool:
        """Run a test and track results."""
        log(f"Testing: {name}")

        if condition:
            success(name)
            self.tests_passed += 1
            return True
        else:
            log_error(f"{name} FAILED")
            self.tests_failed += 1
            return False


def find_busybox_binary(busybox_dir: Path) -> Path | None:
    """Find BusyBox binary in the build directory."""
    for f in busybox_dir.rglob("busybox-*-musl-*"):
        if f.is_file() and not f.suffix in (".json", ".gz"):
            return f
    return None


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--busybox-dir",
        type=Path,
        default=REPO_ROOT / "bench-images" / "busybox",
        help="BusyBox build directory",
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=REPO_ROOT / "performance-results" / "docker-builds",
        help="Docker build results directory",
    )

    args = parser.parse_args(argv)

    runner = TestRunner()

    log("=" * 56)
    log("Musl Build Validation Tests")
    log("=" * 56)
    print()

    os.chdir(REPO_ROOT)

    # Test 1: Check if build scripts exist
    runner.run_test(
        "Build scripts exist",
        (REPO_ROOT / "scripts" / "benchmarks" / "build-busybox-musl.sh").exists()
    )
    runner.run_test(
        "Docker comparison script exists",
        (REPO_ROOT / "scripts" / "benchmarks" / "docker-musl-vs-glibc.sh").exists()
    )
    runner.run_test(
        "Scripts are executable",
        os.access(REPO_ROOT / "scripts" / "benchmarks" / "build-busybox-musl.sh", os.X_OK)
    )

    # Test 2: Check for BusyBox binary
    if args.busybox_dir.exists():
        busybox_bin = find_busybox_binary(args.busybox_dir)

        if busybox_bin and busybox_bin.exists():
            success(f"Found BusyBox binary: {busybox_bin}")

            # Test 3: Verify it's executable
            runner.run_test("BusyBox is executable", os.access(busybox_bin, os.X_OK))

            # Test 4: Test basic commands
            try:
                result = subprocess.run(
                    [str(busybox_bin), "--help"],
                    capture_output=True,
                    timeout=5,
                )
                runner.run_test("BusyBox --help", result.returncode == 0)
            except Exception:
                runner.run_test("BusyBox --help", False)

            try:
                result = subprocess.run(
                    [str(busybox_bin), "echo", "test"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                runner.run_test("BusyBox echo", "test" in result.stdout)
            except Exception:
                runner.run_test("BusyBox echo", False)

            try:
                result = subprocess.run(
                    [str(busybox_bin), "ls", "/tmp"],
                    capture_output=True,
                    timeout=5,
                )
                runner.run_test("BusyBox ls", result.returncode == 0)
            except Exception:
                runner.run_test("BusyBox ls", False)

            # Test 5: Check static linking
            log("Testing: BusyBox static linking")
            try:
                result = subprocess.run(
                    ["file", str(busybox_bin)],
                    capture_output=True,
                    text=True,
                )
                if "statically linked" in result.stdout:
                    success("BusyBox is statically linked")
                    runner.tests_passed += 1
                else:
                    warn("BusyBox is NOT statically linked")
                    print(result.stdout)
                    runner.tests_failed += 1
            except Exception:
                warn("Could not check linking")
                runner.tests_failed += 1

            # Test 6: Check size
            log("Testing: BusyBox size")
            size = file_size_bytes(busybox_bin)
            size_mb = size / (1024 * 1024)

            if size_mb < 3:
                success(f"BusyBox size is optimal: {size_mb:.2f}MB")
                runner.tests_passed += 1
            else:
                warn(f"BusyBox size is larger than expected: {size_mb:.2f}MB")
                runner.tests_failed += 1

            # Test 7: Check metadata
            log("Testing: Metadata JSON")
            metadata_files = list(args.busybox_dir.glob("*.json"))
            if metadata_files:
                metadata = metadata_files[-1]
                try:
                    with open(metadata) as f:
                        json.load(f)
                    success(f"Metadata found: {metadata}")
                    runner.tests_passed += 1
                except json.JSONDecodeError:
                    log_error("Invalid metadata JSON")
                    runner.tests_failed += 1
            else:
                log_error("No metadata JSON found")
                runner.tests_failed += 1

            # Test 8: Check initramfs
            log("Testing: Initramfs")
            initramfs_files = list(args.busybox_dir.glob("*initramfs*.cpio.gz"))
            if initramfs_files:
                initramfs = initramfs_files[-1]
                success(f"Initramfs found: {initramfs}")

                initramfs_size = file_size_bytes(initramfs)
                initramfs_mb = initramfs_size / (1024 * 1024)
                log(f"Initramfs size: {initramfs_mb:.2f}MB")

                # Verify it's a valid gzip archive
                try:
                    result = subprocess.run(
                        ["gzip", "-t", str(initramfs)],
                        capture_output=True,
                    )
                    runner.run_test("Initramfs is valid gzip", result.returncode == 0)
                except Exception:
                    runner.run_test("Initramfs is valid gzip", False)

                runner.tests_passed += 1
            else:
                log_error("No initramfs found")
                runner.tests_failed += 1
        else:
            log_error("No BusyBox binary found in bench-images/busybox")
            warn("Run: ./scripts/benchmarks/build-busybox-musl.sh")
            runner.tests_failed += 5
    else:
        log_error("bench-images/busybox directory not found")
        runner.tests_failed += 5

    # Test 9: Check Docker comparison results
    if args.results_dir.exists():
        latest_results = list(args.results_dir.glob("musl-vs-glibc-*.json"))

        if latest_results:
            results_file = latest_results[-1]
            success(f"Found Docker comparison results: {results_file}")

            try:
                with open(results_file) as f:
                    data = json.load(f)

                runner.run_test("Docker results JSON is valid", True)

                has_musl = "musl" in data.get("builds", {})
                has_glibc = "glibc" in data.get("builds", {})

                if has_musl:
                    success("musl build data present")
                    runner.tests_passed += 1
                else:
                    warn("musl build data missing")
                    runner.tests_failed += 1

                if has_glibc:
                    success("glibc build data present")
                    runner.tests_passed += 1
                else:
                    warn("glibc build data missing (may be expected)")

                # Show comparison if available
                if has_musl and has_glibc:
                    print()
                    log("Latest comparison results:")
                    print(json.dumps(data.get("comparison", {}), indent=2))

            except json.JSONDecodeError:
                runner.run_test("Docker results JSON is valid", False)
        else:
            warn("No Docker comparison results found")
            warn("Run: ./scripts/benchmarks/docker-musl-vs-glibc.sh")
    else:
        warn("performance-results/docker-builds directory not found")

    # Summary
    print()
    log("=" * 56)
    log("Test Summary")
    log("=" * 56)
    log(f"Tests passed: {Colors.GREEN}{runner.tests_passed}{Colors.NC}")
    log(f"Tests failed: {Colors.RED}{runner.tests_failed}{Colors.NC}")

    if runner.tests_failed == 0:
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
        log_error(f"{runner.tests_failed} test(s) failed")
        print()
        log("To fix:")
        log("  1. Run BusyBox build: ./scripts/benchmarks/build-busybox-musl.sh")
        log("  2. Run Docker comparison: ./scripts/benchmarks/docker-musl-vs-glibc.sh")
        log("  3. Check build logs for errors")
        return 1


if __name__ == "__main__":
    sys.exit(main())
