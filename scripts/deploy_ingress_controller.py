#!/usr/bin/env python3
"""Deploy NGINX Ingress Controller to AKS with specific public IP."""

import os
import shutil
import subprocess
import sys


class IngressControllerDeployer:
    def __init__(self):
        self.resource_group = os.environ.get("RESOURCE_GROUP", "rg-vibecode-dns")
        self.public_ip_name = os.environ.get("PUBLIC_IP_NAME", "vibecode-dns-ip")
        self.ingress_namespace = os.environ.get("INGRESS_NAMESPACE", "ingress-nginx")

    def run_cmd(self, cmd):
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0, result.stdout, result.stderr

    def run(self):
        print("🔧 Deploying NGINX Ingress Controller")

        # Check prerequisites
        for tool in ["az", "kubectl", "helm"]:
            if not shutil.which(tool):
                print(f"❌ Missing: {tool}")
                return 1

        # Check Azure login
        if not self.run_cmd(["az", "account", "show"])[0]:
            print("❌ Not logged into Azure")
            return 1

        # Get public IP
        success, stdout, _ = self.run_cmd([
            "az", "network", "public-ip", "show",
            "--resource-group", self.resource_group,
            "--name", self.public_ip_name,
            "--query", "ipAddress", "-o", "tsv"
        ])
        if not success:
            print(f"❌ Public IP not found: {self.public_ip_name}")
            return 1

        public_ip = stdout.strip()
        print(f"✅ Using public IP: {public_ip}")

        # Create namespace
        self.run_cmd(["kubectl", "create", "namespace", self.ingress_namespace])

        # Add helm repo and deploy
        self.run_cmd(["helm", "repo", "add", "ingress-nginx", "https://kubernetes.github.io/ingress-nginx"])
        self.run_cmd(["helm", "repo", "update"])

        self.run_cmd([
            "helm", "upgrade", "--install", "nginx-ingress", "ingress-nginx/ingress-nginx",
            "--namespace", self.ingress_namespace,
            "--set", f"controller.service.loadBalancerIP={public_ip}",
            "--wait", "--timeout=600s"
        ])

        print("✅ NGINX Ingress Controller deployed!")
        return 0

if __name__ == "__main__":
    sys.exit(IngressControllerDeployer().run())
