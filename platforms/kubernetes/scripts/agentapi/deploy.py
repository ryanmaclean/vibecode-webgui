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
AgentAPI Kubernetes Deployment Script

Validates and deploys all manifests with health checks.

Usage:
    python deploy.py
"""

import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'


@dataclass
class DeployConfig:
    """Deployment configuration."""
    namespace: str = "vibecode-platform"
    deployment: str = "code-server-workspace"
    timeout: int = 300


def info(message: str) -> None:
    """Print info message."""
    print(f"{Color.GREEN}[INFO]{Color.NC} {message}")


def warn(message: str) -> None:
    """Print warning message."""
    print(f"{Color.YELLOW}[WARN]{Color.NC} {message}")


def error(message: str) -> None:
    """Print error message and exit."""
    print(f"{Color.RED}[ERROR]{Color.NC} {message}")
    sys.exit(1)


def run_kubectl(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a kubectl command."""
    return subprocess.run(
        ["kubectl"] + args,
        capture_output=True,
        text=True,
        check=check,
    )


def check_prerequisites() -> bool:
    """Check if prerequisites are met."""
    info("Checking prerequisites...")

    if not shutil.which("kubectl"):
        error("kubectl not found. Please install kubectl.")
        return False

    result = run_kubectl(["cluster-info"], check=False)
    if result.returncode != 0:
        error("Cannot connect to Kubernetes cluster. Check your kubeconfig.")
        return False

    info("Prerequisites check passed")
    return True


def validate_manifests(manifest_dir: Path) -> bool:
    """Validate Kubernetes manifests."""
    info("Validating Kubernetes manifests...")

    for manifest in manifest_dir.glob("*.yaml"):
        result = run_kubectl(
            ["apply", "--dry-run=client", "-f", str(manifest)],
            check=False,
        )
        if result.returncode != 0:
            error(f"Invalid manifest: {manifest}")
            return False

    info("All manifests validated successfully")
    return True


def deploy_namespace(config: DeployConfig, manifest_dir: Path) -> bool:
    """Deploy namespace and RBAC."""
    info("Creating namespace and RBAC...")

    namespace_manifest = manifest_dir / "00-namespace.yaml"
    if namespace_manifest.exists():
        run_kubectl(["apply", "-f", str(namespace_manifest)])

    # Wait for service account
    run_kubectl([
        "-n", config.namespace,
        "wait", "--for=condition=Ready",
        "serviceaccount/code-server-sa",
        "--timeout=30s",
    ], check=False)

    info("Namespace and RBAC created")
    return True


def deploy_config(config: DeployConfig, manifest_dir: Path) -> bool:
    """Deploy ConfigMap and Secrets."""
    info("Creating ConfigMap and Secrets...")

    configmap_manifest = manifest_dir / "01-configmap.yaml"
    if configmap_manifest.exists():
        run_kubectl(["apply", "-f", str(configmap_manifest)])

    # Check if secret exists
    result = run_kubectl([
        "-n", config.namespace,
        "get", "secret", "code-server-config",
    ], check=False)

    if result.returncode != 0:
        warn("Secret code-server-config not found, creating default...")
        secrets_manifest = manifest_dir / "02-secrets.yaml"
        if secrets_manifest.exists():
            run_kubectl(["apply", "-f", str(secrets_manifest)])
    else:
        info("Secret code-server-config already exists, skipping")

    info("Configuration created")
    return True


def deploy_storage(config: DeployConfig, manifest_dir: Path) -> bool:
    """Deploy PersistentVolumeClaim."""
    info("Creating PersistentVolumeClaim...")

    # Check if storage class exists
    result = run_kubectl([
        "get", "sc", "vibecode-ssd-storage", "--no-headers",
    ], check=False)

    if not result.stdout.strip():
        warn("StorageClass vibecode-ssd-storage not found. Using default StorageClass.")

    pvc_manifest = manifest_dir / "06-pvc.yaml"
    if pvc_manifest.exists():
        run_kubectl(["apply", "-f", str(pvc_manifest)])

    # Wait for PVC to be bound
    info("Waiting for PVC to be bound...")
    result = run_kubectl([
        "-n", config.namespace,
        "wait", "--for=condition=Bound",
        "pvc/code-server-workspace-pvc",
        "--timeout=60s",
    ], check=False)

    if result.returncode != 0:
        warn("PVC not bound yet. This may take time depending on your storage provisioner.")

    info("Storage created")
    return True


def deploy_service(config: DeployConfig, manifest_dir: Path) -> bool:
    """Deploy Service."""
    info("Creating Service...")

    service_manifest = manifest_dir / "03-service.yaml"
    if service_manifest.exists():
        run_kubectl(["apply", "-f", str(service_manifest)])

    run_kubectl(["-n", config.namespace, "get", "svc", "code-server-workspace"])
    info("Service created")
    return True


def deploy_workload(config: DeployConfig, manifest_dir: Path) -> bool:
    """Deploy the main workload."""
    info("Deploying code-server-workspace...")

    deployment_manifest = manifest_dir / "04-deployment.yaml"
    if deployment_manifest.exists():
        run_kubectl(["apply", "-f", str(deployment_manifest)])

    info("Waiting for deployment to be ready...")
    result = run_kubectl([
        "-n", config.namespace,
        "wait", "--for=condition=Available",
        f"deployment/{config.deployment}",
        f"--timeout={config.timeout}s",
    ], check=False)

    if result.returncode != 0:
        error(f"Deployment failed to become ready within {config.timeout}s")
        return False

    info("Deployment ready")
    return True


def deploy_policies(config: DeployConfig, manifest_dir: Path) -> bool:
    """Deploy autoscaling and policies."""
    info("Deploying autoscaling and policies...")

    # Check if metrics-server is available
    result = run_kubectl([
        "get", "deployment", "metrics-server", "-n", "kube-system",
    ], check=False)

    if result.returncode == 0:
        hpa_manifest = manifest_dir / "05-hpa.yaml"
        if hpa_manifest.exists():
            run_kubectl(["apply", "-f", str(hpa_manifest)])
            info("HPA created")
    else:
        warn("metrics-server not found. Skipping HPA creation.")

    # Check if NetworkPolicies are supported
    result = subprocess.run(
        ["kubectl", "api-resources"],
        capture_output=True,
        text=True,
    )
    if "networkpolicies" in result.stdout:
        netpol_manifest = manifest_dir / "07-networkpolicy.yaml"
        if netpol_manifest.exists():
            run_kubectl(["apply", "-f", str(netpol_manifest)])
            info("NetworkPolicy created")
    else:
        warn("NetworkPolicies not supported in this cluster. Skipping.")

    # Apply PDB and PriorityClass
    pdb_manifest = manifest_dir / "08-pdb.yaml"
    if pdb_manifest.exists():
        run_kubectl(["apply", "-f", str(pdb_manifest)])

    priority_manifest = manifest_dir / "09-priorityclass.yaml"
    if priority_manifest.exists():
        run_kubectl(["apply", "-f", str(priority_manifest)])

    info("Policies deployed")
    return True


def verify_deployment(config: DeployConfig) -> bool:
    """Verify the deployment."""
    info("Verifying deployment...")

    # Check pod status
    result = run_kubectl([
        "-n", config.namespace,
        "get", "pods", "-l", "app=code-server", "--no-headers",
    ], check=False)

    if not result.stdout.strip():
        error("No pods found for deployment")
        return False

    # Get pod name
    result = run_kubectl([
        "-n", config.namespace,
        "get", "pods", "-l", "app=code-server",
        "-o", "jsonpath={.items[0].metadata.name}",
    ])
    pod_name = result.stdout.strip()
    info(f"Pod: {pod_name}")

    # Check container status
    info("Checking container status...")
    result = run_kubectl([
        "-n", config.namespace,
        "get", "pod", pod_name,
        "-o", "jsonpath={range .status.containerStatuses[*]}{.name}{': '}{.ready}{'\\n'}{end}",
    ])
    print(result.stdout)

    # Test health endpoints
    info("Testing health endpoints...")

    # code-server health
    result = run_kubectl([
        "-n", config.namespace,
        "exec", pod_name, "-c", "code-server", "--",
        "curl", "-sf", "http://localhost:8765/healthz",
    ], check=False)

    if result.returncode == 0:
        info("code-server health check: PASS")
    else:
        warn("code-server health check: FAIL")

    # agentapi health
    result = run_kubectl([
        "-n", config.namespace,
        "exec", pod_name, "-c", "agentapi", "--",
        "curl", "-sf", "http://127.0.0.1:3284/health",
    ], check=False)

    if result.returncode == 0:
        info("agentapi health check: PASS")
    else:
        warn("agentapi health check: FAIL")

    # Show logs
    info("Recent logs (code-server):")
    result = run_kubectl([
        "-n", config.namespace, "logs", pod_name,
        "-c", "code-server", "--tail=5",
    ], check=False)
    print(result.stdout)

    info("Recent logs (agentapi):")
    result = run_kubectl([
        "-n", config.namespace, "logs", pod_name,
        "-c", "agentapi", "--tail=5",
    ], check=False)
    print(result.stdout)

    info("Deployment verification complete")
    return True


def show_access_info(config: DeployConfig) -> None:
    """Display access information."""
    info("Deployment complete!")
    print()
    print("Access Information:")
    print("===================")
    print()
    print(f"Service: code-server-workspace.{config.namespace}.svc.cluster.local")
    print()
    print("Ports:")
    print("  - IDE:      8765")
    print("  - AgentAPI: 3284")
    print("  - Metrics:  9090")
    print()
    print("Port Forward (for local access):")
    print(f"  kubectl -n {config.namespace} port-forward svc/code-server-workspace 8765:8765")
    print()
    print("View Logs:")
    print(f"  kubectl -n {config.namespace} logs -l app=code-server -c code-server --tail=50")
    print(f"  kubectl -n {config.namespace} logs -l app=code-server -c agentapi --tail=50")
    print()
    print("Scale Deployment:")
    print(f"  kubectl -n {config.namespace} scale deployment/{config.deployment} --replicas=3")
    print()


def run_deployment(manifest_dir: Optional[Path] = None) -> int:
    """Run the main deployment flow."""
    info("Starting VibeCode AgentAPI deployment...")

    config = DeployConfig()

    if manifest_dir is None:
        manifest_dir = Path.cwd()

    if not check_prerequisites():
        return 1

    if not validate_manifests(manifest_dir):
        return 1

    deploy_namespace(config, manifest_dir)
    deploy_config(config, manifest_dir)
    deploy_storage(config, manifest_dir)
    deploy_service(config, manifest_dir)

    if not deploy_workload(config, manifest_dir):
        return 1

    deploy_policies(config, manifest_dir)
    verify_deployment(config)
    show_access_info(config)

    info("Deployment completed successfully!")
    return 0


def main() -> int:
    """Main entry point."""
    return run_deployment()


if __name__ == "__main__":
    sys.exit(main())