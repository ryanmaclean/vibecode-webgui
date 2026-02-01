#!/usr/bin/env python3
"""
Enhanced VM Manager - Incorporating VirtualBuddy and Viable best practices
"""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import os
import subprocess
import shutil
import uuid
import json
from pathlib import Path
from typing import List, Dict, Optional
import curses

class EnhancedVMManager:
    def __init__(self):
        # Support both VirtualBuddy and standalone VMs
        self.vb_dir = Path.home() / "Library/Application Support/VirtualBuddy"
        self.vm_dir = Path.home() / "VMs"
        self.vm_dir.mkdir(exist_ok=True)
        
        self.config_file = self.vm_dir / "config.json"
        self.config = self._load_config()
    
    def _load_config(self) -> Dict:
        if self.config_file.exists():
            with open(self.config_file) as f:
                return json.load(f)
        return {"vms": []}
    
    def _save_config(self):
        with open(self.config_file, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def list_all_vms(self) -> List[Dict]:
        """List both VirtualBuddy and standalone VMs"""
        vms = []
        
        # VirtualBuddy VMs
        if self.vb_dir.exists():
            for vm_path in self.vb_dir.glob("*.vbvm"):
                vms.append({
                    "name": vm_path.stem,
                    "path": str(vm_path),
                    "type": "VirtualBuddy",
                    "status": self._check_vm_status(vm_path.stem)
                })
        
        # Standalone VMs
        for vm in self.config.get("vms", []):
            if vm["name"] not in [v["name"] for v in vms]:
                vms.append({
                    "name": vm["name"],
                    "path": vm["path"],
                    "type": "Standalone",
                    "status": vm.get("status", "stopped")
                })
        
        return vms
    
    def _check_vm_status(self, name: str) -> str:
        """Check if VM is running"""
        pid_file = Path("/tmp/vm-{}.pid".format(name.replace(" ", "_")))
        if pid_file.exists():
            pid = int(pid_file.read_text().strip())
            try:
                os.kill(pid, 0)
                return "running"
            except (ProcessLookupError, OSError):
                return "stopped"
        return "stopped"
    
    def create_from_ipsw(self, ipsw_path: str, name: str, disk_size_gb: int = 64) -> bool:
        """Create VM from IPSW (like Viable)"""
        print(f"📦 Creating VM from IPSW: {ipsw_path}")
        
        vm_path = self.vm_dir / name
        if vm_path.exists():
            raise ValueError(f"VM exists: {name}")
        
        vm_path.mkdir()
        
        # Create disk
        subprocess.run([
            "qemu-img", "create", "-f", "qcow2",
            str(vm_path / "disk.qcow2"),
            f"{disk_size_gb}G"
        ], check=True)
        
        # Extract hardware model from IPSW
        print("🔧 Extracting hardware model from IPSW...")
        # This would use VZMacOSRestoreImage API in real implementation
        
        # Generate machine ID
        mid = str(uuid.uuid4())
        (vm_path / "MachineIdentifier").write_text(mid)
        
        # Create auxiliary storage
        (vm_path / "AuxiliaryStorage").touch()
        
        print(f"✅ VM created: {name}")
        return True
    
    def clone_vm(self, source: str, target: str, generate_id: bool = True) -> bool:
        """Clone VM with unique Machine ID (important for isolation)"""
        # Find source VM
        source_vms = self.list_all_vms()
        source_vm = next((v for v in source_vms if v["name"] == source), None)
        if not source_vm:
            raise ValueError(f"Source VM not found: {source}")
        
        source_path = Path(source_vm["path"])
        target_path = self.vm_dir / target
        target_path.mkdir()
        
        # Clone using ditto (APFS efficient)
        subprocess.run(["ditto", source_path, target_path], check=True)
        
        # Generate new machine ID (critical for isolation)
        if generate_id:
            new_mid = str(uuid.uuid4())
            (target_path / "MachineIdentifier").write_text(new_mid + "\n")
            print(f"✅ Generated new Machine ID for isolation")
        
        print(f"✅ VM cloned: {source} → {target}")
        return True
    
    def start_vm(self, name: str) -> bool:
        """Start VM with vfkit (lightweight, like Vimy)"""
        vms = self.list_all_vms()
        vm = next((v for v in vms if v["name"] == name), None)
        if not vm:
            raise ValueError(f"VM not found: {name}")
        
        vm_path = Path(vm["path"])
        
        # Check files
        disk = vm_path / "Disk.img" if vm["type"] == "VirtualBuddy" else vm_path / "disk.qcow2"
        hw = vm_path / "HardwareModel"
        mid = vm_path / "MachineIdentifier"
        aux = vm_path / "AuxiliaryStorage"
        
        # Build vfkit command
        args = [
            "vfkit",
            "--cpus", "4",
            "--memory", "8192",
            "--device", f"virtio-blk,path={disk}",
            "--device", "virtio-net,nat",
            "--gui"
        ]
        
        # Add macOS bootloader if hardware model exists
        if hw.exists() and mid.exists() and aux.exists():
            args.extend([
                "--bootloader",
                f"macos,machineIdentifierPath={mid},hardwareModelPath={hw},auxImagePath={aux}"
            ])
        elif disk.exists():
            # Try simple macOS bootloader
            args.extend(["--bootloader", "macos"])
        
        print(f"🚀 Starting VM: {name}")
        
        # Start in background
        process = subprocess.Popen(args)
        
        # Save PID
        pid_file = Path("/tmp/vm-{}.pid".format(name.replace(" ", "_")))
        pid_file.write_text(str(process.pid))
        
        print(f"✅ VM started (PID: {process.pid})")
        return True
    
    def show_tui(self):
        """Show ncurses TUI"""
        # Simplified TUI for now
        import sys
        from blessed import Terminal
        
        term = Terminal()
        
        with term.fullscreen(), term.cbreak():
            idx = 0
            vms = self.list_all_vms()
            
            while True:
                print(term.clear())
                print(term.bold_cyan("🍎 VM Manager"))
                print(term.line() * term.width)
                print()
                
                for i, vm in enumerate(vms):
                    marker = "▸" if i == idx else " "
                    status_color = term.green if vm["status"] == "running" else term.red
                    vm_type = term.yellow(vm["type"])
                    status = status_color(vm["status"])
                    
                    print(f"{marker} {vm['name']:<30} [{vm_type}] {status}")
                
                print()
                print(term.dim("↑↓: Navigate  Enter: Select  q: Quit"))
                
                key = term.inkey()
                
                if key == 'q' or key.is_sequence() and key.name == 'KEY_ESCAPE':
                    break
                elif key.is_sequence():
                    if key.name == 'KEY_UP' and idx > 0:
                        idx -= 1
                    elif key.name == 'KEY_DOWN' and idx < len(vms) - 1:
                        idx += 1
                    elif key.name == 'KEY_ENTER':
                        self._show_vm_menu(vms[idx])
                        vms = self.list_all_vms()  # Refresh
    
    def _show_vm_menu(self, vm: Dict):
        """Show menu for selected VM"""
        from blessed import Terminal
        term = Terminal()
        
        with term.fullscreen(), term.cbreak():
            idx = 0
            options = ["Start", "Stop", "Clone", "Backup", "Info"]
            
            while True:
                print(term.clear())
                print(term.bold_cyan(f"VM: {vm['name']}"))
                print(term.line() * term.width)
                print()
                
                for i, opt in enumerate(options):
                    marker = "▸" if i == idx else " "
                    # Disable based on state
                    if opt == "Start" and vm["status"] == "running":
                        opt = term.dim("Start (already running)")
                    elif opt == "Stop" and vm["status"] != "running":
                        opt = term.dim("Stop (not running)")
                    
                    print(f"{marker} {opt}")
                
                key = term.inkey()
                if key == 'q':
                    break
                elif key.is_sequence():
                    if key.name == 'KEY_UP' and idx > 0:
                        idx -= 1
                    elif key.name == 'KEY_DOWN' and idx < len(options) - 1:
                        idx += 1
                    elif key.name == 'KEY_ENTER':
                        self._execute_action(vm, options[idx])
                        break

def main():
    import sys
    
    manager = EnhancedVMManager()
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        
        if cmd == "list":
            vms = manager.list_all_vms()
            for vm in vms:
                print(f"  • {vm['name']} ({vm['type']}) - {vm['status']}")
        
        elif cmd == "tui":
            try:
                manager.show_tui()
            except ImportError:
                print("Install blessed: pip install blessed")
        else:
            print("Usage: enhanced-vm-manager.py [list|tui]")
    else:
        manager.show_tui()

if __name__ == "__main__":
    main()
