---
name: Bug report
about: Create a report to help us improve VibeCode
title: '[BUG] '
labels: 'bug'
assignees: ''

---

## Description

Provide a clear and concise description of the bug. What did you expect to happen? What happened instead?

## Environment

Please provide your environment details to help us reproduce the issue:

- **Host OS**: [e.g., macOS 14.0 (Sonoma), macOS 13.0 (Ventura)]
- **Host Architecture**: [e.g., Apple Silicon M1/M2/M3, Intel]
- **vfkit version**: [output of `vfkit --version`]
- **VibeCode version**: [e.g., v3.2.1, latest]
- **Available Memory**: [e.g., 8GB, 16GB]
- **Disk Space Available**: [e.g., 5GB free]

## Steps to Reproduce

Provide detailed steps to reproduce the issue:

1. Run `vibecode-vm start` (or manual vfkit command)
2. Wait for boot to complete
3. Execute command: [specify exact command]
4. Observe: [what goes wrong]

## Expected Behavior

What should have happened?

## Actual Behavior

What actually happened instead?

## Logs & Diagnostics

Please include relevant logs to help debug the issue:

### Console Output

```bash
# Paste output from vibecode-vm logs or vfkit console here
```

### SSH Session Output (if applicable)

```bash
# Paste output from ssh session here
ssh root@192.168.64.10
# [commands and output]
```

### Service Status

Please run and provide output from:

```bash
vibecode-vm status
# [output here]
```

## Screenshots/Videos

If applicable, include screenshots or videos demonstrating the issue:

- [Attach screenshots or video links here]

## Impact

What is the impact of this bug on your usage?

- [ ] Blocking - VM won't start/run
- [ ] High - Core functionality broken
- [ ] Medium - Some features don't work
- [ ] Low - Minor inconvenience
- [ ] Documentation - Misleading docs

## Affected Services

Which services are affected? (select all that apply)

- [ ] OpenVSCode Server (port 8080)
- [ ] SSH/Dropbear (port 22)
- [ ] PostgreSQL (port 5432)
- [ ] Valkey (port 6379)
- [ ] Network/DHCP
- [ ] Volume Mounting
- [ ] Datadog Extension
- [ ] Other: _________________

## Additional Context

Add any other relevant context about the problem:

- Have you tried this with a fresh VM image?
- Does this happen consistently or intermittently?
- Any recent changes to your system?

## Workarounds

If you've found a temporary workaround, please share it here:

---

**Thank you for reporting this issue! We appreciate your help in making VibeCode better.**
