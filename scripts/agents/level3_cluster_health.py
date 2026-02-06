#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Kubernetes Cluster Health Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system exhibiting constrained autonomy:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and compliance monitoring

Monitors cluster health across multiple Kubernetes clusters:
- tundra-dome (local KIND)
- gastown (remote)
- vibecode-local (local)
- studio-tundra-dome (remote)
- minim4-tundra (remote)

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    python scripts/agents/level3_cluster_health.py "check all cluster health"
    python scripts/agents/level3_cluster_health.py --cluster tundra-dome
    python scripts/agents/level3_cluster_health.py --remediate  # Enable auto-remediation
"""

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

# Datadog Unified Service Tagging (self-instrumented)
try:
    from ddtrace import config, patch_all, tracer
    config.service = os.environ.get("DD_SERVICE", "level3-cluster-health-agent")
    config.env = os.environ.get("DD_ENV", "development")
    config.version = os.environ.get("DD_VERSION", "1.0.0")
    tracer.set_tags({
        "team": "platform",
        "component": "autonomous-agent",
        "agent_level": "3",
    })
    patch_all()
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    tracer = None


# ==================== CONFIGURATION ====================

# Target clusters to monitor
TARGET_CLUSTERS = [
    {"name": "tundra-dome", "type": "local", "context": "kind-tundra-dome"},
    {"name": "gastown", "type": "remote", "context": "gastown"},
    {"name": "vibecode-local", "type": "local", "context": "vibecode-local"},
    {"name": "studio-tundra-dome", "type": "remote", "context": "studio-tundra-dome"},
    {"name": "minim4-tundra", "type": "remote", "context": "minim4-tundra"},
]

# Agent configuration
MAX_ITERATIONS = 5
HEALTH_THRESHOLD = 95.0  # Minimum percentage of healthy pods
REMEDIATION_ENABLED = False  # Disabled by default (governance)


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
    CHECK_CONTEXTS = "check_contexts"
    CHECK_PODS = "check_pods"
    CHECK_DEPLOYMENTS = "check_deployments"
    CHECK_RESOURCES = "check_resources"
    CHECK_DATADOG = "check_datadog"
    CHECK_SERVICES = "check_services"
    REMEDIATE = "remediate"
    REPORT = "report"


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


@dataclass
class ClusterHealth:
    """Health status for a single cluster."""
    cluster_name: str
    context_exists: bool = False
    total_pods: int = 0
    healthy_pods: int = 0
    unhealthy_pods: int = 0
    pods_pending: int = 0
    pods_failed: int = 0
    pods_crashloop: int = 0
    deployments_total: int = 0
    deployments_healthy: int = 0
    deployments_unhealthy: int = 0
    nodes_total: int = 0
    nodes_ready: int = 0
    datadog_agent_status: str = "unknown"
    services_total: int = 0
    services_with_endpoints: int = 0
    cpu_usage_percent: float = 0.0
    memory_usage_percent: float = 0.0
    issues_found: list[str] = field(default_factory=list)
    remediation_taken: list[str] = field(default_factory=list)
    reachable: bool = False
    error: Optional[str] = None

    @property
    def health_percent(self) -> float:
        """Calculate overall health percentage based on pods."""
        if self.total_pods == 0:
            return 100.0
        return (self.healthy_pods / self.total_pods) * 100

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON output."""
        return {
            "cluster_name": self.cluster_name,
            "context_exists": self.context_exists,
            "reachable": self.reachable,
            "total_pods": self.total_pods,
            "healthy_pods": self.healthy_pods,
            "unhealthy_pods": self.unhealthy_pods,
            "pods_pending": self.pods_pending,
            "pods_failed": self.pods_failed,
            "pods_crashloop": self.pods_crashloop,
            "health_percent": round(self.health_percent, 2),
            "deployments_total": self.deployments_total,
            "deployments_healthy": self.deployments_healthy,
            "deployments_unhealthy": self.deployments_unhealthy,
            "nodes_total": self.nodes_total,
            "nodes_ready": self.nodes_ready,
            "datadog_agent_status": self.datadog_agent_status,
            "services_total": self.services_total,
            "services_with_endpoints": self.services_with_endpoints,
            "cpu_usage_percent": round(self.cpu_usage_percent, 2),
            "memory_usage_percent": round(self.memory_usage_percent, 2),
            "issues_found": self.issues_found,
            "remediation_taken": self.remediation_taken,
            "error": self.error,
        }


class Level3ClusterHealthAgent:
    """
    Level 3 Autonomous Agent for Kubernetes Cluster Health Monitoring.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance

    This is the first level exhibiting constrained autonomy.
    """

    def __init__(
        self,
        verbose: bool = True,
        clusters: Optional[list[str]] = None,
        remediation_enabled: bool = REMEDIATION_ENABLED,
    ):
        self.verbose = verbose
        self.remediation_enabled = remediation_enabled
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []

        # Filter clusters if specific ones requested
        if clusters:
            self.target_clusters = [
                c for c in TARGET_CLUSTERS if c["name"] in clusters
            ]
        else:
            self.target_clusters = TARGET_CLUSTERS

        # Store cluster health data
        self.cluster_health: dict[str, ClusterHealth] = {}
        for cluster in self.target_clusters:
            self.cluster_health[cluster["name"]] = ClusterHealth(
                cluster_name=cluster["name"]
            )

    def log(self, message: str, level: str = "INFO"):
        """Log with tracing."""
        timestamp = datetime.utcnow().isoformat()
        entry = {
            "timestamp": timestamp,
            "level": level,
            "message": message,
            "state": self.state.value,
        }
        self.execution_log.append(entry)

        if self.verbose:
            print(f"[{level}] [{self.state.value}] {message}")

        if DDTRACE_AVAILABLE and tracer:
            span = tracer.current_span()
            if span:
                span.set_tag(f"agent.log.{len(self.execution_log)}", message[:100])

    def _run_kubectl(
        self, args: list[str], context: str, timeout: int = 30
    ) -> tuple[bool, str, str]:
        """Run kubectl command with specified context."""
        cmd = ["kubectl", "--context", context] + args
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return result.returncode == 0, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return False, "", f"Command timed out after {timeout}s"
        except FileNotFoundError:
            return False, "", "kubectl not found"
        except Exception as e:
            return False, "", str(e)

    def _get_contexts(self) -> list[str]:
        """Get available kubectl contexts."""
        try:
            result = subprocess.run(
                ["kubectl", "config", "get-contexts", "-o", "name"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                return result.stdout.strip().split("\n")
            return []
        except Exception:
            return []

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

        if any(word in intent_lower for word in ["check", "health", "status", "monitor", "all"]):
            # Full health check intent
            plan.actions = [
                Action(ActionType.CHECK_CONTEXTS, "Verify kubectl contexts exist"),
                Action(ActionType.CHECK_PODS, "Check pod status across clusters"),
                Action(ActionType.CHECK_DEPLOYMENTS, "Verify deployment health"),
                Action(ActionType.CHECK_RESOURCES, "Check resource utilization"),
                Action(ActionType.CHECK_DATADOG, "Verify Datadog agent status"),
                Action(ActionType.CHECK_SERVICES, "Check service endpoints"),
                Action(ActionType.REPORT, "Generate health report"),
            ]

        elif any(word in intent_lower for word in ["pod", "pods"]):
            # Pod-focused check
            plan.actions = [
                Action(ActionType.CHECK_CONTEXTS, "Verify kubectl contexts exist"),
                Action(ActionType.CHECK_PODS, "Check pod status"),
                Action(ActionType.REPORT, "Generate pod report"),
            ]

        elif any(word in intent_lower for word in ["deploy", "deployment"]):
            # Deployment-focused check
            plan.actions = [
                Action(ActionType.CHECK_CONTEXTS, "Verify kubectl contexts exist"),
                Action(ActionType.CHECK_DEPLOYMENTS, "Check deployment status"),
                Action(ActionType.REPORT, "Generate deployment report"),
            ]

        elif any(word in intent_lower for word in ["datadog", "monitoring"]):
            # Datadog-focused check
            plan.actions = [
                Action(ActionType.CHECK_CONTEXTS, "Verify kubectl contexts exist"),
                Action(ActionType.CHECK_DATADOG, "Check Datadog agent status"),
                Action(ActionType.REPORT, "Generate Datadog report"),
            ]

        elif any(word in intent_lower for word in ["remediate", "fix", "heal"]):
            # Remediation intent
            plan.actions = [
                Action(ActionType.CHECK_CONTEXTS, "Verify kubectl contexts exist"),
                Action(ActionType.CHECK_PODS, "Check pod status"),
                Action(ActionType.CHECK_DEPLOYMENTS, "Check deployment status"),
                Action(ActionType.REMEDIATE, "Attempt remediation of issues"),
                Action(ActionType.CHECK_PODS, "Re-check pod status after remediation"),
                Action(ActionType.REPORT, "Generate remediation report"),
            ]

        else:
            # Default: full health check
            plan.actions = [
                Action(ActionType.CHECK_CONTEXTS, "Verify kubectl contexts exist"),
                Action(ActionType.CHECK_PODS, "Check pod status"),
                Action(ActionType.CHECK_DEPLOYMENTS, "Check deployment status"),
                Action(ActionType.REPORT, "Generate report"),
            ]

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
            self.log(
                f"Action {i+1}/{len(plan.actions)}: {action.type.value} - {action.description}"
            )

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

        if action.type == ActionType.CHECK_CONTEXTS:
            return self._action_check_contexts()

        elif action.type == ActionType.CHECK_PODS:
            return self._action_check_pods()

        elif action.type == ActionType.CHECK_DEPLOYMENTS:
            return self._action_check_deployments()

        elif action.type == ActionType.CHECK_RESOURCES:
            return self._action_check_resources()

        elif action.type == ActionType.CHECK_DATADOG:
            return self._action_check_datadog()

        elif action.type == ActionType.CHECK_SERVICES:
            return self._action_check_services()

        elif action.type == ActionType.REMEDIATE:
            return self._action_remediate()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_check_contexts(self) -> dict:
        """Verify kubectl contexts exist for all target clusters."""
        available_contexts = self._get_contexts()
        results = {}
        all_exist = True

        for cluster in self.target_clusters:
            context = cluster["context"]
            exists = context in available_contexts
            results[cluster["name"]] = exists
            self.cluster_health[cluster["name"]].context_exists = exists

            if not exists:
                all_exist = False
                self.cluster_health[cluster["name"]].issues_found.append(
                    f"Context '{context}' not found"
                )

        return {
            "success": True,  # Action succeeded even if some contexts missing
            "contexts_checked": len(self.target_clusters),
            "contexts_found": sum(1 for v in results.values() if v),
            "results": results,
            "all_exist": all_exist,
        }

    def _action_check_pods(self) -> dict:
        """Check pod status across all reachable clusters."""
        total_checked = 0
        total_healthy = 0
        total_unhealthy = 0

        for cluster in self.target_clusters:
            health = self.cluster_health[cluster["name"]]

            if not health.context_exists:
                continue

            success, stdout, stderr = self._run_kubectl(
                ["get", "pods", "--all-namespaces", "-o", "json"],
                cluster["context"],
            )

            if not success:
                health.reachable = False
                health.error = stderr
                health.issues_found.append(f"Cannot reach cluster: {stderr}")
                continue

            health.reachable = True

            try:
                pods_data = json.loads(stdout)
                pods = pods_data.get("items", [])
                health.total_pods = len(pods)

                for pod in pods:
                    status = pod.get("status", {})
                    phase = status.get("phase", "Unknown")

                    # Check container statuses for CrashLoopBackOff
                    container_statuses = status.get("containerStatuses", [])
                    is_crashloop = any(
                        cs.get("state", {}).get("waiting", {}).get("reason")
                        == "CrashLoopBackOff"
                        for cs in container_statuses
                    )

                    if is_crashloop:
                        health.pods_crashloop += 1
                        health.unhealthy_pods += 1
                        pod_name = pod.get("metadata", {}).get("name", "unknown")
                        namespace = pod.get("metadata", {}).get("namespace", "unknown")
                        health.issues_found.append(
                            f"Pod {namespace}/{pod_name} in CrashLoopBackOff"
                        )
                    elif phase == "Running":
                        # Check if all containers are ready
                        all_ready = all(
                            cs.get("ready", False) for cs in container_statuses
                        ) if container_statuses else True
                        if all_ready:
                            health.healthy_pods += 1
                        else:
                            health.unhealthy_pods += 1
                    elif phase == "Pending":
                        health.pods_pending += 1
                        health.unhealthy_pods += 1
                    elif phase == "Failed":
                        health.pods_failed += 1
                        health.unhealthy_pods += 1
                        pod_name = pod.get("metadata", {}).get("name", "unknown")
                        namespace = pod.get("metadata", {}).get("namespace", "unknown")
                        health.issues_found.append(
                            f"Pod {namespace}/{pod_name} in Failed state"
                        )
                    elif phase == "Succeeded":
                        # Completed pods (Jobs) are considered healthy
                        health.healthy_pods += 1
                    else:
                        health.unhealthy_pods += 1

                total_checked += health.total_pods
                total_healthy += health.healthy_pods
                total_unhealthy += health.unhealthy_pods

            except json.JSONDecodeError as e:
                health.error = f"Failed to parse pod data: {e}"
                health.issues_found.append(health.error)

        return {
            "success": True,
            "clusters_checked": len([c for c in self.target_clusters
                                    if self.cluster_health[c["name"]].reachable]),
            "total_pods": total_checked,
            "healthy_pods": total_healthy,
            "unhealthy_pods": total_unhealthy,
        }

    def _action_check_deployments(self) -> dict:
        """Verify deployment health across clusters."""
        total_deployments = 0
        healthy_deployments = 0
        unhealthy_deployments = 0

        for cluster in self.target_clusters:
            health = self.cluster_health[cluster["name"]]

            if not health.context_exists or not health.reachable:
                continue

            success, stdout, stderr = self._run_kubectl(
                ["get", "deployments", "--all-namespaces", "-o", "json"],
                cluster["context"],
            )

            if not success:
                health.issues_found.append(f"Failed to get deployments: {stderr}")
                continue

            try:
                deploys_data = json.loads(stdout)
                deploys = deploys_data.get("items", [])
                health.deployments_total = len(deploys)

                for deploy in deploys:
                    name = deploy.get("metadata", {}).get("name", "unknown")
                    namespace = deploy.get("metadata", {}).get("namespace", "unknown")
                    status = deploy.get("status", {})

                    desired = status.get("replicas", 0)
                    ready = status.get("readyReplicas", 0)
                    available = status.get("availableReplicas", 0)

                    if ready == desired and available == desired:
                        health.deployments_healthy += 1
                    else:
                        health.deployments_unhealthy += 1
                        health.issues_found.append(
                            f"Deployment {namespace}/{name}: {ready}/{desired} ready"
                        )

                total_deployments += health.deployments_total
                healthy_deployments += health.deployments_healthy
                unhealthy_deployments += health.deployments_unhealthy

            except json.JSONDecodeError as e:
                health.issues_found.append(f"Failed to parse deployment data: {e}")

        return {
            "success": True,
            "total_deployments": total_deployments,
            "healthy": healthy_deployments,
            "unhealthy": unhealthy_deployments,
        }

    def _action_check_resources(self) -> dict:
        """Check CPU/memory usage and resource quotas."""
        for cluster in self.target_clusters:
            health = self.cluster_health[cluster["name"]]

            if not health.context_exists or not health.reachable:
                continue

            # Check nodes
            success, stdout, stderr = self._run_kubectl(
                ["get", "nodes", "-o", "json"],
                cluster["context"],
            )

            if success:
                try:
                    nodes_data = json.loads(stdout)
                    nodes = nodes_data.get("items", [])
                    health.nodes_total = len(nodes)

                    for node in nodes:
                        conditions = node.get("status", {}).get("conditions", [])
                        for condition in conditions:
                            if condition.get("type") == "Ready":
                                if condition.get("status") == "True":
                                    health.nodes_ready += 1
                                else:
                                    node_name = node.get("metadata", {}).get("name", "unknown")
                                    health.issues_found.append(
                                        f"Node {node_name} not ready"
                                    )
                except json.JSONDecodeError:
                    pass

            # Try to get resource usage via top nodes
            success, stdout, stderr = self._run_kubectl(
                ["top", "nodes", "--no-headers"],
                cluster["context"],
            )

            if success and stdout.strip():
                lines = stdout.strip().split("\n")
                total_cpu = 0.0
                total_mem = 0.0
                count = 0

                for line in lines:
                    parts = line.split()
                    if len(parts) >= 5:
                        try:
                            cpu_percent = float(parts[2].rstrip("%"))
                            mem_percent = float(parts[4].rstrip("%"))
                            total_cpu += cpu_percent
                            total_mem += mem_percent
                            count += 1
                        except (ValueError, IndexError):
                            pass

                if count > 0:
                    health.cpu_usage_percent = total_cpu / count
                    health.memory_usage_percent = total_mem / count

        return {
            "success": True,
            "clusters_checked": len([c for c in self.target_clusters
                                    if self.cluster_health[c["name"]].reachable]),
        }

    def _action_check_datadog(self) -> dict:
        """Verify Datadog agent is running in each cluster."""
        for cluster in self.target_clusters:
            health = self.cluster_health[cluster["name"]]

            if not health.context_exists or not health.reachable:
                health.datadog_agent_status = "unknown"
                continue

            # Check for Datadog agent pods
            success, stdout, stderr = self._run_kubectl(
                [
                    "get", "pods", "-n", "datadog", "-l", "app=datadog",
                    "-o", "jsonpath={.items[*].status.phase}",
                ],
                cluster["context"],
            )

            if not success:
                # Try alternative namespace/labels
                success, stdout, stderr = self._run_kubectl(
                    [
                        "get", "pods", "--all-namespaces",
                        "-l", "app.kubernetes.io/name=datadog",
                        "-o", "jsonpath={.items[*].status.phase}",
                    ],
                    cluster["context"],
                )

            if success and stdout.strip():
                phases = stdout.strip().split()
                if all(p == "Running" for p in phases):
                    health.datadog_agent_status = "running"
                elif any(p == "Running" for p in phases):
                    health.datadog_agent_status = "partial"
                    health.issues_found.append("Some Datadog agents not running")
                else:
                    health.datadog_agent_status = "not_running"
                    health.issues_found.append("Datadog agent not running")
            else:
                health.datadog_agent_status = "not_installed"
                health.issues_found.append("Datadog agent not found")

        return {
            "success": True,
            "clusters_checked": len([c for c in self.target_clusters
                                    if self.cluster_health[c["name"]].reachable]),
        }

    def _action_check_services(self) -> dict:
        """Verify services have endpoints."""
        for cluster in self.target_clusters:
            health = self.cluster_health[cluster["name"]]

            if not health.context_exists or not health.reachable:
                continue

            # Get services
            success, stdout, stderr = self._run_kubectl(
                ["get", "services", "--all-namespaces", "-o", "json"],
                cluster["context"],
            )

            if not success:
                continue

            try:
                services_data = json.loads(stdout)
                services = services_data.get("items", [])
                health.services_total = len(services)

                # Get endpoints
                success, endpoints_stdout, stderr = self._run_kubectl(
                    ["get", "endpoints", "--all-namespaces", "-o", "json"],
                    cluster["context"],
                )

                if success:
                    endpoints_data = json.loads(endpoints_stdout)
                    endpoints = endpoints_data.get("items", [])

                    # Create mapping of service -> has endpoints
                    endpoint_map = {}
                    for ep in endpoints:
                        name = ep.get("metadata", {}).get("name", "")
                        namespace = ep.get("metadata", {}).get("namespace", "")
                        subsets = ep.get("subsets", [])
                        has_addresses = any(
                            s.get("addresses") for s in subsets
                        )
                        endpoint_map[f"{namespace}/{name}"] = has_addresses

                    for svc in services:
                        name = svc.get("metadata", {}).get("name", "")
                        namespace = svc.get("metadata", {}).get("namespace", "")
                        svc_type = svc.get("spec", {}).get("type", "ClusterIP")

                        # Skip ExternalName services
                        if svc_type == "ExternalName":
                            health.services_with_endpoints += 1
                            continue

                        key = f"{namespace}/{name}"
                        if endpoint_map.get(key, False):
                            health.services_with_endpoints += 1
                        else:
                            # Only flag as issue if it's not a headless service
                            cluster_ip = svc.get("spec", {}).get("clusterIP", "")
                            if cluster_ip != "None":
                                health.issues_found.append(
                                    f"Service {key} has no endpoints"
                                )

            except json.JSONDecodeError:
                pass

        return {
            "success": True,
            "clusters_checked": len([c for c in self.target_clusters
                                    if self.cluster_health[c["name"]].reachable]),
        }

    def _action_remediate(self) -> dict:
        """Attempt remediation of common issues (with governance)."""
        if not self.remediation_enabled:
            return {
                "success": True,
                "skipped": True,
                "reason": "Remediation disabled by governance policy",
            }

        remediation_actions = []

        for cluster in self.target_clusters:
            health = self.cluster_health[cluster["name"]]

            if not health.context_exists or not health.reachable:
                continue

            # Restart pods in CrashLoopBackOff
            if health.pods_crashloop > 0:
                success, stdout, stderr = self._run_kubectl(
                    [
                        "get", "pods", "--all-namespaces",
                        "-o", "jsonpath={range .items[*]}{.metadata.namespace}/{.metadata.name} {end}",
                        "--field-selector=status.phase!=Running",
                    ],
                    cluster["context"],
                )

                if success and stdout.strip():
                    pod_refs = stdout.strip().split()
                    for ref in pod_refs[:5]:  # Limit to 5 pods per cluster
                        if "/" in ref:
                            namespace, name = ref.split("/", 1)
                            # Delete pod to trigger restart
                            del_success, _, del_err = self._run_kubectl(
                                ["delete", "pod", name, "-n", namespace],
                                cluster["context"],
                            )
                            if del_success:
                                action = f"Restarted pod {namespace}/{name} in {cluster['name']}"
                                remediation_actions.append(action)
                                health.remediation_taken.append(action)
                            else:
                                health.issues_found.append(
                                    f"Failed to restart {namespace}/{name}: {del_err}"
                                )

        return {
            "success": True,
            "actions_taken": len(remediation_actions),
            "actions": remediation_actions,
        }

    def _action_report(self) -> dict:
        """Generate comprehensive health report."""
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "clusters": {},
            "summary": {
                "total_clusters": len(self.target_clusters),
                "reachable_clusters": 0,
                "total_pods": 0,
                "healthy_pods": 0,
                "unhealthy_pods": 0,
                "health_percent": 0.0,
                "total_issues": 0,
                "clusters_meeting_threshold": 0,
            },
        }

        for cluster in self.target_clusters:
            health = self.cluster_health[cluster["name"]]
            report["clusters"][cluster["name"]] = health.to_dict()

            if health.reachable:
                report["summary"]["reachable_clusters"] += 1
                report["summary"]["total_pods"] += health.total_pods
                report["summary"]["healthy_pods"] += health.healthy_pods
                report["summary"]["unhealthy_pods"] += health.unhealthy_pods
                report["summary"]["total_issues"] += len(health.issues_found)

                if health.health_percent >= HEALTH_THRESHOLD:
                    report["summary"]["clusters_meeting_threshold"] += 1

        # Calculate overall health
        if report["summary"]["total_pods"] > 0:
            report["summary"]["health_percent"] = round(
                (report["summary"]["healthy_pods"] / report["summary"]["total_pods"]) * 100,
                2,
            )

        report["summary"]["health_threshold"] = HEALTH_THRESHOLD
        report["summary"]["threshold_met"] = (
            report["summary"]["health_percent"] >= HEALTH_THRESHOLD
        )

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
                if action.type == ActionType.CHECK_PODS:
                    unhealthy = action.result.get("unhealthy_pods", 0)
                    if unhealthy > 0:
                        reflection.issues.append(f"{unhealthy} unhealthy pods found")
                        if self.remediation_enabled:
                            reflection.should_retry = True
                            reflection.suggestions.append("Attempt pod remediation")
                            reflection.new_actions.append(
                                Action(ActionType.REMEDIATE, "Remediate unhealthy pods")
                            )

                if action.type == ActionType.CHECK_DEPLOYMENTS:
                    unhealthy = action.result.get("unhealthy", 0)
                    if unhealthy > 0:
                        reflection.issues.append(f"{unhealthy} unhealthy deployments")

                if action.type == ActionType.REPORT:
                    report = action.result.get("report", {})
                    summary = report.get("summary", {})
                    if not summary.get("threshold_met", True):
                        reflection.success = False
                        reflection.issues.append(
                            f"Health threshold not met: "
                            f"{summary.get('health_percent', 0)}% < {HEALTH_THRESHOLD}%"
                        )

        # Check overall cluster health
        unreachable = sum(
            1 for c in self.target_clusters
            if not self.cluster_health[c["name"]].reachable
            and self.cluster_health[c["name"]].context_exists
        )
        if unreachable > 0:
            reflection.issues.append(f"{unreachable} clusters unreachable")

        # Determine if we should retry
        if reflection.issues and plan.iteration < MAX_ITERATIONS:
            if self.remediation_enabled and any(
                "unhealthy" in issue.lower() for issue in reflection.issues
            ):
                reflection.should_retry = True

        self.log(
            f"Reflection: success={reflection.success}, retry={reflection.should_retry}"
        )
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
            iteration=plan.iteration + 1,
        )

        # Add new actions from reflection
        if reflection.new_actions:
            new_plan.actions.extend(reflection.new_actions)

        # Add verification steps
        new_plan.actions.append(
            Action(ActionType.CHECK_PODS, "Re-check pod status after remediation")
        )
        new_plan.actions.append(
            Action(ActionType.REPORT, "Generate updated report")
        )

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
        if plan.iteration > MAX_ITERATIONS:
            check.passed = False
            check.violations.append(f"Exceeded max iterations ({MAX_ITERATIONS})")

        # Check for remediation actions when disabled
        for action in plan.actions:
            if action.type == ActionType.REMEDIATE:
                if not self.remediation_enabled:
                    check.warnings.append(
                        "Remediation action in plan but remediation is disabled"
                    )
                else:
                    check.warnings.append(
                        "Remediation action will modify cluster state"
                    )

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
        self.log(f"Starting Level 3 Cluster Health Agent with intent: {intent}")
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
                    "violations": governance.violations,
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

            if plan.iteration >= MAX_ITERATIONS:
                self.log(f"Max iterations ({MAX_ITERATIONS}) reached", "WARN")
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
            "execution_log_entries": len(self.execution_log),
        }

        self.log(
            f"Agent completed: success={result['success']}, iterations={result['iterations']}"
        )
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Kubernetes Cluster Health Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="check all cluster health",
        help="The intent/goal for the agent to achieve",
    )
    parser.add_argument(
        "--cluster", "-c",
        action="append",
        dest="clusters",
        help="Specific cluster(s) to check (can be specified multiple times)",
    )
    parser.add_argument(
        "--remediate", "-r",
        action="store_true",
        help="Enable auto-remediation of issues (disabled by default)",
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress verbose output",
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON",
    )
    parser.add_argument(
        "--list-clusters",
        action="store_true",
        help="List available target clusters and exit",
    )

    args = parser.parse_args()

    if args.list_clusters:
        print("Target clusters:")
        for cluster in TARGET_CLUSTERS:
            print(f"  - {cluster['name']} ({cluster['type']}, context: {cluster['context']})")
        sys.exit(0)

    agent = Level3ClusterHealthAgent(
        verbose=not args.quiet,
        clusters=args.clusters,
        remediation_enabled=args.remediate,
    )
    result = agent.run(args.intent)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*70}")
        print("Level 3 Cluster Health Agent - Execution Complete")
        print(f"{'='*70}")
        print(f"Intent:       {args.intent}")
        print(f"Success:      {result['success']}")
        print(f"Iterations:   {result['iterations']}")
        print(f"Duration:     {result['duration_seconds']}s")
        print(f"Final State:  {result['final_state']}")

        if args.remediate:
            print(f"Remediation:  ENABLED")
        else:
            print(f"Remediation:  Disabled (use --remediate to enable)")

        report = result.get("report", {})
        summary = report.get("summary", {})

        print(f"\n{'='*70}")
        print("Summary")
        print(f"{'='*70}")
        print(f"Total Clusters:       {summary.get('total_clusters', 0)}")
        print(f"Reachable Clusters:   {summary.get('reachable_clusters', 0)}")
        print(f"Total Pods:           {summary.get('total_pods', 0)}")
        print(f"Healthy Pods:         {summary.get('healthy_pods', 0)}")
        print(f"Unhealthy Pods:       {summary.get('unhealthy_pods', 0)}")
        print(f"Health Percentage:    {summary.get('health_percent', 0)}%")
        print(f"Threshold:            {summary.get('health_threshold', HEALTH_THRESHOLD)}%")
        print(f"Threshold Met:        {summary.get('threshold_met', False)}")
        print(f"Total Issues:         {summary.get('total_issues', 0)}")

        clusters_data = report.get("clusters", {})
        if clusters_data:
            print(f"\n{'='*70}")
            print("Cluster Details")
            print(f"{'='*70}")
            for name, data in clusters_data.items():
                status_icon = "[OK]" if data.get("reachable") else "[--]"
                print(f"\n{status_icon} {name}:")
                if not data.get("context_exists"):
                    print(f"      Context not found")
                elif not data.get("reachable"):
                    print(f"      Not reachable: {data.get('error', 'unknown error')}")
                else:
                    print(f"      Pods:        {data.get('healthy_pods', 0)}/{data.get('total_pods', 0)} healthy")
                    print(f"      Deployments: {data.get('deployments_healthy', 0)}/{data.get('deployments_total', 0)} healthy")
                    print(f"      Nodes:       {data.get('nodes_ready', 0)}/{data.get('nodes_total', 0)} ready")
                    print(f"      Datadog:     {data.get('datadog_agent_status', 'unknown')}")
                    if data.get("issues_found"):
                        print(f"      Issues:      {len(data['issues_found'])}")
                        for issue in data["issues_found"][:3]:
                            print(f"        - {issue}")
                        if len(data["issues_found"]) > 3:
                            print(f"        ... and {len(data['issues_found']) - 3} more")

        if result.get("issues"):
            print(f"\n{'='*70}")
            print("Issues Found")
            print(f"{'='*70}")
            for issue in result["issues"]:
                print(f"  - {issue}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
