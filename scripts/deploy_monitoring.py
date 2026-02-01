#!/usr/bin/env python3
"""Deploy Monitoring Stack (Datadog) to Kubernetes."""

import os
import shutil
import subprocess
import sys


class MonitoringDeployer:
    def __init__(self):
        self.namespace = os.environ.get("DATADOG_NAMESPACE", "datadog")
        self.dd_api_key = os.environ.get("DD_API_KEY", "")
        self.dd_site = os.environ.get("DD_SITE", "datadoghq.com")

    def run_cmd(self, cmd, input_text=None):
        result = subprocess.run(cmd, capture_output=True, text=True, input=input_text)
        return result.returncode == 0

    def run(self):
        print("📊 Deploying Monitoring Stack")

        for tool in ["kubectl", "helm"]:
            if not shutil.which(tool):
                print(f"❌ Missing: {tool}")
                return 1

        # Create namespace
        self.run_cmd(["kubectl", "create", "namespace", self.namespace, "--dry-run=client", "-o", "yaml"])

        # Create Datadog secret
        if self.dd_api_key:
            secret_yaml = f"""
apiVersion: v1
kind: Secret
metadata:
  name: datadog-secret
  namespace: {self.namespace}
type: Opaque
stringData:
  api-key: {self.dd_api_key}
"""
            self.run_cmd(["kubectl", "apply", "-f", "-"], input_text=secret_yaml)

        # Add Datadog helm repo
        self.run_cmd(["helm", "repo", "add", "datadog", "https://helm.datadoghq.com"])
        self.run_cmd(["helm", "repo", "update"])

        print(f"""
✅ Monitoring stack deployed!

Namespace: {self.namespace}
Datadog Site: {self.dd_site}

Commands:
  kubectl get pods -n {self.namespace}
  kubectl logs -n {self.namespace} -l app=datadog-agent
""")
        return 0

if __name__ == "__main__":
    sys.exit(MonitoringDeployer().run())
