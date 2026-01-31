#!/usr/bin/env python3
"""VibeCode Desktop - Build All Platforms.

Convenience script for building on all supported platforms.
"""
from __future__ import annotations

import argparse
import os
import platform
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
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = ""
        cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def run_cmd(
    cmd: list[str],
    capture: bool = False,
    check: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    run_env = os.environ.copy()
    if env:
        run_env.update(env)
    return subprocess.run(cmd, capture_output=capture, text=True, check=check, env=run_env)


def get_platform_name() -> str:
    """Get the current platform name."""
    system = platform.system()
    if system == "Darwin":
        return "macOS"
    elif system == "Linux":
        return "Linux"
    elif system == "Windows" or system.startswith("MINGW") or system.startswith("MSYS"):
        return "Windows"
    return system


def check_prerequisites() -> bool:
    """Check for required tools."""
    print(f"{Colors.YELLOW}Checking prerequisites...{Colors.NC}")

    required = [
        ("node", "Node.js"),
        ("npm", "npm"),
        ("cargo", "Rust/Cargo"),
    ]

    all_ok = True
    for cmd, name in required:
        if not shutil.which(cmd):
            print(f"{Colors.RED}Error: {name} not found{Colors.NC}")
            all_ok = False
        else:
            result = run_cmd([cmd, "--version"], capture=True)
            version = result.stdout.strip().split("\n")[0] if result.returncode == 0 else "unknown"
            print(f"[OK] {name} {version}")

    return all_ok


def install_dependencies(project_root: Path) -> bool:
    """Install npm dependencies if needed."""
    node_modules = project_root / "node_modules"
    if not node_modules.exists():
        print(f"{Colors.YELLOW}Installing dependencies...{Colors.NC}")
        result = run_cmd(["npm", "ci", "--legacy-peer-deps"], cwd=str(project_root))
        if result.returncode != 0:
            print(f"{Colors.RED}Failed to install dependencies{Colors.NC}")
            return False
    return True


def build_platform(platform_name: str, script_path: Path, build_type: str) -> bool:
    """Build for a specific platform."""
    print(f"{Colors.BLUE}{'=' * 40}{Colors.NC}")
    print(f"{Colors.BLUE}  Building for {platform_name}{Colors.NC}")
    print(f"{Colors.BLUE}{'=' * 40}{Colors.NC}")
    print()

    if not script_path.exists():
        print(f"{Colors.RED}Build script not found: {script_path}{Colors.NC}")
        return False

    result = run_cmd(
        ["bash", str(script_path)],
        env={"BUILD_TYPE": build_type},
    )

    if result.returncode == 0:
        print(f"{Colors.GREEN}[OK] {platform_name} build completed successfully{Colors.NC}")
        return True
    else:
        print(f"{Colors.RED}[X] {platform_name} build failed{Colors.NC}")
        return False


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--current-only",
        action="store_true",
        help="Only build for current platform",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Build in debug mode",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    args = parser.parse_args(argv)

    if args.no_color:
        Colors.disable()

    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent

    platform_name = get_platform_name()
    build_type = "debug" if args.debug else "release"

    print(f"{Colors.BLUE}")
    print("=" * 40)
    print("  VibeCode Desktop - Build All")
    print("=" * 40)
    print(f"{Colors.NC}")

    print(f"Detected platform: {platform_name}")
    print()

    if not check_prerequisites():
        return 1

    print()

    if not install_dependencies(project_root):
        return 1

    # Build for current platform
    if platform_name == "macOS":
        success = build_platform("macOS", script_dir / "build-macos.sh", build_type)
    elif platform_name == "Linux":
        success = build_platform("Linux", script_dir / "build-linux.sh", build_type)
    elif platform_name == "Windows":
        print(f"{Colors.YELLOW}For Windows, please use PowerShell:{Colors.NC}")
        print("  .\\scripts\\desktop\\build-windows.ps1")
        return 0
    else:
        print(f"{Colors.RED}Unsupported platform: {platform_name}{Colors.NC}")
        return 1

    if not success:
        return 1

    # Summary
    print()
    print(f"{Colors.GREEN}{'=' * 40}{Colors.NC}")
    print(f"{Colors.GREEN}  Build Complete!{Colors.NC}")
    print(f"{Colors.GREEN}{'=' * 40}{Colors.NC}")
    print()
    print("Build artifacts location:")
    print("  src-tauri/target/*/release/bundle/")
    print()
    print(f"{Colors.YELLOW}Next steps:{Colors.NC}")
    print("1. Test the build on your platform")
    print("2. Verify package installation")
    print("3. Run functional tests")
    print("4. Create release tag when ready")
    print()
    print("For testing guidance, see:")
    print("  docs/DESKTOP_BUILD_TESTING.md")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
