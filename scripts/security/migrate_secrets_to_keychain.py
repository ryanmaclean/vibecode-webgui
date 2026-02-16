from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "migrate-secrets-to-keychain"
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


"""Migrate secrets from .env files into the macOS Keychain."""

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

# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import platform
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

BLUE = "\033[0;34m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"

KEYCHAIN_SERVICE = "com.vibecode.secrets"
SECRETS = [
    "NEXTAUTH_SECRET",
    "DATABASE_URL",
    "POSTGRES_URL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "CLAUDE_API_KEY",
    "DATADOG_API_KEY",
    "DD_API_KEY",
    "DD_APP_KEY",
    "GITHUB_SECRET",
    "GOOGLE_CLIENT_SECRET",
    "JWT_SECRET",
    "SESSION_SECRET",
    "REDIS_PASSWORD",
    "AZURE_OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
]

ENV_TEMPLATE = """# VibeCode Environment Configuration
# Secrets migrated to macOS Keychain - see scripts/security/migrate_secrets_to_keychain.py

# Runtime Configuration
NODE_ENV=development
BASE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
PORT=3000

# Database (non-sensitive)
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis (non-sensitive)
REDIS_HOST=localhost
REDIS_PORT=6379

# Monitoring
ENABLE_MONITORING=true
DD_ENV=development
DD_SERVICE=vibecode-webgui

# Note: Sensitive values loaded from Keychain
# To retrieve: loadSecret('NEXTAUTH_SECRET')
"""


def color_print(color: str, message: str) -> None:
    print(f"{color}{message}{NC}")


@dataclass
class KeychainMigrator:
    service: str
    access_group: Optional[str] = None

    def _run_security(self, *args: str, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess[str]:
        command = ["security", *args]
        return subprocess.run(
            command,
            check=check,
            capture_output=capture,
            text=True,
        )

    def store_secret(self, key: str, value: str) -> bool:
        delete_args = ["delete-generic-password", "-s", self.service, "-a", key]
        self._run_security(*delete_args, check=False)
        add_args = [
            "add-generic-password",
            "-s",
            self.service,
            "-a",
            key,
            "-w",
            value,
            "-T",
            "",
        ]
        if self.access_group:
            add_args.extend(["-G", self.access_group])
        try:
            self._run_security(*add_args)
            return True
        except subprocess.CalledProcessError:
            return False

    def read_secret(self, key: str) -> Optional[str]:
        args = [
            "find-generic-password",
            "-s",
            self.service,
            "-a",
            key,
            "-w",
        ]
        try:
            completed = self._run_security(*args, capture=True)
        except subprocess.CalledProcessError:
            return None
        return completed.stdout.strip()


def ensure_macos() -> None:
    if platform.system() != "Darwin":
        color_print(RED, "❌ Error: This script only runs on macOS")
        sys.exit(1)
    if shutil.which("security") is None:
        color_print(RED, "❌ Error: 'security' command not found")
        sys.exit(1)


def connect_to_database() -> Optional[object]:
    """Connect to the PostgreSQL database using DATABASE_URL."""
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        color_print(YELLOW, "⚠️  Warning: DATABASE_URL not set, skipping database registration")
        color_print(YELLOW, "   Secrets will be stored in Keychain but not tracked in database")
        return None

    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
        return conn
    except ImportError:
        color_print(YELLOW, "⚠️  Warning: psycopg2 not installed, skipping database registration")
        color_print(YELLOW, "   Install with: pip install psycopg2-binary")
        return None
    except Exception as e:
        color_print(YELLOW, f"⚠️  Warning: Could not connect to database: {e}")
        color_print(YELLOW, "   Secrets will be stored in Keychain but not tracked in database")
        return None


# Rotation policies with their default expiration periods (in days)
ROTATION_POLICIES = {
    "api_keys": 90,
    "auth_tokens": 30,
    "db_credentials": 180,
    "monitoring": 90,
    "custom": 90,
}


def infer_policy_from_key_name(key_name: str) -> str:
    """
    Infer the rotation policy based on the secret's key name.

    Args:
        key_name: The name of the secret key

    Returns:
        Policy name (api_keys, auth_tokens, db_credentials, monitoring, or custom)
    """
    key_lower = key_name.lower()

    # API Keys
    if (
        "api_key" in key_lower
        or "apikey" in key_lower
        or key_lower.endswith("_key")
    ):
        return "api_keys"

    # Auth tokens
    if (
        "token" in key_lower
        or "secret" in key_lower
        or "oauth" in key_lower
        or "jwt" in key_lower
    ):
        return "auth_tokens"

    # Database credentials
    if (
        "database" in key_lower
        or "db_" in key_lower
        or "postgres" in key_lower
        or "mysql" in key_lower
        or "mongo" in key_lower
        or "connection_string" in key_lower
    ):
        return "db_credentials"

    # Monitoring
    if "dd_" in key_lower or "datadog" in key_lower:
        return "monitoring"

    # Default to custom
    return "custom"


def register_secret_in_database(
    conn: object,
    key_name: str,
    policy_name: str,
) -> bool:
    """
    Register a secret in the database with metadata tracking.

    Args:
        conn: Database connection
        key_name: Name of the secret
        policy_name: Rotation policy to apply

    Returns:
        True if successful, False otherwise
    """
    try:
        import json
        from datetime import datetime, timedelta, timezone

        cursor = conn.cursor()

        # Calculate expiration date
        days = ROTATION_POLICIES.get(policy_name, 90)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=days)

        # Check if secret already exists
        check_query = "SELECT id FROM secret_metadata WHERE key_name = %s"
        cursor.execute(check_query, (key_name,))
        existing = cursor.fetchone()

        if existing:
            # Update existing record
            update_query = """
                UPDATE secret_metadata
                SET rotation_policy = %s,
                    expires_at = %s,
                    status = 'active',
                    last_rotated_at = %s,
                    metadata = %s,
                    updated_at = %s
                WHERE key_name = %s
            """
            metadata = json.dumps({
                "migrated_at": now.isoformat(),
                "migration_source": "migrate_secrets_to_keychain.py",
            })
            cursor.execute(update_query, (
                policy_name,
                expires_at,
                now,
                metadata,
                now,
                key_name,
            ))
        else:
            # Insert new record
            insert_query = """
                INSERT INTO secret_metadata (
                    key_name,
                    rotation_policy,
                    expires_at,
                    status,
                    last_rotated_at,
                    metadata,
                    created_at,
                    updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            metadata = json.dumps({
                "migrated_at": now.isoformat(),
                "migration_source": "migrate_secrets_to_keychain.py",
            })
            cursor.execute(insert_query, (
                key_name,
                policy_name,
                expires_at,
                "active",
                now,
                metadata,
                now,
                now,
            ))

        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        color_print(YELLOW, f"⚠️  Warning: Could not register {key_name} in database: {e}")
        return False


def detect_env_file(explicit: Optional[str]) -> Path:
    if explicit:
        path = Path(explicit)
        if not path.exists():
            raise FileNotFoundError(f"Environment file not found: {path}")
        return path
    for candidate in (Path(".env.local"), Path(".env")):
        if candidate.exists():
            return candidate
    raise FileNotFoundError("No .env.local or .env file found")


def strip_inline_comment(value: str) -> str:
    result: list[str] = []
    in_single = False
    in_double = False
    for char in value:
        if char == "'" and not in_double:
            in_single = not in_single
        elif char == '"' and not in_single:
            in_double = not in_double
        if char == "#" and not in_single and not in_double:
            return "".join(result).rstrip()
        result.append(char)
    return "".join(result).strip()


def parse_env_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    with path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):]
            if "=" not in line:
                continue
            key, raw_value = line.split("=", 1)
            key = key.strip()
            value = strip_inline_comment(raw_value.strip())
            if value.startswith("\"") and value.endswith("\"") and len(value) >= 2:
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'") and len(value) >= 2:
                value = value[1:-1]
            values[key] = value
    return values


def migrate_secrets(env_path: Path, values: Dict[str, str], migrator: KeychainMigrator, db_conn: Optional[object] = None) -> None:
    color_print(BLUE, "📦 Migrating secrets to Keychain...\n")
    migrated = 0
    failed = 0
    db_registered = 0
    for secret in SECRETS:
        value = values.get(secret) or os.getenv(secret)
        if not value:
            color_print(YELLOW, f"  ⏭️  {secret} (not set, skipping)")
            continue
        if migrator.store_secret(secret, value):
            migrated += 1
            policy = infer_policy_from_key_name(secret)
            color_print(GREEN, f"  ✅ {secret} (policy: {policy})")

            # Register in database if connection available
            if db_conn:
                if register_secret_in_database(db_conn, secret, policy):
                    db_registered += 1
        else:
            failed += 1
            color_print(RED, f"  ❌ {secret} (failed)")
    print("\n" + BLUE + "========================================" + NC)
    color_print(GREEN, "✅ Migration complete!")
    print(f"   Migrated: {migrated}")
    if db_conn:
        print(f"   Registered in DB: {db_registered}")
    if failed:
        color_print(RED, f"   Failed: {failed}")
    print(BLUE + "========================================" + NC + "\n")

    color_print(BLUE, "🔍 Verifying Keychain storage...\n")
    verified = 0
    for secret in SECRETS:
        value = values.get(secret) or os.getenv(secret)
        if not value:
            continue
        stored = migrator.read_secret(secret)
        if stored == value:
            verified += 1
            color_print(GREEN, f"  ✅ {secret} verified")
        else:
            color_print(RED, f"  ❌ {secret} verification failed")
    print(f"\n{BLUE}========================================{NC}")
    color_print(GREEN, "✅ Verification complete!")
    print(f"   Verified: {verified}")
    print(f"{BLUE}========================================{NC}\n")

    color_print(YELLOW, "⚠️  Security Reminders:")
    print("   1. Secrets are now stored in macOS Keychain")
    print("   2. FileVault encryption protects Keychain at rest")
    print("   3. On Apple Silicon Macs, Secure Enclave provides additional protection")
    print(f"   4. Consider removing secrets from {env_path} after migration")
    print("   5. Update application code to use Keychain loader: import { loadSecret } from '@/lib/security/macos-keychain'\n")


def maybe_backup_env(env_path: Path) -> None:
    response = input(f"{YELLOW}Would you like to backup and clear secrets from {env_path}? (y/N){NC} ")
    if response.strip().lower() != "y":
        return
    timestamp = int(time.time())
    backup_path = env_path.with_suffix(env_path.suffix + f".backup-{timestamp}")
    shutil.copy2(env_path, backup_path)
    color_print(GREEN, f"✅ Backed up to: {backup_path}")
    env_path.write_text(ENV_TEMPLATE, encoding="utf-8")
    color_print(GREEN, f"✅ Created new {env_path} without secrets")
    color_print(YELLOW, f"   Original file backed up to: {backup_path}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate secrets from .env files into macOS Keychain")
    parser.add_argument("--env-file", help="Custom env file path", dest="env_file")
    parser.add_argument(
        "--service",
        default=KEYCHAIN_SERVICE,
        help="Keychain service name",
    )
    parser.add_argument(
        "--access-group",
        default=os.getenv("TEAM_ID"),
        help="Optional Keychain access group (TEAM_ID.com.vibecode.shared)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    ensure_macos()
    args = parse_args(argv)
    access_group = None
    if args.access_group:
        access_group = f"{args.access_group}.com.vibecode.shared" if not args.access_group.endswith(".com.vibecode.shared") else args.access_group
    color_print(BLUE, "========================================")
    color_print(BLUE, "  VibeCode Secret Migration to Keychain")
    color_print(BLUE, "  Agent 24: macOS Security Engineer    ")
    color_print(BLUE, "========================================\n")
    try:
        env_path = detect_env_file(args.env_file)
    except FileNotFoundError as exc:
        color_print(RED, f"❌ {exc}")
        return 1
    color_print(GREEN, f"✅ Found environment file: {env_path}")

    # Connect to database for secret tracking
    db_conn = connect_to_database()
    if db_conn:
        color_print(GREEN, "✅ Connected to database for secret tracking\n")
    else:
        print()  # Add spacing

    values = parse_env_file(env_path)
    migrator = KeychainMigrator(service=args.service, access_group=access_group)

    try:
        migrate_secrets(env_path, values, migrator, db_conn)
        maybe_backup_env(env_path)
        color_print(GREEN, "✅ Secret migration complete!")
        return 0
    finally:
        # Close database connection if it was opened
        if db_conn:
            try:
                db_conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())