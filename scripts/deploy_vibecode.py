#!/usr/bin/env python3
"""Master script to deploy the full VibeCode stack on AKS."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field

# ANSI color codes
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[0;33m"
NC = "\033[0m"  # No Color


@dataclass
class DeployConfig:
    """Deployment configuration for VibeCode AKS stack."""

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
            self.ingress_resource_group = self.resource_group


def run_command(
    cmd: list[str],
    capture_output: bool = False,
    check: bool = True,
    suppress_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command.

    Args:
        cmd: Command and arguments to run
        capture_output: Whether to capture stdout/stderr
        check: Whether to raise on non-zero exit
        suppress_output: Whether to suppress stdout/stderr

    Returns:
        CompletedProcess result
    """
    kwargs: dict = {"text": True}
    if capture_output:
        kwargs["capture_output"] = True
    elif suppress_output:
        kwargs["stdout"] = subprocess.DEVNULL
        kwargs["stderr"] = subprocess.DEVNULL

    result = subprocess.run(cmd, **kwargs)
    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, cmd)
    return result


def check_command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


def print_header(msg: str) -> None:
    """Print a section header."""
    print(f"\n{YELLOW}=== {msg} ==={NC}")


def print_status(msg: str) -> None:
    """Print a status message."""
    print(f"{YELLOW}{msg}{NC}")


def print_success(msg: str) -> None:
    """Print a success message."""
    print(f"{GREEN}{msg}{NC}")


def print_error(msg: str) -> None:
    """Print an error message."""
    print(f"{RED}{msg}{NC}", file=sys.stderr)


def check_azure_login() -> bool:
    """Check if user is logged in to Azure CLI.

    Returns:
        True if logged in, False otherwise
    """
    print_status("\nChecking Azure CLI login...")
    try:
        run_command(["az", "account", "show"], suppress_output=True)
        return True
    except subprocess.CalledProcessError:
        print_error("Please log in to Azure CLI first with: az login")
        return False


def get_aks_credentials(config: DeployConfig) -> bool:
    """Get AKS cluster credentials.

    Returns:
        True if successful, False otherwise
    """
    print_status("\nGetting AKS credentials...")
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
        print_error("Failed to get AKS credentials")
        return False


def check_kubectl_access() -> bool:
    """Check if kubectl can access the cluster.

    Returns:
        True if accessible, False otherwise
    """
    print_status("\nChecking kubectl access...")
    try:
        run_command(["kubectl", "get", "nodes"], suppress_output=True)
        return True
    except subprocess.CalledProcessError:
        print_error("Cannot access Kubernetes cluster.")
        return False


def get_public_ip_info(
    config: DeployConfig,
) -> tuple[str, str] | None:
    """Get public IP resource ID and address.

    Returns:
        Tuple of (resource_id, ip_address) or None if not found
    """
    print_status("Getting public IP resource ID...")
    try:
        result = run_command([
            "az", "network", "public-ip", "show",
            "--resource-group", config.resource_group,
            "--name", config.public_ip_name,
            "--query", "id",
            "--output", "tsv",
        ], capture_output=True)
        public_ip_id = result.stdout.strip()

        if not public_ip_id:
            print_error(
                f"Could not find public IP {config.public_ip_name} "
                f"in resource group {config.resource_group}"
            )
            return None

        result = run_command([
            "az", "network", "public-ip", "show",
            "--resource-group", config.resource_group,
            "--name", config.public_ip_name,
            "--query", "ipAddress",
            "--output", "tsv",
        ], capture_output=True)
        public_ip_address = result.stdout.strip()

        print_success(f"Using public IP: {public_ip_address} ({public_ip_id})")
        return public_ip_id, public_ip_address

    except subprocess.CalledProcessError:
        print_error("Failed to get public IP information")
        return None


def namespace_exists(namespace: str) -> bool:
    """Check if a Kubernetes namespace exists."""
    try:
        run_command(
            ["kubectl", "get", "namespace", namespace],
            suppress_output=True,
            check=False,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def create_namespace(namespace: str) -> None:
    """Create a Kubernetes namespace if it doesn't exist."""
    try:
        run_command(
            ["kubectl", "get", "namespace", namespace],
            suppress_output=True,
        )
    except subprocess.CalledProcessError:
        print_status(f"Creating namespace {namespace}...")
        run_command(["kubectl", "create", "namespace", namespace])


def deploy_nginx_ingress(config: DeployConfig) -> bool:
    """Deploy NGINX Ingress Controller.

    Returns:
        True if successful, False otherwise
    """
    print_header("Deploying NGINX Ingress Controller")

    # Get public IP info
    ip_info = get_public_ip_info(config)
    if not ip_info:
        return False
    _, public_ip_address = ip_info

    # Create namespace
    create_namespace(config.ingress_namespace)

    # Add Helm repository
    print_status("Adding NGINX Ingress Helm repository...")
    run_command(["helm", "repo", "add", "ingress-nginx",
                 "https://kubernetes.github.io/ingress-nginx"])
    run_command(["helm", "repo", "update"])

    # Deploy NGINX Ingress Controller
    print_status("Deploying NGINX Ingress Controller...")
    helm_args = [
        "helm", "upgrade", "--install", "nginx-ingress",
        "ingress-nginx/ingress-nginx",
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
    run_command(helm_args)

    # Wait for rollout
    print_status("Waiting for Ingress Controller to be ready...")
    run_command([
        "kubectl", "rollout", "status",
        "deployment", "nginx-ingress-ingress-nginx-controller",
        "-n", config.ingress_namespace,
        "--timeout=600s",
    ])

    # Get external IP
    result = run_command([
        "kubectl", "get", "service",
        "nginx-ingress-ingress-nginx-controller",
        "-n", config.ingress_namespace,
        "-o", "jsonpath={.status.loadBalancer.ingress[0].ip}",
    ], capture_output=True)
    ingress_ip = result.stdout.strip()
    print_success(f"NGINX Ingress Controller deployed with external IP: {ingress_ip}")

    return True


def deploy_application(config: DeployConfig) -> bool:
    """Deploy the VibeCode application.

    Returns:
        True if successful, False otherwise
    """
    print_header("Deploying VibeCode Application")

    # Create namespace
    create_namespace(config.app_namespace)

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
    print_status("Executing app_deploy.py...")
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

    print_status(f"Command: {' '.join(cmd)}")
    run_command(cmd)

    print_success("VibeCode application deployment completed")
    return True


def setup_ssl_certificates(config: DeployConfig) -> bool:
    """Set up SSL certificates with cert-manager.

    Returns:
        True if successful, False otherwise
    """
    print_header("Setting up SSL Certificates")

    # Check if cert-manager is installed
    try:
        run_command(
            ["kubectl", "get", "namespace", "cert-manager"],
            suppress_output=True,
        )
        print_success("cert-manager is already installed")
    except subprocess.CalledProcessError:
        print_status("Installing cert-manager...")

        # Create namespace
        run_command(["kubectl", "create", "namespace", "cert-manager"])

        # Add Helm repository
        run_command(["helm", "repo", "add", "jetstack", "https://charts.jetstack.io"])
        run_command(["helm", "repo", "update"])

        # Install cert-manager
        run_command([
            "helm", "install", "cert-manager", "jetstack/cert-manager",
            "--namespace", "cert-manager",
            "--create-namespace",
            "--set", "installCRDs=true",
            "--wait",
            "--timeout=600s",
        ])

    # Create Let's Encrypt ClusterIssuer
    print_status("Creating Let's Encrypt ClusterIssuer...")
    cluster_issuer_yaml = """\
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
    proc = subprocess.run(
        ["kubectl", "apply", "-f", "-"],
        input=cluster_issuer_yaml,
        text=True,
    )
    if proc.returncode != 0:
        print_error("Failed to create ClusterIssuer")
        return False

    print_success("SSL certificate setup completed")
    return True


def verify_deployment(config: DeployConfig) -> None:
    """Verify the deployment status."""
    print_header("Verifying Deployment")

    # Check ingress status
    print_status("Checking ingress status...")
    run_command(["kubectl", "get", "ingress", "-n", config.app_namespace])

    # Check pods
    print_status("\nChecking application pods...")
    run_command(["kubectl", "get", "pods", "-n", config.app_namespace])

    # Check services
    print_status("\nChecking services...")
    run_command(["kubectl", "get", "svc", "-n", config.app_namespace])

    # Print summary
    print(f"\n{GREEN}=== Deployment Summary ==={NC}")
    print(f"Domain: {config.domain}")
    print(f"Application namespace: {config.app_namespace}")
    print(f"Ingress namespace: {config.ingress_namespace}")
    print(f"Application release: {config.fullname_override}")

    # Verify DNS
    print_status("\nVerifying DNS resolution...")
    try:
        run_command(["nslookup", config.domain], suppress_output=True)
        print_success("DNS resolution successful!")

        print_status("\nTesting HTTP access...")
        result = run_command([
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            f"http://{config.domain}",
        ], capture_output=True, check=False)
        http_status = result.stdout.strip() or "Failed"
        print(f"HTTP status code: {http_status}")

        if config.setup_ssl:
            print_status("\nTesting HTTPS access (might take some time for SSL certificate to be issued)...")
            print_status("Note: It can take up to 5-10 minutes for Let's Encrypt to issue a certificate")
            result = run_command([
                "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                "-k", f"https://{config.domain}",
            ], capture_output=True, check=False)
            https_status = result.stdout.strip() or "Failed"
            print(f"HTTPS status code: {https_status}")

    except subprocess.CalledProcessError:
        print_error("DNS resolution failed.")

    print_success("\nDeployment process completed!")
    print(f"To verify the SSL certificate status, run: kubectl get certificate -n {config.app_namespace}")
    print(f"To verify the application is running, run: kubectl get pods -n {config.app_namespace}")
    print(f"To access the application, navigate to: https://{config.domain}")


def deploy(config: DeployConfig) -> int:
    """Run the full deployment.

    Args:
        config: Deployment configuration

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    print(f"{YELLOW}=== VibeCode AKS Deployment ==={NC}")
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

    # Deploy components
    if config.deploy_ingress:
        if not deploy_nginx_ingress(config):
            return 1
    else:
        print_status("\nSkipping NGINX Ingress Controller deployment")

    if config.deploy_app:
        if not deploy_application(config):
            return 1
    else:
        print_status("\nSkipping VibeCode application deployment")

    if config.setup_ssl:
        if not setup_ssl_certificates(config):
            return 1
    else:
        print_status("\nSkipping SSL certificate setup")

    # Verify deployment
    verify_deployment(config)

    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command line arguments.

    Args:
        argv: Command line arguments (defaults to sys.argv[1:])

    Returns:
        Parsed arguments
    """
    defaults = DeployConfig()

    parser = argparse.ArgumentParser(
        description="Deploy the full VibeCode stack to AKS",
    )
    parser.add_argument(
        "--resource-group",
        default=defaults.resource_group,
        help=f"Ingress/DNS resource group (Public IP) (default: {defaults.resource_group})",
    )
    parser.add_argument(
        "--ingress-resource-group",
        default="",
        help="Ingress public IP resource group (default: same as --resource-group)",
    )
    parser.add_argument(
        "--aks-resource-group",
        default=defaults.aks_resource_group,
        help=f"AKS cluster resource group (default: {defaults.aks_resource_group})",
    )
    parser.add_argument(
        "--cluster-name",
        default=defaults.cluster_name,
        help=f"AKS cluster name (default: {defaults.cluster_name})",
    )
    parser.add_argument(
        "--acr-name",
        default=defaults.acr_name,
        help=f"Azure Container Registry name (default: {defaults.acr_name})",
    )
    parser.add_argument(
        "--public-ip",
        default=defaults.public_ip_name,
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
        default=defaults.image_tag,
        help=f"Application image tag (default: {defaults.image_tag})",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point.

    Args:
        argv: Command line arguments (defaults to sys.argv[1:])

    Returns:
        Exit code
    """
    args = parse_args(argv)

    config = DeployConfig(
        resource_group=args.resource_group,
        ingress_resource_group=args.ingress_resource_group,
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

    return deploy(config)


if __name__ == "__main__":
    sys.exit(main())
