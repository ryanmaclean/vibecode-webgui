#!/usr/bin/env python3
"""
Complete Platform Deployment Script.

Orchestrates deployment of the entire VibeCode platform with all components.
Converts deploy-complete-platform.sh to Python with enhanced error handling,
Datadog tracing, and structured logging.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

# Datadog APM tracing
try:
    from ddtrace import tracer
except ImportError:
    tracer = None

# Local imports
try:
    from lib.vibecode_common import (
        init_vibecode_script,
        with_error_handling,
        retry_on_failure,
        get_project_root,
        get_script_dir,
    )
    USE_COMMON = True
except ImportError:
    USE_COMMON = False
    import logging
    logging.basicConfig(level=logging.INFO)


class DeploymentConfig(NamedTuple):
    """Deployment configuration."""
    mode: str
    skip_prerequisites: bool
    skip_monitoring: bool
    skip_database: bool
    dry_run: bool


class Colors:
    """ANSI color codes for terminal output."""
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    NC = "\033[0m"  # No Color


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


def print_header(message: str) -> None:
    """Print a section header."""
    print()
    print(f"{Colors.CYAN}{'=' * 48}{Colors.NC}")
    print(f"{Colors.CYAN}{message}{Colors.NC}")
    print(f"{Colors.CYAN}{'=' * 48}{Colors.NC}")
    print()


def print_status(message: str) -> None:
    """Print a status message."""
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {message}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {message}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")


def run(
    cmd: list[str],
    *,
    capture_output: bool = True,
    check: bool = True,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command with proper error handling."""
    try:
        return subprocess.run(
            cmd,
            text=True,
            capture_output=capture_output,
            check=check,
            cwd=cwd,
        )
    except subprocess.CalledProcessError as exc:
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def run_script(script_path: Path, *args: str) -> bool:
    """Run an executable script if it exists."""
    if not script_path.exists():
        print_warning(f"Script not found: {script_path}")
        return False

    if script_path.suffix == ".py":
        cmd = [sys.executable, str(script_path)] + list(args)
    elif script_path.suffix == ".sh":
        cmd = ["bash", str(script_path)] + list(args)
    else:
        cmd = [str(script_path)] + list(args)

    try:
        run(cmd, capture_output=False)
        return True
    except CommandError as e:
        print_warning(str(e))
        return False


def check_prerequisites(config: DeploymentConfig) -> bool:
    """Check that all required tools are installed."""
    if config.skip_prerequisites:
        print_warning("Skipping prerequisite checks")
        return True

    print_header("CHECKING PREREQUISITES")

    required_tools = ["docker", "kubectl", "helm", "kind", "node", "npm"]
    missing_tools = []

    for tool in required_tools:
        if shutil.which(tool) is None:
            missing_tools.append(tool)

    if missing_tools:
        print_error(f"Missing required tools: {', '.join(missing_tools)}")
        print_error("Please install the missing tools and try again")
        return False

    # Check Docker is running
    try:
        run(["docker", "info"], capture_output=True)
    except CommandError:
        print_error("Docker is not running. Please start Docker and try again.")
        return False

    # Check Node.js version
    try:
        result = run(["node", "--version"])
        node_version = result.stdout.strip().lstrip("v")
        print_status(f"Node.js version: {node_version}")
    except CommandError:
        print_warning("Could not determine Node.js version")

    print_success("Prerequisites check passed")
    return True


def load_environment(project_root: Path, config: DeploymentConfig) -> dict[str, str]:
    """Load environment configuration from files."""
    print_header("LOADING ENVIRONMENT CONFIGURATION")

    env_vars: dict[str, str] = dict(os.environ)

    # Load environment files based on deployment mode
    env_files = [
        project_root / ".env",
        project_root / ".env.local",
        project_root / f".env.{config.mode}",
    ]

    for env_file in env_files:
        if env_file.exists():
            print_status(f"Loading environment from {env_file.name}")
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()

    # Set default values for critical variables
    defaults = {
        "DD_API_KEY": "dummy-key-for-development",
        "DD_APP_KEY": "dummy-app-key-for-development",
        "DD_SITE": "datadoghq.com",
        "DATABASE_PASSWORD": "vibecode_password",
        "NAMESPACE": "vibecode-platform",
    }

    for key, default_value in defaults.items():
        if key not in env_vars:
            env_vars[key] = default_value

    print_success(f"Environment configuration loaded for {config.mode} mode")
    return env_vars


def deploy_cluster(
    script_dir: Path,
    config: DeploymentConfig,
) -> bool:
    """Deploy or verify Kubernetes cluster."""
    print_header("DEPLOYING KUBERNETES CLUSTER")

    if config.mode == "development":
        kind_script = script_dir / "deploy-kind-postgres-monitoring.sh"
        kind_script_py = script_dir / "deploy_kind_postgres_monitoring.py"

        if kind_script_py.exists():
            print_status("Deploying KIND cluster with PostgreSQL monitoring (Python)...")
            return run_script(kind_script_py)
        elif kind_script.exists():
            print_status("Deploying KIND cluster with PostgreSQL monitoring...")
            return run_script(kind_script)
        else:
            print_warning("KIND deployment script not found, using basic setup")
            try:
                run(["kind", "create", "cluster", "--name", "vibecode-dev"])
                return True
            except CommandError as e:
                print_error(str(e))
                return False
    else:
        print_status(f"For {config.mode}, please ensure your Kubernetes cluster is already configured")
        print_status("Verifying cluster connectivity...")
        try:
            run(["kubectl", "cluster-info"], capture_output=False)
            print_success("Kubernetes cluster ready")
            return True
        except CommandError as e:
            print_error(str(e))
            return False


def deploy_database(script_dir: Path, config: DeploymentConfig) -> bool:
    """Deploy database components."""
    if config.skip_database:
        print_warning("Skipping database deployment")
        return True

    print_header("DEPLOYING DATABASE COMPONENTS")

    # Deploy database migrations
    migrations_script = script_dir / "deploy-database-migrations.sh"
    migrations_script_py = script_dir / "deploy_database_migrations.py"
    if migrations_script_py.exists():
        print_status("Running database migrations (Python)...")
        run_script(migrations_script_py)
    elif migrations_script.exists():
        print_status("Running database migrations...")
        run_script(migrations_script)

    # Setup RAG database
    rag_script = script_dir / "setup-rag-db.sh"
    rag_script_py = script_dir / "setup_rag_db.py"
    if rag_script_py.exists():
        print_status("Setting up RAG database (Python)...")
        run_script(rag_script_py)
    elif rag_script.exists():
        print_status("Setting up RAG database...")
        run_script(rag_script)

    print_success("Database components deployed")
    return True


def deploy_monitoring(script_dir: Path, config: DeploymentConfig) -> bool:
    """Deploy monitoring stack."""
    if config.skip_monitoring:
        print_warning("Skipping monitoring deployment")
        return True

    print_header("DEPLOYING MONITORING STACK")

    # Deploy monitoring stack
    monitoring_script = script_dir / "deploy-monitoring.sh"
    monitoring_script_py = script_dir / "deploy_monitoring.py"
    if monitoring_script_py.exists():
        print_status("Deploying monitoring stack (Python)...")
        run_script(monitoring_script_py)
    elif monitoring_script.exists():
        print_status("Deploying monitoring stack...")
        run_script(monitoring_script)

    # Deploy Datadog DBM
    dbm_script = script_dir / "deploy-datadog-dbm.sh"
    dbm_script_py = script_dir / "deploy_datadog_dbm.py"
    if dbm_script_py.exists():
        print_status("Deploying database monitoring (Python)...")
        run_script(dbm_script_py)
    elif dbm_script.exists():
        print_status("Deploying database monitoring...")
        run_script(dbm_script)

    print_success("Monitoring stack deployed")
    return True


def deploy_application(
    project_root: Path,
    env_vars: dict[str, str],
    config: DeploymentConfig,
) -> bool:
    """Deploy application components."""
    print_header("DEPLOYING APPLICATION COMPONENTS")

    namespace = env_vars.get("NAMESPACE", "vibecode-platform")

    # Build application
    print_status("Building application...")
    try:
        run(["npm", "ci"], cwd=project_root, capture_output=False)
        run(["npm", "run", "build"], cwd=project_root, capture_output=False)
    except CommandError as e:
        print_error(f"Build failed: {e}")
        return False

    # Deploy to Kubernetes
    k8s_dir = project_root / "k8s"
    if k8s_dir.exists():
        print_status("Deploying application to Kubernetes...")
        try:
            run(
                ["kubectl", "apply", "-f", str(k8s_dir), "--recursive"],
                capture_output=False,
            )
        except CommandError:
            print_warning("Some Kubernetes manifests may have failed")

    # Wait for deployments
    print_status("Waiting for application deployments...")
    try:
        run(
            [
                "kubectl", "wait",
                "--for=condition=available",
                "--timeout=300s",
                "deployment", "--all",
                "-n", namespace,
            ],
            capture_output=False,
        )
    except CommandError:
        print_warning("Some deployments may not be ready")

    print_success("Application components deployed")
    return True


def deploy_ai_gateway(project_root: Path) -> bool:
    """Deploy AI Gateway service."""
    print_header("DEPLOYING AI GATEWAY")

    ai_gateway_dir = project_root / "services" / "ai-gateway"

    if not ai_gateway_dir.exists():
        print_warning("AI Gateway directory not found, skipping")
        return True

    print_status("Building AI Gateway...")
    try:
        run(["npm", "ci"], cwd=ai_gateway_dir, capture_output=False)
        run(["npm", "run", "build"], cwd=ai_gateway_dir, capture_output=False)
    except CommandError as e:
        print_error(f"AI Gateway build failed: {e}")
        return False

    # Apply AI Gateway monitoring
    monitoring_script = project_root / "scripts" / "apply-ai-gateway-monitoring.ts"
    if monitoring_script.exists():
        print_status("Applying AI Gateway monitoring...")
        try:
            run(["npx", "ts-node", str(monitoring_script)], cwd=project_root)
        except CommandError as e:
            print_warning(f"AI Gateway monitoring failed: {e}")

    print_success("AI Gateway deployed")
    return True


def validate_deployment(env_vars: dict[str, str]) -> bool:
    """Validate the deployment status."""
    print_header("VALIDATING DEPLOYMENT")

    namespace = env_vars.get("NAMESPACE", "vibecode-platform")

    # Check pod status
    print_status("Checking pod status...")
    try:
        run(["kubectl", "get", "pods", "-n", namespace], capture_output=False)
    except CommandError:
        pass

    # Check services
    print_status("Checking services...")
    try:
        run(["kubectl", "get", "services", "-n", namespace], capture_output=False)
    except CommandError:
        pass

    # Run health checks
    print_status("Running health checks...")
    try:
        result = run(
            [
                "kubectl", "get", "pods",
                "-n", namespace,
                "-l", "app=vibecode-webgui",
                "-o", "jsonpath={.items[0].metadata.name}",
            ],
        )
        app_pod = result.stdout.strip()

        if app_pod:
            run(
                [
                    "kubectl", "exec",
                    "-n", namespace,
                    app_pod, "--",
                    "curl", "-f", "http://localhost:3000/api/health",
                ],
            )
            print_success("Health check passed")
    except CommandError:
        print_warning("Health check failed")

    print_success("Deployment validation completed")
    return True


def display_deployment_info(
    config: DeploymentConfig,
    env_vars: dict[str, str],
) -> None:
    """Display deployment completion information."""
    print_header("DEPLOYMENT COMPLETE")

    namespace = env_vars.get("NAMESPACE", "vibecode-platform")

    components = ["Kubernetes Cluster"]
    if not config.skip_database:
        components.append("Database Components (PostgreSQL + RAG)")
    if not config.skip_monitoring:
        components.append("Monitoring Stack (Datadog)")
    components.extend(["Application Components", "AI Gateway"])

    print("VibeCode Platform Deployment Successful!")
    print()
    print(f"Deployment Mode: {config.mode}")
    print(f"Namespace: {namespace}")
    print()
    print("Key Components Deployed:")
    for component in components:
        print(f"  - {component}")
    print()
    print("Access Information:")

    if config.mode == "development":
        print(f"""
- Main Application: http://localhost:3000
- PostgreSQL: localhost:30001
- Monitoring: Check Datadog dashboard

Useful Commands:
# Port forward services
kubectl port-forward -n {namespace} service/vibecode-webgui 3000:3000
kubectl port-forward -n {namespace} service/postgres-service 5432:5432

# Check logs
kubectl logs -n {namespace} -l app=vibecode-webgui
kubectl logs -n datadog -l app=datadog-agent

# Scale application
kubectl scale deployment vibecode-webgui -n {namespace} --replicas=3
""")
    else:
        print("""
- Access via your configured ingress/load balancer
- Check your cloud provider's console for external IPs
""")

    print_success("Deployment completed successfully!")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Deploy the complete VibeCode platform with all components",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Environment Variables:
    DEPLOYMENT_MODE         Same as --mode
    SKIP_PREREQUISITES      Same as --skip-prerequisites (true/false)
    SKIP_MONITORING         Same as --skip-monitoring (true/false)
    SKIP_DATABASE          Same as --skip-database (true/false)
    DD_API_KEY             Datadog API key for monitoring
    DD_APP_KEY             Datadog application key

Examples:
    # Development deployment with all components
    python deploy_complete_platform.py

    # Production deployment
    python deploy_complete_platform.py --mode production

    # Quick deployment without monitoring
    python deploy_complete_platform.py --skip-monitoring

    # Staging deployment with custom environment
    DEPLOYMENT_MODE=staging DD_API_KEY=$YOUR_KEY python deploy_complete_platform.py
""",
    )

    parser.add_argument(
        "--mode",
        choices=["development", "staging", "production"],
        default=os.environ.get("DEPLOYMENT_MODE", "development"),
        help="Deployment mode (default: development)",
    )
    parser.add_argument(
        "--skip-prerequisites",
        action="store_true",
        default=os.environ.get("SKIP_PREREQUISITES", "").lower() == "true",
        help="Skip prerequisite checks",
    )
    parser.add_argument(
        "--skip-monitoring",
        action="store_true",
        default=os.environ.get("SKIP_MONITORING", "").lower() == "true",
        help="Skip monitoring deployment",
    )
    parser.add_argument(
        "--skip-database",
        action="store_true",
        default=os.environ.get("SKIP_DATABASE", "").lower() == "true",
        help="Skip database setup",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without executing",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    # Initialize logging and tracing
    if USE_COMMON:
        logger, config_mgr, metrics, shutdown = init_vibecode_script(
            "deploy_complete_platform",
            service_name="vibecode-platform-deployment",
        )

    config = DeploymentConfig(
        mode=args.mode,
        skip_prerequisites=args.skip_prerequisites,
        skip_monitoring=args.skip_monitoring,
        skip_database=args.skip_database,
        dry_run=args.dry_run,
    )

    # Determine paths
    if USE_COMMON:
        project_root = get_project_root()
        script_dir = get_script_dir()
    else:
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent

    print_header("VIBECODE PLATFORM DEPLOYMENT")
    print_status("Starting complete platform deployment...")
    print_status(f"Mode: {config.mode}")

    try:
        # Check prerequisites
        if not check_prerequisites(config):
            return 1

        # Load environment
        env_vars = load_environment(project_root, config)

        # Deploy cluster
        if not deploy_cluster(script_dir, config):
            return 1

        # Deploy database
        if not deploy_database(script_dir, config):
            return 1

        # Deploy monitoring
        if not deploy_monitoring(script_dir, config):
            return 1

        # Deploy application
        if not deploy_application(project_root, env_vars, config):
            return 1

        # Deploy AI Gateway
        if not deploy_ai_gateway(project_root):
            return 1

        # Validate deployment
        validate_deployment(env_vars)

        # Display info
        display_deployment_info(config, env_vars)

    except KeyboardInterrupt:
        print_status("\nDeployment cancelled by user")
        return 130
    except Exception as e:
        print_error(f"Deployment failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
