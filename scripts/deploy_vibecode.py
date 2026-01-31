#!/usr/bin/env python3
"""
Master script to deploy the full VibeCode stack on AKS.

Converts deploy-vibecode.sh to Python with enhanced error handling,
Datadog tracing, and structured logging.
"""

from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path
from typing import NamedTuple

# Local imports
try:
    from lib.vibecode_common import (
        init_vibecode_script,
    )
    USE_COMMON = True
except ImportError:
    USE_COMMON = False
    import logging
    logging.basicConfig(level=logging.INFO)


class DeployConfig(NamedTuple):
    """Deployment configuration."""
    resource_group: str
    ingress_resource_group: str
    aks_resource_group: str
    cluster_name: str
    acr_name: str
    public_ip_name: str
    ingress_namespace: str
    app_namespace: str
    deploy_ingress: bool
    deploy_app: bool
    setup_ssl: bool
    skip_build: bool
    image_tag: str
    fullname_override: str
    domain: str
    acme_email: str
    dry_run: bool


# Default configuration
DEFAULTS = {
    "resource_group": "rg-vibecode-dns",
    "aks_resource_group": "rg-vibecode-aks-prod",
    "cluster_name": "vibecode-aks-new",
    "acr_name": "vibecodecr84859296",
    "public_ip_name": "vibecode-dns-ip",
    "ingress_namespace": "ingress-nginx",
    "app_namespace": "vibecode-platform",
    "image_tag": "latest",
    "fullname_override": "vibecode-app",
    "domain": "vibecode.eastus2.cloudapp.azure.com",
    "acme_email": "admin@example.com",
}


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


class Colors:
    """ANSI color codes for terminal output."""
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[0;33m"
    NC = "\033[0m"  # No Color


def require_tool(name: str) -> None:
    """Verify a required tool is available."""
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(
    cmd: list[str],
    *,
    dry_run: bool = False,
    capture_output: bool = True,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command with proper error handling."""
    if dry_run:
        printable = " ".join(shlex.quote(part) for part in cmd)
        print(f"[DRY-RUN] {printable}")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    try:
        return subprocess.run(
            cmd,
            text=True,
            capture_output=capture_output,
            check=check,
        )
    except subprocess.CalledProcessError as exc:
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def print_status(message: str, color: str = Colors.YELLOW) -> None:
    """Print a status message with color."""
    print(f"{color}{message}{Colors.NC}")


def print_success(message: str) -> None:
    """Print a success message."""
    print_status(message, Colors.GREEN)


def print_error(message: str) -> None:
    """Print an error message."""
    print_status(message, Colors.RED)


def check_azure_login(dry_run: bool = False) -> bool:
    """Check if Azure CLI is logged in."""
    print_status("\nChecking Azure CLI login...")
    try:
        run(["az", "account", "show"], dry_run=dry_run, capture_output=True)
        return True
    except CommandError:
        print_error("Please log in to Azure CLI first with: az login")
        return False


def get_aks_credentials(
    resource_group: str,
    cluster_name: str,
    dry_run: bool = False,
) -> None:
    """Get AKS cluster credentials."""
    print_status("\nGetting AKS credentials...")
    run(
        [
            "az", "aks", "get-credentials",
            "--resource-group", resource_group,
            "--name", cluster_name,
            "--admin",
            "--overwrite-existing",
        ],
        dry_run=dry_run,
    )


def check_kubectl_access(dry_run: bool = False) -> bool:
    """Check if kubectl can access the cluster."""
    print_status("\nChecking kubectl access...")
    try:
        run(["kubectl", "get", "nodes"], dry_run=dry_run, capture_output=True)
        return True
    except CommandError:
        print_error("Cannot access Kubernetes cluster.")
        return False


def get_public_ip_info(
    resource_group: str,
    public_ip_name: str,
    dry_run: bool = False,
) -> tuple[str, str]:
    """Get public IP resource ID and address."""
    print_status("Getting public IP resource ID...")

    if dry_run:
        return "/subscriptions/.../publicIPAddresses/mock", "1.2.3.4"

    # Get resource ID
    result = run(
        [
            "az", "network", "public-ip", "show",
            "--resource-group", resource_group,
            "--name", public_ip_name,
            "--query", "id",
            "--output", "tsv",
        ],
    )
    public_ip_id = result.stdout.strip()

    if not public_ip_id:
        raise CommandError(
            f"Could not find public IP {public_ip_name} in resource group {resource_group}"
        )

    # Get IP address
    result = run(
        [
            "az", "network", "public-ip", "show",
            "--resource-group", resource_group,
            "--name", public_ip_name,
            "--query", "ipAddress",
            "--output", "tsv",
        ],
    )
    public_ip_address = result.stdout.strip()

    print_success(f"Using public IP: {public_ip_address} ({public_ip_id})")
    return public_ip_id, public_ip_address


def ensure_namespace(namespace: str, dry_run: bool = False) -> None:
    """Create namespace if it doesn't exist."""
    try:
        run(
            ["kubectl", "get", "namespace", namespace],
            dry_run=dry_run,
            capture_output=True,
        )
    except CommandError:
        print_status(f"Creating namespace {namespace}...")
        run(["kubectl", "create", "namespace", namespace], dry_run=dry_run)


def deploy_nginx_ingress(
    config: DeployConfig,
    public_ip_address: str,
) -> str | None:
    """Deploy NGINX Ingress Controller."""
    print_status("\n=== Deploying NGINX Ingress Controller ===")

    ensure_namespace(config.ingress_namespace, config.dry_run)

    # Add and update Helm repository
    print_status("Adding NGINX Ingress Helm repository...")
    run(
        ["helm", "repo", "add", "ingress-nginx", "https://kubernetes.github.io/ingress-nginx"],
        dry_run=config.dry_run,
    )
    run(["helm", "repo", "update"], dry_run=config.dry_run)

    # Deploy NGINX Ingress Controller
    print_status("Deploying NGINX Ingress Controller...")
    run(
        [
            "helm", "upgrade", "--install", "nginx-ingress", "ingress-nginx/ingress-nginx",
            "--namespace", config.ingress_namespace,
            "--set", f"controller.service.loadBalancerIP={public_ip_address}",
            "--set", f"controller.service.annotations.service\\.beta\\.kubernetes\\.io/azure-load-balancer-resource-group={config.ingress_resource_group}",
            "--set", f"controller.service.annotations.service\\.beta\\.kubernetes\\.io/azure-pip-name={config.public_ip_name}",
            "--set", "controller.service.annotations.service\\.beta\\.kubernetes\\.io/azure-dns-label-name=vibecode",
            "--set", "controller.service.externalTrafficPolicy=Local",
            "--set", "controller.config.use-proxy-protocol=false",
            "--set", "controller.config.use-forwarded-headers=true",
            "--set", "controller.config.compute-full-forwarded-for=true",
            "--set", "controller.config.proxy-buffer-size=8k",
            "--set", "controller.metrics.enabled=true",
            "--wait",
            "--timeout=600s",
        ],
        dry_run=config.dry_run,
    )

    # Wait for ingress controller to be ready
    print_status("Waiting for Ingress Controller to be ready...")
    run(
        [
            "kubectl", "rollout", "status",
            "deployment", "nginx-ingress-ingress-nginx-controller",
            "-n", config.ingress_namespace,
            "--timeout=600s",
        ],
        dry_run=config.dry_run,
    )

    # Get external IP
    if not config.dry_run:
        result = run(
            [
                "kubectl", "get", "service",
                "nginx-ingress-ingress-nginx-controller",
                "-n", config.ingress_namespace,
                "-o", "jsonpath={.status.loadBalancer.ingress[0].ip}",
            ],
        )
        ingress_ip = result.stdout.strip()
        print_success(f"NGINX Ingress Controller deployed with external IP: {ingress_ip}")
        return ingress_ip

    return None


def deploy_application(config: DeployConfig) -> None:
    """Deploy the VibeCode application."""
    print_status("\n=== Deploying VibeCode Application ===")

    ensure_namespace(config.app_namespace, config.dry_run)

    # Build set values for ingress
    set_values = [
        "ingress.enabled=true",
        "ingress.className=nginx",
        f"ingress.hosts[0].host={config.domain}",
        "ingress.hosts[0].paths[0].path=/",
        "ingress.hosts[0].paths[0].pathType=Prefix",
    ]

    # Add TLS values if SSL is enabled
    if config.setup_ssl:
        tls_secret_name = config.domain.replace(".", "-") + "-tls"
        set_values.extend([
            f"ingress.tls[0].secretName={tls_secret_name}",
            f"ingress.tls[0].hosts[0]={config.domain}",
            "ingress.annotations.cert-manager\\.io/cluster-issuer=letsencrypt-prod",
            "ingress.annotations.kubernetes\\.io/tls-acme=true",
        ])

    # Build command for app_deploy.py
    print_status("Executing app_deploy.py...")
    cmd = [
        sys.executable, "scripts/app_deploy.py",
        "--acr-name", config.acr_name,
        "--image-tag", config.image_tag,
        "--fullname-override", config.fullname_override,
        "--namespace", config.app_namespace,
        "--wait",
    ]

    if config.skip_build:
        cmd.append("--skip-build")

    for value in set_values:
        cmd.extend(["--set", value])

    if config.dry_run:
        cmd.append("--dry-run")

    run(cmd, dry_run=False)  # Don't double dry-run

    print_success("VibeCode application deployment completed")


def setup_ssl_certificates(config: DeployConfig) -> None:
    """Set up SSL certificates with cert-manager."""
    print_status("\n=== Setting up SSL Certificates ===")

    # Check if cert-manager is installed
    try:
        run(
            ["kubectl", "get", "namespace", "cert-manager"],
            dry_run=config.dry_run,
            capture_output=True,
        )
        print_success("cert-manager is already installed")
    except CommandError:
        print_status("Installing cert-manager...")

        # Create namespace
        run(["kubectl", "create", "namespace", "cert-manager"], dry_run=config.dry_run)

        # Add Jetstack Helm repository
        run(
            ["helm", "repo", "add", "jetstack", "https://charts.jetstack.io"],
            dry_run=config.dry_run,
        )
        run(["helm", "repo", "update"], dry_run=config.dry_run)

        # Install cert-manager
        run(
            [
                "helm", "install", "cert-manager", "jetstack/cert-manager",
                "--namespace", "cert-manager",
                "--create-namespace",
                "--set", "installCRDs=true",
                "--wait",
                "--timeout=600s",
            ],
            dry_run=config.dry_run,
        )

    # Create Let's Encrypt ClusterIssuer
    print_status("Creating Let's Encrypt ClusterIssuer...")
    cluster_issuer_yaml = textwrap.dedent("""\
        apiVersion: cert-manager.io/v1
        kind: ClusterIssuer
        metadata:
          name: letsencrypt-prod
        spec:
          acme:
            server: https://acme-v02.api.letsencrypt.org/directory
            email: {config.acme_email}
            privateKeySecretRef:
              name: letsencrypt-prod
            solvers:
            - http01:
                ingress:
                  class: nginx
    """)

    if config.dry_run:
        print(f"[DRY-RUN] Would apply ClusterIssuer:\n{cluster_issuer_yaml}")
    else:
        subprocess.run(
            ["kubectl", "apply", "-f", "-"],
            input=cluster_issuer_yaml,
            text=True,
            capture_output=True,
            check=True,
        )

    print_success("SSL certificate setup completed")


def verify_deployment(config: DeployConfig) -> None:
    """Verify the deployment status."""
    print_status("\n=== Verifying Deployment ===")

    # Check ingress status
    print_status("Checking ingress status...")
    run(
        ["kubectl", "get", "ingress", "-n", config.app_namespace],
        dry_run=config.dry_run,
        capture_output=False,
    )

    # Check application pods
    print_status("\nChecking application pods...")
    run(
        ["kubectl", "get", "pods", "-n", config.app_namespace],
        dry_run=config.dry_run,
        capture_output=False,
    )

    # Check services
    print_status("\nChecking services...")
    run(
        ["kubectl", "get", "svc", "-n", config.app_namespace],
        dry_run=config.dry_run,
        capture_output=False,
    )

    # Print deployment summary
    print_success("\n=== Deployment Summary ===")
    print(f"Domain: {config.domain}")
    print(f"Application namespace: {config.app_namespace}")
    print(f"Ingress namespace: {config.ingress_namespace}")
    print(f"Application release: {config.fullname_override}")

    # Verify DNS and application access
    if not config.dry_run:
        print_status("\nVerifying DNS resolution...")
        try:
            run(["nslookup", config.domain], capture_output=True)
            print_success("DNS resolution successful!")

            print_status("\nTesting HTTP access...")
            result = run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"http://{config.domain}"],
                check=False,
            )
            print(f"HTTP status code: {result.stdout.strip()}")

            if config.setup_ssl:
                print_status("\nTesting HTTPS access (might take some time for SSL certificate to be issued)...")
                print_status("Note: It can take up to 5-10 minutes for Let's Encrypt to issue a certificate")
                result = run(
                    ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-k", f"https://{config.domain}"],
                    check=False,
                )
                print(f"HTTPS status code: {result.stdout.strip()}")
        except CommandError:
            print_error("DNS resolution failed.")

    print_success("\nDeployment process completed!")
    print(f"To verify the SSL certificate status, run: kubectl get certificate -n {config.app_namespace}")
    print(f"To verify the application is running, run: kubectl get pods -n {config.app_namespace}")
    print(f"To access the application, navigate to: https://{config.domain}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Deploy the full VibeCode stack to AKS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--resource-group",
        default=os.environ.get("RESOURCE_GROUP", DEFAULTS["resource_group"]),
        help=f"Ingress/DNS resource group (Public IP) (default: {DEFAULTS['resource_group']})",
    )
    parser.add_argument(
        "--ingress-resource-group",
        default=os.environ.get("INGRESS_RESOURCE_GROUP"),
        help="Ingress public IP resource group (default: same as resource-group)",
    )
    parser.add_argument(
        "--aks-resource-group",
        default=os.environ.get("AKS_RESOURCE_GROUP", DEFAULTS["aks_resource_group"]),
        help=f"AKS cluster resource group (default: {DEFAULTS['aks_resource_group']})",
    )
    parser.add_argument(
        "--cluster-name",
        default=os.environ.get("CLUSTER_NAME", DEFAULTS["cluster_name"]),
        help=f"AKS cluster name (default: {DEFAULTS['cluster_name']})",
    )
    parser.add_argument(
        "--acr-name",
        default=os.environ.get("ACR_NAME", DEFAULTS["acr_name"]),
        help=f"Azure Container Registry name (default: {DEFAULTS['acr_name']})",
    )
    parser.add_argument(
        "--public-ip",
        default=os.environ.get("PUBLIC_IP_NAME", DEFAULTS["public_ip_name"]),
        help=f"Public IP resource name (default: {DEFAULTS['public_ip_name']})",
    )
    parser.add_argument(
        "--skip-ingress",
        action="store_true",
        help="Skip deploying the NGINX Ingress controller",
    )
    parser.add_argument(
        "--skip-app",
        action="store_true",
        help="Skip deploying the application",
    )
    parser.add_argument(
        "--skip-ssl",
        action="store_true",
        help="Skip setting up SSL certificates",
    )
    parser.add_argument(
        "--build",
        action="store_true",
        help="Build the application image instead of using existing one",
    )
    parser.add_argument(
        "--image-tag",
        default=os.environ.get("IMAGE_TAG", DEFAULTS["image_tag"]),
        help=f"Application image tag (default: {DEFAULTS['image_tag']})",
    )
    parser.add_argument(
        "--domain",
        default=os.environ.get("DOMAIN", DEFAULTS["domain"]),
        help=f"Domain for the application (default: {DEFAULTS['domain']})",
    )
    parser.add_argument(
        "--acme-email",
        default=os.environ.get("ACME_EMAIL", DEFAULTS["acme_email"]),
        help="Email address for Let's Encrypt notifications",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing them",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    # Initialize logging and tracing
    shutdown = None
    if USE_COMMON:
        logger, _config_mgr, _metrics, shutdown = init_vibecode_script(
            "deploy_vibecode",
            service_name="vibecode-deployment",
        )

    # Build configuration
    ingress_resource_group = args.ingress_resource_group or args.resource_group

    config = DeployConfig(
        resource_group=args.resource_group,
        ingress_resource_group=ingress_resource_group,
        aks_resource_group=args.aks_resource_group,
        cluster_name=args.cluster_name,
        acr_name=args.acr_name,
        public_ip_name=args.public_ip,
        ingress_namespace=DEFAULTS["ingress_namespace"],
        app_namespace=DEFAULTS["app_namespace"],
        deploy_ingress=not args.skip_ingress,
        deploy_app=not args.skip_app,
        setup_ssl=not args.skip_ssl,
        skip_build=not args.build,
        image_tag=args.image_tag,
        fullname_override=DEFAULTS["fullname_override"],
        domain=args.domain,
        acme_email=args.acme_email,
        dry_run=args.dry_run,
    )

    # Check required tools
    try:
        require_tool("az")
        require_tool("kubectl")
        require_tool("helm")
        if not config.skip_build:
            require_tool("docker")
    except CommandError as err:
        print_error(str(err))
        return 1

    # Print deployment info
    print_status("=== VibeCode AKS Deployment ===")
    print(f"Ingress/DNS Resource Group: {config.resource_group}")
    print(f"AKS Resource Group: {config.aks_resource_group}")
    print(f"AKS Cluster: {config.cluster_name}")
    print(f"ACR Name: {config.acr_name}")
    print(f"Public IP: {config.public_ip_name}")
    print(f"Domain: {config.domain}")

    try:
        # Check Azure CLI login
        if not check_azure_login(config.dry_run):
            return 1

        # Get AKS credentials
        get_aks_credentials(
            config.aks_resource_group,
            config.cluster_name,
            config.dry_run,
        )

        # Check kubectl access
        if not check_kubectl_access(config.dry_run):
            return 1

        # Deploy NGINX Ingress Controller
        if config.deploy_ingress:
            _, public_ip_address = get_public_ip_info(
                config.resource_group,
                config.public_ip_name,
                config.dry_run,
            )
            deploy_nginx_ingress(config, public_ip_address)
        else:
            print_status("\nSkipping NGINX Ingress Controller deployment")

        # Deploy the application
        if config.deploy_app:
            deploy_application(config)
        else:
            print_status("\nSkipping VibeCode application deployment")

        # Set up SSL certificates
        if config.setup_ssl:
            setup_ssl_certificates(config)
        else:
            print_status("\nSkipping SSL certificate setup")

        # Verify deployment
        verify_deployment(config)

    except CommandError as err:
        print_error(str(err))
        return 1
    except KeyboardInterrupt:
        print_status("\nDeployment cancelled by user")
        return 130
    finally:
        if shutdown:
            shutdown()

    return 0


if __name__ == "__main__":
    sys.exit(main())
