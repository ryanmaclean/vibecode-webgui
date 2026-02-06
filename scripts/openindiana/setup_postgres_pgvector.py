#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "setup-postgres-pgvector"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Setup PostgreSQL 16 with pgvector extension.

Optimized for ZFS and vector workloads.
"""


# -- VibeCode Telemetry --
import sys
import os
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


import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.RED = cls.GREEN = cls.YELLOW = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


# Configuration
POSTGRES_VERSION = "16"
DB_NAME = "vibecode"
DB_USER = "vibecode"


def log_info(msg: str) -> None:
    """Log info message."""
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {msg}")


def log_warn(msg: str) -> None:
    """Log warning message."""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {msg}")


def log_error(msg: str) -> None:
    """Log error message."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")


def run_command(
    cmd: list[str] | str,
    check: bool = True,
    capture: bool = False,
    shell: bool = False,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture,
        text=True,
        shell=shell,
        input=input_text,
    )


def check_environment() -> None:
    """Check if running in correct environment."""
    if not Path("/etc/debian_version").exists():
        log_error("This script must be run inside the Debian lx zone")
        sys.exit(1)

    if os.geteuid() != 0:
        log_error("This script must be run as root")
        sys.exit(1)

    log_info("Running in Debian lx zone as root")


def generate_password() -> str:
    """Generate secure password."""
    password = secrets.token_urlsafe(25)[:25]
    log_info("Generated secure database password")
    return password


def install_postgresql() -> None:
    """Install PostgreSQL."""
    log_info(f"Installing PostgreSQL {POSTGRES_VERSION}...")

    # Add PostgreSQL APT repository
    run_command(["apt", "install", "-y", "postgresql-common"])
    run_command(["/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh", "-y"])

    # Install PostgreSQL
    packages = [
        f"postgresql-{POSTGRES_VERSION}",
        f"postgresql-contrib-{POSTGRES_VERSION}",
        f"postgresql-client-{POSTGRES_VERSION}",
        f"postgresql-server-dev-{POSTGRES_VERSION}",
    ]
    run_command(["apt", "install", "-y", *packages])

    # Verify installation
    result = run_command(
        ["systemctl", "is-active", "postgresql"],
        check=False,
        capture=True,
    )
    if result.returncode != 0:
        log_error("PostgreSQL installation failed")
        sys.exit(1)

    log_info(f"PostgreSQL {POSTGRES_VERSION} installed successfully")


def install_pgvector() -> None:
    """Install pgvector extension."""
    log_info("Installing pgvector extension...")

    run_command(["apt", "install", "-y", f"postgresql-{POSTGRES_VERSION}-pgvector"])

    log_info("pgvector extension installed")


def get_total_ram_mb() -> int:
    """Get total RAM in MB."""
    result = run_command(["free", "-m"], capture=True)
    for line in result.stdout.splitlines():
        if line.startswith("Mem:"):
            return int(line.split()[1])
    return 4096  # Default fallback


def configure_postgresql(db_password: str) -> None:
    """Configure PostgreSQL for ZFS and performance."""
    log_info("Configuring PostgreSQL for ZFS and performance...")

    pg_conf = Path(f"/etc/postgresql/{POSTGRES_VERSION}/main/postgresql.conf")
    pg_hba = Path(f"/etc/postgresql/{POSTGRES_VERSION}/main/pg_hba.conf")

    # Backup original config
    shutil.copy(pg_conf, f"{pg_conf}.backup")

    # Calculate memory settings
    total_ram_mb = get_total_ram_mb()
    shared_buffers_mb = total_ram_mb // 4
    effective_cache_size_mb = total_ram_mb * 3 // 4

    log_info(f"Total RAM: {total_ram_mb}MB")
    log_info(f"Setting shared_buffers to {shared_buffers_mb}MB")
    log_info(f"Setting effective_cache_size to {effective_cache_size_mb}MB")

    # Append optimized settings
    pg_config = f"""

# ===================================
# VibeCode Optimizations for ZFS
# ===================================

# Memory Settings
shared_buffers = {shared_buffers_mb}MB
effective_cache_size = {effective_cache_size_mb}MB
maintenance_work_mem = 512MB
work_mem = 32MB

# ZFS Optimizations
wal_compression = on
full_page_writes = off  # ZFS provides data integrity
checkpoint_completion_target = 0.9

# Connection Settings
max_connections = 200
superuser_reserved_connections = 3

# Write-Ahead Log
wal_buffers = 16MB
wal_writer_delay = 200ms
wal_level = replica

# Query Planner
random_page_cost = 1.1  # ZFS with ARC
effective_io_concurrency = 200

# Vacuum Settings
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 10s

# Logging for Monitoring
log_min_duration_statement = 100
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Statistics
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

# Vector-specific optimizations
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
"""

    with open(pg_conf, "a") as f:
        f.write(pg_config)

    # Configure authentication
    log_info("Configuring authentication...")

    hba_config = f"""

# VibeCode Application Access
host    {DB_NAME}    {DB_USER}    127.0.0.1/32    md5
host    {DB_NAME}    {DB_USER}    ::1/128         md5
"""

    with open(pg_hba, "a") as f:
        f.write(hba_config)

    # Restart PostgreSQL
    log_info("Restarting PostgreSQL...")
    run_command(["systemctl", "restart", "postgresql"])

    log_info("PostgreSQL configured successfully")


def setup_database(db_password: str) -> None:
    """Create database and user."""
    log_info("Creating database and user...")

    sql = f"""
-- Create user
CREATE USER {DB_USER} WITH PASSWORD '{db_password}';

-- Create database
CREATE DATABASE {DB_NAME} OWNER {DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};

\\c {DB_NAME}

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO {DB_USER};

-- Verify vector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
"""

    run_command(["sudo", "-u", "postgres", "psql"], input_text=sql)

    log_info(f"Database '{DB_NAME}' created with pgvector extension")


def test_pgvector() -> None:
    """Test pgvector functionality."""
    log_info("Testing pgvector functionality...")

    sql = f"""
-- Create test table with vector column
CREATE TABLE IF NOT EXISTS vector_test (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1536)
);

-- Insert test data
INSERT INTO vector_test (content, embedding)
VALUES ('test document', array_fill(0.1, ARRAY[1536])::vector);

-- Create vector index (IVFFlat)
CREATE INDEX ON vector_test USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Test similarity search
SELECT id, content, embedding <-> array_fill(0.1, ARRAY[1536])::vector AS distance
FROM vector_test
ORDER BY embedding <-> array_fill(0.1, ARRAY[1536])::vector
LIMIT 5;

-- Clean up test
DROP TABLE vector_test;
"""

    run_command(["sudo", "-u", "postgres", "psql", "-d", DB_NAME], input_text=sql)

    log_info("pgvector test successful!")


def setup_zfs_data_dir() -> None:
    """Configure PostgreSQL data directory on ZFS."""
    log_info("Configuring PostgreSQL data directory on ZFS...")

    # Stop PostgreSQL
    run_command(["systemctl", "stop", "postgresql"])

    old_data_dir = Path(f"/var/lib/postgresql/{POSTGRES_VERSION}/main")
    new_data_dir = Path("/zones/vibecode-zone/postgres/data")
    pg_conf = Path(f"/etc/postgresql/{POSTGRES_VERSION}/main/postgresql.conf")

    # Create new directory structure
    new_data_dir.parent.mkdir(parents=True, exist_ok=True)
    new_data_dir.mkdir(parents=True, exist_ok=True)
    run_command(["chown", "-R", "postgres:postgres", "/zones/vibecode-zone/postgres"])

    # Copy data if not already moved
    pg_version_file = new_data_dir / "PG_VERSION"
    if old_data_dir.exists() and not pg_version_file.exists():
        log_info("Moving data directory to ZFS dataset...")
        run_command(["rsync", "-av", f"{old_data_dir}/", f"{new_data_dir}/"])
        run_command(["chown", "-R", "postgres:postgres", str(new_data_dir)])

    # Update PostgreSQL config
    content = pg_conf.read_text()
    import re
    content = re.sub(
        r"data_directory = '.*'",
        f"data_directory = '{new_data_dir}'",
        content,
    )
    pg_conf.write_text(content)

    # Start PostgreSQL
    run_command(["systemctl", "start", "postgresql"])

    log_info("PostgreSQL data directory configured on ZFS")


def setup_backups() -> None:
    """Setup automated backups."""
    log_info("Setting up automated backup script...")

    backup_dir = Path("/zones/vibecode-zone/postgres/backups")
    backup_dir.mkdir(parents=True, exist_ok=True)
    run_command(["chown", "postgres:postgres", str(backup_dir)])

    backup_script = """#!/bin/bash
#
# PostgreSQL Backup Script
#

BACKUP_DIR="/zones/vibecode-zone/postgres/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup-$TIMESTAMP"

echo "[$(date)] Starting PostgreSQL backup..."

# Create base backup
sudo -u postgres pg_basebackup -D "$BACKUP_PATH" -F tar -z -P

# Create ZFS snapshot
zfs snapshot rpool/zones/vibecode-zone/postgres@backup-$TIMESTAMP

# Remove backups older than 7 days
find "$BACKUP_DIR" -type d -name "backup-*" -mtime +7 -exec rm -rf {} +

# Remove old snapshots (keep last 7)
zfs list -t snapshot | grep postgres | tail -n +8 | awk '{print $1}' | xargs -n1 zfs destroy

echo "[$(date)] Backup complete: $BACKUP_PATH"
"""

    backup_script_path = Path("/usr/local/bin/backup-postgres.sh")
    backup_script_path.write_text(backup_script)
    backup_script_path.chmod(0o755)

    # Add to cron
    cron_entry = "0 2 * * * /usr/local/bin/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1"
    result = run_command(["crontab", "-l"], check=False, capture=True)
    existing_cron = result.stdout if result.returncode == 0 else ""

    if "backup-postgres.sh" not in existing_cron:
        new_cron = existing_cron.rstrip() + "\n" + cron_entry + "\n"
        run_command(["crontab", "-"], input_text=new_cron)

    log_info("Automated backup configured (daily at 2 AM)")


def save_connection_details(db_password: str) -> None:
    """Save connection details to file."""
    log_info("Saving connection details...")

    # Use environment variables with fallback to configured values
    db_host = os.environ.get('DB_HOST', 'localhost')
    db_port = os.environ.get('DB_PORT', '5432')

    credentials = f"""PostgreSQL Connection Details
=============================

Host: {db_host}
Port: {db_port}
Database: {DB_NAME}
User: {DB_USER}
Password: {db_password}

Environment Variables (recommended for .env):
DB_USER={DB_USER}
DB_PASSWORD={db_password}
DB_HOST={db_host}
DB_PORT={db_port}
DB_NAME={DB_NAME}

Connection URL (for .env - uses environment variable interpolation):
DATABASE_URL="postgresql://${{DB_USER}}:${{DB_PASSWORD}}@${{DB_HOST}}:${{DB_PORT}}/{DB_NAME}?schema=public"

IMPORTANT: Keep this file secure and use environment variables in production!
"""

    creds_path = Path("/root/postgres-credentials.txt")
    creds_path.write_text(credentials)
    creds_path.chmod(0o600)

    log_info("Credentials saved to: /root/postgres-credentials.txt")


def show_summary(db_password: str) -> None:
    """Display setup summary."""
    # Use environment variables with fallback to configured values
    db_host = os.environ.get('DB_HOST', 'localhost')
    db_port = os.environ.get('DB_PORT', '5432')

    print(f"""
{Colors.GREEN}PostgreSQL Setup Complete!{Colors.NC}
================================

PostgreSQL Version: {POSTGRES_VERSION}
Database: {DB_NAME}
User: {DB_USER}
Password: (saved in /root/postgres-credentials.txt)

Extensions Enabled:
  - vector (pgvector)
  - pg_stat_statements
  - btree_gin
  - btree_gist

Data Directory: /zones/vibecode-zone/postgres/data
Backup Directory: /zones/vibecode-zone/postgres/backups

Configuration:
  - Optimized for ZFS
  - Optimized for vector workloads
  - Daily automated backups at 2 AM
  - Connection logging enabled

Environment Variables for .env:
  DB_USER={DB_USER}
  DB_PASSWORD=<see /root/postgres-credentials.txt>
  DB_HOST={db_host}
  DB_PORT={db_port}
  DB_NAME={DB_NAME}

Test Connection:
  psql -U {DB_USER} -d {DB_NAME} -h {db_host}

Next Steps:
  1. Run: ./05-deploy-vibecode.sh
  2. Update .env with environment variables above

Useful Commands:
  - Status:     systemctl status postgresql
  - Logs:       tail -f /var/log/postgresql/postgresql-{POSTGRES_VERSION}-main.log
  - psql:       sudo -u postgres psql
  - Backup:     /usr/local/bin/backup-postgres.sh

""")


def main() -> int:
    """Main entry point."""
    log_info("PostgreSQL + pgvector Setup")
    log_info("===========================")

    check_environment()
    db_password = generate_password()
    install_postgresql()
    install_pgvector()
    configure_postgresql(db_password)
    setup_zfs_data_dir()
    setup_database(db_password)
    test_pgvector()
    setup_backups()
    save_connection_details(db_password)
    show_summary(db_password)

    return 0


if __name__ == "__main__":
    sys.exit(main())