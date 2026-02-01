#!/usr/bin/env python3
"""
Standalone VM Manager - No VirtualBuddy Required
Manages macOS VMs directly with vfkit
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
import json
import uuid
from pathlib import Path
from typing import List, Dict, Optional

class StandaloneVMManager:
    def __init__(self):
        self.vm_dir = Path.home() / "VMs"
        self.vm_dir.mkdir(exist_ok=True)
        
        # Config file
        self.config_file = self.vm_dir / "config.json"
        self.config = self._load_config()
    
    def _load_config(self) -> Dict:
        """Load or create config"""
        if self.config_file.exists():
            with open(self.config_file) as f:
                return json.load(f)
        return {"vms": []}
    
    def _save_config(self):
        """Save config"""
        with open(self.config_file, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def list_vms(self) -> List[Dict]:
        """List all VMs"""
        return self.config.get("vms", [])
    
    def create_vm(self, name: str, disk_size_gb: int = 64) -> Dict:
        """Create a new VM"""
        vm_path = self.vm_dir / name
        
        if vm_path.exists():
            raise ValueError(f"VM already exists: {name}")
        
        vm_path.mkdir()
        
        # Create disk image
        print(f"📝 Creating disk image ({disk_size_gb}GB)...")
        subprocess.run([
            "qemu-img", "create", "-f", "qcow2", 
            str(vm_path / "disk.qcow2"),
            f"{disk_size_gb}G"
        ], check=True)
        
        # Create required files for macOS
        hardware_model = Path.home() / "Library/Application Support/VirtualBuddy"
        if hardware_model.exists():
            # Try to copy from existing VB VM
            hw_file = hardware_model.glob("*.vbvm/HardwareModel").__next__()
            if hw_file.exists():
                shutil.copy(hw_file, vm_path / "HardwareModel")
        
        # Generate machine ID
        with open(vm_path / "MachineIdentifier", 'w') as f:
            f.write(str(uuid.uuid4()))
        
        # Create auxiliary storage
        (vm_path / "AuxiliaryStorage").touch()
        
        # Add to config
        vm_info = {
            "name": name,
            "path": str(vm_path),
            "disk_size_gb": disk_size_gb,
            "status": "stopped"
        }
        self.config.setdefault("vms", []).append(vm_info)
        self._save_config()
        
        print(f"✅ VM created: {name}")
        return vm_info
    
    def start_vm(self, name: str) -> bool:
        """Start a VM using vfkit"""
        vm_info = next((v for v in self.config["vms"] if v["name"] == name), None)
        if not vm_info:
            raise ValueError(f"VM not found: {name}")
        
        vm_path = Path(vm_info["path"])
        
        # Check files
        disk = vm_path / "disk.qcow2"
        hw = vm_path / "HardwareModel"
        mid = vm_path / "MachineIdentifier"
        aux = vm_path / "AuxiliaryStorage"
        
        if not disk.exists():
            raise ValueError("Disk not found")
        
        # Build vfkit command
        args = [
            "vfkit",
            "--cpus", "4",
            "--memory", "8192",
            "--bootloader", f"macos,machineIdentifierPath={mid},hardwareModelPath={hw},auxImagePath={aux}",
            "--device", f"virtio-blk,path={disk}",
            "--device", "virtio-net,nat",
            "--gui",
        ]
        
        if not hw.exists():
            # Fallback: simple macOS bootloader
            args = [
                "vfkit",
                "--cpus", "4",
                "--memory", "8192",
                "--bootloader", "macos",
                "--device", f"virtio-blk,path={disk}",
                "--device", "virtio-net,nat",
                "--gui",
            ]
        
        print(f"🚀 Starting VM: {name}")
        print(f"📝 Command: {' '.join(args)}")
        
        # Start vfkit
        process = subprocess.Popen(args)
        
        # Save PID
        with open(vm_path / "vm.pid", 'w') as f:
            f.write(str(process.pid))
        
        vm_info["status"] = "running"
        self._save_config()
        
        print(f"✅ VM started (PID: {process.pid})")
        return True
    
    def stop_vm(self, name: str) -> bool:
        """Stop a VM"""
        vm_info = next((v for v in self.config["vms"] if v["name"] == name), None)
        if not vm_info:
            raise ValueError(f"VM not found: {name}")
        
        vm_path = Path(vm_info["path"])
        pid_file = vm_path / "vm.pid"
        
        if pid_file.exists():
            pid = int(pid_file.read_text().strip())
            try:
                os.kill(pid, 15)  # SIGTERM
                print(f"🛑 Stopped VM: {name}")
            except ProcessLookupError:
                print(f"⚠️  VM already stopped")
            pid_file.unlink()
        
        vm_info["status"] = "stopped"
        self._save_config()
        return True
    
    def delete_vm(self, name: str) -> bool:
        """Delete a VM"""
        if self.stop_vm(name):
            pass  # Try to stop first
        
        vm_info = next((v for v in self.config["vms"] if v["name"] == name), None)
        if not vm_info:
            raise ValueError(f"VM not found: {name}")
        
        vm_path = Path(vm_info["path"])
        
        if vm_path.exists():
            shutil.rmtree(vm_path)
        
        self.config["vms"] = [v for v in self.config["vms"] if v["name"] != name]
        self._save_config()
        
        print(f"🗑️  Deleted VM: {name}")
        return True

def main():
    import sys
    
    manager = StandaloneVMManager()
    
    if len(sys.argv) < 2:
        print("Standalone VM Manager")
        print("Usage: standalone-vm.py [list|create|start|stop|delete] [args]")
        return
    
    cmd = sys.argv[1]
    
    if cmd == "list":
        vms = manager.list_vms()
        print("📋 VMs:")
        for vm in vms:
            print(f"  • {vm['name']} ({vm['status']}) - {vm.get('disk_size_gb', 0)}GB")
    
    elif cmd == "create" and len(sys.argv) >= 3:
        name = sys.argv[2]
        size = int(sys.argv[3]) if len(sys.argv) > 3 else 64
        manager.create_vm(name, size)
    
    elif cmd == "start" and len(sys.argv) >= 3:
        manager.start_vm(sys.argv[2])
    
    elif cmd == "stop" and len(sys.argv) >= 3:
        manager.stop_vm(sys.argv[2])
    
    elif cmd == "delete" and len(sys.argv) >= 3:
        manager.delete_vm(sys.argv[2])
    
    else:
        print("Unknown command")

if __name__ == "__main__":
    main()
