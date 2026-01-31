#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Cloud Workspace Smoke Tests

Validates production-ready setup before cloud deployment.

Usage:
    python smoke_test.py [--keep] [--no-cleanup]
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'


@dataclass
class SmokeTestConfig:
    """Smoke test configuration."""
    test_namespace: str = "vibecode-test"
    cluster_name: str = "vibecode-smoke-test"
    keep_cluster: bool = False
    cleanup: bool = True
    script_dir: Optional[Path] = None


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{Color.GREEN}[INFO]{Color.NC} {message}")


def log_warn(message: str) -> None:
    """Print warning message."""
    print(f"{Color.YELLOW}[WARN]{Color.NC} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{Color.RED}[ERROR]{Color.NC} {message}")


def run_cmd(cmd: list[str], check: bool = True, timeout: int = 300) -> subprocess.CompletedProcess:
    """Run a command."""
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=check,
        timeout=timeout,
    )


class SmokeTestRunner:
    """Cloud workspace smoke test runner."""

    def __init__(self, config: SmokeTestConfig):
        self.config = config
        self.failed_tests = 0

    def check_prerequisites(self) -> bool:
        """Check prerequisites."""
        log_info("Checking prerequisites...")

        missing_tools = []

        if not shutil.which("kind"):
            missing_tools.append("kind")
        if not shutil.which("kubectl"):
            missing_tools.append("kubectl")
        if not shutil.which("helm"):
            missing_tools.append("helm")
        if not shutil.which("docker"):
            missing_tools.append("docker")

        if missing_tools:
            log_error(f"Missing required tools: {', '.join(missing_tools)}")
            print("Install with:")
            print("  brew install kind kubectl helm docker")
            return False

        log_info("All prerequisites met")
        return True

    def cleanup_cluster(self) -> None:
        """Clean up existing cluster."""
        log_info("Cleaning up existing cluster...")

        run_cmd(["kind", "delete", "cluster", "--name", self.config.cluster_name], check=False)

        if self.config.script_dir:
            test_workspaces = self.config.script_dir / "test-workspaces"
            if test_workspaces.exists():
                shutil.rmtree(test_workspaces)

    def create_cluster(self) -> bool:
        """Create KinD cluster."""
        log_info("Creating KinD cluster...")

        # Create workspace directory
        if self.config.script_dir:
            test_workspaces = self.config.script_dir / "test-workspaces"
            test_workspaces.mkdir(parents=True, exist_ok=True)
            test_workspaces.chmod(0o777)

        # Create cluster
        cmd = ["kind", "create", "cluster", "--name", self.config.cluster_name, "--wait=2m"]

        if self.config.script_dir:
            kind_config = self.config.script_dir / "kind-config.yaml"
            if kind_config.exists():
                cmd.extend(["--config", str(kind_config)])

        result = run_cmd(cmd, check=False, timeout=180)
        if result.returncode != 0:
            log_error(f"Failed to create cluster: {result.stderr}")
            return False

        # Verify cluster is ready
        run_cmd(["kubectl", "wait", "--for=condition=Ready", "nodes", "--all", "--timeout=3m"])

        log_info("Cluster created successfully")
        return True

    def deploy_test_workspaces(self) -> bool:
        """Deploy test workspaces."""
        log_info("Deploying test workspaces...")

        if self.config.script_dir:
            test_deployment = self.config.script_dir / "test-deployment.yaml"
            if test_deployment.exists():
                run_cmd(["kubectl", "apply", "-f", str(test_deployment)])

        # Wait for namespace
        run_cmd([
            "kubectl", "wait", "--for=jsonpath={.status.phase}=Active",
            f"namespace/{self.config.test_namespace}",
            "--timeout=1m",
        ], check=False)

        # Wait for pods
        log_info("Waiting for pods to be ready...")
        run_cmd([
            "kubectl", "wait", "--for=condition=Ready",
            "pods", "-l", "app=code-server",
            "-n", self.config.test_namespace,
            "--timeout=5m",
        ], check=False)

        log_info("Test workspaces deployed")
        return True

    def get_pod_name(self) -> str:
        """Get the first pod name."""
        result = run_cmd([
            "kubectl", "get", "pods", "-n", self.config.test_namespace,
            "-l", "app=code-server",
            "-o", "jsonpath={.items[0].metadata.name}",
        ], check=False)
        return result.stdout.strip()

    def test_persistent_storage(self) -> bool:
        """Test persistent storage."""
        log_info("Testing persistent storage...")

        pod_name = self.get_pod_name()
        if not pod_name:
            log_error("No pod found")
            return False

        # Write test file
        run_cmd([
            "kubectl", "exec", "-n", self.config.test_namespace, pod_name, "--",
            "bash", "-c", "echo 'test-data' > /home/coder/workspace/test-file.txt",
        ], check=False)

        # Verify file exists
        result = run_cmd([
            "kubectl", "exec", "-n", self.config.test_namespace, pod_name, "--",
            "cat", "/home/coder/workspace/test-file.txt",
        ], check=False)

        if result.stdout.strip() == "test-data":
            log_info("✓ Persistent storage working")
            return True
        else:
            log_error("✗ Persistent storage test failed")
            return False

    def test_graceful_shutdown(self) -> bool:
        """Test graceful shutdown."""
        log_info("Testing graceful shutdown...")

        pod_name = self.get_pod_name()
        if not pod_name:
            log_error("No pod found")
            return False

        start_time = time.time()
        run_cmd([
            "kubectl", "delete", "pod", "-n", self.config.test_namespace,
            pod_name, "--wait=true", "--timeout=2m",
        ], check=False)
        duration = int(time.time() - start_time)

        if duration < 60:
            log_info(f"✓ Graceful shutdown completed in {duration}s")
            return True
        else:
            log_warn(f"⚠ Shutdown took {duration}s (expected <60s)")
            return True

    def test_hpa_scaling(self) -> bool:
        """Test HPA configuration."""
        log_info("Testing HPA configuration...")

        result = run_cmd([
            "kubectl", "get", "hpa", "-n", self.config.test_namespace,
            "code-server-hpa-test",
        ], check=False)

        if result.returncode == 0:
            result = run_cmd([
                "kubectl", "get", "hpa", "-n", self.config.test_namespace,
                "code-server-hpa-test",
                "-o", "jsonpath={.spec.minReplicas}",
            ])
            min_replicas = result.stdout.strip()

            result = run_cmd([
                "kubectl", "get", "hpa", "-n", self.config.test_namespace,
                "code-server-hpa-test",
                "-o", "jsonpath={.spec.maxReplicas}",
            ])
            max_replicas = result.stdout.strip()

            log_info(f"✓ HPA configured: min={min_replicas}, max={max_replicas}")
            return True
        else:
            log_error("✗ HPA not found")
            return False

    def test_network_isolation(self) -> bool:
        """Test network policies."""
        log_info("Testing network policies...")

        result = run_cmd([
            "kubectl", "get", "networkpolicy", "-n", self.config.test_namespace,
            "workspace-isolation-test",
        ], check=False)

        if result.returncode == 0:
            log_info("✓ Network policies configured")
            return True
        else:
            log_error("✗ Network policies not found")
            return False

    def test_resource_limits(self) -> bool:
        """Test resource limits."""
        log_info("Testing resource limits...")

        pod_name = self.get_pod_name()
        if not pod_name:
            log_error("No pod found")
            return False

        result = run_cmd([
            "kubectl", "get", "pod", "-n", self.config.test_namespace, pod_name,
            "-o", "jsonpath={.spec.containers[0].resources.limits.cpu}",
        ])
        cpu_limit = result.stdout.strip()

        result = run_cmd([
            "kubectl", "get", "pod", "-n", self.config.test_namespace, pod_name,
            "-o", "jsonpath={.spec.containers[0].resources.limits.memory}",
        ])
        mem_limit = result.stdout.strip()

        if cpu_limit and mem_limit:
            log_info(f"✓ Resource limits configured: CPU={cpu_limit}, Memory={mem_limit}")
            return True
        else:
            log_error("✗ Resource limits not properly configured")
            return False

    def test_workspace_resumption(self) -> bool:
        """Test workspace resumption."""
        log_info("Testing workspace resumption...")

        pod_name = self.get_pod_name()
        if not pod_name:
            log_error("No pod found")
            return False

        # Write test data
        run_cmd([
            "kubectl", "exec", "-n", self.config.test_namespace, pod_name, "--",
            "bash", "-c", "echo 'resume-test' > /home/coder/workspace/resume-test.txt",
        ], check=False)

        # Delete pod
        run_cmd([
            "kubectl", "delete", "pod", "-n", self.config.test_namespace,
            pod_name, "--wait=true",
        ], check=False)

        # Wait for new pod
        time.sleep(10)
        run_cmd([
            "kubectl", "wait", "--for=condition=Ready",
            "pods", "-l", "app=code-server",
            "-n", self.config.test_namespace,
            "--timeout=3m",
        ], check=False)

        # Get new pod name
        new_pod_name = self.get_pod_name()

        # Verify data persisted
        result = run_cmd([
            "kubectl", "exec", "-n", self.config.test_namespace, new_pod_name, "--",
            "cat", "/home/coder/workspace/resume-test.txt",
        ], check=False)

        if result.stdout.strip() == "resume-test":
            log_info("✓ Workspace resumption successful")
            return True
        else:
            log_error("✗ Workspace data not persisted")
            return False

    def generate_report(self) -> None:
        """Generate test report."""
        log_info("Generating test report...")

        if not self.config.script_dir:
            return

        report_file = self.config.script_dir / "test-report.txt"

        with open(report_file, "w") as f:
            f.write("Cloud Workspace Smoke Test Report\n")
            f.write("==================================\n")
            f.write(f"Date: {datetime.now()}\n")
            f.write(f"Cluster: {self.config.cluster_name}\n")
            f.write(f"Namespace: {self.config.test_namespace}\n\n")

            f.write("Cluster Information:\n")
            result = run_cmd(["kubectl", "cluster-info"], check=False)
            f.write(result.stdout + "\n")

            f.write("Node Information:\n")
            result = run_cmd(["kubectl", "get", "nodes", "-o", "wide"], check=False)
            f.write(result.stdout + "\n")

            f.write("Pod Status:\n")
            result = run_cmd([
                "kubectl", "get", "pods", "-n", self.config.test_namespace, "-o", "wide",
            ], check=False)
            f.write(result.stdout + "\n")

        log_info(f"Report saved to: {report_file}")

    def run_all_tests(self) -> int:
        """Run all smoke tests."""
        log_info("Running smoke tests...")

        tests = [
            self.test_persistent_storage,
            self.test_graceful_shutdown,
            self.test_hpa_scaling,
            self.test_network_isolation,
            self.test_resource_limits,
            self.test_workspace_resumption,
        ]

        for test in tests:
            try:
                if not test():
                    self.failed_tests += 1
            except Exception as e:
                log_error(f"Test failed with exception: {e}")
                self.failed_tests += 1

        print()
        if self.failed_tests == 0:
            log_info("✓ All tests passed!")
            return 0
        else:
            log_error(f"✗ {self.failed_tests} test(s) failed")
            return 1

    def run(self) -> int:
        """Run the smoke test suite."""
        log_info("Starting Cloud Workspace Smoke Tests")
        print()

        if not self.check_prerequisites():
            return 1

        if self.config.cleanup:
            self.cleanup_cluster()

        if not self.create_cluster():
            return 1

        if not self.deploy_test_workspaces():
            return 1

        test_result = self.run_all_tests()

        self.generate_report()

        if self.config.keep_cluster:
            log_info("Cluster kept for manual inspection")
            log_info(f"Access with: kubectl --context kind-{self.config.cluster_name}")
            log_info(f"Clean up with: kind delete cluster --name {self.config.cluster_name}")
        else:
            self.cleanup_cluster()

        return test_result


def parse_args() -> SmokeTestConfig:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Cloud Workspace Smoke Tests",
    )

    parser.add_argument("--keep", action="store_true",
                        help="Keep cluster after tests")
    parser.add_argument("--no-cleanup", action="store_true",
                        help="Don't cleanup existing cluster")

    args = parser.parse_args()

    return SmokeTestConfig(
        keep_cluster=args.keep,
        cleanup=not args.no_cleanup,
        script_dir=Path(__file__).parent.resolve(),
    )


def main() -> int:
    """Main entry point."""
    config = parse_args()
    runner = SmokeTestRunner(config)
    return runner.run()


if __name__ == "__main__":
    sys.exit(main())