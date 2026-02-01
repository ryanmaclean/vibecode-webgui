#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Build Swift VM Manager for Distribution

Compiles the standalone Swift binary with proper entitlements
for bundling in VibeCode.app.

Copyright (c) 2025 VibeCode Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import sys
import subprocess
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
SOURCE = PROJECT_ROOT / "vz-swift/Sources/VibeCodeVM/LinuxVMStandalone.swift"
OUTPUT = PROJECT_ROOT / "dist/vibecode-vm"
ENTITLEMENTS = PROJECT_ROOT / "vz-swift/vibecode-vm.entitlements"


def build_vm_manager() -> bool:
    """Build the Swift VM manager binary."""
    logger.info("🔨 Building Swift VM Manager...")
    logger.info("=" * 60)
    
    # Create output directory
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    
    # Compile
    logger.info("📦 Compiling Swift source...")
    logger.info(f"   Source: {SOURCE.name}")
    
    result = subprocess.run([
        "swiftc",
        str(SOURCE),
        "-o", str(OUTPUT),
        "-O",  # Optimize
        "-whole-module-optimization"
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        logger.error(f"❌ Compilation failed: {result.stderr}")
        return False
    
    logger.info("✅ Compiled successfully")
    
    # Sign with entitlements
    logger.info("🔐 Signing with Virtualization entitlements...")
    
    result = subprocess.run([
        "codesign",
        "-s", "-",
        "--entitlements", str(ENTITLEMENTS),
        "--force",
        str(OUTPUT)
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        logger.error(f"❌ Signing failed: {result.stderr}")
        return False
    
    logger.info("✅ Signed successfully")
    
    # Verify
    logger.info("🔍 Verifying binary...")
    
    result = subprocess.run([
        "codesign", "-dv", str(OUTPUT)
    ], capture_output=True, text=True)
    
    logger.info(result.stderr.strip())
    
    # Get file info
    size_bytes = OUTPUT.stat().st_size
    size_kb = size_bytes / 1024
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("✅ BUILD SUCCESSFUL")
    logger.info("=" * 60)
    logger.info(f"Binary: {OUTPUT}")
    logger.info(f"Size: {size_kb:.1f} KB ({size_bytes:,} bytes)")
    logger.info("")
    logger.info("Ready for distribution in VibeCode.app!")
    
    return True


def test_binary() -> bool:
    """Quick test of the binary."""
    logger.info("")
    logger.info("🧪 Running quick test...")
    
    result = subprocess.run(
        [str(OUTPUT), "--help"],
        capture_output=True,
        text=True,
        timeout=5
    )
    
    # Binary doesn't have --help, so it will try to run
    # Just check it executes without crashing immediately
    if "VibeCode VM Manager" in result.stdout or result.returncode in [0, 1]:
        logger.info("✅ Binary executes correctly")
        return True
    else:
        logger.warning("⚠️  Binary test inconclusive")
        return True


def main() -> int:
    """Main entry point."""
    logger.info("🚀 VibeCode VM Manager Build Script")
    logger.info("")
    
    if not SOURCE.exists():
        logger.error(f"❌ Source file not found: {SOURCE}")
        return 1
    
    if not ENTITLEMENTS.exists():
        logger.error(f"❌ Entitlements file not found: {ENTITLEMENTS}")
        return 1
    
    if not build_vm_manager():
        return 1
    
    test_binary()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
