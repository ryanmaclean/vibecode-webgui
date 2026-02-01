#!/usr/bin/env python3
"""
Deploy Authelia Authentication Server to VibeCode Platform

Enterprise-grade 2FA/SSO authentication with hardware key support.

Usage:
    python deploy_authelia.py
"""

import shutil
import subprocess
import sys
from pathlib import Path


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'


class AutheliaDeployer:
    """Handles Authelia deployment to Kubernetes."""

    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.k8s_dir = self.script_dir.parent / "k8s"
        self.cluster_name = "vibecode-cluster"
        self.auth_namespace = "vibecode-auth"
        self.storage_namespace = "vibecode-storage"

    def log_info(self, message: str) -> None:
        """Print info message."""
        print(f"{Color.GREEN}[INFO]{Color.NC} {message}")

    def log_warn(self, message: str) -> None:
        """Print warning message."""
        print(f"{Color.YELLOW}[WARN]{Color.NC} {message}")

    def log_error(self, message: str) -> None:
        """Print error message."""
        print(f"{Color.RED}[ERROR]{Color.NC} {message}")

    def run_cmd(
        self,
        cmd: list[str],
        check: bool = True,
        capture_output: bool = True,
    ) -> subprocess.CompletedProcess:
        """Run command."""
        return subprocess.run(
            cmd,
            capture_output=capture_output,
            text=True,
            check=check,
        )

    def check_prerequisites(self) -> bool:
        """Check prerequisites."""
        self.log_info("Checking prerequisites...")

        if not shutil.which("kubectl"):
            self.log_error("kubectl is not installed or not in PATH")
            return False

        result = self.run_cmd(
            ["kubectl", "cluster-info", "--context", f"kind-{self.cluster_name}"],
            check=False,
        )
        if result.returncode != 0:
            self.log_error(f"KIND cluster '{self.cluster_name}' is not running")
            self.log_error("Please start the cluster first")
            return False

        self.run_cmd(
            ["kubectl", "config", "use-context", f"kind-{self.cluster_name}"],
            check=False,
        )

        self.log_info("Prerequisites check passed")
        return True

    def deploy_databases(self) -> bool:
        """Deploy required databases."""
        self.log_info("Deploying PostgreSQL and Redis for Authelia...")

        # Create storage namespace
        self.run_cmd([
            "kubectl", "create", "namespace", self.storage_namespace,
            "--dry-run=client", "-o", "yaml",
        ], check=False)

        postgres_manifest = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: {namespace}
  labels:
    app: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 999
        runAsGroup: 999
        fsGroup: 999
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        env:
        - name: POSTGRES_DB
          value: authelia
        - name: POSTGRES_USER
          value: authelia
        - name: POSTGRES_PASSWORD
          value: authelia-db-password
        - name: POSTGRES_HOST_AUTH_METHOD
          value: md5
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        ports:
        - containerPort: 5432
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-data
        emptyDir: {{}}
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: {namespace}
  labels:
    app: postgres
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
    name: postgres
""".format(namespace=self.storage_namespace)

        redis_manifest = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: {namespace}
  labels:
    app: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 999
        runAsGroup: 999
        fsGroup: 999
      containers:
      - name: redis
        image: redis:8.1-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        emptyDir: {{}}
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: {namespace}
  labels:
    app: redis
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
    name: redis
""".format(namespace=self.storage_namespace)

        # Apply manifests
        proc = subprocess.run(
            ["kubectl", "apply", "-f", "-"],
            input=postgres_manifest + redis_manifest,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            self.log_error(f"Failed to deploy databases: {proc.stderr}")
            return False

        self.log_info("Waiting for databases to be ready...")

        self.run_cmd([
            "kubectl", "wait", "--for=condition=available",
            f"--timeout=300s", "deployment/postgres",
            "-n", self.storage_namespace,
        ], check=False)

        self.run_cmd([
            "kubectl", "wait", "--for=condition=available",
            f"--timeout=300s", "deployment/redis",
            "-n", self.storage_namespace,
        ], check=False)

        self.log_info("Databases deployed successfully")
        return True

    def deploy_authelia(self) -> bool:
        """Deploy Authelia."""
        self.log_info("Deploying Authelia authentication server...")

        # Create auth namespace
        subprocess.run(
            ["kubectl", "create", "namespace", self.auth_namespace,
             "--dry-run=client", "-o", "yaml"],
            capture_output=True,
        )

        # Apply Authelia configuration
        config_file = self.k8s_dir / "authelia" / "authelia-config.yaml"
        deployment_file = self.k8s_dir / "authelia" / "authelia-deployment.yaml"

        if config_file.exists():
            self.run_cmd(["kubectl", "apply", "-f", str(config_file)], check=False)

        if deployment_file.exists():
            self.run_cmd(["kubectl", "apply", "-f", str(deployment_file)], check=False)

        self.log_info("Waiting for Authelia to be ready...")
        self.run_cmd([
            "kubectl", "wait", "--for=condition=available",
            f"--timeout=300s", "deployment/authelia",
            "-n", self.auth_namespace,
        ], check=False)

        self.log_info("Authelia deployed successfully")
        return True

    def show_status(self) -> None:
        """Show deployment status."""
        self.log_info("Deployment Status:")
        print()

        print(f"Storage Namespace ({self.storage_namespace}):")
        self.run_cmd([
            "kubectl", "get", "pods", "-n", self.storage_namespace, "-o", "wide",
        ], check=False, capture_output=False)
        print()

        print(f"Authentication Namespace ({self.auth_namespace}):")
        self.run_cmd([
            "kubectl", "get", "pods", "-n", self.auth_namespace, "-o", "wide",
        ], check=False, capture_output=False)
        print()

        print("Services:")
        self.run_cmd([
            "kubectl", "get", "svc", "-n", self.storage_namespace,
        ], check=False, capture_output=False)
        self.run_cmd([
            "kubectl", "get", "svc", "-n", self.auth_namespace,
        ], check=False, capture_output=False)
        print()

        print("Ingress:")
        self.run_cmd([
            "kubectl", "get", "ingress", "-n", self.auth_namespace,
        ], check=False, capture_output=False)
        print()

    def show_connection_info(self) -> None:
        """Show connection information."""
        self.log_info("Authelia Connection Information:")
        print()
        print("  Authentication URL: http://auth.localhost:8090")
        print("  Default Users:")
        print("    - admin@vibecode.dev (password: password123)")
        print("    - dev@vibecode.dev (password: password123)")
        print("    - user@vibecode.dev (password: password123)")
        print()
        print("  Access via port-forward:")
        print(f"    kubectl port-forward -n {self.auth_namespace} svc/authelia 9091:9091")
        print("    Then visit: http://localhost:9091")
        print()
        print("  2FA Setup:")
        print("    1. Login with username/password")
        print("    2. Scan QR code with authenticator app")
        print("    3. Enter TOTP code to complete setup")
        print()
        print("  Logs:")
        print(f"    kubectl logs -n {self.auth_namespace} -l app=authelia -f")
        print()

    def run(self) -> int:
        """Run the deployment."""
        self.log_info("Starting Authelia deployment for VibeCode...")

        if not self.check_prerequisites():
            return 1

        if not self.deploy_databases():
            return 1

        if not self.deploy_authelia():
            return 1

        self.show_status()
        self.show_connection_info()

        self.log_info("Authelia deployment completed successfully!")
        self.log_info("The authentication server is now ready to protect your workspaces.")

        return 0


def main() -> int:
    """Main entry point."""
    deployer = AutheliaDeployer()
    return deployer.run()


if __name__ == "__main__":
    sys.exit(main())
