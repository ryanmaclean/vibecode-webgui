# VibeCode CLI - Developer Documentation

**Version:** 3.2.0
**Author:** VibeCode Team
**Updated:** 2026-01-14

---

## Table of Contents

1. [Architecture](#architecture)
2. [Code Structure](#code-structure)
3. [Adding New Commands](#adding-new-commands)
4. [Service Detection](#service-detection)
5. [Error Handling](#error-handling)
6. [Testing](#testing)
7. [Distribution](#distribution)
8. [Contributing](#contributing)

---

## Architecture

### Overview

The VibeCode CLI is a Bash script that provides a unified interface to the VibeCode Unified Services application. It wraps common operations and provides service health checking.

```
┌─────────────────────────────────────────────┐
│           vibecode CLI                      │
│  ┌──────────────────────────────────────┐  │
│  │  Command Parser                      │  │
│  └──────────────────────────────────────┘  │
│               │                             │
│      ┌────────┴────────┐                   │
│      │                 │                   │
│  ┌───▼────┐      ┌────▼─────┐             │
│  │ Build  │      │  Start   │             │
│  │ Stop   │      │  Status  │             │
│  │ Check  │      │  SSH     │             │
│  └────────┘      └──────────┘             │
└─────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  UnifiedServicesVibeCodeApp.app             │
│  ┌──────────────────────────────────────┐  │
│  │  VM Manager (Swift)                  │  │
│  │  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ VZ Framework │  │ Port Forward │ │  │
│  │  └──────────────┘  └──────────────┘ │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Linux VM                                   │
│  ┌──────────────────────────────────────┐  │
│  │  Services:                           │  │
│  │  • SSH (2222)                        │  │
│  │  • Valkey (6379)                     │  │
│  │  • PostgreSQL (5432)                 │  │
│  │  • OpenVSCode (8080)                 │  │
│  │  • Docker (2375)                     │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Components

1. **vibecode** - Main CLI script (Bash)
2. **vibecode-completion.bash** - Bash tab completion
3. **vibecode-completion.zsh** - Zsh tab completion
4. **install-vibecode-cli.sh** - Installation script

### Dependencies

- **Bash 4.0+** - Main script interpreter
- **Standard Unix tools:**
  - `pgrep` - Process detection
  - `nc` (netcat) - Port checking
  - `curl` - HTTP requests
  - `arp` - IP address detection
  - `ssh` - Remote shell access
  - `ps` - Process info
  - `open` - macOS app launcher

---

## Code Structure

### Main Script Structure

```bash
vibecode
├── Constants & Configuration
│   ├── VERSION
│   ├── APP_NAME
│   ├── PROJECT_ROOT
│   └── Service ports
├── Helper Functions
│   ├── print_* (colored output)
│   ├── is_vm_running()
│   ├── get_vm_pid()
│   ├── check_port()
│   ├── check_http()
│   ├── check_service()
│   ├── get_vm_ip()
│   └── detect_ide_type()
├── Command Functions
│   ├── cmd_version()
│   ├── cmd_help()
│   ├── cmd_build()
│   ├── cmd_start()
│   ├── cmd_stop()
│   ├── cmd_restart()
│   ├── cmd_status()
│   ├── cmd_check()
│   ├── cmd_services()
│   ├── cmd_ssh()
│   ├── cmd_logs()
│   ├── cmd_docker()
│   └── cmd_ip()
└── Main Entry Point
    └── main()
```

### Key Functions

#### `is_vm_running()`

Checks if the VM process is running.

```bash
is_vm_running() {
    pgrep -f "$APP_NAME" > /dev/null 2>&1
}
```

**Returns:**
- Exit code 0 if running
- Exit code 1 if not running

**Usage:**
```bash
if is_vm_running; then
    echo "VM is running"
fi
```

---

#### `check_port(host, port, timeout)`

Checks if a TCP port is open.

```bash
check_port() {
    local host=$1
    local port=$2
    local timeout=${3:-1}
    nc -z -w "$timeout" "$host" "$port" > /dev/null 2>&1
}
```

**Parameters:**
- `host` - Hostname or IP address
- `port` - Port number
- `timeout` - Timeout in seconds (default: 1)

**Returns:**
- Exit code 0 if port is open
- Exit code 1 if port is closed

**Usage:**
```bash
if check_port localhost 2222; then
    echo "SSH is accessible"
fi
```

---

#### `check_http(url, timeout)`

Checks if an HTTP endpoint is accessible.

```bash
check_http() {
    local url=$1
    local timeout=${2:-2}
    curl -s -f --connect-timeout "$timeout" "$url" > /dev/null 2>&1
}
```

**Parameters:**
- `url` - HTTP URL to check
- `timeout` - Timeout in seconds (default: 2)

**Returns:**
- Exit code 0 if accessible
- Exit code 1 if not accessible

**Usage:**
```bash
if check_http "http://localhost:8080"; then
    echo "OpenVSCode is accessible"
fi
```

---

#### `check_service(name, host, port, protocol)`

Checks a service and prints status.

```bash
check_service() {
    local name=$1
    local host=$2
    local port=$3
    local protocol=${4:-tcp}

    if [ "$protocol" = "http" ]; then
        if check_http "http://$host:$port"; then
            print_success "$name: http://$host:$port"
            return 0
        fi
    else
        if check_port "$host" "$port"; then
            print_success "$name: $host:$port"
            return 0
        fi
    fi

    print_error "$name: Not accessible on $host:$port"
    return 1
}
```

**Parameters:**
- `name` - Service name (for display)
- `host` - Hostname or IP
- `port` - Port number
- `protocol` - "tcp" or "http" (default: "tcp")

**Returns:**
- Exit code 0 if service is accessible
- Exit code 1 if not accessible

**Usage:**
```bash
check_service "SSH" "localhost" 2222
check_service "OpenVSCode" "localhost" 8080 "http"
```

---

#### `get_vm_ip()`

Gets VM IP address from ARP table.

```bash
get_vm_ip() {
    arp -an | grep -i "192.168.64" | grep -v ".1\|.255" | head -1 | awk '{print $2}' | tr -d '()'
}
```

**Returns:**
- IP address (e.g., "192.168.64.3")
- Empty string if not found

**Usage:**
```bash
vm_ip=$(get_vm_ip)
if [ -n "$vm_ip" ]; then
    echo "VM IP: $vm_ip"
fi
```

**Note:** This assumes the VM uses the 192.168.64.x network range (VZ NAT default).

---

#### `detect_ide_type()`

Detects IDE type by checking HTTP response.

```bash
detect_ide_type() {
    if ! check_port localhost "$OPENVSCODE_PORT"; then
        echo "unknown (port not accessible)"
        return
    fi

    local response
    response=$(curl -s --connect-timeout 2 "http://localhost:$OPENVSCODE_PORT" 2>/dev/null || echo "")

    if echo "$response" | grep -q "openvscode-server"; then
        echo "OpenVSCode Server"
    elif echo "$response" | grep -q "code-server"; then
        echo "code-server"
    elif [ -n "$response" ]; then
        echo "VS Code (type unknown)"
    else
        echo "unknown"
    fi
}
```

**Returns:**
- "OpenVSCode Server"
- "code-server"
- "VS Code (type unknown)"
- "unknown (port not accessible)"
- "unknown"

**Usage:**
```bash
ide_type=$(detect_ide_type)
echo "IDE: $ide_type"
```

---

### Color Output

The CLI uses ANSI color codes for readable output:

```bash
# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'  # No Color

# Helper functions
print_success()  # Green with ✓
print_error()    # Red with ✗
print_warning()  # Yellow with ⚠
print_info()     # Cyan with →
print_header()   # Bold blue with border
```

---

## Adding New Commands

### Step 1: Define Command Function

Create a new function following the naming convention `cmd_<name>()`:

```bash
cmd_mycommand() {
    print_header "My Command"

    # Check prerequisites
    if ! is_vm_running; then
        print_error "VM is not running"
        exit 1
    fi

    # Command logic here
    print_info "Doing something..."

    # Check result
    if some_check; then
        print_success "Command succeeded"
    else
        print_error "Command failed"
        exit 1
    fi
}
```

### Step 2: Add to Main Switch

Add your command to the main `case` statement:

```bash
main() {
    # ...
    case "$command" in
        # ... existing commands ...
        mycommand)
            cmd_mycommand "$@"
            ;;
        # ...
    esac
}
```

### Step 3: Update Help Text

Add your command to `cmd_help()`:

```bash
cmd_help() {
    cat << 'EOF'
COMMANDS:
    # ... existing commands ...
    mycommand     Description of my command
EOF
}
```

### Step 4: Add Completion

Update `vibecode-completion.bash`:

```bash
_vibecode_completions() {
    # ...
    opts="build start stop ... mycommand"
    # ...
}
```

Update `vibecode-completion.zsh`:

```bash
_vibecode() {
    local -a commands
    commands=(
        # ... existing commands ...
        'mycommand:Description of my command'
    )
    # ...
}
```

### Example: Adding a "backup" Command

```bash
# 1. Add command function
cmd_backup() {
    print_header "Backing Up VM Data"

    if ! is_vm_running; then
        print_error "VM must be stopped for backup"
        exit 1
    fi

    local data_dir="$HOME/Library/Application Support/VibeCode/vm-data"
    local backup_file="$HOME/vibecode-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

    print_info "Creating backup: $backup_file"

    if tar -czf "$backup_file" -C "$(dirname "$data_dir")" "$(basename "$data_dir")"; then
        print_success "Backup created: $backup_file"
        ls -lh "$backup_file"
    else
        print_error "Backup failed"
        exit 1
    fi
}

# 2. Add to main switch
main() {
    case "$command" in
        # ...
        backup)
            cmd_backup "$@"
            ;;
        # ...
    esac
}

# 3. Update help
cmd_help() {
    cat << 'EOF'
COMMANDS:
    backup        Backup VM data to tar.gz
EOF
}

# 4. Update completions
# In vibecode-completion.bash:
opts="build start stop ... backup"

# In vibecode-completion.zsh:
commands=(
    'backup:Backup VM data to tar.gz'
)
```

---

## Service Detection

### Port Checking Strategy

The CLI uses `netcat` (nc) for fast port checking:

```bash
nc -z -w 1 localhost 2222
```

**Flags:**
- `-z` - Zero-I/O mode (just check, don't send data)
- `-w 1` - Timeout after 1 second

**Advantages:**
- Fast (1 second timeout)
- No dependencies
- Works for any TCP port

### HTTP Checking Strategy

For HTTP services (OpenVSCode), use `curl`:

```bash
curl -s -f --connect-timeout 2 http://localhost:8080
```

**Flags:**
- `-s` - Silent (no progress)
- `-f` - Fail on HTTP errors
- `--connect-timeout 2` - 2 second timeout

**Advantages:**
- Verifies HTTP is responding
- Can detect IDE type from response

### IDE Type Detection

To distinguish code-server from OpenVSCode Server:

1. **Fetch HTTP response:**
   ```bash
   response=$(curl -s http://localhost:8080)
   ```

2. **Search for identifiers:**
   ```bash
   if echo "$response" | grep -q "openvscode-server"; then
       echo "OpenVSCode Server"
   elif echo "$response" | grep -q "code-server"; then
       echo "code-server"
   fi
   ```

3. **Fallback:**
   - If no identifier found: "VS Code (type unknown)"
   - If port not accessible: "unknown (port not accessible)"

### VM IP Detection

The VM uses VZ framework NAT, which assigns IPs in the `192.168.64.x` range.

**Strategy:**

1. **Query ARP table:**
   ```bash
   arp -an
   ```

2. **Filter for VM network:**
   ```bash
   grep -i "192.168.64"
   ```

3. **Exclude gateway and broadcast:**
   ```bash
   grep -v ".1\|.255"
   ```

4. **Extract IP:**
   ```bash
   awk '{print $2}' | tr -d '()'
   ```

**Complete function:**
```bash
get_vm_ip() {
    arp -an | grep -i "192.168.64" | grep -v ".1\|.255" | head -1 | awk '{print $2}' | tr -d '()'
}
```

**Limitations:**
- Only works after VM has obtained DHCP lease
- May take 10-30 seconds after boot
- Requires VM to have sent network traffic

---

## Error Handling

### Exit Codes

The CLI uses standard exit codes:

- **0** - Success
- **1** - General error
- **2** - Misuse of shell command
- **127** - Command not found

### Error Reporting

Always use `print_error()` for error messages:

```bash
if ! some_check; then
    print_error "Operation failed: reason"
    exit 1
fi
```

### Prerequisite Checks

Check prerequisites before operations:

```bash
cmd_build() {
    # Check Swift is available
    if ! command -v swift &> /dev/null; then
        print_error "Swift not found. Install Xcode."
        exit 1
    fi

    # Check build script exists
    if [ ! -f "$BUILD_SCRIPT" ]; then
        print_error "Build script not found: $BUILD_SCRIPT"
        exit 1
    fi

    # Proceed with build
    # ...
}
```

### Safe Process Management

When killing processes, always check if they exist:

```bash
cmd_stop() {
    if ! is_vm_running; then
        print_warning "VibeCode is not running"
        return 0  # Not an error
    fi

    pkill -f "$APP_NAME" || true  # Don't fail if already stopped

    # Verify stopped
    sleep 2
    if is_vm_running; then
        print_error "Failed to stop VibeCode"
        exit 1
    fi
}
```

---

## Testing

### Manual Testing Checklist

Test all commands:

```bash
# Build
vibecode build

# Start/Stop
vibecode start
sleep 120
vibecode status
vibecode stop

# Restart
vibecode restart
sleep 120

# Status and checks
vibecode status
vibecode check
vibecode services

# Service access
vibecode ssh  # (exit immediately)
vibecode ip
vibecode docker

# Info commands
vibecode version
vibecode help
```

### Automated Testing

Create a test script:

```bash
#!/bin/bash
# test-vibecode-cli.sh

set -e

echo "Testing vibecode CLI..."

# Test version
vibecode version

# Test help
vibecode help

# Test build (if not already built)
if [ ! -d "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app" ]; then
    vibecode build
fi

# Test start
vibecode start
sleep 120

# Test status
vibecode status

# Test check
vibecode check | grep "All services operational"

# Test IP
vibecode ip

# Test services list
vibecode services

# Test stop
vibecode stop

echo "All tests passed!"
```

### Integration Testing

Test with actual services:

```bash
#!/bin/bash
# test-services.sh

set -e

echo "Starting VibeCode..."
vibecode start
sleep 120

echo "Testing SSH..."
ssh -o "StrictHostKeyChecking=no" -p 2222 root@localhost "echo SSH works" || exit 1

echo "Testing Valkey..."
valkey-cli -h localhost -p 6379 ping | grep PONG || exit 1

echo "Testing PostgreSQL..."
psql -h localhost -p 5432 -U postgres -c "SELECT 1;" || exit 1

echo "Testing OpenVSCode..."
curl -f http://localhost:8080 > /dev/null || exit 1

echo "Testing Docker..."
export DOCKER_HOST=tcp://localhost:2375
docker info || exit 1

echo "All services working!"
```

---

## Distribution

### Packaging

For distribution, create a release package:

```bash
#!/bin/bash
# package-vibecode-cli.sh

VERSION="3.2.0"
PACKAGE_DIR="vibecode-cli-$VERSION"

# Create package directory
mkdir -p "$PACKAGE_DIR"

# Copy files
cp vibecode "$PACKAGE_DIR/"
cp vibecode-completion.bash "$PACKAGE_DIR/"
cp vibecode-completion.zsh "$PACKAGE_DIR/"
cp install-vibecode-cli.sh "$PACKAGE_DIR/"
cp VIBECODE_CLI_GUIDE.md "$PACKAGE_DIR/"
cp VIBECODE_CLI_DEVELOPMENT.md "$PACKAGE_DIR/"

# Create archive
tar -czf "vibecode-cli-$VERSION.tar.gz" "$PACKAGE_DIR"

echo "Package created: vibecode-cli-$VERSION.tar.gz"
```

### Installation Methods

**Method 1: Homebrew (future)**

Create a Homebrew formula:

```ruby
class VibecodeCliDev < Formula
  desc "CLI tool for VibeCode Unified Services"
  homepage "https://github.com/ryanmaclean/vibecode-webgui"
  url "https://github.com/ryanmaclean/vibecode-webgui/releases/download/v3.2.0/vibecode-cli-3.2.0.tar.gz"
  sha256 "..."
  version "3.2.0"

  def install
    bin.install "vibecode"
    bash_completion.install "vibecode-completion.bash" => "vibecode"
    zsh_completion.install "vibecode-completion.zsh" => "_vibecode"
  end

  test do
    system "#{bin}/vibecode", "version"
  end
end
```

**Method 2: Direct download**

```bash
curl -L https://github.com/ryanmaclean/vibecode-webgui/releases/download/v3.2.0/vibecode-cli-3.2.0.tar.gz | tar xz
cd vibecode-cli-3.2.0
./install-vibecode-cli.sh
```

**Method 3: Git clone**

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
./install-vibecode-cli.sh
```

---

## Contributing

### Code Style

1. **Use shellcheck:**
   ```bash
   shellcheck vibecode
   ```

2. **Follow conventions:**
   - Use `snake_case` for functions
   - Use `UPPER_CASE` for constants
   - Use `local` for function variables
   - Quote variables: `"$var"`
   - Use `[[` instead of `[` for tests

3. **Add comments:**
   ```bash
   # Check if VM is running
   if is_vm_running; then
       # Get process ID
       local pid
       pid=$(get_vm_pid)
   fi
   ```

### Pull Request Process

1. **Fork repository**
2. **Create feature branch:**
   ```bash
   git checkout -b feature/my-new-command
   ```
3. **Make changes**
4. **Test thoroughly**
5. **Update documentation**
6. **Submit PR**

### Documentation Updates

When adding features, update:

1. **VIBECODE_CLI_GUIDE.md** - User documentation
2. **VIBECODE_CLI_DEVELOPMENT.md** - Developer documentation
3. **vibecode help** - Help text in script
4. **Completion scripts** - Tab completion

---

## Future Enhancements

### Planned Features

1. **Service logs:**
   ```bash
   vibecode logs ssh
   vibecode logs valkey
   vibecode logs postgres
   vibecode logs openvscode
   ```

2. **Configuration file:**
   ```bash
   ~/.vibecode/config.yaml
   ```

3. **Service management:**
   ```bash
   vibecode service start valkey
   vibecode service stop postgres
   vibecode service restart openvscode
   ```

4. **Backup/restore:**
   ```bash
   vibecode backup
   vibecode restore backup-20260114.tar.gz
   ```

5. **Extensions management:**
   ```bash
   vibecode extensions list
   vibecode extensions install <ext-id>
   ```

6. **Performance monitoring:**
   ```bash
   vibecode monitor
   vibecode stats
   ```

### Ideas for Improvement

- **Colored diff** for status changes
- **JSON output** for scripting (`--json`)
- **Quiet mode** for automation (`--quiet`)
- **Verbose mode** for debugging (`--verbose`)
- **Config file** for custom ports/paths
- **Plugin system** for extensions
- **Interactive mode** (TUI with dialog/whiptail)
- **Auto-update** mechanism
- **Health checks** with notifications

---

## Appendix

### Environment Variables

The CLI can read these environment variables:

- `VIBECODE_PROJECT_ROOT` - Override project root path
- `VIBECODE_APP_PATH` - Override app path
- `DOCKER_HOST` - Docker daemon address (set by `vibecode docker`)

### File Locations

**Script:**
- `/usr/local/bin/vibecode` (system-wide)
- `~/.local/bin/vibecode` (user install)

**Completions:**
- `/usr/local/etc/bash_completion.d/vibecode` (bash, system-wide)
- `~/.local/share/bash-completion/completions/vibecode` (bash, user)
- `/usr/local/share/zsh/site-functions/_vibecode` (zsh, system-wide)
- `~/.local/share/zsh/site-functions/_vibecode` (zsh, user)

**VM Data:**
- `~/Library/Application Support/VibeCode/vm-data/`

**Logs (if available):**
- `~/Library/Logs/VibeCode/console.log`

---

**Last Updated:** 2026-01-14
**Version:** 3.2.0
**Author:** VibeCode Team
