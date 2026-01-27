"""Python conversion of test-azure-deployment.sh."""

from __future__ import annotations

import json
import os
import uuid

import pytest

from ..bootstrap.utils import run_command


RUN_AZURE_TESTS = os.getenv("RUN_AZURE_DEPLOYMENT_TESTS") == "1"


def _require_az_cli() -> None:
    result = run_command(["az", "--version"])
    if result.returncode != 0:
        pytest.skip("Azure CLI not installed")


def _run_az(args: list[str]) -> None:
    result = run_command(["az", *args], timeout=60)
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)


@pytest.fixture(scope="module")
def azure_env():
    if not RUN_AZURE_TESTS:
        pytest.skip("Set RUN_AZURE_DEPLOYMENT_TESTS=1 to run Azure integration tests")
    _require_az_cli()
    location = os.getenv("AZURE_TEST_LOCATION", "eastus")
    resource_group = f"vibecode-pytest-{uuid.uuid4().hex[:8]}"
    yield {"location": location, "resource_group": resource_group}
    run_command(["az", "group", "delete", "--name", resource_group, "--yes", "--no-wait"])


@pytest.mark.usefixtures("azure_env")
def test_resource_group_create_and_show(azure_env: dict[str, str]) -> None:
    _run_az([
        "group",
        "create",
        "--name",
        azure_env["resource_group"],
        "--location",
        azure_env["location"],
    ])
    result = run_command([
        "az",
        "group",
        "show",
        "--name",
        azure_env["resource_group"],
    ])
    assert result.returncode == 0
    data = json.loads(result.stdout or "{}")
    assert data.get("name") == azure_env["resource_group"]


@pytest.mark.usefixtures("azure_env")
def test_storage_account_creation(azure_env: dict[str, str]) -> None:
    account = f"vibetest{uuid.uuid4().hex[:10]}"
    _run_az([
        "storage",
        "account",
        "create",
        "--name",
        account,
        "--resource-group",
        azure_env["resource_group"],
        "--location",
        azure_env["location"],
        "--sku",
        "Standard_LRS",
        "--kind",
        "StorageV2",
    ])


@pytest.mark.usefixtures("azure_env")
def test_virtual_network_creation(azure_env: dict[str, str]) -> None:
    _run_az([
        "network",
        "vnet",
        "create",
        "--name",
        "pytest-vnet",
        "--resource-group",
        azure_env["resource_group"],
        "--location",
        azure_env["location"],
        "--address-prefix",
        "10.0.0.0/16",
        "--subnet-name",
        "pytest-subnet",
        "--subnet-prefix",
        "10.0.1.0/24",
    ])

