#!/usr/bin/env python3
"""VibeCode Desktop - Linux Build Script.

Builds .deb, .AppImage, and .rpm packages for x86_64 and ARM64.
"""
from __future__ import annotations

import argparse
import hashlib
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
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


REQUIRED_DEPS = [
    "libwebkit2gtk-4.1-dev",
    "libappindicator3-dev",
    "librsvg2-dev",
    "patchelf",
    "libssl-dev",
    "pkg-config",
    "build-essential",
]


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
    cwd: str | Path | None = None,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    run_env = os.environ.copy()
    if env:
        run_env.update(env)
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
        cwd=cwd,
        env=run_env,
    )


def check_prerequisites() -> bool:
    """Check for required tools."""
    print(f"{Colors.YELLOW}Checking prerequisites...{Colors.NC}")

    required = ["node", "npm", "cargo", "rustc"]
    all_ok = True

    for cmd in required:
        if not shutil.which(cmd):
            print(f"{Colors.RED}Error: {cmd} not found{Colors.NC}")
            all_ok = False
        else:
            result = run_cmd([cmd, "--version"])
            version = result.stdout.strip().split("\n")[0] if result.returncode == 0 else "unknown"
            print(f"[OK] {cmd} {version}")

    return all_ok


def check_linux_deps() -> list[str]:
    """Check for Linux-specific dependencies."""
    print(f"{Colors.YELLOW}Checking Linux dependencies...{Colors.NC}")

    missing = []
    for dep in REQUIRED_DEPS:
        result = run_cmd(["dpkg", "-l", dep])
        if result.returncode != 0 or f"ii  {dep}" not in result.stdout:
            missing.append(dep)

    return missing


def get_rust_target(arch: str) -> str:
    """Get Rust target triple for architecture."""
    if arch == "x86_64":
        return "x86_64-unknown-linux-gnu"
    elif arch == "arm64":
        return "aarch64-unknown-linux-gnu"
    else:
        raise ValueError(f"Unsupported architecture: {arch}")


def generate_checksums(directory: Path) -> None:
    """Generate SHA256 checksums for files in directory."""
    if not directory.exists():
        return

    for file_path in directory.iterdir():
        if file_path.is_file() and not file_path.suffix == ".sha256":
            sha256 = hashlib.sha256()
            sha256.update(file_path.read_bytes())
            checksum_file = file_path.with_suffix(file_path.suffix + ".sha256")
            checksum_file.write_text(f"{sha256.hexdigest()}  {file_path.name}\n")
            print(f"[OK] Checksum: {checksum_file.name}")


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--build-type",
        choices=["release", "debug"],
        default=os.environ.get("BUILD_TYPE", "release"),
        help="Build type (default: release)",
    )
    parser.add_argument(
        "--arch",
        choices=["x86_64", "arm64"],
        default=os.environ.get("ARCH", "x86_64"),
        help="Target architecture (default: x86_64)",
    )
    parser.add_argument(
        "--no-deb",
        action="store_true",
        help="Skip .deb package creation",
    )
    parser.add_argument(
        "--no-appimage",
        action="store_true",
        help="Skip .AppImage creation",
    )
    parser.add_argument(
        "--no-rpm",
        action="store_true",
        help="Skip .rpm package creation",
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

    rust_target = get_rust_target(args.arch)

    print(f"{Colors.GREEN}VibeCode Desktop - Linux Build Script{Colors.NC}")
    print("=" * 40)
    print(f"Project Root: {project_root}")
    print(f"Build Type: {args.build_type}")
    print(f"Architecture: {args.arch}")
    print(f"Create .deb: {not args.no_deb}")
    print(f"Create .AppImage: {not args.no_appimage}")
    print(f"Create .rpm: {not args.no_rpm}")
    print()

    if not check_prerequisites():
        return 1

    missing_deps = check_linux_deps()
    if missing_deps:
        print(f"{Colors.RED}Missing dependencies: {' '.join(missing_deps)}{Colors.NC}")
        print("Install with:")
        print(f"  sudo apt-get install -y {' '.join(missing_deps)}")
        return 1

    # Install Rust target
    print(f"{Colors.YELLOW}Installing Rust target: {rust_target}...{Colors.NC}")
    run_cmd(["rustup", "target", "add", rust_target], capture=False)

    # Navigate to project root
    os.chdir(project_root)

    # Install dependencies
    print(f"{Colors.YELLOW}Installing npm dependencies...{Colors.NC}")
    run_cmd(["npm", "ci", "--legacy-peer-deps"], capture=False)

    # Build frontend
    print(f"{Colors.YELLOW}Building frontend...{Colors.NC}")
    run_cmd(["npm", "run", "build"], capture=False)

    # Setup environment
    env = os.environ.copy()
    env["NEXT_CONFIG_FILE"] = "next.config.tauri.js"

    # Build Tauri app
    print(f"{Colors.YELLOW}Building Tauri application...{Colors.NC}")
    cmd = ["npm", "run", "tauri", "build", "--", "--target", rust_target]
    if args.build_type == "debug":
        cmd.insert(4, "--debug")

    result = run_cmd(cmd, capture=False, env=env)
    if result.returncode != 0:
        print(f"{Colors.RED}Build failed{Colors.NC}")
        return 1

    # Build artifacts location
    bundle_dir = project_root / "src-tauri" / "target" / rust_target / args.build_type / "bundle"

    if not bundle_dir.exists():
        print(f"{Colors.RED}Error: Build failed - bundle directory not found{Colors.NC}")
        return 1

    print(f"{Colors.GREEN}[OK] Build successful{Colors.NC}")

    # List created packages
    print()
    print(f"{Colors.GREEN}========================================={Colors.NC}")
    print("Build Complete!")
    print(f"{Colors.GREEN}========================================={Colors.NC}")
    print()
    print("Build artifacts:")

    # .deb package
    if not args.no_deb:
        deb_dir = bundle_dir / "deb"
        if deb_dir.exists():
            for deb_file in deb_dir.glob("*.deb"):
                size = deb_file.stat().st_size // 1024 // 1024
                print(f"  .deb package: {deb_file} ({size}MB)")
                generate_checksums(deb_dir)

    # .AppImage
    if not args.no_appimage:
        appimage_dir = bundle_dir / "appimage"
        if appimage_dir.exists():
            for appimage_file in appimage_dir.glob("*.AppImage"):
                size = appimage_file.stat().st_size // 1024 // 1024
                print(f"  .AppImage: {appimage_file} ({size}MB)")
                generate_checksums(appimage_dir)

    # .rpm package
    if not args.no_rpm:
        rpm_dir = bundle_dir / "rpm"
        if rpm_dir.exists():
            for rpm_file in rpm_dir.glob("*.rpm"):
                size = rpm_file.stat().st_size // 1024 // 1024
                print(f"  .rpm package: {rpm_file} ({size}MB)")
                generate_checksums(rpm_dir)

    print()
    print(f"{Colors.GREEN}Done!{Colors.NC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
