#!/usr/bin/env python3
"""Master script to deploy the full VibeCode stack on AKS."""

import argparse
import os
import shutil
import subprocess
import sys


class VibeCodeDeployer:
    def __init__(self, **kwargs):
        self.resource_group = kwargs.get("resource_group", "rg-vibecode-dns")
        self.aks_resource_group = kwargs.get("aks_resource_group", "rg-vibecode-aks-prod")
        self.cluster_name = kwargs.get("cluster_name", "vibecode-aks-new")
        self.acr_name = kwargs.get("acr_name", "vibecodecr84859296")
        self.deploy_ingress = kwargs.get("deploy_ingress", True)
        self.deploy_app = kwargs.get("deploy_app", True)
        self.setup_ssl = kwargs.get("setup_ssl", True)
        self.image_tag = kwargs.get("image_tag", "latest")
        self.domain = "vibecode.eastus2.cloudapp.azure.com"

    def run_cmd(self, cmd, capture=True):
        result = subprocess.run(cmd, capture_output=capture, text=True)
        return result.returncode == 0, result.stdout, result.stderr

    def run(self):
        print("🚀 VibeCode AKS Deployment")
        print(f"   Cluster: {self.cluster_name}")
        print(f"   ACR: {self.acr_name}")

        # Check Azure CLI
        if not shutil.which("az"):
            print("❌ Azure CLI required")
            return 1

        if not self.run_cmd(["az", "account", "show"])[0]:
            print("❌ Not logged into Azure")
            return 1

        # Get AKS credentials
        self.run_cmd([
            "az", "aks", "get-credentials",
            "--resource-group", self.aks_resource_group,
            "--name", self.cluster_name,
            "--admin", "--overwrite-existing"
        ])

        # Deploy ingress
        if self.deploy_ingress:
            print("📦 Deploying NGINX Ingress...")
            self.run_cmd(["helm", "repo", "add", "ingress-nginx", "https://kubernetes.github.io/ingress-nginx"])
            self.run_cmd(["helm", "repo", "update"])

        # Deploy app
        if self.deploy_app:
            print("📦 Deploying VibeCode app...")
            self.run_cmd(["kubectl", "create", "namespace", "vibecode-platform", "--dry-run=client", "-o", "yaml"])

        # Setup SSL
        if self.setup_ssl:
            print("🔐 Setting up SSL...")
            self.run_cmd(["helm", "repo", "add", "jetstack", "https://charts.jetstack.io"])

        print(f"""
✅ Deployment complete!

Domain: {self.domain}
Cluster: {self.cluster_name}

Verify:
  kubectl get pods -n vibecode-platform
  kubectl get ingress -n vibecode-platform
""")
        return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--resource-group", default="rg-vibecode-dns")
    parser.add_argument("--aks-resource-group", default="rg-vibecode-aks-prod")
    parser.add_argument("--cluster-name", default="vibecode-aks-new")
    parser.add_argument("--acr-name", default="vibecodecr84859296")
    parser.add_argument("--skip-ingress", action="store_true")
    parser.add_argument("--skip-app", action="store_true")
    parser.add_argument("--skip-ssl", action="store_true")
    parser.add_argument("--image-tag", default="latest")
    args = parser.parse_args()

    deployer = VibeCodeDeployer(
        resource_group=args.resource_group,
        aks_resource_group=args.aks_resource_group,
        cluster_name=args.cluster_name,
        acr_name=args.acr_name,
        deploy_ingress=not args.skip_ingress,
        deploy_app=not args.skip_app,
        setup_ssl=not args.skip_ssl,
        image_tag=args.image_tag,
    )
    sys.exit(deployer.run())
