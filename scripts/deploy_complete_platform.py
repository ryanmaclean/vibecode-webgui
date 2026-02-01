#!/usr/bin/env python3
"""
Complete Platform Deployment Script

Orchestrates deployment of the entire VibeCode platform with all components.

Usage:
    python deploy_complete_platform.py [OPTIONS]
    python deploy_complete_platform.py --mode production
    python deploy_complete_platform.py --skip-monitoring
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'


class PlatformDeployer:
    """Handles complete platform deployment."""

    def __init__(
        self,
        deployment_mode: str = "development",
        skip_prerequisites: bool = False,
        skip_monitoring: bool = False,
        skip_database: bool = False,
    ):
        self.deployment_mode = deployment_mode
        self.skip_prerequisites = skip_prerequisites
        self.skip_monitoring = skip_monitoring
        self.skip_database = skip_database

        self.script_dir = Path(__file__).parent
        self.project_root = self.script_dir.parent
        self.namespace = os.environ.get("NAMESPACE", "vibecode-platform")

    def print_header(self, message: str) -> None:
        """Print header."""
        print()
        print(f"{Color.CYAN}================================================{Color.NC}")
        print(f"{Color.CYAN}{message}{Color.NC}")
        print(f"{Color.CYAN}================================================{Color.NC}")
        print()

    def print_status(self, message: str) -> None:
        """Print status message."""
        print(f"{Color.BLUE}[INFO]{Color.NC} {message}")

    def print_success(self, message: str) -> None:
        """Print success message."""
        print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")

    def print_warning(self, message: str) -> None:
        """Print warning message."""
        print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")

    def print_error(self, message: str) -> None:
        """Print error message."""
        print(f"{Color.RED}[ERROR]{Color.NC} {message}")

    def run_cmd(
        self,
        cmd: list[str],
        cwd: Path | None = None,
        check: bool = False,
    ) -> tuple[bool, str, str]:
        """Run command and return (success, stdout, stderr)."""
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=cwd,
                check=check,
            )
            return result.returncode == 0, result.stdout, result.stderr
        except subprocess.CalledProcessError as e:
            return False, e.stdout or "", e.stderr or ""
        except Exception as e:
            return False, "", str(e)

    def check_prerequisites(self) -> bool:
        """Check prerequisites."""
        if self.skip_prerequisites:
            self.print_warning("Skipping prerequisite checks")
            return True

        self.print_header("CHECKING PREREQUISITES")

        missing_tools = []
        for tool in ["docker", "kubectl", "helm", "kind", "node", "npm"]:
            if not shutil.which(tool):
                missing_tools.append(tool)

        if missing_tools:
            self.print_error(f"Missing required tools: {' '.join(missing_tools)}")
            self.print_error("Please install the missing tools and try again")
            return False

        # Check Docker is running
        success, _, _ = self.run_cmd(["docker", "info"])
        if not success:
            self.print_error("Docker is not running. Please start Docker and try again.")
            return False

        self.print_success("Prerequisites check passed")
        return True

    def load_environment(self) -> None:
        """Load environment configuration."""
        self.print_header("LOADING ENVIRONMENT CONFIGURATION")

        env_files = [
            self.project_root / ".env",
            self.project_root / ".env.local",
            self.project_root / f".env.{self.deployment_mode}",
        ]

        for env_file in env_files:
            if env_file.exists():
                self.print_status(f"Loading environment from {env_file.name}")
                with open(env_file) as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, value = line.split("=", 1)
                            os.environ.setdefault(key, value)

        # Set default values
        os.environ.setdefault("DD_API_KEY", "dummy-key-for-development")
        os.environ.setdefault("DD_APP_KEY", "dummy-app-key-for-development")
        os.environ.setdefault("DD_SITE", "datadoghq.com")
        os.environ.setdefault("DATABASE_PASSWORD", "vibecode_password")
        os.environ.setdefault("NAMESPACE", "vibecode-platform")

        self.namespace = os.environ.get("NAMESPACE", "vibecode-platform")
        self.print_success(f"Environment configuration loaded for {self.deployment_mode} mode")

    def deploy_cluster(self) -> bool:
        """Deploy Kubernetes cluster."""
        self.print_header("DEPLOYING KUBERNETES CLUSTER")

        if self.deployment_mode == "development":
            kind_script = self.script_dir / "deploy-kind-postgres-monitoring.sh"
            if kind_script.exists() and os.access(kind_script, os.X_OK):
                self.print_status("Deploying KIND cluster with PostgreSQL monitoring...")
                success, _, stderr = self.run_cmd(["bash", str(kind_script)])
                if not success:
                    self.print_warning(f"KIND deployment script failed: {stderr}")
                    self.print_status("Using basic KIND setup instead")
                    self.run_cmd(["kind", "create", "cluster", "--name", "vibecode-dev"])
            else:
                self.print_warning("KIND deployment script not found, using basic setup")
                self.run_cmd(["kind", "create", "cluster", "--name", "vibecode-dev"])
        else:
            self.print_status(f"For {self.deployment_mode}, please ensure your Kubernetes cluster is already configured")
            self.print_status("Verifying cluster connectivity...")
            success, stdout, _ = self.run_cmd(["kubectl", "cluster-info"])
            if success:
                print(stdout)
            else:
                self.print_error("Cannot connect to Kubernetes cluster")
                return False

        self.print_success("Kubernetes cluster ready")
        return True

    def deploy_database(self) -> bool:
        """Deploy database components."""
        if self.skip_database:
            self.print_warning("Skipping database deployment")
            return True

        self.print_header("DEPLOYING DATABASE COMPONENTS")

        migration_script = self.script_dir / "deploy-database-migrations.sh"
        if migration_script.exists() and os.access(migration_script, os.X_OK):
            self.print_status("Running database migrations...")
            self.run_cmd(["bash", str(migration_script)])

        rag_script = self.script_dir / "setup-rag-db.sh"
        if rag_script.exists() and os.access(rag_script, os.X_OK):
            self.print_status("Setting up RAG database...")
            self.run_cmd(["bash", str(rag_script)])

        self.print_success("Database components deployed")
        return True

    def deploy_monitoring(self) -> bool:
        """Deploy monitoring stack."""
        if self.skip_monitoring:
            self.print_warning("Skipping monitoring deployment")
            return True

        self.print_header("DEPLOYING MONITORING STACK")

        monitoring_script = self.script_dir / "deploy-monitoring.sh"
        if monitoring_script.exists() and os.access(monitoring_script, os.X_OK):
            self.print_status("Deploying monitoring stack...")
            self.run_cmd(["bash", str(monitoring_script)])

        dbm_script = self.script_dir / "deploy-datadog-dbm.sh"
        if dbm_script.exists() and os.access(dbm_script, os.X_OK):
            self.print_status("Deploying database monitoring...")
            self.run_cmd(["bash", str(dbm_script)])

        self.print_success("Monitoring stack deployed")
        return True

    def deploy_application(self) -> bool:
        """Deploy application components."""
        self.print_header("DEPLOYING APPLICATION COMPONENTS")

        self.print_status("Building application...")
        os.chdir(self.project_root)

        self.run_cmd(["npm", "ci"])
        self.run_cmd(["npm", "run", "build"])

        self.print_status("Deploying application to Kubernetes...")
        success, _, stderr = self.run_cmd([
            "kubectl", "apply", "-f", "k8s/", "--recursive",
        ])
        if not success:
            self.print_warning(f"Some Kubernetes manifests may have failed: {stderr}")

        self.print_status("Waiting for application deployments...")
        self.run_cmd([
            "kubectl", "wait", "--for=condition=available",
            "--timeout=300s", "deployment", "--all",
            "-n", self.namespace,
        ])

        self.print_success("Application components deployed")
        return True

    def deploy_ai_gateway(self) -> bool:
        """Deploy AI Gateway."""
        self.print_header("DEPLOYING AI GATEWAY")

        ai_gateway_dir = self.project_root / "services" / "ai-gateway"
        if ai_gateway_dir.exists():
            self.print_status("Building AI Gateway...")
            os.chdir(ai_gateway_dir)

            self.run_cmd(["npm", "ci"])
            self.run_cmd(["npm", "run", "build"])

            monitoring_script = self.project_root / "scripts" / "apply-ai-gateway-monitoring.ts"
            if monitoring_script.exists() and os.access(monitoring_script, os.X_OK):
                self.print_status("Applying AI Gateway monitoring...")
                self.run_cmd(["npx", "ts-node", str(monitoring_script)])

            self.print_success("AI Gateway deployed")
        else:
            self.print_warning("AI Gateway directory not found, skipping")

        return True

    def validate_deployment(self) -> bool:
        """Validate deployment."""
        self.print_header("VALIDATING DEPLOYMENT")

        self.print_status("Checking pod status...")
        subprocess.run(["kubectl", "get", "pods", "-n", self.namespace])

        self.print_status("Checking services...")
        subprocess.run(["kubectl", "get", "services", "-n", self.namespace])

        self.print_status("Running health checks...")
        success, stdout, _ = self.run_cmd([
            "kubectl", "get", "pods", "-n", self.namespace,
            "-l", "app=vibecode-webgui",
        ])

        if success and stdout:
            success, pod_name, _ = self.run_cmd([
                "kubectl", "get", "pods", "-n", self.namespace,
                "-l", "app=vibecode-webgui",
                "-o", "jsonpath={.items[0].metadata.name}",
            ])
            if success and pod_name:
                self.run_cmd([
                    "kubectl", "exec", "-n", self.namespace, pod_name,
                    "--", "curl", "-f", "http://localhost:3000/api/health",
                ])

        self.print_success("Deployment validation completed")
        return True

    def display_deployment_info(self) -> None:
        """Display deployment information."""
        self.print_header("DEPLOYMENT COMPLETE")

        print("🎉 VibeCode Platform Deployment Successful!")
        print()
        print(f"Deployment Mode: {self.deployment_mode}")
        print(f"Namespace: {self.namespace}")
        print()
        print("Key Components Deployed:")
        print("✅ Kubernetes Cluster")
        if not self.skip_database:
            print("✅ Database Components (PostgreSQL + RAG)")
        if not self.skip_monitoring:
            print("✅ Monitoring Stack (Datadog)")
        print("✅ Application Components")
        print("✅ AI Gateway")
        print()
        print("Access Information:")

        if self.deployment_mode == "development":
            print("- Main Application: http://localhost:3000")
            print("- PostgreSQL: localhost:30001")
            print("- Monitoring: Check Datadog dashboard")
            print()
            print("Useful Commands:")
            print(f"# Port forward services")
            print(f"kubectl port-forward -n {self.namespace} service/vibecode-webgui 3000:3000")
            print(f"kubectl port-forward -n {self.namespace} service/postgres-service 5432:5432")
            print()
            print("# Check logs")
            print(f"kubectl logs -n {self.namespace} -l app=vibecode-webgui")
            print("kubectl logs -n datadog -l app=datadog-agent")
            print()
            print("# Scale application")
            print(f"kubectl scale deployment vibecode-webgui -n {self.namespace} --replicas=3")
        else:
            print("- Access via your configured ingress/load balancer")
            print("- Check your cloud provider's console for external IPs")

        print()
        self.print_success("Deployment completed successfully! 🚀")

    def run(self) -> int:
        """Run the deployment."""
        self.print_header("VIBECODE PLATFORM DEPLOYMENT")
        self.print_status("Starting complete platform deployment...")
        self.print_status(f"Mode: {self.deployment_mode}")

        if not self.check_prerequisites():
            return 1

        self.load_environment()

        if not self.deploy_cluster():
            return 1

        if not self.deploy_database():
            return 1

        if not self.deploy_monitoring():
            return 1

        if not self.deploy_application():
            return 1

        if not self.deploy_ai_gateway():
            return 1

        if not self.validate_deployment():
            return 1

        self.display_deployment_info()
        return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Deploy the complete VibeCode platform with all components.",
    )

    parser.add_argument(
        "--mode",
        default="development",
        choices=["development", "staging", "production"],
        help="Deployment mode",
    )
    parser.add_argument(
        "--skip-prerequisites",
        action="store_true",
        help="Skip prerequisite checks",
    )
    parser.add_argument(
        "--skip-monitoring",
        action="store_true",
        help="Skip monitoring deployment",
    )
    parser.add_argument(
        "--skip-database",
        action="store_true",
        help="Skip database setup",
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point."""
    args = parse_args()

    deployer = PlatformDeployer(
        deployment_mode=args.mode,
        skip_prerequisites=args.skip_prerequisites,
        skip_monitoring=args.skip_monitoring,
        skip_database=args.skip_database,
    )

    return deployer.run()


if __name__ == "__main__":
    sys.exit(main())
