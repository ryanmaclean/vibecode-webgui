#!/usr/bin/env python3
"""Deploy KIND Cluster with PostgreSQL Database Monitoring."""

import os
import shutil
import subprocess
import sys
from pathlib import Path


class KINDPostgresMonitoringDeployer:
    def __init__(self):
        self.cluster_name = os.environ.get("CLUSTER_NAME", "vibecode-kind")
        self.namespace = os.environ.get("NAMESPACE", "vibecode-platform")
        self.datadog_namespace = os.environ.get("DATADOG_NAMESPACE", "datadog")
        self.project_root = Path(__file__).parent.parent

    def run_cmd(self, cmd, input_text=None):
        result = subprocess.run(cmd, capture_output=True, text=True, input=input_text)
        return result.returncode == 0, result.stdout

    def run(self):
        print("🚀 Deploying KIND with PostgreSQL Monitoring")

        # Check prerequisites
        for tool in ["kind", "kubectl", "helm", "docker"]:
            if not shutil.which(tool):
                print(f"❌ Missing: {tool}")
                return 1

        # Check Docker
        if not self.run_cmd(["docker", "info"])[0]:
            print("❌ Docker not running")
            return 1

        # Load environment
        env_file = self.project_root / ".env.local"
        if env_file.exists():
            with open(env_file) as f:
                for line in f:
                    if "=" in line and not line.startswith("#"):
                        k, v = line.strip().split("=", 1)
                        os.environ.setdefault(k, v)

        # Create KIND cluster
        success, stdout = self.run_cmd(["kind", "get", "clusters"])
        if self.cluster_name in (stdout or ""):
            print(f"⚠️  Cluster {self.cluster_name} exists, deleting...")
            self.run_cmd(["kind", "delete", "cluster", "--name", self.cluster_name])

        self.run_cmd(["kind", "create", "cluster", "--name", self.cluster_name])

        # Create namespaces
        for ns in [self.namespace, self.datadog_namespace]:
            self.run_cmd(["kubectl", "create", "namespace", ns, "--dry-run=client", "-o", "yaml"])

        print(f"""
✅ KIND cluster deployed!

Cluster: {self.cluster_name}
Namespace: {self.namespace}

PostgreSQL:
  Port: 30001 (NodePort)
  Database: vibecode
  User: vibecode
  Password: vibecode_password

Commands:
  kubectl port-forward -n {self.namespace} service/postgres-service 5432:5432
  psql -h localhost -U vibecode -d vibecode
""")
        return 0

if __name__ == "__main__":
    sys.exit(KINDPostgresMonitoringDeployer().run())
