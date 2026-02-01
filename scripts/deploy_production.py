#!/usr/bin/env python3
"""Production Deployment Script with safety checks."""

import argparse
import os
import shutil
import subprocess
import sys


class ProductionDeployer:
    def __init__(self, skip_tests=False, dry_run=False):
        self.skip_tests = skip_tests
        self.dry_run = dry_run
        self.namespace = os.environ.get("NAMESPACE", "vibecode-production")

    def run_cmd(self, cmd):
        if self.dry_run:
            print(f"  DRY RUN: {' '.join(cmd)}")
            return True
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0

    def run(self):
        print("🚀 Production Deployment")

        # Safety checks
        for tool in ["kubectl", "helm", "npm"]:
            if not shutil.which(tool):
                print(f"❌ Missing: {tool}")
                return 1

        # Confirm production deployment
        if not self.dry_run:
            print("⚠️  You are about to deploy to PRODUCTION")
            confirm = input("Type 'yes' to continue: ")
            if confirm != "yes":
                print("Cancelled")
                return 0

        # Run tests
        if not self.skip_tests:
            print("🧪 Running tests...")
            if not self.run_cmd(["npm", "test"]):
                print("❌ Tests failed")
                return 1

        # Build
        print("🏗️ Building...")
        self.run_cmd(["npm", "ci"])
        self.run_cmd(["npm", "run", "build"])

        # Deploy
        print("📦 Deploying...")
        self.run_cmd(["kubectl", "apply", "-f", "k8s/production/", "--recursive"])

        print("✅ Production deployment complete!")
        return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-tests", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sys.exit(ProductionDeployer(args.skip_tests, args.dry_run).run())
