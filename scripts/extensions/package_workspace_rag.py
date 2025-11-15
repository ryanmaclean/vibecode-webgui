#!/usr/bin/env python3

"""
Package Workspace RAG Extension
Creates a .vsix file for distribution with Datadog tracing
"""

import os
import sys
import json
import subprocess
import argparse
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any

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

def run_command(cmd: list, cwd: Optional[Path] = None, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command with tracing"""
    if TRACING_ENABLED:
        with tracer.trace("subprocess.run", service="extension-packager") as span:
            span.set_tag("command", " ".join(cmd))
            if cwd:
                span.set_tag("working_dir", str(cwd))
            result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=check)
            span.set_tag("exit_code", result.returncode)
            return result
    else:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=check)

def check_prerequisites() -> bool:
    """Check if required tools are installed"""
    log_info("Checking prerequisites")
    
    required_tools = {
        "node": ["node", "--version"],
        "npm": ["npm", "--version"],
        "vsce": ["vsce", "--version"]
    }
    
    missing = []
    for tool, cmd in required_tools.items():
        try:
            result = run_command(cmd, check=False)
            if result.returncode == 0:
                version = result.stdout.strip()
                log_info(f"OK - {tool}: {version}")
            else:
                missing.append(tool)
        except FileNotFoundError:
            missing.append(tool)
    
    if "vsce" in missing:
        log_warning("vsce not found. Installing @vscode/vsce")
        try:
            run_command(["npm", "install", "-g", "@vscode/vsce"])
            log_info("OK - vsce installed")
        except subprocess.CalledProcessError:
            log_error("Failed to install vsce")
            return False
    
    if missing and "vsce" not in missing:
        log_error(f"Missing required tools: {', '.join(missing)}")
        return False
    
    return True

def calculate_checksum(filepath: Path, algorithm: str = "sha256") -> str:
    """Calculate file checksum"""
    if TRACING_ENABLED:
        with tracer.trace("calculate_checksum", service="extension-packager") as span:
            span.set_tag("file", str(filepath))
            span.set_tag("algorithm", algorithm)
            
            hash_obj = hashlib.new(algorithm)
            with open(filepath, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_obj.update(chunk)
            checksum = hash_obj.hexdigest()
            span.set_tag("checksum", checksum)
            return checksum
    else:
        hash_obj = hashlib.new(algorithm)
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_obj.update(chunk)
        return hash_obj.hexdigest()

def package_extension(project_root: Path, skip_tests: bool = False) -> Optional[Path]:
    """Package the workspace-rag extension"""
    if TRACING_ENABLED:
        with tracer.trace("package_extension", service="extension-packager") as span:
            return _package_extension_impl(project_root, skip_tests, span)
    else:
        return _package_extension_impl(project_root, skip_tests, None)

def _package_extension_impl(project_root: Path, skip_tests: bool, span: Any) -> Optional[Path]:
    extension_dir = project_root / "extensions" / "workspace-rag"
    output_dir = project_root / "dist" / "extensions"
    
    if span:
        span.set_tag("extension_dir", str(extension_dir))
        span.set_tag("output_dir", str(output_dir))
    
    log_info(f"Extension directory: {extension_dir}")
    log_info(f"Output directory: {output_dir}")
    
    if not extension_dir.exists():
        log_error(f"Extension directory not found: {extension_dir}")
        return None
    
    # Install dependencies
    log_info("Installing extension dependencies")
    try:
        run_command(["npm", "install"], cwd=extension_dir)
    except subprocess.CalledProcessError as e:
        log_error(f"Failed to install dependencies: {e}")
        return None
    
    # Compile extension
    log_info("Compiling extension")
    try:
        run_command(["npm", "run", "compile"], cwd=extension_dir)
    except subprocess.CalledProcessError as e:
        log_error(f"Failed to compile extension: {e}")
        return None
    
    # Run tests unless skipped
    if not skip_tests:
        log_info("Running tests")
        try:
            run_command(["npm", "run", "compile-tests"], cwd=extension_dir)
            run_command(["npm", "run", "test:unit"], cwd=extension_dir)
        except subprocess.CalledProcessError as e:
            log_warning(f"Tests failed: {e} (continuing anyway)")
    else:
        log_warning("Skipping tests (--skip-tests flag)")
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Package extension
    log_info("Packaging extension as .vsix")
    try:
        run_command(["vsce", "package", "--out", str(output_dir)], cwd=extension_dir)
    except subprocess.CalledProcessError as e:
        log_error(f"Failed to package extension: {e}")
        return None
    
    # Find generated .vsix file
    vsix_files = list(output_dir.glob("workspace-rag-*.vsix"))
    if not vsix_files:
        log_error("No .vsix file found after packaging")
        return None
    
    vsix_file = vsix_files[0]
    log_info(f"OK - Extension packaged: {vsix_file}")
    
    if span:
        span.set_tag("vsix_file", str(vsix_file))
        span.set_tag("vsix_size", vsix_file.stat().st_size)
    
    # Generate checksums
    log_info("Generating checksums")
    for algorithm in ["sha256", "sha512"]:
        checksum = calculate_checksum(vsix_file, algorithm)
        checksum_file = vsix_file.with_suffix(f".vsix.{algorithm}")
        checksum_file.write_text(f"{checksum}  {vsix_file.name}\n")
        log_info(f"{algorithm.upper()}: {checksum}")
    
    # Display size
    size_bytes = vsix_file.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    log_info(f"Package size: {size_mb:.2f} MB")
    
    return vsix_file

def show_menu():
    """Display interactive menu"""
    print(f"\n{Colors.BLUE}╔════════════════════════════════════════════╗{Colors.NC}")
    print(f"{Colors.BLUE}║   Workspace RAG Extension Packager        ║{Colors.NC}")
    print(f"{Colors.BLUE}╚════════════════════════════════════════════╝{Colors.NC}\n")
    
    print("Select an option:")
    print("  1) Package extension (with tests)")
    print("  2) Package extension (skip tests)")
    print("  3) Check prerequisites only")
    print("  4) Exit")
    print()
    
    while True:
        try:
            choice = input("Enter choice [1-4]: ").strip()
            
            if choice == "1":
                return {"action": "package", "skip_tests": False}
            elif choice == "2":
                return {"action": "package", "skip_tests": True}
            elif choice == "3":
                return {"action": "check", "skip_tests": False}
            elif choice == "4":
                return {"action": "exit", "skip_tests": False}
            else:
                print("Invalid choice. Please enter 1-4.")
        except KeyboardInterrupt:
            print("\nCancelled by user")
            return {"action": "exit", "skip_tests": False}

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Package Workspace RAG Extension with Datadog tracing"
    )
    parser.add_argument(
        "action",
        nargs="?",
        choices=["package", "check"],
        help="Action to perform (package or check prerequisites)"
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip running tests during packaging"
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
        skip_tests = menu_result["skip_tests"]
    else:
        action = args.action
        skip_tests = args.skip_tests
    
    # Execute action
    if TRACING_ENABLED:
        with tracer.trace("main", service="extension-packager") as span:
            span.set_tag("action", action)
            span.set_tag("project_root", str(project_root))
            return _execute_action(action, project_root, skip_tests, span)
    else:
        return _execute_action(action, project_root, skip_tests, None)

def _execute_action(action: str, project_root: Path, skip_tests: bool, span: Any) -> int:
    """Execute the specified action"""
    
    # Check prerequisites
    if not check_prerequisites():
        return 1
    
    if action == "check":
        log_info("Prerequisites check complete")
        return 0
    
    elif action == "package":
        vsix_file = package_extension(project_root, skip_tests)
        if vsix_file:
            print(f"\n{Colors.GREEN}╔════════════════════════════════════════════╗{Colors.NC}")
            print(f"{Colors.GREEN}║        Packaging Complete - Success        ║{Colors.NC}")
            print(f"{Colors.GREEN}╚════════════════════════════════════════════╝{Colors.NC}\n")
            print(f"Package: {vsix_file}")
            print(f"SHA256: {vsix_file.with_suffix('.vsix.sha256')}")
            print(f"SHA512: {vsix_file.with_suffix('.vsix.sha512')}")
            return 0
        else:
            log_error("Packaging failed")
            return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

