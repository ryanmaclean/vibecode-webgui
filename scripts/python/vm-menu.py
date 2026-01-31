#!/usr/bin/env python3

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

"""
VirtualBuddy VM Manager with interactive menu
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import os
import subprocess
import shutil
from pathlib import Path
from typing import List, Dict

VB_DIR = Path.home() / "Library/Application Support/VirtualBuddy"
BACKUP_DIR = Path("/Volumes/tank3/vm-backups")

class VMManager:
    def __init__(self):
        self.vb_dir = VB_DIR
        self.backup_dir = BACKUP_DIR
        
    def list_vms(self) -> List[Dict]:
        """List all VirtualBuddy VMs"""
        vms = []
        if not self.vb_dir.exists():
            return vms
            
        for vm_path in self.vb_dir.glob("*.vbvm"):
            name = vm_path.stem
            disk_path = vm_path / "Disk.img"
            
            size = "?"
            if disk_path.exists():
                size_bytes = disk_path.stat().st_size
                size = self._format_size(size_bytes)
            
            vms.append({
                "name": name,
                "path": str(vm_path),
                "size": size
            })
        
        return vms
    
    def _format_size(self, bytes: int) -> str:
        """Format bytes to human readable size"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes < 1024.0:
                return f"{bytes:.1f}{unit}"
            bytes /= 1024.0
        return f"{bytes:.1f}PB"
    
    def clone_vm(self, source: str, target: str) -> bool:
        """Clone a VM"""
        source_path = self.vb_dir / f"{source}.vbvm"
        target_path = self.vb_dir / f"{target}.vbvm"
        
        if not source_path.exists():
            print(f"❌ Source VM not found: {source}")
            return False
        
        if target_path.exists():
            response = input(f"⚠️  Target VM exists: {target}. Overwrite? (y/N): ")
            if response.lower() != 'y':
                return False
            shutil.rmtree(target_path)
        
        print(f"📋 Cloning VM: {source} → {target}")
        
        try:
            # Use ditto for efficient APFS cloning
            subprocess.run(["ditto", source_path, target_path], check=True)
            
            # Generate new machine identifier
            mid_path = target_path / "MachineIdentifier"
            import uuid
            mid_path.write_text(f"{uuid.uuid4()}\n")
            
            print(f"✅ VM cloned: {target}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to clone VM: {e}")
            return False
    
    def start_vm(self, name: str) -> bool:
        """Start a VM using vm-cli.sh"""
        print(f"🚀 Starting VM: {name}")
        return self._run_script("./vm-cli.sh", "start", name)
    
    def stop_vm(self, name: str) -> bool:
        """Stop a VM"""
        print(f"🛑 Stopping VM: {name}")
        return self._run_script("./vm-cli.sh", "stop", name)
    
    def backup_vm(self, name: str) -> bool:
        """Backup a VM"""
        print(f"📦 Backing up VM: {name}")
        return self._run_script("./vm-cli.sh", "backup", name)
    
    def _run_script(self, script: str, cmd: str, name: str) -> bool:
        """Run a shell script"""
        try:
            result = subprocess.run(
                [script, cmd, name],
                capture_output=True,
                text=True
            )
            print(result.stdout)
            if result.stderr:
                print(result.stderr)
            return result.returncode == 0
        except Exception as e:
            print(f"❌ Error: {e}")
            return False

def show_menu(vms: List[Dict], manager: VMManager):
    """Show interactive menu"""
    import sys
    
    print("\n🍎 VirtualBuddy VM Manager")
    print("=" * 40)
    print()
    
    if not vms:
        print("❌ No VMs found")
        return
    
    for i, vm in enumerate(vms, 1):
        print(f"{i}. {vm['name']} ({vm['size']})")
    
    print(f"{len(vms) + 1}. Clone a VM")
    print(f"{len(vms) + 2}. Quit")
    print()
    
    try:
        choice = input("Select an option: ").strip()
        
        if choice == str(len(vms) + 2) or choice.lower() in ['q', 'quit']:
            print("👋 Goodbye!")
            return
        
        if choice == str(len(vms) + 1):
            # Clone
            print("\n📋 Clone VM:")
            source = input("Source VM name: ").strip()
            if not source:
                return
            
            target = input("Target VM name: ").strip()
            if not target:
                return
            
            manager.clone_vm(source, target)
            return
        
        idx = int(choice) - 1
        if 0 <= idx < len(vms):
            vm = vms[idx]
            show_vm_menu(vm, manager)
        else:
            print("❌ Invalid choice")
    
    except (ValueError, KeyboardInterrupt):
        print("\n👋 Goodbye!")

def show_vm_menu(vm: Dict, manager: VMManager):
    """Show menu for specific VM"""
    print(f"\n📱 VM: {vm['name']}")
    print("=" * 40)
    print("1. Start")
    print("2. Stop")
    print("3. Backup")
    print("4. Clone this VM")
    print("5. Back to main menu")
    print()
    
    try:
        choice = input("Select action: ").strip()
        
        if choice == "1":
            manager.start_vm(vm['name'])
        elif choice == "2":
            manager.stop_vm(vm['name'])
        elif choice == "3":
            manager.backup_vm(vm['name'])
        elif choice == "4":
            target = input("New VM name: ").strip()
            if target:
                manager.clone_vm(vm['name'], target)
        elif choice == "5":
            return
        else:
            print("❌ Invalid choice")
    
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")

def main():
    import sys
    
    manager = VMManager()
    
    if len(sys.argv) > 1:
        # Command-line mode
        cmd = sys.argv[1]
        
        if cmd == "list":
            vms = manager.list_vms()
            print("📋 VirtualBuddy VMs:\n")
            for vm in vms:
                print(f"  • {vm['name']} ({vm['size']})")
        
        elif cmd == "clone" and len(sys.argv) >= 4:
            manager.clone_vm(sys.argv[2], sys.argv[3])
        
        elif cmd == "start" and len(sys.argv) >= 3:
            manager.start_vm(sys.argv[2])
        
        elif cmd == "stop" and len(sys.argv) >= 3:
            manager.stop_vm(sys.argv[2])
        
        elif cmd == "backup" and len(sys.argv) >= 3:
            manager.backup_vm(sys.argv[2])
        
        else:
            print("Usage: vm-menu.py [list|clone|start|stop|backup] [args]")
    
    else:
        # Interactive menu
        while True:
            vms = manager.list_vms()
            show_menu(vms, manager)
            
            if not vms:
                break
            
            choice = input("\nContinue? (y/n): ").strip().lower()
            if choice != 'y':
                break

if __name__ == "__main__":
    main()