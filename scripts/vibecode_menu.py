#!/usr/bin/env python3
"""VibeCode Development Menu.

Quick access to common development operations via interactive menu.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import os
import shutil
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    BOLD = "\033[1m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.RED = cls.GREEN = cls.YELLOW = cls.BLUE = cls.CYAN = cls.BOLD = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def run_cmd(
    cmd: list[str],
    capture: bool = False,
    check: bool = False,
    cwd: str | Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check, cwd=cwd)


def clear_screen() -> None:
    """Clear the terminal screen."""
    os.system("clear" if os.name != "nt" else "cls")


def show_menu() -> None:
    """Display the main menu."""
    clear_screen()
    print("""╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                   VibeCode Dev Menu                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

Development:
  1) Build and launch VibeCode
  2) Run Swift tests
  3) Run integration tests
  4) Clean build artifacts

VM Operations:
  5) Build VZ VMs (parallel)
  6) Build VZ VMs (sequential)
  7) Check VM status
  8) List Lima VMs

Testing:
  9) Run full test suite
  10) Run regression tests
  11) Run functional tests (VM launch)
  12) Run GUI tests (entitlements)
  13) Run service tests (connectivity)
  14) Run E2E with Datadog

Datadog:
  15) Test Datadog integration
  16) Start Lima VMs with Datadog

Utilities:
  17) View logs
  18) Check system requirements
  19) Git status

  0) Exit
""")
    print("Select option: ", end="", flush=True)


def build_and_launch(script_dir: Path) -> None:
    """Build and launch VibeCode."""
    print("Building and launching VibeCode...")
    run_cmd([str(script_dir / "launch-vibecode.sh")])


def run_swift_tests(project_root: Path) -> None:
    """Run Swift unit tests."""
    print("Running Swift unit tests...")
    swift_dir = project_root / "VibeCodeSwift"
    run_cmd(["swift", "test"], cwd=swift_dir)


def run_integration_tests(script_dir: Path) -> None:
    """Run integration tests."""
    print("Running integration tests...")
    run_cmd([str(script_dir / "test-vibecode-vms.sh")])


def clean_build(project_root: Path) -> None:
    """Clean build artifacts."""
    print("Cleaning build artifacts...")
    swift_dir = project_root / "VibeCodeSwift"
    run_cmd(["swift", "package", "clean"], cwd=swift_dir)

    build_dir = swift_dir / ".build"
    if build_dir.exists():
        shutil.rmtree(build_dir)

    print("Clean complete")


def build_vms_parallel(script_dir: Path) -> None:
    """Build VMs in parallel."""
    print("Building VMs in parallel...")
    run_cmd([
        str(script_dir / "run-with-secure-datadog-key.sh"),
        str(script_dir / "build-vz-vms-parallel.sh"),
    ])


def check_vm_status(project_root: Path) -> None:
    """Check VM image status."""
    print("VM Image Status:")
    print("================")

    vm_images_dir = project_root / "dist" / "vm-images"

    # List .img files
    img_files = list(vm_images_dir.glob("*.img")) if vm_images_dir.exists() else []
    if img_files:
        for img in img_files:
            size = img.stat().st_size
            size_str = f"{size / (1024**3):.1f}G" if size > 1024**3 else f"{size / (1024**2):.1f}M"
            print(f"  {img.name}: {size_str}")
    else:
        print("No VMs found")

    print()
    print("EFI NVRAM Files:")
    nvram_files = list(vm_images_dir.glob("*-efi.nvram")) if vm_images_dir.exists() else []
    if nvram_files:
        for nvram in nvram_files:
            size = nvram.stat().st_size
            print(f"  {nvram.name}: {size} bytes")
    else:
        print("No NVRAM files found")


def list_lima_vms() -> None:
    """List Lima VMs."""
    print("Lima VMs:")
    if shutil.which("limactl"):
        run_cmd(["limactl", "list"])
    else:
        print("limactl not found")


def run_full_tests(script_dir: Path) -> None:
    """Run full test suite."""
    print("Running full test suite...")

    test_scripts = [
        "regression-tests.sh",
        "test-vibecode-vms.sh",
        "functional-tests.sh",
        "test-gui.sh",
        "service-tests.sh",
        "test-e2e-with-datadog.sh",
    ]

    for script in test_scripts:
        script_path = script_dir / script
        if script_path.exists():
            print(f"\n--- Running {script} ---")
            run_cmd([str(script_path)])
        else:
            print(f"Skipping {script} (not found)")

    print()
    print("Full test suite complete")


def run_script(script_dir: Path, script_name: str) -> None:
    """Run a script by name."""
    script_path = script_dir / script_name
    if script_path.exists():
        run_cmd([str(script_path)])
    else:
        print(f"Script not found: {script_path}")


def view_logs(project_root: Path) -> None:
    """View recent logs."""
    print("Recent logs:")
    log_file = project_root / "logs" / "vibecode.log"

    if log_file.exists():
        result = run_cmd(["tail", "-50", str(log_file)], capture=True)
        print(result.stdout)
    else:
        print("No logs found")


def check_requirements(project_root: Path) -> None:
    """Check system requirements."""
    print("System Requirements Check:")
    print("=========================")

    # macOS version
    result = run_cmd(["sw_vers", "-productVersion"], capture=True)
    print(f"macOS version: {result.stdout.strip()}")

    # Swift version
    result = run_cmd(["swift", "--version"], capture=True)
    swift_version = result.stdout.strip().split("\n")[0] if result.stdout else "Not installed"
    print(f"Swift version: {swift_version}")

    # Xcode version
    result = run_cmd(["xcodebuild", "-version"], capture=True)
    if result.returncode == 0 and result.stdout:
        xcode_version = result.stdout.strip().split("\n")[0]
    else:
        xcode_version = "Not installed"
    print(f"Xcode version: {xcode_version}")

    print()

    # Disk space
    vm_images_dir = project_root / "dist" / "vm-images"
    print("Disk space in dist/vm-images:")
    if vm_images_dir.exists():
        result = run_cmd(["du", "-sh", str(vm_images_dir)], capture=True)
        print(f"  {result.stdout.strip()}")
    else:
        print("  No VMs found")

    print()
    print("Available disk space:")
    result = run_cmd(["df", "-h", str(project_root)], capture=True)
    lines = result.stdout.strip().split("\n")
    if len(lines) > 1:
        print(f"  {lines[-1]}")


def git_status(project_root: Path) -> None:
    """Show git status."""
    print("Git Status:")
    run_cmd(["git", "status", "--short"], cwd=project_root)

    print()
    print("Current branch:")
    result = run_cmd(["git", "branch", "--show-current"], capture=True, cwd=project_root)
    print(f"  {result.stdout.strip()}")


def wait_for_enter() -> None:
    """Wait for user to press Enter."""
    print()
    input("Press Enter to continue...")


def main() -> int:
    """Main entry point."""
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    while True:
        show_menu()

        try:
            choice = input().strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting...")
            return 0

        try:
            if choice == "1":
                build_and_launch(script_dir)
            elif choice == "2":
                run_swift_tests(project_root)
            elif choice == "3":
                run_integration_tests(script_dir)
            elif choice == "4":
                clean_build(project_root)
            elif choice == "5":
                build_vms_parallel(script_dir)
            elif choice == "6":
                print("Sequential build not yet implemented")
            elif choice == "7":
                check_vm_status(project_root)
            elif choice == "8":
                list_lima_vms()
            elif choice == "9":
                run_full_tests(script_dir)
            elif choice == "10":
                run_script(script_dir, "regression-tests.sh")
            elif choice == "11":
                run_script(script_dir, "functional-tests.sh")
            elif choice == "12":
                run_script(script_dir, "test-gui.sh")
            elif choice == "13":
                run_script(script_dir, "service-tests.sh")
            elif choice == "14":
                run_script(script_dir, "test-e2e-with-datadog.sh")
            elif choice == "15":
                run_script(script_dir, "test-all-datadog-solutions.sh")
            elif choice == "16":
                run_script(script_dir, "start-lima-vms-with-datadog.sh")
            elif choice == "17":
                view_logs(project_root)
            elif choice == "18":
                check_requirements(project_root)
            elif choice == "19":
                git_status(project_root)
            elif choice == "0":
                print("Exiting...")
                return 0
            else:
                print("Invalid option")

        except Exception as e:
            print(f"{Colors.RED}Error: {e}{Colors.NC}")

        wait_for_enter()

    return 0


if __name__ == "__main__":
    sys.exit(main())
