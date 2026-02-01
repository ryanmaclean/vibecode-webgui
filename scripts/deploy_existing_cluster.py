#!/usr/bin/env python3
"""Deploy to Existing Cluster - works with current KIND cluster and PostgreSQL."""

import os
import subprocess
import sys
from pathlib import Path


class ExistingClusterDeployer:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.project_root = self.script_dir.parent
        self.namespace = "vibecode-platform"

    def run_cmd(self, cmd, cwd=None):
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
        return result.returncode == 0

    def run(self):
        print("🚀 DEPLOYING TO EXISTING CLUSTER")

        # Check cluster
        if not self.run_cmd(["kubectl", "cluster-info", "--context", "kind-vibecode-kind-local"]):
            print("❌ Cannot connect to KIND cluster")
            return 1

        self.run_cmd(["kubectl", "config", "use-context", "kind-vibecode-kind-local"])
        self.run_cmd(["kubectl", "create", "namespace", self.namespace, "--dry-run=client", "-o", "yaml"])

        # Build app
        os.chdir(self.project_root)
        self.run_cmd(["npm", "ci"])
        self.run_cmd(["npm", "run", "build"])

        print(f"""
🎉 Deployed to existing cluster!

Access: http://localhost:30000
Cluster: vibecode-kind-local
Namespace: {self.namespace}

Commands:
  kubectl get pods -n {self.namespace}
  kubectl logs -n {self.namespace} -l app=vibecode-webgui
""")
        return 0

if __name__ == "__main__":
    sys.exit(ExistingClusterDeployer().run())
