#!/usr/bin/env python3
"""Install VibeCode VM for macOS.

Downloads kernel components, builds the binary, and sets up launchd service.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


def run_script(script_path: Path) -> bool:
    """Run a shell script."""
    try:
        subprocess.run([str(script_path)], check=True)
        return True
    except subprocess.CalledProcessError:
        return False
    except FileNotFoundError:
        print(f"Script not found: {script_path}")
        return False


def create_launchd_plist(project_root: Path) -> Path:
    """Create launchd plist for auto-start."""
    home = Path.home()
    plist_dir = home / "Library" / "LaunchAgents"
    plist_path = plist_dir / "com.vibecode.vm.plist"

    # Create directory if needed
    plist_dir.mkdir(parents=True, exist_ok=True)

    # Create log directory
    log_dir = home / ".vibecode" / "vm"
    log_dir.mkdir(parents=True, exist_ok=True)

    binary_path = project_root / "bin" / "vibecode-vm"

    plist_content = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.vm</string>
    <key>ProgramArguments</key>
    <array>
        <string>{binary_path}</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>{home}/.vibecode/vm/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>{home}/.vibecode/vm/stderr.log</string>
</dict>
</plist>
"""

    plist_path.write_text(plist_content)
    return plist_path


def print_usage(plist_path: Path) -> None:
    """Print usage instructions."""
    print("\u2705 Installation complete!")
    print()
    print("Usage:")
    print("   Manual:    ./bin/vibecode-vm")
    print(f"   Service:   launchctl load {plist_path}")
    print("              launchctl start com.vibecode.vm")
    print()
    print("Stop service:")
    print("   launchctl stop com.vibecode.vm")
    print(f"   launchctl unload {plist_path}")


def main() -> int:
    """Main entry point."""
    print("Installing VibeCode VM for macOS...")

    project_root = get_project_root()

    # Download kernel components
    download_script = project_root / "scripts" / "macos-vm" / "download-kernel.sh"
    if not run_script(download_script):
        print("Failed to download kernel components")
        return 1

    # Build the binary
    build_script = project_root / "scripts" / "macos-vm" / "build.sh"
    if not run_script(build_script):
        print("Failed to build binary")
        return 1

    # Create launchd plist for auto-start
    plist_path = create_launchd_plist(project_root)

    print_usage(plist_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
