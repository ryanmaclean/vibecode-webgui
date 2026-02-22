#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "check-expiration"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "security"})
    _dd_patch()
except ImportError:
    pass


try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from scripts.lib.log_aggregation import get_log_aggregation
    log_agg = get_log_aggregation()
except ImportError:
    log_agg = None

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Secret Expiration Checker Script

Audits secret health by checking expiration status and rotation policies.
Queries the database for secret metadata and provides actionable alerts.

Usage:
    python check_expiration.py
    python check_expiration.py --days 30
    python check_expiration.py --format json
    python check_expiration.py --status expired
    python check_expiration.py --ci
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'


class Severity(Enum):
    """Alert severity levels."""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"
    OK = "ok"


@dataclass
class SecretStatus:
    """Status information for a secret."""
    key_name: str
    status: str
    expires_at: Optional[datetime]
    last_rotated_at: Optional[datetime]
    rotation_policy: Optional[str]
    created_at: datetime
    days_until_expiration: Optional[int]
    severity: Severity
    message: str
    recommendations: List[str] = field(default_factory=list)


@dataclass
class ExpirationSummary:
    """Summary of all secrets expiration status."""
    total_secrets: int
    expired: int
    expiring_soon: int
    no_expiration: int
    active: int
    critical_alerts: int
    warning_alerts: int
    info_alerts: int
    secrets: List[SecretStatus]


def color_print(color: str, message: str, use_color: bool = True) -> None:
    """Print a colored message."""
    if use_color:
        print(f"{color}{message}{Color.NC}")
    else:
        print(message)


def get_severity_color(severity: Severity) -> str:
    """Get color for severity level."""
    return {
        Severity.CRITICAL: Color.RED,
        Severity.WARNING: Color.YELLOW,
        Severity.INFO: Color.CYAN,
        Severity.OK: Color.GREEN,
    }[severity]


def determine_severity(days_until_expiration: Optional[int], status: str) -> Severity:
    """Determine severity based on expiration timeline."""
    if status == "expired" or (days_until_expiration is not None and days_until_expiration <= 0):
        return Severity.CRITICAL

    if days_until_expiration is None:
        return Severity.OK

    if days_until_expiration <= 1:
        return Severity.CRITICAL
    elif days_until_expiration <= 7:
        return Severity.CRITICAL
    elif days_until_expiration <= 14:
        return Severity.WARNING
    elif days_until_expiration <= 30:
        return Severity.INFO

    return Severity.OK


def get_recommendations(secret: SecretStatus) -> List[str]:
    """Generate recommendations for secret rotation."""
    recommendations = []

    if secret.severity == Severity.CRITICAL:
        recommendations.append("🚨 URGENT: Rotate this secret immediately")
        if secret.rotation_policy:
            recommendations.append(f"   Use rotation policy: {secret.rotation_policy}")
        recommendations.append("   Run: python scripts/security/rotate_secrets.py --secret-name " + secret.key_name)
    elif secret.severity == Severity.WARNING:
        recommendations.append("⚠️  Schedule rotation soon")
        recommendations.append("   Run: python scripts/security/rotate_secrets.py --secret-name " + secret.key_name + " --dry-run")
    elif secret.severity == Severity.INFO:
        recommendations.append("ℹ️  Plan rotation within your rotation window")

    if not secret.rotation_policy:
        recommendations.append("⚙️  Consider setting a rotation policy for this secret")

    if not secret.expires_at:
        recommendations.append("📅 Consider setting an expiration date for better security hygiene")

    return recommendations


def connect_to_database() -> Optional[object]:
    """Connect to the PostgreSQL database using DATABASE_URL."""
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        color_print(Color.RED, "❌ Error: DATABASE_URL environment variable not set")
        color_print(Color.YELLOW, "   Set DATABASE_URL to your PostgreSQL connection string")
        return None

    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
        return conn
    except ImportError:
        color_print(Color.RED, "❌ Error: psycopg2 not installed")
        color_print(Color.YELLOW, "   Install with: pip install psycopg2-binary")
        return None
    except Exception as e:
        color_print(Color.RED, f"❌ Error connecting to database: {e}")
        return None


def fetch_secrets(conn: object, status_filter: Optional[str] = None) -> List[Dict]:
    """Fetch secrets from the database."""
    try:
        cursor = conn.cursor()

        query = """
            SELECT
                key_name,
                status,
                expires_at,
                last_rotated_at,
                rotation_policy,
                created_at
            FROM secret_metadata
        """

        if status_filter:
            query += " WHERE status = %s"
            cursor.execute(query, (status_filter,))
        else:
            cursor.execute(query)

        secrets = cursor.fetchall()
        cursor.close()

        return [dict(secret) for secret in secrets]
    except Exception as e:
        color_print(Color.RED, f"❌ Error fetching secrets: {e}")
        return []


def analyze_secret(secret_data: Dict, threshold_days: int) -> SecretStatus:
    """Analyze a single secret's expiration status."""
    now = datetime.now(timezone.utc)
    expires_at = secret_data.get("expires_at")

    # Convert expires_at to timezone-aware datetime if needed
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    days_until_expiration = None
    if expires_at:
        delta = expires_at - now
        days_until_expiration = delta.days

    status = secret_data.get("status", "active")
    severity = determine_severity(days_until_expiration, status)

    # Generate message
    if status == "expired":
        message = "🔴 EXPIRED"
    elif days_until_expiration is not None:
        if days_until_expiration <= 0:
            message = "🔴 EXPIRED"
        elif days_until_expiration <= 1:
            message = f"🔴 Expires in {days_until_expiration} day"
        elif days_until_expiration <= 7:
            message = f"🔴 Expires in {days_until_expiration} days"
        elif days_until_expiration <= 14:
            message = f"🟡 Expires in {days_until_expiration} days"
        elif days_until_expiration <= threshold_days:
            message = f"🔵 Expires in {days_until_expiration} days"
        else:
            message = f"✅ Expires in {days_until_expiration} days"
    else:
        message = "ℹ️  No expiration set"

    secret_status = SecretStatus(
        key_name=secret_data["key_name"],
        status=status,
        expires_at=expires_at,
        last_rotated_at=secret_data.get("last_rotated_at"),
        rotation_policy=secret_data.get("rotation_policy"),
        created_at=secret_data["created_at"],
        days_until_expiration=days_until_expiration,
        severity=severity,
        message=message,
    )

    secret_status.recommendations = get_recommendations(secret_status)

    return secret_status


def generate_summary(secrets: List[SecretStatus]) -> ExpirationSummary:
    """Generate summary statistics."""
    summary = ExpirationSummary(
        total_secrets=len(secrets),
        expired=0,
        expiring_soon=0,
        no_expiration=0,
        active=0,
        critical_alerts=0,
        warning_alerts=0,
        info_alerts=0,
        secrets=secrets,
    )

    for secret in secrets:
        if secret.severity == Severity.CRITICAL:
            summary.critical_alerts += 1
            if secret.status == "expired" or (secret.days_until_expiration is not None and secret.days_until_expiration <= 0):
                summary.expired += 1
            else:
                summary.expiring_soon += 1
        elif secret.severity == Severity.WARNING:
            summary.warning_alerts += 1
            summary.expiring_soon += 1
        elif secret.severity == Severity.INFO:
            summary.info_alerts += 1
            summary.expiring_soon += 1
        elif secret.severity == Severity.OK:
            if secret.expires_at:
                summary.active += 1
            else:
                summary.no_expiration += 1

    return summary


def print_summary(summary: ExpirationSummary, use_color: bool = True) -> None:
    """Print summary in human-readable format."""
    print()
    color_print(Color.BLUE, "🔍 Secret Expiration Summary", use_color)
    print("=" * 60)

    print(f"Total Secrets: {summary.total_secrets}")

    if summary.expired > 0:
        color_print(Color.RED, f"  ❌ Expired: {summary.expired}", use_color)
    else:
        print(f"  ✅ Expired: {summary.expired}")

    if summary.expiring_soon > 0:
        color_print(Color.YELLOW, f"  ⚠️  Expiring Soon: {summary.expiring_soon}", use_color)
    else:
        print(f"  ✅ Expiring Soon: {summary.expiring_soon}")

    print(f"  ℹ️  No Expiration: {summary.no_expiration}")
    print(f"  ✅ Active: {summary.active}")

    print()
    print("Alerts by Severity:")
    if summary.critical_alerts > 0:
        color_print(Color.RED, f"  🔴 Critical: {summary.critical_alerts}", use_color)
    else:
        print(f"  ✅ Critical: {summary.critical_alerts}")

    if summary.warning_alerts > 0:
        color_print(Color.YELLOW, f"  🟡 Warning: {summary.warning_alerts}", use_color)
    else:
        print(f"  ✅ Warning: {summary.warning_alerts}")

    print(f"  🔵 Info: {summary.info_alerts}")
    print("=" * 60)
    print()


def print_secrets(secrets: List[SecretStatus], use_color: bool = True, show_recommendations: bool = True) -> None:
    """Print detailed secret information."""
    if not secrets:
        color_print(Color.GREEN, "✅ No secrets to display", use_color)
        return

    for secret in secrets:
        severity_color = get_severity_color(secret.severity)

        print()
        color_print(severity_color, f"Secret: {secret.key_name}", use_color)
        print(f"  Status: {secret.status}")
        print(f"  {secret.message}")

        if secret.expires_at:
            print(f"  Expires: {secret.expires_at.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        else:
            print(f"  Expires: No expiration set")

        if secret.last_rotated_at:
            print(f"  Last Rotated: {secret.last_rotated_at.strftime('%Y-%m-%d %H:%M:%S %Z')}")

        if secret.rotation_policy:
            print(f"  Rotation Policy: {secret.rotation_policy}")

        if show_recommendations and secret.recommendations:
            print("  Recommendations:")
            for rec in secret.recommendations:
                print(f"    {rec}")


def print_json(summary: ExpirationSummary) -> None:
    """Print summary in JSON format."""
    data = {
        "summary": {
            "total_secrets": summary.total_secrets,
            "expired": summary.expired,
            "expiring_soon": summary.expiring_soon,
            "no_expiration": summary.no_expiration,
            "active": summary.active,
            "critical_alerts": summary.critical_alerts,
            "warning_alerts": summary.warning_alerts,
            "info_alerts": summary.info_alerts,
        },
        "secrets": [
            {
                "key_name": secret.key_name,
                "status": secret.status,
                "expires_at": secret.expires_at.isoformat() if secret.expires_at else None,
                "last_rotated_at": secret.last_rotated_at.isoformat() if secret.last_rotated_at else None,
                "rotation_policy": secret.rotation_policy,
                "days_until_expiration": secret.days_until_expiration,
                "severity": secret.severity.value,
                "message": secret.message,
                "recommendations": secret.recommendations,
            }
            for secret in summary.secrets
        ],
    }

    print(json.dumps(data, indent=2))


def determine_exit_code(summary: ExpirationSummary, ci_mode: bool) -> int:
    """Determine exit code based on summary and mode."""
    if not ci_mode:
        return 0

    # In CI mode, exit with error code if there are issues
    if summary.expired > 0:
        return 2  # Critical: expired secrets exist

    if summary.critical_alerts > 0:
        return 2  # Critical: secrets expiring very soon

    if summary.warning_alerts > 0:
        return 1  # Warning: secrets expiring soon

    return 0  # All good


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Check secret expiration status and rotation policies",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check all secrets
  python check_expiration.py

  # Check secrets expiring within 60 days
  python check_expiration.py --days 60

  # Output as JSON
  python check_expiration.py --format json

  # Filter by status
  python check_expiration.py --status expired

  # CI mode (exits with error code if issues found)
  python check_expiration.py --ci

  # No colors (for logging to files)
  python check_expiration.py --no-color
        """,
    )

    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Threshold for 'expiring soon' in days (default: 30)",
    )

    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)",
    )

    parser.add_argument(
        "--status",
        choices=["active", "expired", "rotating", "revoked"],
        help="Filter by secret status",
    )

    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI mode: exit with non-zero code if issues found",
    )

    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    parser.add_argument(
        "--no-recommendations",
        action="store_true",
        help="Hide recommendations",
    )

    args = parser.parse_args()

    use_color = not args.no_color and sys.stdout.isatty()

    # Connect to database
    conn = connect_to_database()
    if not conn:
        sys.exit(3)  # Database connection error

    try:
        # Fetch secrets
        secret_data = fetch_secrets(conn, args.status)

        if not secret_data:
            if args.format == "json":
                print(json.dumps({"summary": {"total_secrets": 0}, "secrets": []}))
            else:
                color_print(Color.YELLOW, "⚠️  No secrets found in database", use_color)
                color_print(Color.CYAN, "   Run migration to create secret_metadata table", use_color)
            sys.exit(0)

        # Analyze secrets
        secrets = [analyze_secret(data, args.days) for data in secret_data]

        # Sort by severity (critical first)
        severity_order = {
            Severity.CRITICAL: 0,
            Severity.WARNING: 1,
            Severity.INFO: 2,
            Severity.OK: 3,
        }
        secrets.sort(key=lambda s: (severity_order[s.severity], s.days_until_expiration if s.days_until_expiration is not None else 999999))

        # Generate summary
        summary = generate_summary(secrets)

        # Output
        if args.format == "json":
            print_json(summary)
        else:
            print_summary(summary, use_color)
            print_secrets(secrets, use_color, not args.no_recommendations)

        # Determine exit code
        exit_code = determine_exit_code(summary, args.ci)

        if args.ci and exit_code != 0:
            print()
            if exit_code == 2:
                color_print(Color.RED, "❌ CI Check Failed: Critical issues found", use_color)
            elif exit_code == 1:
                color_print(Color.YELLOW, "⚠️  CI Check Warning: Issues found", use_color)

        sys.exit(exit_code)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
