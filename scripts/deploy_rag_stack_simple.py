#!/usr/bin/env python3
"""Deploy Complete RAG Stack on remote host (simple version with pre-built pgvector)."""

import subprocess
import sys


class RAGStackSimpleDeployer:
    def __init__(self):
        self.host = "studio@i9-zfs-pop.local"
        self.network = "rag-network"

    def ssh_cmd(self, cmd):
        result = subprocess.run(["ssh", self.host, cmd], capture_output=True, text=True)
        return result.returncode == 0, result.stdout

    def run(self):
        print("🚀 Deploying RAG Stack (Simple)")

        # Create network
        self.ssh_cmd(f"docker network create {self.network} 2>/dev/null || true")

        # Deploy PostgreSQL with pgvector
        print("1️⃣ Deploying PostgreSQL + pgvector")
        self.ssh_cmd("docker rm -f rag-postgres 2>/dev/null || true")
        self.ssh_cmd(f"""docker run -d --name rag-postgres --network {self.network} \
            -e POSTGRES_PASSWORD=vibecode2025 -e POSTGRES_DB=vibecode \
            -p 5432:5432 --restart unless-stopped ankane/pgvector:latest""")

        # Deploy Valkey
        print("2️⃣ Deploying Valkey")
        self.ssh_cmd("docker rm -f rag-valkey 2>/dev/null || true")
        self.ssh_cmd(f"""docker run -d --name rag-valkey --network {self.network} \
            -p 6379:6379 --restart unless-stopped valkey/valkey:8.1-alpine \
            valkey-server --maxmemory 512mb""")

        print(f"""
✅ RAG Stack Deployed!

PostgreSQL: postgresql://postgres:vibecode2025@i9-zfs-pop.local:5432/vibecode
Valkey: redis://i9-zfs-pop.local:6379
Network: {self.network}
""")
        return 0

if __name__ == "__main__":
    sys.exit(RAGStackSimpleDeployer().run())
