#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "start-chromium-ide"
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

"""Start Chromium IDE kiosk with code-server.

Launches code-server (via Lima VM, Docker, or host) and opens
Chromium in kiosk mode pointing to the IDE.
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
    print(f"[chromium-ide] {message}")


def is_url_healthy(url: str) -> bool:
    """Check if URL is responding."""
    result = run_cmd(["curl", "-fsS", url])
    return result.returncode == 0


def start_host_codeserver(code_server_version: str) -> int | None:
    """Start code-server on the host as fallback."""
    # Try code-server binary
    if shutil.which("code-server"):
        run_cmd(["pkill", "-f", "code-server --bind-addr 127.0.0.1:8080"])
        proc = subprocess.Popen(
            ["code-server", "--bind-addr", "127.0.0.1:8080", "--auth", "none", "--disable-telemetry"],
            stdout=open("/tmp/host-code-server.log", "w"),
            stderr=subprocess.STDOUT,
        )
        log(f"Started host code-server fallback (pid {proc.pid})")
        Path("/tmp/host-code-server.pid").write_text(str(proc.pid))
        return proc.pid

    # Try npx
    if shutil.which("npx"):
        run_cmd(["pkill", "-f", "code-server --bind-addr 127.0.0.1:8080"])
        proc = subprocess.Popen(
            ["npx", "--yes", f"code-server@{code_server_version}",
             "--bind-addr", "127.0.0.1:8080", "--auth", "none", "--disable-telemetry"],
            stdout=open("/tmp/npx-code-server.log", "w"),
            stderr=subprocess.STDOUT,
        )
        log(f"Started code-server via npx (pid {proc.pid})")
        Path("/tmp/host-code-server.pid").write_text(str(proc.pid))
        return proc.pid

    # Try Docker
    if shutil.which("docker"):
        run_cmd(["docker", "rm", "-f", "vibecode-kiosk-code-server"])
        result = run_cmd([
            "docker", "run", "-d",
            "--name", "vibecode-kiosk-code-server",
            "-p", "127.0.0.1:8080:8080",
            "codercom/code-server:latest",
            "--auth", "none", "--disable-telemetry",
        ])
        if result.returncode == 0:
            log("Started code-server via Docker (vibecode-kiosk-code-server)")
            return 0

    log("error: host code-server binary not found and Docker unavailable")
    return None


def start_lima_vm(repo_root: Path, lima_launcher_bin: str | None, instance_name: str) -> bool:
    """Start Lima VM."""
    if lima_launcher_bin and Path(lima_launcher_bin).is_file():
        result = run_cmd([
            lima_launcher_bin, "start",
            "--name", instance_name,
            "--config", str(repo_root / "vm-assets" / "ide-lima.yaml"),
        ])
        return result.returncode == 0
    else:
        result = run_cmd(["npm", "run", "--silent", "lima:start"], cwd=str(repo_root))
        return result.returncode == 0


def launch_chrome(
    chrome_app: str,
    url: str,
    user_data_dir: str,
) -> None:
    """Launch Chrome in kiosk mode."""
    subprocess.Popen([
        "open", "-a", chrome_app, "--args",
        "--kiosk",
        f"--app={url}",
        "--disable-translate",
        "--no-first-run",
        f"--user-data-dir={user_data_dir}",
    ])


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--url",
        default=os.environ.get("CODE_SERVER_URL", "http://127.0.0.1:8080"),
        help="code-server URL",
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
        "--wait-seconds",
        type=int,
        default=int(os.environ.get("CHROMIUM_IDE_WAIT", "60")),
        help="Wait timeout for code-server",
    )
    parser.add_argument(
        "--code-server-version",
        default=os.environ.get("CODE_SERVER_VERSION", "4.105.1"),
        help="code-server version for fallback install",
    )
    parser.add_argument(
        "--lima-disabled",
        action="store_true",
        default=os.environ.get("LIMA_DISABLED", "0") == "1",
        help="Disable Lima VM, use host mode only",
    )
    parser.add_argument(
        "--lima-instance-name",
        default=os.environ.get("LIMA_INSTANCE_NAME", "ide-lima"),
        help="Lima instance name",
    )

    args = parser.parse_args(argv)

    script_dir = Path(__file__).parent.resolve()
    repo_root = script_dir.parent.parent

    profile_dir = args.profile_dir or str(repo_root / ".chrome-code-server")
    health_url = f"{args.url}/healthz"

    lima_launcher_bin = os.environ.get("LIMA_LAUNCHER_BIN")

    # Check Chrome exists
    if not Path(args.chrome_app).exists():
        log(f"error: Chromium/Chrome app not found at {args.chrome_app}")
        log("Set CHROMIUM_APP_PATH to your browser app (e.g., /Applications/Chromium.app)")
        return 1

    # Check Lima if not disabled
    if not args.lima_disabled and not shutil.which("limactl"):
        log("error: limactl not found. Install Lima via 'brew install lima' or set LIMA_DISABLED=1 to run host mode.")
        return 1

    ready_source = "lima"

    if not args.lima_disabled:
        log(f"Starting Lima VM via {lima_launcher_bin or 'npm run lima:start'}")
        if not start_lima_vm(repo_root, lima_launcher_bin, args.lima_instance_name):
            log("Failed to start Lima VM")
            return 1

        # Install and start code-server in Lima
        log("Ensuring code-server is installed and running inside ide-lima")
        install_script = f'''
            set -e
            VERSION="{args.code_server_version}"
            if ! command -v code-server >/dev/null 2>&1; then
                echo "[ide-lima] Installing code-server v$VERSION"
                apk add --no-cache curl tar
                TMP=$(mktemp -d)
                cd "$TMP"
                curl -fsSLo code-server.tgz "https://github.com/coder/code-server/releases/download/v$VERSION/code-server-$VERSION-linux-amd64.tar.gz"
                tar -xzf code-server.tgz
                install -m 0755 "code-server-$VERSION-linux-amd64/bin/code-server" /usr/local/bin/code-server
                rm -rf "$TMP"
            fi
            pkill code-server >/dev/null 2>&1 || true
            nohup code-server --bind-addr 0.0.0.0:8080 --auth none --disable-telemetry >/tmp/code-server.log 2>&1 &
        '''
        run_cmd([
            "limactl", "shell", args.lima_instance_name, "--",
            "sudo", "ash", "-c", install_script,
        ])
    else:
        log("LIMA_DISABLED=1; using host-only mode")

    # Wait for code-server
    log(f"Waiting for code-server at {health_url} (timeout {args.wait_seconds}s)")
    deadline = time.time() + args.wait_seconds

    while not is_url_healthy(health_url):
        if time.time() >= deadline:
            log(f"code-server did not start within {args.wait_seconds}s; attempting host fallback")
            if start_host_codeserver(args.code_server_version) is not None:
                ready_source = "host"
                deadline = time.time() + args.wait_seconds
                continue
            log("error: code-server failed to start")
            return 1
        time.sleep(1)
        print(".", end="", flush=True)

    print()
    log(f"code-server ready ({ready_source})")

    # Launch Chrome
    log("Launching Chromium kiosk")
    launch_chrome(args.chrome_app, args.url, profile_dir)

    log("Tip: close the browser window when finished, then run npm run lima:stop")
    return 0


if __name__ == "__main__":
    sys.exit(main())