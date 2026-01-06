#!/usr/bin/env python3
"""
VibeCode VM Manager - Native Apple Virtualization Framework Menu

A console-based menu system for managing VibeCode VMs on macOS.
Provides easy access to build, run, and manage VMs.

Usage:
    python3 scripts/vibecode_vm_menu.py
    
    Or make executable:
    chmod +x scripts/vibecode_vm_menu.py
    ./scripts/vibecode_vm_menu.py
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import os
import sys
import subprocess
import signal
from pathlib import Path
from typing import Optional, List, Dict

# Add scripts to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.prompt import Prompt, Confirm
    from rich.text import Text
    from rich.live import Live
    from rich.spinner import Spinner
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Note: Install 'rich' for better UI: pip install rich")

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
AZURE_DIR = PROJECT_ROOT / "azure"
SWIFTUI_APPS_DIR = AZURE_DIR / "SwiftUI-Apps"
ANSIBLE_DIR = PROJECT_ROOT / "ansible"
VM_BUNDLES_DIR = Path.home() / "VibeCode VMs"

# Console for rich output
console = Console() if RICH_AVAILABLE else None


def clear_screen():
    """Clear terminal screen."""
    os.system('clear' if os.name != 'nt' else 'cls')


def print_header():
    """Print menu header."""
    if RICH_AVAILABLE:
        console.print(Panel.fit(
            "[bold cyan]VibeCode VM Manager[/bold cyan]\n"
            "[dim]Native Apple Virtualization Framework[/dim]",
            border_style="cyan"
        ))
    else:
        print("=" * 50)
        print("  VibeCode VM Manager")
        print("  Native Apple Virtualization Framework")
        print("=" * 50)
    print()


def run_command(cmd: List[str], capture: bool = False) -> tuple:
    """Run a shell command."""
    try:
        if capture:
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode, result.stdout, result.stderr
        else:
            result = subprocess.run(cmd)
            return result.returncode, "", ""
    except Exception as e:
        return 1, "", str(e)


def get_running_vms() -> List[Dict]:
    """Get list of running VM processes."""
    vms = []
    code, stdout, _ = run_command(["pgrep", "-fl", "VibeCode"], capture=True)
    if code == 0:
        for line in stdout.strip().split('\n'):
            if 'VibeCodeServicesVibeCode' in line and 'grep' not in line:
                parts = line.split(maxsplit=1)
                if len(parts) >= 2:
                    pid = parts[0]
                    path = parts[1] if len(parts) > 1 else "unknown"
                    vms.append({"pid": pid, "path": path})
    return vms


def get_vm_bundles() -> List[Path]:
    """Get list of VM bundle directories."""
    if VM_BUNDLES_DIR.exists():
        return list(VM_BUNDLES_DIR.glob("*.bundle"))
    return []


def scan_vm_ips() -> List[str]:
    """Scan for VM IPs on the network."""
    ips = []
    for i in range(2, 20):
        ip = f"192.168.64.{i}"
        code, _, _ = run_command(["nc", "-zw1", ip, "22"], capture=True)
        if code == 0:
            ips.append(ip)
    return ips


def show_status():
    """Show current VM status."""
    clear_screen()
    print_header()
    
    if RICH_AVAILABLE:
        console.print("[bold]VM Status[/bold]\n")
    else:
        print("VM Status\n")
    
    # Running VMs
    vms = get_running_vms()
    if RICH_AVAILABLE:
        table = Table(title="Running VMs")
        table.add_column("PID", style="cyan")
        table.add_column("App Path", style="green")
        for vm in vms:
            table.add_row(vm["pid"], vm["path"][:60] + "..." if len(vm["path"]) > 60 else vm["path"])
        if vms:
            console.print(table)
        else:
            console.print("[yellow]No VMs currently running[/yellow]")
    else:
        print(f"Running VMs: {len(vms)}")
        for vm in vms:
            print(f"  PID {vm['pid']}: {vm['path'][:50]}...")
    
    print()
    
    # VM Bundles
    bundles = get_vm_bundles()
    if RICH_AVAILABLE:
        console.print(f"[bold]VM Bundles:[/bold] {len(bundles)} in ~/VibeCode VMs/")
        for b in bundles[:5]:
            console.print(f"  • {b.name}")
        if len(bundles) > 5:
            console.print(f"  ... and {len(bundles) - 5} more")
    else:
        print(f"VM Bundles: {len(bundles)}")
        for b in bundles[:5]:
            print(f"  - {b.name}")
    
    print()
    
    # Scan for active VMs
    if RICH_AVAILABLE:
        console.print("[bold]Scanning network for VMs...[/bold]")
    else:
        print("Scanning network for VMs...")
    
    ips = scan_vm_ips()
    if ips:
        if RICH_AVAILABLE:
            table = Table(title="Active VMs on Network")
            table.add_column("IP Address", style="cyan")
            table.add_column("Services", style="green")
            for ip in ips:
                services = []
                for port, name in [(6379, "Valkey"), (5432, "PostgreSQL"), (8080, "OpenVSCode"), (22, "SSH")]:
                    code, _, _ = run_command(["nc", "-zw1", ip, str(port)], capture=True)
                    if code == 0:
                        services.append(name)
                table.add_row(ip, ", ".join(services))
            console.print(table)
        else:
            print(f"Found {len(ips)} VMs:")
            for ip in ips:
                print(f"  - {ip}")
    else:
        print("No VMs found on network")
    
    input("\nPress Enter to continue...")


def build_initramfs():
    """Build the initramfs using Ansible."""
    clear_screen()
    print_header()
    
    if RICH_AVAILABLE:
        console.print("[bold]Building Initramfs[/bold]\n")
        console.print("This will build a new initramfs with all services.\n")
    else:
        print("Building Initramfs\n")
    
    playbook = ANSIBLE_DIR / "playbooks" / "build-initramfs-static.yml"
    inventory = ANSIBLE_DIR / "inventory" / "localhost.yml"
    
    if not playbook.exists():
        print(f"Error: Playbook not found at {playbook}")
        input("\nPress Enter to continue...")
        return
    
    if RICH_AVAILABLE:
        if not Confirm.ask("Build new initramfs?"):
            return
    else:
        resp = input("Build new initramfs? (y/n): ")
        if resp.lower() != 'y':
            return
    
    print("\nRunning Ansible playbook...\n")
    cmd = ["ansible-playbook", "-i", str(inventory), str(playbook)]
    run_command(cmd)
    
    input("\nPress Enter to continue...")


def build_swift_app():
    """Build or rebuild the Swift VM app."""
    clear_screen()
    print_header()
    
    if RICH_AVAILABLE:
        console.print("[bold]Build Swift VM App[/bold]\n")
    else:
        print("Build Swift VM App\n")
    
    # Check for build script
    build_script = SWIFTUI_APPS_DIR / "build_vibecodeservices.sh"
    
    if build_script.exists():
        print(f"Found build script: {build_script}\n")
        
        if RICH_AVAILABLE:
            if not Confirm.ask("Rebuild Swift app?"):
                return
        else:
            resp = input("Rebuild Swift app? (y/n): ")
            if resp.lower() != 'y':
                return
        
        print("\nBuilding...\n")
        os.chdir(SWIFTUI_APPS_DIR)
        run_command(["bash", str(build_script)])
    else:
        print("Build script not found. Generating new app...\n")
        generator = PROJECT_ROOT / "scripts" / "build_gui_linux_vm_swift.py"
        if generator.exists():
            run_command(["python3", str(generator), "--name", "VibeCodeServices"])
            # Now build it
            if build_script.exists():
                run_command(["bash", str(build_script)])
        else:
            print(f"Error: Generator not found at {generator}")
    
    input("\nPress Enter to continue...")


def start_vm():
    """Start a new VM instance."""
    clear_screen()
    print_header()
    
    if RICH_AVAILABLE:
        console.print("[bold]Start VM[/bold]\n")
    else:
        print("Start VM\n")
    
    app_path = SWIFTUI_APPS_DIR / "VibeCodeServicesVibeCode.app"
    
    if not app_path.exists():
        print(f"VM app not found at {app_path}")
        print("Please build the app first (option 3)")
        input("\nPress Enter to continue...")
        return
    
    print(f"Starting VM from: {app_path}\n")
    run_command(["open", str(app_path)])
    
    print("VM starting... Wait ~30 seconds for services to be ready.")
    print("\nServices will be available at the DHCP-assigned IP:")
    print("  - Valkey: <IP>:6379")
    print("  - PostgreSQL: <IP>:5432")
    print("  - OpenVSCode: http://<IP>:8080")
    print("  - SSH: ssh root@<IP> (password: vibecode)")
    
    input("\nPress Enter to continue...")


def stop_vms():
    """Stop running VMs."""
    clear_screen()
    print_header()
    
    if RICH_AVAILABLE:
        console.print("[bold]Stop VMs[/bold]\n")
    else:
        print("Stop VMs\n")
    
    vms = get_running_vms()
    
    if not vms:
        print("No VMs currently running.")
        input("\nPress Enter to continue...")
        return
    
    print(f"Found {len(vms)} running VM(s):\n")
    for i, vm in enumerate(vms, 1):
        print(f"  {i}. PID {vm['pid']}")
    
    print(f"\n  A. Stop ALL VMs")
    print(f"  0. Cancel")
    
    choice = input("\nSelect VM to stop (number/A/0): ").strip()
    
    if choice == '0':
        return
    elif choice.upper() == 'A':
        run_command(["killall", "VibeCodeServicesVibeCode"])
        print("\nAll VMs stopped.")
    elif choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(vms):
            run_command(["kill", vms[idx]["pid"]])
            print(f"\nVM with PID {vms[idx]['pid']} stopped.")
        else:
            print("Invalid selection.")
    
    input("\nPress Enter to continue...")


def connect_ssh():
    """Connect to a VM via SSH."""
    clear_screen()
    print_header()
    
    if RICH_AVAILABLE:
        console.print("[bold]SSH to VM[/bold]\n")
    else:
        print("SSH to VM\n")
    
    print("Scanning for VMs...")
    ips = scan_vm_ips()
    
    if not ips:
        print("No VMs found on network.")
        input("\nPress Enter to continue...")
        return
    
    print(f"\nFound {len(ips)} VM(s):\n")
    for i, ip in enumerate(ips, 1):
        print(f"  {i}. {ip}")
    print(f"\n  0. Cancel")
    
    choice = input("\nSelect VM (number): ").strip()
    
    if choice == '0':
        return
    elif choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(ips):
            ip = ips[idx]
            print(f"\nConnecting to {ip}...")
            print("Password: vibecode\n")
            os.system(f"ssh -o StrictHostKeyChecking=no root@{ip}")
    
    input("\nPress Enter to continue...")


def open_vscode():
    """Open OpenVSCode in browser."""
    clear_screen()
    print_header()
    
    if RICH_AVAILABLE:
        console.print("[bold]Open VSCode[/bold]\n")
    else:
        print("Open VSCode\n")
    
    print("Scanning for VMs...")
    ips = scan_vm_ips()
    
    if not ips:
        print("No VMs found on network.")
        input("\nPress Enter to continue...")
        return
    
    print(f"\nFound {len(ips)} VM(s):\n")
    for i, ip in enumerate(ips, 1):
        # Check if OpenVSCode is running
        code, _, _ = run_command(["nc", "-zw1", ip, "8080"], capture=True)
        status = "✓ OpenVSCode running" if code == 0 else "✗ OpenVSCode not available"
        print(f"  {i}. {ip} - {status}")
    print(f"\n  0. Cancel")
    
    choice = input("\nSelect VM (number): ").strip()
    
    if choice == '0':
        return
    elif choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(ips):
            ip = ips[idx]
            url = f"http://{ip}:8080"
            print(f"\nOpening {url}...")
            run_command(["open", url])
    
    input("\nPress Enter to continue...")


def clean_bundles():
    """Clean up VM bundles."""
    clear_screen()
    print_header()
    
    if RICH_AVAILABLE:
        console.print("[bold]Clean VM Bundles[/bold]\n")
    else:
        print("Clean VM Bundles\n")
    
    bundles = get_vm_bundles()
    
    if not bundles:
        print("No VM bundles found.")
        input("\nPress Enter to continue...")
        return
    
    print(f"Found {len(bundles)} VM bundle(s):\n")
    total_size = 0
    for b in bundles:
        size = sum(f.stat().st_size for f in b.rglob('*') if f.is_file())
        total_size += size
        print(f"  - {b.name} ({size / 1024 / 1024:.1f} MB)")
    
    print(f"\nTotal: {total_size / 1024 / 1024:.1f} MB")
    
    if RICH_AVAILABLE:
        if not Confirm.ask("\nDelete ALL VM bundles?"):
            return
    else:
        resp = input("\nDelete ALL VM bundles? (y/n): ")
        if resp.lower() != 'y':
            return
    
    # Stop VMs first
    run_command(["killall", "VibeCodeServicesVibeCode"], capture=True)
    
    import shutil
    for b in bundles:
        shutil.rmtree(b)
        print(f"Deleted: {b.name}")
    
    print("\nAll VM bundles cleaned.")
    input("\nPress Enter to continue...")


def show_help():
    """Show help and documentation."""
    clear_screen()
    print_header()
    
    help_text = """
VIBECOCE VM MANAGER HELP
========================

This tool manages native macOS VMs using Apple's Virtualization Framework.

SERVICES IN EACH VM:
  • Valkey (Redis-compatible) - Port 6379
  • PostgreSQL 16 - Port 5432  
  • OpenVSCode Server - Port 8080
  • Dropbear SSH - Port 22 (password: vibecode)

QUICK START:
  1. Build initramfs (option 2) - only needed once
  2. Build Swift app (option 3) - only needed once
  3. Start VM (option 4)
  4. Wait ~30 seconds for services
  5. Check status (option 1) to find VM IP

MULTIPLE VMS:
  Each VM instance gets a unique DHCP IP address.
  You can run multiple VMs simultaneously.

NETWORK:
  VMs use NAT networking on 192.168.64.x subnet.
  DHCP assigns IPs automatically.

FILES:
  • VM App: azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
  • Initramfs: azure/unified-services-static.cpio.gz
  • Kernel: azure/linux-kernel-arm64
  • VM Bundles: ~/VibeCode VMs/

REQUIREMENTS:
  • macOS 13+ (Ventura or later)
  • Apple Silicon or Intel Mac
  • Xcode Command Line Tools
  • Ansible (for building initramfs)
"""
    print(help_text)
    input("\nPress Enter to continue...")


def main_menu():
    """Main menu loop."""
    while True:
        clear_screen()
        print_header()
        
        menu_items = [
            ("1", "Show VM Status", show_status),
            ("2", "Build Initramfs (Ansible)", build_initramfs),
            ("3", "Build Swift App", build_swift_app),
            ("4", "Start New VM", start_vm),
            ("5", "Stop VMs", stop_vms),
            ("6", "SSH to VM", connect_ssh),
            ("7", "Open VSCode in Browser", open_vscode),
            ("8", "Clean VM Bundles", clean_bundles),
            ("9", "Help", show_help),
            ("0", "Exit", None),
        ]
        
        if RICH_AVAILABLE:
            table = Table(show_header=False, box=None)
            table.add_column("Key", style="cyan", width=4)
            table.add_column("Action", style="white")
            for key, label, _ in menu_items:
                table.add_row(f"[{key}]", label)
            console.print(table)
        else:
            for key, label, _ in menu_items:
                print(f"  [{key}] {label}")
        
        print()
        choice = input("Select option: ").strip()
        
        if choice == '0':
            print("\nGoodbye!")
            break
        
        for key, _, action in menu_items:
            if choice == key and action:
                action()
                break


def main():
    """Entry point."""
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, lambda s, f: (print("\n\nExiting..."), sys.exit(0)))
    
    try:
        main_menu()
    except KeyboardInterrupt:
        print("\n\nExiting...")
        sys.exit(0)


if __name__ == "__main__":
    main()

