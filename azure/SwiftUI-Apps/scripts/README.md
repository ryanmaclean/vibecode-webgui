# Scripts Directory

Automation scripts for VibeCode SwiftUI Apps.

## Available Scripts

### 🖥️ VM Terminal Access

**`connect-vm-terminal.sh`** - Connect to VM console via PTY for interactive terminal access

Provides interactive shell access to running VMs through pseudo-terminal (PTY) devices.

**Usage:**
```bash
# Auto-detect and connect to VM
bash scripts/connect-vm-terminal.sh --auto

# Connect to specific PTY device
bash scripts/connect-vm-terminal.sh /dev/ttys001

# List available PTY devices
bash scripts/connect-vm-terminal.sh --list

# Use tmux instead of screen
bash scripts/connect-vm-terminal.sh --tmux --auto
```

**Features:**
- ✅ Auto-detection of VM PTY devices
- ✅ Multiple terminal emulators (screen, tmux, minicom)
- ✅ Interactive device selection
- ✅ Terminal resize support
- ✅ Control sequence handling (Ctrl+C, Ctrl+D, etc.)

---

**`vm-terminal-resize.sh`** - Handle terminal resize events for VM PTY

Monitors terminal size changes and propagates them to VM console.

**Usage:**
```bash
bash scripts/vm-terminal-resize.sh /dev/ttys001
```

---

**`test-pty-functionality.sh`** - Test PTY/TTY functionality

Comprehensive test suite for verifying PTY functionality is working correctly.

**Usage:**
```bash
bash scripts/test-pty-functionality.sh
```

**Tests:**
- PTY device creation
- Required tools (screen, tmux, stty)
- Terminal size detection
- Script permissions and syntax
- Help and list functionality

---

### 📦 Release Management

**`create-github-release.py`** - Create GitHub releases with build artifacts

Creates a GitHub release and uploads:
- BasicVibeCode.app (zipped)
- LiquidGlassVibeCode.app (zipped)
- bun-openvscode.cpio.gz initramfs

**Usage:**
```bash
python scripts/create-github-release.py v1.2.0
python scripts/create-github-release.py v1.2.0-beta --prerelease
python scripts/create-github-release.py v1.2.0-rc1 --draft
```

**Prerequisites:**
- **ddtrace REQUIRED** (install: `pip3 install --break-system-packages --user ddtrace`)
- GitHub CLI (`gh`) installed and authenticated
- Build artifacts present in repository
- Git tags pushed to remote

**Features:**
- ✅ Automatic artifact packaging (.zip creation)
- ✅ Release notes generation from git history
- ✅ Categorized changelog (Features, Fixes, Docs)
- ✅ ddtrace integration for observability
- ✅ Graceful fallback if ddtrace unavailable

## Python Script Standards

All Python scripts in this repository follow these standards:

### 1. **ddtrace Integration**
Every script must include ddtrace with graceful fallback:
```python
try:
    import ddtrace
    from ddtrace import tracer
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    print("⚠️  ddtrace not available, running without tracing", file=sys.stderr)
```

### 2. **Colors Class**
Consistent terminal output using ANSI colors:
```python
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'
```

### 3. **Type Hints**
Use type hints for all function parameters and return values:
```python
def process_artifact(path: Path) -> Tuple[bool, str]:
    ...
```

### 4. **Docstrings**
Module-level and function-level documentation:
```python
"""
Script description

Usage:
    python script_name.py [arguments]

Example:
    python script_name.py --option value
"""
```

### 5. **Error Handling**
Proper error messages with colors and sys.exit:
```python
def error(msg: str):
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}", file=sys.stderr)
    sys.exit(1)
```

## Why ddtrace?

**Consistent observability across the entire stack:**
- **Swift apps**: Use Datadog SDK for VM operations
- **Python scripts**: Use ddtrace for build/deploy operations
- **JavaScript/Bun**: Can use dd-trace for server operations

**Benefits:**
- Correlate VM boot with build artifacts
- Track release process end-to-end
- Debug production issues with distributed traces
- Identify bottlenecks in CI/CD pipeline

## Example: Full Script Template

See `create-github-release.py` for a complete example following all standards.

## Related Documentation

- [REFACTORING-IN-PROGRESS.md](../REFACTORING-IN-PROGRESS.md) - Python script standards
- [.ai-rules](../.ai-rules) - Machine-readable rules for AI assistants
- [.cursorrules](../.cursorrules) - IDE-specific rules with templates
