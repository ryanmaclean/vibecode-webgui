#!/usr/bin/env python3
"""Simple Local Deployment Script - works with existing PostgreSQL and any K8s setup."""

import os
import shutil
import subprocess
import sys
from pathlib import Path


class SimpleLocalDeployer:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.project_root = self.script_dir.parent

    def run_cmd(self, cmd, cwd=None):
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
        return result.returncode == 0

    def run(self):
        print("🚀 Simple Local Deployment")

        # Check prerequisites
        for tool in ["node", "npm"]:
            if not shutil.which(tool):
                print(f"❌ Missing: {tool}")
                return 1

        os.chdir(self.project_root)

        # Check PostgreSQL
        result = subprocess.run(["docker", "ps"], capture_output=True, text=True)
        if "postgres" not in result.stdout:
            print("⚠️ Starting PostgreSQL...")
            subprocess.run([
                "docker", "run", "-d", "--name", "vibecode-postgres",
                "-e", "POSTGRES_DB=vibecode",
                "-e", "POSTGRES_USER=vibecode",
                "-e", "POSTGRES_PASSWORD=vibecode_password",
                "-p", "5432:5432", "postgres:16"
            ])

        # Create .env.local if needed
        env_file = self.project_root / ".env.local"
        if not env_file.exists():
            env_file.write_text("""DATABASE_URL="postgresql://vibecode:vibecode_password@localhost:5432/vibecode"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret"
NODE_ENV="development"
""")
            print("✅ Created .env.local")

        # Install and build
        print("📦 Installing dependencies...")
        self.run_cmd(["npm", "ci"])

        print("🏗️ Building...")
        self.run_cmd(["npm", "run", "build"])

        print(f"""
🎉 Ready!

Application: http://localhost:3000
PostgreSQL: localhost:5432

Run: npm run dev
""")
        # Start dev server
        os.execvp("npm", ["npm", "run", "dev"])

if __name__ == "__main__":
    sys.exit(SimpleLocalDeployer().run())
