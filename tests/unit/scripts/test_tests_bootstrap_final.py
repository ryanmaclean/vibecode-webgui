"""Tests for scripts/tests/bootstrap/test_bootstrap_final.py"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "tests" / "bootstrap"))

from test_bootstrap_final import (
    BootstrapConfig,
    CheckResult,
    count_functions,
    get_line_count,
    print_header,
    print_result,
    relative_path,
    run_tests,
)


class TestBootstrapConfig:
    """Tests for BootstrapConfig dataclass."""

    def test_default_script_dir(self) -> None:
        """Should set default script directory."""
        config = BootstrapConfig()
        assert config.script_dir is not None

    def test_repo_root(self) -> None:
        """Should compute repo root correctly."""
        config = BootstrapConfig()
        # repo_root should be 3 levels up from script_dir
        assert config.repo_root == config.script_dir.parent.parent.parent

    def test_scripts_dir(self) -> None:
        """Should compute scripts directory."""
        config = BootstrapConfig()
        assert config.scripts_dir == config.repo_root / "scripts"

    def test_all_scripts(self) -> None:
        """Should return list of all bootstrap scripts."""
        config = BootstrapConfig()
        scripts = config.all_scripts
        assert len(scripts) == 4
        assert all(str(s).endswith(".sh") for s in scripts)

    def test_config_files(self) -> None:
        """Should return list of config files."""
        config = BootstrapConfig()
        configs = config.config_files
        assert len(configs) >= 4

    def test_required_deps(self) -> None:
        """Should return list of required dependencies."""
        config = BootstrapConfig()
        deps = config.required_deps
        assert "az" in deps
        assert "kubectl" in deps
        assert "helm" in deps
        assert "docker" in deps
        assert "openssl" in deps

    def test_custom_script_dir(self, tmp_path: Path) -> None:
        """Should accept custom script directory."""
        config = BootstrapConfig(script_dir=tmp_path)
        assert config.script_dir == tmp_path


class TestCheckResult:
    """Tests for CheckResult dataclass."""

    def test_creates_result(self) -> None:
        """Should create check result."""
        result = CheckResult(name="test", passed=True)
        assert result.name == "test"
        assert result.passed is True
        assert result.message == ""
        assert result.warning is False

    def test_with_message(self) -> None:
        """Should store message."""
        result = CheckResult(name="test", passed=False, message="error")
        assert result.message == "error"

    def test_with_warning(self) -> None:
        """Should store warning flag."""
        result = CheckResult(name="test", passed=False, warning=True)
        assert result.warning is True


class TestPrintFunctions:
    """Tests for print functions."""

    def test_print_header(self, capsys: pytest.CaptureFixture) -> None:
        """Should print header."""
        print_header("Test Header")
        captured = capsys.readouterr()
        assert "Test Header" in captured.out

    def test_print_result_passed(self, capsys: pytest.CaptureFixture) -> None:
        """Should print passed result."""
        print_result(True, "Test passed")
        captured = capsys.readouterr()
        assert "[OK]" in captured.out
        assert "Test passed" in captured.out

    def test_print_result_failed(self, capsys: pytest.CaptureFixture) -> None:
        """Should print failed result."""
        print_result(False, "Test failed")
        captured = capsys.readouterr()
        assert "[FAIL]" in captured.out
        assert "Test failed" in captured.out

    def test_print_result_warning(self, capsys: pytest.CaptureFixture) -> None:
        """Should print warning result."""
        print_result(False, "Test warning", warning=True)
        captured = capsys.readouterr()
        assert "[WARN]" in captured.out

    def test_print_result_with_indent(self, capsys: pytest.CaptureFixture) -> None:
        """Should print with custom indent."""
        print_result(True, "Indented", indent=6)
        captured = capsys.readouterr()
        assert captured.out.startswith("      ")


class TestRelativePath:
    """Tests for relative_path function."""

    def test_computes_relative_path(self, tmp_path: Path) -> None:
        """Should compute relative path."""
        child = tmp_path / "subdir" / "file.txt"
        result = relative_path(child, tmp_path)
        assert result == "subdir/file.txt"

    def test_handles_non_relative_path(self, tmp_path: Path) -> None:
        """Should handle non-relative path."""
        other = Path("/some/other/path")
        result = relative_path(other, tmp_path)
        assert result == "/some/other/path"

    def test_same_path(self, tmp_path: Path) -> None:
        """Should handle same path."""
        result = relative_path(tmp_path, tmp_path)
        assert result == "."


class TestCountFunctions:
    """Tests for count_functions function."""

    def test_counts_functions(self, tmp_path: Path) -> None:
        """Should count function definitions."""
        script = tmp_path / "test.sh"
        script.write_text("""#!/bin/bash
func1() {
    echo "test"
}

func2() {
    echo "test2"
}

another_func() {
    echo "test3"
}
""")
        count = count_functions(script)
        assert count == 3

    def test_handles_no_functions(self, tmp_path: Path) -> None:
        """Should handle scripts with no functions."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\necho hello\n")
        count = count_functions(script)
        assert count == 0

    def test_handles_missing_file(self, tmp_path: Path) -> None:
        """Should handle missing file."""
        count = count_functions(tmp_path / "nonexistent.sh")
        assert count == 0

    def test_handles_inline_function(self, tmp_path: Path) -> None:
        """Should count inline function definitions."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\nmy_func() { echo test; }\n")
        count = count_functions(script)
        assert count == 1

    def test_ignores_function_calls(self, tmp_path: Path) -> None:
        """Should not count function calls."""
        script = tmp_path / "test.sh"
        script.write_text("#!/bin/bash\nfunc()\nfunc arg1 arg2\n")
        count = count_functions(script)
        assert count == 0


class TestGetLineCount:
    """Tests for get_line_count function."""

    def test_counts_lines(self, tmp_path: Path) -> None:
        """Should count lines in file."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("line1\nline2\nline3\n")
        count = get_line_count(test_file)
        assert count == 3

    def test_handles_missing_file(self, tmp_path: Path) -> None:
        """Should handle missing file."""
        count = get_line_count(tmp_path / "nonexistent.txt")
        assert count == 0

    def test_handles_empty_file(self, tmp_path: Path) -> None:
        """Should handle empty file."""
        test_file = tmp_path / "empty.txt"
        test_file.write_text("")
        count = get_line_count(test_file)
        assert count == 0

    def test_handles_single_line(self, tmp_path: Path) -> None:
        """Should handle single line file."""
        test_file = tmp_path / "single.txt"
        test_file.write_text("only one line")
        count = get_line_count(test_file)
        assert count == 1


class TestRunTestsIntegration:
    """Integration tests for run_tests function."""

    @patch("test_bootstrap_final.test_helm_chart")
    @patch("test_bootstrap_final.test_configuration")
    @patch("test_bootstrap_final.test_script_interdependencies")
    @patch("test_bootstrap_final.test_kubernetes_connectivity")
    @patch("test_bootstrap_final.test_azure_connectivity")
    @patch("test_bootstrap_final.test_dependencies")
    @patch("test_bootstrap_final.test_environment_handling")
    @patch("test_bootstrap_final.test_function_structure")
    @patch("test_bootstrap_final.test_syntax_validation")
    @patch("test_bootstrap_final.test_script_availability")
    def test_returns_zero_on_success(
        self,
        mock_avail: MagicMock,
        mock_syntax: MagicMock,
        mock_func: MagicMock,
        mock_env: MagicMock,
        mock_deps: MagicMock,
        mock_azure: MagicMock,
        mock_k8s: MagicMock,
        mock_inter: MagicMock,
        mock_config: MagicMock,
        mock_helm: MagicMock,
    ) -> None:
        """Should return 0 when all tests pass."""
        mock_avail.return_value = [CheckResult(name="test", passed=True)]
        mock_syntax.return_value = [CheckResult(name="test", passed=True)]
        mock_func.return_value = [CheckResult(name="test", passed=True)]
        mock_env.return_value = [CheckResult(name="test", passed=True)]
        mock_deps.return_value = [CheckResult(name="test", passed=True)]
        mock_azure.return_value = CheckResult(name="azure", passed=True)
        mock_k8s.return_value = CheckResult(name="k8s", passed=True)
        mock_inter.return_value = [CheckResult(name="test", passed=True)]
        mock_config.return_value = [CheckResult(name="test", passed=True)]
        mock_helm.return_value = [CheckResult(name="test", passed=True)]

        result = run_tests()
        assert result == 0

    @patch("test_bootstrap_final.test_helm_chart")
    @patch("test_bootstrap_final.test_configuration")
    @patch("test_bootstrap_final.test_script_interdependencies")
    @patch("test_bootstrap_final.test_kubernetes_connectivity")
    @patch("test_bootstrap_final.test_azure_connectivity")
    @patch("test_bootstrap_final.test_dependencies")
    @patch("test_bootstrap_final.test_environment_handling")
    @patch("test_bootstrap_final.test_function_structure")
    @patch("test_bootstrap_final.test_syntax_validation")
    @patch("test_bootstrap_final.test_script_availability")
    def test_returns_one_on_failure(
        self,
        mock_avail: MagicMock,
        mock_syntax: MagicMock,
        mock_func: MagicMock,
        mock_env: MagicMock,
        mock_deps: MagicMock,
        mock_azure: MagicMock,
        mock_k8s: MagicMock,
        mock_inter: MagicMock,
        mock_config: MagicMock,
        mock_helm: MagicMock,
    ) -> None:
        """Should return 1 when a test fails."""
        mock_avail.return_value = [CheckResult(name="test", passed=False)]  # Hard failure
        mock_syntax.return_value = []
        mock_func.return_value = []
        mock_env.return_value = []
        mock_deps.return_value = []
        mock_azure.return_value = CheckResult(name="azure", passed=True)
        mock_k8s.return_value = CheckResult(name="k8s", passed=True)
        mock_inter.return_value = []
        mock_config.return_value = []
        mock_helm.return_value = []

        result = run_tests()
        assert result == 1

    @patch("test_bootstrap_final.test_helm_chart")
    @patch("test_bootstrap_final.test_configuration")
    @patch("test_bootstrap_final.test_script_interdependencies")
    @patch("test_bootstrap_final.test_kubernetes_connectivity")
    @patch("test_bootstrap_final.test_azure_connectivity")
    @patch("test_bootstrap_final.test_dependencies")
    @patch("test_bootstrap_final.test_environment_handling")
    @patch("test_bootstrap_final.test_function_structure")
    @patch("test_bootstrap_final.test_syntax_validation")
    @patch("test_bootstrap_final.test_script_availability")
    def test_ignores_warnings(
        self,
        mock_avail: MagicMock,
        mock_syntax: MagicMock,
        mock_func: MagicMock,
        mock_env: MagicMock,
        mock_deps: MagicMock,
        mock_azure: MagicMock,
        mock_k8s: MagicMock,
        mock_inter: MagicMock,
        mock_config: MagicMock,
        mock_helm: MagicMock,
    ) -> None:
        """Should ignore warning-only failures."""
        mock_avail.return_value = [CheckResult(name="test", passed=True)]
        mock_syntax.return_value = [CheckResult(name="test", passed=True)]
        mock_func.return_value = [CheckResult(name="test", passed=True)]
        mock_env.return_value = [CheckResult(name="test", passed=True)]
        mock_deps.return_value = [CheckResult(name="test", passed=False, warning=True)]
        mock_azure.return_value = CheckResult(name="azure", passed=False, warning=True)
        mock_k8s.return_value = CheckResult(name="k8s", passed=False, warning=True)
        mock_inter.return_value = [CheckResult(name="test", passed=True)]
        mock_config.return_value = [CheckResult(name="test", passed=True)]
        mock_helm.return_value = [CheckResult(name="test", passed=True)]

        result = run_tests()
        assert result == 0  # Warnings don't cause failure

    @patch("test_bootstrap_final.test_helm_chart")
    @patch("test_bootstrap_final.test_configuration")
    @patch("test_bootstrap_final.test_script_interdependencies")
    @patch("test_bootstrap_final.test_kubernetes_connectivity")
    @patch("test_bootstrap_final.test_azure_connectivity")
    @patch("test_bootstrap_final.test_dependencies")
    @patch("test_bootstrap_final.test_environment_handling")
    @patch("test_bootstrap_final.test_function_structure")
    @patch("test_bootstrap_final.test_syntax_validation")
    @patch("test_bootstrap_final.test_script_availability")
    def test_accepts_custom_config(
        self,
        mock_avail: MagicMock,
        mock_syntax: MagicMock,
        mock_func: MagicMock,
        mock_env: MagicMock,
        mock_deps: MagicMock,
        mock_azure: MagicMock,
        mock_k8s: MagicMock,
        mock_inter: MagicMock,
        mock_config: MagicMock,
        mock_helm: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should accept custom configuration."""
        mock_avail.return_value = []
        mock_syntax.return_value = []
        mock_func.return_value = []
        mock_env.return_value = []
        mock_deps.return_value = []
        mock_azure.return_value = CheckResult(name="azure", passed=True)
        mock_k8s.return_value = CheckResult(name="k8s", passed=True)
        mock_inter.return_value = []
        mock_config.return_value = []
        mock_helm.return_value = []

        config = BootstrapConfig(script_dir=tmp_path)
        result = run_tests(config)
        # No hard failures, should succeed
        assert result == 0
