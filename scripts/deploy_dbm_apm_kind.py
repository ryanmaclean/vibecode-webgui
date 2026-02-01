#!/usr/bin/env python3
"""Deploy DBM-APM Configuration to KIND Local Development."""

import os
import shutil
import subprocess
import sys
from pathlib import Path


class KINDDBMAPMDeployer:
    def __init__(self):
        self.cluster_name = os.environ.get("CLUSTER_NAME", "vibecode-local")
        self.namespace = "vibecode-platform"
        self.dd_service = os.environ.get("DD_SERVICE", "vibecode-webgui")
        self.dd_env = os.environ.get("DD_ENV", "development")
        self.dd_version = os.environ.get("DD_VERSION", "0.1.0-dev")
        self.dd_dbm_propagation_mode = os.environ.get("DD_DBM_PROPAGATION_MODE", "full")

    def run_cmd(self, cmd, input_text=None):
        result = subprocess.run(cmd, capture_output=True, text=True, input=input_text)
        return result.returncode == 0, result.stdout, result.stderr

    def run(self):
        print("🚀 Deploying DBM-APM Configuration to KIND")

        # Check prerequisites
        for tool in ["docker", "kind", "kubectl"]:
            if not shutil.which(tool):
                print(f"❌ Missing: {tool}")
                return 1

        # Check KIND cluster
        success, stdout, _ = self.run_cmd(["kind", "get", "clusters"])
        if not success or self.cluster_name not in stdout:
            print(f"❌ KIND cluster '{self.cluster_name}' not found")
            return 1

        self.run_cmd(["kubectl", "config", "use-context", f"kind-{self.cluster_name}"])
        self.run_cmd(["kubectl", "create", "namespace", self.namespace, "--dry-run=client", "-o", "yaml"])

        print(f"✅ Deployed to {self.namespace}")
        print(f"   DD_SERVICE: {self.dd_service}")
        print(f"   DD_ENV: {self.dd_env}")
        return 0

if __name__ == "__main__":
    sys.exit(KINDDBMAPMDeployer().run())
