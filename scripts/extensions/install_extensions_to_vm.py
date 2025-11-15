#!/usr/bin/env python3

"""
Install Extensions to OpenVSCode Server VM
Configures extensions to be pre-installed in VM images with Datadog tracing
"""

import os
import sys
import json
import argparse
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

# Datadog tracing
try:
    from ddtrace import tracer, patch
    patch(logging=True)
    TRACING_ENABLED = True
except ImportError:
    TRACING_ENABLED = False
    print("WARNING: ddtrace not installed. Install with: pip install ddtrace")

# Colors for terminal output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'

def log_info(msg: str):
    print(f"{Colors.GREEN}INFO{Colors.NC} - {msg}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}WARNING{Colors.NC} - {msg}")

def log_error(msg: str):
    print(f"{Colors.RED}ERROR{Colors.NC} - {msg}")

def calculate_checksum(filepath: Path, algorithm: str = "sha256") -> str:
    """Calculate file checksum"""
    hash_obj = hashlib.new(algorithm)
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_obj.update(chunk)
    return hash_obj.hexdigest()

def copy_extensions(source_dir: Path, dest_dir: Path) -> List[Path]:
    """Copy extension .vsix files to VM resources"""
    if TRACING_ENABLED:
        with tracer.trace("copy_extensions", service="vm-extension-installer") as span:
            span.set_tag("source_dir", str(source_dir))
            span.set_tag("dest_dir", str(dest_dir))
            return _copy_extensions_impl(source_dir, dest_dir, span)
    else:
        return _copy_extensions_impl(source_dir, dest_dir, None)

def _copy_extensions_impl(source_dir: Path, dest_dir: Path, span: Any) -> List[Path]:
    """Implementation of copy_extensions"""
    log_info("Copying extension packages")
    
    if not source_dir.exists():
        log_error(f"Source directory not found: {source_dir}")
        return []
    
    # Create destination directory
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    # Find all .vsix files
    vsix_files = list(source_dir.glob("*.vsix"))
    
    if not vsix_files:
        log_error(f"No .vsix files found in {source_dir}")
        return []
    
    copied_files = []
    for vsix_file in vsix_files:
        dest_file = dest_dir / vsix_file.name
        dest_file.write_bytes(vsix_file.read_bytes())
        log_info(f"OK - Copied {vsix_file.name}")
        copied_files.append(dest_file)
    
    if span:
        span.set_tag("files_copied", len(copied_files))
    
    return copied_files

def create_installer_script(dest_dir: Path) -> Path:
    """Create extension installation script for VM"""
    log_info("Creating VM extension installer script")
    
    script_path = dest_dir / "install-extensions.sh"
    
    script_content = """#!/usr/bin/env bash

# Extension Auto-Installer for OpenVSCode Server
# This script runs on first boot to install bundled extensions

set -euo pipefail

EXTENSION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENVSCODE_CLI="/usr/local/bin/openvscode-server"

# Wait for OpenVSCode Server to be available
MAX_WAIT=30
WAIT_COUNT=0
while [ ! -f "$OPENVSCODE_CLI" ] && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    echo "Waiting for OpenVSCode Server... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 1
    ((WAIT_COUNT++))
done

if [ ! -f "$OPENVSCODE_CLI" ]; then
    echo "WARNING: OpenVSCode Server CLI not found at $OPENVSCODE_CLI"
    exit 0
fi

echo "Installing bundled extensions..."

# Install each .vsix file
for vsix_file in "$EXTENSION_DIR"/*.vsix; do
    if [ -f "$vsix_file" ]; then
        echo "Installing $(basename "$vsix_file")..."
        "$OPENVSCODE_CLI" --install-extension "$vsix_file" --force || {
            echo "WARNING: Failed to install $(basename "$vsix_file")"
        }
    fi
done

echo "Extension installation complete"
"""
    
    script_path.write_text(script_content)
    script_path.chmod(0o755)
    
    log_info(f"OK - Installer script created: {script_path}")
    return script_path

def create_systemd_service(dest_dir: Path) -> Path:
    """Create systemd service for auto-installation"""
    log_info("Creating systemd service for auto-installation")
    
    service_path = dest_dir / "vscode-extensions-installer.service"
    
    service_content = """[Unit]
Description=Install VS Code Extensions on First Boot
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/var/lib/vscode-extensions-installed

[Service]
Type=oneshot
ExecStart=/usr/local/share/extensions/install-extensions.sh
ExecStartPost=/usr/bin/touch /var/lib/vscode-extensions-installed
StandardOutput=journal
StandardError=journal
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
"""
    
    service_path.write_text(service_content)
    log_info(f"OK - Systemd service created: {service_path}")
    return service_path

def create_manifest(dest_dir: Path, vsix_files: List[Path]) -> Path:
    """Create extensions manifest"""
    log_info("Creating extensions manifest")
    
    manifest_path = dest_dir / "manifest.json"
    
    extensions = []
    for vsix_file in vsix_files:
        extensions.append({
            "filename": vsix_file.name,
            "size": vsix_file.stat().st_size,
            "sha256": calculate_checksum(vsix_file, "sha256")
        })
    
    manifest = {
        "version": "1.0.0",
        "installed_at": datetime.utcnow().isoformat() + "Z",
        "extensions": extensions
    }
    
    manifest_path.write_text(json.dumps(manifest, indent=2))
    log_info(f"OK - Manifest created: {manifest_path}")
    return manifest_path

def install_extensions(project_root: Path) -> bool:
    """Install extensions to VM resources"""
    if TRACING_ENABLED:
        with tracer.trace("install_extensions", service="vm-extension-installer") as span:
            span.set_tag("project_root", str(project_root))
            return _install_extensions_impl(project_root, span)
    else:
        return _install_extensions_impl(project_root, None)

def _install_extensions_impl(project_root: Path, span: Any) -> bool:
    """Implementation of install_extensions"""
    source_dir = project_root / "dist" / "extensions"
    dest_dir = project_root / "src-tauri" / "resources" / "extensions"
    
    log_info(f"Source: {source_dir}")
    log_info(f"Destination: {dest_dir}")
    
    # Copy extensions
    vsix_files = copy_extensions(source_dir, dest_dir)
    if not vsix_files:
        return False
    
    if span:
        span.set_tag("extensions_count", len(vsix_files))
    
    # Create installer script
    create_installer_script(dest_dir)
    
    # Create systemd service
    create_systemd_service(dest_dir)
    
    # Create manifest
    create_manifest(dest_dir, vsix_files)
    
    return True

def show_menu():
    """Display interactive menu"""
    print(f"\n{Colors.BLUE}╔════════════════════════════════════════════╗{Colors.NC}")
    print(f"{Colors.BLUE}║   VM Extension Installer                  ║{Colors.NC}")
    print(f"{Colors.BLUE}╚════════════════════════════════════════════╝{Colors.NC}\n")
    
    print("Select an option:")
    print("  1) Install extensions to VM resources")
    print("  2) View current manifest")
    print("  3) Exit")
    print()
    
    while True:
        try:
            choice = input("Enter choice [1-3]: ").strip()
            
            if choice == "1":
                return {"action": "install"}
            elif choice == "2":
                return {"action": "view"}
            elif choice == "3":
                return {"action": "exit"}
            else:
                print("Invalid choice. Please enter 1-3.")
        except KeyboardInterrupt:
            print("\nCancelled by user")
            return {"action": "exit"}

def view_manifest(project_root: Path):
    """Display current manifest"""
    manifest_path = project_root / "src-tauri" / "resources" / "extensions" / "manifest.json"
    
    if not manifest_path.exists():
        log_warning("No manifest found. Run installation first.")
        return
    
    manifest = json.loads(manifest_path.read_text())
    
    print(f"\n{Colors.BLUE}Extension Manifest{Colors.NC}")
    print(f"Version: {manifest.get('version', 'unknown')}")
    print(f"Installed: {manifest.get('installed_at', 'unknown')}")
    print(f"\nExtensions ({len(manifest.get('extensions', []))}):")
    
    for ext in manifest.get('extensions', []):
        size_mb = ext['size'] / (1024 * 1024)
        print(f"  - {ext['filename']} ({size_mb:.2f} MB)")
        print(f"    SHA256: {ext['sha256']}")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Install extensions to OpenVSCode Server VM with Datadog tracing"
    )
    parser.add_argument(
        "action",
        nargs="?",
        choices=["install", "view"],
        help="Action to perform (install or view manifest)"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Path to project root (auto-detected if not specified)"
    )
    
    args = parser.parse_args()
    
    # Determine project root
    if args.project_root:
        project_root = args.project_root
    else:
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent.parent
    
    if not project_root.exists():
        log_error(f"Project root not found: {project_root}")
        return 1
    
    # Initialize Datadog tracing
    if TRACING_ENABLED:
        tracer.configure(
            hostname=os.getenv("DD_AGENT_HOST", "localhost"),
            port=int(os.getenv("DD_TRACE_AGENT_PORT", "8126"))
        )
        log_info("Datadog tracing enabled")
    
    # If no action specified, show menu
    if not args.action:
        menu_result = show_menu()
        if menu_result["action"] == "exit":
            return 0
        action = menu_result["action"]
    else:
        action = args.action
    
    # Execute action
    if TRACING_ENABLED:
        with tracer.trace("main", service="vm-extension-installer") as span:
            span.set_tag("action", action)
            span.set_tag("project_root", str(project_root))
            return _execute_action(action, project_root, span)
    else:
        return _execute_action(action, project_root, None)

def _execute_action(action: str, project_root: Path, span: Any) -> int:
    """Execute the specified action"""
    
    if action == "install":
        success = install_extensions(project_root)
        if success:
            print(f"\n{Colors.GREEN}╔════════════════════════════════════════════╗{Colors.NC}")
            print(f"{Colors.GREEN}║     Installation Complete - Success        ║{Colors.NC}")
            print(f"{Colors.GREEN}╚════════════════════════════════════════════╝{Colors.NC}\n")
            
            dest_dir = project_root / "src-tauri" / "resources" / "extensions"
            print(f"Destination: {dest_dir}")
            print("\nFiles created:")
            print(f"  - Extensions: {dest_dir}/*.vsix")
            print(f"  - Installer: {dest_dir}/install-extensions.sh")
            print(f"  - Service: {dest_dir}/vscode-extensions-installer.service")
            print(f"  - Manifest: {dest_dir}/manifest.json")
            return 0
        else:
            log_error("Installation failed")
            return 1
    
    elif action == "view":
        view_manifest(project_root)
        return 0
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

