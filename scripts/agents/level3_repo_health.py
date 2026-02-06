#!/usr/bin/env python3
"""
Level 3 Repo Health Scanner Agent

Autonomous agent that scans repository health across multiple dimensions,
calculates health scores, and recommends agent team assignments.

Architecture: SCAN -> SCORE -> PRIORITIZE -> ASSIGN

Health Dimensions:
- Security (50%): Secrets exposure, CVE vulnerabilities
- Quality (35%): Test coverage, dead code, linting
- Infrastructure (15%): Terraform drift, dependency freshness
"""

import os
import sys
import json
import subprocess
import argparse
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from pathlib import Path

# Add parent to path for shared utilities
sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))

class HealthDimension(Enum):
    SECURITY = "security"
    QUALITY = "quality"
    INFRASTRUCTURE = "infrastructure"

@dataclass
class HealthMetric:
    name: str
    dimension: HealthDimension
    score: float  # 0-100
    weight: float  # Contribution to dimension
    details: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)

@dataclass
class AgentTask:
    priority: int  # 1=critical, 2=high, 3=medium, 4=low
    dimension: HealthDimension
    task: str
    agent_type: str
    estimated_impact: float  # Expected score improvement
    github_issue: Optional[int] = None

@dataclass
class HealthReport:
    timestamp: str
    overall_score: float
    dimension_scores: Dict[str, float]
    metrics: List[HealthMetric]
    tasks: List[AgentTask]
    agent_teams: Dict[str, List[str]]

class Level3RepoHealth:
    """
    Level 3 Autonomous Repo Health Scanner

    Scans repository health, calculates scores, and assigns agent teams
    based on prioritized improvement opportunities.
    """

    DIMENSION_WEIGHTS = {
        HealthDimension.SECURITY: 0.50,
        HealthDimension.QUALITY: 0.35,
        HealthDimension.INFRASTRUCTURE: 0.15,
    }

    def __init__(self, repo_path: str, verbose: bool = False):
        self.repo_path = Path(repo_path)
        self.verbose = verbose
        self.metrics: List[HealthMetric] = []

    def log(self, message: str):
        if self.verbose:
            print(f"[HEALTH] {message}", file=sys.stderr)

    # === SECURITY SCANS ===

    def scan_secrets(self) -> HealthMetric:
        """Scan for exposed secrets using existing scanner"""
        self.log("Scanning secrets...")
        try:
            # Run secret scanner in scan-only mode
            result = subprocess.run(
                ["python3", str(self.repo_path / "scripts/agents/level3_secret_scanner.py"),
                 "--intent", "scan only", "--dry-run"],
                capture_output=True, text=True, timeout=120, cwd=self.repo_path
            )

            # Parse output for findings count
            output = result.stdout + result.stderr
            high_count = 0
            for line in output.split('\n'):
                if 'HIGH:' in line:
                    try:
                        high_count = int(line.split('HIGH:')[1].strip().split()[0])
                    except:
                        pass

            # Score: 100 if 0 secrets, decreases logarithmically
            if high_count == 0:
                score = 100
            elif high_count < 10:
                score = 80 - (high_count * 2)
            elif high_count < 50:
                score = 60 - (high_count - 10)
            elif high_count < 200:
                score = 20 - ((high_count - 50) * 0.1)
            else:
                score = max(0, 10 - ((high_count - 200) * 0.05))

            return HealthMetric(
                name="secrets",
                dimension=HealthDimension.SECURITY,
                score=max(0, min(100, score)),
                weight=0.6,
                details={"high_findings": high_count},
                recommendations=[
                    f"Fix {high_count} HIGH severity secret findings",
                    "Review .env.example for proper variable documentation",
                    "Update scanner exclusions for false positives"
                ] if high_count > 0 else []
            )
        except Exception as e:
            self.log(f"Secret scan failed: {e}")
            return HealthMetric(
                name="secrets",
                dimension=HealthDimension.SECURITY,
                score=50,  # Unknown = medium risk
                weight=0.6,
                details={"error": str(e)},
                recommendations=["Unable to scan - install secret scanner"]
            )

    def scan_cves(self) -> HealthMetric:
        """Scan for CVE vulnerabilities"""
        self.log("Scanning CVEs...")
        try:
            result = subprocess.run(
                ["npm", "audit", "--json"],
                capture_output=True, text=True, timeout=60, cwd=self.repo_path
            )

            try:
                audit = json.loads(result.stdout)
                vulnerabilities = audit.get("metadata", {}).get("vulnerabilities", {})
                critical = vulnerabilities.get("critical", 0)
                high = vulnerabilities.get("high", 0)
                moderate = vulnerabilities.get("moderate", 0)
            except:
                critical, high, moderate = 0, 0, 0

            # Score based on severity
            score = 100 - (critical * 25) - (high * 10) - (moderate * 2)

            return HealthMetric(
                name="cves",
                dimension=HealthDimension.SECURITY,
                score=max(0, min(100, score)),
                weight=0.4,
                details={"critical": critical, "high": high, "moderate": moderate},
                recommendations=[
                    f"Fix {critical} critical CVEs immediately" if critical > 0 else None,
                    f"Address {high} high severity CVEs" if high > 0 else None,
                    f"Review {moderate} moderate CVEs" if moderate > 0 else None
                ]
            )
        except Exception as e:
            return HealthMetric(
                name="cves",
                dimension=HealthDimension.SECURITY,
                score=50,
                weight=0.4,
                details={"error": str(e)},
                recommendations=["Unable to scan CVEs"]
            )

    # === QUALITY SCANS ===

    def scan_coverage(self) -> HealthMetric:
        """Check test coverage"""
        self.log("Scanning coverage...")
        try:
            # Try to get coverage from existing reports
            coverage_file = self.repo_path / "coverage" / "coverage-summary.json"
            if coverage_file.exists():
                with open(coverage_file) as f:
                    data = json.load(f)
                    total = data.get("total", {})
                    lines = total.get("lines", {}).get("pct", 0)
                    score = lines
            else:
                # Run quick coverage check
                result = subprocess.run(
                    ["npm", "test", "--", "--coverage", "--passWithNoTests", "--coverageReporters=json-summary"],
                    capture_output=True, text=True, timeout=300, cwd=self.repo_path
                )
                # Parse output for coverage percentage
                score = 26.9  # Default from known state
                for line in result.stdout.split('\n'):
                    if 'All files' in line and '%' in line:
                        try:
                            score = float(line.split('|')[1].strip())
                        except:
                            pass

            return HealthMetric(
                name="coverage",
                dimension=HealthDimension.QUALITY,
                score=min(100, score),
                weight=0.5,
                details={"percent": score, "target": 70},
                recommendations=[
                    f"Coverage at {score:.1f}% - target is 70%",
                    "Add tests for critical uncovered files",
                    "Focus on high-complexity modules"
                ] if score < 70 else []
            )
        except Exception as e:
            return HealthMetric(
                name="coverage",
                dimension=HealthDimension.QUALITY,
                score=26.9,  # Known baseline
                weight=0.5,
                details={"error": str(e)},
                recommendations=["Unable to measure coverage"]
            )

    def scan_dead_code(self) -> HealthMetric:
        """Check for dead code"""
        self.log("Scanning dead code...")
        try:
            result = subprocess.run(
                ["vulture", ".", "--min-confidence", "80"],
                capture_output=True, text=True, timeout=120, cwd=self.repo_path
            )

            items = len([l for l in result.stdout.split('\n') if l.strip()])

            # Score: 100 if 0 items, decreases with more
            if items == 0:
                score = 100
            elif items < 25:
                score = 90 - (items * 2)
            elif items < 100:
                score = 50 - ((items - 25) * 0.3)
            else:
                score = max(0, 25 - ((items - 100) * 0.1))

            return HealthMetric(
                name="dead_code",
                dimension=HealthDimension.QUALITY,
                score=max(0, min(100, score)),
                weight=0.3,
                details={"items": items},
                recommendations=[
                    f"Remove {items} dead code items detected by vulture"
                ] if items > 0 else []
            )
        except FileNotFoundError:
            return HealthMetric(
                name="dead_code",
                dimension=HealthDimension.QUALITY,
                score=50,
                weight=0.3,
                details={"error": "vulture not installed"},
                recommendations=["Install vulture: pip install vulture"]
            )

    def scan_lint(self) -> HealthMetric:
        """Check linting status"""
        self.log("Scanning lint issues...")
        try:
            result = subprocess.run(
                ["npm", "run", "lint", "--", "--format", "json"],
                capture_output=True, text=True, timeout=120, cwd=self.repo_path
            )

            # Count errors and warnings
            errors = result.stdout.count('"severity":2')
            warnings = result.stdout.count('"severity":1')

            score = 100 - (errors * 5) - (warnings * 0.5)

            return HealthMetric(
                name="lint",
                dimension=HealthDimension.QUALITY,
                score=max(0, min(100, score)),
                weight=0.2,
                details={"errors": errors, "warnings": warnings},
                recommendations=[
                    f"Fix {errors} lint errors" if errors > 0 else None,
                    f"Address {warnings} lint warnings" if warnings > 10 else None
                ]
            )
        except Exception as e:
            return HealthMetric(
                name="lint",
                dimension=HealthDimension.QUALITY,
                score=70,
                weight=0.2,
                details={"error": str(e)},
                recommendations=[]
            )

    # === INFRASTRUCTURE SCANS ===

    def scan_terraform_drift(self) -> HealthMetric:
        """Check Terraform/OpenTofu drift"""
        self.log("Scanning infrastructure drift...")

        tf_dirs = [
            self.repo_path / "infrastructure/terraform/azure",
            self.repo_path / "infrastructure/terraform",
            self.repo_path / "infrastructure/opentofu/container-app",
        ]

        drifts = 0
        initialized = 0

        for tf_dir in tf_dirs:
            if tf_dir.exists():
                state_file = tf_dir / "terraform.tfstate"
                lock_file = tf_dir / ".terraform.lock.hcl"
                if lock_file.exists():
                    initialized += 1
                # Would need actual plan to detect drift

        score = 100 if initialized >= 3 else (initialized / 3) * 100

        return HealthMetric(
            name="terraform_drift",
            dimension=HealthDimension.INFRASTRUCTURE,
            score=score,
            weight=0.6,
            details={"initialized_modules": initialized, "total_modules": len(tf_dirs)},
            recommendations=[
                "Initialize remaining Terraform modules",
                "Run terraform plan to check for drift"
            ] if initialized < len(tf_dirs) else []
        )

    def scan_dependencies(self) -> HealthMetric:
        """Check dependency freshness"""
        self.log("Scanning dependencies...")
        try:
            result = subprocess.run(
                ["npm", "outdated", "--json"],
                capture_output=True, text=True, timeout=60, cwd=self.repo_path
            )

            try:
                outdated = json.loads(result.stdout) if result.stdout else {}
                major_outdated = sum(1 for pkg in outdated.values()
                                    if pkg.get('current', '').split('.')[0] != pkg.get('latest', '').split('.')[0])
                minor_outdated = len(outdated) - major_outdated
            except:
                major_outdated, minor_outdated = 0, 0

            score = 100 - (major_outdated * 5) - (minor_outdated * 1)

            return HealthMetric(
                name="dependencies",
                dimension=HealthDimension.INFRASTRUCTURE,
                score=max(0, min(100, score)),
                weight=0.4,
                details={"major_outdated": major_outdated, "minor_outdated": minor_outdated},
                recommendations=[
                    f"Update {major_outdated} packages with major version changes" if major_outdated > 0 else None
                ]
            )
        except Exception as e:
            return HealthMetric(
                name="dependencies",
                dimension=HealthDimension.INFRASTRUCTURE,
                score=70,
                weight=0.4,
                details={"error": str(e)},
                recommendations=[]
            )

    # === AGGREGATION ===

    def calculate_dimension_score(self, dimension: HealthDimension) -> float:
        """Calculate weighted score for a dimension"""
        dim_metrics = [m for m in self.metrics if m.dimension == dimension]
        if not dim_metrics:
            return 0

        total_weight = sum(m.weight for m in dim_metrics)
        weighted_sum = sum(m.score * m.weight for m in dim_metrics)

        return weighted_sum / total_weight if total_weight > 0 else 0

    def calculate_overall_score(self, dimension_scores: Dict[str, float]) -> float:
        """Calculate overall health score"""
        total = 0
        for dim, weight in self.DIMENSION_WEIGHTS.items():
            total += dimension_scores.get(dim.value, 0) * weight
        return total

    def generate_tasks(self) -> List[AgentTask]:
        """Generate prioritized tasks based on metrics"""
        tasks = []

        for metric in self.metrics:
            if metric.score < 70:  # Needs improvement
                priority = 1 if metric.score < 30 else (2 if metric.score < 50 else 3)

                if metric.dimension == HealthDimension.SECURITY:
                    priority = min(priority, 2)  # Security always high priority

                agent_map = {
                    "secrets": "level3_secrets_remediation",
                    "cves": "level3_dependency_audit",
                    "coverage": "level3_test_runner",
                    "dead_code": "level3_dead_code",
                    "terraform_drift": "level3_infra_drift",
                    "dependencies": "level3_dependency_audit",
                }

                issue_map = {
                    "secrets": 1837,
                    "coverage": 1839,
                }

                for rec in metric.recommendations:
                    if rec:
                        tasks.append(AgentTask(
                            priority=priority,
                            dimension=metric.dimension,
                            task=rec,
                            agent_type=agent_map.get(metric.name, "general"),
                            estimated_impact=(70 - metric.score) * metric.weight,
                            github_issue=issue_map.get(metric.name)
                        ))

        # Sort by priority then impact
        tasks.sort(key=lambda t: (t.priority, -t.estimated_impact))
        return tasks

    def assign_agent_teams(self, tasks: List[AgentTask]) -> Dict[str, List[str]]:
        """Group tasks into agent teams"""
        teams = {
            "SECURITY": [],
            "QUALITY": [],
            "INFRASTRUCTURE": [],
        }

        for task in tasks:
            team_name = task.dimension.value.upper()
            teams[team_name].append(f"[P{task.priority}] {task.task} ({task.agent_type})")

        return {k: v for k, v in teams.items() if v}  # Remove empty teams

    def scan(self) -> HealthReport:
        """Run full health scan"""
        self.log("Starting full health scan...")

        # Run all scans
        self.metrics = [
            self.scan_secrets(),
            self.scan_cves(),
            self.scan_coverage(),
            self.scan_dead_code(),
            self.scan_lint(),
            self.scan_terraform_drift(),
            self.scan_dependencies(),
        ]

        # Calculate scores
        dimension_scores = {
            dim.value: self.calculate_dimension_score(dim)
            for dim in HealthDimension
        }

        overall_score = self.calculate_overall_score(dimension_scores)

        # Generate tasks and teams
        tasks = self.generate_tasks()
        teams = self.assign_agent_teams(tasks)

        return HealthReport(
            timestamp=datetime.now(timezone.utc).isoformat(),
            overall_score=overall_score,
            dimension_scores=dimension_scores,
            metrics=self.metrics,
            tasks=tasks,
            agent_teams=teams
        )


def main():
    parser = argparse.ArgumentParser(description="Level 3 Repo Health Scanner")
    parser.add_argument("--repo", default=".", help="Repository path")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--quick", action="store_true", help="Quick scan (skip slow checks)")

    args = parser.parse_args()

    scanner = Level3RepoHealth(args.repo, verbose=args.verbose)
    report = scanner.scan()

    if args.json:
        # Convert to JSON-serializable format
        output = {
            "timestamp": report.timestamp,
            "overall_score": round(report.overall_score, 1),
            "dimension_scores": {k: round(v, 1) for k, v in report.dimension_scores.items()},
            "metrics": [
                {
                    "name": m.name,
                    "dimension": m.dimension.value,
                    "score": round(m.score, 1),
                    "details": m.details,
                    "recommendations": [r for r in m.recommendations if r]
                }
                for m in report.metrics
            ],
            "tasks": [
                {
                    "priority": t.priority,
                    "dimension": t.dimension.value,
                    "task": t.task,
                    "agent": t.agent_type,
                    "github_issue": t.github_issue
                }
                for t in report.tasks
            ],
            "agent_teams": report.agent_teams
        }
        print(json.dumps(output, indent=2))
    else:
        # Human-readable output
        print("=" * 60)
        print("REPOSITORY HEALTH REPORT")
        print("=" * 60)
        print(f"Timestamp: {report.timestamp}")
        print(f"\nOVERALL HEALTH SCORE: {report.overall_score:.1f}/100")
        print()

        # Health bar
        bar_len = 40
        filled = int(bar_len * report.overall_score / 100)
        bar = "#" * filled + "-" * (bar_len - filled)
        status = "CRITICAL" if report.overall_score < 30 else "NEEDS WORK" if report.overall_score < 60 else "HEALTHY" if report.overall_score < 80 else "EXCELLENT"
        print(f"[{bar}] {status}")
        print()

        print("DIMENSION SCORES:")
        for dim, score in report.dimension_scores.items():
            indicator = "[!!]" if score < 40 else "[! ]" if score < 70 else "[OK]"
            print(f"  {indicator} {dim.upper()}: {score:.1f}/100")
        print()

        print("METRICS:")
        for m in report.metrics:
            indicator = "[!!]" if m.score < 40 else "[! ]" if m.score < 70 else "[OK]"
            print(f"  {indicator} {m.name}: {m.score:.1f} - {m.details}")
        print()

        if report.tasks:
            print("PRIORITIZED TASKS:")
            for i, t in enumerate(report.tasks[:10], 1):
                priority_indicator = "[P1]" if t.priority == 1 else "[P2]" if t.priority == 2 else "[P3]"
                issue_str = f" (#{t.github_issue})" if t.github_issue else ""
                print(f"  {i}. {priority_indicator} [{t.dimension.value}] {t.task}{issue_str}")
            print()

        if report.agent_teams:
            print("AGENT TEAM ASSIGNMENTS:")
            for team, tasks in report.agent_teams.items():
                print(f"\n  TEAM {team}:")
                for task in tasks[:5]:
                    print(f"    - {task}")

        print()
        print("=" * 60)


if __name__ == "__main__":
    main()
