#!/usr/bin/env python3

# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Security Setup Script

Provisions namespaces, secrets, and local environment files.

Usage:
    python setup.py
"""

import os
import secrets
import shutil
import subprocess
import sys
from base64 import b64encode
from dataclasses import dataclass
from getpass import getpass
from pathlib import Path


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class SecretsConfig:
    """Collected secrets configuration."""
    dd_api_key: str = ""
    openrouter_api_key: str = ""
    claude_api_key: str = ""
    dd_cluster_agent_token: str = ""
    jwt_secret: str = ""
    session_secret: str = ""
    nextauth_secret: str = ""


def print_step(message: str) -> None:
    """Print a step message."""
    print(f"{Color.BLUE}📋 {message}{Color.NC}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{Color.GREEN}✅ {message}{Color.NC}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{Color.YELLOW}⚠️  {message}{Color.NC}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{Color.RED}❌ {message}{Color.NC}")


def print_info(message: str) -> None:
    """Print an info message."""
    print(f"  {message}")


def require_cmd(cmd: str) -> bool:
    """Check if a command exists."""
    if not shutil.which(cmd):
        print_error(f"Required command '{cmd}' not found in PATH.")
        return False
    return True


def generate_random_secret(length: int = 32) -> str:
    """Generate a random base64 secret."""
    return b64encode(secrets.token_bytes(length)).decode().rstrip("=")


def prompt_for_secret(prompt: str, env_var: str) -> str:
    """Prompt for a secret if not set in environment."""
    current_value = os.environ.get(env_var, "")
    if current_value:
        return current_value

    return getpass(f"{prompt}: ")


def run_kubectl(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a kubectl command."""
    return subprocess.run(
        ["kubectl"] + args,
        capture_output=True,
        text=True,
        check=check,
    )


def check_kubernetes_cluster() -> bool:
    """Check if a Kubernetes cluster is available."""
    result = run_kubectl(["cluster-info"], check=False)
    return result.returncode == 0


def create_kind_cluster() -> bool:
    """Create a KIND cluster for development."""
    if not shutil.which("kind"):
        print_error("kind is required but not found")
        return False

    print_warning("No active Kubernetes cluster detected; creating KIND cluster 'vibecode-dev'.")

    kind_config = Path("k8s/kind-config.yaml")
    cmd = ["kind", "create", "cluster", "--name", "vibecode-dev"]

    if kind_config.exists():
        cmd.extend(["--config", str(kind_config)])

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        print_success("KIND cluster vibecode-dev created")
        return True

    print_error(f"Failed to create KIND cluster: {result.stderr}")
    return False


def ensure_namespaces() -> bool:
    """Ensure required namespaces exist."""
    print_step("Ensuring namespaces")

    namespaces = ["vibecode-platform", "datadog", "authelia", "monitoring"]

    for ns in namespaces:
        # Create namespace with dry-run and apply
        result = run_kubectl([
            "create", "namespace", ns,
            "--dry-run=client", "-o", "yaml",
        ], check=False)

        if result.returncode == 0:
            apply_result = subprocess.run(
                ["kubectl", "apply", "-f", "-"],
                input=result.stdout,
                capture_output=True,
                text=True,
            )

            if apply_result.returncode == 0:
                print_info(f"Namespace '{ns}' available")
            else:
                print_warning(f"Failed to create namespace '{ns}'")
        else:
            print_warning(f"Could not prepare namespace '{ns}'")

    return True


def gather_secrets() -> SecretsConfig:
    """Gather secrets from user or environment."""
    print_step("Gathering secrets")

    config = SecretsConfig()

    config.dd_api_key = prompt_for_secret("Enter Datadog API key", "DD_API_KEY")
    config.openrouter_api_key = prompt_for_secret("Enter OpenRouter API key", "OPENROUTER_API_KEY")
    config.claude_api_key = prompt_for_secret("Enter Claude API key (optional, press Enter to skip)", "CLAUDE_API_KEY")

    return config


def generate_secrets(config: SecretsConfig) -> None:
    """Generate random secrets."""
    print_step("Generating local secrets")

    config.dd_cluster_agent_token = generate_random_secret()
    config.jwt_secret = generate_random_secret()
    config.session_secret = generate_random_secret()
    config.nextauth_secret = generate_random_secret()


def create_kubernetes_secrets(config: SecretsConfig) -> bool:
    """Create Kubernetes secrets."""
    print_step("Creating Datadog secrets")

    # Datadog secret
    result = run_kubectl([
        "create", "secret", "generic", "datadog-secret",
        f"--from-literal=api-key={config.dd_api_key}",
        "-n", "datadog",
        "--dry-run=client", "-o", "yaml",
    ], check=False)

    if result.returncode == 0:
        subprocess.run(["kubectl", "apply", "-f", "-"], input=result.stdout, capture_output=True, text=True)

    # Datadog cluster agent secret
    result = run_kubectl([
        "create", "secret", "generic", "datadog-cluster-agent-secret",
        f"--from-literal=token={config.dd_cluster_agent_token}",
        "-n", "datadog",
        "--dry-run=client", "-o", "yaml",
    ], check=False)

    if result.returncode == 0:
        subprocess.run(["kubectl", "apply", "-f", "-"], input=result.stdout, capture_output=True, text=True)

    print_step("Creating AI integration secrets")

    # AI gateway secret
    result = run_kubectl([
        "create", "secret", "generic", "ai-gateway-secret",
        f"--from-literal=openrouter-api-key={config.openrouter_api_key}",
        f"--from-literal=claude-api-key={config.claude_api_key}",
        "-n", "vibecode-platform",
        "--dry-run=client", "-o", "yaml",
    ], check=False)

    if result.returncode == 0:
        subprocess.run(["kubectl", "apply", "-f", "-"], input=result.stdout, capture_output=True, text=True)

    print_step("Creating authentication secrets")

    # Auth secrets
    result = run_kubectl([
        "create", "secret", "generic", "auth-secrets",
        f"--from-literal=jwt-secret={config.jwt_secret}",
        f"--from-literal=session-secret={config.session_secret}",
        f"--from-literal=nextauth-secret={config.nextauth_secret}",
        "-n", "vibecode-platform",
        "--dry-run=client", "-o", "yaml",
    ], check=False)

    if result.returncode == 0:
        subprocess.run(["kubectl", "apply", "-f", "-"], input=result.stdout, capture_output=True, text=True)

    return True


def create_env_file(config: SecretsConfig) -> bool:
    """Create local .env file."""
    print(f"{Color.BLUE}📝 Creating local environment file...{Color.NC}")

    env_content = f"""# VibeCode Local Development Environment
# Generated by security-setup.py

# Datadog Configuration
DD_API_KEY={config.dd_api_key}
DD_SITE=datadoghq.com
DD_ENV=development
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0

# AI API Keys
OPENROUTER_API_KEY={config.openrouter_api_key}
CLAUDE_API_KEY={config.claude_api_key}

# Auth Secrets
JWT_SECRET={config.jwt_secret}
SESSION_SECRET={config.session_secret}
NEXTAUTH_SECRET={config.nextauth_secret}
NEXTAUTH_URL=http://localhost:3000

# Database (configure via environment variables or update these values)
# Required: DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
DB_USER=vibecode
DB_PASSWORD=  # Set this to your database password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vibecode_dev
DATABASE_URL=postgresql://${{DB_USER}}:${{DB_PASSWORD}}@${{DB_HOST}}:${{DB_PORT}}/${{DB_NAME}}
REDIS_URL=redis://localhost:6379

# Development Settings
NODE_ENV=development
PORT=3000
VITE_PORT=5173
ENABLE_DEBUG_LOGGING=true
ENABLE_DATADOG_INTEGRATION_TESTS=false

# Kubernetes
KUBECONFIG={os.environ.get('HOME', '')}/.kube/config
KUBERNETES_NAMESPACE=vibecode-platform
PLATFORM_DOMAIN=vibecode.dev
"""

    env_path = Path(".env")
    env_path.write_text(env_content)
    print_success(f"Created {env_path}")

    return True


def update_gitignore() -> None:
    """Ensure .gitignore includes environment files."""
    gitignore_path = Path(".gitignore")

    patterns_to_add = [".env", ".env.local"]
    content = gitignore_path.read_text() if gitignore_path.exists() else ""

    for pattern in patterns_to_add:
        if pattern not in content:
            with open(gitignore_path, "a") as f:
                f.write(f"\n{pattern}")
            print_success(f"Added {pattern} to .gitignore")


def run_security_setup() -> int:
    """Run the security setup process."""
    print(f"{Color.BLUE}🔐 VibeCode Security Setup{Color.NC}")
    print("=" * 40)

    # Check prerequisites
    if not require_cmd("kubectl"):
        return 1

    if not require_cmd("openssl"):
        print_warning("openssl not found, using Python secrets module instead")

    # Check/create Kubernetes cluster
    if not check_kubernetes_cluster():
        if not create_kind_cluster():
            return 1

    # Ensure namespaces
    ensure_namespaces()

    # Gather and generate secrets
    config = gather_secrets()
    generate_secrets(config)

    # Create Kubernetes secrets
    create_kubernetes_secrets(config)

    # Create local .env file
    create_env_file(config)

    # Update .gitignore
    update_gitignore()

    # Print summary
    print(f"\n{Color.GREEN}🎉 Security setup complete!{Color.NC}")
    print()
    print(f"{Color.BLUE}📋 Summary:{Color.NC}")
    print_success("Kubernetes namespaces created")
    print_success("Datadog secrets configured")
    print_success("AI integration secrets configured")
    print_success("Authentication secrets configured")
    print_success("Local .env file created")
    print_success("Secrets excluded from version control")

    print()
    print(f"{Color.YELLOW}⚠️  Next steps:{Color.NC}")
    print("  1. Review the .env file and update any missing values")
    print("  2. Run: kubectl get secrets --all-namespaces to verify secrets")
    print("  3. Deploy the monitoring stack: helm install datadog-agent datadog/datadog --values datadog-values.yaml")
    print("  4. Start the development environment: npm run dev")

    print()
    print(f"{Color.BLUE}🔗 Useful commands:{Color.NC}")
    print("  kubectl get secrets -n datadog")
    print("  kubectl get secrets -n vibecode-platform")
    print("  kubectl describe secret datadog-secret -n datadog")

    return 0


def main() -> int:
    """Main entry point."""
    return run_security_setup()


if __name__ == "__main__":
    sys.exit(main())