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
Native VM Manager - Using Apple's Virtualization Framework APIs
"""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import subprocess
import os
import json
from pathlib import Path
from typing import List, Dict
from dataclasses import dataclass

@dataclass
class VMInfo:
    name: str
    path: str
    status: str
    memory: int
    cpus: int

class NativeVMManager:
    """Uses vm-native.swift for native Virtualization Framework access"""
    
    def __init__(self):
        self.swift_tool = "./vm-native.swift"
        self.vm_base = Path.home() / "VMs"
        self.vm_base.mkdir(exist_ok=True)
    
    def list_vms(self) -> List[VMInfo]:
        """List VMs using native tool"""
        result = subprocess.run(
            [self.swift_tool, "list"],
            capture_output=True,
            text=True
        )
        
        vms = []
        for line in result.stdout.split('\n'):
            if '•' in line:
                name = line.split('•')[1].strip()
                vms.append(VMInfo(
                    name=name,
                    path=str(self.vm_base / name),
                    status="unknown",
                    memory=8192,
                    cpus=4
                ))
        return vms
    
    def create_vm_from_ipsw(self, name: str, ipsw_path: str) -> bool:
        """Create VM from IPSW using native framework"""
        print(f"📦 Creating VM from IPSW...")
        
        result = subprocess.run(
            [self.swift_tool, "create", name, ipsw_path],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(result.stdout)
            return True
        else:
            print(f"❌ Error: {result.stderr}")
            return False
    
    def start_vm(self, name: str, background: bool = True) -> bool:
        """Start VM using native framework"""
        print(f"🚀 Starting VM: {name}")
        
        cmd = [self.swift_tool, "start", name]
        
        if background:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Save PID
            pid_file = Path(f"/tmp/vm-{name.replace(' ', '_')}.pid")
            pid_file.write_text(str(process.pid))
            
            print(f"✅ VM started (PID: {process.pid})")
            return True
        else:
            # Run in foreground
            subprocess.run(cmd)
            return False
    
    def show_menu(self):
        """Simple text menu (fallback if ncurses not available)"""
        import sys
        
        while True:
            print("\n🍎 Native VM Manager")
            print("=" * 40)
            
            vms = self.list_vms()
            
            if vms:
                print("\nVMs:")
                for i, vm in enumerate(vms, 1):
                    print(f"{i}. {vm.name}")
            else:
                print("\nNo VMs found")
            
            print("\nCommands:")
            print("  c - Create VM from IPSW")
            print("  s - Start VM")
            print("  l - List VMs")
            print("  q - Quit")
            
            choice = input("\n> ").strip().lower()
            
            if choice == 'q':
                break
            elif choice == 'c':
                name = input("VM name: ").strip()
                ipsw = input("IPSW path: ").strip()
                self.create_vm_from_ipsw(name, ipsw)
            elif choice == 's' and vms:
                idx = input("VM number: ").strip()
                try:
                    idx = int(idx) - 1
                    if 0 <= idx < len(vms):
                        self.start_vm(vms[idx].name)
                except ValueError:
                    print("Invalid number")
            elif choice == 'l':
                vms = self.list_vms()
                for vm in vms:
                    print(f"  • {vm.name}")

def main():
    import sys
    
    manager = NativeVMManager()
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        
        if cmd == "list":
            vms = manager.list_vms()
            print("📋 VMs:")
            for vm in vms:
                print(f"  • {vm.name}")
        
        elif cmd == "create" and len(sys.argv) >= 4:
            manager.create_vm_from_ipsw(sys.argv[2], sys.argv[3])
        
        elif cmd == "start" and len(sys.argv) >= 3:
            manager.start_vm(sys.argv[2])
        
        else:
            print("Usage: vm-native-cli.py [list|create|start] [args]")
    else:
        manager.show_menu()

if __name__ == "__main__":
    main()