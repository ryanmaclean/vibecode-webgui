#!/usr/bin/env python3
"""OpenIndiana Setup Wizard for VibeCode.

Comprehensive setup wizard that consolidates all OpenIndiana setup scripts
and walks the user through the full setup process.

Steps:
1. VM Setup - Create OpenIndiana VM (UTM/VirtualBox/KVM)
2. LX Zone - Configure LX-branded zone with Debian
3. Node.js - Install Node.js 24
4. PostgreSQL - Setup PostgreSQL 16 with pgvector
5. Deploy - Deploy VibeCode application
6. DTrace - Configure monitoring
"""

from __future__ import annotations

import hashlib
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    cyan: str = "\033[0;36m"
    bold: str = "\033[1m"
    reset: str = "\033[0m"


COLORS = Colors()


class Hypervisor(Enum):
    """Supported hypervisors."""

    UTM = "utm"
    VIRTUALBOX = "virtualbox"
    KVM = "kvm"


# Configuration constants
VM_NAME = "vibecode-openindiana"
VM_CPUS = 4
VM_MEMORY = 8192  # MB
VM_DISK_SIZE = "60G"
ISO_URL = "https://dlc.openindiana.org/isos/hipster/OI-hipster-gui-20231027.iso"
ISO_FILE = "OI-hipster-gui-20231027.iso"

ZONE_NAME = "vibecode-zone"
ZONE_PATH = f"/zones/{ZONE_NAME}"
ZONE_VNIC = "vibecode0"
ZONE_CPUS = 4
ZONE_MEMORY = "8G"
DEBIAN_IMAGE_URL = "https://us-central.manta.mnx.io/Joyent_Dev/public/lx-debian-11/lx-debian-11-latest.zss.gz"

DB_NAME = "vibecode"
DB_USER = "vibecode"
APP_USER = "vibecode"
APP_PORT = "3000"
INSTALL_DIR = "/opt/vibecode-webgui"


def ok(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}\u2713 {message}{COLORS.reset}")


def err(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}\u2717 {message}{COLORS.reset}")


def warn(message: str) -> None:
    """Print yellow warning message."""
    print(f"{COLORS.yellow}[WARN] {message}{COLORS.reset}")


def info(message: str) -> None:
    """Print blue info message."""
    print(f"{COLORS.blue}[INFO] {message}{COLORS.reset}")


def step(message: str) -> None:
    """Print cyan step message."""
    print(f"{COLORS.cyan}{COLORS.bold}{message}{COLORS.reset}")


def header(title: str) -> None:
    """Print section header."""
    print()
    print(f"{COLORS.bold}{'=' * 60}{COLORS.reset}")
    print(f"{COLORS.bold}  {title}{COLORS.reset}")
    print(f"{COLORS.bold}{'=' * 60}{COLORS.reset}")
    print()


def prompt_yes_no(question: str, default: bool = True) -> bool:
    """Prompt user for yes/no answer."""
    suffix = " [Y/n]: " if default else " [y/N]: "
    while True:
        response = input(f"{question}{suffix}").strip().lower()
        if not response:
            return default
        if response in ("y", "yes"):
            return True
        if response in ("n", "no"):
            return False
        print("Please enter 'y' or 'n'")


def prompt_choice(question: str, options: list[str], default: int = 0) -> int:
    """Prompt user to choose from options."""
    print(question)
    for i, option in enumerate(options):
        marker = "*" if i == default else " "
        print(f"  {marker} {i + 1}) {option}")
    while True:
        response = input(f"Enter choice [1-{len(options)}] (default: {default + 1}): ").strip()
        if not response:
            return default
        try:
            choice = int(response) - 1
            if 0 <= choice < len(options):
                return choice
        except ValueError:
            pass
        print(f"Please enter a number between 1 and {len(options)}")


def run_command(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
    capture_output: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)

    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        capture_output=capture_output,
        text=True,
        env=full_env,
    )


def run_silent(cmd: list[str]) -> bool:
    """Run a command silently, return True if successful."""
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def detect_platform() -> tuple[str, Hypervisor | None]:
    """Detect host platform and available hypervisor."""
    system = platform.system()

    if system == "Darwin":
        return "macos", Hypervisor.UTM
    elif system == "Linux":
        if shutil.which("virt-install"):
            return "linux", Hypervisor.KVM
        elif shutil.which("VBoxManage"):
            return "linux", Hypervisor.VIRTUALBOX
        return "linux", None
    elif system == "Windows":
        return "windows", Hypervisor.VIRTUALBOX

    return system.lower(), None


def download_file(url: str, dest: Path) -> bool:
    """Download a file using curl or wget."""
    if dest.exists():
        info(f"File already exists: {dest}")
        return True

    info(f"Downloading: {url}")

    if shutil.which("curl"):
        try:
            run_command(["curl", "-L", "-o", str(dest), url])
            return True
        except subprocess.CalledProcessError:
            return False
    elif shutil.which("wget"):
        try:
            run_command(["wget", "-O", str(dest), url])
            return True
        except subprocess.CalledProcessError:
            return False

    err("Neither curl nor wget found")
    return False


# =============================================================================
# Step 1: VM Setup
# =============================================================================


def show_utm_instructions() -> None:
    """Display UTM VM creation instructions."""
    print(f"""
{COLORS.cyan}UTM VM Creation Instructions{COLORS.reset}
{'=' * 50}

1. Open UTM application
2. Click "Create a New Virtual Machine"
3. Select "Virtualize" (for x86_64)
4. Select "Other" as operating system
5. Configure:
   - Name: {VM_NAME}
   - CPU Cores: {VM_CPUS}
   - Memory: {VM_MEMORY}MB
   - Storage: {VM_DISK_SIZE}
6. Add CD/DVD drive with: {ISO_FILE}
7. Network: Shared Network (or Bridged)
8. Click "Save" and start VM
9. Follow OpenIndiana installation wizard

Installation Tips:
- Use entire disk for ZFS
- Create root password
- Enable SSH server
- Set timezone appropriately

After installation:
- Boot into OpenIndiana
- Login as root
- Run: pkg install brand/lx git curl wget
- Continue with zone configuration
""")


def create_virtualbox_vm() -> bool:
    """Create VM with VirtualBox."""
    if not shutil.which("VBoxManage"):
        err("VBoxManage not found. Please install VirtualBox.")
        return False

    info("Creating VM with VirtualBox...")

    try:
        # Create VM
        run_command(["VBoxManage", "createvm", "--name", VM_NAME, "--ostype", "Solaris11_64", "--register"])

        # Set VM parameters
        run_command([
            "VBoxManage", "modifyvm", VM_NAME,
            "--memory", str(VM_MEMORY),
            "--cpus", str(VM_CPUS),
            "--vram", "128",
            "--graphicscontroller", "vmsvga",
            "--boot1", "dvd",
            "--boot2", "disk",
            "--acpi", "on",
            "--ioapic", "on",
            "--rtcuseutc", "on",
            "--hwvirtex", "on",
            "--nestedpaging", "on",
            "--largepages", "on",
            "--pae", "on",
        ])

        # Get VM directory
        result = run_command(
            ["VBoxManage", "showvminfo", VM_NAME, "--machinereadable"],
            capture_output=True,
        )
        vm_dir = None
        for line in result.stdout.split("\n"):
            if line.startswith("CfgFile="):
                config_path = line.split("=", 1)[1].strip('"')
                vm_dir = Path(config_path).parent
                break

        if not vm_dir:
            err("Could not determine VM directory")
            return False

        # Create disk
        disk_size_mb = int(VM_DISK_SIZE.replace("G", "")) * 1000
        disk_path = vm_dir / f"{VM_NAME}.vdi"
        run_command([
            "VBoxManage", "createhd",
            "--filename", str(disk_path),
            "--size", str(disk_size_mb),
            "--format", "VDI",
        ])

        # Add storage controller
        run_command([
            "VBoxManage", "storagectl", VM_NAME,
            "--name", "SATA Controller",
            "--add", "sata",
            "--controller", "IntelAhci",
            "--portcount", "2",
            "--bootable", "on",
        ])

        # Attach disk
        run_command([
            "VBoxManage", "storageattach", VM_NAME,
            "--storagectl", "SATA Controller",
            "--port", "0",
            "--device", "0",
            "--type", "hdd",
            "--medium", str(disk_path),
        ])

        # Attach ISO
        iso_path = Path.cwd() / ISO_FILE
        if iso_path.exists():
            run_command([
                "VBoxManage", "storageattach", VM_NAME,
                "--storagectl", "SATA Controller",
                "--port", "1",
                "--device", "0",
                "--type", "dvddrive",
                "--medium", str(iso_path),
            ])

        # Configure NAT networking with port forwarding
        run_command(["VBoxManage", "modifyvm", VM_NAME, "--nic1", "nat"])
        run_command(["VBoxManage", "modifyvm", VM_NAME, "--natpf1", "ssh,tcp,,2222,,22"])
        run_command(["VBoxManage", "modifyvm", VM_NAME, "--natpf1", "http,tcp,,3000,,3000"])

        ok(f"VM created successfully: {VM_NAME}")
        return True

    except subprocess.CalledProcessError as e:
        err(f"Failed to create VirtualBox VM: {e}")
        return False


def create_kvm_vm() -> bool:
    """Create VM with QEMU/KVM."""
    if not shutil.which("virt-install"):
        err("virt-install not found. Install: apt install virtinst")
        return False

    info("Creating VM with QEMU/KVM...")

    try:
        # Create disk image
        disk_path = f"/var/lib/libvirt/images/{VM_NAME}.qcow2"
        run_command(["qemu-img", "create", "-f", "qcow2", disk_path, VM_DISK_SIZE])

        # Create VM
        iso_path = Path.cwd() / ISO_FILE
        run_command([
            "virt-install",
            "--name", VM_NAME,
            "--ram", str(VM_MEMORY),
            "--vcpus", str(VM_CPUS),
            f"--disk", f"path={disk_path},format=qcow2,bus=virtio",
            "--cdrom", str(iso_path),
            "--os-variant", "solaris11",
            "--network", "network=default,model=virtio",
            "--graphics", "vnc,listen=0.0.0.0",
            "--console", "pty,target_type=serial",
            "--noautoconsole",
        ])

        ok(f"VM created successfully: {VM_NAME}")
        return True

    except subprocess.CalledProcessError as e:
        err(f"Failed to create KVM VM: {e}")
        return False


def setup_vm() -> bool:
    """Step 1: Setup OpenIndiana VM."""
    header("Step 1: OpenIndiana VM Setup")

    plat, hypervisor = detect_platform()
    info(f"Detected platform: {plat}")

    if hypervisor:
        info(f"Detected hypervisor: {hypervisor.value}")
    else:
        err("No supported hypervisor found")
        return False

    # Download ISO
    if prompt_yes_no("Download OpenIndiana ISO?"):
        iso_path = Path.cwd() / ISO_FILE
        if not download_file(ISO_URL, iso_path):
            err("Failed to download ISO")
            return False
        ok("ISO downloaded")

    # Create VM based on hypervisor
    if hypervisor == Hypervisor.UTM:
        show_utm_instructions()
        print("\nPlease complete the UTM setup manually.")
        if not prompt_yes_no("Have you completed the UTM setup?"):
            return False
    elif hypervisor == Hypervisor.VIRTUALBOX:
        if prompt_yes_no("Create VirtualBox VM automatically?"):
            if not create_virtualbox_vm():
                return False
            print(f"\nStart VM with: VBoxManage startvm \"{VM_NAME}\" --type gui")
    elif hypervisor == Hypervisor.KVM:
        if prompt_yes_no("Create KVM VM automatically?"):
            if not create_kvm_vm():
                return False
            print(f"\nConnect with: virt-viewer \"{VM_NAME}\"")

    print(f"""
{COLORS.green}VM setup complete!{COLORS.reset}

Next steps:
1. Boot the VM and install OpenIndiana from ISO
2. Use entire disk for ZFS
3. Set root password and enable SSH
4. After installation, login as root and run:
   pkg install brand/lx git curl wget

When ready, continue to zone configuration.
""")

    return prompt_yes_no("Continue to zone configuration?")


# =============================================================================
# Step 2: LX Zone Configuration
# =============================================================================


def check_root() -> bool:
    """Check if running as root."""
    return os.geteuid() == 0


def is_openindiana() -> bool:
    """Check if running on OpenIndiana."""
    return Path("/etc/release").exists() and "OpenIndiana" in Path("/etc/release").read_text()


def setup_lx_zone() -> bool:
    """Step 2: Configure LX-branded zone."""
    header("Step 2: LX Zone Configuration")

    if not is_openindiana():
        warn("This step must be run on the OpenIndiana VM")
        print("""
To configure the LX zone, SSH into your OpenIndiana VM and run:

  ./scripts/openindiana/02-configure-lx-zone.sh

Or run this wizard again from within the VM.
""")
        return prompt_yes_no("Skip zone setup and continue?")

    if not check_root():
        err("This step must be run as root")
        return False

    info("Configuring LX-branded zone...")

    # Install lx brand support
    step("Installing lx-branded zone support...")
    if not run_silent(["pkg", "list", "brand/lx"]):
        try:
            run_command(["pkg", "install", "-v", "brand/lx"])
            ok("lx-branded zone installed")
        except subprocess.CalledProcessError:
            err("Failed to install lx-branded zone")
            return False

    # Download Debian image
    step("Downloading Debian 11 image...")
    debian_image = Path("lx-debian-11-latest.zss")
    if not debian_image.exists():
        compressed = Path(f"{debian_image}.gz")
        if not compressed.exists():
            if not download_file(DEBIAN_IMAGE_URL, compressed):
                return False

        info("Decompressing image...")
        run_command(["gunzip", str(compressed)])

    ok("Debian image ready")

    # Detect primary network interface
    step("Detecting network interface...")
    result = run_command(["dladm", "show-phys", "-p", "-o", "LINK"], capture_output=True)
    primary_nic = result.stdout.strip().split("\n")[0]
    info(f"Primary NIC: {primary_nic}")

    # Create VNIC
    step(f"Creating VNIC: {ZONE_VNIC}")
    if run_silent(["dladm", "show-vnic", ZONE_VNIC]):
        warn(f"VNIC {ZONE_VNIC} already exists")
    else:
        run_command(["dladm", "create-vnic", "-l", primary_nic, "-p", "maxbw=1000", ZONE_VNIC])
        ok("VNIC created")

    # Create ZFS datasets
    step("Creating ZFS datasets...")
    datasets = [
        f"rpool/zones/{ZONE_NAME}",
        f"rpool/zones/{ZONE_NAME}/postgres",
        f"rpool/zones/{ZONE_NAME}/redis",
        f"rpool/zones/{ZONE_NAME}/app",
    ]

    for dataset in datasets:
        if not run_silent(["zfs", "list", dataset]):
            run_command(["zfs", "create", dataset])
            ok(f"Created {dataset}")

    # Set ZFS properties for postgres
    run_command(["zfs", "set", "recordsize=8K", f"rpool/zones/{ZONE_NAME}/postgres"])
    run_command(["zfs", "set", "logbias=latency", f"rpool/zones/{ZONE_NAME}/postgres"])

    # Create zone configuration
    step("Creating zone configuration...")
    zone_config = f"""create -t lx
set zonepath={ZONE_PATH}
set autoboot=true
set ip-type=exclusive
add net
set physical={ZONE_VNIC}
end
add attr
set name=resolvers
set type=string
set value=8.8.8.8,8.8.4.4
end
add capped-cpu
set ncpus={ZONE_CPUS}
end
add capped-memory
set physical={ZONE_MEMORY}
set swap=10G
end
"""

    # Check if zone exists
    result = run_command(["zoneadm", "list", "-cp"], capture_output=True)
    if f"{ZONE_NAME}:" in result.stdout:
        warn(f"Zone {ZONE_NAME} already exists")
        if prompt_yes_no("Remove existing zone?", default=False):
            run_command(["zoneadm", "-z", ZONE_NAME, "halt"], check=False)
            run_command(["zoneadm", "-z", ZONE_NAME, "uninstall", "-F"], check=False)
            run_command(["zonecfg", "-z", ZONE_NAME, "delete", "-F"], check=False)
        else:
            return True

    # Create zone
    proc = subprocess.Popen(
        ["zonecfg", "-z", ZONE_NAME],
        stdin=subprocess.PIPE,
        text=True,
    )
    proc.communicate(zone_config)
    ok("Zone configuration created")

    # Install zone
    step("Installing zone from Debian image...")
    run_command(["zoneadm", "-z", ZONE_NAME, "install", "-s", str(debian_image)])
    ok("Zone installed")

    # Boot zone
    step("Booting zone...")
    run_command(["zoneadm", "-z", ZONE_NAME, "boot"])
    info("Waiting for zone to boot...")
    time.sleep(10)

    # Verify zone is running
    result = run_command(["zoneadm", "list", "-v"], capture_output=True)
    if f"{ZONE_NAME}" in result.stdout and "running" in result.stdout:
        ok("Zone is running")
    else:
        err("Zone failed to boot")
        return False

    print(f"""
{COLORS.green}LX Zone configured!{COLORS.reset}

Zone: {ZONE_NAME}
Path: {ZONE_PATH}

Access zone with:
  zlogin {ZONE_NAME}

Zone console:
  zlogin -C {ZONE_NAME}  (Ctrl+] to exit)
""")

    return True


# =============================================================================
# Step 3: Node.js Installation
# =============================================================================


def install_node24() -> bool:
    """Step 3: Install Node.js 24."""
    header("Step 3: Node.js 24 Installation")

    # Check if we're in the zone
    if not Path("/etc/debian_version").exists():
        warn("This step should be run inside the Debian lx zone")
        print(f"\nTo install Node.js, login to the zone:\n  zlogin {ZONE_NAME}\n")
        return prompt_yes_no("Skip Node.js installation?")

    # Check if Node.js is already installed
    if shutil.which("node"):
        result = run_command(["node", "--version"], capture_output=True)
        version = result.stdout.strip()
        if version.startswith("v24"):
            ok(f"Node.js {version} already installed")
            return True
        else:
            info(f"Found Node.js {version}, upgrading to v24...")

    step("Installing Node.js 24...")

    try:
        # Update package lists
        run_command(["apt", "update"])

        # Install prerequisites
        run_command(["apt", "install", "-y", "curl", "gnupg"])

        # Add NodeSource repository for Node.js 24
        run_command([
            "bash", "-c",
            "curl -fsSL https://deb.nodesource.com/setup_24.x | bash -"
        ])

        # Install Node.js
        run_command(["apt", "install", "-y", "nodejs"])

        # Verify installation
        result = run_command(["node", "--version"], capture_output=True)
        version = result.stdout.strip()
        ok(f"Node.js {version} installed")

        result = run_command(["npm", "--version"], capture_output=True)
        npm_version = result.stdout.strip()
        ok(f"npm {npm_version} installed")

        return True

    except subprocess.CalledProcessError as e:
        err(f"Failed to install Node.js: {e}")
        return False


# =============================================================================
# Step 4: PostgreSQL Setup
# =============================================================================


def generate_password() -> str:
    """Generate a secure random password."""
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(25))


def setup_postgres() -> bool:
    """Step 4: Setup PostgreSQL 16 with pgvector."""
    header("Step 4: PostgreSQL + pgvector Setup")

    if not Path("/etc/debian_version").exists():
        warn("This step should be run inside the Debian lx zone")
        return prompt_yes_no("Skip PostgreSQL installation?")

    if not check_root():
        err("This step must be run as root")
        return False

    db_password = generate_password()

    step("Installing PostgreSQL 16...")
    try:
        # Install PostgreSQL repository setup
        run_command(["apt", "install", "-y", "postgresql-common"])
        run_command(["/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh", "-y"])

        # Install PostgreSQL
        run_command([
            "apt", "install", "-y",
            "postgresql-16",
            "postgresql-contrib-16",
            "postgresql-client-16",
            "postgresql-server-dev-16",
            "postgresql-16-pgvector",
        ])

        ok("PostgreSQL 16 with pgvector installed")

    except subprocess.CalledProcessError as e:
        err(f"Failed to install PostgreSQL: {e}")
        return False

    # Configure PostgreSQL
    step("Configuring PostgreSQL for ZFS...")
    pg_conf = Path("/etc/postgresql/16/main/postgresql.conf")

    # Calculate memory settings
    try:
        result = run_command(["free", "-m"], capture_output=True)
        for line in result.stdout.split("\n"):
            if line.startswith("Mem:"):
                total_ram = int(line.split()[1])
                break
        shared_buffers = total_ram // 4
        effective_cache = total_ram * 3 // 4
    except Exception:
        shared_buffers = 2048
        effective_cache = 6144

    config_additions = f"""

# VibeCode Optimizations for ZFS
shared_buffers = {shared_buffers}MB
effective_cache_size = {effective_cache}MB
maintenance_work_mem = 512MB
work_mem = 32MB
wal_compression = on
full_page_writes = off
checkpoint_completion_target = 0.9
max_connections = 200
random_page_cost = 1.1
effective_io_concurrency = 200
shared_preload_libraries = 'pg_stat_statements'
"""

    with open(pg_conf, "a") as f:
        f.write(config_additions)

    # Restart PostgreSQL
    run_command(["systemctl", "restart", "postgresql"])
    ok("PostgreSQL configured")

    # Create database and user
    step("Creating database and user...")
    sql_commands = f"""
CREATE USER {DB_USER} WITH PASSWORD '{db_password}';
CREATE DATABASE {DB_NAME} OWNER {DB_USER};
GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};
\\c {DB_NAME}
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT ALL ON SCHEMA public TO {DB_USER};
"""

    proc = subprocess.Popen(
        ["sudo", "-u", "postgres", "psql"],
        stdin=subprocess.PIPE,
        text=True,
    )
    proc.communicate(sql_commands)
    ok("Database created with pgvector extension")

    # Save credentials
    creds_path = Path("/root/postgres-credentials.txt")
    creds_content = f"""PostgreSQL Connection Details
=============================

Host: localhost
Port: 5432
Database: {DB_NAME}
User: {DB_USER}
Password: {db_password}

Connection String:
postgresql://{DB_USER}:{db_password}@localhost:5432/{DB_NAME}

DATABASE_URL="postgresql://{DB_USER}:{db_password}@localhost:5432/{DB_NAME}?schema=public"
"""
    creds_path.write_text(creds_content)
    creds_path.chmod(0o600)

    ok(f"Credentials saved to: {creds_path}")

    print(f"""
{COLORS.green}PostgreSQL Setup Complete!{COLORS.reset}

Database: {DB_NAME}
User: {DB_USER}
Password: (saved in /root/postgres-credentials.txt)

Extensions: vector, pg_stat_statements

Test connection:
  psql -U {DB_USER} -d {DB_NAME} -h localhost
""")

    return True


# =============================================================================
# Step 5: Deploy VibeCode
# =============================================================================


def deploy_vibecode() -> bool:
    """Step 5: Deploy VibeCode application."""
    header("Step 5: Deploy VibeCode Application")

    if not Path("/etc/debian_version").exists():
        warn("This step should be run inside the Debian lx zone")
        return prompt_yes_no("Skip application deployment?")

    if not check_root():
        err("This step must be run as root")
        return False

    # Check prerequisites
    if not shutil.which("node"):
        err("Node.js not found. Complete step 3 first.")
        return False

    if not run_silent(["systemctl", "is-active", "postgresql"]):
        err("PostgreSQL not running. Complete step 4 first.")
        return False

    # Create app user
    step("Creating application user...")
    if not run_silent(["id", APP_USER]):
        run_command(["useradd", "-m", "-s", "/bin/bash", APP_USER])
        ok(f"User {APP_USER} created")
    else:
        ok(f"User {APP_USER} already exists")

    # Clone repository
    step("Cloning repository...")
    install_path = Path(INSTALL_DIR)
    repo_url = input(f"Enter repository URL (default: https://github.com/your-org/vibecode-webgui.git): ").strip()
    if not repo_url:
        repo_url = "https://github.com/your-org/vibecode-webgui.git"

    if install_path.exists():
        info("Directory exists, pulling latest changes...")
        run_command(["sudo", "-u", APP_USER, "git", "pull"], cwd=install_path)
    else:
        run_command(["sudo", "-u", APP_USER, "git", "clone", repo_url, str(install_path)])

    ok("Repository cloned")

    # Install dependencies
    step("Installing dependencies...")
    run_command(["sudo", "-u", APP_USER, "npm", "install"], cwd=install_path)
    ok("Dependencies installed")

    # Configure environment
    step("Configuring environment...")
    creds_file = Path("/root/postgres-credentials.txt")
    db_url = ""
    if creds_file.exists():
        for line in creds_file.read_text().split("\n"):
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip('"')
                break

    import secrets
    nextauth_secret = secrets.token_urlsafe(32)
    api_key = secrets.token_hex(32)

    env_content = f"""# VibeCode Environment Configuration

DATABASE_URL="{db_url}"
NEXTAUTH_URL="http://localhost:{APP_PORT}"
NEXTAUTH_SECRET="{nextauth_secret}"
NODE_ENV="production"
PORT="{APP_PORT}"
API_KEY="{api_key}"

# Configure with your API keys:
# OPENAI_API_KEY="your-key"
# ANTHROPIC_API_KEY="your-key"
"""

    env_path = install_path / ".env"
    env_path.write_text(env_content)
    run_command(["chown", f"{APP_USER}:{APP_USER}", str(env_path)])
    env_path.chmod(0o600)

    ok("Environment configured")

    # Build application
    step("Building application...")
    run_command(["sudo", "-u", APP_USER, "npx", "prisma", "generate"], cwd=install_path, check=False)
    run_command(["sudo", "-u", APP_USER, "npx", "prisma", "migrate", "deploy"], cwd=install_path, check=False)
    run_command(["sudo", "-u", APP_USER, "npm", "run", "build"], cwd=install_path)
    ok("Application built")

    # Create systemd service
    step("Creating systemd service...")
    service_content = f"""[Unit]
Description=VibeCode Application Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User={APP_USER}
WorkingDirectory={INSTALL_DIR}
Environment="NODE_ENV=production"
Environment="PORT={APP_PORT}"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/vibecode/app.log
StandardError=append:/var/log/vibecode/error.log
NoNewPrivileges=true
PrivateTmp=true
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
"""

    service_path = Path("/etc/systemd/system/vibecode.service")
    service_path.write_text(service_content)

    # Create log directory
    log_dir = Path("/var/log/vibecode")
    log_dir.mkdir(parents=True, exist_ok=True)
    run_command(["chown", f"{APP_USER}:{APP_USER}", str(log_dir)])

    # Enable and start service
    run_command(["systemctl", "daemon-reload"])
    run_command(["systemctl", "enable", "vibecode"])
    run_command(["systemctl", "start", "vibecode"])

    ok("Application deployed and started")

    print(f"""
{COLORS.green}VibeCode Deployment Complete!{COLORS.reset}

Application URL: http://localhost:{APP_PORT}
Install Directory: {INSTALL_DIR}

Service Management:
  systemctl status vibecode
  systemctl restart vibecode
  journalctl -u vibecode -f

IMPORTANT: Update .env with your API keys:
  {install_path}/.env
""")

    return True


# =============================================================================
# Step 6: DTrace Configuration
# =============================================================================


def configure_dtrace() -> bool:
    """Step 6: Configure DTrace monitoring."""
    header("Step 6: DTrace Monitoring Setup")

    if not is_openindiana():
        warn("DTrace configuration requires OpenIndiana")
        return prompt_yes_no("Skip DTrace setup?")

    if not check_root():
        err("This step must be run as root")
        return False

    step("Creating DTrace monitoring scripts...")

    scripts_dir = Path("/opt/vibecode-dtrace")
    scripts_dir.mkdir(parents=True, exist_ok=True)

    # Create Node.js profiling script
    node_profile = scripts_dir / "node-profile.d"
    node_profile.write_text("""#!/usr/sbin/dtrace -s
/* Node.js CPU profiling */
profile-997hz
/execname == "node"/
{
    @[ustack(100)] = count();
}

tick-30s
{
    exit(0);
}
""")
    node_profile.chmod(0o755)

    # Create syscall tracing script
    syscall_trace = scripts_dir / "syscall-trace.d"
    syscall_trace.write_text("""#!/usr/sbin/dtrace -s
/* Syscall tracing for VibeCode processes */
syscall:::entry
/execname == "node" || execname == "postgres"/
{
    @[execname, probefunc] = count();
}

tick-10s
{
    printa(@);
    trunc(@);
}
""")
    syscall_trace.chmod(0o755)

    ok("DTrace scripts created in /opt/vibecode-dtrace/")

    print(f"""
{COLORS.green}DTrace Setup Complete!{COLORS.reset}

Scripts:
  /opt/vibecode-dtrace/node-profile.d  - CPU profiling
  /opt/vibecode-dtrace/syscall-trace.d - Syscall tracing

Usage:
  dtrace -s /opt/vibecode-dtrace/node-profile.d
  dtrace -s /opt/vibecode-dtrace/syscall-trace.d
""")

    return True


# =============================================================================
# Main Wizard
# =============================================================================


def show_welcome() -> None:
    """Display welcome message."""
    print(f"""
{COLORS.bold}{COLORS.cyan}
 ╔═══════════════════════════════════════════════════════════╗
 ║     VibeCode OpenIndiana Setup Wizard                     ║
 ╠═══════════════════════════════════════════════════════════╣
 ║  This wizard will guide you through setting up VibeCode   ║
 ║  on OpenIndiana with ZFS, LX zones, and DTrace support.   ║
 ╚═══════════════════════════════════════════════════════════╝
{COLORS.reset}

Steps:
  1. VM Setup      - Create OpenIndiana VM (UTM/VirtualBox/KVM)
  2. LX Zone       - Configure LX-branded zone with Debian
  3. Node.js       - Install Node.js 24
  4. PostgreSQL    - Setup PostgreSQL 16 with pgvector
  5. Deploy        - Deploy VibeCode application
  6. DTrace        - Configure monitoring scripts

Note: Some steps must be run on specific systems:
  - Step 1: Run on your host machine (macOS/Linux/Windows)
  - Steps 2, 6: Run on OpenIndiana VM as root
  - Steps 3-5: Run inside the LX zone as root
""")


def main() -> int:
    """Main entry point."""
    show_welcome()

    if not prompt_yes_no("Start the setup wizard?"):
        print("Setup cancelled.")
        return 0

    # Detect where we are running
    plat = platform.system()
    in_zone = Path("/etc/debian_version").exists()
    on_openindiana = is_openindiana()

    # Determine which steps to run
    print("\nWhich steps would you like to run?")
    options = [
        "All steps (interactive)",
        "Step 1: VM Setup only",
        "Step 2: LX Zone only",
        "Step 3: Node.js only",
        "Step 4: PostgreSQL only",
        "Step 5: Deploy only",
        "Step 6: DTrace only",
        "Steps 3-5: Zone setup (Node.js + PostgreSQL + Deploy)",
    ]

    choice = prompt_choice("Select option:", options)

    steps = {
        0: [1, 2, 3, 4, 5, 6],
        1: [1],
        2: [2],
        3: [3],
        4: [4],
        5: [5],
        6: [6],
        7: [3, 4, 5],
    }

    selected_steps = steps[choice]

    # Run selected steps
    success = True
    for step_num in selected_steps:
        if step_num == 1:
            if not setup_vm():
                success = False
                break
        elif step_num == 2:
            if not setup_lx_zone():
                success = False
                break
        elif step_num == 3:
            if not install_node24():
                success = False
                break
        elif step_num == 4:
            if not setup_postgres():
                success = False
                break
        elif step_num == 5:
            if not deploy_vibecode():
                success = False
                break
        elif step_num == 6:
            if not configure_dtrace():
                success = False
                break

        if step_num < max(selected_steps):
            if not prompt_yes_no("Continue to next step?"):
                break

    if success:
        header("Setup Complete!")
        print(f"""
{COLORS.green}VibeCode OpenIndiana setup completed successfully!{COLORS.reset}

Summary:
  - OpenIndiana VM with ZFS
  - LX-branded zone running Debian 11
  - Node.js 24
  - PostgreSQL 16 with pgvector
  - VibeCode application deployed
  - DTrace monitoring scripts

Access your application:
  From zone: http://localhost:{APP_PORT}
  From host: Check zone IP with 'ip addr show net0'

Useful commands:
  Zone access:    zlogin {ZONE_NAME}
  App status:     systemctl status vibecode
  App logs:       journalctl -u vibecode -f
  DB console:     sudo -u postgres psql
  Zone stats:     prstat -Z
  DTrace:         dtrace -s /opt/vibecode-dtrace/node-profile.d

Documentation:
  https://docs.vibecode.com/platforms/openindiana/
""")
        return 0
    else:
        err("Setup incomplete. Please resolve errors and run again.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
