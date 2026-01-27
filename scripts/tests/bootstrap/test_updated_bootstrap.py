"""Tests migrated from test-updated-bootstrap.sh."""

from __future__ import annotations

import os

import pytest

from .bootstrap_env import BootstrapContext


def test_wrappers_delegate_to_python_helpers(bootstrap_context: BootstrapContext) -> None:
    scripts = {
        bootstrap_context.datadog_script: "datadog_setup.py",
        bootstrap_context.postgres_script: "postgres_setup.py",
        bootstrap_context.app_script: "app_deploy.py",
    }
    for script, helper in scripts.items():
        contents = script.read_text()
        assert helper in contents, f"{helper} missing from {script}"


def test_app_deploy_argument_translation(bootstrap_context: BootstrapContext) -> None:
    script = bootstrap_context.app_script.read_text()
    expected_flags = {
        "NAMESPACE": "--namespace",
        "ACR_NAME": "--acr-name",
        "IMAGE_TAG": "--image-tag",
        "LOCATION": "--location",
        "DATABASE_URL": "--database-url",
        "NEXTAUTH_SECRET": "--nextauth-secret",
        "NODE_ENV": "--node-env",
        "DD_API_KEY": "--dd-api-key",
        "DD_APP_KEY": "--dd-app-key",
        "OPENROUTER_API_KEY": "--openrouter-api-key",
        "POSTGRES_PASSWORD": "--postgres-password",
    }
    for env_var, flag in expected_flags.items():
        snippet = f"{flag} \"${env_var}\""
        assert snippet in script, f"{flag} not wired up for {env_var}"


def test_app_deploy_requires_acr_name(bootstrap_context: BootstrapContext) -> None:
    contents = bootstrap_context.app_script.read_text()
    assert "ACR_NAME environment variable is required" in contents


def test_wrappers_are_executable(bootstrap_context: BootstrapContext) -> None:
    for script in (
        bootstrap_context.datadog_script,
        bootstrap_context.postgres_script,
        bootstrap_context.app_script,
    ):
        assert os.access(script, os.X_OK)

