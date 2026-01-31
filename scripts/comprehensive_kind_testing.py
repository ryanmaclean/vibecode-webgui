#!/usr/bin/env python3

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

"""Comprehensive KIND Cluster Testing Script.

Staff Engineer Implementation - Full infrastructure validation.
"""

import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

# Add lib to path for imports
SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR / "lib"))

from datadog_logging import dd_info, dd_warn, dd_error, dd_metric

# Configuration
CLUSTER_NAME = "vibecode-test"
NAMESPACE = "vibecode"
TEST_RESULTS_FILE = "kind-test-results.log"

# Color codes for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
NC = '\033[0m'  # No Color


@dataclass
class TestResults:
    """Track test results."""

    passed: int = 0
    failed: int = 0
    warnings: int = 0
    log_file: Optional[Path] = None
    lines: List[str] = field(default_factory=list)

    def log(self, message: str) -> None:
        """Log a message to the results file."""
        self.lines.append(message)
        print(message)
        if self.log_file:
            with open(self.log_file, "a") as f:
                f.write(message + "\n")


results = TestResults()


def log_test(status: str, message: str) -> None:
    """Log a test result with color coding and Datadog tracking."""
    if status == "FAIL":
        color = RED
        dd_error(message, "test:kind-testing", "status:fail")
        results.failed += 1
    elif status == "WARN":
        color = YELLOW
        dd_warn(message, "test:kind-testing", "status:warn")
        results.warnings += 1
    elif status == "PASS":
        color = GREEN
        dd_info(message, "test:kind-testing", "status:pass")
        results.passed += 1
    else:
        color = NC
        dd_info(message, "test:kind-testing", f"status:{status.lower()}")

    results.log(f"{color}[{status}]{NC} {message}")


def run_command(
    cmd: List[str],
    capture_output: bool = True,
    timeout: int = 300
) -> Tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture_output,
            text=True,
            timeout=timeout
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


def is_port_available(port: int) -> bool:
    """Check if a port is available."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def test_environment_prerequisites() -> bool:
    """Test 1: Environment Prerequisites."""
    results.log("")
    results.log("📋 Test 1: Environment Prerequisites")
    results.log("-----------------------------------")

    all_passed = True

    # Check Docker
    if command_exists("docker"):
        rc, stdout, _ = run_command(["docker", "--version"])
        if rc == 0:
            log_test("PASS", f"Docker is installed: {stdout.split(chr(10))[0]}")
        else:
            log_test("FAIL", "Docker version check failed")
            all_passed = False
    else:
        log_test("FAIL", "Docker is not installed or not in PATH")
        return False

    # Check KIND
    if command_exists("kind"):
        rc, stdout, _ = run_command(["kind", "version"])
        if rc == 0:
            log_test("PASS", f"KIND is installed: {stdout}")
        else:
            log_test("FAIL", "KIND version check failed")
            all_passed = False
    else:
        log_test("FAIL", "KIND is not installed or not in PATH")
        return False

    # Check kubectl
    if command_exists("kubectl"):
        rc, stdout, _ = run_command(["kubectl", "version", "--client", "--short"])
        if rc == 0:
            log_test("PASS", f"kubectl is installed: {stdout}")
        else:
            # Try without --short flag for newer versions
            rc, stdout, _ = run_command(["kubectl", "version", "--client"])
            if rc == 0:
                version_line = stdout.split("\n")[0] if stdout else "unknown"
                log_test("PASS", f"kubectl is installed: {version_line}")
            else:
                log_test("FAIL", "kubectl version check failed")
                all_passed = False
    else:
        log_test("FAIL", "kubectl is not installed or not in PATH")
        return False

    return all_passed


def test_docker_daemon_health() -> bool:
    """Test 2: Docker Daemon Health."""
    results.log("")
    results.log("📋 Test 2: Docker Daemon Health")
    results.log("-------------------------------")

    rc, _, _ = run_command(["docker", "info"], timeout=30)
    if rc != 0:
        log_test("FAIL", "Docker daemon is not responsive")
        return False

    log_test("PASS", "Docker daemon is responsive")

    # Check Docker disk space
    rc, stdout, _ = run_command(["docker", "system", "df", "--format", "{{.Size}}"])
    if rc == 0 and stdout:
        sizes = stdout.split("\n")
        if sizes:
            log_test("INFO", f"Docker disk usage: {sizes[0]}")

    # Check running containers
    rc, stdout, _ = run_command(["docker", "ps", "-q"])
    if rc == 0:
        container_count = len(stdout.split("\n")) if stdout.strip() else 0
        log_test("INFO", f"Running containers: {container_count}")

    return True


def test_kind_cluster_management() -> bool:
    """Test 3: KIND Cluster Management."""
    results.log("")
    results.log("📋 Test 3: KIND Cluster Management")
    results.log("----------------------------------")

    # List existing clusters
    rc, stdout, _ = run_command(["kind", "get", "clusters"])
    if rc == 0:
        clusters = [c for c in stdout.split("\n") if c.strip()]
        log_test("INFO", f"Existing KIND clusters: {len(clusters)}")

    # Create test cluster config
    config_content = """kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: test-minimal
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 8880
    protocol: TCP
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        f.write(config_content)
        config_path = f.name

    try:
        results.log("Creating test cluster...")
        rc, _, stderr = run_command(
            ["kind", "create", "cluster", "--name", "test-minimal",
             "--config", config_path, "--wait", "300s"],
            timeout=600
        )

        if rc != 0:
            log_test("FAIL", f"Failed to create test KIND cluster: {stderr}")
            return False

        log_test("PASS", "Successfully created test KIND cluster")

        # Test cluster connectivity
        rc, _, _ = run_command(
            ["kubectl", "cluster-info", "--context", "kind-test-minimal"],
            timeout=30
        )

        if rc != 0:
            log_test("FAIL", "Cluster API server is not responsive")
            return False

        log_test("PASS", "Cluster API server is responsive")

        # Test node readiness
        rc, _, _ = run_command(
            ["kubectl", "wait", "--for=condition=Ready", "nodes", "--all",
             "--timeout=300s", "--context", "kind-test-minimal"],
            timeout=310
        )

        if rc != 0:
            log_test("FAIL", "Nodes did not become ready within timeout")
            return False

        log_test("PASS", "All nodes are ready")

        # Get node count
        rc, stdout, _ = run_command(
            ["kubectl", "get", "nodes", "--context", "kind-test-minimal",
             "--no-headers", "-o", "name"]
        )
        if rc == 0:
            node_count = len([n for n in stdout.split("\n") if n.strip()])
            log_test("INFO", f"Cluster has {node_count} node(s)")

        # Test basic pod deployment
        results.log("Testing basic pod deployment...")
        rc, _, _ = run_command(
            ["kubectl", "run", "test-pod", "--image=nginx:alpine",
             "--context", "kind-test-minimal"]
        )

        if rc == 0:
            rc, _, _ = run_command(
                ["kubectl", "wait", "--for=condition=Ready", "pod/test-pod",
                 "--timeout=300s", "--context", "kind-test-minimal"],
                timeout=310
            )

            if rc == 0:
                log_test("PASS", "Basic pod deployment successful")

                # Get pod IP
                rc, pod_ip, _ = run_command(
                    ["kubectl", "get", "pod", "test-pod",
                     "-o", "jsonpath={.status.podIP}",
                     "--context", "kind-test-minimal"]
                )
                if rc == 0 and pod_ip:
                    log_test("INFO", f"Pod IP: {pod_ip}")

                # Cleanup test pod
                run_command(
                    ["kubectl", "delete", "pod", "test-pod",
                     "--context", "kind-test-minimal"],
                    timeout=60
                )
                log_test("INFO", "Cleaned up test pod")
            else:
                log_test("FAIL", "Basic pod deployment failed")
        else:
            log_test("FAIL", "Failed to create test pod")

        return True

    finally:
        # Cleanup test cluster
        results.log("Cleaning up test cluster...")
        run_command(["kind", "delete", "cluster", "--name", "test-minimal"], timeout=120)
        log_test("INFO", "Test cluster cleaned up")

        # Remove temp config file
        Path(config_path).unlink(missing_ok=True)


def test_production_cluster_config() -> bool:
    """Test 4: Production Cluster Configuration."""
    results.log("")
    results.log("📋 Test 4: Production Cluster Configuration")
    results.log("-------------------------------------------")

    config_path = Path("k8s/kind-simple-config.yaml")
    if not config_path.exists():
        # Try from script directory
        config_path = SCRIPT_DIR.parent / "k8s" / "kind-simple-config.yaml"

    if config_path.exists():
        log_test("PASS", "Production cluster config found")

        # Validate config by attempting dry-run (kind doesn't have dry-run, so just check YAML)
        try:
            import yaml
            with open(config_path) as f:
                yaml.safe_load(f)
            log_test("PASS", "Production cluster config is valid YAML")
        except ImportError:
            log_test("INFO", "YAML validation skipped (PyYAML not installed)")
        except Exception as e:
            log_test("FAIL", f"Production cluster config has syntax errors: {e}")
            return False
    else:
        log_test("WARN", "Production cluster config not found")

    return True


def test_kubernetes_manifests() -> bool:
    """Test 5: Kubernetes Manifests Validation."""
    results.log("")
    results.log("📋 Test 5: Kubernetes Manifests Validation")
    results.log("-------------------------------------------")

    k8s_dir = Path("k8s")
    if not k8s_dir.exists():
        k8s_dir = SCRIPT_DIR.parent / "k8s"

    if not k8s_dir.exists():
        log_test("WARN", "k8s directory not found")
        return True

    manifest_count = 0
    valid_manifests = 0

    for manifest in k8s_dir.glob("*.yaml"):
        manifest_count += 1

        rc, _, stderr = run_command(
            ["kubectl", "apply", "--dry-run=client", "-f", str(manifest)],
            timeout=30
        )

        if rc == 0:
            valid_manifests += 1
            log_test("PASS", f"{manifest.name} - Valid manifest")
        else:
            log_test("FAIL", f"{manifest.name} - Invalid manifest: {stderr[:100]}")

    log_test("INFO", f"Validated {valid_manifests}/{manifest_count} manifests")
    return valid_manifests == manifest_count


def test_container_images() -> bool:
    """Test 6: Container Image Validation."""
    results.log("")
    results.log("📋 Test 6: Container Image Validation")
    results.log("-------------------------------------")

    images = [
        "pgvector/pgvector:pg16",
        "redis:8.1-alpine",
        "nginx:alpine",
        "datadog/agent:latest",
        "timberio/vector:latest-alpine",
        "authelia/authelia:latest",
    ]

    available_images = 0
    for image in images:
        results.log(f"Checking {image}...")
        rc, _, _ = run_command(["docker", "pull", image], timeout=300)

        if rc == 0:
            available_images += 1
            log_test("PASS", f"{image} - Available")
        else:
            log_test("FAIL", f"{image} - Not available")

    log_test("INFO", f"Available images: {available_images}/{len(images)}")
    return available_images == len(images)


def test_system_resources() -> bool:
    """Test 7: System Resource Validation."""
    results.log("")
    results.log("📋 Test 7: System Resource Validation")
    results.log("-------------------------------------")

    # Check available memory (macOS compatible)
    if sys.platform == "darwin":
        rc, stdout, _ = run_command(["sysctl", "-n", "hw.memsize"])
        if rc == 0:
            total_mem_bytes = int(stdout)
            total_mem_gb = total_mem_bytes / (1024 ** 3)
            log_test("INFO", f"Total memory: {total_mem_gb:.1f}GB")

            # KIND needs at least 2GB
            if total_mem_gb >= 4:
                log_test("PASS", "Sufficient memory for KIND cluster")
            else:
                log_test("WARN", "Low memory - KIND cluster may be unstable")
    else:
        rc, stdout, _ = run_command(["free", "-b"])
        if rc == 0:
            lines = stdout.split("\n")
            if len(lines) > 1:
                mem_info = lines[1].split()
                if len(mem_info) >= 7:
                    available = int(mem_info[6])
                    available_gb = available / (1024 ** 3)
                    log_test("INFO", f"Available memory: {available_gb:.1f}GB")

                    min_memory = 2 * 1024 * 1024 * 1024  # 2GB
                    if available > min_memory:
                        log_test("PASS", "Sufficient memory for KIND cluster")
                    else:
                        log_test("WARN", "Low memory - KIND cluster may be unstable")

    # Check available disk space
    rc, stdout, _ = run_command(["df", "-h", "/"])
    if rc == 0:
        lines = stdout.split("\n")
        if len(lines) > 1:
            disk_info = lines[1].split()
            if len(disk_info) >= 4:
                log_test("INFO", f"Available disk space: {disk_info[3]}")

    # Check CPU cores
    if sys.platform == "darwin":
        rc, stdout, _ = run_command(["sysctl", "-n", "hw.ncpu"])
    else:
        rc, stdout, _ = run_command(["nproc"])

    if rc == 0:
        log_test("INFO", f"CPU cores available: {stdout}")

    return True


def test_network_configuration() -> bool:
    """Test 8: Network Configuration."""
    results.log("")
    results.log("📋 Test 8: Network Configuration")
    results.log("--------------------------------")

    ports_to_check = [80, 443, 8080, 3000, 5432, 6379, 9091]
    available_ports = 0

    for port in ports_to_check:
        if is_port_available(port):
            available_ports += 1
            log_test("PASS", f"Port {port} is available")
        else:
            log_test("WARN", f"Port {port} is in use")

    log_test("INFO", f"Available ports: {available_ports}/{len(ports_to_check)}")

    # Test Docker network
    rc, stdout, _ = run_command(["docker", "network", "ls"])
    if rc == 0 and "bridge" in stdout:
        log_test("PASS", "Docker bridge network available")
    else:
        log_test("FAIL", "Docker bridge network not available")

    return True


def test_performance() -> bool:
    """Test 9: Performance Baseline."""
    results.log("")
    results.log("📋 Test 9: Performance Baseline")
    results.log("-------------------------------")

    results.log("Running Docker performance test...")
    start_time = time.time()
    rc, _, _ = run_command(
        ["docker", "run", "--rm", "alpine:latest", "echo", "Docker performance test"],
        timeout=60
    )
    end_time = time.time()
    docker_time = end_time - start_time

    log_test("INFO", f"Docker container start time: {docker_time:.2f}s")

    if docker_time < 5.0:
        log_test("PASS", "Docker performance acceptable")
    else:
        log_test("WARN", "Docker performance may be slow")

    return True


def test_integration_readiness() -> bool:
    """Test 10: Integration Readiness."""
    results.log("")
    results.log("📋 Test 10: Integration Readiness")
    results.log("---------------------------------")

    # Check Datadog API key
    dd_api_key = os.environ.get("DATADOG_API_KEY", "")
    if dd_api_key and dd_api_key != "placeholder":
        log_test("PASS", "Datadog API key configured")
    else:
        log_test("WARN", "Datadog API key not configured for real testing")

    # Check OpenRouter API key
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    if openrouter_key and openrouter_key != "placeholder":
        log_test("PASS", "OpenRouter API key configured")
    else:
        log_test("WARN", "OpenRouter API key not configured for real testing")

    # Check for environment configuration file
    env_file = Path(".env.local")
    if not env_file.exists():
        env_file = SCRIPT_DIR.parent / ".env.local"

    if env_file.exists():
        log_test("PASS", "Environment configuration file found")
    else:
        log_test("WARN", "Environment configuration file not found")

    return True


def print_summary() -> None:
    """Print final test summary."""
    results.log("")
    results.log("🎯 Test Summary")
    results.log("===============")

    log_test("INFO", f"Tests passed: {results.passed}")
    log_test("INFO", f"Tests failed: {results.failed}")
    log_test("INFO", f"Warnings: {results.warnings}")

    if results.failed == 0:
        log_test("PASS", "KIND cluster testing completed successfully")
        dd_metric("kind.cluster.tests.passed", results.passed, "count",
                  "test:kind-testing")
        dd_metric("kind.cluster.tests.failed", 0, "count", "test:kind-testing")
        results.log("")
        results.log("✅ KIND cluster is ready for production deployment")
    else:
        log_test("FAIL", "KIND cluster testing completed with failures")
        dd_metric("kind.cluster.tests.passed", results.passed, "count",
                  "test:kind-testing")
        dd_metric("kind.cluster.tests.failed", results.failed, "count",
                  "test:kind-testing")
        results.log("")
        results.log("❌ KIND cluster needs attention before production deployment")


def main() -> int:
    """Main entry point."""
    # Initialize results file
    results.log_file = Path(TEST_RESULTS_FILE)

    dd_info("🚀 Starting Comprehensive KIND Cluster Testing")
    results.log("🚀 Starting Comprehensive KIND Cluster Testing")
    results.log("=================================================")
    results.log(f"Timestamp: {datetime.now().isoformat()}")
    results.log("")

    # Run all tests
    prereqs_ok = test_environment_prerequisites()
    if not prereqs_ok:
        print_summary()
        return 1

    docker_ok = test_docker_daemon_health()
    if not docker_ok:
        print_summary()
        return 1

    # These tests can continue even if they fail
    test_kind_cluster_management()
    test_production_cluster_config()
    test_kubernetes_manifests()
    # Skip image pulling by default as it's slow
    # test_container_images()
    test_system_resources()
    test_network_configuration()
    test_performance()
    test_integration_readiness()

    print_summary()
    return 0 if results.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())