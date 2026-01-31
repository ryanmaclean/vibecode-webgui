#!/usr/bin/env python3
"""VibeCode Desktop - macOS Build Script.

Builds universal binary for both Intel and Apple Silicon.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
from datetime import datetime
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

    # Check macOS-specific tools
    if not shutil.which("pkg-config"):
        print(f"{Colors.YELLOW}Warning: pkg-config not found. Installing via Homebrew...{Colors.NC}")
        run_cmd(["brew", "install", "pkg-config"], capture=False)

    # Check for openssl
    result = run_cmd(["brew", "list", "openssl@3"])
    if result.returncode != 0:
        print(f"{Colors.YELLOW}Warning: openssl@3 not found. Installing via Homebrew...{Colors.NC}")
        run_cmd(["brew", "install", "openssl@3"], capture=False)

    return all_ok


def sign_app(app_path: Path, signing_identity: str, entitlements: Path) -> bool:
    """Sign the application bundle."""
    print(f"{Colors.YELLOW}Signing application...{Colors.NC}")

    result = run_cmd([
        "codesign",
        "--force", "--deep",
        "--sign", signing_identity,
        "--options", "runtime",
        "--entitlements", str(entitlements),
        "--timestamp",
        str(app_path),
    ], capture=False)

    if result.returncode != 0:
        return False

    # Verify signature
    result = run_cmd([
        "codesign",
        "--verify", "--deep", "--strict", "--verbose=2",
        str(app_path),
    ], capture=False)

    return result.returncode == 0


def create_dmg(
    app_path: Path,
    dmg_dir: Path,
    project_root: Path,
    signing_identity: str | None = None,
) -> Path | None:
    """Create DMG installer."""
    print(f"{Colors.YELLOW}Creating DMG installer...{Colors.NC}")

    dmg_dir.mkdir(parents=True, exist_ok=True)
    dmg_name = f"VibeCode_{datetime.now().strftime('%Y%m%d')}.dmg"
    dmg_path = dmg_dir / dmg_name

    # Try create-dmg first
    if shutil.which("create-dmg"):
        icon_path = project_root / "src-tauri" / "icons" / "icon.icns"
        result = run_cmd([
            "create-dmg",
            "--volname", "VibeCode",
            "--volicon", str(icon_path),
            "--window-pos", "200", "120",
            "--window-size", "800", "400",
            "--icon-size", "100",
            "--icon", "VibeCode.app", "200", "190",
            "--hide-extension", "VibeCode.app",
            "--app-drop-link", "600", "185",
            "--no-internet-enable",
            str(dmg_path),
            str(app_path),
        ], capture=False)

        if result.returncode != 0:
            print("Falling back to hdiutil...")
            result = run_cmd([
                "hdiutil", "create",
                "-volname", "VibeCode",
                "-srcfolder", str(app_path),
                "-ov", "-format", "UDZO",
                str(dmg_path),
            ], capture=False)
    else:
        # Fallback to hdiutil
        result = run_cmd([
            "hdiutil", "create",
            "-volname", "VibeCode",
            "-srcfolder", str(app_path),
            "-ov", "-format", "UDZO",
            str(dmg_path),
        ], capture=False)

    if result.returncode != 0:
        print(f"{Colors.RED}Failed to create DMG{Colors.NC}")
        return None

    print(f"{Colors.GREEN}[OK] DMG created: {dmg_path}{Colors.NC}")

    # Sign DMG if requested
    if signing_identity:
        print(f"{Colors.YELLOW}Signing DMG...{Colors.NC}")
        run_cmd([
            "codesign", "--force",
            "--sign", signing_identity,
            "--timestamp",
            str(dmg_path),
        ], capture=False)

    # Generate checksums
    print(f"{Colors.YELLOW}Generating checksums...{Colors.NC}")

    sha256 = hashlib.sha256()
    sha256.update(dmg_path.read_bytes())
    (dmg_path.with_suffix(".dmg.sha256")).write_text(f"{sha256.hexdigest()}  {dmg_name}\n")

    sha512 = hashlib.sha512()
    sha512.update(dmg_path.read_bytes())
    (dmg_path.with_suffix(".dmg.sha512")).write_text(f"{sha512.hexdigest()}  {dmg_name}\n")

    print("SHA256:")
    print(f"  {sha256.hexdigest()}")

    return dmg_path


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
        "--sign",
        action="store_true",
        default=os.environ.get("SIGN_BUILD", "false").lower() == "true",
        help="Sign the build",
    )
    parser.add_argument(
        "--no-dmg",
        action="store_true",
        help="Skip DMG creation",
    )
    parser.add_argument(
        "--signing-identity",
        default=os.environ.get("APPLE_SIGNING_IDENTITY"),
        help="Apple signing identity",
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

    print(f"{Colors.GREEN}VibeCode Desktop - macOS Build Script{Colors.NC}")
    print("=" * 40)
    print(f"Project Root: {project_root}")
    print(f"Build Type: {args.build_type}")
    print(f"Sign Build: {args.sign}")
    print(f"Create DMG: {not args.no_dmg}")
    print()

    if not check_prerequisites():
        return 1

    # Setup environment
    env = os.environ.copy()
    pkg_config_path = env.get("PKG_CONFIG_PATH", "")
    env["PKG_CONFIG_PATH"] = f"/opt/homebrew/opt/openssl@3/lib/pkgconfig:{pkg_config_path}"
    env["NEXT_CONFIG_FILE"] = "next.config.tauri.js"

    # Install Rust targets
    print(f"{Colors.YELLOW}Installing Rust targets...{Colors.NC}")
    run_cmd(["rustup", "target", "add", "x86_64-apple-darwin", "aarch64-apple-darwin"], capture=False)

    # Navigate to project root
    os.chdir(project_root)

    # Install dependencies
    print(f"{Colors.YELLOW}Installing npm dependencies...{Colors.NC}")
    run_cmd(["npm", "ci", "--legacy-peer-deps"], capture=False)

    # Build frontend
    print(f"{Colors.YELLOW}Building frontend...{Colors.NC}")
    run_cmd(["npm", "run", "build"], capture=False)

    # Build Tauri app
    print(f"{Colors.YELLOW}Building Tauri application...{Colors.NC}")
    cmd = ["npm", "run", "tauri", "build", "--", "--target", "universal-apple-darwin"]
    if args.build_type == "debug":
        cmd.insert(4, "--debug")

    result = run_cmd(cmd, capture=False, env=env)
    if result.returncode != 0:
        print(f"{Colors.RED}Build failed{Colors.NC}")
        return 1

    # Build artifacts location
    bundle_dir = project_root / "src-tauri" / "target" / "universal-apple-darwin" / args.build_type / "bundle"
    app_path = bundle_dir / "macos" / "VibeCode.app"
    dmg_dir = bundle_dir / "dmg"

    if not app_path.exists():
        print(f"{Colors.RED}Error: Build failed - app bundle not found{Colors.NC}")
        return 1

    print(f"{Colors.GREEN}[OK] Build successful{Colors.NC}")
    print(f"App bundle: {app_path}")

    # Code signing
    if args.sign:
        if not args.signing_identity:
            print(f"{Colors.RED}Error: APPLE_SIGNING_IDENTITY not set{Colors.NC}")
            return 1

        entitlements = project_root / "src-tauri" / "entitlements.plist"
        if not entitlements.exists():
            print(f"{Colors.RED}Error: entitlements.plist not found{Colors.NC}")
            return 1

        if not sign_app(app_path, args.signing_identity, entitlements):
            print(f"{Colors.RED}Failed to sign application{Colors.NC}")
            return 1

        print(f"{Colors.GREEN}[OK] Application signed{Colors.NC}")

    # Create DMG
    dmg_path = None
    if not args.no_dmg:
        dmg_path = create_dmg(
            app_path,
            dmg_dir,
            project_root,
            args.signing_identity if args.sign else None,
        )

    # Create app tarball
    print(f"{Colors.YELLOW}Creating app bundle archive...{Colors.NC}")
    tarball_name = "VibeCode.app.tar.gz"
    run_cmd(
        ["tar", "-czf", tarball_name, app_path.name],
        cwd=str(app_path.parent),
        capture=False,
    )
    print(f"{Colors.GREEN}[OK] Archive created: {app_path.parent / tarball_name}{Colors.NC}")

    # Summary
    print()
    print(f"{Colors.GREEN}========================================={Colors.NC}")
    print("Build Complete!")
    print(f"{Colors.GREEN}========================================={Colors.NC}")
    print()
    print("Build artifacts:")
    print(f"  App Bundle: {app_path}")
    if dmg_path:
        print(f"  DMG: {dmg_path}")
        print(f"  SHA256: {dmg_path}.sha256")
        print(f"  SHA512: {dmg_path}.sha512")
    print(f"  Archive: {app_path.parent / tarball_name}")
    print()

    # App size
    result = run_cmd(["du", "-sh", str(app_path)])
    if result.returncode == 0:
        print(f"App size: {result.stdout.split()[0]}")

    print()
    print(f"{Colors.GREEN}Done!{Colors.NC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
