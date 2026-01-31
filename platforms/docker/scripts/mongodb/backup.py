#!/usr/bin/env python3
"""
MongoDB Backup Script

Creates backups of the MongoDB database for VibeCode Chat-UI.

Usage:
    python backup.py
"""

import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class BackupConfig:
    """Configuration for MongoDB backup."""
    backup_dir: str = "/opt/vibecode/backups"
    db_name: str = "chatui"
    retention_days: int = 7
    mongo_host: str = "localhost"
    mongo_port: str = "27017"
    mongo_user: Optional[str] = None
    mongo_pass: Optional[str] = None
    s3_bucket: Optional[str] = None


@dataclass
class BackupResult:
    """Result of a backup operation."""
    backup_name: str
    backup_size: str
    backup_date: str
    backup_path: str
    success: bool


def run_command(cmd: list[str], timeout: int = 300) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def get_file_size(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def create_backup(config: BackupConfig) -> BackupResult:
    """Create a MongoDB backup."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"chatui_backup_{timestamp}"
    backup_dir = Path(config.backup_dir)

    print("🔄 Starting MongoDB backup for VibeCode Chat-UI...")

    # Create backup directory
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Build mongodump command
    cmd = [
        "mongodump",
        "--host", f"{config.mongo_host}:{config.mongo_port}",
        "--db", config.db_name,
        "--out", str(backup_dir / backup_name),
    ]

    if config.mongo_user and config.mongo_pass:
        cmd.extend([
            "--username", config.mongo_user,
            "--password", config.mongo_pass,
            "--authenticationDatabase", "admin",
        ])

    # Create backup
    print(f"📦 Creating backup: {backup_name}")
    rc, stdout, stderr = run_command(cmd)

    if rc != 0:
        print(f"Error creating backup: {stderr}")
        return BackupResult(
            backup_name=backup_name,
            backup_size="0",
            backup_date=timestamp,
            backup_path="",
            success=False,
        )

    # Compress backup
    print("🗜️ Compressing backup...")
    backup_path = backup_dir / backup_name
    archive_path = backup_dir / f"{backup_name}.tar.gz"

    rc, _, stderr = run_command([
        "tar", "-czf", str(archive_path),
        "-C", str(backup_dir), backup_name,
    ])

    if rc != 0:
        print(f"Error compressing backup: {stderr}")
        return BackupResult(
            backup_name=backup_name,
            backup_size="0",
            backup_date=timestamp,
            backup_path=str(backup_path),
            success=False,
        )

    # Remove uncompressed backup
    shutil.rmtree(backup_path, ignore_errors=True)

    backup_size = get_file_size(archive_path)
    print(f"✅ Backup completed: {archive_path.name} ({backup_size})")

    # Clean up old backups
    print(f"🧹 Cleaning up backups older than {config.retention_days} days...")
    cleanup_old_backups(backup_dir, config.retention_days)

    # List current backups
    print("📋 Current backups:")
    list_backups(backup_dir)

    # Upload to S3 if configured
    if config.s3_bucket:
        upload_to_s3(archive_path, config.s3_bucket)

    print("🎉 Backup process completed successfully!")

    return BackupResult(
        backup_name=backup_name,
        backup_size=backup_size,
        backup_date=timestamp,
        backup_path=str(archive_path),
        success=True,
    )


def cleanup_old_backups(backup_dir: Path, retention_days: int) -> None:
    """Remove backups older than retention_days."""
    cutoff_time = datetime.now().timestamp() - (retention_days * 86400)

    for backup_file in backup_dir.glob("chatui_backup_*.tar.gz"):
        if backup_file.stat().st_mtime < cutoff_time:
            backup_file.unlink()
            print(f"  Removed old backup: {backup_file.name}")


def list_backups(backup_dir: Path) -> None:
    """List all current backups."""
    backups = sorted(backup_dir.glob("chatui_backup_*.tar.gz"))
    if not backups:
        print("  No backups found")
        return

    for backup in backups:
        size = get_file_size(backup)
        mtime = datetime.fromtimestamp(backup.stat().st_mtime)
        print(f"  {backup.name} ({size}) - {mtime.strftime('%Y-%m-%d %H:%M')}")


def upload_to_s3(archive_path: Path, s3_bucket: str) -> bool:
    """Upload backup to S3."""
    print("☁️ Uploading backup to S3...")

    rc, _, stderr = run_command([
        "aws", "s3", "cp",
        str(archive_path),
        f"s3://{s3_bucket}/mongodb-backups/",
    ])

    if rc == 0:
        print("✅ Backup uploaded to S3")
        return True
    else:
        print(f"Failed to upload to S3: {stderr}")
        return False


def run_backup(config: Optional[BackupConfig] = None) -> int:
    """Run the backup process."""
    if config is None:
        config = BackupConfig(
            backup_dir=os.environ.get("BACKUP_DIR", "/opt/vibecode/backups"),
            db_name=os.environ.get("DB_NAME", "chatui"),
            retention_days=int(os.environ.get("RETENTION_DAYS", "7")),
            mongo_host=os.environ.get("MONGO_HOST", "localhost"),
            mongo_port=os.environ.get("MONGO_PORT", "27017"),
            mongo_user=os.environ.get("MONGO_INITDB_ROOT_USERNAME", "admin"),
            mongo_pass=os.environ.get("MONGO_INITDB_ROOT_PASSWORD", "vibecode_admin_2025"),
            s3_bucket=os.environ.get("AWS_S3_BUCKET"),
        )

    result = create_backup(config)

    # Print result as JSON
    print()
    print(json.dumps({
        "backup_name": result.backup_name,
        "backup_size": result.backup_size,
        "backup_date": result.backup_date,
        "backup_path": result.backup_path,
    }, indent=2))

    return 0 if result.success else 1


def main() -> int:
    """Main entry point."""
    return run_backup()


if __name__ == "__main__":
    sys.exit(main())
