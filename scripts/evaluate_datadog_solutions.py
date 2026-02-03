#!/usr/bin/env python3
"""Evaluate all 3 Datadog installation solutions.

Compares SSH installation, Cloud-init build, and Lima provisioning approaches.
"""

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# Colors for output
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
NC = '\033[0m'


@dataclass
class SolutionEvaluation:
    """Evaluation data for a solution."""

    name: str
    number: int
    pros: list[str] = field(default_factory=list)
    cons: list[str] = field(default_factory=list)
    setup_time: str = ""
    complexity: str = ""
    best_for: str = ""
    test_status: str = ""
    test_command: str = ""


@dataclass
class EvaluationConfig:
    """Evaluation configuration."""

    datadog_api_key: str
    datadog_site: str = "datadoghq.com"
    results_file: Path = Path("/tmp/datadog-evaluation-results.txt")


def command_exists(cmd: str) -> bool:
    """Check if a command exists."""
    return shutil.which(cmd) is not None


def run_command(cmd: list[str]) -> tuple[int, str, str]:
    """Run a command and return result."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        return -1, "", "command not found"


def check_lima_running() -> bool:
    """Check if any Lima VMs are running."""
    if not command_exists("limactl"):
        return False
    rc, stdout, _ = run_command(["limactl", "list"])
    return rc == 0 and "Running" in stdout


def write_output(file: Path, text: str, also_print: bool = True) -> None:
    """Write text to file and optionally print.

    Args:
        file: Output file path.
        text: Text to write.
        also_print: Whether to also print to stdout.
    """
    with open(file, 'a') as f:
        f.write(text + "\n")
    if also_print:
        print(text)


def get_solution_1() -> SolutionEvaluation:
    """Get evaluation for Solution 1: SSH Installation."""
    solution = SolutionEvaluation(
        name="SSH into Running VMs",
        number=1,
        pros=[
            "Works with already-running VMs",
            "No rebuild required",
            "Quick to apply",
            "Can update agents on existing VMs"
        ],
        cons=[
            "Requires SSH access to VMs",
            "VZ VMs currently don't have SSH configured",
            "Manual process for each VM",
            "Agents not preserved if VM is recreated"
        ],
        setup_time="2-5 minutes per VM",
        complexity="Medium (requires SSH setup first)",
        best_for="Lima VMs with SSH already configured"
    )

    if check_lima_running():
        solution.test_status = "✅ Can test with Lima VMs"
        solution.test_command = "./scripts/install-datadog-in-vms.sh"
    else:
        solution.test_status = "⚠️  No Lima VMs running to test"

    return solution


def get_solution_2() -> SolutionEvaluation:
    """Get evaluation for Solution 2: Cloud-init Build."""
    solution = SolutionEvaluation(
        name="Cloud-init VM Build Process",
        number=2,
        pros=[
            "Datadog pre-installed in image",
            "VM ready immediately on first boot",
            "Reproducible and version-controlled",
            "Works with VZ VMs natively",
            "Can include specific Datadog checks"
        ],
        cons=[
            "Requires rebuilding all VM images (~30-45 min)",
            "Larger image size",
            "Need to rebuild to update Datadog agent",
            "API key baked into image (security concern)"
        ],
        setup_time="30-45 minutes (one-time build)",
        complexity="High (requires qemu-img, cloud-init knowledge)",
        best_for="Production deployments, golden images"
    )

    if command_exists("qemu-img"):
        solution.test_status = "✅ qemu-img available"
        solution.test_command = "./scripts/build-vms-with-datadog.sh"
    else:
        solution.test_status = "⚠️  qemu-img not installed (brew install qemu)"

    return solution


def get_solution_3() -> SolutionEvaluation:
    """Get evaluation for Solution 3: Lima with Provisioning."""
    solution = SolutionEvaluation(
        name="Lima VMs with Provisioning Scripts",
        number=3,
        pros=[
            "Automated provisioning on VM creation",
            "Uses clean base images",
            "API key not in image, passed at runtime",
            "Easy to update (just restart VM)",
            "Supports port forwarding and mounts",
            "Best integration with macOS"
        ],
        cons=[
            "Only works with Lima (not native VZ)",
            "First boot takes 2-3 minutes (provisioning)",
            "Requires Lima CLI installed"
        ],
        setup_time="5-10 minutes (includes provisioning)",
        complexity="Low (Lima handles most details)",
        best_for="Development, VibeCode native app alternative"
    )

    if command_exists("limactl"):
        solution.test_status = "✅ Lima installed"
        solution.test_command = "./scripts/start-lima-vms-with-datadog.sh"
    else:
        solution.test_status = "⚠️  Lima not installed (brew install lima)"

    return solution


def write_solution_evaluation(
    solution: SolutionEvaluation,
    file: Path
) -> None:
    """Write solution evaluation to file.

    Args:
        solution: Solution evaluation data.
        file: Output file path.
    """
    write_output(file, "")
    write_output(file, "=" * 70)
    write_output(file, f"  Solution {solution.number}: {solution.name}")
    write_output(file, "=" * 70)
    write_output(file, "")
    write_output(file, "📋 Evaluation Criteria:")
    write_output(file, "")

    write_output(file, "✅ Pros:")
    for pro in solution.pros:
        write_output(file, f"  - {pro}")
    write_output(file, "")

    write_output(file, "❌ Cons:")
    for con in solution.cons:
        write_output(file, f"  - {con}")
    write_output(file, "")

    write_output(file, f"⏱️  Setup Time: {solution.setup_time}")
    write_output(file, f"🔧 Complexity: {solution.complexity}")
    write_output(file, f"🎯 Best For: {solution.best_for}")
    write_output(file, "")

    write_output(file, "📊 Test Status:")
    write_output(file, f"  {solution.test_status}")
    if solution.test_command:
        write_output(file, f"  Run: {solution.test_command}")


def write_comparison_matrix(file: Path) -> None:
    """Write comparison matrix to file.

    Args:
        file: Output file path.
    """
    write_output(file, "📊 Comparison Matrix:")
    write_output(file, "")
    write_output(file, "| Criteria           | Solution 1 (SSH) | Solution 2 (Cloud-init) | Solution 3 (Lima) |")
    write_output(file, "|--------------------|--------------------|-------------------------|-------------------|")
    write_output(file, "| Setup Time         | 2-5 min/VM         | 30-45 min (one-time)    | 5-10 min          |")
    write_output(file, "| Complexity         | Medium             | High                    | Low               |")
    write_output(file, "| VZ Compatible      | Needs SSH          | ✅ Yes                   | ❌ No              |")
    write_output(file, "| Updates            | Manual             | Rebuild required        | Easy (restart)    |")
    write_output(file, "| Security           | Good               | API key in image        | Best              |")
    write_output(file, "| Automation         | Medium             | High                    | High              |")
    write_output(file, "")


def write_recommendations(file: Path, config: EvaluationConfig) -> None:
    """Write recommendations to file.

    Args:
        file: Output file path.
        config: Evaluation configuration.
    """
    write_output(file, "🏆 RECOMMENDATION:")
    write_output(file, "")
    write_output(file, "For VibeCode Native App (Current Goal):")
    write_output(file, "  → Use Solution 3 (Lima) for development")
    write_output(file, "  → Use Solution 2 (Cloud-init) for production distribution")
    write_output(file, "")
    write_output(file, "Reasoning:")
    write_output(file, "  - Lima VMs work now and are easier to manage")
    write_output(file, "  - Cloud-init images for distribution ensure consistency")
    write_output(file, "  - Hybrid approach: develop with Lima, ship with cloud-init")
    write_output(file, "")
    write_output(file, "🚀 Next Steps:")
    write_output(file, "")
    write_output(file, "1. Test Lima solution immediately:")
    write_output(file, "   DATADOG_API_KEY=$DD_KEY ./scripts/start-lima-vms-with-datadog.sh")
    write_output(file, "")
    write_output(file, "2. Build cloud-init images for distribution:")
    write_output(file, "   DATADOG_API_KEY=$DD_KEY ./scripts/build-vms-with-datadog.sh")
    write_output(file, "")
    write_output(file, "3. Verify Datadog metrics are flowing:")
    write_output(file, f"   https://app.{config.datadog_site}/infrastructure")
    write_output(file, "")


def evaluate_solutions(config: EvaluationConfig) -> int:
    """Evaluate all Datadog installation solutions.

    Args:
        config: Evaluation configuration.

    Returns:
        Exit code.
    """
    file = config.results_file

    # Initialize results file
    with open(file, 'w') as f:
        f.write("# Datadog Installation Solutions - Evaluation Results\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("\n")

    print("=" * 70)
    print("  Evaluating Datadog Installation Solutions")
    print("=" * 70)
    print()
    print("Testing 3 approaches:")
    print("  1. SSH into running VZ VMs (Runtime installation)")
    print("  2. Cloud-init VM build (Pre-installed)")
    print("  3. Lima VMs with provisioning (Hybrid)")
    print()

    # Evaluate each solution
    solutions = [
        get_solution_1(),
        get_solution_2(),
        get_solution_3()
    ]

    for solution in solutions:
        write_solution_evaluation(solution, file)

    # Summary and recommendations
    write_output(file, "")
    write_output(file, "=" * 70)
    write_output(file, "  SUMMARY & RECOMMENDATIONS")
    write_output(file, "=" * 70)
    write_output(file, "")

    write_comparison_matrix(file)
    write_recommendations(file, config)

    write_output(file, "=" * 70)
    print()
    print("✅ Evaluation complete!")
    print()
    print(f"📄 Full results saved to: {file}")
    print()

    # Display results
    print(file.read_text())

    return 0


def main(
    datadog_api_key: Optional[str] = None,
    datadog_site: str = "datadoghq.com",
    output_file: Optional[str] = None
) -> int:
    """Main entry point.

    Args:
        datadog_api_key: Datadog API key.
        datadog_site: Datadog site.
        output_file: Custom output file path.

    Returns:
        Exit code.
    """
    api_key = datadog_api_key or os.environ.get("DATADOG_API_KEY", "")

    if not api_key:
        print(f"{RED}❌ Error: DATADOG_API_KEY environment variable not set{NC}")
        print()
        print("Usage: DATADOG_API_KEY=your-key-here python3 evaluate_datadog_solutions.py")
        return 1

    config = EvaluationConfig(
        datadog_api_key=api_key,
        datadog_site=datadog_site,
        results_file=Path(output_file) if output_file else Path("/tmp/datadog-evaluation-results.txt")
    )

    return evaluate_solutions(config)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluate Datadog installation solutions"
    )
    parser.add_argument(
        '--api-key',
        help='Datadog API key (or set DATADOG_API_KEY env var)'
    )
    parser.add_argument(
        '--site',
        default='datadoghq.com',
        help='Datadog site (default: datadoghq.com)'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output file path (default: /tmp/datadog-evaluation-results.txt)'
    )

    args = parser.parse_args()
    sys.exit(main(
        datadog_api_key=args.api_key,
        datadog_site=args.site,
        output_file=args.output
    ))
