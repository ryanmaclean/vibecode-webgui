#!/usr/bin/env python3
"""Evaluate all 3 Datadog installation solutions.

Compares three approaches for installing Datadog agents in VMs:
1. SSH into running VZ VMs (Runtime installation)
2. Cloud-init VM build (Pre-installed)
3. Lima VMs with provisioning (Hybrid)

Generates a comparison report with pros, cons, and recommendations.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


RESULTS_FILE = Path("/tmp/datadog-evaluation-results.txt")


@dataclass
class SolutionEvaluation:
    """Evaluation of a single solution."""

    name: str
    number: int
    pros: list[str] = field(default_factory=list)
    cons: list[str] = field(default_factory=list)
    setup_time: str = ""
    complexity: str = ""
    best_for: str = ""
    test_status: str = ""
    test_command: str = ""


def run_cmd(cmd: list[str], check: bool = False) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def check_lima_running() -> bool:
    """Check if any Lima VMs are running."""
    if not shutil.which("limactl"):
        return False
    result = run_cmd(["limactl", "list"])
    return result.returncode == 0 and "Running" in result.stdout


def check_qemu_available() -> bool:
    """Check if qemu-img is available."""
    return shutil.which("qemu-img") is not None


def check_lima_installed() -> bool:
    """Check if Lima is installed."""
    return shutil.which("limactl") is not None


def evaluate_ssh_solution() -> SolutionEvaluation:
    """Evaluate Solution 1: SSH into Running VMs."""
    eval_result = SolutionEvaluation(
        name="SSH into Running VMs",
        number=1,
        pros=[
            "Works with already-running VMs",
            "No rebuild required",
            "Quick to apply",
            "Can update agents on existing VMs",
        ],
        cons=[
            "Requires SSH access to VMs",
            "VZ VMs currently don't have SSH configured",
            "Manual process for each VM",
            "Agents not preserved if VM is recreated",
        ],
        setup_time="2-5 minutes per VM",
        complexity="Medium (requires SSH setup first)",
        best_for="Lima VMs with SSH already configured",
    )

    if check_lima_running():
        eval_result.test_status = "Can test with Lima VMs"
        eval_result.test_command = "./scripts/install-datadog-in-vms.sh"
    else:
        eval_result.test_status = "No Lima VMs running to test"

    return eval_result


def evaluate_cloudinit_solution() -> SolutionEvaluation:
    """Evaluate Solution 2: Cloud-init VM Build."""
    eval_result = SolutionEvaluation(
        name="Cloud-init VM Build Process",
        number=2,
        pros=[
            "Datadog pre-installed in image",
            "VM ready immediately on first boot",
            "Reproducible and version-controlled",
            "Works with VZ VMs natively",
            "Can include specific Datadog checks",
        ],
        cons=[
            "Requires rebuilding all VM images (~30-45 min)",
            "Larger image size",
            "Need to rebuild to update Datadog agent",
            "API key baked into image (security concern)",
        ],
        setup_time="30-45 minutes (one-time build)",
        complexity="High (requires qemu-img, cloud-init knowledge)",
        best_for="Production deployments, golden images",
    )

    if check_qemu_available():
        eval_result.test_status = "qemu-img available"
        eval_result.test_command = "./scripts/build-vms-with-datadog.sh"
    else:
        eval_result.test_status = "qemu-img not installed (brew install qemu)"

    return eval_result


def evaluate_lima_solution() -> SolutionEvaluation:
    """Evaluate Solution 3: Lima VMs with Provisioning."""
    eval_result = SolutionEvaluation(
        name="Lima VMs with Provisioning Scripts",
        number=3,
        pros=[
            "Automated provisioning on VM creation",
            "Uses clean base images",
            "API key not in image, passed at runtime",
            "Easy to update (just restart VM)",
            "Supports port forwarding and mounts",
            "Best integration with macOS",
        ],
        cons=[
            "Only works with Lima (not native VZ)",
            "First boot takes 2-3 minutes (provisioning)",
            "Requires Lima CLI installed",
        ],
        setup_time="5-10 minutes (includes provisioning)",
        complexity="Low (Lima handles most details)",
        best_for="Development, VibeCode native app alternative",
    )

    if check_lima_installed():
        eval_result.test_status = "Lima installed"
        eval_result.test_command = "./scripts/start-lima-vms-with-datadog.sh"
    else:
        eval_result.test_status = "Lima not installed (brew install lima)"

    return eval_result


def format_solution_evaluation(sol: SolutionEvaluation) -> list[str]:
    """Format a solution evaluation as text lines."""
    lines = [
        "",
        "=" * 70,
        f"  Solution {sol.number}: {sol.name}",
        "=" * 70,
        "",
        "Evaluation Criteria:",
        "",
        "Pros:",
    ]

    for pro in sol.pros:
        lines.append(f"  - {pro}")

    lines.append("")
    lines.append("Cons:")

    for con in sol.cons:
        lines.append(f"  - {con}")

    lines.extend([
        "",
        f"Setup Time: {sol.setup_time}",
        f"Complexity: {sol.complexity}",
        f"Best For: {sol.best_for}",
        "",
        "Test Status:",
    ])

    if sol.test_command:
        lines.append(f"  Available - {sol.test_status}")
        lines.append(f"  Run: {sol.test_command}")
    else:
        lines.append(f"  {sol.test_status}")

    return lines


def generate_comparison_matrix() -> list[str]:
    """Generate the comparison matrix."""
    return [
        "",
        "Comparison Matrix:",
        "",
        "| Criteria           | Solution 1 (SSH) | Solution 2 (Cloud-init) | Solution 3 (Lima) |",
        "|--------------------|--------------------|-------------------------|-------------------|",
        "| Setup Time         | 2-5 min/VM         | 30-45 min (one-time)    | 5-10 min          |",
        "| Complexity         | Medium             | High                    | Low               |",
        "| VZ Compatible      | Needs SSH          | Yes                     | No                |",
        "| Updates            | Manual             | Rebuild required        | Easy (restart)    |",
        "| Security           | Good               | API key in image        | Best              |",
        "| Automation         | Medium             | High                    | High              |",
        "",
    ]


def generate_recommendations(datadog_site: str) -> list[str]:
    """Generate recommendations section."""
    return [
        "RECOMMENDATION:",
        "",
        "For VibeCode Native App (Current Goal):",
        "  -> Use Solution 3 (Lima) for development",
        "  -> Use Solution 2 (Cloud-init) for production distribution",
        "",
        "Reasoning:",
        "  - Lima VMs work now and are easier to manage",
        "  - Cloud-init images for distribution ensure consistency",
        "  - Hybrid approach: develop with Lima, ship with cloud-init",
        "",
        "Next Steps:",
        "",
        "1. Test Lima solution immediately:",
        "   DATADOG_API_KEY=$DD_KEY ./scripts/start-lima-vms-with-datadog.sh",
        "",
        "2. Build cloud-init images for distribution:",
        "   DATADOG_API_KEY=$DD_KEY ./scripts/build-vms-with-datadog.sh",
        "",
        "3. Verify Datadog metrics are flowing:",
        f"   https://app.{datadog_site}/infrastructure",
        "",
    ]


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=RESULTS_FILE,
        help=f"Output file for results (default: {RESULTS_FILE})",
    )
    parser.add_argument(
        "--no-api-key-check",
        action="store_true",
        help="Skip DATADOG_API_KEY check",
    )

    args = parser.parse_args(argv)

    # Check for API key
    datadog_api_key = os.environ.get("DATADOG_API_KEY", "")
    datadog_site = os.environ.get("DATADOG_SITE", "datadoghq.com")

    if not datadog_api_key and not args.no_api_key_check:
        print("Error: DATADOG_API_KEY environment variable not set")
        print()
        print("Usage: DATADOG_API_KEY=your-key-here ./scripts/evaluate_datadog_solutions.py")
        print()
        print("Or use --no-api-key-check to skip this check")
        return 1

    print("=" * 70)
    print("  Evaluating Datadog Installation Solutions")
    print("=" * 70)
    print()
    print("Testing 3 approaches:")
    print("  1. SSH into running VZ VMs (Runtime installation)")
    print("  2. Cloud-init VM build (Pre-installed)")
    print("  3. Lima VMs with provisioning (Hybrid)")
    print()

    # Build report
    report_lines = [
        "# Datadog Installation Solutions - Evaluation Results",
        f"Generated: {datetime.now().isoformat()}",
        "",
    ]

    # Evaluate each solution
    solutions = [
        evaluate_ssh_solution(),
        evaluate_cloudinit_solution(),
        evaluate_lima_solution(),
    ]

    for sol in solutions:
        report_lines.extend(format_solution_evaluation(sol))

    # Add summary
    report_lines.extend([
        "",
        "=" * 70,
        "  SUMMARY & RECOMMENDATIONS",
        "=" * 70,
        "",
    ])

    report_lines.extend(generate_comparison_matrix())
    report_lines.extend(generate_recommendations(datadog_site))

    report_lines.append("=" * 70)

    # Write to file
    report_content = "\n".join(report_lines)
    args.output.write_text(report_content)

    # Print report
    print(report_content)

    print()
    print("Evaluation complete!")
    print()
    print(f"Full results saved to: {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
