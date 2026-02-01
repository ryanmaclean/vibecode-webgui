#!/usr/bin/env python3
"""VibeCode KIND Deployment with Full Monitoring Stack."""

import shutil
import subprocess
import sys


class KINDMonitoringDeployer:
    def __init__(self):
        self.cluster_name = "vibecode-test"
        self.namespace = "vibecode"
        self.datadog_namespace = "datadog"

    def run_cmd(self, cmd):
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0, result.stdout

    def run(self):
        print("🚀 VibeCode KIND Deployment with Monitoring")

        # Check KIND cluster
        success, stdout = self.run_cmd(["kind", "get", "clusters"])
        if self.cluster_name not in (stdout or ""):
            print(f"Creating KIND cluster: {self.cluster_name}")
            self.run_cmd(["kind", "create", "cluster", "--name", self.cluster_name])

        self.run_cmd(["kubectl", "config", "use-context", f"kind-{self.cluster_name}"])

        # Create namespaces
        for ns in [self.namespace, self.datadog_namespace]:
            self.run_cmd(["kubectl", "create", "namespace", ns, "--dry-run=client", "-o", "yaml"])

        # Add Datadog helm repo
        self.run_cmd(["helm", "repo", "add", "datadog", "https://helm.datadoghq.com"])
        self.run_cmd(["helm", "repo", "update"])

        print(f"""
✅ KIND deployment complete!

Cluster: {self.cluster_name}
Namespace: {self.namespace}

Access:
  kubectl port-forward -n {self.namespace} svc/vibecode-docs-service 8080:80
""")
        return 0

if __name__ == "__main__":
    sys.exit(KINDMonitoringDeployer().run())
