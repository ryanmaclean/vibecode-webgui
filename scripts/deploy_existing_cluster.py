#!/usr/bin/env python3
"""Deploy to Existing Cluster Script.

Works with your current KIND cluster and PostgreSQL setup.
"""

from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from textwrap import dedent


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    blue: str = "\033[0;34m"
    cyan: str = "\033[0;36m"
    reset: str = "\033[0m"


COLORS = Colors()

NAMESPACE = "vibecode-platform"
CLUSTER_CONTEXT = "kind-vibecode-kind-local"


def print_header(message: str) -> None:
    """Print a cyan header with borders."""
    print()
    print(f"{COLORS.cyan}================================================{COLORS.reset}")
    print(f"{COLORS.cyan}{message}{COLORS.reset}")
    print(f"{COLORS.cyan}================================================{COLORS.reset}")
    print()


def print_status(message: str) -> None:
    """Print blue status message."""
    print(f"{COLORS.blue}[INFO]{COLORS.reset} {message}")


def print_success(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}[SUCCESS]{COLORS.reset} {message}")


def print_warning(message: str) -> None:
    """Print yellow warning message."""
    print(f"{COLORS.yellow}[WARNING]{COLORS.reset} {message}")


def print_error(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}[ERROR]{COLORS.reset} {message}")


def run_command(
    cmd: list[str],
    *,
    check: bool = True,
    capture_output: bool = False,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return the result."""
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        text=True,
        cwd=cwd,
    )


def check_cluster_connectivity() -> bool:
    """Check if the KIND cluster is accessible.

    Returns True if connected, False otherwise.
    """
    print_status("Checking cluster connectivity...")
    try:
        run_command(
            ["kubectl", "cluster-info", "--context", CLUSTER_CONTEXT],
            capture_output=True,
        )
        return True
    except subprocess.CalledProcessError:
        print_error("Cannot connect to KIND cluster. Is it running?")
        return False


def set_cluster_context() -> bool:
    """Set kubectl context to the KIND cluster.

    Returns True if successful, False otherwise.
    """
    try:
        run_command(["kubectl", "config", "use-context", CLUSTER_CONTEXT])
        print_success(f"Connected to KIND cluster: vibecode-kind-local")
        return True
    except subprocess.CalledProcessError:
        print_error(f"Failed to set context to {CLUSTER_CONTEXT}")
        return False


def create_namespace() -> bool:
    """Create the namespace if it doesn't exist.

    Returns True if successful, False otherwise.
    """
    print_status(f"Creating namespace: {NAMESPACE}")
    try:
        # Use dry-run to generate YAML, then apply
        result = run_command(
            ["kubectl", "create", "namespace", NAMESPACE, "--dry-run=client", "-o", "yaml"],
            capture_output=True,
        )
        apply_proc = subprocess.run(
            ["kubectl", "apply", "-f", "-"],
            input=result.stdout,
            text=True,
            check=True,
        )
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Failed to create namespace: {e}")
        return False


def install_dependencies(project_root: Path) -> bool:
    """Install npm dependencies.

    Returns True if successful, False otherwise.
    """
    print_status("Installing dependencies...")
    try:
        run_command(["npm", "ci"], cwd=project_root)
        return True
    except subprocess.CalledProcessError:
        print_error("Failed to install dependencies")
        return False


def build_application(project_root: Path) -> bool:
    """Build the application.

    Returns True if successful, False otherwise.
    """
    print_status("Building application...")
    try:
        run_command(["npm", "run", "build"], cwd=project_root)
        return True
    except subprocess.CalledProcessError:
        print_error("Failed to build application")
        return False


def get_deployment_manifest() -> str:
    """Generate the Kubernetes deployment manifest."""
    return dedent(f"""\
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: vibecode-webgui
          namespace: {NAMESPACE}
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
          namespace: {NAMESPACE}
        spec:
          selector:
            app: vibecode-webgui
          ports:
          - port: 3000
            targetPort: 3000
            nodePort: 30000
          type: NodePort
    """)


def deploy_application() -> bool:
    """Deploy the application to Kubernetes.

    Returns True if successful, False otherwise.
    """
    print_status("Creating application deployment...")
    try:
        manifest = get_deployment_manifest()
        subprocess.run(
            ["kubectl", "apply", "-f", "-"],
            input=manifest,
            text=True,
            check=True,
        )
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Failed to deploy application: {e}")
        return False


def wait_for_deployment() -> bool:
    """Wait for the deployment to be ready.

    Returns True if ready, False if timeout or error.
    """
    print_status("Waiting for deployment to be ready...")
    try:
        run_command([
            "kubectl", "wait",
            "--for=condition=available",
            "--timeout=300s",
            f"deployment/vibecode-webgui",
            "-n", NAMESPACE,
        ])
        return True
    except subprocess.CalledProcessError:
        print_warning("Deployment may still be starting. Check with: kubectl get pods -n " + NAMESPACE)
        return False


def show_pod_status() -> None:
    """Display pod status."""
    print_status("Checking pod status...")
    run_command(["kubectl", "get", "pods", "-n", NAMESPACE], check=False)


def show_completion_info() -> None:
    """Display deployment completion information."""
    print_header("DEPLOYMENT COMPLETE")

    info = f"""\
\U0001f389 Application deployed to existing cluster!

Access Information:
- Application: http://localhost:30000
- Cluster: vibecode-kind-local
- Namespace: {NAMESPACE}

Useful Commands:
# Check application status
kubectl get pods -n {NAMESPACE}

# View application logs
kubectl logs -n {NAMESPACE} -l app=vibecode-webgui

# Port forward (alternative access)
kubectl port-forward -n {NAMESPACE} service/vibecode-webgui 3000:3000

# Scale application
kubectl scale deployment vibecode-webgui -n {NAMESPACE} --replicas=2

# Delete deployment
kubectl delete namespace {NAMESPACE}

Your existing PostgreSQL container is still running on localhost:5432
"""
    print(info)

    print_success("Deployment completed! \U0001f680")
    print_status("Try accessing: http://localhost:30000")


def main() -> int:
    """Main entry point."""
    print_header("DEPLOYING TO EXISTING CLUSTER")

    # Determine paths
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    # Step 1: Check cluster connectivity
    if not check_cluster_connectivity():
        return 1

    # Step 2: Set cluster context
    if not set_cluster_context():
        return 1

    # Step 3: Create namespace
    if not create_namespace():
        return 1

    # Step 4: Build and deploy
    print_status("Building and deploying application...")
    os.chdir(project_root)

    # Step 5: Install dependencies
    if not install_dependencies(project_root):
        return 1

    # Step 6: Build application
    if not build_application(project_root):
        return 1

    # Step 7: Deploy to Kubernetes
    if not deploy_application():
        return 1

    # Step 8: Wait for deployment
    wait_for_deployment()

    # Step 9: Show pod status
    show_pod_status()

    # Step 10: Show completion info
    show_completion_info()

    return 0


if __name__ == "__main__":
    sys.exit(main())
