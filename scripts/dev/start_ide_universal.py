#!/usr/bin/env python3
"""Universal IDE launcher.

Detects the best available method (vfkit, Lima, or host) and launches
the IDE accordingly.
"""
from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import time
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
    print(f"[universal-ide] {message}")


def is_url_healthy(url: str) -> bool:
    """Check if URL is responding."""
    result = run_cmd(["curl", "-fsS", url])
    return result.returncode == 0


def launch_chrome(
    chrome_app: str,
    url: str,
    profile_dir: str,
) -> None:
    """Launch Chrome in kiosk mode."""
    subprocess.Popen([
        "open", "-a", chrome_app, "--args",
        "--kiosk",
        f"--app={url}",
        "--disable-translate",
        "--no-first-run",
        f"--user-data-dir={profile_dir}",
    ])


def start_vfkit(repo_root: Path, chrome_app: str, profile_dir: str, microvm_arch: str) -> int:
    """Start vfkit microVM and launch Chrome."""
    log("Detected arm64 + vfkit; launching fast microVM")

    env = os.environ.copy()
    env["MICROVM_ARCH"] = microvm_arch

    result = run_cmd(
        [str(repo_root / "scripts" / "benchmarks" / "vscode_microvm.sh"), "start"],
        env=env,
        cwd=str(repo_root),
    )
    if result.returncode != 0:
        log("Failed to start vfkit microVM")
        return 1

    log("Waiting for http://127.0.0.1:3600/healthz")
    while not is_url_healthy("http://127.0.0.1:3600/healthz"):
        time.sleep(1)

    launch_chrome(chrome_app, "http://127.0.0.1:3600", profile_dir)
    return 0


def start_lima(repo_root: Path) -> int:
    """Start Lima microVM."""
    log("Using Lima microVM")
    script = repo_root / "scripts" / "dev" / "start-chromium-ide.sh"
    result = run_cmd(["bash", str(script)], capture=False)
    return result.returncode


def start_host(repo_root: Path) -> int:
    """Start in host-only mode."""
    log("Lima/vfkit not available; falling back to host mode")
    env = os.environ.copy()
    env["LIMA_DISABLED"] = "1"
    script = repo_root / "scripts" / "dev" / "start-chromium-ide.sh"
    result = run_cmd(["bash", str(script)], env=env, capture=False)
    return result.returncode


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--chrome-app",
        default=os.environ.get("CHROMIUM_APP_PATH", "/Applications/Google Chrome.app"),
        help="Chrome/Chromium app path",
    )
    parser.add_argument(
        "--profile-dir",
        default=os.environ.get("CHROMIUM_PROFILE_DIR"),
        help="Chrome user data directory",
    )
    parser.add_argument(
        "--microvm-arch",
        default=os.environ.get("MICROVM_ARCH", "x86_64"),
        help="MicroVM architecture",
    )
    parser.add_argument(
        "--force-lima",
        action="store_true",
        help="Force using Lima even on ARM64 with vfkit",
    )
    parser.add_argument(
        "--force-host",
        action="store_true",
        help="Force host-only mode",
    )

    args = parser.parse_args(argv)

    script_dir = Path(__file__).parent.resolve()
    repo_root = script_dir.parent.parent
    arch = platform.machine()
    profile_dir = args.profile_dir or str(repo_root / ".chrome-code-server")

    # Check Chrome exists
    if not Path(args.chrome_app).exists():
        log(f"error: Chrome/Chromium missing at {args.chrome_app}")
        return 1

    if args.force_host:
        return start_host(repo_root)

    # Determine best method
    has_vfkit = shutil.which("vfkit") is not None
    has_lima = shutil.which("limactl") is not None

    if arch == "arm64" and has_vfkit and not args.force_lima:
        return start_vfkit(repo_root, args.chrome_app, profile_dir, args.microvm_arch)
    elif has_lima:
        return start_lima(repo_root)
    else:
        return start_host(repo_root)


if __name__ == "__main__":
    sys.exit(main())
