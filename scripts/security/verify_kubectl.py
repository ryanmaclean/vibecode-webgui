#!/usr/bin/env python3


"""Verify kubectl binaries via the shared verification helper."""
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

DEFAULT_VERSION = os.getenv("KUBECTL_VERSION", "v1.31.0")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify kubectl binary integrity")
    parser.add_argument("output", nargs="?", help="Destination for kubectl")
    parser.add_argument("--version", default=DEFAULT_VERSION, help="kubectl version to download")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    version = args.version
    output_path = args.output or os.environ.get("OUTPUT_PATH")
    if output_path:
        os.environ["OUTPUT_PATH"] = output_path
        log_info(f"Using OUTPUT_PATH: {output_path}")
    log_info(f"Starting kubectl verification for version {version}")

    binary_url = f"https://dl.k8s.io/release/{version}/bin/linux/amd64/kubectl"
    checksum_url = f"{binary_url}.sha256"
    signature_url = f"{binary_url}.sig"
    identity = "krel-trusted-builder@k8s-releng-prod.iam.gserviceaccount.com"
    issuer = "https://accounts.google.com"

    try:
        verify_binary_download(
            name="kubectl",
            binary_url=binary_url,
            checksum_type="sha256",
            checksum_url=checksum_url,
            signature_type="cosign",
            signature_url=signature_url,
            cert_identity=identity,
            cert_oidc_issuer=issuer,
            output_path=output_path,
        )
        log_info(f"kubectl {version} verification succeeded")
        return 0
    except (VerificationError, DependencyError, RuntimeError) as exc:
        log_error(f"kubectl {version} verification failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())