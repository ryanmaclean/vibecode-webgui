#!/usr/bin/env python3


"""Verify kubens archives via the shared verification helper."""
from __future__ import annotations
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
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from verify_binary_download import (  # type: ignore
    DependencyError,
    VerificationError,
    log_error,
    log_info,
    verify_binary_download,
)

DEFAULT_VERSION = os.getenv("KUBENS_VERSION", "v0.10.3")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify kubens archive integrity")
    parser.add_argument("output", nargs="?", help="Destination for kubens archive")
    parser.add_argument("--version", default=DEFAULT_VERSION, help="kubens version to download")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    version = args.version
    output_path = args.output or os.environ.get("OUTPUT_PATH")
    if output_path:
        os.environ["OUTPUT_PATH"] = output_path
        log_info(f"Using OUTPUT_PATH: {output_path}")
    log_info(f"Starting kubens verification for version {version}")

    archive_name = f"kubens_{version}_linux_x86_64.tar.gz"
    binary_url = f"https://github.com/ahmetb/kubectx/releases/download/{version}/{archive_name}"
    checksum_url = f"https://artifacts.vibecode.dev/kubens/{version}/{archive_name}.sha256"
    signature_url = f"https://artifacts.vibecode.dev/kubens/{version}/{archive_name}.sig"
    identity = "supply-chain@vibecode.dev"
    issuer = "https://accounts.google.com"

    try:
        verify_binary_download(
            name=archive_name,
            binary_url=binary_url,
            checksum_type="sha256",
            checksum_url=checksum_url,
            signature_type="cosign",
            signature_url=signature_url,
            cert_identity=identity,
            cert_oidc_issuer=issuer,
            output_path=output_path,
        )
        log_info(f"kubens {version} verification succeeded")
        return 0
    except (VerificationError, DependencyError, RuntimeError) as exc:
        log_error(f"kubens {version} verification failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())