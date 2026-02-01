"""Tests for scripts/ci/package_microvm.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "ci"))

from package_microvm import (
    ArchConfig,
    PackageConfig,
    log,
    measure_arch,
    package_dir,
    package_microvm,
)


class TestArchConfig:
    """Tests for ArchConfig dataclass."""

    def test_creates_config(self) -> None:
        """Should create arch config."""
        config = ArchConfig(name="x86_64", directory="fast-openvscode-vm", port=3600)
        assert config.name == "x86_64"
        assert config.directory == "fast-openvscode-vm"
        assert config.port == 3600


class TestPackageConfig:
    """Tests for PackageConfig dataclass."""

    def test_default_values(self) -> None:
        """Should create config with default values."""
        config = PackageConfig()
        assert config.iterations == 3
        assert config.arches == ["x86_64", "arm64"]
        assert config.output_root == Path("reports/benchmarks")
        assert config.skip_measure is False

    def test_timestamp_format(self) -> None:
        """Should generate valid timestamp."""
        config = PackageConfig()
        ts = config.timestamp
        assert len(ts) == 16
        assert ts.endswith("Z")

    def test_get_arch_config_x86(self) -> None:
        """Should return x86_64 config."""
        config = PackageConfig()
        arch_config = config.get_arch_config("x86_64")

        assert arch_config is not None
        assert arch_config.name == "x86_64"
        assert arch_config.directory == "fast-openvscode-vm"
        assert arch_config.port == 3600

    def test_get_arch_config_arm64(self) -> None:
        """Should return arm64 config."""
        config = PackageConfig()
        arch_config = config.get_arch_config("arm64")

        assert arch_config is not None
        assert arch_config.name == "arm64"
        assert arch_config.directory == "fast-openvscode-vm-arm64"
        assert arch_config.port == 4600

    def test_get_arch_config_unknown(self) -> None:
        """Should return None for unknown arch."""
        config = PackageConfig()
        arch_config = config.get_arch_config("unknown")

        assert arch_config is None

    @patch.dict("os.environ", {
        "MICROVM_CI_ARCHES": "x86_64",
        "MICROVM_CI_OUTPUT": "/tmp/output",
        "MICROVM_SKIP_MEASURE": "1",
        "MICROVM_DIR_X86": "custom-x86",
        "MICROVM_DIR_ARM64": "custom-arm64",
    }, clear=True)
    def test_from_env(self) -> None:
        """Should create config from environment variables."""
        config = PackageConfig.from_env(iterations=5)

        assert config.iterations == 5
        assert config.arches == ["x86_64"]
        assert config.output_root == Path("/tmp/output")
        assert config.skip_measure is True
        assert config.x86_dir == "custom-x86"
        assert config.arm64_dir == "custom-arm64"

    @patch.dict("os.environ", {}, clear=True)
    def test_from_env_defaults(self) -> None:
        """Should use defaults when env vars not set."""
        config = PackageConfig.from_env()

        assert config.iterations == 3
        assert config.arches == ["x86_64", "arm64"]
        assert config.skip_measure is False


class TestLog:
    """Tests for log function."""

    def test_prints_with_prefix(self, capsys: pytest.CaptureFixture) -> None:
        """Should print with prefix."""
        log("Test message")
        captured = capsys.readouterr()
        assert "[microvm-ci]" in captured.out
        assert "Test message" in captured.out


class TestMeasureArch:
    """Tests for measure_arch function."""

    def test_skips_when_flag_set(self, tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
        """Should skip when skip flag is True."""
        outfile = tmp_path / "output.json"

        result = measure_arch("x86_64", outfile, 3, tmp_path, skip=True)

        assert result is True
        captured = capsys.readouterr()
        assert "Skipping benchmark" in captured.out

    def test_writes_empty_json_when_script_missing(self, tmp_path: Path) -> None:
        """Should write empty JSON when script not found."""
        outfile = tmp_path / "output.json"
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        result = measure_arch("x86_64", outfile, 3, scripts_dir, skip=False)

        assert result is True
        assert outfile.exists()
        assert outfile.read_text() == "{}\n"

    @patch("package_microvm.subprocess.run")
    def test_runs_benchmark_script(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should run benchmark script."""
        outfile = tmp_path / "output.json"
        scripts_dir = tmp_path / "scripts"
        benchmark_dir = scripts_dir / "benchmarks"
        benchmark_dir.mkdir(parents=True)
        (benchmark_dir / "vscode_microvm.sh").write_text("#!/bin/bash")

        mock_run.return_value = MagicMock(returncode=0, stdout='{"result": "ok"}')

        result = measure_arch("x86_64", outfile, 3, scripts_dir, skip=False)

        assert result is True
        mock_run.assert_called_once()
        assert outfile.read_text() == '{"result": "ok"}'

    @patch("package_microvm.subprocess.run")
    def test_handles_benchmark_failure(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should handle benchmark failure gracefully."""
        outfile = tmp_path / "output.json"
        scripts_dir = tmp_path / "scripts"
        benchmark_dir = scripts_dir / "benchmarks"
        benchmark_dir.mkdir(parents=True)
        (benchmark_dir / "vscode_microvm.sh").write_text("#!/bin/bash")

        mock_run.return_value = MagicMock(returncode=1)

        result = measure_arch("x86_64", outfile, 3, scripts_dir, skip=False)

        assert result is True
        assert outfile.read_text() == "{}\n"

    @patch("package_microvm.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should handle timeout gracefully."""
        outfile = tmp_path / "output.json"
        scripts_dir = tmp_path / "scripts"
        benchmark_dir = scripts_dir / "benchmarks"
        benchmark_dir.mkdir(parents=True)
        (benchmark_dir / "vscode_microvm.sh").write_text("#!/bin/bash")

        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=600)

        result = measure_arch("x86_64", outfile, 3, scripts_dir, skip=False)

        assert result is True
        assert outfile.read_text() == "{}\n"


class TestPackageDir:
    """Tests for package_dir function."""

    @patch("package_microvm.subprocess.run")
    def test_runs_package_script(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should run package script."""
        scripts_dir = tmp_path / "scripts"
        release_dir = scripts_dir / "release"
        release_dir.mkdir(parents=True)
        (release_dir / "package-fast-openvscode-vm.sh").write_text("#!/bin/bash")

        mock_run.return_value = MagicMock(returncode=0)

        result = package_dir("fast-openvscode-vm", scripts_dir)

        assert result is True
        mock_run.assert_called_once()

    @patch("package_microvm.subprocess.run")
    def test_falls_back_to_python_script(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should fall back to Python script."""
        scripts_dir = tmp_path / "scripts"
        release_dir = scripts_dir / "release"
        release_dir.mkdir(parents=True)
        (release_dir / "package_fast_openvscode_vm.py").write_text("#!/usr/bin/env python3")

        mock_run.return_value = MagicMock(returncode=0)

        result = package_dir("fast-openvscode-vm", scripts_dir)

        assert result is True

    def test_returns_false_when_script_missing(self, tmp_path: Path) -> None:
        """Should return False when script not found."""
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()

        result = package_dir("fast-openvscode-vm", scripts_dir)

        assert result is False

    @patch("package_microvm.subprocess.run")
    def test_returns_false_on_failure(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False on script failure."""
        scripts_dir = tmp_path / "scripts"
        release_dir = scripts_dir / "release"
        release_dir.mkdir(parents=True)
        (release_dir / "package-fast-openvscode-vm.sh").write_text("#!/bin/bash")

        mock_run.return_value = MagicMock(returncode=1)

        result = package_dir("fast-openvscode-vm", scripts_dir)

        assert result is False

    @patch("package_microvm.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should handle timeout."""
        scripts_dir = tmp_path / "scripts"
        release_dir = scripts_dir / "release"
        release_dir.mkdir(parents=True)
        (release_dir / "package-fast-openvscode-vm.sh").write_text("#!/bin/bash")

        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=300)

        result = package_dir("fast-openvscode-vm", scripts_dir)

        assert result is False


class TestPackageMicrovm:
    """Tests for package_microvm function."""

    @patch("package_microvm.package_dir")
    @patch("package_microvm.measure_arch")
    def test_processes_all_arches(
        self, mock_measure: MagicMock, mock_package: MagicMock, tmp_path: Path
    ) -> None:
        """Should process all architectures."""
        # Create directories
        x86_dir = tmp_path / "fast-openvscode-vm"
        arm64_dir = tmp_path / "fast-openvscode-vm-arm64"
        x86_dir.mkdir()
        arm64_dir.mkdir()

        mock_measure.return_value = True
        mock_package.return_value = True

        config = PackageConfig(
            arches=["x86_64", "arm64"],
            output_root=tmp_path / "output",
            scripts_dir=tmp_path / "scripts",
            x86_dir=str(x86_dir),
            arm64_dir=str(arm64_dir),
        )

        result = package_microvm(config)

        assert result == 0
        assert mock_measure.call_count == 2
        assert mock_package.call_count == 2

    @patch("package_microvm.package_dir")
    @patch("package_microvm.measure_arch")
    def test_skips_unknown_arch(
        self, mock_measure: MagicMock, mock_package: MagicMock, tmp_path: Path
    ) -> None:
        """Should skip unknown architecture."""
        config = PackageConfig(
            arches=["unknown"],
            output_root=tmp_path / "output",
            scripts_dir=tmp_path / "scripts",
        )

        result = package_microvm(config)

        assert result == 1
        mock_measure.assert_not_called()

    @patch("package_microvm.package_dir")
    @patch("package_microvm.measure_arch")
    def test_skips_missing_directory(
        self, mock_measure: MagicMock, mock_package: MagicMock, tmp_path: Path
    ) -> None:
        """Should skip when directory not found."""
        config = PackageConfig(
            arches=["x86_64"],
            output_root=tmp_path / "output",
            scripts_dir=tmp_path / "scripts",
        )

        result = package_microvm(config)

        assert result == 1
        mock_measure.assert_not_called()

    @patch("package_microvm.package_dir")
    @patch("package_microvm.measure_arch")
    def test_creates_output_directory(
        self, mock_measure: MagicMock, mock_package: MagicMock, tmp_path: Path
    ) -> None:
        """Should create output directory."""
        (tmp_path / "fast-openvscode-vm").mkdir()
        mock_measure.return_value = True
        mock_package.return_value = True

        output_dir = tmp_path / "new" / "output" / "dir"
        config = PackageConfig(
            arches=["x86_64"],
            output_root=output_dir,
            scripts_dir=tmp_path / "scripts",
        )

        package_microvm(config)

        assert output_dir.exists()

    @patch("package_microvm.package_dir")
    @patch("package_microvm.measure_arch")
    def test_uses_skip_measure_flag(
        self, mock_measure: MagicMock, mock_package: MagicMock, tmp_path: Path
    ) -> None:
        """Should pass skip_measure flag."""
        x86_dir = tmp_path / "fast-openvscode-vm"
        x86_dir.mkdir()
        mock_measure.return_value = True
        mock_package.return_value = True

        config = PackageConfig(
            arches=["x86_64"],
            output_root=tmp_path / "output",
            scripts_dir=tmp_path / "scripts",
            x86_dir=str(x86_dir),
            skip_measure=True,
        )

        package_microvm(config)

        mock_measure.assert_called_once()
        call_args = mock_measure.call_args
        # skip is passed as 5th positional argument (index 4)
        assert call_args.args[4] is True

    def test_uses_default_config_when_none(self) -> None:
        """Should use default config when None."""
        with patch("package_microvm.PackageConfig.from_env") as mock_from_env:
            mock_config = MagicMock()
            mock_config.output_root = Path("/tmp/test")
            mock_config.arches = []
            mock_from_env.return_value = mock_config

            package_microvm(None)

            mock_from_env.assert_called_once()


class TestEnvConfig:
    """Tests for environment variable handling."""

    @patch.dict("os.environ", {"MICROVM_CI_ARCHES": "x86_64,arm64,riscv"}, clear=True)
    def test_parses_multiple_arches(self) -> None:
        """Should parse multiple arches from env."""
        config = PackageConfig.from_env()
        assert config.arches == ["x86_64", "arm64", "riscv"]

    @patch.dict("os.environ", {"MICROVM_CI_ARCHES": " x86_64 , arm64 "}, clear=True)
    def test_strips_whitespace(self) -> None:
        """Should strip whitespace from arches."""
        config = PackageConfig.from_env()
        assert config.arches == ["x86_64", "arm64"]
