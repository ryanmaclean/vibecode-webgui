#!/usr/bin/env python3
from __future__ import annotations
"""Datadog Tagging Agent v1 - Apply unified service tagging best practices.

Applies Datadog's official tagging best practices to Python scripts:
- Sets DD_SERVICE, DD_ENV, DD_VERSION (core tags)
- Adds team and component tags
- Follows naming conventions
- Validates existing tags

Usage:
    python scripts/agents/datadog_tagging_agent.py scan           # Audit current tagging
    python scripts/agents/datadog_tagging_agent.py apply          # Apply best practices
    python scripts/agents/datadog_tagging_agent.py validate       # Validate compliance
    python scripts/agents/datadog_tagging_agent.py --help         # Show help
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import concurrent.futures

# Self-instrument with proper tagging
try:
    from ddtrace import config, patch_all, tracer
    config.service = "datadog-tagging-agent"
    config.env = os.environ.get("DD_ENV", "development")
    config.version = "1.0.0"
    tracer.set_tags({
        "team": "platform",
        "component": "automation",
    })
    patch_all()
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False


# Tagging configuration - aligned with best practices skill
TAGGING_CONFIG = {
    # Core tag defaults
    "default_env": "development",
    "default_version": "0.1.0",

    # Additional tag defaults
    "default_team": "platform",
    "default_cluster": "local",

    # Component mapping (sub-service component)
    "component_map": {
        "scripts/agents/": "automation",
        "scripts/benchmarks/": "benchmarks",
        "scripts/security/": "security",
        "scripts/tests/": "testing",
        "scripts/vfkit/": "vm-management",
        "scripts/vfkit_py/": "vm-management",
        "scripts/vz/": "virtualization",
        "scripts/lib/": "library",
        "scripts/python/tundra_automation/": "tundra",
        "scripts/cloud/": "cloud",
        "scripts/cloud/kind/": "kubernetes",
        "scripts/monitoring/": "monitoring",
        "scripts/release/": "release",
        "scripts/cleanup/": "maintenance",
        "scripts/launch/": "launcher",
        "scripts/vm/": "vm-management",
        "scripts/vibecode/": "vibecode",
        "scripts/vibecode_cli/": "cli",
    },

    # Service naming: {prefix}-{script-name} pattern
    "service_prefix_map": {
        "scripts/python/tundra_automation/": "tundra",
        "scripts/agents/": "agent",
        "scripts/benchmarks/": "bench",
        "scripts/vfkit/": "vfkit",
        "scripts/vfkit_py/": "vfkit",
        "scripts/vz/": "vz",
        "scripts/cloud/kind/": "kind",
        "scripts/cloud/": "cloud",
        "scripts/security/": "security",
        "scripts/vm/": "vm",
        "scripts/vibecode_cli/": "vibecode-cli",
    },

    # Cluster mapping for K8s-related scripts
    "cluster_map": {
        "scripts/python/tundra_automation/": "tundra-dome",
        "scripts/cloud/kind/": "tundra-dome",
    }
}


# The tagging block to inject - follows skill pattern exactly
TAGGING_TEMPLATE = '''
# Datadog Unified Service Tagging (following best practices skill)
import os as _dd_os

try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer

    # Core tags (required) - env, service, version
    _dd_config.service = _dd_os.environ.get("DD_SERVICE", "{service}")
    _dd_config.env = _dd_os.environ.get("DD_ENV", "{env}")
    _dd_config.version = _dd_os.environ.get("DD_VERSION", "{version}")

    # Additional tags - team, component, cluster
    _dd_tracer.set_tags({{
        "team": "{team}",
        "component": "{component}",
        "cluster": _dd_os.environ.get("DD_CLUSTER", "{cluster}"),
    }})

    _dd_patch()
except ImportError:
    pass  # ddtrace not installed
'''


@dataclass
class TaggingResult:
    """Result of tagging analysis/application."""
    path: str
    has_service: bool = False
    has_env: bool = False
    has_version: bool = False
    has_team: bool = False
    has_component: bool = False
    service_name: Optional[str] = None
    compliant: bool = False
    updated: bool = False
    error: Optional[str] = None


@dataclass
class TaggingReport:
    """Aggregated tagging report."""
    total_scripts: int = 0
    compliant: int = 0
    non_compliant: int = 0
    updated: int = 0
    missing_service: int = 0
    missing_env: int = 0
    missing_version: int = 0
    errors: list = field(default_factory=list)


class DatadogTaggingAgent:
    """Agent for applying Datadog tagging best practices."""

    def __init__(self, root_dir: Path, workers: int = 8):
        self.root_dir = root_dir
        self.workers = workers
        self.scripts_dir = root_dir / "scripts"

    def find_python_scripts(self) -> list[Path]:
        """Find all Python scripts."""
        return sorted(self.scripts_dir.rglob("*.py"))

    def derive_service_name(self, script: Path) -> str:
        """Derive service name from script path following naming conventions.

        Follows skill patterns:
        - {app}-{component}: crew-api
        - {domain}-{function}: payment-processor
        - {prefix}-{script-name}: bench-boot-latency
        """
        rel_path = str(script.relative_to(self.root_dir))
        name = script.stem.replace("_", "-").replace(" ", "-").lower()

        # Check longest prefix first for more specific matches
        for prefix in sorted(TAGGING_CONFIG["service_prefix_map"].keys(), key=len, reverse=True):
            if rel_path.startswith(prefix):
                svc_prefix = TAGGING_CONFIG["service_prefix_map"][prefix]
                return f"{svc_prefix}-{name}"

        return name

    def derive_component(self, script: Path) -> str:
        """Derive component from script path."""
        rel_path = str(script.relative_to(self.root_dir))

        # Check longest prefix first for more specific matches
        for prefix in sorted(TAGGING_CONFIG["component_map"].keys(), key=len, reverse=True):
            if rel_path.startswith(prefix):
                return TAGGING_CONFIG["component_map"][prefix]

        return "scripts"

    def derive_cluster(self, script: Path) -> str:
        """Derive cluster from script path (for K8s-related scripts)."""
        rel_path = str(script.relative_to(self.root_dir))

        for prefix, cluster in TAGGING_CONFIG.get("cluster_map", {}).items():
            if rel_path.startswith(prefix):
                return cluster

        return TAGGING_CONFIG["default_cluster"]

    def scan_script(self, script: Path) -> TaggingResult:
        """Scan a script for tagging compliance."""
        result = TaggingResult(path=str(script))

        try:
            content = script.read_text()

            # Check for core tags
            result.has_service = bool(re.search(r'config\.service\s*=|DD_SERVICE|_dd_service', content))
            result.has_env = bool(re.search(r'config\.env\s*=|DD_ENV|_dd_env', content))
            result.has_version = bool(re.search(r'config\.version\s*=|DD_VERSION|_dd_version', content))

            # Check for additional tags
            result.has_team = bool(re.search(r'"team":|\'team\':', content))
            result.has_component = bool(re.search(r'"component":|\'component\':', content))

            # Extract service name if present
            svc_match = re.search(r'config\.service\s*=\s*["\']([^"\']+)["\']', content)
            if svc_match:
                result.service_name = svc_match.group(1)

            # Check compliance (must have all three core tags)
            result.compliant = result.has_service and result.has_env and result.has_version

        except Exception as e:
            result.error = str(e)[:200]

        return result

    def apply_tagging(self, script: Path) -> TaggingResult:
        """Apply unified service tagging to a script."""
        result = self.scan_script(script)

        if result.compliant:
            return result

        try:
            content = script.read_text()

            # Derive tag values following best practices skill
            service = self.derive_service_name(script)
            env = TAGGING_CONFIG["default_env"]
            version = TAGGING_CONFIG["default_version"]
            team = TAGGING_CONFIG["default_team"]
            component = self.derive_component(script)
            cluster = self.derive_cluster(script)

            # Generate tagging block (matches skill pattern)
            tagging_block = TAGGING_TEMPLATE.format(
                service=service,
                env=env,
                version=version,
                team=team,
                component=component,
                cluster=cluster
            )

            # Find insertion point (after from __future__ and docstring)
            lines = content.split('\n')
            insert_idx = 0

            for i, line in enumerate(lines):
                # Skip shebang
                if line.startswith('#!'):
                    insert_idx = i + 1
                    continue
                # Skip from __future__
                if line.strip().startswith('from __future__'):
                    insert_idx = i + 1
                    continue
                # Skip docstrings
                if line.strip().startswith('"""') or line.strip().startswith("'''"):
                    # Find end of docstring
                    if line.count('"""') == 2 or line.count("'''") == 2:
                        insert_idx = i + 1
                    else:
                        for j in range(i + 1, len(lines)):
                            if '"""' in lines[j] or "'''" in lines[j]:
                                insert_idx = j + 1
                                break
                    continue
                # Skip existing telemetry/tagging blocks
                if '# -- VibeCode Telemetry --' in line:
                    for j in range(i, len(lines)):
                        if '# ------------------------' in lines[j]:
                            insert_idx = j + 1
                            break
                    break
                if '# Datadog Log Aggregation' in line:
                    # Skip this block
                    for j in range(i, min(i + 5, len(lines))):
                        if lines[j].strip().startswith('log_agg'):
                            insert_idx = j + 1
                            break
                    break
                if '# Datadog APM tracing' in line:
                    # Replace existing block
                    for j in range(i, min(i + 6, len(lines))):
                        if 'pass' in lines[j] and 'ddtrace' in '\n'.join(lines[i:j+1]):
                            # Remove old block
                            lines = lines[:i] + lines[j+1:]
                            insert_idx = i
                            break
                    break
                # Stop at first real import
                if line.strip().startswith('import ') or (line.strip().startswith('from ') and '__future__' not in line):
                    insert_idx = i
                    break

            # Check if tagging already exists
            if '_dd_service' in content or 'Datadog Unified Service Tagging' in content:
                result.compliant = True
                return result

            # Insert tagging block
            lines.insert(insert_idx, tagging_block)
            new_content = '\n'.join(lines)

            script.write_text(new_content)
            result.updated = True
            result.compliant = True
            result.service_name = service

        except Exception as e:
            result.error = str(e)[:200]

        return result

    def scan_all(self, parallel: bool = True) -> TaggingReport:
        """Scan all scripts for tagging compliance."""
        scripts = self.find_python_scripts()
        report = TaggingReport(total_scripts=len(scripts))

        if parallel:
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as executor:
                results = list(executor.map(self.scan_script, scripts))
        else:
            results = [self.scan_script(s) for s in scripts]

        for r in results:
            if r.compliant:
                report.compliant += 1
            else:
                report.non_compliant += 1

            if not r.has_service:
                report.missing_service += 1
            if not r.has_env:
                report.missing_env += 1
            if not r.has_version:
                report.missing_version += 1

            if r.error:
                report.errors.append({"path": r.path, "error": r.error})

        return report

    def apply_all(self, parallel: bool = True) -> TaggingReport:
        """Apply tagging to all scripts."""
        scripts = self.find_python_scripts()
        report = TaggingReport(total_scripts=len(scripts))

        # Apply sequentially to avoid race conditions on file writes
        results = [self.apply_tagging(s) for s in scripts]

        for r in results:
            if r.compliant:
                report.compliant += 1
            else:
                report.non_compliant += 1

            if r.updated:
                report.updated += 1

            if r.error:
                report.errors.append({"path": r.path, "error": r.error})

        return report

    def validate_all(self) -> dict:
        """Validate tagging compliance with detailed report."""
        scripts = self.find_python_scripts()
        results = []

        for script in scripts:
            r = self.scan_script(script)
            if not r.compliant:
                results.append({
                    "path": str(script.relative_to(self.root_dir)),
                    "service": r.service_name,
                    "missing": {
                        "service": not r.has_service,
                        "env": not r.has_env,
                        "version": not r.has_version,
                        "team": not r.has_team,
                        "component": not r.has_component,
                    }
                })

        scan = self.scan_all()

        return {
            "total": len(scripts),
            "compliant": scan.compliant,
            "non_compliant": scan.non_compliant,
            "compliance_rate": f"{100 * scan.compliant / len(scripts):.1f}%",
            "non_compliant_scripts": results[:20],  # Top 20
        }


def main():
    parser = argparse.ArgumentParser(
        description="Datadog Tagging Agent - Apply unified service tagging best practices",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "command",
        choices=["scan", "apply", "validate"],
        help="Command to run"
    )
    parser.add_argument(
        "--workers", "-w",
        type=int,
        default=8,
        help="Number of parallel workers (default: 8)"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON"
    )

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / "scripts").is_dir():
            break
        root = root.parent

    agent = DatadogTaggingAgent(root, workers=args.workers)

    if args.command == "scan":
        report = agent.scan_all()
        if args.json:
            print(json.dumps({
                "command": "scan",
                "total": report.total_scripts,
                "compliant": report.compliant,
                "non_compliant": report.non_compliant,
                "missing_service": report.missing_service,
                "missing_env": report.missing_env,
                "missing_version": report.missing_version,
            }, indent=2))
        else:
            print(f"\n{'='*50}")
            print("Datadog Tagging Agent - Compliance Scan")
            print(f"{'='*50}")
            print(f"Total scripts:     {report.total_scripts}")
            print(f"Compliant:         {report.compliant}")
            print(f"Non-compliant:     {report.non_compliant}")
            print(f"Compliance rate:   {100*report.compliant/report.total_scripts:.1f}%")
            print(f"\nMissing Tags:")
            print(f"  service:         {report.missing_service}")
            print(f"  env:             {report.missing_env}")
            print(f"  version:         {report.missing_version}")

    elif args.command == "apply":
        print("Applying unified service tagging...")
        report = agent.apply_all()
        if args.json:
            print(json.dumps({
                "command": "apply",
                "total": report.total_scripts,
                "updated": report.updated,
                "compliant": report.compliant,
                "errors": report.errors[:10],
            }, indent=2))
        else:
            print(f"\n{'='*50}")
            print("Datadog Tagging Agent - Apply Tags")
            print(f"{'='*50}")
            print(f"Total scripts:     {report.total_scripts}")
            print(f"Updated:           {report.updated}")
            print(f"Now compliant:     {report.compliant}")
            if report.errors:
                print(f"\nErrors ({len(report.errors)}):")
                for err in report.errors[:5]:
                    print(f"  {err['path']}")

    elif args.command == "validate":
        report = agent.validate_all()
        if args.json:
            print(json.dumps(report, indent=2))
        else:
            print(f"\n{'='*50}")
            print("Datadog Tagging Agent - Validation Report")
            print(f"{'='*50}")
            print(f"Total:             {report['total']}")
            print(f"Compliant:         {report['compliant']}")
            print(f"Non-compliant:     {report['non_compliant']}")
            print(f"Compliance rate:   {report['compliance_rate']}")
            if report['non_compliant_scripts']:
                print(f"\nNon-compliant scripts ({len(report['non_compliant_scripts'])}):")
                for s in report['non_compliant_scripts'][:10]:
                    print(f"  {s['path']}")

    sys.exit(0)


if __name__ == "__main__":
    main()
