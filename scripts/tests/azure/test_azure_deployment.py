"""Pytest port of the minimal Azure deployment validation script."""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass

import pytest

from python_helpers import command_available, env_flag, run_command, timestamped_name


@dataclass
class AzureTestContext:
    resource_group: str
    location: str
    storage_account: str
    key_vault: str
    subscription_id: str
    user_object_id: str | None


def _require_live_azure() -> None:
    if not command_available("az"):
        pytest.skip("Azure CLI not installed")
    if not env_flag("RUN_AZURE_LIVE_TESTS"):
        pytest.skip("Set RUN_AZURE_LIVE_TESTS=1 to run live Azure deployment checks")


def _unique_storage_name() -> str:
    return f"vibetest{uuid.uuid4().hex[:12]}"


def _unique_kv_name() -> str:
    return f"vibetestkv{uuid.uuid4().hex[:10]}"


@pytest.fixture(scope="module")
def azure_context():
    _require_live_azure()
    location = os.getenv("AZURE_TEST_LOCATION", "eastus")
    resource_group = os.getenv("AZURE_TEST_RESOURCE_GROUP", timestamped_name("vibecode-bootstrap-test"))

    account_info = run_command(["az", "account", "show", "--query", "id", "-o", "tsv"], check=True)
    subscription_id = account_info.stdout.strip()

    user_object_id = None
    user_result = run_command(
        ["az", "ad", "signed-in-user", "show", "--query", "id", "-o", "tsv"],
        check=False,
    )
    if user_result.returncode == 0:
        user_object_id = user_result.stdout.strip()

    context = AzureTestContext(
        resource_group=resource_group,
        location=location,
        storage_account=_unique_storage_name(),
        key_vault=_unique_kv_name(),
        subscription_id=subscription_id,
        user_object_id=user_object_id,
    )

    yield context

    run_command(
        ["az", "group", "delete", "--name", context.resource_group, "--yes", "--no-wait"],
        check=False,
    )


@pytest.mark.azure
def test_minimal_azure_deployment(azure_context: AzureTestContext):
    ctx = azure_context

    run_command(["az", "group", "create", "--name", ctx.resource_group, "--location", ctx.location])
    run_command(["az", "group", "show", "--name", ctx.resource_group])

    run_command(
        [
            "az",
            "storage",
            "account",
            "create",
            "--name",
            ctx.storage_account,
            "--resource-group",
            ctx.resource_group,
            "--location",
            ctx.location,
            "--sku",
            "Standard_LRS",
            "--kind",
            "StorageV2",
        ]
    )

    if ctx.user_object_id:
        run_command(
            [
                "az",
                "role",
                "assignment",
                "list",
                "--assignee",
                ctx.user_object_id,
                "--scope",
                f"/subscriptions/{ctx.subscription_id}",
            ],
            check=False,
        )

    key_vault_created = run_command(
        [
            "az",
            "keyvault",
            "create",
            "--name",
            ctx.key_vault,
            "--resource-group",
            ctx.resource_group,
            "--location",
            ctx.location,
            "--sku",
            "standard",
        ],
        check=False,
    ).returncode == 0

    if key_vault_created:
        run_command(
            [
                "az",
                "keyvault",
                "secret",
                "set",
                "--vault-name",
                ctx.key_vault,
                "--name",
                "test-secret",
                "--value",
                "test-value",
            ],
            check=False,
        )

    run_command(
        [
            "az",
            "network",
            "vnet",
            "create",
            "--name",
            "test-vnet",
            "--resource-group",
            ctx.resource_group,
            "--location",
            ctx.location,
            "--address-prefix",
            "10.0.0.0/16",
            "--subnet-name",
            "test-subnet",
            "--subnet-prefix",
            "10.0.1.0/24",
        ]
    )
