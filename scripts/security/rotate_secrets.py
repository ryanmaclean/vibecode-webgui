#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "rotate-secrets"
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
Secret Rotation Script

Automates the rotation of secrets stored in macOS Keychain with database tracking.
Supports manual rotation, batch rotation, and dry-run mode.

Usage:
    python rotate_secrets.py --secret-name GITHUB_TOKEN
    python rotate_secrets.py --secret-name OPENAI_API_KEY --dry-run
    python rotate_secrets.py --all --dry-run
    python rotate_secrets.py --secret-name DATABASE_URL --new-value "postgres://..."
"""

import argparse
import json
import os
import platform
import secrets
import shutil
import string
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'


KEYCHAIN_SERVICE = "com.vibecode.secrets"

# Rotation policies with their default expiration periods (in days)
ROTATION_POLICIES = {
    "api_keys": 90,
    "auth_tokens": 30,
    "db_credentials": 180,
    "monitoring": 90,
    "custom": 90,
}


@dataclass
class SecretInfo:
    """Information about a secret from the database."""
    id: int
    key_name: str
    expires_at: Optional[datetime]
    last_rotated_at: Optional[datetime]
    rotation_policy: Optional[str]
    status: str
    metadata: Optional[Dict]


@dataclass
class RotationResult:
    """Result of a secret rotation operation."""
    success: bool
    key_name: str
    message: str
    new_expires_at: Optional[datetime] = None
    old_expires_at: Optional[datetime] = None
    dry_run: bool = False


def color_print(color: str, message: str, use_color: bool = True) -> None:
    """Print a colored message."""
    if use_color:
        print(f"{color}{message}{Color.NC}")
    else:
        print(message)


def ensure_macos() -> None:
    """Ensure script is running on macOS."""
    if platform.system() != "Darwin":
        color_print(Color.RED, "❌ Error: This script only runs on macOS")
        sys.exit(1)
    if shutil.which("security") is None:
        color_print(Color.RED, "❌ Error: 'security' command not found")
        sys.exit(1)


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


def fetch_secret_info(conn: object, key_name: str) -> Optional[SecretInfo]:
    """Fetch secret information from the database."""
    try:
        cursor = conn.cursor()
        query = """
            SELECT id, key_name, expires_at, last_rotated_at, rotation_policy, status, metadata
            FROM secret_metadata
            WHERE key_name = %s
        """
        cursor.execute(query, (key_name,))
        result = cursor.fetchone()
        cursor.close()

        if not result:
            return None

        return SecretInfo(
            id=result["id"],
            key_name=result["key_name"],
            expires_at=result["expires_at"],
            last_rotated_at=result["last_rotated_at"],
            rotation_policy=result["rotation_policy"],
            status=result["status"],
            metadata=result["metadata"],
        )
    except Exception as e:
        color_print(Color.RED, f"❌ Error fetching secret info: {e}")
        return None


def fetch_all_secrets(conn: object, include_no_policy: bool = False) -> List[SecretInfo]:
    """Fetch all secrets that are eligible for rotation."""
    try:
        cursor = conn.cursor()

        if include_no_policy:
            query = """
                SELECT id, key_name, expires_at, last_rotated_at, rotation_policy, status, metadata
                FROM secret_metadata
                WHERE status = 'active' OR status = 'expired'
                ORDER BY expires_at ASC NULLS LAST
            """
            cursor.execute(query)
        else:
            query = """
                SELECT id, key_name, expires_at, last_rotated_at, rotation_policy, status, metadata
                FROM secret_metadata
                WHERE (status = 'active' OR status = 'expired')
                  AND rotation_policy IS NOT NULL
                ORDER BY expires_at ASC NULLS LAST
            """
            cursor.execute(query)

        results = cursor.fetchall()
        cursor.close()

        secrets = []
        for row in results:
            secrets.append(SecretInfo(
                id=row["id"],
                key_name=row["key_name"],
                expires_at=row["expires_at"],
                last_rotated_at=row["last_rotated_at"],
                rotation_policy=row["rotation_policy"],
                status=row["status"],
                metadata=row["metadata"],
            ))

        return secrets
    except Exception as e:
        color_print(Color.RED, f"❌ Error fetching secrets: {e}")
        return []


def generate_secret_value(secret_type: str = "default", length: int = 64) -> str:
    """
    Generate a secure random secret value.

    Args:
        secret_type: Type of secret (api_key, password, token, etc.)
        length: Length of the generated secret

    Returns:
        Securely generated random string
    """
    # Use uppercase, lowercase, and digits for most secrets
    alphabet = string.ascii_letters + string.digits

    # For certain types, include special characters
    if secret_type in ["password", "db_credentials"]:
        alphabet += "!@#$%^&*()-_=+"

    # Generate cryptographically secure random string
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def read_keychain_secret(key_name: str) -> Optional[str]:
    """Read a secret from macOS Keychain."""
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", key_name, "-w"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def update_keychain_secret(key_name: str, new_value: str, metadata: Optional[Dict] = None) -> bool:
    """Update a secret in macOS Keychain."""
    try:
        # Delete existing entry
        subprocess.run(
            ["security", "delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", key_name],
            capture_output=True,
            check=False,
        )

        # Add new entry
        args = [
            "security",
            "add-generic-password",
            "-s", KEYCHAIN_SERVICE,
            "-a", key_name,
            "-w", new_value,
            "-T", "",
        ]

        # Add metadata as comment if provided
        if metadata:
            comment = json.dumps(metadata)
            args.extend(["-j", comment])

        subprocess.run(args, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        color_print(Color.RED, f"❌ Error updating keychain: {e}")
        return False


def calculate_new_expiration(rotation_policy: Optional[str]) -> Optional[datetime]:
    """Calculate new expiration date based on rotation policy."""
    if not rotation_policy:
        return None

    # Get days from rotation policy
    days = ROTATION_POLICIES.get(rotation_policy, 90)

    # Calculate new expiration
    now = datetime.now(timezone.utc)
    return now + timedelta(days=days)


def update_secret_metadata(
    conn: object,
    secret_id: int,
    new_expires_at: Optional[datetime],
    rotated_by: str = "manual",
) -> bool:
    """Update secret metadata in the database after rotation."""
    try:
        cursor = conn.cursor()
        now = datetime.now(timezone.utc)

        query = """
            UPDATE secret_metadata
            SET last_rotated_at = %s,
                expires_at = %s,
                status = 'active'
            WHERE id = %s
        """
        cursor.execute(query, (now, new_expires_at, secret_id))
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        color_print(Color.RED, f"❌ Error updating secret metadata: {e}")
        conn.rollback()
        return False


def record_rotation_history(
    conn: object,
    secret_id: int,
    old_expires_at: Optional[datetime],
    new_expires_at: Optional[datetime],
    reason: str = "manual",
    rotated_by: str = "manual",
) -> bool:
    """Record rotation in the history table."""
    try:
        cursor = conn.cursor()

        query = """
            INSERT INTO secret_rotation_history
                (secret_id, rotated_by, previous_expires_at, new_expires_at, reason, metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        metadata = {
            "rotation_method": "cli_script",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        cursor.execute(
            query,
            (secret_id, rotated_by, old_expires_at, new_expires_at, reason, json.dumps(metadata))
        )
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        color_print(Color.RED, f"❌ Error recording rotation history: {e}")
        conn.rollback()
        return False


def rotate_secret(
    conn: object,
    secret: SecretInfo,
    new_value: Optional[str] = None,
    dry_run: bool = False,
    reason: str = "manual",
    rotated_by: str = "manual",
    use_color: bool = True,
) -> RotationResult:
    """
    Rotate a single secret.

    Args:
        conn: Database connection
        secret: Secret information
        new_value: New secret value (if None, will be auto-generated)
        dry_run: If True, simulate rotation without making changes
        reason: Reason for rotation
        rotated_by: Identifier of who/what initiated rotation
        use_color: Whether to use colored output

    Returns:
        RotationResult with success status and details
    """
    color_print(Color.BLUE, f"\n🔄 Processing: {secret.key_name}", use_color)

    # Check if secret has a rotation policy
    if not secret.rotation_policy:
        msg = f"⚠️  Skipping {secret.key_name}: No rotation policy defined"
        color_print(Color.YELLOW, msg, use_color)
        return RotationResult(
            success=False,
            key_name=secret.key_name,
            message="No rotation policy defined",
            dry_run=dry_run,
        )

    # Check rotation policy cooldown (don't rotate if rotated within last 24 hours)
    if secret.last_rotated_at:
        last_rotated = secret.last_rotated_at
        if last_rotated.tzinfo is None:
            last_rotated = last_rotated.replace(tzinfo=timezone.utc)

        hours_since_rotation = (datetime.now(timezone.utc) - last_rotated).total_seconds() / 3600

        if hours_since_rotation < 24 and not dry_run:
            msg = f"⏳ Skipping {secret.key_name}: Rotated {hours_since_rotation:.1f} hours ago (24h cooldown)"
            color_print(Color.YELLOW, msg, use_color)
            return RotationResult(
                success=False,
                key_name=secret.key_name,
                message=f"Cooldown period (rotated {hours_since_rotation:.1f}h ago)",
                dry_run=dry_run,
            )

    # Determine new secret value
    if new_value is None:
        # Auto-generate based on secret type
        secret_type = secret.rotation_policy.split('_')[0] if secret.rotation_policy else "default"
        new_value = generate_secret_value(secret_type, length=64)
        print(f"   Generated new secret value: {new_value[:8]}... (hidden)")
    else:
        print(f"   Using provided secret value")

    # Calculate new expiration
    new_expires_at = calculate_new_expiration(secret.rotation_policy)
    old_expires_at = secret.expires_at

    if dry_run:
        color_print(Color.CYAN, f"   [DRY RUN] Would rotate secret", use_color)
        print(f"   Old expiration: {old_expires_at.strftime('%Y-%m-%d %H:%M:%S %Z') if old_expires_at else 'None'}")
        print(f"   New expiration: {new_expires_at.strftime('%Y-%m-%d %H:%M:%S %Z') if new_expires_at else 'None'}")
        print(f"   Policy: {secret.rotation_policy}")
        print(f"   Reason: {reason}")

        return RotationResult(
            success=True,
            key_name=secret.key_name,
            message="Dry run successful - no changes made",
            new_expires_at=new_expires_at,
            old_expires_at=old_expires_at,
            dry_run=True,
        )

    # Perform actual rotation
    print(f"   Updating keychain...")

    # Prepare metadata for keychain
    keychain_metadata = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "expiresAt": new_expires_at.isoformat() if new_expires_at else None,
        "lastRotatedAt": datetime.now(timezone.utc).isoformat(),
        "rotationPolicy": secret.rotation_policy,
        "status": "active",
    }

    # Update keychain
    if not update_keychain_secret(secret.key_name, new_value, keychain_metadata):
        return RotationResult(
            success=False,
            key_name=secret.key_name,
            message="Failed to update keychain",
            dry_run=False,
        )

    print(f"   Updating database metadata...")

    # Update database metadata
    if not update_secret_metadata(conn, secret.id, new_expires_at, rotated_by):
        return RotationResult(
            success=False,
            key_name=secret.key_name,
            message="Failed to update database metadata",
            dry_run=False,
        )

    print(f"   Recording rotation history...")

    # Record in history
    if not record_rotation_history(conn, secret.id, old_expires_at, new_expires_at, reason, rotated_by):
        return RotationResult(
            success=False,
            key_name=secret.key_name,
            message="Failed to record rotation history",
            dry_run=False,
        )

    color_print(Color.GREEN, f"   ✅ Successfully rotated {secret.key_name}", use_color)
    print(f"   New expiration: {new_expires_at.strftime('%Y-%m-%d %H:%M:%S %Z') if new_expires_at else 'None'}")

    return RotationResult(
        success=True,
        key_name=secret.key_name,
        message="Rotation successful",
        new_expires_at=new_expires_at,
        old_expires_at=old_expires_at,
        dry_run=False,
    )


def print_summary(results: List[RotationResult], use_color: bool = True) -> None:
    """Print summary of rotation results."""
    print()
    color_print(Color.BLUE, "=" * 60, use_color)
    color_print(Color.BLUE, "🔄 Rotation Summary", use_color)
    color_print(Color.BLUE, "=" * 60, use_color)

    successful = [r for r in results if r.success]
    failed = [r for r in results if not r.success]
    dry_runs = [r for r in results if r.dry_run]

    print(f"Total processed: {len(results)}")

    if dry_runs:
        color_print(Color.CYAN, f"  Dry run simulations: {len(dry_runs)}", use_color)
    else:
        color_print(Color.GREEN, f"  ✅ Successful: {len(successful)}", use_color)
        if failed:
            color_print(Color.RED, f"  ❌ Failed: {len(failed)}", use_color)

    if failed and not dry_runs:
        print()
        color_print(Color.YELLOW, "Failed rotations:", use_color)
        for result in failed:
            print(f"  - {result.key_name}: {result.message}")

    print()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Rotate secrets in macOS Keychain with database tracking",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Rotate a single secret
  python rotate_secrets.py --secret-name GITHUB_TOKEN

  # Dry run to preview rotation
  python rotate_secrets.py --secret-name OPENAI_API_KEY --dry-run

  # Rotate all secrets with policies (dry run recommended first)
  python rotate_secrets.py --all --dry-run

  # Rotate with a specific new value
  python rotate_secrets.py --secret-name DATABASE_URL --new-value "postgres://..."

  # Rotate with an explicit allowed reason
  python rotate_secrets.py --secret-name API_KEY --reason emergency
        """,
    )

    parser.add_argument(
        "--secret-name",
        type=str,
        help="Name of the secret to rotate (e.g., GITHUB_TOKEN)",
    )

    parser.add_argument(
        "--all",
        action="store_true",
        help="Rotate all secrets with rotation policies",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate rotation without making changes",
    )

    parser.add_argument(
        "--new-value",
        type=str,
        help="Specific new value to use (otherwise auto-generated)",
    )

    valid_reasons = [
        "scheduled",
        "manual",
        "compromised",
        "expired",
        "policy_change",
        "emergency",
    ]

    parser.add_argument(
        "--reason",
        type=str,
        default="manual",
        choices=valid_reasons,
        help="Reason for rotation (allowed: scheduled, manual, compromised, expired, policy_change, emergency)",
    )

    parser.add_argument(
        "--rotated-by",
        type=str,
        default="manual",
        help="Identifier of who initiated rotation (default: manual)",
    )

    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output",
    )

    parser.add_argument(
        "--include-no-policy",
        action="store_true",
        help="Include secrets without rotation policies when using --all",
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.secret_name and not args.all:
        parser.error("Either --secret-name or --all must be specified")

    if args.secret_name and args.all:
        parser.error("Cannot specify both --secret-name and --all")

    if args.new_value and args.all:
        parser.error("Cannot specify --new-value with --all (only works with single secret)")

    use_color = not args.no_color and sys.stdout.isatty()

    # Ensure running on macOS
    ensure_macos()

    # Connect to database
    conn = connect_to_database()
    if not conn:
        sys.exit(1)

    try:
        results: List[RotationResult] = []

        if args.secret_name:
            # Rotate single secret
            color_print(Color.BLUE, f"🔍 Looking up secret: {args.secret_name}", use_color)

            secret = fetch_secret_info(conn, args.secret_name)
            if not secret:
                color_print(Color.RED, f"❌ Secret not found in database: {args.secret_name}", use_color)
                color_print(Color.YELLOW, "   Make sure the secret is registered in the database", use_color)
                sys.exit(1)

            result = rotate_secret(
                conn,
                secret,
                new_value=args.new_value,
                dry_run=args.dry_run,
                reason=args.reason,
                rotated_by=args.rotated_by,
                use_color=use_color,
            )
            results.append(result)

        elif args.all:
            # Rotate all secrets
            color_print(Color.BLUE, "🔍 Fetching all secrets with rotation policies...", use_color)

            secrets = fetch_all_secrets(conn, include_no_policy=args.include_no_policy)

            if not secrets:
                color_print(Color.YELLOW, "⚠️  No secrets found for rotation", use_color)
                color_print(Color.CYAN, "   Make sure secrets are registered with rotation policies", use_color)
                sys.exit(0)

            color_print(Color.CYAN, f"Found {len(secrets)} secret(s) to process", use_color)

            for secret in secrets:
                result = rotate_secret(
                    conn,
                    secret,
                    dry_run=args.dry_run,
                    reason=args.reason,
                    rotated_by=args.rotated_by,
                    use_color=use_color,
                )
                results.append(result)

        # Print summary
        print_summary(results, use_color)

        # Exit with appropriate code
        if args.dry_run:
            color_print(Color.CYAN, "✅ Dry run completed - no changes were made", use_color)
            sys.exit(0)

        failed_count = sum(1 for r in results if not r.success)
        if failed_count > 0:
            color_print(Color.RED, f"❌ Rotation completed with {failed_count} failure(s)", use_color)
            sys.exit(1)

        color_print(Color.GREEN, "✅ All rotations completed successfully", use_color)
        sys.exit(0)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
