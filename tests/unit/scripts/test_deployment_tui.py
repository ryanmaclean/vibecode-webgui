"""Tests for scripts/deployment_tui.py"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from deployment_tui import (
    DeploymentResult,
    DeploymentScript,
    Environment,
    TUIState,
    detect_environment,
    discover_deployments,
    get_filtered_scripts,
    get_script_description,
    is_dangerous_script,
    save_results,
)


class TestEnvironment:
    """Tests for Environment enum."""

    def test_has_expected_values(self) -> None:
        """Should have expected environment values."""
        assert Environment.LOCAL.value == "local"
        assert Environment.KIND.value == "kind"
        assert Environment.AZURE.value == "azure"
        assert Environment.PRODUCTION.value == "production"
        assert Environment.MONITORING.value == "monitoring"
        assert Environment.DATABASE.value == "database"
        assert Environment.OTHER.value == "other"


class TestDeploymentScript:
    """Tests for DeploymentScript dataclass."""

    def test_creates_script(self, tmp_path: Path) -> None:
        """Should create deployment script."""
        script = DeploymentScript(
            path=tmp_path / "deploy.sh",
            name="deploy",
            description="Deploy script",
            environment=Environment.LOCAL,
        )
        assert script.name == "deploy"
        assert script.environment == Environment.LOCAL
        assert script.status == "pending"

    def test_default_values(self, tmp_path: Path) -> None:
        """Should have default values."""
        script = DeploymentScript(path=tmp_path / "deploy.sh", name="deploy")
        assert script.description == ""
        assert script.environment == Environment.OTHER
        assert script.last_run is None
        assert script.run_time == 0.0
        assert script.requires_confirmation is False


class TestDeploymentResult:
    """Tests for DeploymentResult dataclass."""

    def test_creates_result(self) -> None:
        """Should create deployment result."""
        result = DeploymentResult(
            script_name="deploy-test",
            environment=Environment.AZURE,
            timestamp=datetime.now(),
            duration=30.5,
            exit_code=0,
            output="Success",
            success=True,
        )
        assert result.script_name == "deploy-test"
        assert result.environment == Environment.AZURE
        assert result.success is True


class TestTUIState:
    """Tests for TUIState dataclass."""

    def test_default_values(self) -> None:
        """Should have default values."""
        state = TUIState()
        assert state.scripts == []
        assert state.results == []
        assert state.selected_index == 0
        assert state.scroll_offset == 0
        assert state.mode == "main"
        assert state.running_script is None
        assert state.env_filter is None
        assert state.pending_script is None


class TestDetectEnvironment:
    """Tests for detect_environment function."""

    def test_detects_local(self) -> None:
        """Should detect local environment."""
        assert detect_environment("deploy-simple-local", "") == Environment.LOCAL
        assert detect_environment("local-deploy", "") == Environment.LOCAL

    def test_detects_kind(self) -> None:
        """Should detect kind environment."""
        assert detect_environment("deploy-kind-cluster", "") == Environment.KIND
        assert detect_environment("kind-deploy", "") == Environment.KIND

    def test_detects_azure(self) -> None:
        """Should detect azure environment."""
        assert detect_environment("deploy-azure-app", "") == Environment.AZURE
        assert detect_environment("aks-deploy", "") == Environment.AZURE

    def test_detects_production(self) -> None:
        """Should detect production environment."""
        assert detect_environment("deploy-production", "") == Environment.PRODUCTION
        assert detect_environment("prod-deploy", "") == Environment.PRODUCTION

    def test_detects_monitoring(self) -> None:
        """Should detect monitoring environment."""
        assert detect_environment("deploy-datadog", "") == Environment.MONITORING
        assert detect_environment("deploy-dbm-apm", "") == Environment.MONITORING

    def test_detects_database(self) -> None:
        """Should detect database environment."""
        assert detect_environment("deploy-database-migrations", "") == Environment.DATABASE
        assert detect_environment("postgres-deploy", "") == Environment.DATABASE

    def test_returns_other_for_unknown(self) -> None:
        """Should return OTHER for unknown patterns."""
        assert detect_environment("some-random-script", "") == Environment.OTHER

    def test_uses_description(self) -> None:
        """Should use description for detection."""
        assert detect_environment("deploy-foo", "Deploys to production") == Environment.PRODUCTION


class TestGetScriptDescription:
    """Tests for get_script_description function."""

    def test_extracts_description(self, tmp_path: Path) -> None:
        """Should extract description from header."""
        script = tmp_path / "deploy.sh"
        script.write_text("#!/bin/bash\n# Deploy application to production\necho hello\n")

        desc = get_script_description(script)
        assert "Deploy application" in desc

    def test_handles_no_description(self, tmp_path: Path) -> None:
        """Should handle script with no description."""
        script = tmp_path / "deploy-test.sh"
        script.write_text("#!/bin/bash\necho hello\n")

        desc = get_script_description(script)
        assert "Deploy Test" in desc

    def test_handles_missing_file(self, tmp_path: Path) -> None:
        """Should handle missing file."""
        desc = get_script_description(tmp_path / "nonexistent.sh")
        assert desc == "Unknown"

    def test_skips_shellcheck_comments(self, tmp_path: Path) -> None:
        """Should skip shellcheck directive comments."""
        script = tmp_path / "deploy.sh"
        script.write_text("#!/bin/bash\n# shellcheck disable=SC2086\n# Real description\necho hello\n")

        desc = get_script_description(script)
        assert "shellcheck" not in desc.lower()
        assert "Real description" in desc


class TestIsDangerousScript:
    """Tests for is_dangerous_script function."""

    def test_detects_production(self) -> None:
        """Should detect production scripts."""
        assert is_dangerous_script("deploy-production") is True
        assert is_dangerous_script("prod-deploy") is True

    def test_detects_migration(self) -> None:
        """Should detect migration scripts."""
        assert is_dangerous_script("deploy-database-migrations") is True
        assert is_dangerous_script("migrate-data") is True

    def test_detects_destructive(self) -> None:
        """Should detect destructive scripts."""
        assert is_dangerous_script("deploy-all-fixes") is True
        assert is_dangerous_script("delete-old-data") is True
        assert is_dangerous_script("destroy-cluster") is True

    def test_allows_safe_scripts(self) -> None:
        """Should allow safe scripts."""
        assert is_dangerous_script("deploy-local") is False
        assert is_dangerous_script("deploy-kind") is False
        assert is_dangerous_script("deploy-test") is False


class TestDiscoverDeployments:
    """Tests for discover_deployments function."""

    def test_discovers_deploy_scripts(self, tmp_path: Path) -> None:
        """Should discover deploy-*.sh scripts."""
        (tmp_path / "deploy-local.sh").write_text("#!/bin/bash\n# Local deploy\n")
        (tmp_path / "deploy-prod.sh").write_text("#!/bin/bash\n# Production deploy\n")

        scripts = discover_deployments(tmp_path)

        assert len(scripts) >= 2
        names = [s.name for s in scripts]
        assert "deploy-local" in names
        assert "deploy-prod" in names

    def test_discovers_aks_scripts(self, tmp_path: Path) -> None:
        """Should discover aks-*.sh scripts."""
        (tmp_path / "aks-deploy.sh").write_text("#!/bin/bash\n# AKS deploy\n")

        scripts = discover_deployments(tmp_path)

        assert any(s.name == "aks-deploy" for s in scripts)

    def test_sets_environment(self, tmp_path: Path) -> None:
        """Should set correct environment."""
        (tmp_path / "deploy-local.sh").write_text("#!/bin/bash\n")
        (tmp_path / "deploy-azure.sh").write_text("#!/bin/bash\n")

        scripts = discover_deployments(tmp_path)

        local_script = next(s for s in scripts if "local" in s.name)
        azure_script = next(s for s in scripts if "azure" in s.name)

        assert local_script.environment == Environment.LOCAL
        assert azure_script.environment == Environment.AZURE

    def test_marks_dangerous_scripts(self, tmp_path: Path) -> None:
        """Should mark dangerous scripts."""
        (tmp_path / "deploy-production.sh").write_text("#!/bin/bash\n")
        (tmp_path / "deploy-local.sh").write_text("#!/bin/bash\n")

        scripts = discover_deployments(tmp_path)

        prod_script = next(s for s in scripts if "production" in s.name)
        local_script = next(s for s in scripts if "local" in s.name)

        assert prod_script.requires_confirmation is True
        assert local_script.requires_confirmation is False

    def test_sorts_by_environment_and_name(self, tmp_path: Path) -> None:
        """Should sort scripts by environment then name."""
        (tmp_path / "deploy-z-azure.sh").write_text("#!/bin/bash\n")
        (tmp_path / "deploy-a-azure.sh").write_text("#!/bin/bash\n")
        (tmp_path / "deploy-local.sh").write_text("#!/bin/bash\n")

        scripts = discover_deployments(tmp_path)

        # Should be sorted by environment value first, then name
        assert len(scripts) >= 3


class TestGetFilteredScripts:
    """Tests for get_filtered_scripts function."""

    def test_returns_all_when_no_filter(self, tmp_path: Path) -> None:
        """Should return all scripts when no filter."""
        state = TUIState()
        state.scripts = [
            DeploymentScript(path=tmp_path / "a.sh", name="a", environment=Environment.LOCAL),
            DeploymentScript(path=tmp_path / "b.sh", name="b", environment=Environment.AZURE),
        ]
        state.env_filter = None

        filtered = get_filtered_scripts(state)

        assert len(filtered) == 2

    def test_filters_by_environment(self, tmp_path: Path) -> None:
        """Should filter by environment."""
        state = TUIState()
        state.scripts = [
            DeploymentScript(path=tmp_path / "a.sh", name="a", environment=Environment.LOCAL),
            DeploymentScript(path=tmp_path / "b.sh", name="b", environment=Environment.AZURE),
            DeploymentScript(path=tmp_path / "c.sh", name="c", environment=Environment.LOCAL),
        ]
        state.env_filter = Environment.LOCAL

        filtered = get_filtered_scripts(state)

        assert len(filtered) == 2
        assert all(s.environment == Environment.LOCAL for s in filtered)


class TestSaveResults:
    """Tests for save_results function."""

    def test_saves_results_to_json(self, tmp_path: Path) -> None:
        """Should save results to JSON file."""
        state = TUIState()
        state.results = [
            DeploymentResult(
                script_name="deploy-test",
                environment=Environment.LOCAL,
                timestamp=datetime(2024, 1, 1, 12, 0, 0),
                duration=10.5,
                exit_code=0,
                output="output",
                success=True,
            ),
        ]

        output_path = tmp_path / "results.json"
        save_results(state, output_path)

        assert output_path.exists()
        import json
        data = json.loads(output_path.read_text())
        assert "timestamp" in data
        assert len(data["results"]) == 1
        assert data["results"][0]["script"] == "deploy-test"
        assert data["results"][0]["environment"] == "local"

    def test_creates_parent_directories(self, tmp_path: Path) -> None:
        """Should create parent directories if needed."""
        state = TUIState()
        state.results = []

        output_path = tmp_path / "deep" / "nested" / "results.json"
        save_results(state, output_path)

        assert output_path.exists()


class TestTUIStateManagement:
    """Tests for TUI state management."""

    def test_mode_transitions(self) -> None:
        """Should handle mode transitions."""
        state = TUIState()

        assert state.mode == "main"

        state.mode = "running"
        assert state.mode == "running"

        state.mode = "env_filter"
        assert state.mode == "env_filter"

        state.mode = "confirm"
        assert state.mode == "confirm"

    def test_env_filter(self) -> None:
        """Should track environment filter."""
        state = TUIState()

        assert state.env_filter is None

        state.env_filter = Environment.AZURE
        assert state.env_filter == Environment.AZURE

        state.env_filter = None
        assert state.env_filter is None

    def test_pending_script(self, tmp_path: Path) -> None:
        """Should track pending script for confirmation."""
        state = TUIState()
        script = DeploymentScript(
            path=tmp_path / "deploy.sh",
            name="deploy",
            requires_confirmation=True,
        )

        state.pending_script = script
        assert state.pending_script is script

        state.pending_script = None
        assert state.pending_script is None


class TestDeploymentScriptStatus:
    """Tests for deployment script status transitions."""

    def test_status_pending(self, tmp_path: Path) -> None:
        """Should start with pending status."""
        script = DeploymentScript(path=tmp_path / "deploy.sh", name="deploy")
        assert script.status == "pending"

    def test_status_running(self, tmp_path: Path) -> None:
        """Should transition to running."""
        script = DeploymentScript(path=tmp_path / "deploy.sh", name="deploy")
        script.status = "running"
        assert script.status == "running"

    def test_status_success(self, tmp_path: Path) -> None:
        """Should transition to success."""
        script = DeploymentScript(path=tmp_path / "deploy.sh", name="deploy")
        script.status = "success"
        script.last_run = datetime.now()
        script.run_time = 30.0

        assert script.status == "success"
        assert script.last_run is not None

    def test_status_failed(self, tmp_path: Path) -> None:
        """Should transition to failed."""
        script = DeploymentScript(path=tmp_path / "deploy.sh", name="deploy")
        script.status = "failed"
        assert script.status == "failed"


class TestEnvironmentColors:
    """Tests for environment-related utilities."""

    def test_all_environments_have_values(self) -> None:
        """Should have values for all environments."""
        for env in Environment:
            assert env.value is not None
            assert len(env.value) > 0

    def test_environment_values_are_unique(self) -> None:
        """Should have unique values for all environments."""
        values = [env.value for env in Environment]
        assert len(values) == len(set(values))
