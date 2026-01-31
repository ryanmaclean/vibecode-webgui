#!/usr/bin/env python3
"""
AgentAPI Deployment Test Suite

Validates deployment functionality and resource constraints.

Usage:
    python test.py
"""

import subprocess
import sys
from dataclasses import dataclass
from typing import Callable


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class TestConfig:
    """Test configuration."""
    namespace: str = "vibecode-platform"
    deployment: str = "code-server-workspace"


@dataclass
class TestResult:
    """Result of a test."""
    name: str
    passed: int = 0
    failed: int = 0


class DeploymentTester:
    """AgentAPI deployment tester."""

    def __init__(self, config: TestConfig):
        self.config = config
        self.pass_count = 0
        self.fail_count = 0

    def pass_test(self, message: str) -> None:
        """Record a passed test."""
        print(f"{Color.GREEN}✓{Color.NC} {message}")
        self.pass_count += 1

    def fail_test(self, message: str) -> None:
        """Record a failed test."""
        print(f"{Color.RED}✗{Color.NC} {message}")
        self.fail_count += 1

    def info(self, message: str) -> None:
        """Print info message."""
        print(f"{Color.BLUE}ℹ{Color.NC} {message}")

    def section(self, title: str) -> None:
        """Print section header."""
        print(f"\n{Color.YELLOW}=== {title} ==={Color.NC}")

    def run_kubectl(self, args: list[str]) -> subprocess.CompletedProcess:
        """Run kubectl command."""
        return subprocess.run(
            ["kubectl"] + args,
            capture_output=True,
            text=True,
        )

    def test_namespace(self) -> bool:
        """Test namespace and RBAC."""
        self.section("Testing Namespace and RBAC")

        result = self.run_kubectl(["get", "namespace", self.config.namespace])
        if result.returncode == 0:
            self.pass_test("Namespace exists")
        else:
            self.fail_test("Namespace not found")
            return False

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "serviceaccount", "code-server-sa",
        ])
        if result.returncode == 0:
            self.pass_test("ServiceAccount exists")
        else:
            self.fail_test("ServiceAccount not found")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "role", "code-server-role",
        ])
        if result.returncode == 0:
            self.pass_test("Role exists")
        else:
            self.fail_test("Role not found")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "rolebinding", "code-server-rolebinding",
        ])
        if result.returncode == 0:
            self.pass_test("RoleBinding exists")
        else:
            self.fail_test("RoleBinding not found")

        return True

    def test_config(self) -> bool:
        """Test ConfigMap and Secrets."""
        self.section("Testing Configuration")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "configmap", "agentapi-config",
        ])
        if result.returncode == 0:
            self.pass_test("ConfigMap exists")

            # Validate ConfigMap keys
            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "configmap", "agentapi-config",
                "-o", "jsonpath={.data}",
            ])
            if "config.yaml" in result.stdout:
                self.pass_test("ConfigMap contains config.yaml")
            else:
                self.fail_test("ConfigMap missing config.yaml")

            if "health-check.sh" in result.stdout:
                self.pass_test("ConfigMap contains health-check.sh")
            else:
                self.fail_test("ConfigMap missing health-check.sh")
        else:
            self.fail_test("ConfigMap not found")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "secret", "code-server-config",
        ])
        if result.returncode == 0:
            self.pass_test("Secret code-server-config exists")
        else:
            self.fail_test("Secret code-server-config not found")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "secret", "agentapi-secrets",
        ])
        if result.returncode == 0:
            self.pass_test("Secret agentapi-secrets exists")
        else:
            self.fail_test("Secret agentapi-secrets not found")

        return True

    def test_storage(self) -> bool:
        """Test storage."""
        self.section("Testing Storage")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pvc", "code-server-workspace-pvc",
        ])
        if result.returncode == 0:
            self.pass_test("PVC exists")

            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "pvc", "code-server-workspace-pvc",
                "-o", "jsonpath={.status.phase}",
            ])
            if result.stdout.strip() == "Bound":
                self.pass_test("PVC is bound")
            else:
                self.fail_test(f"PVC not bound (status: {result.stdout.strip()})")
        else:
            self.fail_test("PVC not found")

        return True

    def test_service(self) -> bool:
        """Test service."""
        self.section("Testing Service")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "service", "code-server-workspace",
        ])
        if result.returncode == 0:
            self.pass_test("Service exists")

            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "service", "code-server-workspace",
                "-o", "jsonpath={.spec.ports[*].port}",
            ])
            ports = result.stdout

            if "8765" in ports:
                self.pass_test("Service exposes IDE port 8765")
            else:
                self.fail_test("Service missing IDE port 8765")

            if "3284" in ports:
                self.pass_test("Service exposes AgentAPI port 3284")
            else:
                self.fail_test("Service missing AgentAPI port 3284")

            if "9090" in ports:
                self.pass_test("Service exposes metrics port 9090")
            else:
                self.fail_test("Service missing metrics port 9090")
        else:
            self.fail_test("Service not found")

        return True

    def test_deployment(self) -> bool:
        """Test deployment."""
        self.section("Testing Deployment")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "deployment", self.config.deployment,
        ])
        if result.returncode == 0:
            self.pass_test("Deployment exists")

            # Check deployment status
            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "deployment", self.config.deployment,
                "-o", "jsonpath={.status.readyReplicas}",
            ])
            ready = result.stdout.strip() or "0"

            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "deployment", self.config.deployment,
                "-o", "jsonpath={.spec.replicas}",
            ])
            desired = result.stdout.strip() or "1"

            if ready == desired:
                self.pass_test(f"Deployment ready ({ready}/{desired} replicas)")
            else:
                self.fail_test(f"Deployment not ready ({ready}/{desired} replicas)")

            # Check update strategy
            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "deployment", self.config.deployment,
                "-o", "jsonpath={.spec.strategy.type}",
            ])
            if result.stdout.strip() == "RollingUpdate":
                self.pass_test("Using RollingUpdate strategy")
            else:
                self.fail_test(f"Not using RollingUpdate strategy (found: {result.stdout.strip()})")
        else:
            self.fail_test("Deployment not found")
            return False

        return True

    def test_pods(self) -> bool:
        """Test pods."""
        self.section("Testing Pods")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pods", "-l", "app=code-server",
            "-o", "jsonpath={.items[0].metadata.name}",
        ])
        pod_name = result.stdout.strip()

        if pod_name:
            self.pass_test(f"Pod found: {pod_name}")

            # Check pod status
            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "pod", pod_name,
                "-o", "jsonpath={.status.phase}",
            ])
            if result.stdout.strip() == "Running":
                self.pass_test("Pod is running")
            else:
                self.fail_test(f"Pod not running (status: {result.stdout.strip()})")

            # Check containers
            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "pod", pod_name,
                "-o", "jsonpath={.spec.containers[*].name}",
            ])
            containers = result.stdout

            if "code-server" in containers:
                self.pass_test("code-server container exists")
            else:
                self.fail_test("code-server container not found")

            if "agentapi" in containers:
                self.pass_test("agentapi container exists")
            else:
                self.fail_test("agentapi container not found")

            # Check container readiness
            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "pod", pod_name,
                "-o", "jsonpath={.status.containerStatuses[?(@.name==\"code-server\")].ready}",
            ])
            if result.stdout.strip() == "true":
                self.pass_test("code-server container ready")
            else:
                self.fail_test("code-server container not ready")

            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "pod", pod_name,
                "-o", "jsonpath={.status.containerStatuses[?(@.name==\"agentapi\")].ready}",
            ])
            if result.stdout.strip() == "true":
                self.pass_test("agentapi container ready")
            else:
                self.fail_test("agentapi container not ready")
        else:
            self.fail_test("No pods found")
            return False

        return True

    def test_resources(self) -> bool:
        """Test resource limits."""
        self.section("Testing Resource Limits")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pods", "-l", "app=code-server",
            "-o", "jsonpath={.items[0].metadata.name}",
        ])
        pod_name = result.stdout.strip()

        if not pod_name:
            self.fail_test("No pod found for resource testing")
            return False

        # code-server resources
        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pod", pod_name,
            "-o", "jsonpath={.spec.containers[?(@.name==\"code-server\")].resources.requests.cpu}",
        ])
        cpu_req = result.stdout.strip()

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pod", pod_name,
            "-o", "jsonpath={.spec.containers[?(@.name==\"code-server\")].resources.requests.memory}",
        ])
        mem_req = result.stdout.strip()

        if cpu_req:
            self.pass_test(f"code-server CPU request: {cpu_req}")
        else:
            self.fail_test("code-server missing CPU request")

        if mem_req:
            self.pass_test(f"code-server memory request: {mem_req}")
        else:
            self.fail_test("code-server missing memory request")

        # agentapi resources
        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pod", pod_name,
            "-o", "jsonpath={.spec.containers[?(@.name==\"agentapi\")].resources.requests.cpu}",
        ])
        cpu_req = result.stdout.strip()

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pod", pod_name,
            "-o", "jsonpath={.spec.containers[?(@.name==\"agentapi\")].resources.requests.memory}",
        ])
        mem_req = result.stdout.strip()

        if cpu_req:
            self.pass_test(f"agentapi CPU request: {cpu_req}")
        else:
            self.fail_test("agentapi missing CPU request")

        if mem_req:
            self.pass_test(f"agentapi memory request: {mem_req}")
        else:
            self.fail_test("agentapi missing memory request")

        return True

    def test_health(self) -> bool:
        """Test health checks."""
        self.section("Testing Health Checks")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pods", "-l", "app=code-server",
            "-o", "jsonpath={.items[0].metadata.name}",
        ])
        pod_name = result.stdout.strip()

        if not pod_name:
            self.fail_test("No pod found for health testing")
            return False

        # code-server health
        result = self.run_kubectl([
            "-n", self.config.namespace,
            "exec", pod_name, "-c", "code-server", "--",
            "curl", "-sf", "http://localhost:8765/healthz",
        ])
        if result.returncode == 0:
            self.pass_test("code-server health endpoint responding")
        else:
            self.fail_test("code-server health endpoint not responding")

        # agentapi health
        result = self.run_kubectl([
            "-n", self.config.namespace,
            "exec", pod_name, "-c", "agentapi", "--",
            "curl", "-sf", "http://127.0.0.1:3284/health",
        ])
        if result.returncode == 0:
            self.pass_test("agentapi health endpoint responding")
        else:
            self.fail_test("agentapi health endpoint not responding")

        # agentapi metrics
        result = self.run_kubectl([
            "-n", self.config.namespace,
            "exec", pod_name, "-c", "agentapi", "--",
            "curl", "-sf", "http://127.0.0.1:9090/metrics",
        ])
        if result.returncode == 0:
            self.pass_test("agentapi metrics endpoint responding")
        else:
            self.fail_test("agentapi metrics endpoint not responding")

        return True

    def test_security(self) -> bool:
        """Test security settings."""
        self.section("Testing Security")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pods", "-l", "app=code-server",
            "-o", "jsonpath={.items[0].metadata.name}",
        ])
        pod_name = result.stdout.strip()

        if not pod_name:
            self.fail_test("No pod found for security testing")
            return False

        # Check security context
        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pod", pod_name,
            "-o", "jsonpath={.spec.securityContext.runAsUser}",
        ])
        run_as_user = result.stdout.strip()

        if run_as_user == "1000":
            self.pass_test(f"Running as non-root user (UID: {run_as_user})")
        else:
            self.fail_test(f"Not running as expected user (UID: {run_as_user}, expected: 1000)")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pod", pod_name,
            "-o", "jsonpath={.spec.securityContext.runAsNonRoot}",
        ])
        if result.stdout.strip() == "true":
            self.pass_test("runAsNonRoot enabled")
        else:
            self.fail_test("runAsNonRoot not enabled")

        # Check container capabilities
        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pod", pod_name,
            "-o", "jsonpath={.spec.containers[?(@.name==\"code-server\")].securityContext.capabilities.drop[*]}",
        ])
        if "ALL" in result.stdout:
            self.pass_test("code-server drops all capabilities")
        else:
            self.fail_test("code-server doesn't drop all capabilities")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pod", pod_name,
            "-o", "jsonpath={.spec.containers[?(@.name==\"agentapi\")].securityContext.capabilities.drop[*]}",
        ])
        if "ALL" in result.stdout:
            self.pass_test("agentapi drops all capabilities")
        else:
            self.fail_test("agentapi doesn't drop all capabilities")

        return True

    def test_autoscaling(self) -> bool:
        """Test autoscaling."""
        self.section("Testing Autoscaling")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "hpa", "code-server-workspace-hpa",
        ])
        if result.returncode == 0:
            self.pass_test("HPA exists")

            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "hpa", "code-server-workspace-hpa",
                "-o", "jsonpath={.spec.minReplicas}",
            ])
            min_replicas = result.stdout.strip()

            result = self.run_kubectl([
                "-n", self.config.namespace,
                "get", "hpa", "code-server-workspace-hpa",
                "-o", "jsonpath={.spec.maxReplicas}",
            ])
            max_replicas = result.stdout.strip()

            if min_replicas == "1" and max_replicas == "100":
                self.pass_test("HPA configured for 1-100 replicas")
            else:
                self.fail_test(f"HPA replica range incorrect (min: {min_replicas}, max: {max_replicas})")
        else:
            self.info("HPA not found (may require metrics-server)")

        return True

    def test_policies(self) -> bool:
        """Test policies."""
        self.section("Testing Policies")

        result = self.run_kubectl([
            "-n", self.config.namespace,
            "get", "pdb", "code-server-workspace-pdb",
        ])
        if result.returncode == 0:
            self.pass_test("PodDisruptionBudget exists")
        else:
            self.fail_test("PodDisruptionBudget not found")

        result = self.run_kubectl([
            "get", "priorityclass", "vibecode-workspace-priority",
        ])
        if result.returncode == 0:
            self.pass_test("PriorityClass exists")
        else:
            self.fail_test("PriorityClass not found")

        return True

    def print_summary(self) -> int:
        """Print test summary."""
        self.section("Test Summary")

        total = self.pass_count + self.fail_count
        pass_rate = (self.pass_count * 100 // total) if total > 0 else 0

        print()
        print(f"Total tests: {total}")
        print(f"{Color.GREEN}Passed: {self.pass_count}{Color.NC}")
        print(f"{Color.RED}Failed: {self.fail_count}{Color.NC}")
        print(f"Pass rate: {pass_rate}%")
        print()

        if self.fail_count == 0:
            print(f"{Color.GREEN}All tests passed! ✓{Color.NC}")
            return 0
        else:
            print(f"{Color.RED}Some tests failed. Review the output above.{Color.NC}")
            return 1

    def run_all_tests(self) -> int:
        """Run all tests."""
        print("VibeCode AgentAPI Deployment Test Suite")
        print("========================================")

        self.test_namespace()
        self.test_config()
        self.test_storage()
        self.test_service()
        self.test_deployment()
        self.test_pods()
        self.test_resources()
        self.test_health()
        self.test_security()
        self.test_autoscaling()
        self.test_policies()

        return self.print_summary()


def main() -> int:
    """Main entry point."""
    config = TestConfig()
    tester = DeploymentTester(config)
    return tester.run_all_tests()


if __name__ == "__main__":
    sys.exit(main())
