#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Infrastructure Drift Detection Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system exhibiting constrained autonomy for detecting infrastructure drift:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and compliance monitoring

Drift Categories:
- Config Drift: Resource exists but config changed
- Resource Drift: Extra resources in cloud not in code
- Missing Resources: Resources in code but not in cloud
- State Drift: State file out of sync

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    python scripts/agents/level3_infra_drift.py "detect infrastructure drift"
    python scripts/agents/level3_infra_drift.py --terraform-only
    python scripts/agents/level3_infra_drift.py --k8s-only
    python scripts/agents/level3_infra_drift.py --cluster tundra-dome
    python scripts/agents/level3_infra_drift.py --auto-apply  # Apply remediation (dangerous)
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

# Datadog Unified Service Tagging (self-instrumented)
try:
    from ddtrace import config, patch_all, tracer
    config.service = os.environ.get("DD_SERVICE", "level3-infra-drift-agent")
    config.env = os.environ.get("DD_ENV", "development")
    config.version = os.environ.get("DD_VERSION", "1.0.0")
    tracer.set_tags({
        "team": "platform",
        "component": "autonomous-agent",
        "agent_level": "3",
        "agent_type": "infrastructure-drift",
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
    """Available agent actions for drift detection."""
    DISCOVER = "discover"
    TERRAFORM_PLAN = "terraform_plan"
    K8S_DIFF = "k8s_diff"
    ANALYZE_DRIFT = "analyze_drift"
    ASSESS_RISK = "assess_risk"
    SUGGEST_REMEDIATION = "suggest_remediation"
    REPORT = "report"


class DriftCategory(Enum):
    """Categories of infrastructure drift."""
    CONFIG_DRIFT = "config_drift"          # Resource exists but config changed
    RESOURCE_DRIFT = "resource_drift"      # Extra resources in cloud not in code
    MISSING_RESOURCES = "missing_resources"  # Resources in code but not in cloud
    STATE_DRIFT = "state_drift"            # State file out of sync


class RiskLevel(Enum):
    """Risk assessment levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class DriftItem:
    """A single drift detection item."""
    category: DriftCategory
    resource_type: str
    resource_name: str
    source: str  # terraform, opentofu, k8s
    module_path: str
    description: str
    risk_level: RiskLevel = RiskLevel.LOW
    remediation: str = ""
    changes: dict = field(default_factory=dict)


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
            self.created_at = datetime.now(timezone.utc).isoformat()


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


class Level3InfraDriftAgent:
    """
    Level 3 Autonomous Agent for Infrastructure Drift Detection.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 3
    DRIFT_THRESHOLD = 0  # Any drift is flagged
    AUTO_APPLY = False   # Safety default

    # Target directories for infrastructure
    TERRAFORM_DIRS = [
        "infrastructure/terraform/azure/",
        "infrastructure/terraform/aks/",
    ]
    OPENTOFU_DIRS = [
        "infrastructure/opentofu/container-app/",
        "infrastructure/opentofu/vercel-style-deployment/",
    ]
    K8S_DIRS = [
        "platforms/kubernetes/k8s/",
        "platforms/kubernetes/helm/",
    ]

    def __init__(
        self,
        root_dir: Path,
        verbose: bool = True,
        terraform_only: bool = False,
        k8s_only: bool = False,
        cluster: str = "tundra-dome",
        auto_apply: bool = False
    ):
        self.root_dir = root_dir
        self.verbose = verbose
        self.terraform_only = terraform_only
        self.k8s_only = k8s_only
        self.cluster = cluster
        self.auto_apply = auto_apply and self.AUTO_APPLY  # Double-check safety
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []
        self.drift_items: list[DriftItem] = []

        # Validate directories exist
        self._validate_directories()

    def _validate_directories(self):
        """Validate that target directories exist."""
        self.valid_terraform_dirs = []
        self.valid_opentofu_dirs = []
        self.valid_k8s_dirs = []

        for d in self.TERRAFORM_DIRS:
            path = self.root_dir / d
            if path.exists():
                self.valid_terraform_dirs.append(path)

        for d in self.OPENTOFU_DIRS:
            path = self.root_dir / d
            if path.exists():
                self.valid_opentofu_dirs.append(path)

        for d in self.K8S_DIRS:
            path = self.root_dir / d
            if path.exists():
                self.valid_k8s_dirs.append(path)

    def log(self, message: str, level: str = "INFO"):
        """Log with tracing."""
        timestamp = datetime.now(timezone.utc).isoformat()
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

        # Determine scope based on flags and intent
        include_terraform = not self.k8s_only
        include_k8s = not self.terraform_only

        if any(word in intent_lower for word in ["terraform", "tofu", "opentofu", "tf"]):
            include_k8s = False
        if any(word in intent_lower for word in ["kubernetes", "k8s", "helm", "manifest"]):
            include_terraform = False

        # Build action sequence
        plan.actions.append(
            Action(ActionType.DISCOVER, "Discover all infrastructure manifests",
                   {"terraform": include_terraform, "k8s": include_k8s})
        )

        if include_terraform:
            plan.actions.append(
                Action(ActionType.TERRAFORM_PLAN, "Run terraform/tofu plan to detect drift")
            )

        if include_k8s:
            plan.actions.append(
                Action(ActionType.K8S_DIFF, "Compare K8s manifests to live cluster state",
                       {"cluster": self.cluster})
            )

        plan.actions.extend([
            Action(ActionType.ANALYZE_DRIFT, "Categorize detected drift"),
            Action(ActionType.ASSESS_RISK, "Determine impact and risk level"),
            Action(ActionType.SUGGEST_REMEDIATION, "Recommend fixes"),
            Action(ActionType.REPORT, "Generate drift report"),
        ])

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
            return self._action_discover(action.params)

        elif action.type == ActionType.TERRAFORM_PLAN:
            return self._action_terraform_plan()

        elif action.type == ActionType.K8S_DIFF:
            return self._action_k8s_diff(action.params)

        elif action.type == ActionType.ANALYZE_DRIFT:
            return self._action_analyze_drift()

        elif action.type == ActionType.ASSESS_RISK:
            return self._action_assess_risk()

        elif action.type == ActionType.SUGGEST_REMEDIATION:
            return self._action_suggest_remediation()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_discover(self, params: dict) -> dict:
        """Discover all Terraform/OpenTofu and K8s manifests."""
        discovered = {
            "terraform_modules": [],
            "opentofu_modules": [],
            "k8s_manifests": [],
            "helm_charts": [],
        }

        include_terraform = params.get("terraform", True)
        include_k8s = params.get("k8s", True)

        if include_terraform:
            # Discover Terraform modules
            for tf_dir in self.valid_terraform_dirs:
                tf_files = list(tf_dir.rglob("*.tf"))
                if tf_files:
                    discovered["terraform_modules"].append({
                        "path": str(tf_dir.relative_to(self.root_dir)),
                        "files": len(tf_files),
                        "has_state": (tf_dir / "terraform.tfstate").exists() or
                                     (tf_dir / ".terraform").exists(),
                    })

            # Discover OpenTofu modules
            for tofu_dir in self.valid_opentofu_dirs:
                tf_files = list(tofu_dir.rglob("*.tf"))
                if tf_files:
                    discovered["opentofu_modules"].append({
                        "path": str(tofu_dir.relative_to(self.root_dir)),
                        "files": len(tf_files),
                        "has_state": (tofu_dir / "terraform.tfstate").exists() or
                                     (tofu_dir / ".terraform").exists(),
                    })

        if include_k8s:
            # Discover K8s manifests
            for k8s_dir in self.valid_k8s_dirs:
                if "helm" in str(k8s_dir):
                    # Helm charts
                    for chart_yaml in k8s_dir.rglob("Chart.yaml"):
                        chart_dir = chart_yaml.parent
                        templates = list((chart_dir / "templates").rglob("*.yaml")) if (chart_dir / "templates").exists() else []
                        discovered["helm_charts"].append({
                            "path": str(chart_dir.relative_to(self.root_dir)),
                            "name": chart_dir.name,
                            "templates": len(templates),
                        })
                else:
                    # Raw K8s manifests
                    yaml_files = list(k8s_dir.rglob("*.yaml"))
                    if yaml_files:
                        discovered["k8s_manifests"].append({
                            "path": str(k8s_dir.relative_to(self.root_dir)),
                            "files": len(yaml_files),
                        })

        total = (len(discovered["terraform_modules"]) +
                 len(discovered["opentofu_modules"]) +
                 len(discovered["k8s_manifests"]) +
                 len(discovered["helm_charts"]))

        self.log(f"Discovered {total} infrastructure components")
        return {"success": True, "discovered": discovered}

    def _action_terraform_plan(self) -> dict:
        """Run terraform/tofu plan to detect drift."""
        drift_detected = []
        modules_checked = 0
        errors = []

        # Check Terraform modules
        for tf_dir in self.valid_terraform_dirs:
            modules_checked += 1
            drift = self._run_terraform_plan(tf_dir, "terraform")
            if drift:
                drift_detected.extend(drift)

        # Check OpenTofu modules
        for tofu_dir in self.valid_opentofu_dirs:
            modules_checked += 1
            drift = self._run_terraform_plan(tofu_dir, "tofu")
            if drift:
                drift_detected.extend(drift)

        return {
            "success": True,
            "modules_checked": modules_checked,
            "drift_count": len(drift_detected),
            "drift": drift_detected,
            "errors": errors,
        }

    def _run_terraform_plan(self, module_dir: Path, tool: str = "terraform") -> list[dict]:
        """Run terraform/tofu plan for a single module."""
        drift_items = []

        # Check if initialized
        if not (module_dir / ".terraform").exists():
            self.log(f"Module {module_dir.name} not initialized, skipping plan", "WARN")
            # Create synthetic drift item for uninitialized module
            self.drift_items.append(DriftItem(
                category=DriftCategory.STATE_DRIFT,
                resource_type="module",
                resource_name=module_dir.name,
                source=tool,
                module_path=str(module_dir.relative_to(self.root_dir)),
                description="Module not initialized (no .terraform directory)",
                risk_level=RiskLevel.MEDIUM,
            ))
            return [{"type": "uninitialized", "module": str(module_dir)}]

        # Check for terraform binary
        binary = tool if tool == "terraform" else "tofu"
        result = subprocess.run(
            ["which", binary],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            self.log(f"{binary} not found in PATH, simulating plan", "WARN")
            return self._simulate_terraform_plan(module_dir, tool)

        # Run actual plan
        try:
            result = subprocess.run(
                [binary, "plan", "-detailed-exitcode", "-no-color"],
                capture_output=True, text=True, cwd=module_dir,
                timeout=300  # 5 minute timeout
            )

            # Exit codes: 0=no changes, 1=error, 2=changes detected
            if result.returncode == 2:
                drift_items = self._parse_terraform_plan_output(result.stdout, module_dir, tool)
            elif result.returncode == 1:
                self.log(f"Terraform plan error in {module_dir.name}: {result.stderr[:200]}", "ERROR")

        except subprocess.TimeoutExpired:
            self.log(f"Terraform plan timeout in {module_dir.name}", "ERROR")
        except Exception as e:
            self.log(f"Error running {binary} plan: {e}", "ERROR")

        return drift_items

    def _simulate_terraform_plan(self, module_dir: Path, tool: str) -> list[dict]:
        """Simulate terraform plan by analyzing .tf files for potential drift indicators."""
        drift_items = []

        # Read all .tf files and look for resources
        for tf_file in module_dir.glob("*.tf"):
            content = tf_file.read_text()

            # Find resource blocks
            resource_pattern = r'resource\s+"([^"]+)"\s+"([^"]+)"'
            for match in re.finditer(resource_pattern, content):
                resource_type = match.group(1)
                resource_name = match.group(2)

                # Check for common drift indicators
                if any(indicator in content for indicator in ["depends_on", "lifecycle", "provisioner"]):
                    drift_items.append({
                        "type": "potential_drift",
                        "resource_type": resource_type,
                        "resource_name": resource_name,
                        "file": tf_file.name,
                    })

                    self.drift_items.append(DriftItem(
                        category=DriftCategory.CONFIG_DRIFT,
                        resource_type=resource_type,
                        resource_name=resource_name,
                        source=tool,
                        module_path=str(module_dir.relative_to(self.root_dir)),
                        description=f"Potential drift detected (simulated) - resource has complex dependencies",
                        risk_level=RiskLevel.LOW,
                    ))

        return drift_items

    def _parse_terraform_plan_output(self, output: str, module_dir: Path, tool: str) -> list[dict]:
        """Parse terraform plan output to extract drift details."""
        drift_items = []

        # Pattern for resource changes
        # Examples: "# azurerm_resource_group.main will be updated in-place"
        change_pattern = r'#\s+(\S+)\.(\S+)\s+will be\s+(.+)'

        for match in re.finditer(change_pattern, output):
            resource_type = match.group(1)
            resource_name = match.group(2)
            change_action = match.group(3)

            # Determine category
            if "created" in change_action:
                category = DriftCategory.MISSING_RESOURCES
            elif "destroyed" in change_action:
                category = DriftCategory.RESOURCE_DRIFT
            else:
                category = DriftCategory.CONFIG_DRIFT

            drift_items.append({
                "resource_type": resource_type,
                "resource_name": resource_name,
                "action": change_action,
            })

            self.drift_items.append(DriftItem(
                category=category,
                resource_type=resource_type,
                resource_name=resource_name,
                source=tool,
                module_path=str(module_dir.relative_to(self.root_dir)),
                description=f"Resource {change_action}",
                risk_level=self._determine_risk_from_action(change_action, resource_type),
            ))

        return drift_items

    def _determine_risk_from_action(self, action: str, resource_type: str) -> RiskLevel:
        """Determine risk level based on action and resource type."""
        # Critical resources
        critical_resources = [
            "azurerm_kubernetes_cluster",
            "azurerm_postgresql_server",
            "aws_rds_cluster",
            "google_container_cluster",
        ]

        if any(res in resource_type for res in critical_resources):
            if "destroyed" in action or "replaced" in action:
                return RiskLevel.CRITICAL
            return RiskLevel.HIGH

        if "destroyed" in action:
            return RiskLevel.HIGH
        if "replaced" in action:
            return RiskLevel.MEDIUM

        return RiskLevel.LOW

    def _action_k8s_diff(self, params: dict) -> dict:
        """Compare K8s manifests to live cluster state."""
        drift_detected = []
        manifests_checked = 0
        cluster = params.get("cluster", self.cluster)

        # Check if kubectl is available
        result = subprocess.run(["which", "kubectl"], capture_output=True, text=True)
        has_kubectl = result.returncode == 0

        if not has_kubectl:
            self.log("kubectl not found, simulating K8s diff", "WARN")
            return self._simulate_k8s_diff()

        # Check cluster connectivity
        result = subprocess.run(
            ["kubectl", "cluster-info"],
            capture_output=True, text=True
        )
        cluster_connected = result.returncode == 0

        if not cluster_connected:
            self.log(f"Cannot connect to cluster {cluster}, simulating diff", "WARN")
            return self._simulate_k8s_diff()

        # Process each K8s manifest directory
        for k8s_dir in self.valid_k8s_dirs:
            if "helm" in str(k8s_dir):
                continue  # Handle helm separately

            for yaml_file in k8s_dir.rglob("*.yaml"):
                manifests_checked += 1
                drift = self._diff_k8s_manifest(yaml_file)
                if drift:
                    drift_detected.extend(drift)

        return {
            "success": True,
            "cluster": cluster,
            "manifests_checked": manifests_checked,
            "drift_count": len(drift_detected),
            "drift": drift_detected,
        }

    def _diff_k8s_manifest(self, manifest_path: Path) -> list[dict]:
        """Diff a single K8s manifest against live cluster."""
        drift_items = []

        try:
            result = subprocess.run(
                ["kubectl", "diff", "-f", str(manifest_path)],
                capture_output=True, text=True,
                timeout=30
            )

            # Exit code 0 = no diff, 1 = diff found, >1 = error
            if result.returncode == 1:
                drift_items.append({
                    "manifest": str(manifest_path.relative_to(self.root_dir)),
                    "diff": result.stdout[:500],  # Truncate
                })

                # Parse manifest for resource info
                resource_info = self._parse_k8s_manifest(manifest_path)
                if resource_info:
                    self.drift_items.append(DriftItem(
                        category=DriftCategory.CONFIG_DRIFT,
                        resource_type=resource_info.get("kind", "Unknown"),
                        resource_name=resource_info.get("name", manifest_path.stem),
                        source="kubernetes",
                        module_path=str(manifest_path.parent.relative_to(self.root_dir)),
                        description="Configuration differs from live cluster",
                        risk_level=RiskLevel.MEDIUM,
                        changes={"diff_preview": result.stdout[:200]},
                    ))

        except subprocess.TimeoutExpired:
            self.log(f"kubectl diff timeout for {manifest_path.name}", "WARN")
        except Exception as e:
            self.log(f"Error diffing {manifest_path.name}: {e}", "ERROR")

        return drift_items

    def _simulate_k8s_diff(self) -> dict:
        """Simulate K8s diff by analyzing manifests."""
        manifests_checked = 0
        drift_detected = []

        for k8s_dir in self.valid_k8s_dirs:
            if "helm" in str(k8s_dir):
                continue

            for yaml_file in k8s_dir.rglob("*.yaml"):
                manifests_checked += 1
                resource_info = self._parse_k8s_manifest(yaml_file)

                if resource_info:
                    # Simulate potential drift for Deployments and StatefulSets
                    if resource_info.get("kind") in ["Deployment", "StatefulSet", "DaemonSet"]:
                        drift_detected.append({
                            "manifest": str(yaml_file.relative_to(self.root_dir)),
                            "kind": resource_info.get("kind"),
                            "name": resource_info.get("name"),
                            "simulated": True,
                        })

        return {
            "success": True,
            "cluster": self.cluster,
            "manifests_checked": manifests_checked,
            "drift_count": 0,  # Simulated, no actual drift
            "drift": [],
            "simulated": True,
        }

    def _parse_k8s_manifest(self, manifest_path: Path) -> Optional[dict]:
        """Parse a K8s manifest to extract resource info."""
        try:
            import yaml
        except ImportError:
            # Fallback to regex parsing
            return self._parse_k8s_manifest_regex(manifest_path)

        try:
            content = manifest_path.read_text()
            docs = list(yaml.safe_load_all(content))
            if docs and docs[0]:
                return {
                    "kind": docs[0].get("kind"),
                    "name": docs[0].get("metadata", {}).get("name"),
                    "namespace": docs[0].get("metadata", {}).get("namespace"),
                }
        except Exception:
            return self._parse_k8s_manifest_regex(manifest_path)

        return None

    def _parse_k8s_manifest_regex(self, manifest_path: Path) -> Optional[dict]:
        """Parse K8s manifest using regex (fallback)."""
        try:
            content = manifest_path.read_text()
            kind_match = re.search(r'^kind:\s*(\S+)', content, re.MULTILINE)
            name_match = re.search(r'^\s+name:\s*(\S+)', content, re.MULTILINE)

            if kind_match:
                return {
                    "kind": kind_match.group(1),
                    "name": name_match.group(1) if name_match else manifest_path.stem,
                }
        except Exception:
            pass

        return None

    def _action_analyze_drift(self) -> dict:
        """Categorize and summarize detected drift."""
        by_category = {cat.value: [] for cat in DriftCategory}
        by_source = {"terraform": [], "tofu": [], "kubernetes": []}
        by_risk = {risk.value: [] for risk in RiskLevel}

        for item in self.drift_items:
            by_category[item.category.value].append({
                "resource": f"{item.resource_type}.{item.resource_name}",
                "source": item.source,
                "description": item.description,
            })

            if item.source in by_source:
                by_source[item.source].append(item.resource_name)

            by_risk[item.risk_level.value].append(item.resource_name)

        return {
            "success": True,
            "total_drift_items": len(self.drift_items),
            "by_category": {k: len(v) for k, v in by_category.items()},
            "by_source": {k: len(v) for k, v in by_source.items()},
            "by_risk": {k: len(v) for k, v in by_risk.items()},
            "categories": by_category,
        }

    def _action_assess_risk(self) -> dict:
        """Determine overall impact and risk level of drift."""
        if not self.drift_items:
            return {
                "success": True,
                "overall_risk": RiskLevel.LOW.value,
                "critical_count": 0,
                "high_count": 0,
                "requires_immediate_attention": False,
            }

        risk_counts = {risk: 0 for risk in RiskLevel}
        for item in self.drift_items:
            risk_counts[item.risk_level] += 1

        # Determine overall risk
        if risk_counts[RiskLevel.CRITICAL] > 0:
            overall_risk = RiskLevel.CRITICAL
            requires_attention = True
        elif risk_counts[RiskLevel.HIGH] > 0:
            overall_risk = RiskLevel.HIGH
            requires_attention = True
        elif risk_counts[RiskLevel.MEDIUM] > 0:
            overall_risk = RiskLevel.MEDIUM
            requires_attention = False
        else:
            overall_risk = RiskLevel.LOW
            requires_attention = False

        return {
            "success": True,
            "overall_risk": overall_risk.value,
            "critical_count": risk_counts[RiskLevel.CRITICAL],
            "high_count": risk_counts[RiskLevel.HIGH],
            "medium_count": risk_counts[RiskLevel.MEDIUM],
            "low_count": risk_counts[RiskLevel.LOW],
            "requires_immediate_attention": requires_attention,
        }

    def _action_suggest_remediation(self) -> dict:
        """Recommend fixes for detected drift."""
        remediations = []

        for item in self.drift_items:
            remediation = {
                "resource": f"{item.resource_type}.{item.resource_name}",
                "category": item.category.value,
                "risk": item.risk_level.value,
                "actions": [],
            }

            if item.category == DriftCategory.CONFIG_DRIFT:
                if item.source in ["terraform", "tofu"]:
                    remediation["actions"] = [
                        f"Review changes: {item.source} plan -target={item.resource_type}.{item.resource_name}",
                        f"Apply changes: {item.source} apply -target={item.resource_type}.{item.resource_name}",
                        "Or update code to match current state and import",
                    ]
                else:
                    remediation["actions"] = [
                        f"Review diff: kubectl diff -f {item.module_path}",
                        f"Apply changes: kubectl apply -f {item.module_path}",
                    ]

            elif item.category == DriftCategory.RESOURCE_DRIFT:
                remediation["actions"] = [
                    "Option 1: Import resource into code",
                    f"Option 2: Delete orphaned resource from cloud",
                    "Review resource dependencies before action",
                ]

            elif item.category == DriftCategory.MISSING_RESOURCES:
                remediation["actions"] = [
                    "Review if resource should be created",
                    f"Apply: {item.source} apply",
                    "Or remove from code if no longer needed",
                ]

            elif item.category == DriftCategory.STATE_DRIFT:
                remediation["actions"] = [
                    f"Initialize: {item.source} init",
                    "Verify backend configuration",
                    "Consider state refresh or migration",
                ]

            item.remediation = "; ".join(remediation["actions"])
            remediations.append(remediation)

        return {
            "success": True,
            "remediation_count": len(remediations),
            "remediations": remediations,
        }

    def _action_report(self) -> dict:
        """Generate comprehensive drift report."""
        # Gather all results
        analysis = self._action_analyze_drift()
        risk_assessment = self._action_assess_risk()

        # Count infrastructure components
        tf_modules = len(self.valid_terraform_dirs)
        tofu_modules = len(self.valid_opentofu_dirs)
        k8s_dirs = len([d for d in self.valid_k8s_dirs if "helm" not in str(d)])
        helm_charts = len([d for d in self.valid_k8s_dirs if "helm" in str(d)])

        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent_version": "1.0.0",
            "cluster": self.cluster,
            "terraform_modules_checked": tf_modules,
            "opentofu_modules_checked": tofu_modules,
            "k8s_manifests_checked": k8s_dirs,
            "helm_charts_checked": helm_charts,
            "total_drift_items": len(self.drift_items),
            "drift_detected": analysis["by_category"],
            "risk_assessment": {
                "overall_risk": risk_assessment["overall_risk"],
                "critical": risk_assessment.get("critical_count", 0),
                "high": risk_assessment.get("high_count", 0),
                "medium": risk_assessment.get("medium_count", 0),
                "low": risk_assessment.get("low_count", 0),
            },
            "remediation_steps": [
                {
                    "resource": item.resource_name,
                    "type": item.resource_type,
                    "category": item.category.value,
                    "risk": item.risk_level.value,
                    "remediation": item.remediation,
                }
                for item in self.drift_items
            ],
            "estimated_changes": {
                "creates": analysis["by_category"].get("missing_resources", 0),
                "updates": analysis["by_category"].get("config_drift", 0),
                "deletes": analysis["by_category"].get("resource_drift", 0),
            },
        }

        return {"success": True, "report": report}

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
                # Check for specific issues requiring adaptation
                if action.type == ActionType.TERRAFORM_PLAN:
                    if action.result.get("errors"):
                        reflection.issues.extend(action.result["errors"])
                        reflection.should_retry = True
                        reflection.suggestions.append("Re-run with different configuration")

                if action.type == ActionType.K8S_DIFF:
                    if action.result.get("drift_count", 0) > 0 and not action.result.get("simulated"):
                        reflection.suggestions.append("Review K8s drift and apply changes")

                if action.type == ActionType.ASSESS_RISK:
                    if action.result.get("requires_immediate_attention"):
                        reflection.issues.append("Critical or high-risk drift detected!")
                        reflection.suggestions.append("Immediate review required")

        # Determine if drift was found
        if self.drift_items:
            if len(self.drift_items) > self.DRIFT_THRESHOLD:
                reflection.issues.append(f"Drift detected: {len(self.drift_items)} items")

        self.log(f"Reflection: success={reflection.success}, issues={len(reflection.issues)}")
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

        # Re-run analysis and reporting
        new_plan.actions.extend([
            Action(ActionType.ANALYZE_DRIFT, "Re-analyze drift after adaptation"),
            Action(ActionType.ASSESS_RISK, "Re-assess risk"),
            Action(ActionType.REPORT, "Generate updated report"),
        ])

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

        # Warn about auto-apply
        if self.auto_apply:
            check.warnings.append("AUTO_APPLY is enabled - changes may be applied automatically!")

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
        self.log(f"Starting Level 3 Infrastructure Drift Agent with intent: {intent}")
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
            "suggestions": reflection.suggestions,
            "execution_log_entries": len(self.execution_log)
        }

        self.log(f"Agent completed: success={result['success']}, iterations={result['iterations']}")
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Infrastructure Drift Detection Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="detect infrastructure drift",
        help="The intent/goal for the agent to achieve"
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
        "--terraform-only",
        action="store_true",
        help="Only check Terraform/OpenTofu infrastructure"
    )
    parser.add_argument(
        "--k8s-only",
        action="store_true",
        help="Only check Kubernetes manifests"
    )
    parser.add_argument(
        "--cluster",
        default="tundra-dome",
        help="Kubernetes cluster to check (default: tundra-dome)"
    )
    parser.add_argument(
        "--auto-apply",
        action="store_true",
        help="Automatically apply remediations (DANGEROUS - disabled by default)"
    )

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / "scripts").is_dir() and (root / "infrastructure").is_dir():
            break
        root = root.parent

    agent = Level3InfraDriftAgent(
        root,
        verbose=not args.quiet,
        terraform_only=args.terraform_only,
        k8s_only=args.k8s_only,
        cluster=args.cluster,
        auto_apply=args.auto_apply,
    )
    result = agent.run(args.intent)

    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        print(f"\n{'='*70}")
        print("Level 3 Infrastructure Drift Detection Agent - Execution Complete")
        print(f"{'='*70}")
        print(f"Intent:      {args.intent}")
        print(f"Cluster:     {args.cluster}")
        print(f"Success:     {result['success']}")
        print(f"Iterations:  {result['iterations']}")
        print(f"Duration:    {result['duration_seconds']}s")

        report = result.get("report", {})
        print(f"\nInfrastructure Checked:")
        print(f"  Terraform modules:  {report.get('terraform_modules_checked', 0)}")
        print(f"  OpenTofu modules:   {report.get('opentofu_modules_checked', 0)}")
        print(f"  K8s manifests:      {report.get('k8s_manifests_checked', 0)}")
        print(f"  Helm charts:        {report.get('helm_charts_checked', 0)}")

        print(f"\nDrift Detected:")
        drift = report.get("drift_detected", {})
        print(f"  Config drift:       {drift.get('config_drift', 0)}")
        print(f"  Resource drift:     {drift.get('resource_drift', 0)}")
        print(f"  Missing resources:  {drift.get('missing_resources', 0)}")
        print(f"  State drift:        {drift.get('state_drift', 0)}")

        risk = report.get("risk_assessment", {})
        print(f"\nRisk Assessment:")
        print(f"  Overall Risk:       {risk.get('overall_risk', 'N/A')}")
        print(f"  Critical:           {risk.get('critical', 0)}")
        print(f"  High:               {risk.get('high', 0)}")
        print(f"  Medium:             {risk.get('medium', 0)}")
        print(f"  Low:                {risk.get('low', 0)}")

        if report.get("remediation_steps"):
            print(f"\nRemediation Steps ({len(report['remediation_steps'])} items):")
            for i, step in enumerate(report["remediation_steps"][:5], 1):
                print(f"  {i}. [{step['risk']}] {step['type']}.{step['resource']}")
                print(f"     Category: {step['category']}")
                if step.get('remediation'):
                    print(f"     Actions: {step['remediation'][:80]}...")
            if len(report["remediation_steps"]) > 5:
                print(f"  ... and {len(report['remediation_steps']) - 5} more")

        if result.get("issues"):
            print(f"\nIssues:")
            for issue in result["issues"]:
                print(f"  - {issue}")

        if result.get("suggestions"):
            print(f"\nSuggestions:")
            for suggestion in result["suggestions"]:
                print(f"  - {suggestion}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
