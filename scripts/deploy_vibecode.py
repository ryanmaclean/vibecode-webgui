#!/usr/bin/env python3
"""Master script to deploy the full VibeCode stack on AKS.

Handles NGINX ingress controller, application deployment, and SSL setup.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

CLUSTER_ISSUER_MANIFEST = """\
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
"""


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    red: str = "\033[0;31m"
    green: str = "\033[0;32m"
    yellow: str = "\033[0;33m"
    reset: str = "\033[0m"


COLORS = Colors()


@dataclass
class DeployConfig:
    """Deployment configuration."""

    resource_group: str = "rg-vibecode-dns"
    ingress_resource_group: str = ""
    aks_resource_group: str = "rg-vibecode-aks-prod"
    cluster_name: str = "vibecode-aks-new"
    acr_name: str = "vibecodecr84859296"
    public_ip_name: str = "vibecode-dns-ip"
    ingress_namespace: str = "ingress-nginx"
    app_namespace: str = "vibecode-platform"
    deploy_ingress: bool = True
    deploy_app: bool = True
    setup_ssl: bool = True
    skip_build: bool = True
    image_tag: str = "latest"
    fullname_override: str = "vibecode-app"
    domain: str = "vibecode.eastus2.cloudapp.azure.com"

    def __post_init__(self) -> None:
        """Set defaults that depend on other fields."""
        if not self.ingress_resource_group:
            object.__setattr__(self, "ingress_resource_group", self.resource_group)


def info(message: str) -> None:
    """Print yellow info message."""
    print(f"{COLORS.yellow}{message}{COLORS.reset}")


def ok(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}{message}{COLORS.reset}")


def err(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}{message}{COLORS.reset}")


def which(cmd: str) -> str | None:
    """Find command in PATH."""
    return shutil.which(cmd)


def run_command(
    cmd: list[str],
    *,
    check: bool = True,
    capture_output: bool = False,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        text=True,
        input=input_text,
    )


def run_silent(cmd: list[str]) -> bool:
    """Run a command silently, return True if successful."""
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def get_command_output(cmd: list[str]) -> str | None:
    """Run a command and return its output, or None on failure."""
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def parse_args(argv: list[str] | None = None) -> DeployConfig:
    """Parse command-line arguments."""
    # Get defaults from environment variables
    defaults = DeployConfig()

    parser = argparse.ArgumentParser(
        description="Deploy the full VibeCode stack to AKS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--resource-group",
        default=os.environ.get("RESOURCE_GROUP", defaults.resource_group),
        help=f"Ingress/DNS resource group (Public IP) (default: {defaults.resource_group})",
    )
    parser.add_argument(
        "--ingress-resource-group",
        default=os.environ.get("INGRESS_RESOURCE_GROUP", ""),
        help="Ingress public IP resource group (default: same as --resource-group)",
    )
    parser.add_argument(
        "--aks-resource-group",
        default=os.environ.get("AKS_RESOURCE_GROUP", defaults.aks_resource_group),
        help=f"AKS cluster resource group (default: {defaults.aks_resource_group})",
    )
    parser.add_argument(
        "--cluster-name",
        default=os.environ.get("CLUSTER_NAME", defaults.cluster_name),
        help=f"AKS cluster name (default: {defaults.cluster_name})",
    )
    parser.add_argument(
        "--acr-name",
        default=os.environ.get("ACR_NAME", defaults.acr_name),
        help=f"Azure Container Registry name (default: {defaults.acr_name})",
    )
    parser.add_argument(
        "--public-ip",
        default=os.environ.get("PUBLIC_IP_NAME", defaults.public_ip_name),
        help=f"Public IP resource name (default: {defaults.public_ip_name})",
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
        default=os.environ.get("IMAGE_TAG", defaults.image_tag),
        help=f"Application image tag (default: {defaults.image_tag})",
    )

    args = parser.parse_args(argv)

    return DeployConfig(
        resource_group=args.resource_group,
        ingress_resource_group=args.ingress_resource_group or args.resource_group,
        aks_resource_group=args.aks_resource_group,
        cluster_name=args.cluster_name,
        acr_name=args.acr_name,
        public_ip_name=args.public_ip,
        deploy_ingress=not args.skip_ingress,
        deploy_app=not args.skip_app,
        setup_ssl=not args.skip_ssl,
        skip_build=not args.build,
        image_tag=args.image_tag,
    )


def check_azure_login() -> bool:
    """Check if logged into Azure CLI."""
    info("Checking Azure CLI login...")
    if run_silent(["az", "account", "show"]):
        return True
    err("Please log in to Azure CLI first with: az login")
    return False


def get_aks_credentials(config: DeployConfig) -> bool:
    """Get AKS cluster credentials."""
    info("Getting AKS credentials...")
    try:
        run_command([
            "az", "aks", "get-credentials",
            "--resource-group", config.aks_resource_group,
            "--name", config.cluster_name,
            "--admin",
            "--overwrite-existing",
        ])
        return True
    except subprocess.CalledProcessError:
        err("Failed to get AKS credentials.")
        return False


def check_kubectl_access() -> bool:
    """Verify kubectl can access the cluster."""
    info("Checking kubectl access...")
    if run_silent(["kubectl", "get", "nodes"]):
        return True
    err("Cannot access Kubernetes cluster.")
    return False


def get_public_ip_info(config: DeployConfig) -> tuple[str, str] | None:
    """Get public IP ID and address."""
    info("Getting public IP resource ID...")

    ip_id = get_command_output([
        "az", "network", "public-ip", "show",
        "--resource-group", config.resource_group,
        "--name", config.public_ip_name,
        "--query", "id",
        "--output", "tsv",
    ])

    if not ip_id:
        err(f"Could not find public IP {config.public_ip_name} in resource group {config.resource_group}")
        return None

    ip_address = get_command_output([
        "az", "network", "public-ip", "show",
        "--resource-group", config.resource_group,
        "--name", config.public_ip_name,
        "--query", "ipAddress",
        "--output", "tsv",
    ])

    if not ip_address:
        err("Could not get public IP address.")
        return None

    ok(f"Using public IP: {ip_address} ({ip_id})")
    return ip_id, ip_address


def ensure_namespace(namespace: str) -> None:
    """Create namespace if it doesn't exist."""
    if not run_silent(["kubectl", "get", "namespace", namespace]):
        info(f"Creating namespace {namespace}...")
        run_command(["kubectl", "create", "namespace", namespace])


def deploy_ingress_controller(config: DeployConfig) -> bool:
    """Deploy NGINX Ingress Controller."""
    info("=== Deploying NGINX Ingress Controller ===")

    ip_info = get_public_ip_info(config)
    if not ip_info:
        return False

    _, public_ip_address = ip_info

    ensure_namespace(config.ingress_namespace)

    # Add and update Helm repo
    info("Adding NGINX Ingress Helm repository...")
    run_command(["helm", "repo", "add", "ingress-nginx", "https://kubernetes.github.io/ingress-nginx"])
    run_command(["helm", "repo", "update"])

    # Deploy NGINX Ingress Controller
    info("Deploying NGINX Ingress Controller...")
    helm_cmd = [
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
    ]

    try:
        run_command(helm_cmd)
    except subprocess.CalledProcessError:
        err("Failed to deploy NGINX Ingress Controller.")
        return False

    # Wait for rollout
    info("Waiting for Ingress Controller to be ready...")
    try:
        run_command([
            "kubectl", "rollout", "status",
            "deployment", "nginx-ingress-ingress-nginx-controller",
            "-n", config.ingress_namespace,
            "--timeout=600s",
        ])
    except subprocess.CalledProcessError:
        err("Ingress Controller rollout timed out.")
        return False

    # Get external IP
    ingress_ip = get_command_output([
        "kubectl", "get", "service", "nginx-ingress-ingress-nginx-controller",
        "-n", config.ingress_namespace,
        "-o", "jsonpath={.status.loadBalancer.ingress[0].ip}",
    ])
    ok(f"NGINX Ingress Controller deployed with external IP: {ingress_ip}")

    return True


def deploy_application(config: DeployConfig) -> bool:
    """Deploy the VibeCode application."""
    info("=== Deploying VibeCode Application ===")

    ensure_namespace(config.app_namespace)

    # Build set values
    set_values = [
        "ingress.enabled=true",
        "ingress.className=nginx",
        f"ingress.hosts[0].host={config.domain}",
        "ingress.hosts[0].paths[0].path=/",
        "ingress.hosts[0].paths[0].pathType=Prefix",
    ]

    if config.setup_ssl:
        tls_secret_name = config.domain.replace(".", "-") + "-tls"
        set_values.extend([
            f"ingress.tls[0].secretName={tls_secret_name}",
            f"ingress.tls[0].hosts[0]={config.domain}",
            "ingress.annotations.cert-manager\\.io/cluster-issuer=letsencrypt-prod",
            "ingress.annotations.kubernetes\\.io/tls-acme=true",
        ])

    # Build command
    cmd = [
        "python", "scripts/app_deploy.py",
        "--acr-name", config.acr_name,
        "--image-tag", config.image_tag,
        "--fullname-override", config.fullname_override,
        "--namespace", config.app_namespace,
        "--wait",
    ]

    if config.skip_build:
        cmd.append("--skip-build")

    for val in set_values:
        cmd.extend(["--set", val])

    info("Executing app_deploy.py...")
    info(f"Command: {' '.join(cmd)}")

    try:
        run_command(cmd)
        ok("VibeCode application deployment completed")
        return True
    except subprocess.CalledProcessError:
        err("Application deployment failed.")
        return False


def setup_ssl_certificates(config: DeployConfig) -> bool:
    """Set up SSL certificates with cert-manager."""
    info("=== Setting up SSL Certificates ===")

    # Check if cert-manager is installed
    if not run_silent(["kubectl", "get", "namespace", "cert-manager"]):
        info("Installing cert-manager...")

        run_command(["kubectl", "create", "namespace", "cert-manager"])

        # Add Jetstack Helm repo
        run_command(["helm", "repo", "add", "jetstack", "https://charts.jetstack.io"])
        run_command(["helm", "repo", "update"])

        # Install cert-manager
        try:
            run_command([
                "helm", "install", "cert-manager", "jetstack/cert-manager",
                "--namespace", "cert-manager",
                "--create-namespace",
                "--set", "installCRDs=true",
                "--wait",
                "--timeout=600s",
            ])
        except subprocess.CalledProcessError:
            err("Failed to install cert-manager.")
            return False
    else:
        ok("cert-manager is already installed")

    # Create ClusterIssuer
    info("Creating Let's Encrypt ClusterIssuer...")
    try:
        run_command(
            ["kubectl", "apply", "-f", "-"],
            input_text=CLUSTER_ISSUER_MANIFEST,
        )
        ok("SSL certificate setup completed")
        return True
    except subprocess.CalledProcessError:
        err("Failed to create ClusterIssuer.")
        return False


def verify_deployment(config: DeployConfig) -> None:
    """Verify the deployment status."""
    info("=== Verifying Deployment ===")

    info("Checking ingress status...")
    run_command(["kubectl", "get", "ingress", "-n", config.app_namespace], check=False)

    print()
    info("Checking application pods...")
    run_command(["kubectl", "get", "pods", "-n", config.app_namespace], check=False)

    print()
    info("Checking services...")
    run_command(["kubectl", "get", "svc", "-n", config.app_namespace], check=False)

    # Print summary
    print()
    ok("=== Deployment Summary ===")
    print(f"Domain: {config.domain}")
    print(f"Application namespace: {config.app_namespace}")
    print(f"Ingress namespace: {config.ingress_namespace}")
    print(f"Application release: {config.fullname_override}")

    # Verify DNS
    print()
    info("Verifying DNS resolution...")
    if run_silent(["nslookup", config.domain]):
        ok("DNS resolution successful!")

        print()
        info("Testing HTTP access...")
        http_status = get_command_output([
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            f"http://{config.domain}",
        ])
        print(f"HTTP status code: {http_status or 'Failed'}")

        if config.setup_ssl:
            print()
            info("Testing HTTPS access (might take some time for SSL certificate to be issued)...")
            info("Note: It can take up to 5-10 minutes for Let's Encrypt to issue a certificate")
            https_status = get_command_output([
                "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-k",
                f"https://{config.domain}",
            ])
            print(f"HTTPS status code: {https_status or 'Failed'}")
    else:
        err("DNS resolution failed.")

    print()
    ok("Deployment process completed!")
    print(f"To verify the SSL certificate status, run: kubectl get certificate -n {config.app_namespace}")
    print(f"To verify the application is running, run: kubectl get pods -n {config.app_namespace}")
    print(f"To access the application, navigate to: https://{config.domain}")


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    config = parse_args(argv)

    info("=== VibeCode AKS Deployment ===")
    print(f"Ingress/DNS Resource Group: {config.resource_group}")
    print(f"AKS Resource Group: {config.aks_resource_group}")
    print(f"AKS Cluster: {config.cluster_name}")
    print(f"ACR Name: {config.acr_name}")
    print(f"Public IP: {config.public_ip_name}")
    print(f"Domain: {config.domain}")

    # Check prerequisites
    if not check_azure_login():
        return 1

    if not get_aks_credentials(config):
        return 1

    if not check_kubectl_access():
        return 1

    # Deploy ingress controller
    if config.deploy_ingress:
        if not deploy_ingress_controller(config):
            return 1
    else:
        print()
        info("Skipping NGINX Ingress Controller deployment")

    # Deploy application
    if config.deploy_app:
        if not deploy_application(config):
            return 1
    else:
        print()
        info("Skipping VibeCode application deployment")

    # Setup SSL
    if config.setup_ssl:
        if not setup_ssl_certificates(config):
            return 1
    else:
        print()
        info("Skipping SSL certificate setup")

    # Verify deployment
    verify_deployment(config)

    return 0


if __name__ == "__main__":
    sys.exit(main())
