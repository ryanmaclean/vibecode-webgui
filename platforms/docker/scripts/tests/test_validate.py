
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for validate.py"""

import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
import tempfile
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validate import (
    ValidationResult,
    check_dockerfile_exists,
    check_required_files,
    check_script_permissions,
    check_dockerfile_targets,
    check_build_arguments,
)


class TestValidationResult:
    """Tests for ValidationResult dataclass."""

    def test_passed_result(self):
        """Test passed validation result."""
        result = ValidationResult(passed=True, message="Test passed")
        assert result.passed is True
        assert result.message == "Test passed"

    def test_failed_result(self):
        """Test failed validation result."""
        result = ValidationResult(passed=False, message="Test failed")
        assert result.passed is False
        assert result.message == "Test failed"


class TestCheckDockerfileExists:
    """Tests for check_dockerfile_exists function."""

    def test_dockerfile_exists(self):
        """Test when Dockerfile exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dockerfile = Path(tmpdir) / "Dockerfile"
            dockerfile.write_text("FROM alpine")

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                result = check_dockerfile_exists()
                assert result.passed is True
            finally:
                os.chdir(original_cwd)

    def test_dockerfile_missing(self):
        """Test when Dockerfile is missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                result = check_dockerfile_exists()
                assert result.passed is False
            finally:
                os.chdir(original_cwd)


class TestCheckRequiredFiles:
    """Tests for check_required_files function."""

    def test_all_files_exist(self):
        """Test when all required files exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            required_files = [
                "Dockerfile",
                "docker-compose.dev.yml",
                "docker-compose.prod.yml",
                "docker-compose.test.yml",
                "docker-compose.aks.yml",
                "build.sh",
                "deploy.sh",
                "README.md",
            ]

            for f in required_files:
                (Path(tmpdir) / f).write_text("content")

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                results = check_required_files()
                assert all(r.passed for r in results)
            finally:
                os.chdir(original_cwd)

    def test_some_files_missing(self):
        """Test when some required files are missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Only create Dockerfile
            (Path(tmpdir) / "Dockerfile").write_text("FROM alpine")

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                results = check_required_files()
                passed = [r for r in results if r.passed]
                failed = [r for r in results if not r.passed]
                assert len(passed) == 1
                assert len(failed) > 0
            finally:
                os.chdir(original_cwd)


class TestCheckScriptPermissions:
    """Tests for check_script_permissions function."""

    def test_executable_scripts(self):
        """Test with executable scripts."""
        with tempfile.TemporaryDirectory() as tmpdir:
            for script in ["build.sh", "deploy.sh"]:
                script_path = Path(tmpdir) / script
                script_path.write_text("#!/bin/bash\necho hello")
                script_path.chmod(0o755)

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                results = check_script_permissions()
                assert all(r.passed for r in results)
            finally:
                os.chdir(original_cwd)

    def test_non_executable_scripts(self):
        """Test with non-executable scripts that get fixed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            for script in ["build.sh", "deploy.sh"]:
                script_path = Path(tmpdir) / script
                script_path.write_text("#!/bin/bash\necho hello")
                script_path.chmod(0o644)

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                results = check_script_permissions()
                # Should pass after fixing permissions
                assert all(r.passed for r in results)
                # Scripts should now be executable
                for script in ["build.sh", "deploy.sh"]:
                    assert os.access(Path(tmpdir) / script, os.X_OK)
            finally:
                os.chdir(original_cwd)


class TestCheckDockerfileTargets:
    """Tests for check_dockerfile_targets function."""

    def test_all_targets_present(self):
        """Test when all targets are present."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dockerfile_content = """
FROM alpine AS base
FROM base AS deps
FROM deps AS builder
FROM builder AS production
FROM builder AS development
FROM builder AS testing
FROM builder AS ingestion
"""
            (Path(tmpdir) / "Dockerfile").write_text(dockerfile_content)

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                results = check_dockerfile_targets()
                assert all(r.passed for r in results)
            finally:
                os.chdir(original_cwd)

    def test_some_targets_missing(self):
        """Test when some targets are missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dockerfile_content = """
FROM alpine AS base
FROM base AS production
"""
            (Path(tmpdir) / "Dockerfile").write_text(dockerfile_content)

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                results = check_dockerfile_targets()
                passed = [r for r in results if r.passed]
                failed = [r for r in results if not r.passed]
                assert len(passed) == 2  # base and production
                assert len(failed) > 0
            finally:
                os.chdir(original_cwd)


class TestCheckBuildArguments:
    """Tests for check_build_arguments function."""

    def test_all_args_present(self):
        """Test when all build arguments are present."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dockerfile_content = """
ARG NODE_VERSION=20
ARG BASE_OS=alpine
ARG BUILD_TARGET=production
ARG INCLUDE_DEV_DEPS=false
ARG ENABLE_SOURCE_MAPS=false
ARG ENABLE_DATADOG=false
ARG ENABLE_LIGHTNINGCSS=false
ARG ENABLE_PRISMA=false
ARG ENABLE_HEALTH_CHECK=false
FROM alpine
"""
            (Path(tmpdir) / "Dockerfile").write_text(dockerfile_content)

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                results = check_build_arguments()
                assert all(r.passed for r in results)
            finally:
                os.chdir(original_cwd)

    def test_some_args_missing(self):
        """Test when some build arguments are missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            dockerfile_content = """
ARG NODE_VERSION=20
FROM alpine
"""
            (Path(tmpdir) / "Dockerfile").write_text(dockerfile_content)

            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                results = check_build_arguments()
                passed = [r for r in results if r.passed]
                failed = [r for r in results if not r.passed]
                assert len(passed) == 1  # NODE_VERSION
                assert len(failed) > 0
            finally:
                os.chdir(original_cwd)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])