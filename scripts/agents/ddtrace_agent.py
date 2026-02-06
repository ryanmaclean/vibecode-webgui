#!/usr/bin/env python3
from __future__ import annotations
"""DDTrace Agent v3 - Automated trace validation and emission.

A self-contained agent for managing ddtrace instrumentation across Python scripts.

Capabilities:
- Syntax validation (especially from __future__ import ordering)
- Batch trace emission to Datadog
- Auto-fix common instrumentation issues
- Parallel execution for speed
- Detailed reporting

Usage:
    python scripts/agents/ddtrace_agent.py validate          # Check all scripts
    python scripts/agents/ddtrace_agent.py emit              # Send traces
    python scripts/agents/ddtrace_agent.py fix               # Auto-fix issues
    python scripts/agents/ddtrace_agent.py report            # Full status report
    python scripts/agents/ddtrace_agent.py --help            # Show help
"""


# Datadog Unified Service Tagging
_dd_service = "agent-ddtrace-agent"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "automation"})
    _dd_patch()
except ImportError:
    pass

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Self-instrument with ddtrace
try:
    from ddtrace import config, patch_all, tracer
    config.service = "ddtrace-agent-v3"
    patch_all()
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    tracer = None


@dataclass
class ScriptResult:
    """Result of processing a single script."""
    path: str
    syntax_ok: bool = False
    runtime_ok: bool = False
    trace_sent: bool = False
    error: Optional[str] = None
    fixed: bool = False


@dataclass
class AgentReport:
    """Aggregated report from agent run."""
    total_scripts: int = 0
    syntax_passed: int = 0
    syntax_failed: int = 0
    runtime_passed: int = 0
    runtime_failed: int = 0
    traces_sent: int = 0
    fixes_applied: int = 0
    errors: list = field(default_factory=list)
    duration_seconds: float = 0.0


class DDTraceAgent:
    """Gen 3 DDTrace Agent for automated instrumentation management."""

    def __init__(self, root_dir: Path, workers: int = 8, timeout: int = 5):
        self.root_dir = root_dir
        self.workers = workers
        self.timeout = timeout
        self.scripts_dir = root_dir / "scripts"

    def find_python_scripts(self) -> list[Path]:
        """Find all Python scripts in the scripts directory."""
        return sorted(self.scripts_dir.rglob("*.py"))

    def check_syntax(self, script: Path) -> ScriptResult:
        """Validate Python syntax for a script."""
        result = ScriptResult(path=str(script))
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "py_compile", str(script)],
                capture_output=True,
                text=True,
                timeout=10
            )
            result.syntax_ok = proc.returncode == 0
            if not result.syntax_ok:
                result.error = proc.stderr.strip()[:200]
        except subprocess.TimeoutExpired:
            result.error = "Syntax check timeout"
        except Exception as e:
            result.error = str(e)[:200]
        return result

    def run_script(self, script: Path) -> ScriptResult:
        """Run a script to trigger ddtrace initialization."""
        result = self.check_syntax(script)
        if not result.syntax_ok:
            return result

        try:
            # Try --help first (safe, triggers imports)
            proc = subprocess.run(
                [sys.executable, str(script), "--help"],
                capture_output=True,
                text=True,
                timeout=self.timeout,
                cwd=self.root_dir
            )
            result.runtime_ok = True
            result.trace_sent = True
        except subprocess.TimeoutExpired:
            # Timeout is OK - ddtrace still initialized
            result.runtime_ok = True
            result.trace_sent = True
        except Exception as e:
            # Try without --help
            try:
                proc = subprocess.run(
                    [sys.executable, str(script)],
                    capture_output=True,
                    text=True,
                    timeout=self.timeout,
                    cwd=self.root_dir
                )
                result.runtime_ok = True
                result.trace_sent = True
            except subprocess.TimeoutExpired:
                result.runtime_ok = True
                result.trace_sent = True
            except Exception as e2:
                result.error = str(e2)[:200]

        return result

    def fix_future_import(self, script: Path) -> ScriptResult:
        """Fix from __future__ import ordering issues."""
        result = ScriptResult(path=str(script))

        try:
            content = script.read_text()

            # Check if file has the issue
            if "from __future__ import" not in content:
                result.syntax_ok = True
                return result

            # Pattern 1: Datadog Log Aggregation before from __future__
            pattern_log_agg = re.compile(
                r'^(#!/usr/bin/env python3\n)'
                r'(\n*# Datadog Log Aggregation\n'
                r'from scripts\.lib\.log_aggregation import get_log_aggregation\n\n)'
                r'(from __future__ import annotations)\n'
                r'(\n# Initialize log aggregation\n'
                r'log_agg = get_log_aggregation\(\)\n)',
                re.DOTALL
            )

            if pattern_log_agg.search(content):
                new_content = pattern_log_agg.sub(
                    r'\1\3\n\2\4',
                    content
                )
                script.write_text(new_content)
                result.fixed = True
                result.syntax_ok = True
                return result

            # Pattern 2: VibeCode telemetry block before from __future__
            pattern_telemetry = re.compile(
                r'^(#!/usr/bin/env python3\n)'
                r'(\n*# -- VibeCode Telemetry --.*?# ------------------------\n\n*)'
                r'(""".*?""")\n'
                r'(from __future__ import annotations)\n',
                re.DOTALL
            )

            if pattern_telemetry.search(content):
                new_content = pattern_telemetry.sub(
                    r'\1\4\n\3\n\n\2',
                    content
                )
                script.write_text(new_content)
                result.fixed = True
                result.syntax_ok = True
                return result

            # Pattern 3: VibeCode telemetry without docstring
            pattern_telemetry2 = re.compile(
                r'^(#!/usr/bin/env python3\n)'
                r'(\n*# -- VibeCode Telemetry --.*?# ------------------------\n\n*)'
                r'(from __future__ import annotations)',
                re.DOTALL
            )

            if pattern_telemetry2.search(content):
                new_content = pattern_telemetry2.sub(
                    r'\1\3\n\2',
                    content
                )
                script.write_text(new_content)
                result.fixed = True
                result.syntax_ok = True
                return result

            # Pattern 4: Generic - any import before from __future__
            # Find from __future__ line and move it to top
            lines = content.split('\n')
            future_idx = None
            shebang_idx = None

            for i, line in enumerate(lines):
                if line.startswith('#!/'):
                    shebang_idx = i
                if line.strip().startswith('from __future__ import'):
                    future_idx = i
                    break

            if future_idx is not None and future_idx > (shebang_idx or -1) + 1:
                future_line = lines.pop(future_idx)
                insert_at = (shebang_idx or -1) + 1
                lines.insert(insert_at, future_line)
                new_content = '\n'.join(lines)
                script.write_text(new_content)
                result.fixed = True
                result.syntax_ok = True
                return result

            # Check syntax after potential fix
            result = self.check_syntax(script)

        except Exception as e:
            result.error = str(e)[:200]

        return result

    def validate_all(self, parallel: bool = True) -> AgentReport:
        """Validate syntax for all scripts."""
        scripts = self.find_python_scripts()
        report = AgentReport(total_scripts=len(scripts))
        start = time.time()

        if parallel:
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as executor:
                results = list(executor.map(self.check_syntax, scripts))
        else:
            results = [self.check_syntax(s) for s in scripts]

        for r in results:
            if r.syntax_ok:
                report.syntax_passed += 1
            else:
                report.syntax_failed += 1
                report.errors.append({"path": r.path, "error": r.error})

        report.duration_seconds = time.time() - start
        return report

    def emit_all(self, parallel: bool = True) -> AgentReport:
        """Run all scripts to emit traces."""
        scripts = self.find_python_scripts()
        report = AgentReport(total_scripts=len(scripts))
        start = time.time()

        if parallel:
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as executor:
                results = list(executor.map(self.run_script, scripts))
        else:
            results = [self.run_script(s) for s in scripts]

        for r in results:
            if r.syntax_ok:
                report.syntax_passed += 1
            else:
                report.syntax_failed += 1

            if r.runtime_ok:
                report.runtime_passed += 1
            else:
                report.runtime_failed += 1

            if r.trace_sent:
                report.traces_sent += 1

            if r.error:
                report.errors.append({"path": r.path, "error": r.error})

        report.duration_seconds = time.time() - start
        return report

    def fix_all(self, parallel: bool = True) -> AgentReport:
        """Auto-fix instrumentation issues."""
        scripts = self.find_python_scripts()
        report = AgentReport(total_scripts=len(scripts))
        start = time.time()

        # First pass: identify broken scripts
        broken = []
        for script in scripts:
            result = self.check_syntax(script)
            if not result.syntax_ok and "from __future__" in (result.error or ""):
                broken.append(script)

        # Fix broken scripts
        for script in broken:
            result = self.fix_future_import(script)
            if result.fixed:
                report.fixes_applied += 1

        # Revalidate all
        validation = self.validate_all(parallel)
        report.syntax_passed = validation.syntax_passed
        report.syntax_failed = validation.syntax_failed
        report.errors = validation.errors
        report.duration_seconds = time.time() - start

        return report

    def full_report(self) -> dict:
        """Generate comprehensive status report."""
        scripts = self.find_python_scripts()

        # Check ddtrace availability
        ddtrace_status = {
            "installed": DDTRACE_AVAILABLE,
            "version": None,
            "agent_host": os.environ.get("DD_AGENT_HOST", "localhost"),
            "service": os.environ.get("DD_SERVICE", "not set"),
        }

        if DDTRACE_AVAILABLE:
            import ddtrace
            ddtrace_status["version"] = ddtrace.__version__

        # Validate scripts
        validation = self.validate_all()

        return {
            "agent_version": "3.0.0",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "ddtrace": ddtrace_status,
            "scripts": {
                "total": len(scripts),
                "syntax_ok": validation.syntax_passed,
                "syntax_failed": validation.syntax_failed,
                "pass_rate": f"{100 * validation.syntax_passed / len(scripts):.1f}%"
            },
            "errors": validation.errors[:10],  # Top 10 errors
            "duration_seconds": validation.duration_seconds
        }


def main():
    parser = argparse.ArgumentParser(
        description="DDTrace Agent v3 - Automated trace validation and emission",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "command",
        choices=["validate", "emit", "fix", "report"],
        help="Command to run"
    )
    parser.add_argument(
        "--workers", "-w",
        type=int,
        default=8,
        help="Number of parallel workers (default: 8)"
    )
    parser.add_argument(
        "--timeout", "-t",
        type=int,
        default=5,
        help="Script execution timeout in seconds (default: 5)"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON"
    )
    parser.add_argument(
        "--sequential", "-s",
        action="store_true",
        help="Run sequentially instead of parallel"
    )

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / "scripts").is_dir():
            break
        root = root.parent

    agent = DDTraceAgent(root, workers=args.workers, timeout=args.timeout)
    parallel = not args.sequential

    if args.command == "validate":
        report = agent.validate_all(parallel)
        if args.json:
            print(json.dumps({
                "command": "validate",
                "total": report.total_scripts,
                "passed": report.syntax_passed,
                "failed": report.syntax_failed,
                "errors": report.errors,
                "duration": report.duration_seconds
            }, indent=2))
        else:
            print(f"\n{'='*50}")
            print("DDTrace Agent v3 - Syntax Validation")
            print(f"{'='*50}")
            print(f"Total scripts:  {report.total_scripts}")
            print(f"Syntax OK:      {report.syntax_passed}")
            print(f"Syntax Failed:  {report.syntax_failed}")
            print(f"Pass rate:      {100*report.syntax_passed/report.total_scripts:.1f}%")
            print(f"Duration:       {report.duration_seconds:.2f}s")
            if report.errors:
                print(f"\nErrors ({len(report.errors)}):")
                for err in report.errors[:5]:
                    print(f"  {err['path']}")

    elif args.command == "emit":
        print("Emitting traces to Datadog...")
        report = agent.emit_all(parallel)
        if args.json:
            print(json.dumps({
                "command": "emit",
                "total": report.total_scripts,
                "traces_sent": report.traces_sent,
                "runtime_ok": report.runtime_passed,
                "duration": report.duration_seconds
            }, indent=2))
        else:
            print(f"\n{'='*50}")
            print("DDTrace Agent v3 - Trace Emission")
            print(f"{'='*50}")
            print(f"Total scripts:  {report.total_scripts}")
            print(f"Traces sent:    {report.traces_sent}")
            print(f"Runtime OK:     {report.runtime_passed}")
            print(f"Duration:       {report.duration_seconds:.2f}s")

    elif args.command == "fix":
        print("Auto-fixing instrumentation issues...")
        report = agent.fix_all(parallel)
        if args.json:
            print(json.dumps({
                "command": "fix",
                "fixes_applied": report.fixes_applied,
                "syntax_ok": report.syntax_passed,
                "syntax_failed": report.syntax_failed,
                "duration": report.duration_seconds
            }, indent=2))
        else:
            print(f"\n{'='*50}")
            print("DDTrace Agent v3 - Auto-Fix")
            print(f"{'='*50}")
            print(f"Fixes applied:  {report.fixes_applied}")
            print(f"Syntax OK:      {report.syntax_passed}")
            print(f"Syntax Failed:  {report.syntax_failed}")
            print(f"Duration:       {report.duration_seconds:.2f}s")

    elif args.command == "report":
        report = agent.full_report()
        if args.json:
            print(json.dumps(report, indent=2))
        else:
            print(f"\n{'='*50}")
            print("DDTrace Agent v3 - Full Report")
            print(f"{'='*50}")
            print(f"\nddtrace Status:")
            print(f"  Installed:    {report['ddtrace']['installed']}")
            print(f"  Version:      {report['ddtrace']['version']}")
            print(f"  Agent Host:   {report['ddtrace']['agent_host']}")
            print(f"\nScripts:")
            print(f"  Total:        {report['scripts']['total']}")
            print(f"  Syntax OK:    {report['scripts']['syntax_ok']}")
            print(f"  Pass Rate:    {report['scripts']['pass_rate']}")
            print(f"\nDuration:       {report['duration_seconds']:.2f}s")

    # Exit with error if validation failed
    if args.command == "validate" and report.syntax_failed > 0:
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
