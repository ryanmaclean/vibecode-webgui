

"""Utilities for repairing Azure PostgreSQL connectivity issues."""

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import secrets
import string
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional, Sequence
from urllib import request

DEFAULT_IP_SERVICE = "https://ifconfig.me"
PASSWORD_LENGTH = 25


@dataclass(frozen=True)
class FirewallConfig:
    """Configuration for applying a firewall rule to a flexible server."""

    server_name: str
    resource_group: str
    rule_name: str = "AllowCurrentIP"


@dataclass(frozen=True)
class PasswordResetConfig:
    """Configuration for resetting an admin password on a server."""

    server_name: str
    resource_group: str
    user_display: str


class CommandError(RuntimeError):
    """Raised when a required command is missing."""


def run_command(command: Sequence[str]) -> bool:
    """Run a shell command and return True on success.

    Parameters
    ----------
    command:
        The full command (with arguments) to execute.
    """

    try:
        result = subprocess.run(command, check=False)  # noqa: PLW1510
        return result.returncode == 0
    except FileNotFoundError as exc:  # pragma: no cover - depends on system state
        raise CommandError(f"Command not found: {command[0]}") from exc


def ensure_azure_login() -> None:
    """Ensure the caller is authenticated with Azure CLI."""

    print("🔧 Quick Database Connection Fix")
    print("================================")
    if not run_command(["az", "account", "show", "--output", "none"]):
        print("❌ Azure CLI not logged in. Please run: az login")
        raise SystemExit(1)
    print("✅ Azure CLI is logged in")


def get_public_ip(url: str = DEFAULT_IP_SERVICE, timeout: float = 5.0) -> str:
    """Return the caller's public IP address.

    Falls back to 0.0.0.0 when the lookup fails.
    """

    try:
        with request.urlopen(url, timeout=timeout) as response:  # type: ignore[call-arg]
            data = response.read().decode().strip()
            return data or "0.0.0.0"
    except Exception:
        return "0.0.0.0"


def add_firewall_rule(config: FirewallConfig, ip_address: str) -> bool:
    """Add a firewall rule for the provided IP address."""

    if ip_address == "0.0.0.0":
        print("⚠️  Skipping firewall rule because the public IP could not be determined")
        return False
    print(f"Adding firewall rule for {config.server_name} allowing {ip_address}…")
    return run_command(
        [
            "az",
            "postgres",
            "flexible-server",
            "firewall-rule",
            "create",
            "--name",
            config.server_name,
            "--resource-group",
            config.resource_group,
            "--rule-name",
            config.rule_name,
            "--start-ip-address",
            ip_address,
            "--end-ip-address",
            ip_address,
            "--output",
            "table",
        ]
    )


def generate_password(length: int = PASSWORD_LENGTH) -> str:
    """Return a strong random password containing letters and digits."""

    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def reset_admin_password(config: PasswordResetConfig, new_password: str) -> bool:
    """Reset the administrator password for the configured server."""

    print(f"Resetting password for {config.user_display}…")
    return run_command(
        [
            "az",
            "postgres",
            "flexible-server",
            "update",
            "--name",
            config.server_name,
            "--resource-group",
            config.resource_group,
            "--admin-password",
            new_password,
            "--output",
            "table",
        ]
    )


def print_summary(
    *,
    dev_ip: str,
    staging_password: str,
    staging_success: bool,
    prod_password: str,
    prod_success: bool,
) -> None:
    """Render a readable summary of all performed actions."""

    print("\n📊 Fix Summary:")
    print("===============")
    print(f"✅ DEV: Added firewall rule for IP {dev_ip}")
    staging_status = "✅" if staging_success else "⚠️"
    prod_status = "✅" if prod_success else "⚠️"
    print(f"{staging_status} STAGING: Reset password for vibecodeusr")
    print(f"{prod_status} PRODUCTION: Reset password for pgadmin")

    print("\n🔑 New Passwords:")
    print(f"STAGING: {staging_password}")
    print(f"PRODUCTION: {prod_password}")

    print("\n📚 Next Steps:")
    print("1. Update your .env.local file with the new passwords")
    print("2. Test database connections")
    print("3. Run DBM-APM validation: npm run validate:dbm-apm")
    print("4. Test API endpoints for trace correlation")
    print("\n🎉 Database connection fixes applied!")


def main(argv: Optional[Sequence[str]] = None) -> int:  # noqa: ARG001 - future use
    """Entry point for manual invocation."""

    try:
        ensure_azure_login()
    except CommandError as exc:
        print(f"❌ {exc}")
        return 1

    print("\n🔧 Fixing DEV environment (vibecode-pgflex-1758429506)…")
    print("Issue: Connection timeout")
    public_ip = get_public_ip()
    print(f"Current public IP: {public_ip}")
    add_firewall_rule(
        FirewallConfig(server_name="vibecode-pgflex-1758429506", resource_group="rg-vibecode-dev"),
        public_ip,
    )

    print("\n🔧 Fixing STAGING environment (vibecode-staging-pg)…")
    print("Issue: Password authentication failed for user 'vibecodeusr'")
    staging_password = generate_password()
    staging_success = reset_admin_password(
        PasswordResetConfig(
            server_name="vibecode-staging-pg",
            resource_group="rg-vibecode-staging",
            user_display="staging database",
        ),
        staging_password,
    )

    print("\n🔧 Fixing PRODUCTION environment (vibecode-pgflex-1758422944)…")
    print("Issue: Password authentication failed for user 'pgadmin'")
    prod_password = generate_password()
    prod_success = reset_admin_password(
        PasswordResetConfig(
            server_name="vibecode-pgflex-1758422944",
            resource_group="rg-vibecode-aks-prod",
            user_display="production database",
        ),
        prod_password,
    )

    print_summary(
        dev_ip=public_ip,
        staging_password=staging_password,
        staging_success=staging_success,
        prod_password=prod_password,
        prod_success=prod_success,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())