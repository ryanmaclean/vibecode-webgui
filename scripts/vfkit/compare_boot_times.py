#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "vfkit-compare-boot-times"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "vm-management"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Boot time comparison between vfkit Alpine and Lima vibecode-minimal.

Compares boot times between:
1. Lima vibecode-minimal (full Debian/Ubuntu with AI tools)
2. vfkit Alpine (minimal Alpine Linux)

Reports timing results and feature comparison.
"""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


# ANSI color codes
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = ""
        cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


@dataclass
class BootResult:
    """Result of a boot time test."""

    name: str
    boot_time: float
    success: bool
    description: str = ""


@dataclass
class Config:
    """Configuration for boot comparison."""

    vfkit_launch_script: Path = Path(
        "/Users/studio/Documents/vibecode-webgui/scripts/vfkit/04-launch-alpine-vm.sh"
    )
    console_log: Path = Path(
        "/Users/studio/.vfkit/vms/vibecode-alpine/logs/console.log"
    )
    lima_vm: str = "vibecode-minimal"
    boot_timeout: int = 30
    poll_interval: float = 0.1


def check_dependency(cmd: str, install_hint: str) -> bool:
    """Check if a command is available."""
    if not shutil.which(cmd):
        print(f"{Colors.RED}[X] {cmd} not found. Install: {install_hint}{Colors.NC}")
        return False
    return True


def check_dependencies() -> bool:
    """Check all required dependencies."""
    deps = [
        ("limactl", "brew install lima"),
        ("vfkit", "brew install vfkit"),
    ]

    all_ok = True
    for cmd, hint in deps:
        if not check_dependency(cmd, hint):
            all_ok = False

    return all_ok


def run_cmd(
    cmd: list[str],
    check: bool = False,
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
    )


def is_lima_vm_running(vm_name: str) -> bool:
    """Check if a Lima VM is running."""
    result = run_cmd(["limactl", "list"])
    if result.returncode != 0:
        return False

    for line in result.stdout.splitlines():
        if vm_name in line and "Running" in line:
            return True
    return False


def stop_lima_vm(vm_name: str) -> bool:
    """Stop a Lima VM."""
    print(f"  Stopping {vm_name}...")
    result = run_cmd(["limactl", "stop", vm_name])
    if result.returncode == 0:
        time.sleep(3)
        print(f"{Colors.GREEN}  [OK] Stopped{Colors.NC}")
        return True
    return False


def test_lima_boot(config: Config) -> BootResult:
    """Test Lima vibecode-minimal boot time."""
    print()
    print("=" * 55)
    print("Test 1: Lima vibecode-minimal")
    print("=" * 55)
    print("Configuration: Full Debian/Ubuntu with AI tools")
    print("  - 4 CPUs, 4GB RAM, 100GB disk")
    print("  - Includes: Claude, Codex, Gemini, Aider")
    print("  - Full systemd init system")
    print()

    # Stop if running
    if is_lima_vm_running(config.lima_vm):
        stop_lima_vm(config.lima_vm)
        print()

    print(f"  Starting {config.lima_vm}...")
    start_time = time.time()

    result = run_cmd(["limactl", "start", config.lima_vm])

    end_time = time.time()
    boot_time = end_time - start_time

    if result.returncode != 0:
        print(f"{Colors.RED}  [X] Boot failed{Colors.NC}")
        return BootResult(
            name="Lima vibecode-minimal",
            boot_time=0,
            success=False,
            description="Full Debian/Ubuntu with AI tools",
        )

    print(f"{Colors.GREEN}  [OK] Boot completed!{Colors.NC}")
    print(f"  Time: {boot_time:.2f} seconds")

    return BootResult(
        name="Lima vibecode-minimal",
        boot_time=boot_time,
        success=True,
        description="Full Debian/Ubuntu with AI tools",
    )


def test_vfkit_boot(config: Config) -> BootResult:
    """Test vfkit Alpine boot time."""
    print()
    print("=" * 55)
    print("Test 2: vfkit Alpine")
    print("=" * 55)
    print("Configuration: Minimal Alpine Linux")
    print("  - 4 CPUs, 4GB RAM, 20GB disk")
    print("  - Includes: Node.js 20.11.1, npm")
    print("  - Single /init script (no systemd)")
    print()

    # Clear console log
    if config.console_log.exists():
        config.console_log.write_text("")

    if not config.vfkit_launch_script.exists():
        print(f"{Colors.RED}  [X] Launch script not found: {config.vfkit_launch_script}{Colors.NC}")
        return BootResult(
            name="vfkit Alpine",
            boot_time=0,
            success=False,
            description="Minimal Alpine Linux",
        )

    print("  Starting vfkit Alpine...")
    start_time = time.time()

    # Start vfkit in background with timeout
    proc = subprocess.Popen(
        ["timeout", f"{config.boot_timeout}s", str(config.vfkit_launch_script)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for shell prompt in console log
    boot_detected = False
    max_polls = int(config.boot_timeout / config.poll_interval)

    for _ in range(max_polls):
        if config.console_log.exists():
            try:
                content = config.console_log.read_text()
                # Check last portion for boot indicators
                tail = content[-500:] if len(content) > 500 else content
                if "can't access tty" in tail or "/bin/sh" in tail:
                    boot_detected = True
                    break
            except OSError:
                pass
        time.sleep(config.poll_interval)

    end_time = time.time()

    # Kill vfkit process
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except (subprocess.TimeoutExpired, OSError):
        try:
            proc.kill()
        except OSError:
            pass

    if not boot_detected:
        print(f"{Colors.RED}  [X] Boot detection failed{Colors.NC}")
        print(f"  Check console log: tail -f {config.console_log}")
        return BootResult(
            name="vfkit Alpine",
            boot_time=0,
            success=False,
            description="Minimal Alpine Linux",
        )

    boot_time = end_time - start_time

    print(f"{Colors.GREEN}  [OK] Boot completed!{Colors.NC}")
    print(f"  Time: {boot_time:.2f} seconds")

    return BootResult(
        name="vfkit Alpine",
        boot_time=boot_time,
        success=True,
        description="Minimal Alpine Linux",
    )


def print_results(lima_result: BootResult, vfkit_result: BootResult) -> None:
    """Print comparison results."""
    print()
    print("+" + "=" * 56 + "+")
    print("|" + " " * 20 + "RESULTS" + " " * 29 + "|")
    print("+" + "=" * 56 + "+")
    print()

    if lima_result.success:
        print(f"  {'Lima vibecode-minimal:':<25} {lima_result.boot_time:>10.2f} seconds")
    else:
        print(f"  {'Lima vibecode-minimal:':<25} {'FAILED':>10}")

    if vfkit_result.success:
        print(f"  {'vfkit Alpine:':<25} {vfkit_result.boot_time:>10.2f} seconds")
    else:
        print(f"  {'vfkit Alpine:':<25} {'FAILED':>10}")

    print()

    # Calculate winner
    if lima_result.success and vfkit_result.success:
        if vfkit_result.boot_time < lima_result.boot_time:
            diff = lima_result.boot_time - vfkit_result.boot_time
            percent = (diff / lima_result.boot_time) * 100
            print(f"  {Colors.GREEN}Winner: vfkit Alpine{Colors.NC}")
            print(f"  Faster by: {diff:.2f} seconds ({percent:.1f}% improvement)")
        else:
            diff = vfkit_result.boot_time - lima_result.boot_time
            percent = (diff / vfkit_result.boot_time) * 100
            print(f"  {Colors.GREEN}Winner: Lima vibecode-minimal{Colors.NC}")
            print(f"  Faster by: {diff:.2f} seconds ({percent:.1f}% improvement)")

    print()


def print_feature_comparison() -> None:
    """Print feature comparison table."""
    print("+" + "=" * 56 + "+")
    print("|" + " " * 14 + "FEATURE COMPARISON" + " " * 24 + "|")
    print("+" + "=" * 56 + "+")
    print()

    header = f"  {'Feature':<25} {'vfkit Alpine':<15} {'Lima minimal':<15}"
    print(header)
    print("  " + "-" * 55)

    features = [
        ("Boot Speed", "[OK] Fast", "[!] Slower"),
        ("File Sharing", "[X] No", "[OK] Yes"),
        ("SSH Access", "[X] No", "[OK] Yes"),
        ("AI Tools", "[X] No", "[OK] Yes"),
        ("Disk Usage", "[OK] ~500MB", "[!] ~5GB"),
        ("Memory Usage", "[OK] ~700MB", "[!] ~1.4GB"),
    ]

    for feature, vfkit, lima in features:
        print(f"  {feature:<25} {vfkit:<15} {lima:<15}")

    print()
    print("=" * 55)
    print("Full comparison: scripts/vfkit/BOOT_TIME_COMPARISON.md")
    print("=" * 55)
    print()


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--lima-vm",
        default="vibecode-minimal",
        help="Lima VM name to test (default: vibecode-minimal)",
    )
    parser.add_argument(
        "--vfkit-script",
        type=Path,
        default=None,
        help="Path to vfkit launch script",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Boot timeout in seconds (default: 30)",
    )
    parser.add_argument(
        "--skip-lima",
        action="store_true",
        help="Skip Lima boot test",
    )
    parser.add_argument(
        "--skip-vfkit",
        action="store_true",
        help="Skip vfkit boot test",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    print("+" + "=" * 56 + "+")
    print("|   Boot Time Comparison: vfkit vs Lima" + " " * 17 + "|")
    print("+" + "=" * 56 + "+")
    print()

    # Check dependencies
    if not check_dependencies():
        return 1

    config = Config(
        lima_vm=args.lima_vm,
        boot_timeout=args.timeout,
    )

    if args.vfkit_script:
        config.vfkit_launch_script = args.vfkit_script

    # Run tests
    lima_result = BootResult(name="Lima", boot_time=0, success=False)
    vfkit_result = BootResult(name="vfkit", boot_time=0, success=False)

    if not args.skip_lima:
        lima_result = test_lima_boot(config)

    if not args.skip_vfkit:
        vfkit_result = test_vfkit_boot(config)

    # Print results
    print_results(lima_result, vfkit_result)
    print_feature_comparison()

    # Return success if at least one test passed
    if lima_result.success or vfkit_result.success:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())