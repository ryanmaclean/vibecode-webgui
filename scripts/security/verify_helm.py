#!/usr/bin/env python3
"""Verify Helm releases using the shared binary verification helper."""
from __future__ import annotations

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

DEFAULT_VERSION = os.getenv("HELM_VERSION", "v3.16.0")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify Helm binary integrity")
    parser.add_argument("output", nargs="?", help="Destination for the verified Helm archive")
    parser.add_argument("--version", default=DEFAULT_VERSION, help="Helm version to download")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    version = args.version
    output_path = args.output or os.environ.get("OUTPUT_PATH")
    if output_path:
        os.environ["OUTPUT_PATH"] = output_path
        log_info(f"Using OUTPUT_PATH: {output_path}")
    log_info(f"Starting Helm verification for version {version}")

    archive_name = f"helm-{version}-linux-amd64.tar.gz"
    binary_url = f"https://get.helm.sh/{archive_name}"
    checksum_url = f"{binary_url}.sha256sum"
    signature_url = f"{binary_url}.sig"
    identity = f"https://github.com/helm/helm/.github/workflows/release.yml@refs/tags/{version}"
    issuer = "https://token.actions.githubusercontent.com"
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
        log_info(f"Helm {version} verification succeeded")
        return 0
    except (VerificationError, DependencyError, RuntimeError) as exc:
        log_error(f"Helm {version} verification failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
