#!/usr/bin/env python3
"""
Setup PostgreSQL 16 with pgvector extension.

Optimized for ZFS and vector workloads on OpenIndiana/Debian lx zone.
"""

import argparse
import os
import secrets
import subprocess
import sys
from pathlib import Path
from typing import Optional


# ANSI color codes
class Colors:
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    NC = '\033[0m'  # No Color


# Configuration
POSTGRES_VERSION = "16"
DB_NAME = "vibecode"
DB_USER = "vibecode"


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {message}")


def log_warn(message: str) -> None:
    """Print warning message."""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")


def run_command(
    cmd: list[str],
    check: bool = True,
    capture_output: bool = False,
    input_text: Optional[str] = None,
) -> subprocess.CompletedProcess:
    """Run a shell command."""
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        text=True,
        input=input_text,
    )


def check_environment() -> None:
    """Check that we're running in the correct environment."""
    if not Path("/etc/debian_version").exists():
        log_error("This script must be run inside the Debian lx zone")
        sys.exit(1)

    if os.geteuid() != 0:
        log_error("This script must be run as root")
        sys.exit(1)

    log_info("Running in Debian lx zone as root")


def generate_password() -> str:
    """Generate a secure database password."""
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
    run_command([
        "apt", "install", "-y",
        f"postgresql-{POSTGRES_VERSION}",
        f"postgresql-contrib-{POSTGRES_VERSION}",
        f"postgresql-client-{POSTGRES_VERSION}",
        f"postgresql-server-dev-{POSTGRES_VERSION}",
    ])

    # Verify installation
    result = run_command(
        ["systemctl", "is-active", "postgresql"],
        check=False,
        capture_output=True,
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


def configure_postgresql(db_password: str) -> None:
    """Configure PostgreSQL for ZFS and performance."""
    log_info("Configuring PostgreSQL for ZFS and performance...")

    pg_conf = Path(f"/etc/postgresql/{POSTGRES_VERSION}/main/postgresql.conf")
    pg_hba = Path(f"/etc/postgresql/{POSTGRES_VERSION}/main/pg_hba.conf")

    # Backup original config
    backup_path = pg_conf.with_suffix(".conf.backup")
    if not backup_path.exists():
        backup_path.write_text(pg_conf.read_text())

    # Calculate memory settings (25% of RAM for shared_buffers)
    result = run_command(["free", "-m"], capture_output=True)
    mem_line = [line for line in result.stdout.split('\n') if line.startswith('Mem:')][0]
    total_ram_mb = int(mem_line.split()[1])
    shared_buffers_mb = total_ram_mb // 4
    effective_cache_size_mb = (total_ram_mb * 3) // 4

    log_info(f"Total RAM: {total_ram_mb}MB")
    log_info(f"Setting shared_buffers to {shared_buffers_mb}MB")
    log_info(f"Setting effective_cache_size to {effective_cache_size_mb}MB")

    # Append optimized settings
    pg_config_additions = f"""

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

    with open(pg_conf, 'a') as f:
        f.write(pg_config_additions)

    # Configure authentication
    log_info("Configuring authentication...")

    hba_additions = f"""

# VibeCode Application Access
host    {DB_NAME}    {DB_USER}    127.0.0.1/32    md5
host    {DB_NAME}    {DB_USER}    ::1/128         md5
"""

    with open(pg_hba, 'a') as f:
        f.write(hba_additions)

    # Restart PostgreSQL
    log_info("Restarting PostgreSQL...")
    run_command(["systemctl", "restart", "postgresql"])

    log_info("PostgreSQL configured successfully")


def setup_database(db_password: str) -> None:
    """Create database and user."""
    log_info("Creating database and user...")

    sql_commands = f"""
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

    run_command(
        ["sudo", "-u", "postgres", "psql"],
        input_text=sql_commands,
    )

    log_info(f"Database '{DB_NAME}' created with pgvector extension")


def test_pgvector() -> None:
    """Test pgvector functionality."""
    log_info("Testing pgvector functionality...")

    sql_commands = """
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

    run_command(
        ["sudo", "-u", "postgres", "psql", "-d", DB_NAME],
        input_text=sql_commands,
    )

    log_info("pgvector test successful!")


def setup_zfs_data_dir() -> None:
    """Configure PostgreSQL data directory on ZFS."""
    log_info("Configuring PostgreSQL data directory on ZFS...")

    pg_conf = Path(f"/etc/postgresql/{POSTGRES_VERSION}/main/postgresql.conf")
    old_data_dir = Path(f"/var/lib/postgresql/{POSTGRES_VERSION}/main")
    new_data_dir = Path("/zones/vibecode-zone/postgres/data")

    # Stop PostgreSQL
    run_command(["systemctl", "stop", "postgresql"])

    # Create new directory structure
    new_data_dir.parent.mkdir(parents=True, exist_ok=True)
    run_command(["chown", "-R", "postgres:postgres", "/zones/vibecode-zone/postgres"])

    # Copy data if not already moved
    pg_version_file = new_data_dir / "PG_VERSION"
    if old_data_dir.exists() and not pg_version_file.exists():
        log_info("Moving data directory to ZFS dataset...")
        run_command(["rsync", "-av", f"{old_data_dir}/", f"{new_data_dir}/"])
        run_command(["chown", "-R", "postgres:postgres", str(new_data_dir)])

    # Update PostgreSQL config to use new data directory
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
    """Set up automated backup script."""
    log_info("Setting up automated backup script...")

    backup_dir = Path("/zones/vibecode-zone/postgres/backups")
    backup_dir.mkdir(parents=True, exist_ok=True)
    run_command(["chown", "postgres:postgres", str(backup_dir)])

    backup_script = """\
#!/bin/bash
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

    # Add to cron (daily at 2 AM)
    cron_entry = "0 2 * * * /usr/local/bin/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1"

    # Get existing crontab
    result = run_command(["crontab", "-l"], check=False, capture_output=True)
    existing_cron = result.stdout if result.returncode == 0 else ""

    if cron_entry not in existing_cron:
        new_cron = existing_cron.rstrip() + "\n" + cron_entry + "\n"
        run_command(["crontab", "-"], input_text=new_cron)

    log_info("Automated backup configured (daily at 2 AM)")


def save_connection_details(db_password: str) -> None:
    """Save connection details to a file."""
    log_info("Saving connection details...")

    credentials = f"""\
PostgreSQL Connection Details
=============================

Host: localhost
Port: 5432
Database: {DB_NAME}
User: {DB_USER}
Password: {db_password}

Connection String:
postgresql://{DB_USER}:{db_password}@localhost:5432/{DB_NAME}

Connection URL (for .env):
DATABASE_URL="postgresql://{DB_USER}:{db_password}@localhost:5432/{DB_NAME}?schema=public"

IMPORTANT: Keep this file secure!
"""

    credentials_path = Path("/root/postgres-credentials.txt")
    credentials_path.write_text(credentials)
    credentials_path.chmod(0o600)

    log_info("Credentials saved to: /root/postgres-credentials.txt")


def show_summary(db_password: str) -> None:
    """Display setup summary."""
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

Connection String:
  postgresql://{DB_USER}:{db_password}@localhost:5432/{DB_NAME}

Test Connection:
  psql -U {DB_USER} -d {DB_NAME} -h localhost

Next Steps:
  1. Run: ./05-deploy-vibecode.sh
  2. Update .env with DATABASE_URL

Useful Commands:
  - Status:     systemctl status postgresql
  - Logs:       tail -f /var/log/postgresql/postgresql-{POSTGRES_VERSION}-main.log
  - psql:       sudo -u postgres psql
  - Backup:     /usr/local/bin/backup-postgres.sh
""")


def main(skip_zfs: bool = False) -> int:
    """
    Main entry point for PostgreSQL + pgvector setup.

    Args:
        skip_zfs: If True, skip ZFS-specific configuration steps.

    Returns:
        0 on success, 1 on failure
    """
    log_info("PostgreSQL + pgvector Setup")
    log_info("===========================")

    try:
        check_environment()
        db_password = generate_password()
        install_postgresql()
        install_pgvector()
        configure_postgresql(db_password)

        if not skip_zfs:
            setup_zfs_data_dir()

        setup_database(db_password)
        test_pgvector()
        setup_backups()
        save_connection_details(db_password)
        show_summary(db_password)

        return 0

    except subprocess.CalledProcessError as e:
        log_error(f"Command failed: {e}")
        return 1
    except Exception as e:
        log_error(f"Setup failed: {e}")
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Setup PostgreSQL 16 with pgvector extension"
    )
    parser.add_argument(
        "--skip-zfs",
        action="store_true",
        help="Skip ZFS-specific configuration steps",
    )
    args = parser.parse_args()

    sys.exit(main(skip_zfs=args.skip_zfs))
