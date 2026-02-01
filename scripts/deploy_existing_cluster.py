#!/usr/bin/env python3
"""Deploy to Existing Cluster Script.

Works with your current KIND cluster and PostgreSQL setup.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# ANSI color codes
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
CYAN = "\033[0;36m"
NC = "\033[0m"

# Configuration
NAMESPACE = "vibecode-platform"
CLUSTER_CONTEXT = "kind-vibecode-kind-local"

DEPLOYMENT_MANIFEST = """apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-webgui
  namespace: {namespace}
  labels:
    app: vibecode-webgui
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vibecode-webgui
  template:
    metadata:
      labels:
        app: vibecode-webgui
    spec:
      containers:
      - name: vibecode-webgui
        image: node:18-alpine
        command: ["sh", "-c"]
        args:
          - |
            apk add --no-cache git
            git clone https://github.com/ryanmaclean/vibecode-webgui.git /app
            cd /app
            npm ci
            npm run build
            npm start
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "development"
        - name: DATABASE_URL
          value: "postgresql://vibecode:vibecode_password@host.docker.internal:5432/vibecode"
        - name: NEXTAUTH_URL
          value: "http://localhost:3000"
        - name: NEXTAUTH_SECRET
          value: "development-secret-key"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: vibecode-webgui
  namespace: {namespace}
spec:
  selector:
    app: vibecode-webgui
  ports:
  - port: 3000
    targetPort: 3000
    nodePort: 30000
  type: NodePort
"""


def print_header(msg: str) -> None:
    """Print a header message."""
    print()
    print(f"{CYAN}================================================{NC}")
    print(f"{CYAN}{msg}{NC}")
    print(f"{CYAN}================================================{NC}")
    print()


def print_status(msg: str) -> None:
    """Print status message."""
    print(f"{BLUE}[INFO]{NC} {msg}")


def print_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}[SUCCESS]{NC} {msg}")


def print_warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}[WARNING]{NC} {msg}")


def print_error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}[ERROR]{NC} {msg}")


def run_command(
    cmd: list[str],
    timeout: int = 300,
    check: bool = False,
    capture: bool = True,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess:
    """Run a command with error handling."""
    try:
        return subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout,
            check=check,
            cwd=cwd,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr="Timeout")
    except subprocess.SubprocessError as e:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr=str(e))


def check_cluster_connectivity() -> bool:
    """Check if KIND cluster is accessible.

    Returns:
        True if cluster is accessible.
    """
    print_status("Checking cluster connectivity...")
    result = run_command(
        ["kubectl", "cluster-info", "--context", CLUSTER_CONTEXT],
        timeout=30,
    )
    if result.returncode != 0:
        print_error("Cannot connect to KIND cluster. Is it running?")
        return False
    return True


def set_cluster_context() -> bool:
    """Set kubectl context to the cluster.

    Returns:
        True if context was set successfully.
    """
    result = run_command(["kubectl", "config", "use-context", CLUSTER_CONTEXT])
    if result.returncode != 0:
        print_error(f"Failed to set context to {CLUSTER_CONTEXT}")
        return False
    print_success(f"Connected to KIND cluster: vibecode-kind-local")
    return True


def create_namespace(namespace: str) -> bool:
    """Create namespace if it doesn't exist.

    Returns:
        True if namespace exists or was created.
    """
    print_status(f"Creating namespace: {namespace}")

    # Generate namespace yaml and apply
    result = run_command(
        ["kubectl", "create", "namespace", namespace, "--dry-run=client", "-o", "yaml"],
    )
    if result.returncode != 0:
        return False

    # Apply the namespace
    apply_result = subprocess.run(
        ["kubectl", "apply", "-f", "-"],
        input=result.stdout,
        capture_output=True,
        text=True,
    )
    return apply_result.returncode == 0


def install_dependencies(project_root: Path) -> bool:
    """Install npm dependencies.

    Returns:
        True if successful.
    """
    print_status("Installing dependencies...")
    result = run_command(["npm", "ci"], cwd=project_root, timeout=600)
    return result.returncode == 0


def build_application(project_root: Path) -> bool:
    """Build the application.

    Returns:
        True if successful.
    """
    print_status("Building application...")
    result = run_command(["npm", "run", "build"], cwd=project_root, timeout=600)
    return result.returncode == 0


def deploy_application(namespace: str) -> bool:
    """Deploy the application to Kubernetes.

    Returns:
        True if successful.
    """
    print_status("Creating application deployment...")

    manifest = DEPLOYMENT_MANIFEST.format(namespace=namespace)

    result = subprocess.run(
        ["kubectl", "apply", "-f", "-"],
        input=manifest,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def wait_for_deployment(namespace: str) -> bool:
    """Wait for deployment to be ready.

    Returns:
        True if deployment is ready.
    """
    print_status("Waiting for deployment to be ready...")
    result = run_command(
        [
            "kubectl", "wait", "--for=condition=available",
            "--timeout=300s", "deployment/vibecode-webgui",
            "-n", namespace,
        ],
        timeout=310,
    )
    if result.returncode != 0:
        print_warning("Deployment may still be starting. Check with: kubectl get pods -n " + namespace)
        return False
    return True


def show_pod_status(namespace: str) -> None:
    """Display pod status."""
    print_status("Checking pod status...")
    result = run_command(["kubectl", "get", "pods", "-n", namespace], capture=False)


def show_deployment_info(namespace: str) -> None:
    """Display deployment information."""
    print_header("DEPLOYMENT COMPLETE")

    info = f"""Application deployed to existing cluster!

Access Information:
- Application: http://localhost:30000
- Cluster: vibecode-kind-local
- Namespace: {namespace}

Useful Commands:
# Check application status
kubectl get pods -n {namespace}

# View application logs
kubectl logs -n {namespace} -l app=vibecode-webgui

# Port forward (alternative access)
kubectl port-forward -n {namespace} service/vibecode-webgui 3000:3000

# Scale application
kubectl scale deployment vibecode-webgui -n {namespace} --replicas=2

# Delete deployment
kubectl delete namespace {namespace}

Your existing PostgreSQL container is still running on localhost:5432
"""
    print(info)


def get_project_root() -> Path:
    """Get the project root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent


def run_deployment(
    skip_build: bool = False,
    namespace: str = NAMESPACE,
) -> int:
    """Run the deployment process.

    Args:
        skip_build: Skip npm install and build steps.
        namespace: Kubernetes namespace to deploy to.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    print_header("DEPLOYING TO EXISTING CLUSTER")

    # Check cluster connectivity
    if not check_cluster_connectivity():
        return 1

    # Set context
    if not set_cluster_context():
        return 1

    # Create namespace
    if not create_namespace(namespace):
        print_error("Failed to create namespace")
        return 1

    project_root = get_project_root()

    if not skip_build:
        # Install dependencies
        print_status("Building and deploying application...")
        if not install_dependencies(project_root):
            print_error("Failed to install dependencies")
            return 1

        # Build application
        if not build_application(project_root):
            print_error("Failed to build application")
            return 1

    # Deploy application
    if not deploy_application(namespace):
        print_error("Failed to deploy application")
        return 1

    # Wait for deployment
    wait_for_deployment(namespace)

    # Show status
    show_pod_status(namespace)

    # Show info
    show_deployment_info(namespace)

    print_success("Deployment completed!")
    print_status("Try accessing: http://localhost:30000")

    return 0


def main() -> int:
    """Main entry point."""
    return run_deployment()


if __name__ == "__main__":
    sys.exit(main())
