#!/usr/bin/env python3
"""Deploy to Existing Cluster Script.

Works with your current KIND cluster and PostgreSQL setup.
"""

import argparse
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
CYAN = '\033[0;36m'
NC = '\033[0m'

# Kubernetes deployment manifest template
DEPLOYMENT_MANIFEST = '''apiVersion: apps/v1
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
'''


@dataclass
class ClusterConfig:
    """Cluster configuration."""

    namespace: str = "vibecode-platform"
    context: str = "kind-vibecode-kind-local"
    node_port: int = 30000
    timeout: int = 300


def print_header(message: str) -> None:
    """Print a header message."""
    print()
    print(f"{CYAN}{'=' * 48}{NC}")
    print(f"{CYAN}{message}{NC}")
    print(f"{CYAN}{'=' * 48}{NC}")
    print()


def print_status(message: str) -> None:
    """Print status message."""
    print(f"{BLUE}[INFO]{NC} {message}")


def print_success(message: str) -> None:
    """Print success message."""
    print(f"{GREEN}[SUCCESS]{NC} {message}")


def print_warning(message: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}[WARNING]{NC} {message}")


def print_error(message: str) -> None:
    """Print error message."""
    print(f"{RED}[ERROR]{NC} {message}")


def run_command(
    cmd: list[str],
    check: bool = False,
    capture: bool = True
) -> tuple[int, str, str]:
    """Run a command and return result.

    Args:
        cmd: Command and arguments.
        check: Whether to raise on error.
        capture: Whether to capture output.

    Returns:
        Tuple of (returncode, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            check=check
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return e.returncode, e.stdout or "", e.stderr or ""
    except FileNotFoundError:
        return -1, "", "command not found"


def kubectl(args: list[str], check: bool = False) -> tuple[int, str, str]:
    """Run kubectl command.

    Args:
        args: kubectl arguments.
        check: Whether to raise on error.

    Returns:
        Tuple of (returncode, stdout, stderr).
    """
    return run_command(["kubectl"] + args, check=check)


def check_cluster_connectivity(config: ClusterConfig) -> bool:
    """Check if cluster is accessible.

    Args:
        config: Cluster configuration.

    Returns:
        True if cluster is accessible.
    """
    print_status("Checking cluster connectivity...")

    rc, _, _ = kubectl(["cluster-info", "--context", config.context])
    if rc != 0:
        print_error("Cannot connect to KIND cluster. Is it running?")
        return False

    return True


def set_cluster_context(config: ClusterConfig) -> bool:
    """Set kubectl context to the cluster.

    Args:
        config: Cluster configuration.

    Returns:
        True if successful.
    """
    rc, _, _ = kubectl(["config", "use-context", config.context])
    if rc != 0:
        print_error(f"Failed to set context to {config.context}")
        return False

    print_success(f"Connected to KIND cluster: {config.context.replace('kind-', '')}")
    return True


def create_namespace(config: ClusterConfig) -> bool:
    """Create namespace if it doesn't exist.

    Args:
        config: Cluster configuration.

    Returns:
        True if successful.
    """
    print_status(f"Creating namespace: {config.namespace}")

    # Generate namespace yaml and apply
    rc, yaml_out, _ = kubectl([
        "create", "namespace", config.namespace,
        "--dry-run=client", "-o", "yaml"
    ])

    if rc != 0:
        print_error("Failed to generate namespace manifest")
        return False

    # Apply the manifest
    proc = subprocess.run(
        ["kubectl", "apply", "-f", "-"],
        input=yaml_out,
        capture_output=True,
        text=True
    )

    if proc.returncode != 0:
        print_error("Failed to create namespace")
        return False

    return True


def build_application(project_root: Path) -> bool:
    """Build the application.

    Args:
        project_root: Project root directory.

    Returns:
        True if successful.
    """
    print_status("Installing dependencies...")
    rc, _, stderr = run_command(["npm", "ci"], check=False)
    if rc != 0:
        print_error(f"Failed to install dependencies: {stderr}")
        return False

    print_status("Building application...")
    rc, _, stderr = run_command(["npm", "run", "build"], check=False)
    if rc != 0:
        print_error(f"Failed to build application: {stderr}")
        return False

    return True


def deploy_application(config: ClusterConfig) -> bool:
    """Deploy the application to the cluster.

    Args:
        config: Cluster configuration.

    Returns:
        True if successful.
    """
    print_status("Creating application deployment...")

    manifest = DEPLOYMENT_MANIFEST.format(namespace=config.namespace)

    proc = subprocess.run(
        ["kubectl", "apply", "-f", "-"],
        input=manifest,
        capture_output=True,
        text=True
    )

    if proc.returncode != 0:
        print_error(f"Failed to apply deployment: {proc.stderr}")
        return False

    return True


def wait_for_deployment(config: ClusterConfig) -> bool:
    """Wait for deployment to be ready.

    Args:
        config: Cluster configuration.

    Returns:
        True if deployment is ready.
    """
    print_status("Waiting for deployment to be ready...")

    rc, _, _ = kubectl([
        "wait", "--for=condition=available",
        f"--timeout={config.timeout}s",
        "deployment/vibecode-webgui",
        "-n", config.namespace
    ])

    if rc != 0:
        print_warning("Deployment may still be starting. Check with: "
                     f"kubectl get pods -n {config.namespace}")
        return False

    return True


def show_pod_status(config: ClusterConfig) -> None:
    """Show pod status.

    Args:
        config: Cluster configuration.
    """
    print_status("Checking pod status...")
    kubectl(["get", "pods", "-n", config.namespace], check=False)


def display_completion_info(config: ClusterConfig) -> None:
    """Display deployment completion information.

    Args:
        config: Cluster configuration.
    """
    print_header("DEPLOYMENT COMPLETE")

    info = f'''🎉 Application deployed to existing cluster!

Access Information:
- Application: http://localhost:{config.node_port}
- Cluster: {config.context.replace('kind-', '')}
- Namespace: {config.namespace}

Useful Commands:
# Check application status
kubectl get pods -n {config.namespace}

# View application logs
kubectl logs -n {config.namespace} -l app=vibecode-webgui

# Port forward (alternative access)
kubectl port-forward -n {config.namespace} service/vibecode-webgui 3000:3000

# Scale application
kubectl scale deployment vibecode-webgui -n {config.namespace} --replicas=2

# Delete deployment
kubectl delete namespace {config.namespace}

Your existing PostgreSQL container is still running on localhost:5432
'''
    print(info)

    print_success("Deployment completed! 🚀")
    print_status(f"Try accessing: http://localhost:{config.node_port}")


def main(
    namespace: Optional[str] = None,
    context: Optional[str] = None,
    skip_build: bool = False
) -> int:
    """Main deployment function.

    Args:
        namespace: Kubernetes namespace.
        context: Kubernetes context.
        skip_build: Skip build step.

    Returns:
        Exit code.
    """
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    config = ClusterConfig(
        namespace=namespace or "vibecode-platform",
        context=context or "kind-vibecode-kind-local"
    )

    print_header("DEPLOYING TO EXISTING CLUSTER")

    # Check cluster connectivity
    if not check_cluster_connectivity(config):
        return 1

    # Set context
    if not set_cluster_context(config):
        return 1

    # Create namespace
    if not create_namespace(config):
        return 1

    # Build application
    if not skip_build:
        print_status("Building and deploying application...")
        if not build_application(project_root):
            return 1

    # Deploy application
    if not deploy_application(config):
        return 1

    # Wait for deployment
    wait_for_deployment(config)

    # Show pod status
    show_pod_status(config)

    # Display completion info
    display_completion_info(config)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy to Existing KIND Cluster"
    )
    parser.add_argument(
        '-n', '--namespace',
        default='vibecode-platform',
        help='Kubernetes namespace (default: vibecode-platform)'
    )
    parser.add_argument(
        '-c', '--context',
        default='kind-vibecode-kind-local',
        help='Kubernetes context (default: kind-vibecode-kind-local)'
    )
    parser.add_argument(
        '--skip-build',
        action='store_true',
        help='Skip the build step'
    )

    args = parser.parse_args()
    sys.exit(main(
        namespace=args.namespace,
        context=args.context,
        skip_build=args.skip_build
    ))
