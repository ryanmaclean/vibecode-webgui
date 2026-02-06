#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "vfkit-real-boot-time-test"
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

"""Test actual VM boot time to shell prompt.

Measures real boot time by starting VMs and monitoring console logs
for shell prompt indicators. Compares optimized vs non-optimized VMs.
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
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable all color codes."""
        cls.RED = cls.GREEN = cls.YELLOW = ""
        cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


@dataclass
class VMConfig:
    """Configuration for a VM to test."""

    name: str
    vm_dir: Path
    launch_script: str = "./launch.sh"
    console_log_path: str = "logs/console.log"


@dataclass
class BootResult:
    """Result of a boot time test."""

    name: str
    boot_time: float
    success: bool
    error_message: str = ""


@dataclass
class Config:
    """Configuration for boot time test."""

    vfkit_base: Path
    boot_timeout: int = 30
    poll_interval: float = 1.0
    boot_indicators: tuple[str, ...] = ("System ready", "~ #", "# ")


def get_default_vfkit_base() -> Path:
    """Get the default vfkit VMs base directory."""
    return Path.home() / ".vfkit" / "vms"


def measure_boot_time(vm_config: VMConfig, config: Config) -> BootResult:
    """Measure the real boot time for a VM.

    Args:
        vm_config: Configuration for the VM to test.
        config: Global test configuration.

    Returns:
        BootResult with timing information.
    """
    print(f"  Starting {vm_config.name}...")

    vm_dir = vm_config.vm_dir
    launch_script = vm_dir / vm_config.launch_script
    console_log = vm_dir / vm_config.console_log_path

    if not vm_dir.exists():
        return BootResult(
            name=vm_config.name,
            boot_time=0,
            success=False,
            error_message=f"VM directory not found: {vm_dir}",
        )

    if not launch_script.exists():
        return BootResult(
            name=vm_config.name,
            boot_time=0,
            success=False,
            error_message=f"Launch script not found: {launch_script}",
        )

    # Clear console log if it exists
    if console_log.exists():
        try:
            console_log.write_text("")
        except OSError:
            pass

    # Start VM in background
    start_time = time.time()

    try:
        proc = subprocess.Popen(
            [str(launch_script)],
            cwd=str(vm_dir),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError as e:
        return BootResult(
            name=vm_config.name,
            boot_time=0,
            success=False,
            error_message=f"Failed to start VM: {e}",
        )

    # Poll console log for boot completion
    boot_complete = False
    polls = int(config.boot_timeout / config.poll_interval)

    for _ in range(polls):
        if console_log.exists():
            try:
                content = console_log.read_text()
                for indicator in config.boot_indicators:
                    if indicator in content:
                        boot_complete = True
                        break
            except OSError:
                pass

        if boot_complete:
            break

        time.sleep(config.poll_interval)

    end_time = time.time()
    boot_time = end_time - start_time

    # Stop VM
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            proc.kill()
            proc.wait(timeout=2)
        except (subprocess.TimeoutExpired, OSError):
            pass
    except OSError:
        pass

    # Allow cleanup time
    time.sleep(2)

    if boot_complete:
        print(f"{Colors.GREEN}  [OK] Booted to shell in {boot_time:.2f}s{Colors.NC}")
        return BootResult(
            name=vm_config.name,
            boot_time=boot_time,
            success=True,
        )
    else:
        print(f"{Colors.RED}  [X] Failed to boot within {config.boot_timeout}s{Colors.NC}")
        return BootResult(
            name=vm_config.name,
            boot_time=boot_time,
            success=False,
            error_message=f"Boot timeout after {config.boot_timeout}s",
        )


def print_comparison(
    non_opt_result: BootResult,
    opt_result: BootResult,
) -> None:
    """Print comparison of boot times.

    Args:
        non_opt_result: Result from non-optimized VM.
        opt_result: Result from optimized VM.
    """
    print()
    print("=" * 40)
    print("  Real Boot Time Comparison")
    print("=" * 40)
    print()
    print("Real Boot Time to Shell:")

    if non_opt_result.success:
        print(f"  Non-optimized: {non_opt_result.boot_time:.2f}s")
    else:
        print(f"  Non-optimized: FAILED ({non_opt_result.error_message})")

    if opt_result.success:
        print(f"  Optimized:     {opt_result.boot_time:.2f}s")
    else:
        print(f"  Optimized:     FAILED ({opt_result.error_message})")

    print()

    # Calculate and display improvement
    if non_opt_result.success and opt_result.success:
        if opt_result.boot_time < non_opt_result.boot_time:
            diff = non_opt_result.boot_time - opt_result.boot_time
            if non_opt_result.boot_time > 0:
                improvement = (diff / non_opt_result.boot_time) * 100
                print(
                    f"{Colors.GREEN}[OK] Optimized VM is {improvement:.1f}% faster "
                    f"({diff:.2f}s){Colors.NC}"
                )
        else:
            print(f"{Colors.YELLOW}[!] Optimized VM is not faster{Colors.NC}")


def print_conclusion(
    non_opt_result: BootResult,
    opt_result: BootResult,
) -> None:
    """Print conclusion about optimization benefits.

    Args:
        non_opt_result: Result from non-optimized VM.
        opt_result: Result from optimized VM.
    """
    print()
    print("Conclusion:")

    if not (non_opt_result.success and opt_result.success):
        print(f"{Colors.YELLOW}[!] Cannot compare - one or both tests failed{Colors.NC}")
        return

    if opt_result.boot_time < non_opt_result.boot_time:
        print(
            f"{Colors.GREEN}[OK] Kernel optimizations provide measurable "
            f"boot time benefits!{Colors.NC}"
        )
    else:
        print(
            f"{Colors.RED}[X] Kernel optimizations do not provide measurable "
            f"boot time benefits.{Colors.NC}"
        )


def main(argv: list[str] | None = None) -> int:
    """Main entry point.

    Args:
        argv: Command line arguments (uses sys.argv if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--vfkit-base",
        type=Path,
        default=None,
        help="Base directory for vfkit VMs (default: ~/.vfkit/vms)",
    )
    parser.add_argument(
        "--non-optimized-vm",
        default="vibecode-working-alpine",
        help="Name of non-optimized VM directory (default: vibecode-working-alpine)",
    )
    parser.add_argument(
        "--optimized-vm",
        default="vibecode-optimized-alpine",
        help="Name of optimized VM directory (default: vibecode-optimized-alpine)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Boot timeout in seconds (default: 30)",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=1.0,
        help="Poll interval in seconds (default: 1.0)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )
    parser.add_argument(
        "--skip-non-optimized",
        action="store_true",
        help="Skip non-optimized VM test",
    )
    parser.add_argument(
        "--skip-optimized",
        action="store_true",
        help="Skip optimized VM test",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    vfkit_base = args.vfkit_base or get_default_vfkit_base()

    config = Config(
        vfkit_base=vfkit_base,
        boot_timeout=args.timeout,
        poll_interval=args.poll_interval,
    )

    print()
    print("=" * 40)
    print("  Real VM Boot Time Test")
    print("=" * 40)
    print("Measuring actual VM boot time to shell prompt")
    print()

    # Define VMs to test
    non_opt_vm = VMConfig(
        name="non-optimized",
        vm_dir=vfkit_base / args.non_optimized_vm,
    )

    opt_vm = VMConfig(
        name="optimized",
        vm_dir=vfkit_base / args.optimized_vm,
    )

    # Test non-optimized VM
    non_opt_result = BootResult(name="non-optimized", boot_time=0, success=False)
    if not args.skip_non_optimized:
        print("Testing Non-Optimized VM...")
        non_opt_result = measure_boot_time(non_opt_vm, config)
        print()

    # Test optimized VM
    opt_result = BootResult(name="optimized", boot_time=0, success=False)
    if not args.skip_optimized:
        print("Testing Optimized VM...")
        opt_result = measure_boot_time(opt_vm, config)

    # Print results
    print_comparison(non_opt_result, opt_result)
    print_conclusion(non_opt_result, opt_result)
    print()

    # Return success if at least one test passed
    if non_opt_result.success or opt_result.success:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())