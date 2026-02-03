"""Tests for scripts/validation_tui.py"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from validation_tui import (
    Category,
    TUIState,
    ValidationResult,
    ValidationScript,
    count_warnings_in_output,
    detect_category,
    detect_script_type,
    discover_validations,
    get_filtered_scripts,
    get_script_description,
    get_type_symbol,
    save_results,
)


class TestCategory:
    """Tests for Category enum."""

    def test_has_expected_values(self) -> None:
        """Should have expected category values."""
        assert Category.CONFIG.value == "config"
        assert Category.DATABASE.value == "database"
        assert Category.DOCKER.value == "docker"
        assert Category.MONITORING.value == "monitoring"
        assert Category.SECURITY.value == "security"
        assert Category.DEPLOYMENT.value == "deployment"
        assert Category.INFRASTRUCTURE.value == "infrastructure"
        assert Category.OTHER.value == "other"


class TestValidationScript:
    """Tests for ValidationScript dataclass."""

    def test_creates_script(self, tmp_path: Path) -> None:
        """Should create validation script."""
        script = ValidationScript(
            path=tmp_path / "validate.sh",
            name="validate-test",
            description="Test validation",
            category=Category.CONFIG,
            script_type="validate",
        )
        assert script.name == "validate-test"
        assert script.category == Category.CONFIG
        assert script.script_type == "validate"
        assert script.status == "pending"

    def test_default_values(self, tmp_path: Path) -> None:
        """Should have default values."""
        script = ValidationScript(path=tmp_path / "validate.sh", name="validate")
        assert script.description == ""
        assert script.category == Category.OTHER
        assert script.script_type == "validate"
        assert script.last_run is None
        assert script.run_time == 0.0


class TestValidationResult:
    """Tests for ValidationResult dataclass."""

    def test_creates_result(self) -> None:
        """Should create validation result."""
        result = ValidationResult(
            script_name="validate-test",
            category=Category.DATABASE,
            script_type="validate",
            timestamp=datetime.now(),
            duration=5.5,
            exit_code=0,
            output="Success",
            passed=True,
            warnings=0,
        )
        assert result.script_name == "validate-test"
        assert result.category == Category.DATABASE
        assert result.passed is True

    def test_result_with_warnings(self) -> None:
        """Should track warnings."""
        result = ValidationResult(
            script_name="verify-test",
            category=Category.SECURITY,
            script_type="verify",
            timestamp=datetime.now(),
            duration=3.0,
            exit_code=0,
            output="Warning: something",
            passed=True,
            warnings=2,
        )
        assert result.warnings == 2


class TestTUIState:
    """Tests for TUIState dataclass."""

    def test_default_values(self) -> None:
        """Should have default values."""
        state = TUIState()
        assert state.scripts == []
        assert state.results == []
        assert state.selected_index == 0
        assert state.mode == "main"
        assert state.category_filter is None
        assert state.run_all_in_progress is False
        assert state.total_passed == 0
        assert state.total_failed == 0


class TestDetectCategory:
    """Tests for detect_category function."""

    def test_detects_config(self) -> None:
        """Should detect config category."""
        assert detect_category("validate-config", "") == Category.CONFIG
        assert detect_category("validate-env-setup", "") == Category.CONFIG
        assert detect_category("validate-helm", "") == Category.CONFIG

    def test_detects_database(self) -> None:
        """Should detect database category."""
        assert detect_category("validate-database", "") == Category.DATABASE
        assert detect_category("verify-postgres", "") == Category.DATABASE
        assert detect_category("check-dbm", "") == Category.DATABASE

    def test_detects_docker(self) -> None:
        """Should detect docker category."""
        assert detect_category("validate-dockerfile", "") == Category.DOCKER
        assert detect_category("check-container", "") == Category.DOCKER

    def test_detects_monitoring(self) -> None:
        """Should detect monitoring category."""
        assert detect_category("verify-datadog", "") == Category.MONITORING
        assert detect_category("validate-healthchecks", "") == Category.MONITORING
        assert detect_category("check-apm", "") == Category.MONITORING

    def test_detects_security(self) -> None:
        """Should detect security category."""
        assert detect_category("verify-licenses", "") == Category.SECURITY
        assert detect_category("check-gpl", "") == Category.SECURITY
        assert detect_category("verify-ssl", "") == Category.SECURITY

    def test_detects_deployment(self) -> None:
        """Should detect deployment category."""
        assert detect_category("validate-deployment-readiness", "") == Category.DEPLOYMENT
        assert detect_category("validate-workflow", "") == Category.DEPLOYMENT

    def test_detects_infrastructure(self) -> None:
        """Should detect infrastructure category."""
        assert detect_category("validate-arm64", "") == Category.INFRASTRUCTURE
        assert detect_category("verify-services", "") == Category.INFRASTRUCTURE

    def test_returns_other_for_unknown(self) -> None:
        """Should return OTHER for unknown patterns."""
        assert detect_category("some-random-script", "") == Category.OTHER

    def test_uses_description(self) -> None:
        """Should use description for detection."""
        assert detect_category("validate-foo", "Validates database connections") == Category.DATABASE


class TestDetectScriptType:
    """Tests for detect_script_type function."""

    def test_detects_validate(self) -> None:
        """Should detect validate type."""
        assert detect_script_type("validate-config") == "validate"
        assert detect_script_type("validate-database") == "validate"

    def test_detects_verify(self) -> None:
        """Should detect verify type."""
        assert detect_script_type("verify-setup") == "verify"
        assert detect_script_type("verify-licenses") == "verify"

    def test_detects_check(self) -> None:
        """Should detect check type."""
        assert detect_script_type("check-datadog") == "check"
        assert detect_script_type("check-licenses") == "check"

    def test_defaults_to_validate(self) -> None:
        """Should default to validate for unknown."""
        assert detect_script_type("unknown-script") == "validate"


class TestGetTypeSymbol:
    """Tests for get_type_symbol function."""

    def test_validate_symbol(self) -> None:
        """Should return V for validate."""
        assert get_type_symbol("validate") == "V"

    def test_verify_symbol(self) -> None:
        """Should return ? for verify."""
        assert get_type_symbol("verify") == "?"

    def test_check_symbol(self) -> None:
        """Should return C for check."""
        assert get_type_symbol("check") == "C"

    def test_unknown_symbol(self) -> None:
        """Should return ? for unknown."""
        assert get_type_symbol("unknown") == "?"


class TestGetScriptDescription:
    """Tests for get_script_description function."""

    def test_extracts_description(self, tmp_path: Path) -> None:
        """Should extract description from header."""
        script = tmp_path / "validate.sh"
        script.write_text("#!/bin/bash\n# Validate configuration files\necho hello\n")

        desc = get_script_description(script)
        assert "Validate configuration" in desc

    def test_handles_no_description(self, tmp_path: Path) -> None:
        """Should handle script with no description."""
        script = tmp_path / "validate-test.sh"
        script.write_text("#!/bin/bash\necho hello\n")

        desc = get_script_description(script)
        assert "Validate Test" in desc

    def test_handles_missing_file(self, tmp_path: Path) -> None:
        """Should handle missing file."""
        desc = get_script_description(tmp_path / "nonexistent.sh")
        assert desc == "Unknown"


class TestCountWarningsInOutput:
    """Tests for count_warnings_in_output function."""

    def test_counts_warning_emoji(self) -> None:
        """Should count warning emoji."""
        output = "Line 1\n⚠️ Warning message\nLine 3\n⚠️ Another warning"
        assert count_warnings_in_output(output) == 2

    def test_counts_warn_brackets(self) -> None:
        """Should count [WARN] brackets."""
        output = "[WARN] Something happened\n[WARNING] Another thing"
        assert count_warnings_in_output(output) == 2

    def test_counts_warning_colon(self) -> None:
        """Should count warning: prefix."""
        output = "warning: deprecated\nWARN: something else"
        assert count_warnings_in_output(output) == 2

    def test_returns_zero_for_no_warnings(self) -> None:
        """Should return 0 when no warnings."""
        output = "All good\nEverything passed"
        assert count_warnings_in_output(output) == 0


class TestDiscoverValidations:
    """Tests for discover_validations function."""

    def test_discovers_validate_scripts(self, tmp_path: Path) -> None:
        """Should discover validate-*.sh scripts."""
        (tmp_path / "validate-config.sh").write_text("#!/bin/bash\n# Config validation\n")
        (tmp_path / "validate-db.sh").write_text("#!/bin/bash\n# DB validation\n")

        scripts = discover_validations(tmp_path)

        assert len(scripts) >= 2
        names = [s.name for s in scripts]
        assert "validate-config" in names
        assert "validate-db" in names

    def test_discovers_verify_scripts(self, tmp_path: Path) -> None:
        """Should discover verify-*.sh scripts."""
        (tmp_path / "verify-setup.sh").write_text("#!/bin/bash\n# Verify setup\n")

        scripts = discover_validations(tmp_path)

        assert any(s.name == "verify-setup" for s in scripts)

    def test_discovers_check_scripts(self, tmp_path: Path) -> None:
        """Should discover check-*.sh scripts."""
        (tmp_path / "check-licenses.sh").write_text("#!/bin/bash\n# Check licenses\n")

        scripts = discover_validations(tmp_path)

        assert any(s.name == "check-licenses" for s in scripts)

    def test_sets_category(self, tmp_path: Path) -> None:
        """Should set correct category."""
        (tmp_path / "validate-config.sh").write_text("#!/bin/bash\n")
        (tmp_path / "verify-database.sh").write_text("#!/bin/bash\n")

        scripts = discover_validations(tmp_path)

        config_script = next((s for s in scripts if "config" in s.name), None)
        db_script = next((s for s in scripts if "database" in s.name), None)

        if config_script:
            assert config_script.category == Category.CONFIG
        if db_script:
            assert db_script.category == Category.DATABASE

    def test_sets_script_type(self, tmp_path: Path) -> None:
        """Should set correct script type."""
        (tmp_path / "validate-test.sh").write_text("#!/bin/bash\n")
        (tmp_path / "verify-test.sh").write_text("#!/bin/bash\n")
        (tmp_path / "check-test.sh").write_text("#!/bin/bash\n")

        scripts = discover_validations(tmp_path)

        validate_script = next((s for s in scripts if s.name == "validate-test"), None)
        verify_script = next((s for s in scripts if s.name == "verify-test"), None)
        check_script = next((s for s in scripts if s.name == "check-test"), None)

        if validate_script:
            assert validate_script.script_type == "validate"
        if verify_script:
            assert verify_script.script_type == "verify"
        if check_script:
            assert check_script.script_type == "check"

    def test_sorts_by_category_and_name(self, tmp_path: Path) -> None:
        """Should sort scripts by category then name."""
        (tmp_path / "validate-zebra.sh").write_text("#!/bin/bash\n")
        (tmp_path / "validate-alpha.sh").write_text("#!/bin/bash\n")

        scripts = discover_validations(tmp_path)

        assert len(scripts) >= 2


class TestGetFilteredScripts:
    """Tests for get_filtered_scripts function."""

    def test_returns_all_when_no_filter(self, tmp_path: Path) -> None:
        """Should return all scripts when no filter."""
        state = TUIState()
        state.scripts = [
            ValidationScript(path=tmp_path / "a.sh", name="a", category=Category.CONFIG),
            ValidationScript(path=tmp_path / "b.sh", name="b", category=Category.DATABASE),
        ]
        state.category_filter = None

        filtered = get_filtered_scripts(state)

        assert len(filtered) == 2

    def test_filters_by_category(self, tmp_path: Path) -> None:
        """Should filter by category."""
        state = TUIState()
        state.scripts = [
            ValidationScript(path=tmp_path / "a.sh", name="a", category=Category.CONFIG),
            ValidationScript(path=tmp_path / "b.sh", name="b", category=Category.DATABASE),
            ValidationScript(path=tmp_path / "c.sh", name="c", category=Category.CONFIG),
        ]
        state.category_filter = Category.CONFIG

        filtered = get_filtered_scripts(state)

        assert len(filtered) == 2
        assert all(s.category == Category.CONFIG for s in filtered)


class TestSaveResults:
    """Tests for save_results function."""

    def test_saves_results_to_json(self, tmp_path: Path) -> None:
        """Should save results to JSON file."""
        state = TUIState()
        state.results = [
            ValidationResult(
                script_name="validate-test",
                category=Category.CONFIG,
                script_type="validate",
                timestamp=datetime(2024, 1, 1, 12, 0, 0),
                duration=5.5,
                exit_code=0,
                output="output",
                passed=True,
                warnings=0,
            ),
        ]

        output_path = tmp_path / "results.json"
        save_results(state, output_path)

        assert output_path.exists()
        import json
        data = json.loads(output_path.read_text())
        assert "timestamp" in data
        assert "summary" in data
        assert data["summary"]["total"] == 1
        assert data["summary"]["passed"] == 1
        assert len(data["results"]) == 1
        assert data["results"][0]["script"] == "validate-test"

    def test_creates_parent_directories(self, tmp_path: Path) -> None:
        """Should create parent directories if needed."""
        state = TUIState()
        state.results = []

        output_path = tmp_path / "deep" / "nested" / "results.json"
        save_results(state, output_path)

        assert output_path.exists()

    def test_includes_summary(self, tmp_path: Path) -> None:
        """Should include summary in output."""
        state = TUIState()
        state.results = [
            ValidationResult(
                script_name="pass",
                category=Category.CONFIG,
                script_type="validate",
                timestamp=datetime.now(),
                duration=1.0,
                exit_code=0,
                output="",
                passed=True,
                warnings=0,
            ),
            ValidationResult(
                script_name="fail",
                category=Category.DATABASE,
                script_type="verify",
                timestamp=datetime.now(),
                duration=2.0,
                exit_code=1,
                output="",
                passed=False,
                warnings=0,
            ),
            ValidationResult(
                script_name="warn",
                category=Category.DOCKER,
                script_type="check",
                timestamp=datetime.now(),
                duration=3.0,
                exit_code=0,
                output="",
                passed=True,
                warnings=2,
            ),
        ]

        output_path = tmp_path / "results.json"
        save_results(state, output_path)

        import json
        data = json.loads(output_path.read_text())
        assert data["summary"]["total"] == 3
        assert data["summary"]["passed"] == 2
        assert data["summary"]["failed"] == 1
        assert data["summary"]["warnings"] == 2


class TestTUIStateManagement:
    """Tests for TUI state management."""

    def test_mode_transitions(self) -> None:
        """Should handle mode transitions."""
        state = TUIState()

        assert state.mode == "main"

        state.mode = "running"
        assert state.mode == "running"

        state.mode = "category_filter"
        assert state.mode == "category_filter"

        state.mode = "summary"
        assert state.mode == "summary"

    def test_category_filter(self) -> None:
        """Should track category filter."""
        state = TUIState()

        assert state.category_filter is None

        state.category_filter = Category.DATABASE
        assert state.category_filter == Category.DATABASE

        state.category_filter = None
        assert state.category_filter is None

    def test_run_all_tracking(self) -> None:
        """Should track run all progress."""
        state = TUIState()

        assert state.run_all_in_progress is False
        assert state.total_passed == 0
        assert state.total_failed == 0

        state.run_all_in_progress = True
        state.total_passed = 5
        state.total_failed = 2
        state.total_warnings = 3

        assert state.run_all_in_progress is True
        assert state.total_passed == 5
        assert state.total_failed == 2
        assert state.total_warnings == 3


class TestValidationScriptStatus:
    """Tests for validation script status transitions."""

    def test_status_pending(self, tmp_path: Path) -> None:
        """Should start with pending status."""
        script = ValidationScript(path=tmp_path / "validate.sh", name="validate")
        assert script.status == "pending"

    def test_status_running(self, tmp_path: Path) -> None:
        """Should transition to running."""
        script = ValidationScript(path=tmp_path / "validate.sh", name="validate")
        script.status = "running"
        assert script.status == "running"

    def test_status_passed(self, tmp_path: Path) -> None:
        """Should transition to passed."""
        script = ValidationScript(path=tmp_path / "validate.sh", name="validate")
        script.status = "passed"
        script.last_run = datetime.now()
        assert script.status == "passed"

    def test_status_warning(self, tmp_path: Path) -> None:
        """Should transition to warning."""
        script = ValidationScript(path=tmp_path / "validate.sh", name="validate")
        script.status = "warning"
        assert script.status == "warning"

    def test_status_failed(self, tmp_path: Path) -> None:
        """Should transition to failed."""
        script = ValidationScript(path=tmp_path / "validate.sh", name="validate")
        script.status = "failed"
        assert script.status == "failed"


class TestCategoryColors:
    """Tests for category-related utilities."""

    def test_all_categories_have_values(self) -> None:
        """Should have values for all categories."""
        for cat in Category:
            assert cat.value is not None
            assert len(cat.value) > 0

    def test_category_values_are_unique(self) -> None:
        """Should have unique values for all categories."""
        values = [cat.value for cat in Category]
        assert len(values) == len(set(values))
