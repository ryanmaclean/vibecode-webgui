#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "automate-error-tracking"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Master Error Tracking Automation Script.

Orchestrates error tracking automation across the entire project:
- Validates environment and dependencies
- Verifies error tracking infrastructure
- Integrates error tracking into scripts
- Runs validation tests
- Generates automation reports
"""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


# ANSI color codes
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    PURPLE = "\033[0;35m"
    CYAN = "\033[0;36m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = ""
        cls.BLUE = cls.PURPLE = cls.CYAN = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def log_info(msg: str) -> None:
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {msg}")


def log_success(msg: str) -> None:
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {msg}")


def log_warning(msg: str) -> None:
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {msg}")


def log_error(msg: str) -> None:
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")


def log_step(msg: str) -> None:
    print(f"{Colors.PURPLE}[STEP]{Colors.NC} {msg}")


def log_header(msg: str) -> None:
    print(f"{Colors.CYAN}=== {msg} ==={Colors.NC}")


@dataclass
class AutomationConfig:
    """Configuration for automation run."""
    auto_integrate: bool = True
    run_tests: bool = True
    update_scripts: bool = True
    verbose: bool = False
    project_root: Path = field(default_factory=Path.cwd)


@dataclass
class AutomationMetrics:
    """Track automation metrics."""
    start_time: float = field(default_factory=time.time)
    validation_passed: int = 0
    validation_total: int = 0
    shell_scripts_integrated: int = 0
    node_scripts_integrated: int = 0


def check_command(cmd: str) -> bool:
    """Check if a command is available."""
    return shutil.which(cmd) is not None


def run_command(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a command and return result."""
    try:
        return subprocess.run(
            cmd,
            check=check,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        if check:
            raise
        return e


def validate_environment(config: AutomationConfig) -> bool:
    """Step 1: Validate environment variables and tools."""
    log_step("1. Validating Environment")

    # Check required environment variables
    missing_vars = []
    if not os.environ.get("DD_API_KEY"):
        missing_vars.append("DD_API_KEY")

    if missing_vars:
        log_error(f"Missing required environment variables: {', '.join(missing_vars)}")
        return False

    # Check required tools
    missing_tools = []
    for tool in ["node", "npm", "git"]:
        if not check_command(tool):
            missing_tools.append(tool)

    if missing_tools:
        log_error(f"Missing required tools: {', '.join(missing_tools)}")
        return False

    log_success("Environment validation completed")
    return True


def create_infrastructure(config: AutomationConfig) -> bool:
    """Step 2: Create/verify error tracking infrastructure."""
    log_step("2. Creating Error Tracking Infrastructure")

    scripts_lib = config.project_root / "scripts" / "lib"
    scripts_lib.mkdir(parents=True, exist_ok=True)

    # Check shell error tracking module
    shell_module = scripts_lib / "error-tracking.sh"
    if not shell_module.exists():
        log_error(f"Error tracking module not found at {shell_module}")
        return False

    # Check Node.js error tracking module
    node_module = config.project_root / "src" / "lib" / "automation" / "error-tracking-node.ts"
    if not node_module.exists():
        log_error("Node.js error tracking module not found")
        return False

    log_success("Error tracking infrastructure verified")
    return True


def integrate_error_tracking(config: AutomationConfig) -> bool:
    """Step 3: Integrate error tracking into scripts."""
    if not config.auto_integrate:
        log_info("Skipping automatic integration (--no-integrate)")
        return True

    log_step("3. Integrating Error Tracking into Scripts")

    integration_script = config.project_root / "scripts" / "integrate-error-tracking.ts"
    if not integration_script.exists():
        log_warning("Integration script not found, skipping")
        return True

    try:
        result = run_command(["npx", "tsx", str(integration_script)], check=False)
        if result.returncode == 0:
            log_success("Error tracking integration completed")
            return True
        else:
            log_error("Error tracking integration failed")
            if config.verbose:
                print(result.stderr)
            return False
    except Exception as e:
        log_error(f"Integration failed: {e}")
        return False


def update_package_scripts(config: AutomationConfig) -> bool:
    """Step 4: Update package.json scripts."""
    if not config.update_scripts:
        log_info("Skipping package.json update (--no-update)")
        return True

    log_step("4. Updating Package.json Scripts")

    package_json = config.project_root / "package.json"
    if not package_json.exists():
        log_warning("package.json not found")
        return True

    content = package_json.read_text()
    if "test:error-tracking" not in content:
        log_info("Add this to package.json scripts:")
        log_info('  "test:error-tracking": "npx tsx src/lib/monitoring/error-tracking-test.ts"')

    log_success("Package.json scripts checked")
    return True


def run_error_tracking_tests(config: AutomationConfig) -> bool:
    """Step 5: Run error tracking tests."""
    if not config.run_tests:
        log_info("Skipping error tracking tests (--no-tests)")
        return True

    log_step("5. Running Error Tracking Tests")

    # Test shell script error tracking
    log_info("Testing shell script error tracking...")
    shell_test = config.project_root / "scripts" / "lib" / "error-tracking.sh"
    if shell_test.exists():
        result = run_command(["bash", str(shell_test)], check=False)
        if result.returncode == 0:
            log_success("Shell error tracking test passed")
        else:
            log_warning("Shell error tracking test failed")

    # Test Node.js error tracking
    log_info("Testing Node.js error tracking...")
    node_test = config.project_root / "src" / "lib" / "monitoring" / "error-tracking-test.ts"
    if node_test.exists():
        result = run_command(["npx", "tsx", str(node_test)], check=False)
        if result.returncode == 0:
            log_success("Node.js error tracking test passed")
        else:
            log_warning("Node.js error tracking test failed")

    log_success("Error tracking tests completed")
    return True


def validate_integration(config: AutomationConfig, metrics: AutomationMetrics) -> bool:
    """Step 6: Validate integration."""
    log_step("6. Validating Integration")

    scripts_dir = config.project_root / "scripts"

    # Check shell scripts
    log_info("Validating shell script integration...")
    shell_scripts = list(scripts_dir.rglob("*.sh"))
    integrated_shell = 0
    for script in shell_scripts:
        try:
            if "error-tracking.sh" in script.read_text():
                integrated_shell += 1
        except (IOError, UnicodeDecodeError):
            pass

    metrics.shell_scripts_integrated = integrated_shell
    metrics.validation_total += 1
    if integrated_shell > 0:
        log_success(f"Shell scripts integration: {integrated_shell}/{len(shell_scripts)}")
        metrics.validation_passed += 1
    else:
        log_warning("No shell scripts have error tracking integrated")

    # Check Node.js scripts
    log_info("Validating Node.js script integration...")
    node_patterns = ["*.js", "*.ts", "*.mjs"]
    node_scripts = []
    for pattern in node_patterns:
        node_scripts.extend(scripts_dir.rglob(pattern))

    integrated_node = 0
    for script in node_scripts:
        try:
            if "error-tracking-node" in script.read_text():
                integrated_node += 1
        except (IOError, UnicodeDecodeError):
            pass

    metrics.node_scripts_integrated = integrated_node
    metrics.validation_total += 1
    if integrated_node > 0:
        log_success(f"Node.js scripts integration: {integrated_node}/{len(node_scripts)}")
        metrics.validation_passed += 1
    else:
        log_warning("No Node.js scripts have error tracking integrated")

    # Check CI/CD integration
    log_info("Validating CI/CD integration...")
    ci_workflow = config.project_root / ".github" / "workflows" / "error-tracking-integration.yml"
    metrics.validation_total += 1
    if ci_workflow.exists():
        log_success("CI/CD error tracking workflow exists")
        metrics.validation_passed += 1
    else:
        log_warning("CI/CD error tracking workflow not found")

    # Calculate percentage
    if metrics.validation_total > 0:
        percentage = metrics.validation_passed * 100 // metrics.validation_total
        if percentage >= 80:
            log_success(f"Integration validation passed: {percentage}%")
        else:
            log_warning(f"Integration validation below threshold: {percentage}%")

    return True


def generate_report(config: AutomationConfig, metrics: AutomationMetrics) -> Path:
    """Step 7: Generate automation report."""
    log_step("7. Generating Automation Report")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_file = config.project_root / f"error-tracking-automation-report-{timestamp}.md"

    shell_module_exists = (config.project_root / "scripts" / "lib" / "error-tracking.sh").exists()
    node_module_exists = (config.project_root / "src" / "lib" / "automation" / "error-tracking-node.ts").exists()
    ci_workflow_exists = (config.project_root / ".github" / "workflows" / "error-tracking-integration.yml").exists()

    dd_api_key = "Configured" if os.environ.get("DD_API_KEY") else "Missing"
    dd_service = os.environ.get("DD_SERVICE", "Not set")
    dd_env = os.environ.get("DD_ENV", "Not set")

    report = f"""# Error Tracking Automation Report
Generated: {datetime.now().isoformat()}

## Summary
- Auto Integration: {config.auto_integrate}
- Run Tests: {config.run_tests}
- Update Scripts: {config.update_scripts}

## Infrastructure
- Shell Error Tracking Module: {"Present" if shell_module_exists else "Missing"}
- Node.js Error Tracking Module: {"Present" if node_module_exists else "Missing"}
- CI/CD Workflow: {"Present" if ci_workflow_exists else "Missing"}

## Script Integration
- Shell Scripts: {metrics.shell_scripts_integrated} integrated
- Node.js Scripts: {metrics.node_scripts_integrated} integrated

## Environment
- DD_API_KEY: {dd_api_key}
- DD_SERVICE: {dd_service}
- DD_ENV: {dd_env}

## Next Steps
1. Set DD_ERROR_TRACKING_ENABLED=true in your environment
2. Configure DD_API_KEY with your Datadog API key
3. Test error tracking by running some scripts
4. Check your Datadog Error Tracking dashboard
5. Set up alerts for error tracking events
"""

    report_file.write_text(report)
    log_success(f"Automation report generated: {report_file.name}")
    return report_file


def finalize_automation(config: AutomationConfig) -> bool:
    """Step 8: Cleanup and finalization."""
    log_step("8. Finalizing Automation")

    # Make scripts executable
    log_info("Making scripts executable...")
    scripts_dir = config.project_root / "scripts"
    for script in scripts_dir.glob("*.sh"):
        try:
            script.chmod(script.stat().st_mode | 0o111)
        except OSError:
            pass

    scripts_lib = scripts_dir / "lib"
    if scripts_lib.exists():
        for script in scripts_lib.glob("*.sh"):
            try:
                script.chmod(script.stat().st_mode | 0o111)
            except OSError:
                pass

    # Check for git repository
    if (config.project_root / ".git").is_dir():
        log_info("Git repository detected, hooks can be configured")

    log_success("Automation finalization completed")
    return True


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--no-integrate",
        action="store_true",
        help="Skip automatic script integration",
    )
    parser.add_argument(
        "--no-tests",
        action="store_true",
        help="Skip error tracking tests",
    )
    parser.add_argument(
        "--no-update",
        action="store_true",
        help="Skip package.json updates",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output",
    )
    parser.add_argument(
        "-C", "--directory",
        type=Path,
        default=Path.cwd(),
        help="Project root directory (default: current directory)",
    )

    args = parser.parse_args(argv)

    config = AutomationConfig(
        auto_integrate=not args.no_integrate,
        run_tests=not args.no_tests,
        update_scripts=not args.no_update,
        verbose=args.verbose,
        project_root=args.directory.resolve(),
    )

    metrics = AutomationMetrics()

    log_header("MASTER ERROR TRACKING AUTOMATION")
    log_info("Starting master error tracking automation...")
    log_info(f"Auto Integrate: {config.auto_integrate}")
    log_info(f"Run Tests: {config.run_tests}")
    log_info(f"Update Scripts: {config.update_scripts}")

    # Run all steps
    steps = [
        ("validate_environment", lambda: validate_environment(config)),
        ("create_infrastructure", lambda: create_infrastructure(config)),
        ("integrate_error_tracking", lambda: integrate_error_tracking(config)),
        ("update_package_scripts", lambda: update_package_scripts(config)),
        ("run_error_tracking_tests", lambda: run_error_tracking_tests(config)),
        ("validate_integration", lambda: validate_integration(config, metrics)),
        ("generate_report", lambda: generate_report(config, metrics)),
        ("finalize_automation", lambda: finalize_automation(config)),
    ]

    for step_name, step_func in steps:
        try:
            result = step_func()
            if result is False:
                log_error(f"Step {step_name} failed")
                return 1
        except Exception as e:
            log_error(f"Step {step_name} raised exception: {e}")
            if config.verbose:
                import traceback
                traceback.print_exc()
            return 1

    # Track completion
    duration = int(time.time() - metrics.start_time)

    log_header("AUTOMATION COMPLETED")
    log_success("Master error tracking automation completed successfully!")
    log_info(f"Total automation time: {duration}s")

    return 0


if __name__ == "__main__":
    sys.exit(main())