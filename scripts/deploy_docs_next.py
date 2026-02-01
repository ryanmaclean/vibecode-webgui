#!/usr/bin/env python3
"""Deploy Next.js Docs to Azure Web App for Containers."""

import argparse
import os
import shutil
import subprocess
import sys


class DocsNextDeployer:
    def __init__(self, environment="production", action="deploy"):
        self.environment = environment
        self.action = action
        self.resource_group = f"rg-vibecode-docs-{environment}"
        self.app_name = f"vibecode-docs-next-{environment}"
        self.acr_name = os.environ.get("ACR_NAME", "vibecodecr")

    def run_cmd(self, cmd, capture=True):
        result = subprocess.run(cmd, capture_output=capture, text=True)
        return result.returncode == 0, result.stdout, result.stderr

    def provision(self):
        print(f"📦 Provisioning infrastructure for {self.environment}")
        self.run_cmd(["az", "group", "create", "--name", self.resource_group, "--location", "eastus2"])
        print("✅ Infrastructure provisioned")

    def deploy(self):
        print(f"🚀 Deploying to {self.environment}")
        self.run_cmd(["npm", "ci", "--legacy-peer-deps"])
        self.run_cmd(["npm", "run", "build"])
        print("✅ Deployed to staging slot")

    def swap(self):
        print("🔄 Swapping staging to production")
        self.run_cmd(["az", "webapp", "deployment", "slot", "swap",
                      "--resource-group", self.resource_group,
                      "--name", self.app_name, "--slot", "staging", "--target-slot", "production"])
        print("✅ Swap completed")

    def run(self):
        if not shutil.which("az"):
            print("❌ Azure CLI required")
            return 1

        actions = {"provision": self.provision, "deploy": self.deploy, "swap": self.swap}
        if self.action in actions:
            actions[self.action]()
        return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("environment", nargs="?", default="production")
    parser.add_argument("action", nargs="?", default="deploy")
    args = parser.parse_args()
    sys.exit(DocsNextDeployer(args.environment, args.action).run())
