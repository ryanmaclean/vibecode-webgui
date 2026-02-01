#!/usr/bin/env python3
"""Deploy Complete RAG Stack on remote host (full version with pgvector compilation)."""

import subprocess
import sys


class RAGStackDeployer:
    def __init__(self):
        self.host = "studio@i9-zfs-pop.local"
        self.network = "rag-network"

    def ssh_cmd(self, cmd):
        result = subprocess.run(["ssh", self.host, cmd], capture_output=True, text=True)
        return result.returncode == 0, result.stdout

    def run(self):
        print("🚀 Deploying RAG Stack")

        # Create network
        self.ssh_cmd(f"docker network create {self.network} 2>/dev/null || true")

        # Deploy PostgreSQL
        print("1️⃣ Deploying PostgreSQL + pgvector")
        self.ssh_cmd(f"""docker run -d --name rag-postgres --network {self.network} \
            -e POSTGRES_PASSWORD=vibecode2025 -e POSTGRES_DB=vibecode \
            -p 5432:5432 --restart unless-stopped postgres:16-alpine""")

        # Install pgvector
        print("   Installing pgvector extension...")
        self.ssh_cmd("""docker exec rag-postgres sh -c 'apk add --no-cache git build-base postgresql-dev && \
            cd /tmp && git clone https://github.com/pgvector/pgvector.git && \
            cd pgvector && make && make install'""")
        self.ssh_cmd("docker exec rag-postgres psql -U postgres -d vibecode -c 'CREATE EXTENSION IF NOT EXISTS vector;'")

        # Deploy Valkey
        print("2️⃣ Deploying Valkey")
        self.ssh_cmd(f"""docker run -d --name rag-valkey --network {self.network} \
            -p 6379:6379 --restart unless-stopped valkey/valkey:8.1-alpine \
            valkey-server --maxmemory 512mb""")

        # Deploy dev environment
        print("3️⃣ Deploying Development Environment")
        self.ssh_cmd(f"""docker run -d --name rag-dev --network {self.network} \
            -p 8080:8080 --restart unless-stopped alpine:3.22 tail -f /dev/null""")
        self.ssh_cmd("docker exec rag-dev sh -c 'apk add --no-cache nodejs npm git'")

        print(f"""
✅ RAG Stack Deployed!

PostgreSQL: postgresql://postgres:vibecode2025@i9-zfs-pop.local:5432/vibecode
Valkey: redis://i9-zfs-pop.local:6379
Dev: i9-zfs-pop.local:8080
Network: {self.network}
""")
        return 0

if __name__ == "__main__":
    sys.exit(RAGStackDeployer().run())
