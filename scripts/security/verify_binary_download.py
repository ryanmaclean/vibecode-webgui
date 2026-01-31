#!/usr/bin/env python3

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

"""Secure binary download helper with checksum and signature verification."""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"


class VerificationError(RuntimeError):
    """Raised when a verification step fails."""


class DependencyError(RuntimeError):
    """Raised when a required tool is missing."""


def log_info(message: str) -> None:
    print(f"{GREEN}[INFO]{NC} {message}")


def log_warn(message: str) -> None:
    print(f"{YELLOW}[WARN]{NC} {message}")


def log_error(message: str) -> None:
    print(f"{RED}[ERROR]{NC} {message}")


def ensure_command(name: str) -> None:
    if shutil.which(name) is None:
        raise DependencyError(f"Required command '{name}' not found in PATH")


def download_file(url: str, destination: Path, retries: int = 3, delay: float = 2.0) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    attempt = 0
    while attempt < retries:
        try:
            request = Request(url, headers={"User-Agent": "vibecode-security-verifier/1.0"})
            with urlopen(request, timeout=30) as response, destination.open("wb") as handle:
                shutil.copyfileobj(response, handle)
            log_info(f"Downloaded: {destination}")
            return destination
        except URLError as exc:
            attempt += 1
            if attempt >= retries:
                raise VerificationError(f"Failed to download {url}: {exc}") from exc
            log_warn(f"Download failed ({exc}), retry {attempt}/{retries}")
            time.sleep(delay)
    return destination


def read_checksum(checksum_file: Path) -> str:
    if not checksum_file.exists():
        raise VerificationError(f"Checksum file not found: {checksum_file}")
    lines = [line for line in checksum_file.read_text().splitlines() if line.strip()]
    if not lines:
        raise VerificationError(f"Checksum file {checksum_file} is empty")
    first_line = lines[0]
    return first_line.split()[0]


def calculate_sha256(binary_path: Path) -> str:
    hasher = hashlib.sha256()
    with binary_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def verify_sha256(binary_path: Path, checksum_file: Path) -> None:
    log_info(f"Verifying SHA256 checksum for {binary_path.name}")
    expected = read_checksum(checksum_file)
    actual = calculate_sha256(binary_path)
    if expected != actual:
        raise VerificationError(
            "SHA256 checksum mismatch\n"
            f"Expected: {expected}\n"
            f"Actual:   {actual}"
        )
    log_info("\u2713 SHA256 checksum verified")


def verify_cosign(binary_path: Path, signature_file: Path, cert_identity: str, cert_oidc_issuer: str) -> None:
    ensure_command("cosign")
    if not signature_file.exists():
        raise VerificationError(f"Signature file not found: {signature_file}")

    log_info(f"Verifying cosign signature for {binary_path.name}")
    command = [
        "cosign",
        "verify-blob",
        "--signature",
        str(signature_file),
        "--certificate-identity",
        cert_identity,
        "--certificate-oidc-issuer",
        cert_oidc_issuer,
        str(binary_path),
    ]
    subprocess.run(command, check=True, capture_output=True)
    log_info("\u2713 Cosign signature verified")


def verify_gpg(binary_path: Path, signature_file: Path, keyring: str) -> None:
    ensure_command("gpg")
    if not signature_file.exists():
        raise VerificationError(f"Signature file not found: {signature_file}")
    if not Path(keyring).exists():
        raise VerificationError(f"Keyring file not found: {keyring}")

    log_info(f"Verifying GPG signature for {binary_path.name}")
    command = [
        "gpg",
        "--no-default-keyring",
        "--keyring",
        keyring,
        "--verify",
        str(signature_file),
        str(binary_path),
    ]
    subprocess.run(command, check=True, capture_output=True)
    log_info("\u2713 GPG signature verified")


def verify_binary_download(
    name: str,
    binary_url: str,
    checksum_type: str,
    checksum_url: str,
    signature_type: Optional[str] = None,
    signature_url: Optional[str] = None,
    cert_identity: Optional[str] = None,
    cert_oidc_issuer: Optional[str] = None,
    output_path: Optional[str] = None,
) -> Optional[Path]:
    log_info("=========================================")
    log_info(f"Verifying binary: {name}")
    log_info("=========================================")

    copied_path: Optional[Path] = None
    with tempfile.TemporaryDirectory() as tmp:
        temp_dir = Path(tmp)
        binary_path = temp_dir / name
        checksum_path = temp_dir / f"{name}.checksum"

        download_file(binary_url, binary_path)

        if checksum_type.lower() == "sha256":
            download_file(checksum_url, checksum_path)
            verify_sha256(binary_path, checksum_path)
        else:
            log_warn(f"Unknown checksum type '{checksum_type}', skipping validation")

        if signature_type and signature_url:
            signature_path = temp_dir / f"{name}.sig"
            try:
                download_file(signature_url, signature_path)
            except VerificationError as exc:
                log_warn(f"Signature download failed ({exc}), skipping signature verification")
            else:
                if signature_type == "cosign":
                    if not cert_identity or not cert_oidc_issuer:
                        raise VerificationError("Cosign verification requires certificate identity and issuer")
                    verify_cosign(binary_path, signature_path, cert_identity, cert_oidc_issuer)
                elif signature_type == "gpg":
                    if not cert_identity:
                        raise VerificationError("GPG verification requires keyring path as cert_identity")
                    verify_gpg(binary_path, signature_path, cert_identity)
                else:
                    log_warn(f"Unknown signature type '{signature_type}', skipping verification")

        final_output = output_path or os.environ.get("OUTPUT_PATH")
        if final_output:
            final_path = Path(final_output)
            final_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(binary_path, final_path)
            final_path.chmod(final_path.stat().st_mode | 0o111)
            log_info(f"Verified binary copied to: {final_path}")
            copied_path = final_path

    log_info("=========================================")
    log_info(f"\u2713 All verifications passed for {name}")
    log_info("=========================================")
    return copied_path


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify binary downloads with checksum and signature support")
    parser.add_argument("name", help="Name of the binary (used for temp files)")
    parser.add_argument("binary_url", help="URL to download the binary")
    parser.add_argument("checksum_type", help="Checksum type (sha256)")
    parser.add_argument("checksum_url", help="URL to download the checksum file")
    parser.add_argument("signature_type", nargs="?", help="Signature type (cosign or gpg)")
    parser.add_argument("signature_url", nargs="?", help="URL to download the signature file")
    parser.add_argument("cert_identity", nargs="?", help="Certificate identity or keyring path")
    parser.add_argument("cert_oidc_issuer", nargs="?", help="OIDC issuer for cosign")
    parser.add_argument("--output", dest="output", help="Optional path to copy the verified binary")
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    try:
        verify_binary_download(
            name=args.name,
            binary_url=args.binary_url,
            checksum_type=args.checksum_type,
            checksum_url=args.checksum_url,
            signature_type=args.signature_type,
            signature_url=args.signature_url,
            cert_identity=args.cert_identity,
            cert_oidc_issuer=args.cert_oidc_issuer,
            output_path=args.output,
        )
        return 0
    except (VerificationError, DependencyError, subprocess.CalledProcessError) as exc:
        log_error(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())