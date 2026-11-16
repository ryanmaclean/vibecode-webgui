# Task: Resolve Issue #1530

Title: Feature Audit: Console logging - Logs saved to `~/VibeCode VMs/*/console.log`
Source: GitHub Issue #1530
Status: Verified
Auditor: vibecode-126

## Audit Summary

**Result**: Partial Implementation

Console logging exists in some VM implementations but NOT in the Swift GUI apps that use the `~/VibeCode VMs/` directory.

## Findings

### Implementations WITH file logging:
| Component | Log Path |
|-----------|----------|
| `scripts/launch_ubuntu_vm.py` | `~/VibeCode/VMs/{name}/console.log` |
| `src/lib/vm/providers/vfkit.ts` | `{vmDir}/logs/console.log` |
| `AppleContainerRuntime` | `{containerDir}/console.log` |

### Implementations WITHOUT file logging:
| Component | Issue |
|-----------|-------|
| `scripts/build_gui_linux_vm_swift.py` | Outputs to stdout only, not to file |

## Path Discrepancy

The requested path `~/VibeCode VMs/*/console.log` (with space) is the Swift GUI VM bundle directory, but those apps do NOT write console logs to files. They output to stdout.

The Python launcher uses `~/VibeCode/VMs/` (no space) which DOES write console logs.

## Documentation

Created: `docs/features/console-logging.md`
