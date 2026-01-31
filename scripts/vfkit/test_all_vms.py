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

"""Comprehensive VM Testing Script.

Tests all VMs and creates a detailed report.
"""

from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn


@dataclass
class VMInfo:
    name: str
    cpus: int
    ram: str
    log_path: Path
    status: str = "Unknown"
    pid: int | None = None
    notes: str = ""


def get_vm_definitions() -> list[VMInfo]:
    """Get list of VMs to check."""
    vfkit_dir = Path.home() / ".vfkit" / "vms"

    return [
        VMInfo(
            name="vibecode-valkey",
            cpus=2,
            ram="1GB",
            log_path=vfkit_dir / "vibecode-valkey" / "logs" / "console.log",
        ),
        VMInfo(
            name="vibecode-postgresql",
            cpus=2,
            ram="2GB",
            log_path=vfkit_dir / "vibecode-postgresql" / "logs" / "console.log",
        ),
        VMInfo(
            name="vibecode-openvscode",
            cpus=4,
            ram="4GB",
            log_path=vfkit_dir / "vibecode-openvscode" / "logs" / "console.log",
        ),
        VMInfo(
            name="valkey-vz",
            cpus=2,
            ram="1GB",
            log_path=vfkit_dir / "valkey-vz" / "logs" / "console.log",
            notes="Test VM",
        ),
    ]


def check_vm_running(vm: VMInfo) -> tuple[bool, int | None]:
    """Check if a VM is running and return its PID."""
    result = subprocess.run(
        ["ps", "aux"],
        capture_output=True,
        text=True,
        check=False,
    )

    for line in result.stdout.splitlines():
        if vm.name in line and "vfkit" in line and "grep" not in line:
            parts = line.split()
            if len(parts) >= 2:
                try:
                    return True, int(parts[1])
                except ValueError:
                    return True, None
    return False, None


def read_console_log(log_path: Path, lines: int = 10) -> list[str]:
    """Read last N lines from console log."""
    if not log_path.exists():
        return []

    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.readlines()
            return [line.rstrip() for line in content[-lines:]]
    except Exception:
        return []


def check_boot_status(log_lines: list[str]) -> str:
    """Check boot status from log lines."""
    full_text = "\n".join(log_lines)

    if "BUILD SUCCESSFUL" in full_text:
        return "✅ Boot successful (at shell prompt)"
    elif "ERROR" in full_text:
        return "⚠️ Boot completed with errors"
    elif log_lines:
        return "🔵 Unknown state"
    return "❓ No logs available"


def check_issues(log_path: Path, lines: int = 20) -> list[str]:
    """Check for known issues in log."""
    issues = []
    log_lines = read_console_log(log_path, lines)
    full_text = "\n".join(log_lines)

    if "unable to select packages" in full_text:
        issues.append("❌ Cannot install packages (networking issue)")
        issues.append("❌ Alpine package repositories unreachable")
        issues.append("ℹ️ initramfs networking not properly configured")

    if "mount:" in full_text.lower() and "failed" in full_text.lower():
        issues.append("❌ Mount operation failed")

    if "panic" in full_text.lower():
        issues.append("❌ Kernel panic detected")

    return issues


def generate_report(vms: list[VMInfo], output_path: Path | None = None) -> str:
    """Generate markdown test report."""
    lines = [
        "# Comprehensive VM Test Report",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
        "### VM Inventory",
        "",
        "| VM Name | Status | PID | CPUs | RAM | Notes |",
        "|---------|--------|-----|------|-----|-------|",
    ]

    for vm in vms:
        running, pid = check_vm_running(vm)
        vm.pid = pid
        vm.status = "✅ Running" if running else "❌ Stopped"
        pid_str = str(pid) if pid else "-"
        notes = vm.notes or ("At shell prompt" if running else "Not running")
        lines.append(f"| **{vm.name}** | {vm.status} | {pid_str} | {vm.cpus} | {vm.ram} | {notes} |")

    lines.extend(["", "---", "", "### VM Console Status", ""])

    for i, vm in enumerate(vms, 1):
        lines.append(f"#### {i}. {vm.name}")
        lines.append("")
        lines.append("**Last 10 lines of console:**")
        lines.append("```")

        log_lines = read_console_log(vm.log_path)
        if log_lines:
            lines.extend(log_lines)
        else:
            lines.append("No console log")

        lines.append("```")
        lines.append("")

        status = check_boot_status(log_lines)
        lines.append(f"**Status**: {status}")
        lines.append("")

        issues = check_issues(vm.log_path)
        if issues:
            lines.append("**Issues**:")
            for issue in issues:
                lines.append(f"- {issue}")
        else:
            lines.append("**Issues**: None detected")

        lines.extend(["", "---", ""])

    report = "\n".join(lines)

    if output_path:
        output_path.write_text(report)
        print(f"Report saved to: {output_path}")

    return report


def main() -> int:
    """Main entry point."""
    log_section("TESTING ALL VMS")
    print()

    vms = get_vm_definitions()

    # Check each VM
    print("Checking VM status...")
    for vm in vms:
        running, pid = check_vm_running(vm)
        status = f"{COLORS.green}Running{COLORS.reset}" if running else f"{COLORS.red}Stopped{COLORS.reset}"
        pid_info = f" (PID: {pid})" if pid else ""
        print(f"  {vm.name}: {status}{pid_info}")

    print()

    # Generate report
    script_dir = Path(__file__).resolve().parent
    report_path = script_dir.parent.parent / "VM_TEST_REPORT.md"

    try:
        report = generate_report(vms, report_path)
        print()
        log_success(f"Report generated: {report_path}")
        return 0
    except Exception as e:
        log_error(f"Failed to generate report: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())