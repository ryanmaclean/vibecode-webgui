#!/usr/bin/env python3
"""VibeCode Desktop - Linux Build Script.

Builds .deb, .AppImage, and .rpm packages for x86_64 and ARM64.
"""

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ANSI colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
NC = '\033[0m'

# Supported architectures
SUPPORTED_ARCHES = ["x86_64", "arm64"]

# Required Linux dependencies
REQUIRED_DEPS = [
    "libwebkit2gtk-4.1-dev",
    "libappindicator3-dev",
    "librsvg2-dev",
    "patchelf",
    "libssl-dev",
    "pkg-config",
    "build-essential",
]


@dataclass
class BuildConfig:
    """Build configuration."""

    project_root: Path = field(default_factory=Path)
    build_type: str = "release"
    arch: str = "x86_64"
    create_deb: bool = True
    create_appimage: bool = True
    create_rpm: bool = True
    rust_target: str = ""
    bundle_dir: Path = field(default_factory=Path)


@dataclass
class BuildArtifact:
    """Represents a build artifact."""

    path: Path
    size: str
    checksum_path: Optional[Path] = None


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = True,
    cwd: Optional[Path] = None,
    env: Optional[dict] = None
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run.
        check: If True, log errors on failure.
        capture: If True, capture output.
        cwd: Working directory.
        env: Environment variables.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        merged_env = os.environ.copy()
        if env:
            merged_env.update(env)

        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            cwd=cwd,
            env=merged_env
        )
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def get_rust_target(arch: str) -> Optional[str]:
    """Get the Rust target for the given architecture.

    Args:
        arch: Architecture (x86_64 or arm64).

    Returns:
        Rust target triple or None if unsupported.
    """
    targets = {
        "x86_64": "x86_64-unknown-linux-gnu",
        "arm64": "aarch64-unknown-linux-gnu",
    }
    return targets.get(arch)


def check_command_exists(cmd: str) -> bool:
    """Check if a command exists.

    Args:
        cmd: Command name.

    Returns:
        True if command exists.
    """
    return shutil.which(cmd) is not None


def get_command_version(cmd: str, version_arg: str = "--version") -> str:
    """Get the version of a command.

    Args:
        cmd: Command name.
        version_arg: Argument to get version.

    Returns:
        Version string or empty string.
    """
    rc, stdout, _ = run_command([cmd, version_arg], check=False)
    if rc == 0:
        return stdout.strip().split('\n')[0]
    return ""


def check_prerequisites() -> tuple[bool, list[str]]:
    """Check for required tools.

    Returns:
        Tuple of (all_ok, list of missing tools).
    """
    required = ["node", "npm", "cargo", "rustc"]
    missing = []

    for cmd in required:
        if not check_command_exists(cmd):
            missing.append(cmd)

    return len(missing) == 0, missing


def check_dpkg_dependency(dep: str) -> bool:
    """Check if a dpkg package is installed.

    Args:
        dep: Package name.

    Returns:
        True if installed.
    """
    rc, stdout, _ = run_command(["dpkg", "-l", dep], check=False)
    if rc == 0:
        for line in stdout.splitlines():
            if line.startswith("ii"):
                return True
    return False


def check_linux_dependencies() -> tuple[bool, list[str]]:
    """Check for required Linux dependencies.

    Returns:
        Tuple of (all_ok, list of missing dependencies).
    """
    missing = []
    for dep in REQUIRED_DEPS:
        if not check_dpkg_dependency(dep):
            missing.append(dep)
    return len(missing) == 0, missing


def install_rpm_tools() -> bool:
    """Install RPM build tools.

    Returns:
        True if successful.
    """
    print(f"{YELLOW}Installing rpm tools...{NC}")
    rc, _, _ = run_command(
        ["sudo", "apt-get", "install", "-y", "rpm"],
        check=False
    )
    return rc == 0


def setup_arm64_cross_compilation() -> bool:
    """Set up ARM64 cross-compilation environment.

    Returns:
        True if successful.
    """
    print(f"{YELLOW}Setting up ARM64 cross-compilation...{NC}")

    # Check if already have cross-compiler
    if check_command_exists("aarch64-linux-gnu-gcc"):
        return True

    print(f"{YELLOW}Installing ARM64 cross-compilation tools...{NC}")

    # Add arm64 architecture
    rc, _, _ = run_command(
        ["sudo", "dpkg", "--add-architecture", "arm64"],
        check=False
    )
    if rc != 0:
        return False

    # Update package list
    rc, _, _ = run_command(["sudo", "apt-get", "update"], check=False)
    if rc != 0:
        return False

    # Install cross-compilation tools
    rc, _, _ = run_command([
        "sudo", "apt-get", "install", "-y",
        "gcc-aarch64-linux-gnu",
        "g++-aarch64-linux-gnu",
        "libc6-dev-arm64-cross"
    ], check=False)

    return rc == 0


def configure_cargo_cross_compile() -> bool:
    """Configure cargo for ARM64 cross-compilation.

    Returns:
        True if successful.
    """
    cargo_config = Path.home() / ".cargo" / "config.toml"
    cargo_config.parent.mkdir(parents=True, exist_ok=True)

    # Check if already configured
    if cargo_config.exists():
        content = cargo_config.read_text()
        if "aarch64-unknown-linux-gnu" in content:
            return True

    # Append configuration
    config_addition = '''
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
'''
    with open(cargo_config, "a") as f:
        f.write(config_addition)

    print(f"{YELLOW}Configured cargo for cross-compilation{NC}")
    return True


def install_rust_target(target: str) -> bool:
    """Install a Rust target.

    Args:
        target: Rust target triple.

    Returns:
        True if successful.
    """
    print(f"{YELLOW}Installing Rust target: {target}...{NC}")
    rc, _, _ = run_command(["rustup", "target", "add", target], check=False)
    return rc == 0


def install_npm_dependencies(project_root: Path) -> bool:
    """Install npm dependencies.

    Args:
        project_root: Project root directory.

    Returns:
        True if successful.
    """
    print(f"{YELLOW}Installing npm dependencies...{NC}")
    rc, _, _ = run_command(
        ["npm", "ci", "--legacy-peer-deps"],
        cwd=project_root,
        check=False
    )
    return rc == 0


def build_frontend(project_root: Path) -> bool:
    """Build the frontend.

    Args:
        project_root: Project root directory.

    Returns:
        True if successful.
    """
    print(f"{YELLOW}Building frontend...{NC}")
    rc, _, _ = run_command(
        ["npm", "run", "build"],
        cwd=project_root,
        check=False
    )
    return rc == 0


def build_tauri(config: BuildConfig) -> bool:
    """Build the Tauri application.

    Args:
        config: Build configuration.

    Returns:
        True if successful.
    """
    print(f"{YELLOW}Building Tauri application...{NC}")

    cmd = ["npm", "run", "tauri", "build", "--", "--target", config.rust_target]
    if config.build_type == "debug":
        cmd.insert(5, "--debug")

    env = {"NEXT_CONFIG_FILE": "next.config.tauri.js"}
    rc, _, _ = run_command(cmd, cwd=config.project_root, env=env, check=False)
    return rc == 0


def generate_checksum(file_path: Path) -> Optional[Path]:
    """Generate SHA256 checksum for a file.

    Args:
        file_path: Path to file.

    Returns:
        Path to checksum file or None.
    """
    if not file_path.exists():
        return None

    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256_hash.update(chunk)

    checksum_path = file_path.with_suffix(file_path.suffix + ".sha256")
    checksum = sha256_hash.hexdigest()
    checksum_path.write_text(f"{checksum}  {file_path.name}\n")

    return checksum_path


def get_file_size(file_path: Path) -> str:
    """Get human-readable file size.

    Args:
        file_path: Path to file.

    Returns:
        Human-readable size string.
    """
    size = file_path.stat().st_size
    for unit in ['B', 'K', 'M', 'G']:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}T"


def find_artifact(bundle_dir: Path, subdir: str, pattern: str) -> Optional[BuildArtifact]:
    """Find a build artifact.

    Args:
        bundle_dir: Bundle directory.
        subdir: Subdirectory name.
        pattern: File pattern (glob).

    Returns:
        BuildArtifact or None.
    """
    artifact_dir = bundle_dir / subdir
    if not artifact_dir.exists():
        return None

    files = list(artifact_dir.glob(pattern))
    if not files:
        return None

    file_path = files[0]
    size = get_file_size(file_path)
    checksum_path = generate_checksum(file_path)

    return BuildArtifact(
        path=file_path,
        size=size,
        checksum_path=checksum_path
    )


def print_header(config: BuildConfig) -> None:
    """Print build header.

    Args:
        config: Build configuration.
    """
    print(f"{GREEN}VibeCode Desktop - Linux Build Script{NC}")
    print("=========================================")
    print(f"Project Root: {config.project_root}")
    print(f"Build Type: {config.build_type}")
    print(f"Architecture: {config.arch}")
    print(f"Create .deb: {config.create_deb}")
    print(f"Create .AppImage: {config.create_appimage}")
    print(f"Create .rpm: {config.create_rpm}")
    print()


def print_artifacts(
    deb: Optional[BuildArtifact],
    appimage: Optional[BuildArtifact],
    rpm: Optional[BuildArtifact]
) -> None:
    """Print build artifacts.

    Args:
        deb: .deb artifact.
        appimage: .AppImage artifact.
        rpm: .rpm artifact.
    """
    print()
    print(f"{GREEN}=========================================")
    print("Build Complete!")
    print(f"========================================={NC}")
    print()
    print("Build artifacts:")

    if deb:
        print(f"  .deb package: {deb.path} ({deb.size})")
        if deb.checksum_path:
            print(f"    Checksum: {deb.checksum_path.name}")

    if appimage:
        print(f"  .AppImage: {appimage.path} ({appimage.size})")
        if appimage.checksum_path:
            print(f"    Checksum: {appimage.checksum_path.name}")

    if rpm:
        print(f"  .rpm package: {rpm.path} ({rpm.size})")
        if rpm.checksum_path:
            print(f"    Checksum: {rpm.checksum_path.name}")

    print()


def print_installation_instructions(
    deb: Optional[BuildArtifact],
    appimage: Optional[BuildArtifact],
    rpm: Optional[BuildArtifact]
) -> None:
    """Print installation instructions.

    Args:
        deb: .deb artifact.
        appimage: .AppImage artifact.
        rpm: .rpm artifact.
    """
    print(f"{GREEN}Installation Instructions:{NC}")
    print()

    if deb:
        print("Debian/Ubuntu (.deb):")
        print(f"  sudo dpkg -i {deb.path}")
        print()

    if rpm:
        print("Fedora/RHEL (.rpm):")
        print(f"  sudo rpm -i {rpm.path}")
        print()

    if appimage:
        print("AppImage (any distro):")
        print(f"  chmod +x {appimage.path}")
        print(f"  {appimage.path}")
        print()


def is_native_arm64() -> bool:
    """Check if running on native ARM64.

    Returns:
        True if native ARM64.
    """
    rc, stdout, _ = run_command(["uname", "-m"], check=False)
    return rc == 0 and stdout.strip() == "aarch64"


def build(config: BuildConfig) -> int:
    """Run the build process.

    Args:
        config: Build configuration.

    Returns:
        Exit code (0 for success).
    """
    print_header(config)

    # Validate architecture
    if config.arch not in SUPPORTED_ARCHES:
        print(f"{RED}Error: Unsupported architecture: {config.arch}{NC}")
        return 1

    # Get Rust target
    config.rust_target = get_rust_target(config.arch)
    if not config.rust_target:
        print(f"{RED}Error: Could not determine Rust target{NC}")
        return 1

    # Check prerequisites
    print(f"{YELLOW}Checking prerequisites...{NC}")
    ok, missing = check_prerequisites()
    if not ok:
        for tool in missing:
            print(f"{RED}Error: {tool} not found{NC}")
        return 1

    # Print versions
    print(f"✓ Node.js {get_command_version('node', '--version')}")
    print(f"✓ npm {get_command_version('npm', '--version')}")
    print(f"✓ {get_command_version('rustc', '--version')}")

    # Check Linux dependencies
    print(f"{YELLOW}Checking Linux dependencies...{NC}")
    ok, missing = check_linux_dependencies()
    if not ok:
        print(f"{RED}Missing dependencies: {' '.join(missing)}{NC}")
        print("Install with:")
        print(f"  sudo apt-get install -y {' '.join(missing)}")
        return 1

    # Check for RPM tools
    if config.create_rpm and config.arch == "x86_64":
        if not check_command_exists("rpmbuild"):
            if not install_rpm_tools():
                print(f"{YELLOW}Warning: Could not install rpm tools{NC}")
                config.create_rpm = False

    # Setup cross-compilation for ARM64
    if config.arch == "arm64" and not is_native_arm64():
        if not setup_arm64_cross_compilation():
            print(f"{RED}Error: Failed to setup ARM64 cross-compilation{NC}")
            return 1

        if not configure_cargo_cross_compile():
            print(f"{RED}Error: Failed to configure cargo{NC}")
            return 1

        # RPM not supported for cross-compilation
        if config.create_rpm:
            print(f"{YELLOW}Note: RPM building disabled for ARM64 cross-compilation{NC}")
            config.create_rpm = False

    # Install Rust target
    if not install_rust_target(config.rust_target):
        print(f"{RED}Error: Failed to install Rust target{NC}")
        return 1

    # Install npm dependencies
    if not install_npm_dependencies(config.project_root):
        print(f"{RED}Error: Failed to install npm dependencies{NC}")
        return 1

    # Build frontend
    if not build_frontend(config.project_root):
        print(f"{RED}Error: Failed to build frontend{NC}")
        return 1

    # Build Tauri app
    if not build_tauri(config):
        print(f"{RED}Error: Failed to build Tauri application{NC}")
        return 1

    # Verify build
    config.bundle_dir = (
        config.project_root / "src-tauri" / "target" /
        config.rust_target / config.build_type / "bundle"
    )

    if not config.bundle_dir.exists():
        print(f"{RED}Error: Build failed - bundle directory not found{NC}")
        return 1

    print(f"{GREEN}✓ Build successful{NC}")

    # Find artifacts
    deb = None
    appimage = None
    rpm = None

    if config.create_deb:
        deb = find_artifact(config.bundle_dir, "deb", "*.deb")

    if config.create_appimage:
        appimage = find_artifact(config.bundle_dir, "appimage", "*.AppImage")

    if config.create_rpm:
        rpm = find_artifact(config.bundle_dir, "rpm", "*.rpm")

    # Print results
    print_artifacts(deb, appimage, rpm)
    print_installation_instructions(deb, appimage, rpm)

    print(f"{GREEN}Done!{NC}")
    return 0


def main(
    build_type: Optional[str] = None,
    arch: Optional[str] = None,
    create_deb: Optional[bool] = None,
    create_appimage: Optional[bool] = None,
    create_rpm: Optional[bool] = None,
    project_root: Optional[Path] = None
) -> int:
    """Main entry point.

    Args:
        build_type: Build type (release or debug).
        arch: Target architecture.
        create_deb: Create .deb package.
        create_appimage: Create .AppImage.
        create_rpm: Create .rpm package.
        project_root: Project root directory.

    Returns:
        Exit code (0 for success).
    """
    # Determine project root
    if project_root is None:
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent.parent

    # Get configuration from environment
    config = BuildConfig(
        project_root=project_root,
        build_type=os.environ.get("BUILD_TYPE", "release"),
        arch=os.environ.get("ARCH", "x86_64"),
        create_deb=os.environ.get("CREATE_DEB", "true").lower() == "true",
        create_appimage=os.environ.get("CREATE_APPIMAGE", "true").lower() == "true",
        create_rpm=os.environ.get("CREATE_RPM", "true").lower() == "true",
    )

    # Override with arguments
    if build_type:
        config.build_type = build_type
    if arch:
        config.arch = arch
    if create_deb is not None:
        config.create_deb = create_deb
    if create_appimage is not None:
        config.create_appimage = create_appimage
    if create_rpm is not None:
        config.create_rpm = create_rpm

    return build(config)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="VibeCode Desktop - Linux Build Script"
    )
    parser.add_argument(
        '--build-type',
        choices=['release', 'debug'],
        help="Build type (default: release or BUILD_TYPE env)"
    )
    parser.add_argument(
        '--arch',
        choices=['x86_64', 'arm64'],
        help="Target architecture (default: x86_64 or ARCH env)"
    )
    parser.add_argument(
        '--no-deb',
        action='store_true',
        help="Skip .deb package creation"
    )
    parser.add_argument(
        '--no-appimage',
        action='store_true',
        help="Skip .AppImage creation"
    )
    parser.add_argument(
        '--no-rpm',
        action='store_true',
        help="Skip .rpm package creation"
    )

    args = parser.parse_args()

    sys.exit(main(
        build_type=args.build_type,
        arch=args.arch,
        create_deb=not args.no_deb if args.no_deb else None,
        create_appimage=not args.no_appimage if args.no_appimage else None,
        create_rpm=not args.no_rpm if args.no_rpm else None
    ))
