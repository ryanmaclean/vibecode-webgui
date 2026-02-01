"""Tests for scripts/security/verify_kubectl.py"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "security"))

from verify_kubectl import (
    DEFAULT_VERSION,
    main,
    parse_args,
)


class TestDefaultVersion:
    """Tests for default version constant."""

    def test_has_default_version(self) -> None:
        """Should have a default kubectl version."""
        assert DEFAULT_VERSION is not None
        assert DEFAULT_VERSION.startswith("v")


class TestParseArgs:
    """Tests for parse_args function."""

    def test_no_arguments(self) -> None:
        """Should parse with no arguments."""
        args = parse_args([])
        assert args.output is None
        assert args.version == DEFAULT_VERSION

    def test_output_path(self) -> None:
        """Should parse output path."""
        args = parse_args(["/tmp/kubectl"])
        assert args.output == "/tmp/kubectl"

    def test_version_flag(self) -> None:
        """Should parse version flag."""
        args = parse_args(["--version", "v1.30.0"])
        assert args.version == "v1.30.0"

    def test_output_with_version(self) -> None:
        """Should parse output and version together."""
        args = parse_args(["/tmp/kubectl", "--version", "v1.29.0"])
        assert args.output == "/tmp/kubectl"
        assert args.version == "v1.29.0"


class TestMain:
    """Tests for main function."""

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_successful_verification(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should return 0 on successful verification."""
        mock_verify.return_value = None

        result = main([])

        assert result == 0
        mock_verify.assert_called_once()

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_constructs_correct_urls(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should construct correct download URLs."""
        mock_verify.return_value = None

        main(["--version", "v1.31.0"])

        call_kwargs = mock_verify.call_args.kwargs
        assert call_kwargs["name"] == "kubectl"
        assert "v1.31.0" in call_kwargs["binary_url"]
        assert call_kwargs["binary_url"].endswith("/kubectl")
        assert call_kwargs["checksum_url"].endswith(".sha256")
        assert call_kwargs["signature_url"].endswith(".sig")

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_uses_cosign_signature_type(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should use cosign for signature verification."""
        mock_verify.return_value = None

        main([])

        call_kwargs = mock_verify.call_args.kwargs
        assert call_kwargs["checksum_type"] == "sha256"
        assert call_kwargs["signature_type"] == "cosign"

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_sets_certificate_identity(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should set certificate identity and issuer."""
        mock_verify.return_value = None

        main([])

        call_kwargs = mock_verify.call_args.kwargs
        assert "k8s-releng-prod" in call_kwargs["cert_identity"]
        assert call_kwargs["cert_oidc_issuer"] == "https://accounts.google.com"

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_passes_output_path(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should pass output path to verify function."""
        mock_verify.return_value = None

        main(["/tmp/kubectl"])

        call_kwargs = mock_verify.call_args.kwargs
        assert call_kwargs["output_path"] == "/tmp/kubectl"

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_error")
    def test_handles_verification_error(
        self, mock_log_error: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should return 1 on verification error."""
        from verify_binary_download import VerificationError

        mock_verify.side_effect = VerificationError("Checksum mismatch")

        result = main([])

        assert result == 1
        mock_log_error.assert_called()

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_error")
    def test_handles_dependency_error(
        self, mock_log_error: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should return 1 on dependency error."""
        from verify_binary_download import DependencyError

        mock_verify.side_effect = DependencyError("cosign not found")

        result = main([])

        assert result == 1
        mock_log_error.assert_called()

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_error")
    def test_handles_runtime_error(
        self, mock_log_error: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should return 1 on runtime error."""
        mock_verify.side_effect = RuntimeError("Network error")

        result = main([])

        assert result == 1
        mock_log_error.assert_called()

    @patch.dict("os.environ", {"OUTPUT_PATH": "/env/kubectl"}, clear=False)
    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_uses_env_output_path(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should use OUTPUT_PATH env var when no arg provided."""
        mock_verify.return_value = None

        main([])

        call_kwargs = mock_verify.call_args.kwargs
        assert call_kwargs["output_path"] is None or call_kwargs["output_path"] == "/env/kubectl"

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_logs_version_info(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should log version information."""
        mock_verify.return_value = None

        main(["--version", "v1.31.0"])

        log_calls = [str(call) for call in mock_log.call_args_list]
        assert any("v1.31.0" in call for call in log_calls)


class TestUrlConstruction:
    """Tests for URL construction."""

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_binary_url_format(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should construct correct binary URL."""
        mock_verify.return_value = None

        main(["--version", "v1.30.0"])

        call_kwargs = mock_verify.call_args.kwargs
        expected = "https://dl.k8s.io/release/v1.30.0/bin/linux/amd64/kubectl"
        assert call_kwargs["binary_url"] == expected

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_checksum_url_format(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should construct correct checksum URL."""
        mock_verify.return_value = None

        main(["--version", "v1.30.0"])

        call_kwargs = mock_verify.call_args.kwargs
        expected = "https://dl.k8s.io/release/v1.30.0/bin/linux/amd64/kubectl.sha256"
        assert call_kwargs["checksum_url"] == expected

    @patch("verify_kubectl.verify_binary_download")
    @patch("verify_kubectl.log_info")
    def test_signature_url_format(
        self, mock_log: MagicMock, mock_verify: MagicMock
    ) -> None:
        """Should construct correct signature URL."""
        mock_verify.return_value = None

        main(["--version", "v1.30.0"])

        call_kwargs = mock_verify.call_args.kwargs
        expected = "https://dl.k8s.io/release/v1.30.0/bin/linux/amd64/kubectl.sig"
        assert call_kwargs["signature_url"] == expected
