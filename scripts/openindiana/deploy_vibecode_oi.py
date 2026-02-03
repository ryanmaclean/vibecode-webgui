#!/usr/bin/env python3
"""Deploy VibeCode Application in OpenIndiana lx zone.

Clone, configure, and deploy VibeCode in Debian lx zone.
"""

from __future__ import annotations

import os
import secrets
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"


@dataclass
class DeployConfig:
    """Deployment configuration."""

    repo_url: str = "https://github.com/your-org/vibecode-webgui.git"
    install_dir: Path = field(default_factory=lambda: Path("/opt/vibecode-webgui"))
    app_user: str = "vibecode"
    app_port: int = 3000
    log_dir: Path = field(default_factory=lambda: Path("/var/log/vibecode"))
    credentials_file: Path = field(default_factory=lambda: Path("/root/postgres-credentials.txt"))

    @property
    def env_file(self) -> Path:
        """Get .env file path."""
        return self.install_dir / ".env"

    @property
    def service_file(self) -> Path:
        """Get systemd service file path."""
        return Path("/etc/systemd/system/vibecode.service")

    @property
    def logrotate_file(self) -> Path:
        """Get logrotate config path."""
        return Path("/etc/logrotate.d/vibecode")


def log_info(msg: str) -> None:
    """Print info message."""
    print(f"{GREEN}[INFO]{NC} {msg}")


def log_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}✅ {msg}{NC}")


def log_warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}[WARN]{NC} {msg}")


def log_error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}[ERROR]{NC} {msg}")


def run_command(
    cmd: list[str],
    timeout: int = 600,
    capture: bool = True,
    check: bool = False,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess:
    """Run a command with error handling.

    Args:
        cmd: Command and arguments.
        timeout: Command timeout in seconds.
        capture: Whether to capture output.
        check: Whether to raise on non-zero exit.
        cwd: Working directory.

    Returns:
        Completed process result.
    """
    try:
        return subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout,
            check=check,
            cwd=cwd,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr="Timeout")
    except subprocess.SubprocessError as e:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr=str(e))


def check_environment() -> bool:
    """Check if running in correct environment.

    Returns:
        True if in Debian lx zone as root.
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
        True if all prerequisites are met.
    """
    log_info("Checking prerequisites...")

    # Check Node.js
    if not shutil.which("node"):
        log_error("Node.js not found. Run: ./03-install-node24.sh")
        return False

    result = run_command(["node", "--version"])
    if result.returncode == 0:
        log_info(f"Node.js: {result.stdout.strip()}")
    else:
        log_error("Failed to get Node.js version")
        return False

    # Check PostgreSQL
    result = run_command(["systemctl", "is-active", "postgresql"])
    if result.returncode != 0:
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
    """Create application user.

    Args:
        config: Deployment configuration.

    Returns:
        True if user exists or was created.
    """
    log_info("Creating application user...")

    # Check if user exists
    result = run_command(["id", config.app_user])
    if result.returncode == 0:
        log_info(f"User {config.app_user} already exists")
        return True

    # Create user
    result = run_command(["useradd", "-m", "-s", "/bin/bash", config.app_user])
    if result.returncode == 0:
        log_info(f"User {config.app_user} created")
        return True
    else:
        log_error(f"Failed to create user: {result.stderr}")
        return False


def clone_repository(config: DeployConfig) -> bool:
    """Clone or update the repository.

    Args:
        config: Deployment configuration.

    Returns:
        True if clone/pull successful.
    """
    log_info("Cloning VibeCode repository...")

    if config.install_dir.exists():
        log_warning(f"Directory {config.install_dir} already exists")
        log_info("Pulling latest changes...")
        result = run_command(
            ["sudo", "-u", config.app_user, "git", "pull"],
            cwd=config.install_dir,
        )
        if result.returncode != 0:
            log_error(f"Git pull failed: {result.stderr}")
            return False
    else:
        log_info(f"Cloning from: {config.repo_url}")
        result = run_command([
            "sudo", "-u", config.app_user,
            "git", "clone", config.repo_url, str(config.install_dir),
        ])
        if result.returncode != 0:
            log_error(f"Git clone failed: {result.stderr}")
            return False

    # Show current state
    result = run_command(["git", "branch", "--show-current"], cwd=config.install_dir)
    if result.returncode == 0:
        log_info(f"Current branch: {result.stdout.strip()}")

    result = run_command(["git", "log", "-1", "--oneline"], cwd=config.install_dir)
    if result.returncode == 0:
        log_info(f"Latest commit: {result.stdout.strip()}")

    return True


def install_dependencies(config: DeployConfig) -> bool:
    """Install application dependencies.

    Args:
        config: Deployment configuration.

    Returns:
        True if npm install successful.
    """
    log_info("Installing application dependencies...")
    log_info("Running npm install...")

    result = run_command(
        ["sudo", "-u", config.app_user, "npm", "install"],
        cwd=config.install_dir,
        timeout=600,
    )

    if result.returncode != 0:
        log_error(f"npm install failed: {result.stderr}")
        return False

    log_info("Dependencies installed")
    return True


def read_database_url(config: DeployConfig) -> str | None:
    """Read DATABASE_URL from credentials file.

    Args:
        config: Deployment configuration.

    Returns:
        Database URL or None if not found.
    """
    try:
        content = config.credentials_file.read_text()
        for line in content.splitlines():
            if line.startswith("DATABASE_URL="):
                # Extract value between quotes
                parts = line.split("=", 1)
                if len(parts) == 2:
                    value = parts[1].strip().strip('"')
                    return value
    except OSError:
        pass
    return None


def generate_env_content(config: DeployConfig, db_url: str) -> str:
    """Generate .env file content.

    Args:
        config: Deployment configuration.
        db_url: Database connection URL.

    Returns:
        Environment file content.
    """
    from datetime import datetime

    nextauth_secret = secrets.token_urlsafe(32)
    api_key = secrets.token_hex(32)
    timestamp = datetime.now().isoformat()

    return f'''# VibeCode Environment Configuration
# Generated on: {timestamp}

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
'''


def configure_environment(config: DeployConfig) -> bool:
    """Configure application environment.

    Args:
        config: Deployment configuration.

    Returns:
        True if configuration successful.
    """
    log_info("Configuring environment...")

    # Read database URL
    db_url = read_database_url(config)
    if not db_url:
        log_error("Failed to read DATABASE_URL from credentials file")
        return False

    # Generate and write .env
    try:
        content = generate_env_content(config, db_url)
        config.env_file.write_text(content)

        # Set ownership and permissions
        run_command(["chown", f"{config.app_user}:{config.app_user}", str(config.env_file)])
        config.env_file.chmod(0o600)

        log_info("Environment configured")
        log_warning("IMPORTANT: Update .env with your API keys before starting")
        return True
    except OSError as e:
        log_error(f"Failed to create .env file: {e}")
        return False


def build_application(config: DeployConfig) -> bool:
    """Build the application.

    Args:
        config: Deployment configuration.

    Returns:
        True if build successful.
    """
    log_info("Building application...")

    # Run database migrations
    log_info("Running database migrations...")
    result = run_command(
        ["sudo", "-u", config.app_user, "npx", "prisma", "migrate", "deploy"],
        cwd=config.install_dir,
    )
    if result.returncode != 0:
        log_warning("Migration failed or no migrations pending")

    # Generate Prisma client
    log_info("Generating Prisma client...")
    result = run_command(
        ["sudo", "-u", config.app_user, "npx", "prisma", "generate"],
        cwd=config.install_dir,
    )
    if result.returncode != 0:
        log_error(f"Prisma generate failed: {result.stderr}")
        return False

    # Build Next.js application
    log_info("Building Next.js application (this may take a few minutes)...")
    result = run_command(
        ["sudo", "-u", config.app_user, "npm", "run", "build"],
        cwd=config.install_dir,
        timeout=600,
    )
    if result.returncode != 0:
        log_error(f"Build failed: {result.stderr}")
        return False

    log_info("Build complete")
    return True


def generate_systemd_service(config: DeployConfig) -> str:
    """Generate systemd service file content.

    Args:
        config: Deployment configuration.

    Returns:
        Service file content.
    """
    return f'''[Unit]
Description=VibeCode Application Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User={config.app_user}
WorkingDirectory={config.install_dir}
Environment="NODE_ENV=production"
Environment="PORT={config.app_port}"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=append:{config.log_dir}/app.log
StandardError=append:{config.log_dir}/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={config.install_dir}

# Resource limits
LimitNOFILE=65536
LimitNPROC=512

[Install]
WantedBy=multi-user.target
'''


def create_systemd_service(config: DeployConfig) -> bool:
    """Create systemd service.

    Args:
        config: Deployment configuration.

    Returns:
        True if service created successfully.
    """
    log_info("Creating systemd service...")

    try:
        # Write service file
        content = generate_systemd_service(config)
        config.service_file.write_text(content)

        # Create log directory
        config.log_dir.mkdir(parents=True, exist_ok=True)
        run_command(["chown", f"{config.app_user}:{config.app_user}", str(config.log_dir)])

        # Reload systemd
        result = run_command(["systemctl", "daemon-reload"])
        if result.returncode != 0:
            log_error("Failed to reload systemd")
            return False

        log_info("Systemd service created")
        return True
    except OSError as e:
        log_error(f"Failed to create service: {e}")
        return False


def configure_firewall(config: DeployConfig) -> bool:
    """Configure firewall.

    Args:
        config: Deployment configuration.

    Returns:
        True if firewall configured.
    """
    log_info("Configuring firewall...")

    # Install ufw if not present
    if not shutil.which("ufw"):
        result = run_command(["apt", "install", "-y", "ufw"])
        if result.returncode != 0:
            log_warning("Failed to install ufw")
            return True  # Non-critical, continue

    # Allow SSH
    run_command(["ufw", "allow", "22/tcp"])

    # Allow application port
    run_command(["ufw", "allow", f"{config.app_port}/tcp"])

    # Enable firewall
    result = run_command(["bash", "-c", "echo 'y' | ufw enable"])
    if result.returncode != 0:
        log_warning("Failed to enable ufw (may already be enabled)")

    log_info("Firewall configured")
    return True


def generate_logrotate_config(config: DeployConfig) -> str:
    """Generate logrotate configuration.

    Args:
        config: Deployment configuration.

    Returns:
        Logrotate config content.
    """
    return f'''{config.log_dir}/*.log {{
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 {config.app_user} {config.app_user}
    sharedscripts
    postrotate
        systemctl reload vibecode > /dev/null 2>&1 || true
    endscript
}}
'''


def setup_log_rotation(config: DeployConfig) -> bool:
    """Setup log rotation.

    Args:
        config: Deployment configuration.

    Returns:
        True if log rotation configured.
    """
    log_info("Setting up log rotation...")

    try:
        content = generate_logrotate_config(config)
        config.logrotate_file.write_text(content)
        log_info("Log rotation configured")
        return True
    except OSError as e:
        log_error(f"Failed to create logrotate config: {e}")
        return False


HEALTH_SCRIPT = '''#!/bin/bash
# Health check for VibeCode

URL="http://localhost:3000"

if curl -sf "$URL" > /dev/null; then
    echo "✓ VibeCode is healthy"
    exit 0
else
    echo "✗ VibeCode is not responding"
    exit 1
fi
'''

RESTART_SCRIPT = '''#!/bin/bash
# Restart VibeCode application

echo "Restarting VibeCode..."
systemctl restart vibecode

sleep 5

if systemctl is-active vibecode > /dev/null; then
    echo "✓ VibeCode restarted successfully"
else
    echo "✗ VibeCode failed to start"
    journalctl -u vibecode -n 50
    exit 1
fi
'''

UPDATE_SCRIPT = '''#!/bin/bash
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
    echo "✓ Update complete"
else
    echo "✗ Service failed to start after update"
    exit 1
fi
'''


def create_maintenance_scripts() -> bool:
    """Create maintenance scripts.

    Returns:
        True if scripts created successfully.
    """
    log_info("Creating maintenance scripts...")

    scripts = [
        ("/usr/local/bin/vibecode-health", HEALTH_SCRIPT),
        ("/usr/local/bin/vibecode-restart", RESTART_SCRIPT),
        ("/usr/local/bin/vibecode-update", UPDATE_SCRIPT),
    ]

    try:
        for path, content in scripts:
            script_path = Path(path)
            script_path.write_text(content)
            script_path.chmod(0o755)

        log_info("Maintenance scripts created")
        return True
    except OSError as e:
        log_error(f"Failed to create maintenance scripts: {e}")
        return False


def start_application(config: DeployConfig) -> bool:
    """Start the application service.

    Args:
        config: Deployment configuration.

    Returns:
        True if application started successfully.
    """
    log_info("Starting VibeCode application...")

    # Enable service
    result = run_command(["systemctl", "enable", "vibecode"])
    if result.returncode != 0:
        log_error("Failed to enable service")
        return False

    # Start service
    result = run_command(["systemctl", "start", "vibecode"])
    if result.returncode != 0:
        log_error("Failed to start service")
        return False

    # Wait for startup
    log_info("Waiting for application to start...")
    time.sleep(10)

    # Check status
    result = run_command(["systemctl", "is-active", "vibecode"])
    if result.returncode == 0:
        log_info("VibeCode started successfully!")
        return True
    else:
        log_error("VibeCode failed to start")
        log_error("Check logs: journalctl -u vibecode -n 50")
        return False


def check_application_endpoint(config: DeployConfig) -> bool:
    """Test application endpoint.

    Args:
        config: Deployment configuration.

    Returns:
        True if application is responding.
    """
    log_info("Testing application...")

    time.sleep(5)

    result = run_command(["curl", "-sf", f"http://localhost:{config.app_port}"])
    if result.returncode == 0:
        log_info(f"Application is responding on port {config.app_port}")
        return True
    else:
        log_warning("Application not responding yet (may still be starting)")
        return True  # Non-critical


def get_zone_ip() -> str:
    """Get the zone IP address.

    Returns:
        IP address or 'N/A'.
    """
    result = run_command(["ip", "addr", "show", "net0"])
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            if "inet " in line:
                parts = line.strip().split()
                for i, part in enumerate(parts):
                    if part == "inet" and i + 1 < len(parts):
                        return parts[i + 1].split("/")[0]
    return "N/A"


def show_summary(config: DeployConfig) -> None:
    """Display deployment summary.

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
  App:      {config.log_dir}/app.log
  Error:    {config.log_dir}/error.log
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


def run_deploy(
    config: DeployConfig | None = None,
    skip_checks: bool = False,
) -> int:
    """Run the deployment process.

    Args:
        config: Deployment configuration (uses defaults if None).
        skip_checks: Skip environment checks (for testing).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = DeployConfig()

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

    configure_firewall(config)  # Non-critical
    setup_log_rotation(config)  # Non-critical
    create_maintenance_scripts()  # Non-critical

    if not start_application(config):
        return 1

    check_application_endpoint(config)  # Non-critical
    show_summary(config)

    return 0


def main() -> int:
    """Main entry point."""
    return run_deploy()


if __name__ == "__main__":
    sys.exit(main())
