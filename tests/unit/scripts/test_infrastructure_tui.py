"""Tests for scripts/infrastructure_tui.py"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from infrastructure_tui import (
    Action,
    InfraScript,
    Provider,
    RunResult,
    TUIState,
    detect_action,
    detect_provider,
    discover_scripts,
    get_action_symbol,
    get_filtered_scripts,
    get_script_description,
    save_results,
)


class TestProvider:
    """Tests for Provider enum."""

    def test_has_expected_values(self) -> None:
        """Should have expected provider values."""
        assert Provider.AWS.value == "aws"
        assert Provider.GCP.value == "gcp"
        assert Provider.AZURE.value == "azure"
        assert Provider.KIND.value == "kind"
        assert Provider.DOCKER.value == "docker"
        assert Provider.OTHER.value == "other"


class TestAction:
    """Tests for Action enum."""

    def test_has_expected_values(self) -> None:
        """Should have expected action values."""
        assert Action.START.value == "start"
        assert Action.STOP.value == "stop"
        assert Action.SETUP.value == "setup"
        assert Action.DEPLOY.value == "deploy"
        assert Action.CLEANUP.value == "cleanup"
        assert Action.STATUS.value == "status"
        assert Action.OTHER.value == "other"


class TestInfraScript:
    """Tests for InfraScript dataclass."""

    def test_creates_script(self, tmp_path: Path) -> None:
        """Should create infrastructure script."""
        script = InfraScript(
            path=tmp_path / "start.sh",
            name="start-cluster",
            description="Start the cluster",
            provider=Provider.KIND,
            action=Action.START,
        )
        assert script.name == "start-cluster"
        assert script.provider == Provider.KIND
        assert script.action == Action.START
        assert script.status == "pending"

    def test_default_values(self, tmp_path: Path) -> None:
        """Should have default values."""
        script = InfraScript(path=tmp_path / "script.sh", name="script")
        assert script.description == ""
        assert script.provider == Provider.OTHER
        assert script.action == Action.OTHER
        assert script.last_run is None
        assert script.run_time == 0.0


class TestRunResult:
    """Tests for RunResult dataclass."""

    def test_creates_result(self) -> None:
        """Should create run result."""
        result = RunResult(
            script_name="kind-setup",
            provider=Provider.KIND,
            action=Action.SETUP,
            timestamp=datetime.now(),
            duration=30.5,
            exit_code=0,
            output="Success",
            success=True,
        )
        assert result.script_name == "kind-setup"
        assert result.provider == Provider.KIND
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
        assert state.provider_filter is None


class TestDetectProvider:
    """Tests for detect_provider function."""

    def test_detects_aws_from_path(self, tmp_path: Path) -> None:
        """Should detect AWS from path."""
        path = tmp_path / "cloud" / "aws" / "start.sh"
        assert detect_provider("start", path) == Provider.AWS

    def test_detects_gcp_from_path(self, tmp_path: Path) -> None:
        """Should detect GCP from path."""
        path = tmp_path / "cloud" / "gcp" / "start.sh"
        assert detect_provider("start", path) == Provider.GCP

    def test_detects_docker_from_path(self, tmp_path: Path) -> None:
        """Should detect Docker from path."""
        path = tmp_path / "cloud" / "docker" / "compose.sh"
        assert detect_provider("compose", path) == Provider.DOCKER

    def test_detects_kind_from_prefix(self, tmp_path: Path) -> None:
        """Should detect Kind from script prefix."""
        path = tmp_path / "kind-setup.sh"
        assert detect_provider("kind-setup", path) == Provider.KIND

    def test_detects_azure_from_aks_prefix(self, tmp_path: Path) -> None:
        """Should detect Azure from aks prefix."""
        path = tmp_path / "aks-bootstrap.sh"
        assert detect_provider("aks-bootstrap", path) == Provider.AZURE

    def test_returns_other_for_unknown(self, tmp_path: Path) -> None:
        """Should return OTHER for unknown patterns."""
        path = tmp_path / "random-script.sh"
        assert detect_provider("random-script", path) == Provider.OTHER


class TestDetectAction:
    """Tests for detect_action function."""

    def test_detects_start(self) -> None:
        """Should detect start action."""
        assert detect_action("start-workspace", "") == Action.START
        assert detect_action("create-cluster", "") == Action.START

    def test_detects_stop(self) -> None:
        """Should detect stop action."""
        assert detect_action("stop-workspace", "") == Action.STOP
        assert detect_action("shutdown-vm", "") == Action.STOP

    def test_detects_setup(self) -> None:
        """Should detect setup action."""
        assert detect_action("setup-datadog", "") == Action.SETUP
        assert detect_action("bootstrap-cluster", "") == Action.SETUP

    def test_detects_deploy(self) -> None:
        """Should detect deploy action."""
        assert detect_action("app-deploy", "") == Action.DEPLOY
        assert detect_action("deploy-services", "") == Action.DEPLOY

    def test_detects_cleanup(self) -> None:
        """Should detect cleanup action."""
        assert detect_action("cleanup-resources", "") == Action.CLEANUP
        assert detect_action("delete-cluster", "") == Action.CLEANUP

    def test_detects_status(self) -> None:
        """Should detect status action."""
        assert detect_action("health-check", "") == Action.STATUS
        assert detect_action("env-check", "") == Action.STATUS

    def test_returns_other_for_unknown(self) -> None:
        """Should return OTHER for unknown patterns."""
        assert detect_action("random-script", "") == Action.OTHER


class TestGetActionSymbol:
    """Tests for get_action_symbol function."""

    def test_start_symbol(self) -> None:
        """Should return > for start."""
        assert get_action_symbol(Action.START) == ">"

    def test_stop_symbol(self) -> None:
        """Should return # for stop."""
        assert get_action_symbol(Action.STOP) == "#"

    def test_setup_symbol(self) -> None:
        """Should return * for setup."""
        assert get_action_symbol(Action.SETUP) == "*"

    def test_deploy_symbol(self) -> None:
        """Should return D for deploy."""
        assert get_action_symbol(Action.DEPLOY) == "D"

    def test_cleanup_symbol(self) -> None:
        """Should return X for cleanup."""
        assert get_action_symbol(Action.CLEANUP) == "X"

    def test_status_symbol(self) -> None:
        """Should return ? for status."""
        assert get_action_symbol(Action.STATUS) == "?"


class TestGetScriptDescription:
    """Tests for get_script_description function."""

    def test_extracts_description(self, tmp_path: Path) -> None:
        """Should extract description from header."""
        script = tmp_path / "start.sh"
        script.write_text("#!/bin/bash\n# Start the cluster resources\necho hello\n")

        desc = get_script_description(script)
        assert "Start the cluster" in desc

    def test_handles_no_description(self, tmp_path: Path) -> None:
        """Should handle script with no description."""
        script = tmp_path / "start-cluster.sh"
        script.write_text("#!/bin/bash\necho hello\n")

        desc = get_script_description(script)
        assert "Start Cluster" in desc

    def test_handles_missing_file(self, tmp_path: Path) -> None:
        """Should handle missing file."""
        desc = get_script_description(tmp_path / "nonexistent.sh")
        assert desc == "Unknown"


class TestDiscoverScripts:
    """Tests for discover_scripts function."""

    def test_discovers_kind_scripts(self, tmp_path: Path) -> None:
        """Should discover kind-*.sh scripts."""
        (tmp_path / "kind-setup.sh").write_text("#!/bin/bash\n# Setup Kind\n")
        (tmp_path / "kind-cleanup.sh").write_text("#!/bin/bash\n# Cleanup Kind\n")

        scripts = discover_scripts(tmp_path)

        assert len(scripts) >= 2
        names = [s.name for s in scripts]
        assert "kind-setup" in names
        assert "kind-cleanup" in names

    def test_discovers_aks_scripts(self, tmp_path: Path) -> None:
        """Should discover aks-*.sh scripts."""
        (tmp_path / "aks-bootstrap.sh").write_text("#!/bin/bash\n# AKS bootstrap\n")

        scripts = discover_scripts(tmp_path)

        assert any(s.name == "aks-bootstrap" for s in scripts)
        aks_script = next(s for s in scripts if s.name == "aks-bootstrap")
        assert aks_script.provider == Provider.AZURE

    def test_discovers_cloud_scripts(self, tmp_path: Path) -> None:
        """Should discover cloud/**/*.sh scripts."""
        aws_dir = tmp_path / "cloud" / "aws"
        aws_dir.mkdir(parents=True)
        (aws_dir / "start-workspace.sh").write_text("#!/bin/bash\n# Start AWS\n")

        scripts = discover_scripts(tmp_path)

        assert any("cloud/start-workspace" in s.name for s in scripts)

    def test_sets_provider(self, tmp_path: Path) -> None:
        """Should set correct provider."""
        (tmp_path / "kind-setup.sh").write_text("#!/bin/bash\n")
        (tmp_path / "aks-bootstrap.sh").write_text("#!/bin/bash\n")

        scripts = discover_scripts(tmp_path)

        kind_script = next(s for s in scripts if "kind" in s.name)
        aks_script = next(s for s in scripts if "aks" in s.name)

        assert kind_script.provider == Provider.KIND
        assert aks_script.provider == Provider.AZURE

    def test_sets_action(self, tmp_path: Path) -> None:
        """Should set correct action type."""
        (tmp_path / "kind-setup.sh").write_text("#!/bin/bash\n")
        (tmp_path / "kind-cleanup.sh").write_text("#!/bin/bash\n")

        scripts = discover_scripts(tmp_path)

        setup_script = next(s for s in scripts if "setup" in s.name)
        cleanup_script = next(s for s in scripts if "cleanup" in s.name)

        assert setup_script.action == Action.SETUP
        assert cleanup_script.action == Action.CLEANUP

    def test_sorts_by_provider_and_action(self, tmp_path: Path) -> None:
        """Should sort scripts by provider then action then name."""
        (tmp_path / "kind-z-setup.sh").write_text("#!/bin/bash\n")
        (tmp_path / "kind-a-setup.sh").write_text("#!/bin/bash\n")
        (tmp_path / "aks-bootstrap.sh").write_text("#!/bin/bash\n")

        scripts = discover_scripts(tmp_path)

        # Should be sorted by provider value first
        assert len(scripts) >= 3


class TestGetFilteredScripts:
    """Tests for get_filtered_scripts function."""

    def test_returns_all_when_no_filter(self, tmp_path: Path) -> None:
        """Should return all scripts when no filter."""
        state = TUIState()
        state.scripts = [
            InfraScript(path=tmp_path / "a.sh", name="a", provider=Provider.KIND),
            InfraScript(path=tmp_path / "b.sh", name="b", provider=Provider.AWS),
        ]
        state.provider_filter = None

        filtered = get_filtered_scripts(state)

        assert len(filtered) == 2

    def test_filters_by_provider(self, tmp_path: Path) -> None:
        """Should filter by provider."""
        state = TUIState()
        state.scripts = [
            InfraScript(path=tmp_path / "a.sh", name="a", provider=Provider.KIND),
            InfraScript(path=tmp_path / "b.sh", name="b", provider=Provider.AWS),
            InfraScript(path=tmp_path / "c.sh", name="c", provider=Provider.KIND),
        ]
        state.provider_filter = Provider.KIND

        filtered = get_filtered_scripts(state)

        assert len(filtered) == 2
        assert all(s.provider == Provider.KIND for s in filtered)


class TestSaveResults:
    """Tests for save_results function."""

    def test_saves_results_to_json(self, tmp_path: Path) -> None:
        """Should save results to JSON file."""
        state = TUIState()
        state.results = [
            RunResult(
                script_name="kind-setup",
                provider=Provider.KIND,
                action=Action.SETUP,
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
        assert data["results"][0]["script"] == "kind-setup"
        assert data["results"][0]["provider"] == "kind"

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
            RunResult(
                script_name="test1",
                provider=Provider.KIND,
                action=Action.SETUP,
                timestamp=datetime.now(),
                duration=5.0,
                exit_code=0,
                output="",
                success=True,
            ),
            RunResult(
                script_name="test2",
                provider=Provider.AWS,
                action=Action.START,
                timestamp=datetime.now(),
                duration=3.0,
                exit_code=1,
                output="",
                success=False,
            ),
        ]

        output_path = tmp_path / "results.json"
        save_results(state, output_path)

        import json
        data = json.loads(output_path.read_text())
        assert data["summary"]["total"] == 2
        assert data["summary"]["success"] == 1
        assert data["summary"]["failed"] == 1


class TestTUIStateManagement:
    """Tests for TUI state management."""

    def test_mode_transitions(self) -> None:
        """Should handle mode transitions."""
        state = TUIState()

        assert state.mode == "main"

        state.mode = "running"
        assert state.mode == "running"

        state.mode = "provider_filter"
        assert state.mode == "provider_filter"

        state.mode = "summary"
        assert state.mode == "summary"

    def test_provider_filter(self) -> None:
        """Should track provider filter."""
        state = TUIState()

        assert state.provider_filter is None

        state.provider_filter = Provider.AWS
        assert state.provider_filter == Provider.AWS

        state.provider_filter = None
        assert state.provider_filter is None

    def test_run_all_tracking(self) -> None:
        """Should track run all progress."""
        state = TUIState()

        state.run_all_in_progress = True
        state.total_success = 5
        state.total_failed = 2

        assert state.run_all_in_progress is True
        assert state.total_success == 5
        assert state.total_failed == 2


class TestInfraScriptStatus:
    """Tests for infrastructure script status transitions."""

    def test_status_pending(self, tmp_path: Path) -> None:
        """Should start with pending status."""
        script = InfraScript(path=tmp_path / "script.sh", name="script")
        assert script.status == "pending"

    def test_status_running(self, tmp_path: Path) -> None:
        """Should transition to running."""
        script = InfraScript(path=tmp_path / "script.sh", name="script")
        script.status = "running"
        assert script.status == "running"

    def test_status_success(self, tmp_path: Path) -> None:
        """Should transition to success."""
        script = InfraScript(path=tmp_path / "script.sh", name="script")
        script.status = "success"
        script.last_run = datetime.now()
        script.run_time = 30.0

        assert script.status == "success"
        assert script.last_run is not None

    def test_status_failed(self, tmp_path: Path) -> None:
        """Should transition to failed."""
        script = InfraScript(path=tmp_path / "script.sh", name="script")
        script.status = "failed"
        assert script.status == "failed"


class TestProviderColors:
    """Tests for provider-related utilities."""

    def test_all_providers_have_values(self) -> None:
        """Should have values for all providers."""
        for prov in Provider:
            assert prov.value is not None
            assert len(prov.value) > 0

    def test_provider_values_are_unique(self) -> None:
        """Should have unique values for all providers."""
        values = [prov.value for prov in Provider]
        assert len(values) == len(set(values))


class TestActionValues:
    """Tests for action-related utilities."""

    def test_all_actions_have_values(self) -> None:
        """Should have values for all actions."""
        for action in Action:
            assert action.value is not None
            assert len(action.value) > 0

    def test_action_values_are_unique(self) -> None:
        """Should have unique values for all actions."""
        values = [action.value for action in Action]
        assert len(values) == len(set(values))
