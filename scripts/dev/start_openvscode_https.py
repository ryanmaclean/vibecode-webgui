#!/usr/bin/env python3
"""Start HTTPS proxy for OpenVSCode.

Generates TLS certificates and starts an HTTPS proxy to the OpenVSCode server.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
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


def generate_cert_mkcert(cert_file: Path, key_file: Path, listen_host: str) -> bool:
    """Generate certificates using mkcert."""
    if not shutil.which("mkcert"):
        return False

    if cert_file.exists() and key_file.exists():
        return True

    print("Generating certificates with mkcert")
    result = run_cmd([
        "mkcert",
        "-cert-file", str(cert_file),
        "-key-file", str(key_file),
        "localhost", "127.0.0.1", "::1", listen_host,
    ])
    return result.returncode == 0


def generate_cert_openssl(cert_file: Path, key_file: Path) -> bool:
    """Generate self-signed certificate using OpenSSL."""
    if not shutil.which("openssl"):
        print("error: neither mkcert nor openssl available to generate certificates")
        return False

    if cert_file.exists() and key_file.exists():
        return True

    print("Generating self-signed certificate with OpenSSL")
    result = run_cmd([
        "openssl", "req", "-x509", "-nodes", "-days", "365",
        "-newkey", "rsa:2048",
        "-keyout", str(key_file),
        "-out", str(cert_file),
        "-subj", "/CN=localhost",
    ])
    return result.returncode == 0


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--target-host",
        default=os.environ.get("TARGET_HOST", "127.0.0.1"),
        help="Target host (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--target-port",
        type=int,
        default=int(os.environ.get("TARGET_PORT", "3600")),
        help="Target port (default: 3600)",
    )
    parser.add_argument(
        "--listen-host",
        default=os.environ.get("LISTEN_HOST", "127.0.0.1"),
        help="Listen host (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--listen-port",
        type=int,
        default=int(os.environ.get("LISTEN_PORT", "3443")),
        help="Listen port (default: 3443)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output",
    )

    args = parser.parse_args(argv)

    script_dir = Path(__file__).parent.resolve()
    root_dir = script_dir.parent.parent

    cert_dir = root_dir / "fast-openvscode-vm" / "certs"
    cert_dir.mkdir(parents=True, exist_ok=True)

    cert_file = cert_dir / "openvscode-local.pem"
    key_file = cert_dir / "openvscode-local-key.pem"

    # Generate certificates
    if not generate_cert_mkcert(cert_file, key_file, args.listen_host):
        if not generate_cert_openssl(cert_file, key_file):
            return 1

    listen_url = f"https://{args.listen_host}:{args.listen_port}"
    target_url = f"http://{args.target_host}:{args.target_port}"

    print(f"Starting HTTPS proxy: {listen_url} -> {target_url}")

    # Start the proxy
    proxy_script = script_dir / "openvscode-https-proxy.js"
    if not proxy_script.exists():
        print(f"error: Proxy script not found: {proxy_script}")
        return 1

    cmd = [
        "node", str(proxy_script),
        "--cert", str(cert_file),
        "--key", str(key_file),
        "--listen", listen_url,
        "--target", target_url,
    ]
    if args.verbose:
        cmd.append("--verbose")

    result = run_cmd(cmd, capture=False)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
