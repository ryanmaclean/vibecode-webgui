#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "package-lima-kiosk"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Package Lima Kiosk as macOS app bundle.

Creates VibeCodeLima.app with the Lima launcher and startup scripts.
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
from pathlib import Path


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
    cwd: str | Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check, cwd=cwd)


def log(message: str) -> None:
    """Print log message."""
    print(f"[package-lima] {message}")


INFO_PLIST = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>VibeCode Lima Kiosk</string>
  <key>CFBundleIdentifier</key>
  <string>com.vibecode.lima.kiosk</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>VibeCodeLima</string>
</dict>
</plist>
"""

LAUNCH_SCRIPT = """#!/usr/bin/env bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES="$APP_ROOT/Resources"
export LIMA_LAUNCHER_BIN="$RESOURCES/lima-launcher"
export CHROMIUM_PROFILE_DIR="$HOME/Library/Application Support/VibeCodeLima/Profile"
export CODE_SERVER_VERSION="4.105.1"
"$RESOURCES/start-chromium-ide.sh"
"""


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--code-server-version",
        default="4.105.1",
        help="code-server version",
    )

    args = parser.parse_args(argv)

    script_dir = Path(__file__).parent.resolve()
    repo_root = script_dir.parent.parent

    dist_dir = repo_root / "dist"
    app_name = "VibeCodeLima.app"
    app_dir = dist_dir / app_name
    launcher_bin = repo_root / "swift" / "lima-launcher" / ".build" / "release" / "lima-launcher"

    # Build lima-launcher
    log("Building lima-launcher (release)")
    result = run_cmd(
        ["swift", "build", "-c", "release", "--package-path", str(repo_root / "swift" / "lima-launcher")],
        capture=False,
    )
    if result.returncode != 0:
        log("Failed to build lima-launcher")
        return 1

    # Remove old app if exists
    if app_dir.exists():
        shutil.rmtree(app_dir)

    # Create app structure
    macos_dir = app_dir / "Contents" / "MacOS"
    resources_dir = app_dir / "Contents" / "Resources"
    macos_dir.mkdir(parents=True, exist_ok=True)
    resources_dir.mkdir(parents=True, exist_ok=True)

    # Write Info.plist
    (app_dir / "Contents" / "Info.plist").write_text(INFO_PLIST)

    # Write launch script
    launch_script = LAUNCH_SCRIPT.replace("4.105.1", args.code_server_version)
    launch_script_path = macos_dir / "VibeCodeLima"
    launch_script_path.write_text(launch_script)
    launch_script_path.chmod(0o755)

    # Copy start-chromium-ide.sh
    src_script = repo_root / "scripts" / "dev" / "start-chromium-ide.sh"
    dst_script = resources_dir / "start-chromium-ide.sh"
    shutil.copy2(src_script, dst_script)
    dst_script.chmod(0o755)

    # Copy lima-launcher
    if not launcher_bin.exists():
        log(f"lima-launcher not found at {launcher_bin}")
        return 1

    dst_launcher = resources_dir / "lima-launcher"
    shutil.copy2(launcher_bin, dst_launcher)
    dst_launcher.chmod(0o755)

    log(f"Packaged {app_name} in {dist_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())