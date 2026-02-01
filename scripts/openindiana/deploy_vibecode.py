#!/usr/bin/env python3
"""Deploy VibeCode Application.

Clone, configure, and deploy VibeCode in lx zone on OpenIndiana.
"""

import argparse
import os
import secrets
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'


@dataclass
class DeployConfig:
    """Configuration for VibeCode deployment."""

    repo_url: str = "https://github.com/your-org/vibecode-webgui.git"
    install_dir: Path = field(default_factory=lambda: Path("/opt/vibecode-webgui"))
    app_user: str = "vibecode"
    app_port: int = 3000
    credentials_file: Path = field(
        default_factory=lambda: Path("/root/postgres-credentials.txt")
    )


# Systemd service template
SYSTEMD_SERVICE_TEMPLATE = """[Unit]
Description=VibeCode Application Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User={app_user}
WorkingDirectory={install_dir}
Environment="NODE_ENV=production"
Environment="PORT={app_port}"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/vibecode/app.log
StandardError=append:/var/log/vibecode/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={install_dir}

# Resource limits
LimitNOFILE=65536
LimitNPROC=512

[Install]
WantedBy=multi-user.target
"""

# Logrotate configuration template
LOGROTATE_TEMPLATE = """/var/log/vibecode/*.log {{
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 {app_user} {app_user}
    sharedscripts
    postrotate
        systemctl reload vibecode > /dev/null 2>&1 || true
    endscript
}}
"""

# Health check script
HEALTH_SCRIPT = """#!/bin/bash
# Health check for VibeCode

URL="http://localhost:3000"

if curl -sf "$URL" > /dev/null; then
    echo "VibeCode is healthy"
    exit 0
else
    echo "VibeCode is not responding"
    exit 1
fi
"""

# Restart script
RESTART_SCRIPT = """#!/bin/bash
# Restart VibeCode application

echo "Restarting VibeCode..."
systemctl restart vibecode

sleep 5

if systemctl is-active vibecode > /dev/null; then
    echo "VibeCode restarted successfully"
else
    echo "VibeCode failed to start"
    journalctl -u vibecode -n 50
    exit 1
fi
"""

# Update script
UPDATE_SCRIPT = """#!/bin/bash
# Update VibeCode to latest version

set -e

cd /opt/vibecode-webgui

echo "Pulling latest changes..."
sudo -u vibecode git pull

echo "Installing dependencies..."
sudo -u vibecode npm install

echo "Running migrations..."
sudo -u vibecode npx prisma migrate deploy

echo "Building application..."
sudo -u vibecode npm run build

echo "Restarting service..."
systemctl restart vibecode

sleep 5

if systemctl is-active vibecode > /dev/null; then
    echo "Update complete"
else
    echo "Service failed to start after update"
    exit 1
fi
"""


def log_info(message: str) -> None:
    """Log an info message."""
    print(f"{GREEN}[INFO]{NC} {message}")


def log_warn(message: str) -> None:
    """Log a warning message."""
    print(f"{YELLOW}[WARN]{NC} {message}")


def log_error(message: str) -> None:
    """Log an error message."""
    print(f"{RED}[ERROR]{NC} {message}")


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = True,
    cwd: Optional[Path] = None
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run.
        check: If True, log errors on failure.
        capture: If True, capture output.
        cwd: Working directory.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            cwd=cwd
        )
        if check and result.returncode != 0 and capture:
            log_error(f"Command failed: {' '.join(cmd)}")
            if result.stderr:
                log_error(result.stderr)
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def check_environment() -> bool:
    """Check if running in correct environment.

    Returns:
        True if environment is valid.
    """
    # Check for Debian
    if not Path("/etc/debian_version").exists():
        log_error("This script must be run inside the Debian lx zone")
        return False

    # Check for root
    if os.geteuid() != 0:
        log_error("This script must be run as root")
        return False

    log_info("Running in Debian lx zone as root")
    return True


def check_prerequisites(config: DeployConfig) -> bool:
    """Check if prerequisites are installed.

    Args:
        config: Deployment configuration.

    Returns:
        True if prerequisites are met.
    """
    log_info("Checking prerequisites...")

    # Check Node.js
    rc, stdout, _ = run_command(["node", "--version"], check=False)
    if rc != 0:
        log_error("Node.js not found. Run: ./03-install-node24.sh")
        return False
    log_info(f"Node.js: {stdout.strip()}")

    # Check PostgreSQL
    rc, _, _ = run_command(
        ["systemctl", "is-active", "postgresql"],
        check=False
    )
    if rc != 0:
        log_error("PostgreSQL not running. Run: ./04-setup-postgres-pgvector.sh")
        return False
    log_info("PostgreSQL: running")

    # Check credentials file
    if not config.credentials_file.exists():
        log_error("PostgreSQL credentials not found")
        return False

    log_info("Prerequisites check passed")
    return True


def create_app_user(config: DeployConfig) -> bool:
    """Create the application user.

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log_info("Creating application user...")

    # Check if user exists
    rc, _, _ = run_command(["id", config.app_user], check=False)
    if rc == 0:
        log_info(f"User {config.app_user} already exists")
        return True

    # Create user
    rc, _, _ = run_command([
        "useradd", "-m", "-s", "/bin/bash", config.app_user
    ])

    if rc == 0:
        log_info(f"User {config.app_user} created")
        return True

    log_error(f"Failed to create user {config.app_user}")
    return False


def clone_repository(config: DeployConfig) -> bool:
    """Clone or update the repository.

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log_info("Cloning VibeCode repository...")

    if config.install_dir.exists():
        log_warn(f"Directory {config.install_dir} already exists")
        log_info("Pulling latest changes...")
        rc, _, _ = run_command(
            ["sudo", "-u", config.app_user, "git", "pull"],
            cwd=config.install_dir
        )
    else:
        log_info(f"Cloning from: {config.repo_url}")
        rc, _, _ = run_command([
            "sudo", "-u", config.app_user,
            "git", "clone", config.repo_url, str(config.install_dir)
        ])

    if rc != 0:
        log_error("Failed to clone/update repository")
        return False

    # Show current state
    rc, branch, _ = run_command(
        ["git", "branch", "--show-current"],
        cwd=config.install_dir
    )
    if rc == 0:
        log_info(f"Current branch: {branch.strip()}")

    rc, commit, _ = run_command(
        ["git", "log", "-1", "--oneline"],
        cwd=config.install_dir
    )
    if rc == 0:
        log_info(f"Latest commit: {commit.strip()}")

    return True


def install_dependencies(config: DeployConfig) -> bool:
    """Install npm dependencies.

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log_info("Installing application dependencies...")
    log_info("Running npm install...")

    rc, _, _ = run_command(
        ["sudo", "-u", config.app_user, "npm", "install"],
        cwd=config.install_dir,
        capture=False
    )

    if rc == 0:
        log_info("Dependencies installed")
        return True

    log_error("Failed to install dependencies")
    return False


def read_database_url(config: DeployConfig) -> Optional[str]:
    """Read database URL from credentials file.

    Args:
        config: Deployment configuration.

    Returns:
        Database URL or None.
    """
    try:
        content = config.credentials_file.read_text()
        for line in content.splitlines():
            if line.startswith("DATABASE_URL="):
                # Extract value between quotes
                parts = line.split('"')
                if len(parts) >= 2:
                    return parts[1]
    except OSError:
        pass
    return None


def generate_env_content(config: DeployConfig, db_url: str) -> str:
    """Generate .env file content.

    Args:
        config: Deployment configuration.
        db_url: Database URL.

    Returns:
        Environment file content.
    """
    nextauth_secret = secrets.token_urlsafe(32)
    api_key = secrets.token_hex(32)

    return f"""# VibeCode Environment Configuration
# Generated on: {datetime.now().isoformat()}

# Database
DATABASE_URL="{db_url}"

# NextAuth
NEXTAUTH_URL="http://localhost:{config.app_port}"
NEXTAUTH_SECRET="{nextauth_secret}"

# Application
NODE_ENV="production"
PORT="{config.app_port}"

# API Keys
API_KEY="{api_key}"

# OpenAI (configure with your keys)
# OPENAI_API_KEY="your-openai-api-key"

# Anthropic (configure with your keys)
# ANTHROPIC_API_KEY="your-anthropic-api-key"

# Redis (optional)
# REDIS_URL="redis://localhost:6379"

# Monitoring
# DATADOG_API_KEY="your-datadog-api-key"

# Security
ALLOWED_ORIGINS="http://localhost:{config.app_port}"
"""


def configure_environment(config: DeployConfig) -> bool:
    """Configure the application environment.

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log_info("Configuring environment...")

    db_url = read_database_url(config)
    if not db_url:
        log_error("Failed to read DATABASE_URL from credentials file")
        return False

    env_content = generate_env_content(config, db_url)
    env_file = config.install_dir / ".env"

    try:
        env_file.write_text(env_content)
        # Set ownership and permissions
        run_command([
            "chown", f"{config.app_user}:{config.app_user}", str(env_file)
        ])
        env_file.chmod(0o600)
        log_info("Environment configured")
        log_warn("IMPORTANT: Update .env with your API keys before starting")
        return True
    except OSError as e:
        log_error(f"Failed to create .env file: {e}")
        return False


def build_application(config: DeployConfig) -> bool:
    """Build the application.

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log_info("Building application...")

    # Run migrations
    log_info("Running database migrations...")
    rc, _, _ = run_command(
        ["sudo", "-u", config.app_user, "npx", "prisma", "migrate", "deploy"],
        cwd=config.install_dir,
        check=False
    )
    if rc != 0:
        log_warn("Migration failed or no migrations pending")

    # Generate Prisma client
    log_info("Generating Prisma client...")
    rc, _, _ = run_command(
        ["sudo", "-u", config.app_user, "npx", "prisma", "generate"],
        cwd=config.install_dir
    )
    if rc != 0:
        log_error("Failed to generate Prisma client")
        return False

    # Build Next.js
    log_info("Building Next.js application...")
    rc, _, _ = run_command(
        ["sudo", "-u", config.app_user, "npm", "run", "build"],
        cwd=config.install_dir,
        capture=False
    )
    if rc != 0:
        log_error("Failed to build application")
        return False

    log_info("Build complete")
    return True


def create_systemd_service(config: DeployConfig) -> bool:
    """Create the systemd service.

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log_info("Creating systemd service...")

    service_content = SYSTEMD_SERVICE_TEMPLATE.format(
        app_user=config.app_user,
        install_dir=config.install_dir,
        app_port=config.app_port
    )

    service_file = Path("/etc/systemd/system/vibecode.service")

    try:
        service_file.write_text(service_content)
    except OSError as e:
        log_error(f"Failed to create service file: {e}")
        return False

    # Create log directory
    log_dir = Path("/var/log/vibecode")
    log_dir.mkdir(parents=True, exist_ok=True)
    run_command([
        "chown", f"{config.app_user}:{config.app_user}", str(log_dir)
    ])

    # Reload systemd
    run_command(["systemctl", "daemon-reload"])

    log_info("Systemd service created")
    return True


def configure_firewall(config: DeployConfig) -> bool:
    """Configure the firewall.

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log_info("Configuring firewall...")

    # Check if ufw is installed
    rc, _, _ = run_command(["which", "ufw"], check=False)
    if rc != 0:
        run_command(["apt", "install", "-y", "ufw"], capture=False)

    # Allow SSH and app port
    run_command(["ufw", "allow", "22/tcp"])
    run_command(["ufw", "allow", f"{config.app_port}/tcp"])

    # Enable firewall
    subprocess.run(
        ["ufw", "enable"],
        input="y\n",
        text=True,
        capture_output=True
    )

    log_info("Firewall configured")
    return True


def setup_log_rotation(config: DeployConfig) -> bool:
    """Set up log rotation.

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log_info("Setting up log rotation...")

    logrotate_content = LOGROTATE_TEMPLATE.format(app_user=config.app_user)
    logrotate_file = Path("/etc/logrotate.d/vibecode")

    try:
        logrotate_file.write_text(logrotate_content)
        log_info("Log rotation configured")
        return True
    except OSError as e:
        log_error(f"Failed to create logrotate config: {e}")
        return False


def create_maintenance_scripts() -> bool:
    """Create maintenance scripts.

    Returns:
        True if successful.
    """
    log_info("Creating maintenance scripts...")

    scripts = {
        "/usr/local/bin/vibecode-health": HEALTH_SCRIPT,
        "/usr/local/bin/vibecode-restart": RESTART_SCRIPT,
        "/usr/local/bin/vibecode-update": UPDATE_SCRIPT,
    }

    for path, content in scripts.items():
        script_path = Path(path)
        try:
            script_path.write_text(content)
            script_path.chmod(0o755)
        except OSError as e:
            log_error(f"Failed to create {path}: {e}")
            return False

    log_info("Maintenance scripts created")
    return True


def start_application() -> bool:
    """Start the application.

    Returns:
        True if successful.
    """
    log_info("Starting VibeCode application...")

    # Enable service
    run_command(["systemctl", "enable", "vibecode"])

    # Start service
    run_command(["systemctl", "start", "vibecode"])

    # Wait for startup
    log_info("Waiting for application to start...")
    time.sleep(10)

    # Check status
    rc, _, _ = run_command(
        ["systemctl", "is-active", "vibecode"],
        check=False
    )

    if rc == 0:
        log_info("VibeCode started successfully!")
        return True

    log_error("VibeCode failed to start")
    log_error("Check logs: journalctl -u vibecode -n 50")
    return False


def test_application(config: DeployConfig) -> bool:
    """Test the application.

    Args:
        config: Deployment configuration.

    Returns:
        True if responding.
    """
    log_info("Testing application...")
    time.sleep(5)

    rc, _, _ = run_command(
        ["curl", "-sf", f"http://localhost:{config.app_port}"],
        check=False
    )

    if rc == 0:
        log_info(f"Application is responding on port {config.app_port}")
        return True

    log_warn("Application not responding yet (may still be starting)")
    return False


def get_zone_ip() -> str:
    """Get the zone IP address.

    Returns:
        IP address or 'N/A'.
    """
    rc, stdout, _ = run_command(
        ["ip", "addr", "show", "net0"],
        check=False
    )
    if rc == 0:
        for line in stdout.splitlines():
            if "inet " in line:
                parts = line.strip().split()
                if len(parts) >= 2:
                    return parts[1].split("/")[0]
    return "N/A"


def show_summary(config: DeployConfig) -> None:
    """Show deployment summary.

    Args:
        config: Deployment configuration.
    """
    zone_ip = get_zone_ip()

    print(f"""
{GREEN}VibeCode Deployment Complete!{NC}
================================

Installation Directory: {config.install_dir}
User: {config.app_user}
Port: {config.app_port}

Access URLs:
  Local:    http://localhost:{config.app_port}
  Network:  http://{zone_ip}:{config.app_port}

Service Management:
  Status:   systemctl status vibecode
  Start:    systemctl start vibecode
  Stop:     systemctl stop vibecode
  Restart:  systemctl restart vibecode
  Logs:     journalctl -u vibecode -f

Maintenance Commands:
  Health:   vibecode-health
  Restart:  vibecode-restart
  Update:   vibecode-update

Log Files:
  App:      /var/log/vibecode/app.log
  Error:    /var/log/vibecode/error.log
  System:   journalctl -u vibecode

Configuration:
  .env:     {config.install_dir}/.env

IMPORTANT:
  1. Update .env with your API keys:
       - OPENAI_API_KEY
       - ANTHROPIC_API_KEY
       - DATADOG_API_KEY (optional)

  2. After updating .env:
       systemctl restart vibecode

  3. Setup SSL/TLS for production:
       Install Caddy or nginx as reverse proxy

Next Steps:
  1. Run: ./06-configure-dtrace.sh (for monitoring)
  2. Configure API keys in .env
  3. Setup reverse proxy for HTTPS
  4. Configure backup strategy

Documentation:
  https://docs.vibecode.com/platforms/openindiana/
""")


def main(
    repo_url: Optional[str] = None,
    install_dir: Optional[Path] = None,
    app_user: Optional[str] = None,
    app_port: Optional[int] = None,
    skip_checks: bool = False
) -> int:
    """Main entry point.

    Args:
        repo_url: Repository URL.
        install_dir: Installation directory.
        app_user: Application user.
        app_port: Application port.
        skip_checks: Skip environment checks.

    Returns:
        Exit code (0 for success).
    """
    config = DeployConfig()

    if repo_url:
        config.repo_url = repo_url
    if install_dir:
        config.install_dir = install_dir
    if app_user:
        config.app_user = app_user
    if app_port:
        config.app_port = app_port

    log_info("VibeCode Deployment")
    log_info("===================")

    if not skip_checks:
        if not check_environment():
            return 1
        if not check_prerequisites(config):
            return 1

    if not create_app_user(config):
        return 1

    if not clone_repository(config):
        return 1

    if not install_dependencies(config):
        return 1

    if not configure_environment(config):
        return 1

    if not build_application(config):
        return 1

    if not create_systemd_service(config):
        return 1

    if not configure_firewall(config):
        return 1

    if not setup_log_rotation(config):
        return 1

    if not create_maintenance_scripts():
        return 1

    if not start_application():
        return 1

    test_application(config)
    show_summary(config)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy VibeCode Application"
    )
    parser.add_argument(
        '--repo-url',
        help="Git repository URL"
    )
    parser.add_argument(
        '--install-dir',
        type=Path,
        help="Installation directory"
    )
    parser.add_argument(
        '--user',
        dest='app_user',
        help="Application user"
    )
    parser.add_argument(
        '--port',
        type=int,
        dest='app_port',
        help="Application port"
    )
    parser.add_argument(
        '--skip-checks',
        action='store_true',
        help="Skip environment checks (for testing)"
    )

    args = parser.parse_args()
    sys.exit(main(
        args.repo_url,
        args.install_dir,
        args.app_user,
        args.app_port,
        args.skip_checks
    ))
