#!/usr/bin/env python3
"""Migrate secrets from .env files into the macOS Keychain."""
from __future__ import annotations

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


def migrate_secrets(env_path: Path, values: Dict[str, str], migrator: KeychainMigrator) -> None:
    color_print(BLUE, "📦 Migrating secrets to Keychain...\n")
    migrated = 0
    failed = 0
    for secret in SECRETS:
        value = values.get(secret) or os.getenv(secret)
        if not value:
            color_print(YELLOW, f"  ⏭️  {secret} (not set, skipping)")
            continue
        if migrator.store_secret(secret, value):
            migrated += 1
            color_print(GREEN, f"  ✅ {secret}")
        else:
            failed += 1
            color_print(RED, f"  ❌ {secret} (failed)")
    print("\n" + BLUE + "========================================" + NC)
    color_print(GREEN, "✅ Migration complete!")
    print(f"   Migrated: {migrated}")
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
    values = parse_env_file(env_path)
    migrator = KeychainMigrator(service=args.service, access_group=access_group)
    migrate_secrets(env_path, values, migrator)
    maybe_backup_env(env_path)
    color_print(GREEN, "✅ Secret migration complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
