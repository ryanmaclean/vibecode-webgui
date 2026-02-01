#!/usr/bin/env python3
"""
VibeCode Desktop - Build All Platforms.

Convenience script for building on all supported platforms.
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
from enum import Enum
from pathlib import Path
from typing import Optional


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


class Platform(Enum):
    MACOS = "macOS"
    LINUX = "Linux"
    WINDOWS = "Windows"


class BuildType(Enum):
    RELEASE = "release"
    DEBUG = "debug"


def detect_platform() -> Platform:
    """Detect the current platform."""
    system = platform.system()

    if system == "Darwin":
        return Platform.MACOS
    elif system == "Linux":
        return Platform.LINUX
    elif system == "Windows" or system.startswith(("MINGW", "MSYS", "CYGWIN")):
        return Platform.WINDOWS
    else:
        print(f"{Colors.RED}Unsupported platform: {system}{Colors.NC}")
        sys.exit(1)


def check_command(cmd: str) -> Optional[str]:
    """Check if a command exists and return its version."""
    if not shutil.which(cmd):
        return None

    try:
        if cmd == "node":
            result = subprocess.run([cmd, "--version"], capture_output=True, text=True, check=True)
            return result.stdout.strip()
        elif cmd == "npm":
            result = subprocess.run([cmd, "--version"], capture_output=True, text=True, check=True)
            return f"v{result.stdout.strip()}"
        elif cmd == "cargo":
            result = subprocess.run(["rustc", "--version"], capture_output=True, text=True, check=True)
            return result.stdout.strip()
        else:
            return "found"
    except subprocess.CalledProcessError:
        return None


def check_prerequisites() -> bool:
    """Check that all prerequisites are installed."""
    print(f"{Colors.YELLOW}Checking prerequisites...{Colors.NC}")

    # Check Node.js
    node_version = check_command("node")
    if not node_version:
        print(f"{Colors.RED}Error: Node.js not found{Colors.NC}")
        return False
    print(f"+ Node.js {node_version}")

    # Check npm
    npm_version = check_command("npm")
    if not npm_version:
        print(f"{Colors.RED}Error: npm not found{Colors.NC}")
        return False
    print(f"+ npm {npm_version}")

    # Check Rust/Cargo
    rust_version = check_command("cargo")
    if not rust_version:
        print(f"{Colors.RED}Error: Rust/Cargo not found{Colors.NC}")
        return False
    print(f"+ Rust {rust_version}")

    print()
    return True


def install_dependencies(project_root: Path) -> bool:
    """Install npm dependencies if needed."""
    node_modules = project_root / "node_modules"

    if not node_modules.exists():
        print(f"{Colors.YELLOW}Installing dependencies...{Colors.NC}")
        result = subprocess.run(
            ["npm", "ci", "--legacy-peer-deps"],
            cwd=project_root,
            check=False,
        )
        print()
        return result.returncode == 0

    return True


def build_platform(
    platform_name: str,
    script_path: Path,
    build_type: BuildType,
) -> bool:
    """
    Build for a specific platform.

    Args:
        platform_name: Name of the platform (for display)
        script_path: Path to the build script
        build_type: Build type (release or debug)

    Returns:
        True if build succeeded, False otherwise
    """
    print(f"{Colors.BLUE}+=======================================+{Colors.NC}")
    print(f"{Colors.BLUE}|  Building for {platform_name:<22} |{Colors.NC}")
    print(f"{Colors.BLUE}+=======================================+{Colors.NC}")
    print()

    if not script_path.exists():
        print(f"{Colors.RED}Build script not found: {script_path}{Colors.NC}")
        return False

    # Set BUILD_TYPE environment variable
    env = os.environ.copy()
    env["BUILD_TYPE"] = build_type.value

    result = subprocess.run(
        ["bash", str(script_path)],
        env=env,
        check=False,
    )
    print()

    if result.returncode == 0:
        print(f"{Colors.GREEN}+ {platform_name} build completed successfully{Colors.NC}")
        return True
    else:
        print(f"{Colors.RED}x {platform_name} build failed{Colors.NC}")
        return False


def print_summary() -> None:
    """Print build completion summary."""
    print(f"{Colors.GREEN}+=======================================+{Colors.NC}")
    print(f"{Colors.GREEN}|  Build Complete!                      |{Colors.NC}")
    print(f"{Colors.GREEN}+=======================================+{Colors.NC}")
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


def build_all(
    build_type: BuildType = BuildType.RELEASE,
    current_only: bool = False,
    script_dir: Optional[Path] = None,
    project_root: Optional[Path] = None,
) -> int:
    """
    Build VibeCode Desktop for all platforms.

    Args:
        build_type: Build type (release or debug)
        current_only: Only build for current platform
        script_dir: Directory containing build scripts
        project_root: Project root directory

    Returns:
        0 on success, 1 on failure
    """
    # Print banner
    print(f"{Colors.BLUE}")
    print("+=======================================+")
    print("|  VibeCode Desktop - Build All        |")
    print("+=======================================+")
    print(f"{Colors.NC}")

    # Detect platform
    current_platform = detect_platform()
    print(f"Detected platform: {current_platform.value}")
    print()

    # Determine directories
    if script_dir is None:
        script_dir = Path(__file__).parent.resolve()

    if project_root is None:
        project_root = script_dir.parent.parent

    # Change to project root
    os.chdir(project_root)

    # Check prerequisites
    if not check_prerequisites():
        return 1

    # Install dependencies
    if not install_dependencies(project_root):
        return 1

    # Build for current platform
    success = True

    if current_platform == Platform.MACOS:
        build_script = script_dir / "build-macos.sh"
        if not build_platform("macOS", build_script, build_type):
            success = False

    elif current_platform == Platform.LINUX:
        build_script = script_dir / "build-linux.sh"
        if not build_platform("Linux", build_script, build_type):
            success = False

    elif current_platform == Platform.WINDOWS:
        print(f"{Colors.YELLOW}For Windows, please use PowerShell:{Colors.NC}")
        print("  .\\scripts\\desktop\\build-windows.ps1")
        return 0

    if success:
        print()
        print_summary()

    return 0 if success else 1


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="VibeCode Desktop - Build All Platforms",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s                      # Build for current platform
  %(prog)s --debug              # Debug build for current platform

Note: Cross-platform builds require platform-specific setup.
See docs/DESKTOP_BUILD_GUIDE.md for details.
""",
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
        "--script-dir",
        type=Path,
        help="Directory containing build scripts",
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Project root directory",
    )
    args = parser.parse_args()

    build_type = BuildType.DEBUG if args.debug else BuildType.RELEASE

    return build_all(
        build_type=build_type,
        current_only=args.current_only,
        script_dir=args.script_dir,
        project_root=args.project_root,
    )


if __name__ == "__main__":
    sys.exit(main())
