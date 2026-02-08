#!/usr/bin/env python3
"""
Tundra Dome Bootstrap - Full cluster initialization

This script orchestrates the complete deployment of Tundra Dome on a KIND cluster.
It creates the cluster, deploys all infrastructure, and verifies the deployment.

Usage:
    ./tundra-bootstrap.py                    # Full bootstrap
    ./tundra-bootstrap.py --cluster-only     # Just create cluster
    ./tundra-bootstrap.py --skip-cluster     # Skip cluster creation
    ./tundra-bootstrap.py --verify-only      # Just verify deployment
    ./tundra-bootstrap.py --clean            # Tear down everything
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).parent.resolve()
CLUSTER_NAME = "kind-tundra-dome"
NAMESPACE = "tundra-dome"

# Directory structure
CRDS_DIR = SCRIPT_DIR / "crds"
CONTROLLERS_DIR = SCRIPT_DIR / "controllers"
BRIDGES_DIR = SCRIPT_DIR / "bridges"
MANIFESTS_DIR = SCRIPT_DIR / "manifests"
EXAMPLES_DIR = SCRIPT_DIR / "examples"
DAGS_DIR = SCRIPT_DIR / "dags"

# Colors for output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def log(msg: str, level: str = "info"):
    """Print colored log message."""
    colors = {
        "info": Colors.CYAN,
        "success": Colors.GREEN,
        "warning": Colors.WARNING,
        "error": Colors.FAIL,
        "header": Colors.HEADER + Colors.BOLD,
    }
    color = colors.get(level, "")
    print(f"{color}{msg}{Colors.ENDC}")


def run(cmd: list[str], check: bool = True, capture: bool = False, **kwargs) -> subprocess.CompletedProcess:
    """Run a command with optional error handling."""
    if capture:
        kwargs["capture_output"] = True
        kwargs["text"] = True
    result = subprocess.run(cmd, **kwargs)
    if check and result.returncode != 0:
        if capture:
            log(f"Command failed: {' '.join(cmd)}", "error")
            if result.stderr:
                log(result.stderr, "error")
        raise subprocess.CalledProcessError(result.returncode, cmd)
    return result


def kubectl(*args, context: Optional[str] = None, check: bool = True) -> subprocess.CompletedProcess:
    """Run kubectl command."""
    cmd = ["kubectl"]
    if context:
        cmd.extend(["--context", context])
    cmd.extend(args)
    return run(cmd, check=check, capture=True)


def kind(*args, check: bool = True) -> subprocess.CompletedProcess:
    """Run kind command."""
    return run(["kind", *args], check=check, capture=True)


def check_prerequisites() -> bool:
    """Check that required tools are installed."""
    log("Checking prerequisites...", "header")

    tools = ["docker", "kind", "kubectl"]
    missing = []

    for tool in tools:
        try:
            run(["which", tool], capture=True)
            log(f"  [OK] {tool}", "success")
        except subprocess.CalledProcessError:
            log(f"  [MISSING] {tool}", "error")
            missing.append(tool)

    # Check Docker is running
    try:
        run(["docker", "info"], capture=True)
        log("  [OK] Docker daemon running", "success")
    except subprocess.CalledProcessError:
        log("  [ERROR] Docker daemon not running", "error")
        missing.append("docker-daemon")

    if missing:
        log(f"\nMissing prerequisites: {', '.join(missing)}", "error")
        return False

    log("All prerequisites satisfied!\n", "success")
    return True


def cluster_exists() -> bool:
    """Check if the KIND cluster exists."""
    result = kind("get", "clusters", check=False)
    return CLUSTER_NAME.replace("kind-", "") in result.stdout


def create_cluster() -> bool:
    """Create the KIND cluster."""
    log("Creating KIND cluster...", "header")

    if cluster_exists():
        log(f"  Cluster {CLUSTER_NAME} already exists", "warning")
        return True

    config_file = SCRIPT_DIR / "kind-config.yaml"
    if not config_file.exists():
        log(f"  [ERROR] kind-config.yaml not found", "error")
        return False

    try:
        run(["kind", "create", "cluster", "--config", str(config_file)])
        log(f"  Cluster {CLUSTER_NAME} created!", "success")

        # Wait for cluster to be ready
        log("  Waiting for cluster to be ready...")
        for _ in range(30):
            result = kubectl("get", "nodes", context=CLUSTER_NAME, check=False)
            if result.returncode == 0 and "Ready" in result.stdout:
                break
            time.sleep(2)

        log("  Cluster is ready!\n", "success")
        return True

    except subprocess.CalledProcessError as e:
        log(f"  Failed to create cluster: {e}", "error")
        return False


def delete_cluster() -> bool:
    """Delete the KIND cluster."""
    log("Deleting KIND cluster...", "header")

    if not cluster_exists():
        log(f"  Cluster {CLUSTER_NAME} does not exist", "warning")
        return True

    try:
        run(["kind", "delete", "cluster", "--name", CLUSTER_NAME.replace("kind-", "")])
        log(f"  Cluster {CLUSTER_NAME} deleted!", "success")
        return True
    except subprocess.CalledProcessError as e:
        log(f"  Failed to delete cluster: {e}", "error")
        return False


def apply_manifest(name: str, path: Path, wait_for: Optional[list[str]] = None) -> bool:
    """Apply a manifest and optionally wait for resources."""
    if not path.exists():
        log(f"  [SKIP] {name}: {path.name} not found", "warning")
        return True

    try:
        kubectl("apply", "-f", str(path), context=CLUSTER_NAME)
        log(f"  [OK] {name}", "success")

        if wait_for:
            for resource in wait_for:
                log(f"      Waiting for {resource}...")
                kubectl(
                    "wait", "--for=condition=available",
                    f"deployment/{resource}", "-n", NAMESPACE,
                    "--timeout=120s", context=CLUSTER_NAME, check=False
                )

        return True
    except subprocess.CalledProcessError as e:
        log(f"  [FAIL] {name}: {e}", "error")
        return False


def create_configmap_from_dir(name: str, source_dir: Path) -> bool:
    """Create a ConfigMap from a directory of files."""
    if not source_dir.exists():
        log(f"  [SKIP] ConfigMap {name}: directory not found", "warning")
        return True

    try:
        # Generate ConfigMap YAML
        result = kubectl(
            "create", "configmap", name,
            f"--from-file={source_dir}",
            "-n", NAMESPACE,
            "--dry-run=client", "-o", "yaml",
            context=CLUSTER_NAME
        )

        # Apply it
        apply_result = subprocess.run(
            ["kubectl", "--context", CLUSTER_NAME, "apply", "-f", "-"],
            input=result.stdout,
            capture_output=True,
            text=True
        )

        if apply_result.returncode == 0:
            log(f"  [OK] ConfigMap: {name}", "success")
            return True
        else:
            log(f"  [FAIL] ConfigMap {name}: {apply_result.stderr}", "error")
            return False

    except subprocess.CalledProcessError as e:
        log(f"  [FAIL] ConfigMap {name}: {e}", "error")
        return False


def deploy_infrastructure() -> bool:
    """Deploy infrastructure: namespace, Kafka, PostgreSQL."""
    log("Deploying infrastructure...", "header")

    steps = [
        ("Namespace + RBAC", MANIFESTS_DIR / "namespace-rbac.yaml", None),
        ("PostgreSQL", SCRIPT_DIR / "postgresql.yaml", ["airflow-postgresql"]),
        ("Kafka Stack", MANIFESTS_DIR / "kafka-stack.yaml", ["kafka"]),
    ]

    for name, path, wait in steps:
        if not apply_manifest(name, path, wait):
            return False

    return True


def deploy_kafka_topics() -> bool:
    """Deploy Kafka topics initialization job."""
    log("Creating Kafka topics...", "header")

    # Wait for Kafka to be ready
    log("  Waiting for Kafka to be ready...")
    for _ in range(30):
        result = kubectl(
            "get", "pods", "-n", NAMESPACE,
            "-l", "app=kafka",
            "-o", "jsonpath={.items[0].status.phase}",
            context=CLUSTER_NAME, check=False
        )
        if result.stdout.strip() == "Running":
            break
        time.sleep(2)

    return apply_manifest("Kafka Topics Init", MANIFESTS_DIR / "kafka-topics-init.yaml", None)


def deploy_crds() -> bool:
    """Deploy Tundra Dome CRDs."""
    log("Installing CRDs...", "header")

    crds = ["bead", "polecat", "lane", "playbook", "station", "errand"]

    for crd in crds:
        path = CRDS_DIR / f"{crd}.yaml"
        if path.exists():
            try:
                kubectl("apply", "-f", str(path), context=CLUSTER_NAME)
                log(f"  [OK] {crd}", "success")
            except subprocess.CalledProcessError:
                log(f"  [FAIL] {crd}", "error")
                return False
        else:
            log(f"  [SKIP] {crd}: not found", "warning")

    return True


def deploy_airflow() -> bool:
    """Deploy Airflow and DAGs."""
    log("Deploying Airflow...", "header")

    # First, create DAGs ConfigMap
    if DAGS_DIR.exists():
        dag_files = list(DAGS_DIR.glob("*.py"))
        if dag_files:
            # Create ConfigMap from DAG files
            create_configmap_from_dir("airflow-dags", DAGS_DIR)

    return apply_manifest("Airflow", MANIFESTS_DIR / "airflow.yaml",
                         ["airflow-webserver", "airflow-scheduler"])


def deploy_gitea() -> bool:
    """Deploy Gitea and webhook producer."""
    log("Deploying Gitea stack...", "header")

    steps = [
        ("Gitea", SCRIPT_DIR / "gitea.yaml", ["gitea"]),
        ("Webhook Producer", SCRIPT_DIR / "gitea-webhook-producer.yaml", ["gitea-webhook-producer"]),
    ]

    for name, path, wait in steps:
        if not apply_manifest(name, path, wait):
            return False

    return True


def deploy_controllers() -> bool:
    """Deploy Tundra Dome controllers."""
    log("Deploying controllers...", "header")

    # Create ConfigMaps for controller code
    controller_dirs = [
        (CONTROLLERS_DIR / "polecat-operator", "polecat-operator-code"),
        (CONTROLLERS_DIR / "bead-controller", "bead-controller-code"),
        (CONTROLLERS_DIR / "lane-controller", "lane-controller-code"),
        (BRIDGES_DIR / "openlineage-bead", "openlineage-bead-bridge-code"),
    ]

    for code_dir, cm_name in controller_dirs:
        create_configmap_from_dir(cm_name, code_dir)

    return apply_manifest("Controllers", CONTROLLERS_DIR / "controllers.yaml",
                         ["polecat-operator", "bead-controller", "lane-controller"])


def deploy_examples() -> bool:
    """Deploy example Lane and Polecat CRs."""
    log("Deploying example CRs...", "header")

    examples = ["lanes.yaml", "polecats.yaml"]

    for example in examples:
        path = EXAMPLES_DIR / example
        if not apply_manifest(example, path, None):
            return False

    return True


def verify_deployment() -> bool:
    """Verify the full deployment."""
    log("\nVerifying deployment...", "header")

    checks = [
        ("CRDs", "get crd beads.tundra.dome"),
        ("Namespace", f"get namespace {NAMESPACE}"),
        ("Kafka", f"get deployment kafka -n {NAMESPACE}"),
        ("PostgreSQL", f"get deployment airflow-postgresql -n {NAMESPACE}"),
        ("Airflow", f"get deployment airflow-webserver -n {NAMESPACE}"),
        ("Gitea", f"get deployment gitea -n {NAMESPACE}"),
        ("Controllers", f"get deployment polecat-operator -n {NAMESPACE}"),
        ("Lanes", f"get lanes -n {NAMESPACE}"),
        ("Polecats", f"get polecats -n {NAMESPACE}"),
    ]

    all_passed = True
    for name, cmd in checks:
        result = kubectl(*cmd.split(), context=CLUSTER_NAME, check=False)
        status = "OK" if result.returncode == 0 else "FAIL"
        color = "success" if result.returncode == 0 else "error"
        log(f"  [{status}] {name}", color)
        if result.returncode != 0:
            all_passed = False

    return all_passed


def print_access_info():
    """Print access information for deployed services."""
    log("\n" + "=" * 60, "header")
    log("  Tundra Dome Deployment Complete!", "header")
    log("=" * 60 + "\n", "header")

    log("Access Points:", "info")
    log("  Airflow:    http://localhost:8080 (admin/admin)", "info")
    log("  Gitea:      http://localhost:3000", "info")
    log("  Kafka:      localhost:9092", "info")
    log("  PostgreSQL: localhost:5432", "info")

    log("\nKubectl Commands:", "info")
    log(f"  kubectl --context {CLUSTER_NAME} get lanes -n {NAMESPACE}", "info")
    log(f"  kubectl --context {CLUSTER_NAME} get polecats -n {NAMESPACE}", "info")
    log(f"  kubectl --context {CLUSTER_NAME} get beads -n {NAMESPACE}", "info")

    log("\nManagement:", "info")
    log("  ./tundra-cli.py status", "info")
    log("  ./tundra-cli.py init", "info")
    log("  ./tundra-bootstrap.py --clean", "info")


def bootstrap_full() -> int:
    """Run full bootstrap sequence."""
    log("\n" + "=" * 60, "header")
    log("  Tundra Dome Full Bootstrap", "header")
    log("=" * 60 + "\n", "header")

    steps = [
        ("Prerequisites", check_prerequisites),
        ("Create Cluster", create_cluster),
        ("Infrastructure", deploy_infrastructure),
        ("Kafka Topics", deploy_kafka_topics),
        ("CRDs", deploy_crds),
        ("Airflow", deploy_airflow),
        ("Gitea", deploy_gitea),
        ("Controllers", deploy_controllers),
        ("Examples", deploy_examples),
        ("Verification", verify_deployment),
    ]

    for step_name, step_func in steps:
        log(f"\n[Step] {step_name}", "header")
        try:
            if not step_func():
                log(f"\nBootstrap failed at: {step_name}", "error")
                return 1
        except Exception as e:
            log(f"\nBootstrap failed at {step_name}: {e}", "error")
            return 1

    print_access_info()
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Tundra Dome Bootstrap - Full cluster initialization",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--cluster-only", action="store_true",
                       help="Only create the KIND cluster")
    parser.add_argument("--skip-cluster", action="store_true",
                       help="Skip cluster creation, deploy to existing cluster")
    parser.add_argument("--verify-only", action="store_true",
                       help="Only verify deployment status")
    parser.add_argument("--clean", action="store_true",
                       help="Delete the cluster and all resources")

    args = parser.parse_args()

    if args.clean:
        return 0 if delete_cluster() else 1

    if args.verify_only:
        if not cluster_exists():
            log("Cluster does not exist", "error")
            return 1
        return 0 if verify_deployment() else 1

    if args.cluster_only:
        if not check_prerequisites():
            return 1
        return 0 if create_cluster() else 1

    # Full bootstrap
    return bootstrap_full()


if __name__ == "__main__":
    sys.exit(main())
