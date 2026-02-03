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
Build Complete macOS Release
Packages VibeCode with OpenVSCode Server VM and pre-installed extensions
Full Datadog tracing integration
"""

import os
import sys
import json
import subprocess
import argparse
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

# Datadog tracing
try:
    from ddtrace import tracer, patch
    patch(logging=True, subprocess=True)
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
    MAGENTA = '\033[0;35m'
    NC = '\033[0m'

def log_info(msg: str):
    print(f"{Colors.GREEN}INFO{Colors.NC} - {msg}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}WARNING{Colors.NC} - {msg}")

def log_error(msg: str):
    print(f"{Colors.RED}ERROR{Colors.NC} - {msg}")

def log_step(step: int, total: int, msg: str):
    print(f"\n{Colors.BLUE}[{step}/{total}] {msg}{Colors.NC}")

def run_command(cmd: List[str], cwd: Optional[Path] = None, check: bool = True, env: Optional[Dict] = None) -> subprocess.CompletedProcess:
    """Run a command with tracing"""
    if TRACING_ENABLED:
        with tracer.trace("subprocess.run", service="macos-release-builder") as span:
            span.set_tag("command", " ".join(cmd))
            if cwd:
                span.set_tag("working_dir", str(cwd))
            
            cmd_env = os.environ.copy()
            if env:
                cmd_env.update(env)
            
            result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=check, env=cmd_env)
            span.set_tag("exit_code", result.returncode)
            if result.returncode != 0:
                span.set_tag("error", True)
                span.set_tag("stderr", result.stderr[:500])
            return result
    else:
        cmd_env = os.environ.copy()
        if env:
            cmd_env.update(env)
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=check, env=cmd_env)

def check_prerequisites() -> Dict[str, str]:
    """Check if required tools are installed"""
    log_info("Checking prerequisites")
    
    required_tools = {
        "node": ["node", "--version"],
        "npm": ["npm", "--version"],
        "cargo": ["cargo", "--version"],
        "rustc": ["rustc", "--version"],
        "jq": ["jq", "--version"],
        "swift": ["swift", "--version"]
    }
    
    versions = {}
    missing = []
    
    for tool, cmd in required_tools.items():
        try:
            result = run_command(cmd, check=False)
            if result.returncode == 0:
                version = result.stdout.strip().split('\n')[0]
                versions[tool] = version
                log_info(f"OK - {tool}: {version}")
            else:
                missing.append(tool)
        except FileNotFoundError:
            missing.append(tool)
    
    # Try to install missing tools via Homebrew
    if missing:
        log_warning(f"Missing tools: {', '.join(missing)}")
        if shutil.which("brew"):
            for tool in missing:
                if tool == "jq":
                    log_info(f"Installing {tool} via Homebrew")
                    run_command(["brew", "install", tool], check=False)
    
    return versions

def package_extension(project_root: Path, skip_tests: bool) -> bool:
    """Package workspace-rag extension"""
    if TRACING_ENABLED:
        with tracer.trace("package_extension", service="macos-release-builder") as span:
            span.set_tag("project_root", str(project_root))
            span.set_tag("skip_tests", skip_tests)
            return _package_extension_impl(project_root, skip_tests, span)
    else:
        return _package_extension_impl(project_root, skip_tests, None)

def _package_extension_impl(project_root: Path, skip_tests: bool, span: Any) -> bool:
    """Implementation of package_extension"""
    script_path = project_root / "scripts" / "extensions" / "package_workspace_rag.py"
    
    if not script_path.exists():
        log_error(f"Extension packaging script not found: {script_path}")
        return False
    
    cmd = [sys.executable, str(script_path), "package"]
    if skip_tests:
        cmd.append("--skip-tests")
    
    try:
        result = run_command(cmd)
        log_info("OK - Extension packaged")
        return True
    except subprocess.CalledProcessError as e:
        log_error(f"Extension packaging failed: {e}")
        return False

def install_extensions_to_vm(project_root: Path) -> bool:
    """Install extensions to VM resources"""
    if TRACING_ENABLED:
        with tracer.trace("install_extensions", service="macos-release-builder") as span:
            span.set_tag("project_root", str(project_root))
            return _install_extensions_impl(project_root, span)
    else:
        return _install_extensions_impl(project_root, None)

def _install_extensions_impl(project_root: Path, span: Any) -> bool:
    """Implementation of install_extensions_to_vm"""
    script_path = project_root / "scripts" / "extensions" / "install_extensions_to_vm.py"
    
    if not script_path.exists():
        log_error(f"Extension installation script not found: {script_path}")
        return False
    
    cmd = [sys.executable, str(script_path), "install"]
    
    try:
        result = run_command(cmd)
        log_info("OK - Extensions installed to VM resources")
        return True
    except subprocess.CalledProcessError as e:
        log_error(f"Extension installation failed: {e}")
        return False

def build_vm_manager(project_root: Path) -> bool:
    """Build VM manager"""
    if TRACING_ENABLED:
        with tracer.trace("build_vm_manager", service="macos-release-builder") as span:
            span.set_tag("project_root", str(project_root))
            return _build_vm_manager_impl(project_root, span)
    else:
        return _build_vm_manager_impl(project_root, None)

def _build_vm_manager_impl(project_root: Path, span: Any) -> bool:
    """Implementation of build_vm_manager"""
    vm_dir = project_root / "platforms" / "macos" / "vm"
    
    if not (vm_dir / "Package.swift").exists():
        log_warning("VM Package.swift not found, skipping VM build")
        return True
    
    log_info("Building VM manager")
    
    try:
        # Build Swift package
        run_command(["swift", "build", "-c", "release"], cwd=vm_dir)
        
        # Find and copy binary
        result = run_command(["swift", "build", "-c", "release", "--show-bin-path"], cwd=vm_dir)
        bin_path = Path(result.stdout.strip()) / "main"
        
        if bin_path.exists():
            dest_dir = project_root / "src-tauri" / "binaries"
            dest_dir.mkdir(parents=True, exist_ok=True)
            
            dest_file = dest_dir / "vibecode-vm-aarch64-apple-darwin"
            shutil.copy2(bin_path, dest_file)
            dest_file.chmod(0o755)
            
            log_info(f"OK - VM manager built and copied to {dest_file}")
            if span:
                span.set_tag("vm_binary", str(dest_file))
            return True
        else:
            log_error("VM binary not found after build")
            return False
            
    except subprocess.CalledProcessError as e:
        log_error(f"VM manager build failed: {e}")
        return False

def build_tauri_app(project_root: Path, build_type: str, target: str = "universal-apple-darwin") -> Optional[Path]:
    """Build Tauri application"""
    if TRACING_ENABLED:
        with tracer.trace("build_tauri_app", service="macos-release-builder") as span:
            span.set_tag("project_root", str(project_root))
            span.set_tag("build_type", build_type)
            span.set_tag("target", target)
            return _build_tauri_app_impl(project_root, build_type, target, span)
    else:
        return _build_tauri_app_impl(project_root, build_type, target, None)

def _build_tauri_app_impl(project_root: Path, build_type: str, target: str, span: Any) -> Optional[Path]:
    """Implementation of build_tauri_app"""
    
    # Setup environment
    build_env = {
        "PKG_CONFIG_PATH": "/opt/homebrew/opt/openssl@3/lib/pkgconfig",
        "NEXT_CONFIG_FILE": "next.config.tauri.js",
        "NEXT_TELEMETRY_DISABLED": "1"
    }
    
    # Install Rust targets
    log_info("Installing Rust targets")
    run_command(["rustup", "target", "add", "x86_64-apple-darwin", "aarch64-apple-darwin"])
    
    # Install npm dependencies
    log_info("Installing npm dependencies")
    try:
        run_command(["npm", "ci", "--legacy-peer-deps"], cwd=project_root, env=build_env)
    except subprocess.CalledProcessError:
        log_warning("npm ci failed, trying npm install")
        run_command(["npm", "install", "--legacy-peer-deps"], cwd=project_root, env=build_env)
    
    # Build frontend
    log_info("Building frontend")
    try:
        run_command(["npm", "run", "build"], cwd=project_root, env=build_env, check=False)
    except subprocess.CalledProcessError:
        log_warning("Frontend build had issues, continuing")
    
    # Build Tauri app
    log_info(f"Building Tauri application ({build_type})")
    
    if build_type == "debug":
        cmd = ["npm", "run", "tauri:build:debug", "--", "--target", target]
    else:
        cmd = ["npm", "run", "tauri:build", "--", "--target", target]
    
    try:
        run_command(cmd, cwd=project_root, env=build_env)
        
        # Locate app bundle
        bundle_dir = project_root / "src-tauri" / "target" / target / build_type / "bundle" / "macos"
        app_path = bundle_dir / "VibeCode.app"
        
        if app_path.exists():
            log_info(f"OK - Tauri application built: {app_path}")
            if span:
                span.set_tag("app_path", str(app_path))
                span.set_tag("app_size", get_directory_size(app_path))
            return app_path
        else:
            log_error("App bundle not found after build")
            return None
            
    except subprocess.CalledProcessError as e:
        log_error(f"Tauri build failed: {e}")
        return None

def get_directory_size(path: Path) -> int:
    """Calculate total size of directory"""
    total = 0
    for item in path.rglob('*'):
        if item.is_file():
            total += item.stat().st_size
    return total

def format_size(size_bytes: int) -> str:
    """Format size in human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"

def create_distribution_artifacts(project_root: Path, app_path: Path, version: str, create_dmg: bool) -> Dict[str, Path]:
    """Create distribution artifacts (DMG, tarball, checksums)"""
    if TRACING_ENABLED:
        with tracer.trace("create_artifacts", service="macos-release-builder") as span:
            span.set_tag("app_path", str(app_path))
            span.set_tag("version", version)
            span.set_tag("create_dmg", create_dmg)
            return _create_artifacts_impl(project_root, app_path, version, create_dmg, span)
    else:
        return _create_artifacts_impl(project_root, app_path, version, create_dmg, None)

def _create_artifacts_impl(project_root: Path, app_path: Path, version: str, create_dmg: bool, span: Any) -> Dict[str, Path]:
    """Implementation of create_distribution_artifacts"""
    
    dist_dir = project_root / "dist" / "releases" / "macos"
    dist_dir.mkdir(parents=True, exist_ok=True)
    
    artifacts = {}
    
    # Create tarball
    log_info("Creating app bundle archive")
    tarball_name = f"VibeCode-{version}-macOS-universal.app.tar.gz"
    tarball_path = dist_dir / tarball_name
    
    run_command(
        ["tar", "-czf", str(tarball_path), app_path.name],
        cwd=app_path.parent
    )
    
    artifacts["tarball"] = tarball_path
    log_info(f"OK - Archive created: {tarball_path} ({format_size(tarball_path.stat().st_size)})")
    
    # Create DMG if requested
    if create_dmg:
        log_info("Creating DMG installer")
        dmg_name = f"VibeCode-{version}-macOS-universal.dmg"
        dmg_path = dist_dir / dmg_name
        
        # Use hdiutil (reliable fallback)
        try:
            run_command([
                "hdiutil", "create",
                "-volname", f"VibeCode {version}",
                "-srcfolder", str(app_path),
                "-ov", "-format", "UDZO",
                str(dmg_path)
            ])
            
            artifacts["dmg"] = dmg_path
            log_info(f"OK - DMG created: {dmg_path} ({format_size(dmg_path.stat().st_size)})")
        except subprocess.CalledProcessError as e:
            log_warning(f"DMG creation failed: {e}")
    
    # Generate checksums for all artifacts
    for name, path in artifacts.items():
        for algorithm in ["sha256", "sha512"]:
            checksum = calculate_checksum(path, algorithm)
            checksum_file = path.with_suffix(f"{path.suffix}.{algorithm}")
            checksum_file.write_text(f"{checksum}  {path.name}\n")
            log_info(f"{algorithm.upper()}: {checksum}")
    
    if span:
        span.set_tag("artifacts_count", len(artifacts))
        span.set_tag("dist_dir", str(dist_dir))
    
    return artifacts

def calculate_checksum(filepath: Path, algorithm: str = "sha256") -> str:
    """Calculate file checksum"""
    import hashlib
    hash_obj = hashlib.new(algorithm)
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_obj.update(chunk)
    return hash_obj.hexdigest()

def create_release_notes(dist_dir: Path, version: str, artifacts: Dict[str, Path]):
    """Create release notes"""
    log_info("Creating release notes")
    
    notes_path = dist_dir / "RELEASE_NOTES.md"
    
    release_notes = f"""# VibeCode v{version} - macOS Release

Released: {datetime.utcnow().strftime('%Y-%m-%d')}

## Package Contents

- **Platform**: macOS Universal (Intel + Apple Silicon)
- **Pre-installed Extensions**: Workspace RAG (AI-powered code assistant)

## Artifacts

"""
    
    for name, path in artifacts.items():
        size = format_size(path.stat().st_size)
        release_notes += f"- **{name.upper()}**: `{path.name}` ({size})\n"
    
    release_notes += """
## Features

- Tauri-based native macOS application
- Embedded OpenVSCode Server running in Hyperkit VM
- Full Docker container management
- Distributed tracing with Datadog
- Local MLX acceleration on Apple Silicon
- Multi-LLM provider support (OpenAI, Anthropic, Google, OpenRouter)

## System Requirements

- macOS 13.0 (Ventura) or later
- 8 GB RAM minimum (16 GB recommended)
- 10 GB free disk space
- Apple Silicon (M1/M2/M3) or Intel processor

## Installation

See full installation instructions in the documentation.

## Support

- Documentation: https://github.com/yourusername/vibecode-webgui/wiki
- Issues: https://github.com/yourusername/vibecode-webgui/issues

## License

MIT License
"""
    
    notes_path.write_text(release_notes)
    log_info(f"OK - Release notes created: {notes_path}")

def show_menu():
    """Display interactive menu"""
    print(f"\n{Colors.BLUE}╔════════════════════════════════════════════╗{Colors.NC}")
    print(f"{Colors.BLUE}║   VibeCode macOS Release Builder          ║{Colors.NC}")
    print(f"{Colors.BLUE}╚════════════════════════════════════════════╝{Colors.NC}\n")
    
    print("Select build configuration:")
    print("  1) Full release build (with DMG)")
    print("  2) Release build (no DMG)")
    print("  3) Debug build")
    print("  4) Quick build (skip tests)")
    print("  5) Check prerequisites only")
    print("  6) Exit")
    print()
    
    while True:
        try:
            choice = input("Enter choice [1-6]: ").strip()
            
            if choice == "1":
                return {"build_type": "release", "create_dmg": True, "skip_tests": False}
            elif choice == "2":
                return {"build_type": "release", "create_dmg": False, "skip_tests": False}
            elif choice == "3":
                return {"build_type": "debug", "create_dmg": False, "skip_tests": False}
            elif choice == "4":
                return {"build_type": "release", "create_dmg": True, "skip_tests": True}
            elif choice == "5":
                return {"build_type": "check", "create_dmg": False, "skip_tests": False}
            elif choice == "6":
                return None
            else:
                print("Invalid choice. Please enter 1-6.")
        except KeyboardInterrupt:
            print("\nCancelled by user")
            return None

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Build complete macOS release with Datadog tracing"
    )
    parser.add_argument(
        "--build-type",
        choices=["release", "debug"],
        default="release",
        help="Build type (release or debug)"
    )
    parser.add_argument(
        "--no-dmg",
        action="store_true",
        help="Skip DMG creation"
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip running tests"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Path to project root (auto-detected if not specified)"
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only check prerequisites"
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
    
    # Get version
    package_json = project_root / "package.json"
    if package_json.exists():
        version = json.loads(package_json.read_text())["version"]
    else:
        version = "1.0.0"
    
    # Initialize Datadog tracing
    if TRACING_ENABLED:
        # Datadog uses environment variables for configuration
        if not os.getenv("DD_AGENT_HOST"):
            os.environ["DD_AGENT_HOST"] = "localhost"
        if not os.getenv("DD_TRACE_AGENT_PORT"):
            os.environ["DD_TRACE_AGENT_PORT"] = "8126"
        log_info("Datadog tracing enabled")
    
    # Show header
    print(f"\n{Colors.BLUE}╔════════════════════════════════════════════════════════╗{Colors.NC}")
    print(f"{Colors.BLUE}║     VibeCode macOS Release Builder v{version:<17}║{Colors.NC}")
    print(f"{Colors.BLUE}╚════════════════════════════════════════════════════════╝{Colors.NC}\n")
    
    # If no build type specified, show menu
    if not (args.build_type or args.check_only) and sys.stdin.isatty():
        menu_result = show_menu()
        if not menu_result:
            return 0
        
        if menu_result["build_type"] == "check":
            check_prerequisites()
            return 0
        
        build_type = menu_result["build_type"]
        create_dmg = menu_result["create_dmg"]
        skip_tests = menu_result["skip_tests"]
    else:
        build_type = args.build_type
        create_dmg = not args.no_dmg
        skip_tests = args.skip_tests
    
    # Check prerequisites
    log_step(1, 8, "Checking prerequisites")
    versions = check_prerequisites()
    
    if args.check_only:
        return 0
    
    # Build process with tracing
    if TRACING_ENABLED:
        with tracer.trace("build_release", service="macos-release-builder") as span:
            span.set_tag("version", version)
            span.set_tag("build_type", build_type)
            span.set_tag("create_dmg", create_dmg)
            return _execute_build(project_root, version, build_type, create_dmg, skip_tests, span)
    else:
        return _execute_build(project_root, version, build_type, create_dmg, skip_tests, None)

def _execute_build(project_root: Path, version: str, build_type: str, create_dmg: bool, skip_tests: bool, span: Any) -> int:
    """Execute the build process"""
    
    try:
        # Package extension
        log_step(2, 8, "Packaging Workspace RAG extension")
        if not package_extension(project_root, skip_tests):
            return 1
        
        # Install extensions to VM
        log_step(3, 8, "Installing extensions to VM resources")
        if not install_extensions_to_vm(project_root):
            return 1
        
        # Build VM manager
        log_step(4, 8, "Building VM manager")
        if not build_vm_manager(project_root):
            log_warning("VM manager build failed, continuing anyway")
        
        # Build Tauri app
        log_step(5, 8, "Building Tauri application")
        app_path = build_tauri_app(project_root, build_type)
        if not app_path:
            return 1
        
        # Create distribution artifacts
        log_step(6, 8, "Creating distribution artifacts")
        artifacts = create_distribution_artifacts(project_root, app_path, version, create_dmg)
        
        # Create release notes
        log_step(7, 8, "Creating release documentation")
        dist_dir = project_root / "dist" / "releases" / "macos"
        create_release_notes(dist_dir, version, artifacts)
        
        # Success summary
        log_step(8, 8, "Build complete")
        
        print(f"\n{Colors.GREEN}╔════════════════════════════════════════════════════════╗{Colors.NC}")
        print(f"{Colors.GREEN}║           Build Complete - Success                     ║{Colors.NC}")
        print(f"{Colors.GREEN}╚════════════════════════════════════════════════════════╝{Colors.NC}\n")
        
        print(f"{Colors.GREEN}Release Artifacts:{Colors.NC}")
        print(f"  Version: {version}")
        print(f"  Location: {dist_dir}")
        print()
        
        for name, path in artifacts.items():
            size = format_size(path.stat().st_size)
            print(f"  {name.upper()}:")
            print(f"    File: {path.name}")
            print(f"    Size: {size}")
            print()
        
        print(f"{Colors.GREEN}Pre-installed Extensions:{Colors.NC}")
        print("  - Workspace RAG (AI-powered code assistant)")
        print()
        
        if span:
            span.set_tag("success", True)
        
        return 0
        
    except Exception as e:
        log_error(f"Build failed: {e}")
        if span:
            span.set_tag("error", True)
            span.set_tag("error.message", str(e))
        return 1

if __name__ == "__main__":
    sys.exit(main())
