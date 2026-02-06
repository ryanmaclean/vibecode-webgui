from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "verify-helm"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "security"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation



"""Verify Helm releases using the shared binary verification helper."""

# Initialize log aggregation
log_agg = get_log_aggregation()

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