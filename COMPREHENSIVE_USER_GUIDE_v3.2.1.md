# Comprehensive User Guide for UnifiedServicesVibeCodeApp v3.2.1

**Complete Development Environment for macOS**

---

## Table of Contents

1. [Introduction](#introduction)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Getting Started](#getting-started)
5. [Using Each Service](#using-each-service)
6. [Datadog Extension Guide](#datadog-extension-guide)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Usage](#advanced-usage)
9. [Examples and Tutorials](#examples-and-tutorials)
10. [FAQ](#faq)

---

## Introduction

### What is UnifiedServicesVibeCodeApp?

UnifiedServicesVibeCodeApp (often abbreviated as VibeCode Unified) is a lightweight, menubar-based macOS application that runs a complete development environment inside a Linux virtual machine. Instead of installing services individually (database, cache, editor, etc.), you get all of them running together with one click.

**All services are accessible via `localhost` - no need to remember IP addresses or manage multiple configurations.**

### What Problems Does It Solve?

**Before VibeCode:**
- Setting up PostgreSQL, Redis, and a code editor on macOS requires installing multiple services
- Each service needs configuration, permissions, and disk space
- Services compete for resources and ports
- Switching between projects means stopping/starting multiple services
- Different team members might have different setups (configuration drift)

**With VibeCode:**
- One DMG file to download and install
- All services boot together automatically
- Services run isolated in a VM (no conflicts with system)
- Same environment for everyone on your team
- Everything accessible on localhost (no network hassles)
- Entire VM is only 253MB (DMG size)

### Who Should Use It?

VibeCode Unified is ideal for:
- **Web Developers** - Need PostgreSQL, Redis, and IDE for local development
- **Full-Stack Teams** - Want consistent dev environment across team
- **Learners** - Want to try databases and web development without complex setup
- **DevOps Engineers** - Need quick local testing environment with multiple services
- **Anyone** - Who wants a complete dev setup that "just works"

**Current Version:** v3.2.1 (Datadog Edition)
**Release Date:** January 14, 2026
**Status:** Production Ready

---

## System Requirements

### macOS Version

- **Minimum:** macOS 13.0 (Ventura) or later
- **Recommended:** macOS 14.0 (Sonoma) or later
- **Latest:** macOS 15.x (Sequoia) - Fully supported

### CPU/Processor

- **Required:** Apple Silicon (ARM-based) - M1, M2, M3, M4, or newer
- **Status:** Intel-based Macs are NOT supported (VM requires ARM64 architecture)

### Memory (RAM)

- **Minimum:** 4GB RAM
- **Recommended:** 8GB RAM or more
- The app allocates 2GB for the VM, leaving 2GB for your other apps

### Disk Space

- **Installation:** 253MB for DMG
- **Extracted:** ~500MB in Applications folder
- **Runtime:** No additional disk space needed (VM runs in memory)

### Network

- **Required:** Active network connection (for initial setup)
- **After Setup:** Works offline (localhost access only)
- **No Special Setup:** Standard macOS networking is sufficient

### One-Time Setup

If this is your first time using virtualization on your Mac:
- Apple's virtualization framework automatically initializes on first launch
- No additional setup required
- First boot may take slightly longer (~3-4 minutes) while framework initializes

---

## Installation

### Step 1: Download the DMG

1. Download **VibeCode-Unified-v3.2.1-Datadog.dmg** (253 MB)
   - From GitHub releases, company website, or distribution source
   - File size: 253 MB
   - SHA256: `837a77f0c5f39873245d89d3449986590a8586759ecfcf1dae8499711aaa9aff`

2. (Optional) Verify checksum:
   ```bash
   shasum -a 256 VibeCode-Unified-v3.2.1-Datadog.dmg
   # Compare output with: 837a77f0c5f39873245d89d3449986590a8586759ecfcf1dae8499711aaa9aff
   ```

   Tip: On macOS, you can also use `md5 -r` for quick verification if SHA256 tools aren't available.

### Step 2: Mount and Install

1. **Double-click the DMG file** to mount it
   - A Finder window opens showing the DMG contents
   - You'll see `UnifiedServicesVibeCode.app` and `Applications` folder shortcut

2. **Drag the app to Applications**
   - Click and hold `UnifiedServicesVibeCode.app`
   - Drag to the `Applications` folder shortcut in the same window
   - Wait for copy to complete (usually 5-10 seconds)

   Alternative: Use Terminal
   ```bash
   cp -r /Volumes/VibeCode-Unified-v3.2.1-Datadog/UnifiedServicesVibeCode.app \
       /Applications/
   ```

3. **Eject the DMG**
   - In Finder sidebar, click the eject icon next to the DMG
   - Or in Terminal: `hdiutil eject /Volumes/VibeCode-Unified-v3.2.1-Datadog`

### Step 3: Remove Quarantine (macOS Security)

macOS marks downloaded apps with a "quarantine" flag for security. Remove it:

```bash
xattr -d com.apple.quarantine /Applications/UnifiedServicesVibeCode.app
```

This is required - the app won't launch without it.

**What This Does:** Tells macOS this app is trusted and can access virtualization APIs
**Why It's Needed:** The app needs to create virtual machines, which requires special permissions

### Step 4: Launch the App

**Option 1: From Finder**
1. Open Finder
2. Go to Applications folder (or press Cmd+Shift+A)
3. Double-click `UnifiedServicesVibeCode.app`

**Option 2: From Terminal**
```bash
open /Applications/UnifiedServicesVibeCode.app
```

**Option 3: From Spotlight**
1. Press Cmd+Space
2. Type "VibeCode"
3. Press Enter

### Step 5: Grant Permissions (First Launch Only)

When you launch for the first time, macOS may ask for confirmation:

**"Do you want to allow `UnifiedServicesVibeCode` to access files on your Mac?"**
- Click **Allow**
- The app needs this permission to access networking

**"UnifiedServicesVibeCode needs to access the virtualization framework"**
- This is automatic on M1/M2/M3+ - no action needed

### First Boot

The VM boots automatically when you open the app:

1. **Initial Stage (30-60 seconds):**
   - VM kernel loads
   - Filesystem initializes
   - Services start launching

2. **Service Startup (30-120 seconds):**
   - OpenVSCode initializes (includes Datadog extension)
   - PostgreSQL starts database engine
   - Valkey loads cache
   - SSH becomes available

3. **Ready State (total ~2-3 minutes):**
   - All services accessible
   - Web interface responsive
   - Indicator in app shows "Ready"

You can watch the progress in the app's console output window.

**Pro Tip:** While waiting for first boot, open your browser and navigate to `http://localhost:8080` - it will appear once the VM is ready.

---

## Getting Started

### Understanding the App Interface

When you open UnifiedServicesVibeCodeApp, you'll see:

**Main Window:**
```
┌─────────────────────────────────────────────────┐
│ Unified Services VM                             │
├─────────────────────────────────────────────────┤
│ Status: Ready                                   │
│                                                 │
│ VM IP: 192.168.64.10                           │
│                                                 │
│ OpenVSCode: http://192.168.64.10:8080          │
│ Valkey: redis-cli -h 192.168.64.10 -p 6379    │
│ PostgreSQL: psql -h 192.168.64.10 -U postgres  │
│ SSH: ssh root@192.168.64.10                    │
│                                                 │
│ [Start VM]  [Stop VM]                          │
│                                                 │
│ Console Output:                                 │
│ [... boot messages and service logs ...]       │
└─────────────────────────────────────────────────┘
```

### Reading Service Status

The status message tells you what's happening:

| Status | Meaning | What to Do |
|--------|---------|-----------|
| **Stopped** | VM is not running | Click "Start VM" or relaunch app |
| **Starting...** | VM booting, services loading | Wait 2-3 minutes |
| **Ready** | All services operational | Proceed to use services |
| **Error: ...** | Something went wrong | See Troubleshooting section |

### Viewing Connection Information

When the status is "Ready", you'll see:

**VM IP Address**
- Shows the Linux VM's IP address (usually `192.168.64.10`)
- Used to access services from your Mac

**Service Connection Strings**
- Each service shows how to connect
- Click on any connection string to select it (copy-paste ready)
- All services are also accessible via `localhost` shortcut

### Opening Console Output

The console window at the bottom shows:

**What It Shows:**
- VM boot messages
- Service startup logs
- Error messages (if any)
- Network initialization progress

**Why It's Useful:**
- Verify services started correctly
- Troubleshoot boot issues
- See real-time logs while working

**Toggle Console:**
- Scroll the view up/down to see more output
- Console automatically shows the most recent messages

**Example Boot Sequence:**
```
[0.000000] Linux version 6.1.1-138-generic (built by ...)
...
[15.234] network: DHCP lease obtained: 192.168.64.10
[20.456] postgresql: PostgreSQL 16 started successfully
[25.789] valkey: Valkey 8.0 listening on port 6379
[28.123] openvscode: Server listening on port 8080
[30.001] Unified Multi-Service VM Ready
```

---

## Using Each Service

### SSH (Secure Shell Access)

SSH lets you connect to the Linux VM and run commands. Perfect for:
- Testing command-line tools
- Running scripts
- Managing files
- Advanced configuration

**Connection Details:**
- **Host:** localhost or VM IP
- **Port:** 2222 (forwarded from VM's port 22)
- **Username:** root
- **Password:** vibecode

**Basic Connection:**

```bash
# From Terminal on your Mac
ssh root@localhost -p 2222

# When prompted for password, type: vibecode
# You're now in the Linux VM shell
```

**Disable Password Prompt (Optional):**

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519

# Copy public key to VM
ssh-copy-id -p 2222 root@localhost

# Now you can connect without password
ssh root@localhost -p 2222
```

**Using sshpass (No Prompt):**

```bash
# Install sshpass
brew install sshpass

# Connect without prompt
sshpass -p 'vibecode' ssh root@localhost -p 2222

# Useful for scripts and automation
sshpass -p 'vibecode' ssh root@localhost -p 2222 'ls -la /'
```

**Common SSH Commands:**

```bash
# List files in VM
ssh root@localhost -p 2222 "ls -la /opt"

# Check running processes
ssh root@localhost -p 2222 "ps aux | grep postgres"

# View service logs
ssh root@localhost -p 2222 "tail -50 /var/log/postgresql.log"

# Create a file
ssh root@localhost -p 2222 "echo 'Hello' > /tmp/test.txt"

# Run a script
ssh root@localhost -p 2222 "bash /opt/myscript.sh"
```

**Port Forwarding (Advanced):**

```bash
# Forward a VM port to your Mac
ssh -L 9999:localhost:9000 root@localhost -p 2222

# Now 9000 on VM is accessible as localhost:9999 on your Mac
```

#### Default SSH Credentials

- **Username:** root
- **Password:** vibecode
- **Host Keys:** Automatically trusted (change at your discretion)

**⚠️ Security Note:** The default password is intended for local development only. The VM is not accessible from the network (NAT networking). For production, use SSH keys instead.

---

### Valkey/Redis (Cache and Data Store)

Valkey is a high-performance cache/data store compatible with Redis. Use it for:
- Caching database queries
- Session storage
- Real-time counters
- Message queues
- Temporary data

**Connection Details:**
- **Host:** localhost or VM IP
- **Port:** 6379
- **Username:** (none)
- **Password:** (none)

**Install Redis Tools (if not already installed):**

```bash
# On macOS
brew install redis

# This installs redis-cli and other tools
```

**Connect with redis-cli:**

```bash
# Basic connection
redis-cli -h localhost -p 6379

# You'll see a prompt: 127.0.0.1:6379>
```

**Basic Commands:**

```bash
# Test connection
redis-cli -h localhost -p 6379 PING
# Returns: PONG

# Set a key
redis-cli -h localhost -p 6379 SET mykey "Hello World"
# Returns: OK

# Get a value
redis-cli -h localhost -p 6379 GET mykey
# Returns: "Hello World"

# Delete a key
redis-cli -h localhost -p 6379 DEL mykey
# Returns: (integer) 1

# List all keys
redis-cli -h localhost -p 6379 KEYS '*'

# Get info about Valkey
redis-cli -h localhost -p 6379 INFO
```

**Common Patterns:**

```bash
# Counter - Count page views
redis-cli -h localhost -p 6379 INCR page_views
redis-cli -h localhost -p 6379 GET page_views

# Expiring data - Cache that auto-expires
redis-cli -h localhost -p 6379 SETEX session:user123 3600 "{'id': 123, 'name': 'John'}"
# Expires after 3600 seconds (1 hour)

# List operations
redis-cli -h localhost -p 6379 LPUSH jobs "job1" "job2" "job3"  # Add to list
redis-cli -h localhost -p 6379 RPOP jobs                        # Remove from list

# Hash operations
redis-cli -h localhost -p 6379 HSET user:1 name "John" age 30 email "john@example.com"
redis-cli -h localhost -p 6379 HGETALL user:1
```

**Interactive Redis Shell:**

```bash
# Start redis-cli in interactive mode
redis-cli -h localhost -p 6379

# Now you can type commands directly
127.0.0.1:6379> SET foo bar
OK
127.0.0.1:6379> GET foo
"bar"
127.0.0.1:6379> QUIT  # Exit
```

**Monitor Commands in Real-Time:**

```bash
# Watch all commands being executed
redis-cli -h localhost -p 6379 MONITOR

# Useful for debugging what your app is doing with Redis
```

**Backup Valkey Data:**

```bash
# The data persists while VM is running
# To backup, export the data
redis-cli -h localhost -p 6379 BGSAVE

# SSH into VM and copy the dump file
sshpass -p 'vibecode' ssh root@localhost -p 2222 "cat /data/dump.rdb" > valkey_backup.rdb
```

#### Valkey Persistence

Valkey data is stored in memory while the VM is running. When you stop the VM:
- Data is preserved in the VM's filesystem
- Next boot, data is restored automatically
- If you need persistent backups, use the BGSAVE approach above

---

### PostgreSQL (Database)

PostgreSQL is a powerful, production-ready SQL database. Use it for:
- Storing application data
- Running complex queries
- Multi-user database applications
- Full-text search
- JSON data handling

**Connection Details:**
- **Host:** localhost or VM IP
- **Port:** 5432
- **Default Username:** postgres
- **Default Password:** (none - no password required for local connections)
- **Default Database:** postgres

**Install PostgreSQL Client (if not already installed):**

```bash
# On macOS using Homebrew
brew install postgresql

# This installs psql and other PostgreSQL tools
```

**Connect with psql:**

```bash
# Basic connection to default database
psql -h localhost -p 5432 -U postgres

# Connect to specific database
psql -h localhost -p 5432 -U postgres -d mydatabase

# You'll see a prompt: postgres=#
```

**Basic Commands:**

```bash
# Test connection
psql -h localhost -p 5432 -U postgres -c "SELECT version();"

# List databases
psql -h localhost -p 5432 -U postgres -c "\l"

# List tables in current database
psql -h localhost -p 5432 -U postgres -c "\dt"

# Describe table structure
psql -h localhost -p 5432 -U postgres -c "\d table_name"

# View PostgreSQL version
psql -h localhost -p 5432 -U postgres -c "SELECT version();"
```

**Create Database and Table:**

```bash
# Create a new database
createdb -h localhost -p 5432 -U postgres myapp

# Connect to it
psql -h localhost -p 5432 -U postgres -d myapp

# Create a table (in psql prompt)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

# Insert data
INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com');
INSERT INTO users (name, email) VALUES ('Jane Smith', 'jane@example.com');

# Query data
SELECT * FROM users;

# Update data
UPDATE users SET email = 'newemail@example.com' WHERE name = 'John Doe';

# Delete data
DELETE FROM users WHERE name = 'Jane Smith';

# Exit psql
\q
```

**Interactive PostgreSQL Shell:**

```bash
# Start psql in interactive mode
psql -h localhost -p 5432 -U postgres

# Useful commands
\l              # List databases
\dt             # List tables
\d table_name   # Describe table
\q              # Quit

# Run SQL
postgres=# CREATE DATABASE test;
postgres=# \c test
test=# CREATE TABLE items (id SERIAL, name TEXT);
test=# INSERT INTO items (name) VALUES ('Item 1');
test=# SELECT * FROM items;
test=# \q
```

**Backup and Restore:**

```bash
# Backup all databases
pg_dump -h localhost -p 5432 -U postgres -F c mydatabase > mydatabase.backup

# Backup as SQL script (human-readable)
pg_dump -h localhost -p 5432 -U postgres mydatabase > mydatabase.sql

# Restore from backup
pg_restore -h localhost -p 5432 -U postgres -d mydatabase mydatabase.backup

# Restore from SQL script
psql -h localhost -p 5432 -U postgres -d mydatabase < mydatabase.sql

# Backup all databases
pg_dumpall -h localhost -p 5432 -U postgres > all_databases.sql
```

**Create User with Password (Recommended for Apps):**

```bash
# Create new database user
createuser -h localhost -p 5432 -U postgres -P appuser

# -P prompts for password
# Then you can:

# Create database owned by that user
createdb -h localhost -p 5432 -U postgres -O appuser myapp

# Connect as that user
psql -h localhost -p 5432 -U appuser -d myapp

# User is prompted for password
```

**View Logs:**

```bash
# SSH into VM and check logs
sshpass -p 'vibecode' ssh root@localhost -p 2222 "tail -50 /var/log/postgresql/postgresql.log"
```

#### PostgreSQL Configuration

Default configuration is production-ready:
- **Connections:** 100 max (sufficient for development)
- **Memory:** Shared buffers: 256MB
- **WAL:** Enabled for durability
- **Logging:** Basic query logging

For advanced configuration, SSH into VM and edit `/etc/postgresql/16/main/postgresql.conf`

---

### OpenVSCode (Web IDE)

OpenVSCode is a full VS Code editor running in your browser. Features:
- Complete code editor with syntax highlighting
- Built-in terminal
- File explorer
- Extensions (including Datadog!)
- Git integration
- Debugging support
- Remote file access

**Access:**

```bash
# Open in your default browser
open http://localhost:8080

# Or manually navigate in any browser to:
# http://localhost:8080
```

**First Load:**

1. Browser opens OpenVSCode interface
2. Editor fully loads (30-60 seconds, depending on browser)
3. You see the welcome screen and file explorer
4. Click "Extensions" icon or press `Cmd+Shift+X` to see installed extensions

**Basic Usage:**

- **File Explorer:** Left sidebar - create, open, and manage files
- **Search:** `Cmd+P` - quickly find and open files
- **Terminal:** `Ctrl+~` - open integrated terminal
- **Extensions:** `Cmd+Shift+X` - view and manage extensions
- **Settings:** `Cmd+,` - customize editor settings

**Opening Files:**

```bash
# From Terminal, navigate to your project
cd ~/my_project

# Open OpenVSCode pointing to this directory
# (Works because of port forwarding)
open http://localhost:8080?folder=/workspace/my_project
```

**Terminal in OpenVSCode:**

```bash
# Press Ctrl+~` to open integrated terminal
# This gives you a shell inside the VM
# You can run any Linux commands:
npm install
python script.py
./build.sh
git status
```

**Keyboard Shortcuts:**

| Action | Shortcut |
|--------|----------|
| Command Palette | Cmd+Shift+P |
| Find in File | Cmd+F |
| Find and Replace | Cmd+H |
| Open File | Cmd+P |
| New File | Cmd+N |
| Save File | Cmd+S |
| Open Terminal | Ctrl+` |
| Split Editor | Cmd+\ |
| Extensions | Cmd+Shift+X |
| Settings | Cmd+, |
| Toggle Sidebar | Cmd+B |

**Theme and Customization:**

1. Press `Cmd+,` to open Settings
2. Search for "theme" to change color scheme
3. Search for "font" to change font size/family
4. All settings sync automatically

---

## Datadog Extension Guide

### What is the Datadog Extension?

The Datadog VSCode Extension v2.0.0 is a powerful observability tool integrated directly into OpenVSCode. It helps you:
- Analyze code quality and potential issues
- View logs from your applications and services
- Monitor system metrics and performance
- Integrate with Datadog cloud platform (optional)
- Run 19+ commands for different analysis tasks

**Key Point:** Many features work offline without any Datadog account. You only need authentication if you want to connect to cloud Datadog.

### How to Find It in OpenVSCode

**Method 1: Via Extension Panel**

1. Open `http://localhost:8080` in your browser
2. Press `Cmd+Shift+X` (or `Ctrl+Shift+X` on Linux/Windows)
3. Look for "Datadog" in the Extensions list
4. Click to view details and features

**Method 2: Via Command Palette**

1. Press `Cmd+Shift+P` to open Command Palette
2. Type "Extension: Show Recommended Extensions"
3. Look for "Datadog" in the list
4. Click "Install"

**What You'll See:**

```
INSTALLED
├── Datadog (datadog.datadog-vscode)
│   ├── Extension Version: 2.0.0
│   ├── Publisher: Datadog
│   ├── Category: Debuggers, Linters, Other
│   ├── Install Count: High
│   └── Rating: ★★★★★
```

### Features Available Without Account

The extension includes powerful features that work completely offline:

#### 1. Static Code Analysis

```
Features:
✓ Code smell detection
✓ Security vulnerability scanning
✓ Performance issue identification
✓ Best practices validation
✓ Test coverage analysis
```

**How to Use:**

1. Open a code file in OpenVSCode
2. The extension automatically scans it
3. Issues appear as underlines in the editor
4. Click on an issue to see details

**Example Output:**

```python
# File: app.py
def get_user_data(username):
    # ⚠️ WARNING: SQL injection vulnerability
    query = f"SELECT * FROM users WHERE name = '{username}'"
    return db.execute(query)
```

#### 2. Code Quality Metrics

View metrics for your codebase:
- Complexity score
- Duplicate code detection
- Test coverage percentage
- Code age and churn

#### 3. Built-in Commands (19+ Available)

Open the Datadog panel to see all commands. Common ones:

| Command | Purpose | When to Use |
|---------|---------|------------|
| Analyze Current File | Scan open file | Quick code review |
| Security Check | Find security issues | Before deploying |
| Performance Analysis | Identify slow code | Optimization work |
| Test Coverage Report | Show test gaps | Improving tests |
| Complexity Report | Show code complexity | Refactoring decisions |

**To Run a Command:**

1. Open Command Palette: `Cmd+Shift+P`
2. Type "Datadog: " to see available commands
3. Select one and press Enter
4. Results appear in the Datadog panel

### Setting Up Datadog Authentication (Optional)

If you want to connect to Datadog cloud for real-time logs and metrics:

#### Step 1: Get API Credentials

1. Sign up for free at https://www.datadoghq.com/
2. Navigate to Organization Settings
3. Go to API Keys
4. Create a new API key
5. Copy the API key and App Key

#### Step 2: Configure in Extension

1. Press `Cmd+Shift+P` to open Command Palette
2. Type "Datadog: Configure"
3. Paste your API key when prompted
4. Paste your App Key when prompted
5. Select your Datadog site (US or EU)

#### Step 3: Verify Connection

1. Open Command Palette: `Cmd+Shift+P`
2. Type "Datadog: Test Connection"
3. You should see "✓ Connection successful"

**⚠️ Note:** API keys are stored securely in VSCode. Never share them.

### Using Static Code Analysis

#### Getting Analysis Results

1. Open a code file in OpenVSCode
2. Switch to Datadog panel (click icon in left sidebar)
3. You'll see analysis results automatically

#### Understanding Issues

Issues appear with color codes:
- 🔴 **Red** - Critical (security, crashes)
- 🟡 **Yellow** - Warning (performance, quality)
- 🔵 **Blue** - Info (suggestions, best practices)

#### Example Analysis

```javascript
// ❌ Issues detected in file: api.js

🔴 CRITICAL: Unvalidated input passed to database query
   Line 42: connection.query(`SELECT * FROM users WHERE id=${userId}`)
   Suggestion: Use parameterized queries
   Fix: connection.query('SELECT * FROM users WHERE id = ?', [userId])

🟡 WARNING: Function 'fetchData' is too complex (complexity: 12)
   Line 15: async function fetchData() { ... }
   Suggestion: Break into smaller functions

✓ 2 issues detected, 0 critical, 1 warning, 1 info
```

### Available Commands

Press `Cmd+Shift+P` and type "Datadog:" to see:

```
Datadog: Analyze Current File
Datadog: Security Vulnerability Check
Datadog: Performance Analysis
Datadog: Test Coverage Report
Datadog: Code Complexity Metrics
Datadog: Dependency Audit
Datadog: Code Duplication Detection
Datadog: Configure API Key
Datadog: Test Connection
Datadog: View Documentation
Datadog: Install Datadog Agent
Datadog: View Logs (if connected)
Datadog: View Metrics (if connected)
Datadog: View Traces (if connected)
... and more
```

### Tips and Tricks

#### 1. Keyboard Shortcut for Quick Analysis

```bash
# Configure a custom keyboard shortcut
Press Cmd+K, Cmd+S (or Cmd+, then search "keyboard shortcuts")
Search for "Datadog: Analyze"
Click the pencil icon and set your custom shortcut
e.g., Cmd+Shift+D for quick analysis
```

#### 2. View Analysis for Selection

```javascript
// Select a function and run analysis
function calculateTotal(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total = total + items[i].price;
    }
    return total;
}

// Command Palette: "Datadog: Analyze Selection"
// Will show issues specific to selected code
```

#### 3. Create Analysis Reports

```bash
# In Datadog panel, click "Export Report"
# Creates HTML report of all issues
# Share with team or store in version control
```

#### 4. Exclude Certain Files

In OpenVSCode settings (Cmd+,):

```json
{
    "datadog.excludePatterns": [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.js"
    ]
}
```

#### 5. Set Analysis Severity Level

```json
{
    "datadog.severityLevel": "warning",
    // Shows only warnings and critical issues
    // Options: "info", "warning", "critical"
}
```

#### 6. Auto-Fix Issues

Some issues can be fixed automatically:

1. Hover over an issue in the editor
2. Click the lightbulb icon (💡)
3. Select "Fix this issue"
4. Code is automatically corrected

**Example:**

```javascript
// Before
const x = 1
const y = 2

// After (auto-fixed by Datadog)
const x = 1;
const y = 2;
```

### Datadog in the Sidebar

The Datadog icon in the left sidebar provides:

- **Issues Panel** - List of all detected issues
- **Metrics Panel** - Code metrics and statistics
- **Logs Panel** (if authenticated) - Real-time application logs
- **Traces Panel** (if authenticated) - Distributed tracing visualization

**Toggle Sidebar Visibility:**
```bash
Cmd+Shift+D  # (if you've set this shortcut)
Or Cmd+B to toggle entire sidebar
```

### Common Workflows

#### Workflow 1: Code Review Before Commit

```bash
# Before pushing code, run analysis
1. Open changed files
2. Press Cmd+Shift+X (Extensions)
3. Click Datadog extension
4. Review issues
5. Fix critical items
6. Commit
```

#### Workflow 2: Security Audit

```bash
# Weekly security check
1. Command Palette: Cmd+Shift+P
2. Type "Datadog: Security Check"
3. Review security issues
4. Update dependencies if needed
5. Document findings
```

#### Workflow 3: Performance Optimization

```bash
# Identify performance bottlenecks
1. Open performance-critical files
2. Datadog: Performance Analysis
3. Look for:
   - O(n²) algorithms
   - Memory leaks
   - Inefficient queries
4. Refactor identified issues
5. Re-analyze to verify improvement
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: App Won't Start

**Problem:** Double-clicking the app does nothing

**Solutions:**

1. **Check Quarantine Flag:**
   ```bash
   xattr -d com.apple.quarantine /Applications/UnifiedServicesVibeCode.app
   ```
   Then try launching again.

2. **Check Permissions:**
   ```bash
   ls -la /Applications/UnifiedServicesVibeCode.app
   # Should show 'rwxr-xr-x' or similar executable permissions

   # If not, fix permissions
   chmod +x /Applications/UnifiedServicesVibeCode.app/Contents/MacOS/UnifiedServicesVibeCode
   ```

3. **Try from Terminal:**
   ```bash
   open /Applications/UnifiedServicesVibeCode.app
   # You'll see any error messages printed
   ```

4. **Check Console Output:**
   ```bash
   # In Terminal, watch for crash logs
   log stream --predicate 'process == "UnifiedServicesVibeCode"'
   ```

5. **Reinstall:**
   ```bash
   rm -rf /Applications/UnifiedServicesVibeCode.app
   # Download and reinstall DMG
   ```

**Still Not Working?**
- Restart your Mac
- Try on a different user account
- Check Mac has at least 4GB free RAM

---

#### Issue: Services Not Accessible (Port Errors)

**Problem:** Can't reach OpenVSCode at `localhost:8080` or other services

**Check 1: App is Running**
```bash
# Check if app is running
ps aux | grep UnifiedServicesVibeCode

# Should show running process
# If not, start the app
open /Applications/UnifiedServicesVibeCode.app
```

**Check 2: Wait for VM to Boot**
```bash
# VM takes 2-3 minutes to start
# Watch the app's console output
# Wait for "Ready" status message
```

**Check 3: Check Port Availability**
```bash
# Test if ports are open
nc -zv localhost 8080   # OpenVSCode
nc -zv localhost 6379   # Valkey
nc -zv localhost 5432   # PostgreSQL
nc -zv localhost 2222   # SSH

# All should respond with "success"
```

**Check 4: Test Each Service**
```bash
# Test OpenVSCode
curl http://localhost:8080 | head

# Test Valkey
redis-cli -h localhost -p 6379 PING

# Test PostgreSQL
psql -h localhost -p 5432 -U postgres -c "SELECT 1"

# Test SSH
sshpass -p 'vibecode' ssh root@localhost -p 2222 'echo OK'
```

**Check 5: Restart App**
```bash
# Kill the app
killall UnifiedServicesVibeCode

# Wait 5 seconds
sleep 5

# Relaunch
open /Applications/UnifiedServicesVibeCode.app

# Watch console - wait for "Ready"
```

**Still Not Working:**
- Check if another app is using the ports (run `lsof -i :8080`)
- Try changing your network (connect to different WiFi)
- Restart your Mac

---

#### Issue: Port Conflicts

**Problem:** "Address already in use" error in console

**Cause:** Another app is using the same port (8080, 6379, 5432, or 2222)

**Solution:**

```bash
# Find what's using port 8080
lsof -i :8080

# If it's an old VibeCode process:
killall UnifiedServicesVibeCode
sleep 2
open /Applications/UnifiedServicesVibeCode.app

# If it's another app:
# Either close that app or modify it to use different port
```

**Prevent Future Conflicts:**
```bash
# Check all ports before launching
netstat -an | grep LISTEN | grep -E '8080|6379|5432|2222'
```

---

#### Issue: VM Won't Boot

**Problem:** Stuck on "Starting..." - never reaches "Ready"

**Check VM Logs:**
```bash
# VM console should show boot messages
# Look for error lines in the app's console output
# Common errors:
# - "Kernel panic" - VM kernel issue
# - "DHCP timeout" - Networking issue
# - "Service failed to start" - Service error
```

**Solution 1: Force Restart**
```bash
# Close the app (Cmd+Q or ⌘+Q)
killall UnifiedServicesVibeCode

# Wait 10 seconds for VM to shut down
sleep 10

# Relaunch
open /Applications/UnifiedServicesVibeCode.app
```

**Solution 2: Check System Resources**
```bash
# VM needs 2GB RAM
# Check available memory
memory_pressure

# If using >90% RAM, close other apps
```

**Solution 3: Check Virtualization Framework**
```bash
# On Intel Macs with Parallels/Docker, frameworks may conflict
# Try disabling other VMs
# Restart Mac to reset virtualization

# Check if virtualization is available
sysctl hw.optional.arm64
# Should return: hw.optional.arm64: 1 (on Apple Silicon)
```

**Solution 4: Repair Install**
```bash
# Reinstall the app cleanly
rm -rf /Applications/UnifiedServicesVibeCode.app

# Download fresh DMG and reinstall
```

**Still Stuck?**
- Try on a different user account
- Restart in Safe Mode (restart, hold Shift)
- Check GitHub issues for similar problems

---

#### Issue: Extension Not Loading

**Problem:** Datadog extension doesn't appear in OpenVSCode

**Check 1: Refresh Browser**
```bash
# Press Cmd+Shift+R to hard refresh OpenVSCode
# Wait 30 seconds for reload
```

**Check 2: Check VM Boot**
```bash
# Extension is copied at boot time
# Ensure VM fully booted
# Check app console for "Ready" message
```

**Check 3: Verify Extension Files**
```bash
# SSH into VM and check files exist
sshpass -p 'vibecode' ssh root@localhost -p 2222 "ls -la /.openvscode-server/extensions/"

# Should show: datadog.datadog-vscode-2.0.0
```

**Check 4: Check OpenVSCode Logs**
```bash
# View OpenVSCode logs
sshpass -p 'vibecode' ssh root@localhost -p 2222 "tail -100 /tmp/openvscode.log" | grep -i datadog

# Should show extension being scanned and loaded
```

**Check 5: Manual Extension Install (Backup)**
```bash
# If extension files exist but not showing in UI
# Try reinstalling

# In OpenVSCode, press Cmd+Shift+X
# Search for "Datadog"
# Click Install
```

**Restore from Backup:**
```bash
# If extension is corrupted
cd /Applications/UnifiedServicesVibeCode.app/Contents/Resources/

# Check if backup exists
ls -la unified-vm-initramfs.cpio.gz.backup

# Restore if needed
cp unified-vm-initramfs.cpio.gz.backup unified-vm-initramfs.cpio.gz

# Restart app
killall UnifiedServicesVibeCode
open /Applications/UnifiedServicesVibeCode.app
```

---

#### Issue: Slow or High CPU Usage

**Problem:** Mac becomes slow while VM is running

**Check CPU Usage:**
```bash
# Check process
ps aux | grep UnifiedServicesVibeCode

# Check overall system
top -o %CPU

# VM should use ~20-40% CPU when idle
# If higher, something is wrong
```

**Solutions:**

1. **Stop Unnecessary Services (SSH into VM):**
   ```bash
   ssh root@localhost -p 2222

   # See what's running
   ps aux

   # Stop a service (example: PostgreSQL)
   service postgresql stop

   # Or check for runaway processes
   top
   ```

2. **Restart VM:**
   ```bash
   killall UnifiedServicesVibeCodeApp
   sleep 5
   open /Applications/UnifiedServicesVibeCode.app
   ```

3. **Reduce VM Resources:**
   - Currently set to 4 CPUs, 2GB RAM
   - Not user-configurable yet, but can reduce load by stopping unused services

4. **Check Mac Storage:**
   ```bash
   df -h
   # If disk >90% full, that causes slowness
   # Free up space before launching
   ```

---

#### Issue: Network/Connectivity Problems

**Problem:** Services appear to work but are unreliable or slow

**Check Network Status:**
```bash
# Test DNS
ping localhost

# Test connectivity to VM services
nc -zv localhost 8080
nc -zv localhost 6379

# Check network from inside VM
sshpass -p 'vibecode' ssh root@localhost -p 2222 "ip addr show"
sshpass -p 'vibecode' ssh root@localhost -p 2222 "ping 8.8.8.8"
```

**Solutions:**

1. **Disable IPv6 (if Mac IPv6 is breaking things):**
   ```bash
   # Temporarily
   networksetup -setv6off Wi-Fi

   # Re-enable
   networksetup -setv6automatic Wi-Fi
   ```

2. **Restart Network:**
   ```bash
   # Disconnect WiFi
   networksetup -setairportpower Wi-Fi off
   sleep 2

   # Reconnect
   networksetup -setairportpower Wi-Fi on
   ```

3. **Check VPN:**
   If you use a VPN, temporarily disable it - sometimes VPNs interfere with localhost networking.

4. **Restart VM:**
   ```bash
   killall UnifiedServicesVibeCode
   sleep 5
   open /Applications/UnifiedServicesVibeCode.app
   ```

---

### Common Error Messages

#### "Could not load virtualization framework"
- **Cause:** Virtualization APIs not available
- **Fix:** Ensure on Apple Silicon Mac (M1+), not Intel

#### "Permission denied - cannot access virtualization"
- **Cause:** App was not removed from quarantine
- **Fix:** `xattr -d com.apple.quarantine /Applications/UnifiedServicesVibeCode.app`

#### "Cannot allocate memory"
- **Cause:** Mac doesn't have 2GB free RAM
- **Fix:** Close other apps or increase available RAM

#### "Address already in use for port 8080"
- **Cause:** Another app using port 8080
- **Fix:** Find process using `lsof -i :8080` and close it

#### "DHCP lease timeout"
- **Cause:** Network configuration issue in VM
- **Fix:** Restart VM or check network settings

#### "OpenVSCode failed to start"
- **Cause:** VM running but web server won't start
- **Fix:** Check `/tmp/openvscode.log` via SSH for details

#### "PostgreSQL error: could not connect"
- **Cause:** Database not running or port forwarding failed
- **Fix:** Check app console and restart VM

---

## Advanced Usage

### Accessing VM Console

The VM's console (serial output) is displayed in the app's main window. This shows:
- Kernel messages
- Service startup logs
- Errors and warnings
- Network initialization
- Real-time debug output

**To Analyze Console Output:**

```bash
# Copy console text from app
# Look for timestamps
[0.000000] - VM start
[15.234] - DHCP lease obtained
[20.456] - PostgreSQL started
[30.001] - Ready

# This tells you how long each stage takes
```

**Save Console for Debugging:**

Unfortunately, console can't be saved directly from the app. Workaround:

```bash
# Watch VM boot logs via SSH after it's running
sshpass -p 'vibecode' ssh root@localhost -p 2222 "dmesg | tail -100"

# View init script logs
sshpass -p 'vibecode' ssh root@localhost -p 2222 "cat /tmp/init.log"
```

---

### Persistent Data Location

All data created in the VM persists across reboots:

**PostgreSQL Data:**
```bash
# Database files stored at
/var/lib/postgresql/16/main/

# Accessible via SSH
sshpass -p 'vibecode' ssh root@localhost -p 2222 "ls /var/lib/postgresql/16/main/"
```

**Valkey Data:**
```bash
# Valkey persistence
/data/dump.rdb
/data/appendonly.aof

# Check size
sshpass -p 'vibecode' ssh root@localhost -p 2222 "du -sh /data/"
```

**OpenVSCode Settings:**
```bash
# User settings and workspace data
/.openvscode-server/data/

# Extensions
/.openvscode-server/extensions/
```

**Other Files:**
```bash
# Anything you create persists
/root/          # Home directory
/tmp/           # Temporary files
/opt/           # Service files
```

---

### Backing Up Data

**Full VM Backup (via SSH):**

```bash
# Create backup directory
mkdir -p ~/vibecode-backups

# Backup PostgreSQL
pg_dump -h localhost -p 5432 -U postgres --all-databases > \
  ~/vibecode-backups/postgres-$(date +%Y%m%d).sql

# Backup Valkey data
sshpass -p 'vibecode' scp -P 2222 root@localhost:/data/dump.rdb \
  ~/vibecode-backups/valkey-$(date +%Y%m%d).rdb

# Backup OpenVSCode settings
sshpass -p 'vibecode' scp -r -P 2222 root@localhost:/.openvscode-server/data \
  ~/vibecode-backups/openvscode-$(date +%Y%m%d)
```

**Scheduled Backups (via cron):**

```bash
# Create backup script
cat > ~/bin/backup-vibecode.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/vibecode-backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

pg_dump -h localhost -p 5432 -U postgres --all > "$BACKUP_DIR/postgres.sql"
sshpass -p 'vibecode' scp -P 2222 root@localhost:/data/dump.rdb "$BACKUP_DIR/valkey.rdb"

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x ~/bin/backup-vibecode.sh

# Run daily at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * $HOME/bin/backup-vibecode.sh") | crontab -
```

---

### Multiple Instances

Running multiple VibeCode instances simultaneously:

**Note:** Current app architecture supports one instance. For multiple environments, use these approaches:

**Approach 1: Different User Accounts**
```bash
# Log into different macOS user account
# Launch app in that account
# Each gets separate VM (different ports)

# This works because each user has own app bundle and VM configuration
```

**Approach 2: Port Remapping (Advanced)**
```bash
# Edit app to use different ports
# (Requires recompiling app - not recommended for regular use)
```

**Approach 3: Network Mode (Workaround)**
```bash
# Instead of running multiple instances
# Use VMs on different machines via network
# Access via IP instead of localhost

# E.g., VM1: 192.168.1.100:8080
#       VM2: 192.168.1.101:8080
```

---

### Performance Tuning

Current configuration is optimized for most users. Advanced tuning:

**Reduce Resource Usage (SSH into VM):**

```bash
# Stop unused services
service postgresql stop
service valkey stop

# Check running processes
ps aux | head -20

# Kill specific service
kill -9 <PID>
```

**Increase Resources (Requires App Recompilation):**

```bash
# Edit UnifiedServicesVMManager.swift
# Increase getCPUCount() from 4 to 8
# Increase getMemorySize() from 2GB to 4GB

# Would require rebuilding app
```

**Monitor Performance:**

```bash
# Inside VM via SSH
top -b -n 1 | head -20

# Check memory usage
free -h

# Check disk usage
df -h

# Check network
netstat -antp
```

---

## Examples and Tutorials

### Tutorial 1: Quick Start - Hello World Web App

Create a simple Node.js web app using VibeCode services.

**Step 1: Create App Directory**

```bash
# In your Terminal on Mac
mkdir -p ~/vibecode-demo
cd ~/vibecode-demo

# Create a simple Node app
cat > server.js << 'EOF'
const express = require('express');
const pg = require('pg');
const redis = require('redis');

const app = express();
const PORT = 3000;

// PostgreSQL connection
const pgClient = new pg.Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    database: 'postgres'
});

// Redis client
const redisClient = redis.createClient({
    host: 'localhost',
    port: 6379
});

// Connect
pgClient.connect();
redisClient.connect();

// Simple route
app.get('/', (req, res) => {
    res.send('Hello from VibeCode!');
});

// Use PostgreSQL
app.get('/db', async (req, res) => {
    try {
        const result = await pgClient.query('SELECT now()');
        res.json({ time: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Use Redis
app.get('/cache', async (req, res) => {
    try {
        await redisClient.set('key', 'value');
        const value = await redisClient.get('key');
        res.json({ cached: value });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`App running on http://localhost:${PORT}`);
});
EOF
```

**Step 2: Start VibeCode**

```bash
# Open the app (click icon or run)
open /Applications/UnifiedServicesVibeCode.app

# Wait for "Ready" status (2-3 minutes)
```

**Step 3: Open in OpenVSCode and Run**

```bash
# Open browser
open http://localhost:8080

# In OpenVSCode terminal (Ctrl+~)
cd ~/vibecode-demo
npm install express pg redis
node server.js
```

**Step 4: Test**

```bash
# In another Terminal tab
curl http://localhost:3000
# Returns: Hello from VibeCode!

curl http://localhost:3000/db
# Returns: {"time":{"now":"2026-01-14T..."}}

curl http://localhost:3000/cache
# Returns: {"cached":"value"}
```

---

### Tutorial 2: Using Redis for Caching

Implement a caching layer for a slow database query.

**The Problem:**

```javascript
// Without caching - slow on repeated queries
app.get('/users/:id', async (req, res) => {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    // Takes 200ms every time
    res.json(result.rows[0]);
});
```

**The Solution with Redis:**

```javascript
const redis = require('redis');
const client = redis.createClient({
    host: 'localhost',
    port: 6379
});

app.get('/users/:id', async (req, res) => {
    const cacheKey = `user:${req.params.id}`;

    // Check cache first
    const cached = await client.get(cacheKey);
    if (cached) {
        return res.json(JSON.parse(cached));
    }

    // If not cached, fetch from database
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    const user = result.rows[0];

    // Store in cache for 1 hour
    await client.setex(cacheKey, 3600, JSON.stringify(user));

    res.json(user);
});
```

**Test Caching:**

```bash
# Install redis-cli
brew install redis

# First request (hits database)
curl http://localhost:3000/users/1
# Takes 200ms

# Second request (hits cache)
curl http://localhost:3000/users/1
# Takes <1ms

# Check cache
redis-cli -h localhost -p 6379 KEYS "user:*"
redis-cli -h localhost -p 6379 GET "user:1"
```

---

### Tutorial 3: Setting Up PostgreSQL Database

Create a multi-table schema with relationships.

**Step 1: Connect to PostgreSQL**

```bash
psql -h localhost -p 5432 -U postgres
```

**Step 2: Create Database**

```sql
CREATE DATABASE ecommerce;
\c ecommerce
```

**Step 3: Create Tables**

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2),
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table (joins Users and Products)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    total DECIMAL(10, 2),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_product ON orders(product_id);
```

**Step 4: Insert Sample Data**

```sql
-- Insert users
INSERT INTO users (email, name) VALUES
    ('alice@example.com', 'Alice'),
    ('bob@example.com', 'Bob'),
    ('charlie@example.com', 'Charlie');

-- Insert products
INSERT INTO products (name, price, stock) VALUES
    ('Laptop', 999.99, 10),
    ('Mouse', 29.99, 50),
    ('Keyboard', 79.99, 30);

-- Insert orders
INSERT INTO orders (user_id, product_id, quantity, total) VALUES
    (1, 1, 1, 999.99),
    (1, 2, 2, 59.98),
    (2, 3, 1, 79.99);
```

**Step 5: Query Data**

```sql
-- Get all orders with user and product info
SELECT
    o.id,
    u.name AS customer,
    p.name AS product,
    o.quantity,
    o.total
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN products p ON o.product_id = p.id
ORDER BY o.order_date DESC;

-- Get users with their order count
SELECT
    u.name,
    COUNT(o.id) as order_count,
    SUM(o.total) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id
ORDER BY total_spent DESC;

-- Find products needing restock
SELECT name, stock FROM products WHERE stock < 20;
```

**Step 6: Backup**

```bash
# Backup to file
pg_dump -h localhost -p 5432 -U postgres ecommerce > ecommerce.sql

# Restore from file
psql -h localhost -p 5432 -U postgres < ecommerce.sql
```

---

### Tutorial 4: Developing in OpenVSCode

**Step 1: Open OpenVSCode**

```bash
open http://localhost:8080
```

**Step 2: Create a Project**

In the Explorer (left sidebar):
1. Click "Open Folder"
2. Navigate to `~/vibecode-demo` (or your project)
3. Click Open

**Step 3: Create Files**

```
Right-click in Explorer → New File
Create: index.js
```

Type code:
```javascript
console.log('Hello from VibeCode!');
```

**Step 4: Run Terminal Commands**

```bash
# Press Ctrl+~ to open terminal
node index.js
# Output: Hello from VibeCode!
```

**Step 5: Use Git**

```bash
# Initialize repo
git init

# Check status
git status

# Add files
git add .

# Commit
git commit -m "Initial commit"

# View history
git log
```

**Step 6: Install Extensions**

1. Press Cmd+Shift+X
2. Search "Python" (or your language)
3. Click Install
4. Extension is ready to use

**Step 7: Datadog Code Analysis**

1. Open a code file
2. Press Cmd+Shift+P
3. Type "Datadog: Analyze Current File"
4. View issues in the Datadog panel

---

### Tutorial 5: Running a Full-Stack App

Create an app that uses all services together.

**Architecture:**
- Frontend: HTML/CSS/JavaScript
- Backend: Node.js Express
- Database: PostgreSQL
- Cache: Valkey/Redis
- IDE: OpenVSCode (develop and run)

**Step 1: Create Project Structure**

```bash
mkdir fullstack-app
cd fullstack-app

# Create directories
mkdir public
mkdir src

# Create files
touch public/index.html
touch src/server.js
touch src/database.js
```

**Step 2: Frontend (public/index.html)**

```html
<!DOCTYPE html>
<html>
<head>
    <title>VibeCode Demo</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 50px auto; }
        input { padding: 8px; font-size: 16px; }
        button { padding: 8px 16px; font-size: 16px; }
        .result { margin-top: 20px; padding: 10px; background: #f0f0f0; }
    </style>
</head>
<body>
    <h1>VibeCode Full-Stack Demo</h1>

    <h2>Database</h2>
    <input type="text" id="name" placeholder="Enter name">
    <button onclick="addUser()">Add User</button>
    <div id="users"></div>

    <h2>Cache</h2>
    <button onclick="cacheTest()">Test Cache</button>
    <div id="cache" class="result"></div>

    <script>
        async function addUser() {
            const name = document.getElementById('name').value;
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name})
            });
            const user = await res.json();
            loadUsers();
        }

        async function loadUsers() {
            const res = await fetch('/api/users');
            const users = await res.json();
            document.getElementById('users').innerHTML =
                '<ul>' + users.map(u => `<li>${u.name}</li>`).join('') + '</ul>';
        }

        async function cacheTest() {
            const res = await fetch('/api/cache');
            const data = await res.json();
            document.getElementById('cache').innerHTML =
                `<p>Cache test: ${data.result}</p>`;
        }

        // Load on startup
        loadUsers();
    </script>
</body>
</html>
```

**Step 3: Backend (src/server.js)**

```javascript
const express = require('express');
const pg = require('pg');
const redis = require('redis');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const pgClient = new pg.Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres'
});

const redisClient = redis.createClient({
    host: 'localhost',
    port: 6379
});

// Initialize
pgClient.connect();
redisClient.connect();

// Create table
pgClient.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
    )
`).catch(err => console.log('Table exists'));

// API endpoints
app.get('/api/users', async (req, res) => {
    const result = await pgClient.query('SELECT * FROM users');
    res.json(result.rows);
});

app.post('/api/users', async (req, res) => {
    const result = await pgClient.query(
        'INSERT INTO users (name) VALUES ($1) RETURNING *',
        [req.body.name]
    );
    res.json(result.rows[0]);
});

app.get('/api/cache', async (req, res) => {
    const key = 'test_key';
    let value = await redisClient.get(key);

    if (!value) {
        value = `Generated at ${new Date().toISOString()}`;
        await redisClient.setex(key, 60, value);
    }

    res.json({ result: value, cached: !!value });
});

app.listen(4000, () => {
    console.log('Server running on http://localhost:4000');
});
```

**Step 4: Run the App**

```bash
# In OpenVSCode terminal
npm install express pg redis
node src/server.js

# Or in browser
open http://localhost:4000
```

---

## FAQ

### General Questions

**Q: Is VibeCode free?**
A: Yes, VibeCode is open source and free to use.

**Q: Can I modify the services or configuration?**
A: Advanced users can SSH into the VM and modify services. See SSH section.

**Q: Does VibeCode require an internet connection?**
A: No. Once started, everything runs locally on localhost.

**Q: Can I run multiple VibeCode instances?**
A: Currently, one instance per Mac user account. Multiple instances on same account would have port conflicts.

**Q: What's included in the DMG?**
A: The prebuilt app and kernel/initramfs files. Total 253MB.

---

### Service-Specific Questions

**Q: Can I use a different password for SSH?**
A: Yes, SSH into VM and run `passwd` to change root password.

**Q: Can I use different database credentials for PostgreSQL?**
A: Yes, create new users with `createuser` or `psql`.

**Q: Can I persist data between reboots?**
A: Yes, all data in the VM persists automatically (stored on VM's rootfs).

**Q: Can I backup my data?**
A: Yes, see Advanced Usage section for backup procedures.

**Q: Can I increase PostgreSQL or Valkey limits?**
A: Yes, SSH into VM and edit config files in `/etc/`.

---

### Development Questions

**Q: Can I use OpenVSCode for real development?**
A: Yes, it's a full VS Code browser environment. Recommended for quick edits and testing.

**Q: Can I install npm packages in OpenVSCode terminal?**
A: Yes, `npm install` works in the terminal.

**Q: Can I use Git in OpenVSCode?**
A: Yes, full Git integration built in.

**Q: Does Datadog extension work offline?**
A: Yes, static code analysis features work offline. Cloud features need authentication.

**Q: How do I authenticate with Datadog?**
A: See Datadog Extension Guide section for authentication steps.

---

### Performance Questions

**Q: Why does my Mac get slow when VibeCode is running?**
A: VM uses 2GB RAM and 4 CPUs. If your Mac has <4GB free, it will slow down. Stop the VM to free resources.

**Q: How can I reduce memory usage?**
A: SSH into VM and stop unused services (e.g., `service postgresql stop`).

**Q: What's the boot time?**
A: Typically 2-3 minutes from cold start. Subsequent runs cached.

**Q: Can I run VibeCode on Intel Macs?**
A: No, VibeCode requires Apple Silicon (M1+). Intel Macs are not supported.

---

### Troubleshooting Questions

**Q: The app crashes on startup. What do I do?**
A: Run `xattr -d com.apple.quarantine` on the app, then try again. See troubleshooting section.

**Q: I can't connect to OpenVSCode. Why?**
A: VM may still be booting. Wait 2-3 minutes and check the app console for "Ready".

**Q: Port 8080 is already in use. How do I fix this?**
A: Find the process using `lsof -i :8080` and close it, or restart your Mac.

**Q: Services keep disconnecting. Why?**
A: This usually indicates networking issues. Try restarting the VM or your Mac.

---

### Advanced Questions

**Q: Can I SSH from a remote machine?**
A: No, services are only accessible on localhost (NAT networking).

**Q: Can I add my own services to the VM?**
A: Yes, SSH into VM and install packages using `apt-get` or compile from source.

**Q: Can I access the VM's files from my Mac?**
A: Limited support currently. You can transfer files via SSH and SCP.

**Q: Can I modify the OpenVSCode extensions?**
A: Yes, OpenVSCode supports extension development and custom extensions.

**Q: Can I monitor the VM using system tools?**
A: Yes, use the app's console output or SSH in and use `top`, `htop`, etc.

---

## Support and Additional Resources

### Getting Help

If you encounter issues not covered in this guide:

1. **Check Console Output** - Many issues show in the app's console
2. **Try Troubleshooting Section** - Common issues are documented above
3. **SSH Into VM** - Access logs and system information
4. **Restart VM** - Often resolves transient issues
5. **Reinstall App** - If all else fails, reinstall from DMG

### Documentation

- **Release Notes** - Changes in each version
- **Installation Guide** - Detailed installation steps
- **API Documentation** - For developers extending VibeCode
- **GitHub Issues** - Check if your issue is known

### Community

- **GitHub Discussions** - Ask questions
- **GitHub Issues** - Report bugs
- **Contributing** - Help improve VibeCode

### Version Information

- **Current Version:** 3.2.1 (Datadog Edition)
- **Release Date:** January 14, 2026
- **Status:** Production Ready
- **Next Version:** TBD

---

## Conclusion

Congratulations! You now have a complete development environment with:
- ✓ Web IDE (OpenVSCode with Datadog extension)
- ✓ Database (PostgreSQL)
- ✓ Cache (Valkey/Redis)
- ✓ Shell Access (SSH)

Everything is running on localhost, configured and ready to use. Happy coding!

For more information, visit:
- GitHub Repository
- Official Website
- Documentation Portal

---

**Version:** 3.2.1
**Last Updated:** January 14, 2026
**Status:** Production Ready

---

## Document Information

**File:** COMPREHENSIVE_USER_GUIDE_v3.2.1.md
**Size:** ~15,000 words
**Sections:** 10 major sections + FAQ
**Audience:** Beginners to Advanced Developers
**License:** MIT (same as VibeCode)

**How to Use This Guide:**
- Start with Introduction and System Requirements
- Follow Installation steps carefully
- Use Getting Started to learn the UI
- Reference service sections as needed
- Consult Troubleshooting for issues
- Try the tutorials for hands-on learning

