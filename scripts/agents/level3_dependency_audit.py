#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Dependency Audit Agent - Autonomous CVE Scanner.

A Level 3 agentic system exhibiting constrained autonomy:
- Discovers package manifests across the repository
- Scans dependencies for CVEs using multiple tools
- Reflects on findings and prioritizes by severity
- Adapts scanning strategy based on results
- Generates comprehensive vulnerability reports

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    python scripts/agents/level3_dependency_audit.py "audit all dependencies for CVEs"
    python scripts/agents/level3_dependency_audit.py --severity critical  # Only critical
    python scripts/agents/level3_dependency_audit.py --fix  # Auto-fix where safe
    python scripts/agents/level3_dependency_audit.py --output report.json  # Save to file
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

# Datadog Unified Service Tagging (self-instrumented)
try:
    from ddtrace import config, patch_all, tracer
    config.service = os.environ.get("DD_SERVICE", "level3-dependency-audit")
    config.env = os.environ.get("DD_ENV", "development")
    config.version = os.environ.get("DD_VERSION", "1.0.0")
    tracer.set_tags({
        "team": "security",
        "component": "autonomous-agent",
        "agent_level": "3",
    })
    patch_all()
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    tracer = None


class AgentState(Enum):
    """Agent execution states."""
    IDLE = "idle"
    PLANNING = "planning"
    EXECUTING = "executing"
    REFLECTING = "reflecting"
    ADAPTING = "adapting"
    COMPLETED = "completed"
    FAILED = "failed"


class ActionType(Enum):
    """Available agent actions."""
    DISCOVER = "discover"
    SCAN_PYTHON = "scan_python"
    SCAN_NODE = "scan_node"
    SCAN_GO = "scan_go"
    SCAN_RUST = "scan_rust"
    SCAN_TRIVY = "scan_trivy"
    PRIORITIZE = "prioritize"
    SUGGEST_UPGRADES = "suggest_upgrades"
    APPLY_FIXES = "apply_fixes"
    REPORT = "report"


class Severity(Enum):
    """CVE severity levels based on CVSS scores."""
    CRITICAL = "critical"  # CVSS >= 9.0
    HIGH = "high"          # CVSS >= 7.0
    MEDIUM = "medium"      # CVSS >= 4.0
    LOW = "low"            # CVSS < 4.0
    UNKNOWN = "unknown"

    @classmethod
    def from_cvss(cls, score: float) -> "Severity":
        """Convert CVSS score to severity level."""
        if score >= 9.0:
            return cls.CRITICAL
        elif score >= 7.0:
            return cls.HIGH
        elif score >= 4.0:
            return cls.MEDIUM
        elif score > 0:
            return cls.LOW
        return cls.UNKNOWN

    @classmethod
    def from_string(cls, s: str) -> "Severity":
        """Parse severity from string."""
        s_lower = s.lower().strip()
        mapping = {
            "critical": cls.CRITICAL,
            "high": cls.HIGH,
            "moderate": cls.MEDIUM,
            "medium": cls.MEDIUM,
            "low": cls.LOW,
            "info": cls.LOW,
            "informational": cls.LOW,
        }
        return mapping.get(s_lower, cls.UNKNOWN)

    def __ge__(self, other):
        order = {Severity.CRITICAL: 4, Severity.HIGH: 3, Severity.MEDIUM: 2, Severity.LOW: 1, Severity.UNKNOWN: 0}
        return order[self] >= order[other]

    def __gt__(self, other):
        order = {Severity.CRITICAL: 4, Severity.HIGH: 3, Severity.MEDIUM: 2, Severity.LOW: 1, Severity.UNKNOWN: 0}
        return order[self] > order[other]


@dataclass
class Vulnerability:
    """A discovered vulnerability."""
    package: str
    version: str
    severity: Severity
    cve_id: str
    description: str
    fixed_version: Optional[str] = None
    cvss_score: Optional[float] = None
    source: str = ""  # Which scanner found it


@dataclass
class PackageManifest:
    """A discovered package manifest."""
    path: Path
    type: str  # python, node, go, rust
    packages: list[dict] = field(default_factory=list)


@dataclass
class Action:
    """A single action in the execution plan."""
    type: ActionType
    description: str
    params: dict = field(default_factory=dict)
    result: Optional[dict] = None
    success: bool = False
    error: Optional[str] = None


@dataclass
class Plan:
    """Execution plan with actions."""
    intent: str
    actions: list[Action] = field(default_factory=list)
    created_at: str = ""
    iteration: int = 1

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class Reflection:
    """Reflection on execution results."""
    success: bool
    issues: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    should_retry: bool = False
    new_actions: list[Action] = field(default_factory=list)


@dataclass
class GovernanceCheck:
    """Safety and compliance check."""
    passed: bool
    violations: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class Level3DependencyAuditAgent:
    """
    Level 3 Autonomous Agent for Dependency Vulnerability Scanning.

    Capabilities:
    - Discover: Find all package manifests in the repository
    - Scan: Run appropriate vulnerability scanners per ecosystem
    - Prioritize: Rank vulnerabilities by CVSS severity
    - Suggest: Recommend safe upgrade paths
    - Report: Generate comprehensive vulnerability reports

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 3
    SEVERITY_THRESHOLD = Severity.HIGH  # Fail on HIGH or CRITICAL by default

    def __init__(
        self,
        root_dir: Path,
        verbose: bool = True,
        severity_threshold: Severity = Severity.HIGH,
        auto_fix: bool = False,
    ):
        self.root_dir = root_dir
        self.verbose = verbose
        self.severity_threshold = severity_threshold
        self.auto_fix = auto_fix
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []

        # Discovered data
        self.manifests: list[PackageManifest] = []
        self.vulnerabilities: list[Vulnerability] = []
        self.outdated_packages: list[dict] = []
        self.upgrade_suggestions: list[dict] = []

        # Tool availability
        self.available_tools = self._detect_tools()

    def _detect_tools(self) -> dict[str, bool]:
        """Detect which scanning tools are available."""
        tools = {
            "pip-audit": shutil.which("pip-audit") is not None,
            "safety": shutil.which("safety") is not None,
            "npm": shutil.which("npm") is not None,
            "yarn": shutil.which("yarn") is not None,
            "govulncheck": shutil.which("govulncheck") is not None,
            "cargo-audit": shutil.which("cargo-audit") is not None,
            "trivy": shutil.which("trivy") is not None,
        }

        # Also check if pip-audit can be run via python
        if not tools["pip-audit"]:
            result = subprocess.run(
                [sys.executable, "-m", "pip_audit", "--version"],
                capture_output=True, text=True
            )
            tools["pip-audit"] = result.returncode == 0

        return tools

    def log(self, message: str, level: str = "INFO"):
        """Log with tracing."""
        timestamp = datetime.utcnow().isoformat()
        entry = {"timestamp": timestamp, "level": level, "message": message, "state": self.state.value}
        self.execution_log.append(entry)

        if self.verbose:
            print(f"[{level}] [{self.state.value}] {message}")

        if DDTRACE_AVAILABLE and tracer:
            span = tracer.current_span()
            if span:
                span.set_tag(f"agent.log.{len(self.execution_log)}", message[:100])

    # ==================== PLANNING ====================

    def plan(self, intent: str) -> Plan:
        """
        PLAN PHASE: Analyze intent and create execution plan.

        This is where Level 3 autonomy begins - the agent decides
        what actions to take based on the given intent.
        """
        self.state = AgentState.PLANNING
        self.log(f"Planning for intent: {intent}")

        plan = Plan(intent=intent)
        intent_lower = intent.lower()

        # Always start with discovery
        plan.actions.append(
            Action(ActionType.DISCOVER, "Discover all package manifests")
        )

        # Determine scanning approach based on intent
        if "python" in intent_lower:
            plan.actions.append(
                Action(ActionType.SCAN_PYTHON, "Scan Python dependencies for CVEs")
            )
        elif "node" in intent_lower or "npm" in intent_lower:
            plan.actions.append(
                Action(ActionType.SCAN_NODE, "Scan Node.js dependencies for CVEs")
            )
        elif "go" in intent_lower:
            plan.actions.append(
                Action(ActionType.SCAN_GO, "Scan Go dependencies for CVEs")
            )
        elif "rust" in intent_lower or "cargo" in intent_lower:
            plan.actions.append(
                Action(ActionType.SCAN_RUST, "Scan Rust dependencies for CVEs")
            )
        else:
            # Full audit - scan all ecosystems
            plan.actions.extend([
                Action(ActionType.SCAN_PYTHON, "Scan Python dependencies for CVEs"),
                Action(ActionType.SCAN_NODE, "Scan Node.js dependencies for CVEs"),
                Action(ActionType.SCAN_GO, "Scan Go dependencies for CVEs"),
                Action(ActionType.SCAN_RUST, "Scan Rust dependencies for CVEs"),
            ])

            # Use trivy for comprehensive scanning if available
            if self.available_tools.get("trivy"):
                plan.actions.append(
                    Action(ActionType.SCAN_TRIVY, "Run Trivy for comprehensive scan")
                )

        # Prioritization and reporting
        plan.actions.append(
            Action(ActionType.PRIORITIZE, "Prioritize vulnerabilities by severity")
        )
        plan.actions.append(
            Action(ActionType.SUGGEST_UPGRADES, "Suggest safe upgrade paths")
        )

        # Auto-fix if enabled
        if self.auto_fix:
            plan.actions.append(
                Action(ActionType.APPLY_FIXES, "Apply safe automatic fixes")
            )

        # Always end with report
        plan.actions.append(
            Action(ActionType.REPORT, "Generate vulnerability report")
        )

        self.log(f"Created plan with {len(plan.actions)} actions")
        return plan

    # ==================== EXECUTION ====================

    def execute(self, plan: Plan) -> Plan:
        """
        EXECUTE PHASE: Run all actions in the plan.

        Each action is executed with error handling and results tracking.
        """
        self.state = AgentState.EXECUTING
        self.log(f"Executing plan iteration {plan.iteration}")

        for i, action in enumerate(plan.actions):
            self.log(f"Action {i+1}/{len(plan.actions)}: {action.type.value} - {action.description}")

            try:
                result = self._execute_action(action)
                action.result = result
                action.success = result.get("success", False)

                if not action.success:
                    action.error = result.get("error", "Unknown error")
                    self.log(f"Action failed: {action.error}", "WARN")

            except Exception as e:
                action.success = False
                action.error = str(e)
                self.log(f"Action exception: {e}", "ERROR")

        return plan

    def _execute_action(self, action: Action) -> dict:
        """Execute a single action and return results."""

        if action.type == ActionType.DISCOVER:
            return self._action_discover()

        elif action.type == ActionType.SCAN_PYTHON:
            return self._action_scan_python()

        elif action.type == ActionType.SCAN_NODE:
            return self._action_scan_node()

        elif action.type == ActionType.SCAN_GO:
            return self._action_scan_go()

        elif action.type == ActionType.SCAN_RUST:
            return self._action_scan_rust()

        elif action.type == ActionType.SCAN_TRIVY:
            return self._action_scan_trivy()

        elif action.type == ActionType.PRIORITIZE:
            return self._action_prioritize()

        elif action.type == ActionType.SUGGEST_UPGRADES:
            return self._action_suggest_upgrades()

        elif action.type == ActionType.APPLY_FIXES:
            return self._action_apply_fixes()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_discover(self) -> dict:
        """Discover all package manifests in the repository."""
        self.manifests = []

        manifest_patterns = {
            "python": ["requirements.txt", "requirements*.txt", "pyproject.toml", "setup.py", "Pipfile"],
            "node": ["package.json", "package-lock.json", "yarn.lock"],
            "go": ["go.mod", "go.sum"],
            "rust": ["Cargo.toml", "Cargo.lock"],
        }

        for pkg_type, patterns in manifest_patterns.items():
            for pattern in patterns:
                for path in self.root_dir.rglob(pattern):
                    # Skip node_modules and virtual environments
                    if any(skip in str(path) for skip in ["node_modules", "venv", ".venv", "__pycache__", ".git"]):
                        continue

                    self.manifests.append(PackageManifest(
                        path=path,
                        type=pkg_type,
                    ))

        # Deduplicate by path
        seen_paths = set()
        unique_manifests = []
        for m in self.manifests:
            if str(m.path) not in seen_paths:
                seen_paths.add(str(m.path))
                unique_manifests.append(m)
        self.manifests = unique_manifests

        # Group by type
        by_type = {}
        for m in self.manifests:
            by_type.setdefault(m.type, []).append(str(m.path))

        return {
            "success": True,
            "total_manifests": len(self.manifests),
            "by_type": by_type,
        }

    def _action_scan_python(self) -> dict:
        """Scan Python dependencies for CVEs using pip-audit or safety."""
        python_manifests = [m for m in self.manifests if m.type == "python"]

        if not python_manifests:
            return {"success": True, "vulnerabilities": 0, "message": "No Python manifests found"}

        vulnerabilities_found = 0

        for manifest in python_manifests:
            # Skip pyproject.toml and setup.py for direct scanning
            if manifest.path.name in ["pyproject.toml", "setup.py", "Pipfile"]:
                continue

            if self.available_tools.get("pip-audit"):
                vulns = self._run_pip_audit(manifest.path)
                self.vulnerabilities.extend(vulns)
                vulnerabilities_found += len(vulns)
            elif self.available_tools.get("safety"):
                vulns = self._run_safety(manifest.path)
                self.vulnerabilities.extend(vulns)
                vulnerabilities_found += len(vulns)
            else:
                self.log("No Python vulnerability scanner available (pip-audit or safety)", "WARN")
                return {"success": False, "error": "No Python scanner available"}

        return {"success": True, "vulnerabilities": vulnerabilities_found}

    def _run_pip_audit(self, requirements_path: Path) -> list[Vulnerability]:
        """Run pip-audit on a requirements file."""
        vulnerabilities = []

        try:
            cmd = [sys.executable, "-m", "pip_audit", "-r", str(requirements_path), "--format", "json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

            if result.returncode == 0:
                # No vulnerabilities
                return []

            # Parse JSON output
            try:
                data = json.loads(result.stdout)
                for dep in data.get("dependencies", []):
                    for vuln in dep.get("vulns", []):
                        vulnerabilities.append(Vulnerability(
                            package=dep.get("name", "unknown"),
                            version=dep.get("version", "unknown"),
                            severity=Severity.from_string(vuln.get("fix_versions", ["unknown"])[0] if vuln.get("fix_versions") else "unknown"),
                            cve_id=vuln.get("id", "unknown"),
                            description=vuln.get("description", ""),
                            fixed_version=vuln.get("fix_versions", [None])[0] if vuln.get("fix_versions") else None,
                            source="pip-audit",
                        ))
            except json.JSONDecodeError:
                # Try parsing the text output
                self.log(f"pip-audit returned non-JSON output for {requirements_path}", "WARN")

        except subprocess.TimeoutExpired:
            self.log(f"pip-audit timed out for {requirements_path}", "WARN")
        except Exception as e:
            self.log(f"pip-audit error: {e}", "ERROR")

        return vulnerabilities

    def _run_safety(self, requirements_path: Path) -> list[Vulnerability]:
        """Run safety check on a requirements file."""
        vulnerabilities = []

        try:
            cmd = ["safety", "check", "-r", str(requirements_path), "--json"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

            try:
                data = json.loads(result.stdout)
                for vuln in data.get("vulnerabilities", []):
                    vulnerabilities.append(Vulnerability(
                        package=vuln.get("package_name", "unknown"),
                        version=vuln.get("analyzed_version", "unknown"),
                        severity=Severity.from_string(vuln.get("severity", "unknown")),
                        cve_id=vuln.get("vulnerability_id", "unknown"),
                        description=vuln.get("advisory", ""),
                        fixed_version=vuln.get("more_info_url"),
                        source="safety",
                    ))
            except json.JSONDecodeError:
                pass

        except subprocess.TimeoutExpired:
            self.log(f"safety timed out for {requirements_path}", "WARN")
        except Exception as e:
            self.log(f"safety error: {e}", "ERROR")

        return vulnerabilities

    def _action_scan_node(self) -> dict:
        """Scan Node.js dependencies for CVEs using npm audit."""
        node_manifests = [m for m in self.manifests if m.type == "node" and m.path.name == "package.json"]

        if not node_manifests:
            return {"success": True, "vulnerabilities": 0, "message": "No Node.js manifests found"}

        if not self.available_tools.get("npm"):
            return {"success": False, "error": "npm not available"}

        vulnerabilities_found = 0

        for manifest in node_manifests:
            vulns = self._run_npm_audit(manifest.path.parent)
            self.vulnerabilities.extend(vulns)
            vulnerabilities_found += len(vulns)

        return {"success": True, "vulnerabilities": vulnerabilities_found}

    def _run_npm_audit(self, package_dir: Path) -> list[Vulnerability]:
        """Run npm audit in a directory."""
        vulnerabilities = []

        try:
            cmd = ["npm", "audit", "--json"]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=package_dir,
            )

            try:
                data = json.loads(result.stdout)
                advisories = data.get("vulnerabilities", {})

                for pkg_name, advisory in advisories.items():
                    severity_str = advisory.get("severity", "unknown")
                    vulnerabilities.append(Vulnerability(
                        package=pkg_name,
                        version=advisory.get("range", "unknown"),
                        severity=Severity.from_string(severity_str),
                        cve_id=advisory.get("via", [{}])[0].get("cve", "unknown") if isinstance(advisory.get("via", [{}])[0], dict) else "unknown",
                        description=advisory.get("via", [{}])[0].get("title", "") if isinstance(advisory.get("via", [{}])[0], dict) else str(advisory.get("via", "")),
                        fixed_version=advisory.get("fixAvailable", {}).get("version") if isinstance(advisory.get("fixAvailable"), dict) else None,
                        source="npm-audit",
                    ))
            except json.JSONDecodeError:
                pass

        except subprocess.TimeoutExpired:
            self.log(f"npm audit timed out for {package_dir}", "WARN")
        except Exception as e:
            self.log(f"npm audit error: {e}", "ERROR")

        return vulnerabilities

    def _action_scan_go(self) -> dict:
        """Scan Go dependencies for CVEs using govulncheck."""
        go_manifests = [m for m in self.manifests if m.type == "go" and m.path.name == "go.mod"]

        if not go_manifests:
            return {"success": True, "vulnerabilities": 0, "message": "No Go manifests found"}

        if not self.available_tools.get("govulncheck"):
            self.log("govulncheck not available, skipping Go scan", "WARN")
            return {"success": True, "vulnerabilities": 0, "message": "govulncheck not available"}

        vulnerabilities_found = 0

        for manifest in go_manifests:
            vulns = self._run_govulncheck(manifest.path.parent)
            self.vulnerabilities.extend(vulns)
            vulnerabilities_found += len(vulns)

        return {"success": True, "vulnerabilities": vulnerabilities_found}

    def _run_govulncheck(self, go_dir: Path) -> list[Vulnerability]:
        """Run govulncheck in a Go module directory."""
        vulnerabilities = []

        try:
            cmd = ["govulncheck", "-json", "./..."]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
                cwd=go_dir,
            )

            # Parse NDJSON output
            for line in result.stdout.splitlines():
                try:
                    data = json.loads(line)
                    if "osv" in data:
                        osv = data["osv"]
                        # Extract severity from CVSS if available
                        severity = Severity.UNKNOWN
                        cvss_score = None
                        for severity_entry in osv.get("severity", []):
                            if severity_entry.get("type") == "CVSS_V3":
                                score_str = severity_entry.get("score", "")
                                match = re.search(r"CVSS:3\.[01]/.*?/(\d+\.\d+)", score_str)
                                if match:
                                    cvss_score = float(match.group(1))
                                    severity = Severity.from_cvss(cvss_score)

                        vulnerabilities.append(Vulnerability(
                            package=osv.get("id", "unknown"),
                            version="",
                            severity=severity,
                            cve_id=osv.get("aliases", ["unknown"])[0] if osv.get("aliases") else osv.get("id", "unknown"),
                            description=osv.get("summary", ""),
                            cvss_score=cvss_score,
                            source="govulncheck",
                        ))
                except json.JSONDecodeError:
                    continue

        except subprocess.TimeoutExpired:
            self.log(f"govulncheck timed out for {go_dir}", "WARN")
        except Exception as e:
            self.log(f"govulncheck error: {e}", "ERROR")

        return vulnerabilities

    def _action_scan_rust(self) -> dict:
        """Scan Rust dependencies for CVEs using cargo-audit."""
        rust_manifests = [m for m in self.manifests if m.type == "rust" and m.path.name == "Cargo.toml"]

        if not rust_manifests:
            return {"success": True, "vulnerabilities": 0, "message": "No Rust manifests found"}

        if not self.available_tools.get("cargo-audit"):
            self.log("cargo-audit not available, skipping Rust scan", "WARN")
            return {"success": True, "vulnerabilities": 0, "message": "cargo-audit not available"}

        vulnerabilities_found = 0

        for manifest in rust_manifests:
            vulns = self._run_cargo_audit(manifest.path.parent)
            self.vulnerabilities.extend(vulns)
            vulnerabilities_found += len(vulns)

        return {"success": True, "vulnerabilities": vulnerabilities_found}

    def _run_cargo_audit(self, cargo_dir: Path) -> list[Vulnerability]:
        """Run cargo-audit in a Rust project directory."""
        vulnerabilities = []

        try:
            cmd = ["cargo", "audit", "--json"]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=cargo_dir,
            )

            try:
                data = json.loads(result.stdout)
                for vuln in data.get("vulnerabilities", {}).get("list", []):
                    advisory = vuln.get("advisory", {})
                    vulnerabilities.append(Vulnerability(
                        package=advisory.get("package", "unknown"),
                        version=vuln.get("package", {}).get("version", "unknown"),
                        severity=Severity.from_string(advisory.get("severity", "unknown")),
                        cve_id=advisory.get("id", "unknown"),
                        description=advisory.get("title", ""),
                        fixed_version=advisory.get("patched_versions", [None])[0] if advisory.get("patched_versions") else None,
                        source="cargo-audit",
                    ))
            except json.JSONDecodeError:
                pass

        except subprocess.TimeoutExpired:
            self.log(f"cargo-audit timed out for {cargo_dir}", "WARN")
        except Exception as e:
            self.log(f"cargo-audit error: {e}", "ERROR")

        return vulnerabilities

    def _action_scan_trivy(self) -> dict:
        """Run Trivy for comprehensive vulnerability scanning."""
        if not self.available_tools.get("trivy"):
            return {"success": False, "error": "Trivy not available"}

        vulnerabilities_found = 0

        try:
            cmd = ["trivy", "fs", "--format", "json", "--scanners", "vuln", str(self.root_dir)]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            try:
                data = json.loads(result.stdout)
                for result_item in data.get("Results", []):
                    for vuln in result_item.get("Vulnerabilities", []):
                        severity = Severity.from_string(vuln.get("Severity", "unknown"))
                        cvss_score = None

                        # Extract CVSS score
                        if "CVSS" in vuln:
                            for source, cvss in vuln["CVSS"].items():
                                if "V3Score" in cvss:
                                    cvss_score = cvss["V3Score"]
                                    severity = Severity.from_cvss(cvss_score)
                                    break

                        self.vulnerabilities.append(Vulnerability(
                            package=vuln.get("PkgName", "unknown"),
                            version=vuln.get("InstalledVersion", "unknown"),
                            severity=severity,
                            cve_id=vuln.get("VulnerabilityID", "unknown"),
                            description=vuln.get("Title", ""),
                            fixed_version=vuln.get("FixedVersion"),
                            cvss_score=cvss_score,
                            source="trivy",
                        ))
                        vulnerabilities_found += 1

            except json.JSONDecodeError:
                self.log("Trivy returned non-JSON output", "WARN")

        except subprocess.TimeoutExpired:
            self.log("Trivy scan timed out", "WARN")
        except Exception as e:
            self.log(f"Trivy error: {e}", "ERROR")

        return {"success": True, "vulnerabilities": vulnerabilities_found}

    def _action_prioritize(self) -> dict:
        """Prioritize vulnerabilities by severity."""
        # Deduplicate by CVE ID
        seen_cves = set()
        unique_vulns = []
        for v in self.vulnerabilities:
            if v.cve_id not in seen_cves:
                seen_cves.add(v.cve_id)
                unique_vulns.append(v)
        self.vulnerabilities = unique_vulns

        # Sort by severity (CRITICAL first)
        severity_order = {
            Severity.CRITICAL: 0,
            Severity.HIGH: 1,
            Severity.MEDIUM: 2,
            Severity.LOW: 3,
            Severity.UNKNOWN: 4,
        }
        self.vulnerabilities.sort(key=lambda v: severity_order.get(v.severity, 5))

        # Count by severity
        by_severity = {s.value: 0 for s in Severity}
        for v in self.vulnerabilities:
            by_severity[v.severity.value] += 1

        return {
            "success": True,
            "total": len(self.vulnerabilities),
            "by_severity": by_severity,
        }

    def _action_suggest_upgrades(self) -> dict:
        """Suggest safe upgrade paths for vulnerable packages."""
        self.upgrade_suggestions = []

        for vuln in self.vulnerabilities:
            if vuln.fixed_version:
                self.upgrade_suggestions.append({
                    "package": vuln.package,
                    "current_version": vuln.version,
                    "suggested_version": vuln.fixed_version,
                    "severity": vuln.severity.value,
                    "cve": vuln.cve_id,
                    "source": vuln.source,
                })

        return {
            "success": True,
            "suggestions": len(self.upgrade_suggestions),
        }

    def _action_apply_fixes(self) -> dict:
        """Apply safe automatic fixes (only when auto_fix is enabled)."""
        if not self.auto_fix:
            return {"success": True, "applied": 0, "message": "Auto-fix disabled"}

        applied = 0

        # Only apply npm audit fix for Node.js (safest option)
        if self.available_tools.get("npm"):
            for manifest in self.manifests:
                if manifest.type == "node" and manifest.path.name == "package.json":
                    try:
                        result = subprocess.run(
                            ["npm", "audit", "fix"],
                            capture_output=True,
                            text=True,
                            timeout=120,
                            cwd=manifest.path.parent,
                        )
                        if result.returncode == 0:
                            applied += 1
                            self.log(f"Applied npm audit fix in {manifest.path.parent}", "INFO")
                    except Exception as e:
                        self.log(f"Failed to apply npm fix: {e}", "WARN")

        return {"success": True, "applied": applied}

    def _action_report(self) -> dict:
        """Generate comprehensive vulnerability report."""
        # Count by severity
        by_severity = {s.value: 0 for s in Severity}
        for v in self.vulnerabilities:
            by_severity[v.severity.value] += 1

        # Check compliance
        threshold_met = True
        failing_vulns = []
        for v in self.vulnerabilities:
            if v.severity >= self.severity_threshold:
                threshold_met = False
                failing_vulns.append({
                    "package": v.package,
                    "cve": v.cve_id,
                    "severity": v.severity.value,
                })

        # Generate report
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_dependencies": sum(len(m.packages) for m in self.manifests) or len(self.manifests),
            "manifests_scanned": len(self.manifests),
            "vulnerabilities_found": {
                "total": len(self.vulnerabilities),
                "by_severity": by_severity,
            },
            "outdated_packages": len(self.outdated_packages),
            "recommended_upgrades": [
                {
                    "package": s["package"],
                    "from": s["current_version"],
                    "to": s["suggested_version"],
                    "severity": s["severity"],
                }
                for s in self.upgrade_suggestions
            ],
            "compliance_status": {
                "threshold": self.severity_threshold.value,
                "passed": threshold_met,
                "failing_vulnerabilities": failing_vulns[:10],  # Limit to 10
            },
            "tools_used": [tool for tool, available in self.available_tools.items() if available],
        }

        return {
            "success": True,
            "report": report,
        }

    # ==================== REFLECTION ====================

    def reflect(self, plan: Plan) -> Reflection:
        """
        REFLECT PHASE: Analyze execution results and determine next steps.

        This is the key differentiator for Level 3 - the ability to
        evaluate success and decide whether to adapt the plan.
        """
        self.state = AgentState.REFLECTING
        self.log("Reflecting on execution results")

        reflection = Reflection(success=True)

        # Analyze each action's results
        for action in plan.actions:
            if not action.success:
                reflection.success = False
                reflection.issues.append(f"{action.type.value}: {action.error}")

            if action.result:
                # Check for specific issues
                if action.type == ActionType.DISCOVER:
                    if action.result.get("total_manifests", 0) == 0:
                        reflection.issues.append("No package manifests found")

                if action.type == ActionType.REPORT:
                    report = action.result.get("report", {})
                    compliance = report.get("compliance_status", {})
                    if not compliance.get("passed", True):
                        reflection.success = False
                        failing = compliance.get("failing_vulnerabilities", [])
                        reflection.issues.append(
                            f"Compliance failed: {len(failing)} vulnerabilities at or above {self.severity_threshold.value}"
                        )

        # Check if we need additional scanning
        if plan.iteration == 1 and len(self.vulnerabilities) > 0:
            # If we found vulnerabilities, consider re-scanning with different tools
            if self.available_tools.get("trivy") and ActionType.SCAN_TRIVY not in [a.type for a in plan.actions]:
                reflection.suggestions.append("Consider using Trivy for comprehensive scan")
                reflection.new_actions.append(
                    Action(ActionType.SCAN_TRIVY, "Run comprehensive Trivy scan")
                )
                reflection.should_retry = True

        # Determine if we should retry
        if reflection.issues and plan.iteration < self.MAX_ITERATIONS:
            reflection.should_retry = True

        self.log(f"Reflection: success={reflection.success}, retry={reflection.should_retry}")
        return reflection

    # ==================== ADAPTATION ====================

    def adapt(self, plan: Plan, reflection: Reflection) -> Plan:
        """
        ADAPT PHASE: Modify plan based on reflection.

        Creates a new plan iteration with adjusted actions.
        """
        self.state = AgentState.ADAPTING
        self.log(f"Adapting plan (iteration {plan.iteration} -> {plan.iteration + 1})")

        new_plan = Plan(
            intent=plan.intent,
            iteration=plan.iteration + 1
        )

        # Add new actions from reflection
        if reflection.new_actions:
            new_plan.actions.extend(reflection.new_actions)

        # Re-prioritize and regenerate report
        new_plan.actions.append(Action(ActionType.PRIORITIZE, "Re-prioritize vulnerabilities"))
        new_plan.actions.append(Action(ActionType.SUGGEST_UPGRADES, "Update upgrade suggestions"))
        new_plan.actions.append(Action(ActionType.REPORT, "Regenerate report"))

        self.log(f"Adapted plan with {len(new_plan.actions)} actions")
        return new_plan

    # ==================== GOVERNANCE ====================

    def check_governance(self, plan: Plan) -> GovernanceCheck:
        """
        GOVERNANCE: Safety and compliance checks.

        Ensures the agent operates within defined constraints.
        """
        check = GovernanceCheck(passed=True)

        # Check iteration limit
        if plan.iteration > self.MAX_ITERATIONS:
            check.passed = False
            check.violations.append(f"Exceeded max iterations ({self.MAX_ITERATIONS})")

        # Check for risky actions
        for action in plan.actions:
            if action.type == ActionType.APPLY_FIXES:
                check.warnings.append("APPLY_FIXES will modify package files")

        # Validate all actions are known
        for action in plan.actions:
            if action.type not in ActionType:
                check.passed = False
                check.violations.append(f"Unknown action type: {action.type}")

        return check

    # ==================== MAIN LOOP ====================

    def run(self, intent: str) -> dict:
        """
        Main autonomous execution loop.

        PLAN -> EXECUTE -> REFLECT -> ADAPT (repeat until success or max iterations)
        """
        self.log(f"Starting Level 3 Dependency Audit agent with intent: {intent}")
        start_time = time.time()

        # Create initial plan
        plan = self.plan(intent)

        while True:
            # Governance check
            governance = self.check_governance(plan)
            if not governance.passed:
                self.state = AgentState.FAILED
                self.log(f"Governance violation: {governance.violations}", "ERROR")
                return {
                    "success": False,
                    "error": "Governance violation",
                    "violations": governance.violations
                }

            if governance.warnings:
                for warning in governance.warnings:
                    self.log(f"Governance warning: {warning}", "WARN")

            # Execute plan
            plan = self.execute(plan)

            # Reflect on results
            reflection = self.reflect(plan)

            # Check if we should continue
            if reflection.success or not reflection.should_retry:
                break

            if plan.iteration >= self.MAX_ITERATIONS:
                self.log(f"Max iterations ({self.MAX_ITERATIONS}) reached", "WARN")
                break

            # Adapt plan and continue
            plan = self.adapt(plan, reflection)

        # Final state
        self.state = AgentState.COMPLETED if reflection.success else AgentState.FAILED
        duration = time.time() - start_time

        # Get final report
        final_report = self._action_report()

        result = {
            "success": reflection.success,
            "iterations": plan.iteration,
            "duration_seconds": round(duration, 2),
            "final_state": self.state.value,
            "report": final_report.get("report", {}),
            "issues": reflection.issues,
            "execution_log_entries": len(self.execution_log)
        }

        self.log(f"Agent completed: success={result['success']}, iterations={result['iterations']}")
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Dependency Audit Agent - Autonomous CVE Scanner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="audit all dependencies for CVEs",
        help="The intent/goal for the agent to achieve"
    )
    parser.add_argument(
        "--severity", "-s",
        type=str,
        choices=["critical", "high", "medium", "low"],
        default="high",
        help="Minimum severity threshold to fail on (default: high)"
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Enable automatic fixes where safe"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress verbose output"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        help="Save report to file"
    )

    args = parser.parse_args()

    # Parse severity threshold
    severity_map = {
        "critical": Severity.CRITICAL,
        "high": Severity.HIGH,
        "medium": Severity.MEDIUM,
        "low": Severity.LOW,
    }
    severity_threshold = severity_map.get(args.severity, Severity.HIGH)

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / ".git").is_dir() or (root / "scripts").is_dir():
            break
        root = root.parent

    agent = Level3DependencyAuditAgent(
        root,
        verbose=not args.quiet,
        severity_threshold=severity_threshold,
        auto_fix=args.fix,
    )
    result = agent.run(args.intent)

    # Output
    if args.json:
        output = json.dumps(result, indent=2, default=str)
        print(output)
        if args.output:
            Path(args.output).write_text(output)
    elif args.output:
        Path(args.output).write_text(json.dumps(result, indent=2, default=str))
        print(f"Report saved to {args.output}")
    else:
        print(f"\n{'='*60}")
        print("Level 3 Dependency Audit Agent - Execution Complete")
        print(f"{'='*60}")
        print(f"Intent:      {args.intent}")
        print(f"Success:     {result['success']}")
        print(f"Iterations:  {result['iterations']}")
        print(f"Duration:    {result['duration_seconds']}s")

        report = result.get("report", {})
        print(f"\nScan Summary:")
        print(f"  Manifests scanned: {report.get('manifests_scanned', 0)}")
        print(f"  Tools used: {', '.join(report.get('tools_used', []))}")

        vulns = report.get("vulnerabilities_found", {})
        print(f"\nVulnerabilities Found: {vulns.get('total', 0)}")
        by_sev = vulns.get("by_severity", {})
        for sev in ["critical", "high", "medium", "low"]:
            count = by_sev.get(sev, 0)
            if count > 0:
                print(f"  {sev.upper()}: {count}")

        compliance = report.get("compliance_status", {})
        status = "PASSED" if compliance.get("passed", True) else "FAILED"
        print(f"\nCompliance Status: {status}")
        print(f"  Threshold: {compliance.get('threshold', 'high').upper()} and above")

        if not compliance.get("passed", True):
            failing = compliance.get("failing_vulnerabilities", [])
            if failing:
                print(f"\nFailing Vulnerabilities ({len(failing)}):")
                for v in failing[:5]:
                    print(f"  - {v['package']}: {v['cve']} ({v['severity'].upper()})")
                if len(failing) > 5:
                    print(f"  ... and {len(failing) - 5} more")

        upgrades = report.get("recommended_upgrades", [])
        if upgrades:
            print(f"\nRecommended Upgrades ({len(upgrades)}):")
            for u in upgrades[:5]:
                print(f"  - {u['package']}: {u['from']} -> {u['to']}")
            if len(upgrades) > 5:
                print(f"  ... and {len(upgrades) - 5} more")

        if result.get("issues"):
            print(f"\nIssues:")
            for issue in result["issues"]:
                print(f"  - {issue}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
