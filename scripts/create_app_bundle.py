#!/usr/bin/env python3
"""Create VibeCode.app Bundle.

This script creates a macOS app bundle structure for VibeCode,
copying the binary, Info.plist, entitlements, and symlinking VM images.
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
NC = '\033[0m'

# Bundle configuration
APP_BUNDLE_NAME = "VibeCode.app"
BINARY_NAME = "VibeCode"
VM_IMAGES = [
    "vibecode-postgresql.img",
    "vibecode-postgresql-efi.nvram",
]


def get_vibecode_dir() -> Path:
    """Get the VibeCodeSwift directory path.

    Returns:
        Path to VibeCodeSwift directory.
    """
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent / "VibeCodeSwift"


def get_bundle_size(bundle_path: Path) -> str:
    """Get human-readable size of the app bundle.

    Args:
        bundle_path: Path to the app bundle.

    Returns:
        Human-readable size string.
    """
    try:
        result = subprocess.run(
            ["du", "-sh", str(bundle_path)],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.split()[0]
    except Exception:
        pass
    return "unknown"


def create_bundle_structure(app_bundle: Path) -> bool:
    """Create the app bundle directory structure.

    Args:
        app_bundle: Path to the app bundle.

    Returns:
        True if successful.
    """
    print(f"{GREEN}Creating app bundle structure...{NC}")

    try:
        macos_dir = app_bundle / "Contents" / "MacOS"
        resources_dir = app_bundle / "Contents" / "Resources" / "vms"

        macos_dir.mkdir(parents=True, exist_ok=True)
        resources_dir.mkdir(parents=True, exist_ok=True)

        return True
    except OSError as e:
        print(f"{YELLOW}Error creating directories: {e}{NC}")
        return False


def copy_binary(vibecode_dir: Path, app_bundle: Path) -> bool:
    """Copy the binary to the app bundle.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory.
        app_bundle: Path to the app bundle.

    Returns:
        True if successful.
    """
    print(f"{GREEN}Copying binary...{NC}")

    source = vibecode_dir / ".build" / "release" / BINARY_NAME
    dest = app_bundle / "Contents" / "MacOS" / BINARY_NAME

    if not source.exists():
        print(f"{YELLOW}Error: Binary not found: {source}{NC}")
        return False

    try:
        shutil.copy2(source, dest)
        dest.chmod(0o755)
        return True
    except OSError as e:
        print(f"{YELLOW}Error copying binary: {e}{NC}")
        return False


def copy_info_plist(vibecode_dir: Path, app_bundle: Path) -> bool:
    """Copy Info.plist to the app bundle.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory.
        app_bundle: Path to the app bundle.

    Returns:
        True if successful.
    """
    print(f"{GREEN}Copying Info.plist...{NC}")

    source = vibecode_dir / "Info.plist"
    dest = app_bundle / "Contents" / "Info.plist"

    if not source.exists():
        print(f"{YELLOW}Error: Info.plist not found: {source}{NC}")
        return False

    try:
        shutil.copy2(source, dest)
        return True
    except OSError as e:
        print(f"{YELLOW}Error copying Info.plist: {e}{NC}")
        return False


def copy_entitlements(vibecode_dir: Path, app_bundle: Path) -> bool:
    """Copy entitlements to the app bundle.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory.
        app_bundle: Path to the app bundle.

    Returns:
        True if successful.
    """
    print(f"{GREEN}Copying entitlements...{NC}")

    source = vibecode_dir / "VibeCode.entitlements"
    dest = app_bundle / "Contents" / "VibeCode.entitlements"

    if not source.exists():
        print(f"{YELLOW}Error: Entitlements not found: {source}{NC}")
        return False

    try:
        shutil.copy2(source, dest)
        return True
    except OSError as e:
        print(f"{YELLOW}Error copying entitlements: {e}{NC}")
        return False


def symlink_vm_images(vibecode_dir: Path, app_bundle: Path) -> bool:
    """Create symlinks for VM images.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory.
        app_bundle: Path to the app bundle.

    Returns:
        True if successful.
    """
    print(f"{GREEN}Symlinking VM images...{NC}")

    vms_dir = app_bundle / "Contents" / "Resources" / "vms"
    vm_images_dir = vibecode_dir.parent / "dist" / "vm-images"

    for image_name in VM_IMAGES:
        source = vm_images_dir / image_name
        dest = vms_dir / image_name

        # Remove existing symlink if present
        if dest.is_symlink() or dest.exists():
            dest.unlink()

        # Create relative symlink
        try:
            # Calculate relative path from dest to source
            rel_path = Path("../../../../dist/vm-images") / image_name
            dest.symlink_to(rel_path)
        except OSError as e:
            print(f"{YELLOW}Warning: Could not symlink {image_name}: {e}{NC}")

    return True


def list_bundle_contents(app_bundle: Path) -> None:
    """List the contents of the MacOS directory.

    Args:
        app_bundle: Path to the app bundle.
    """
    macos_dir = app_bundle / "Contents" / "MacOS"

    print(f"{GREEN}Bundle contents:{NC}")
    try:
        result = subprocess.run(
            ["ls", "-lh", str(macos_dir)],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print(result.stdout)
    except Exception:
        for item in macos_dir.iterdir():
            print(f"  {item.name}")


def print_summary(app_bundle: Path) -> None:
    """Print summary and instructions.

    Args:
        app_bundle: Path to the app bundle.
    """
    print(f"{GREEN}App bundle created!{NC}")
    print()
    print(f"Location: {app_bundle}")
    print(f"Size: {get_bundle_size(app_bundle)}")
    print()

    list_bundle_contents(app_bundle)

    print(f"{GREEN}To test:{NC}")
    print(f"  open {app_bundle}")
    print()
    print(f"{YELLOW}Note: For distribution, you'll need to:{NC}")
    print("  1. Code sign with: codesign --deep --force --sign 'Developer ID' "
          "--entitlements VibeCode.entitlements VibeCode.app")
    print("  2. Create DMG with: hdiutil create -volname VibeCode "
          "-srcfolder VibeCode.app -ov -format UDZO VibeCode.dmg")
    print("  3. Notarize (optional)")


def main(
    vibecode_dir: Optional[Path] = None,
    output_dir: Optional[Path] = None
) -> int:
    """Main entry point.

    Args:
        vibecode_dir: Path to VibeCodeSwift directory (default: auto-detect).
        output_dir: Output directory for app bundle (default: .build/release).

    Returns:
        Exit code (0 for success).
    """
    print(f"{GREEN}Creating VibeCode.app Bundle{NC}")
    print()

    # Get VibeCodeSwift directory
    if vibecode_dir is None:
        vibecode_dir = get_vibecode_dir()

    if not vibecode_dir.exists():
        print(f"{YELLOW}Error: VibeCodeSwift directory not found: {vibecode_dir}{NC}")
        return 1

    # Determine output location
    if output_dir is None:
        output_dir = vibecode_dir / ".build" / "release"

    app_bundle = output_dir / APP_BUNDLE_NAME

    # Create bundle structure
    if not create_bundle_structure(app_bundle):
        return 1

    # Copy binary
    if not copy_binary(vibecode_dir, app_bundle):
        return 1

    # Copy Info.plist
    if not copy_info_plist(vibecode_dir, app_bundle):
        return 1

    # Copy entitlements
    if not copy_entitlements(vibecode_dir, app_bundle):
        return 1

    # Symlink VM images
    symlink_vm_images(vibecode_dir, app_bundle)

    print()
    print_summary(app_bundle)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create VibeCode.app Bundle"
    )
    parser.add_argument(
        '-d', '--directory',
        type=Path,
        help="Path to VibeCodeSwift directory (default: auto-detect)"
    )
    parser.add_argument(
        '-o', '--output',
        type=Path,
        help="Output directory for app bundle (default: .build/release)"
    )

    args = parser.parse_args()
    sys.exit(main(args.directory, args.output))
