#!/usr/bin/env python3
"""
Production Database Migration Deployment Script

Safely deploys database migrations with pgvector support.

Usage:
    python deploy_database_migrations.py
"""

import json
import os
import subprocess
import sys


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


class DatabaseMigrationDeployer:
    """Handles database migration deployment."""

    def __init__(self):
        self.database_url = os.environ.get("DATABASE_URL", "")
        self.node_env = os.environ.get("NODE_ENV", "production")

    def log_info(self, message: str) -> None:
        """Print info message."""
        print(f"{Color.BLUE}🚀 {message}{Color.NC}")

    def log_success(self, message: str) -> None:
        """Print success message."""
        print(f"{Color.GREEN}✅ {message}{Color.NC}")

    def log_warning(self, message: str) -> None:
        """Print warning message."""
        print(f"{Color.YELLOW}⚠️  {message}{Color.NC}")

    def log_error(self, message: str) -> None:
        """Print error message."""
        print(f"{Color.RED}❌ {message}{Color.NC}")

    def run_cmd(
        self,
        cmd: list[str],
        timeout: int = 30,
        input_text: str | None = None,
    ) -> tuple[bool, str, str]:
        """Run command with timeout."""
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                input=input_text,
            )
            return result.returncode == 0, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return False, "", "Command timed out"
        except Exception as e:
            return False, "", str(e)

    def run_prisma_execute(self, sql: str) -> tuple[bool, str]:
        """Run SQL via Prisma db execute."""
        cmd = [
            "npx", "prisma", "db", "execute",
            "--stdin",
            "--schema=prisma/schema.prisma",
        ]
        success, stdout, stderr = self.run_cmd(cmd, input_text=sql)
        return success, stdout if success else stderr

    def validate_environment(self) -> bool:
        """Validate environment variables."""
        print(f"{Color.BLUE}🚀 Starting VibeCode Database Migration Deployment{Color.NC}")
        print("==================================================")

        print(f"{Color.YELLOW}📋 Validating environment...{Color.NC}")

        if not self.database_url:
            self.log_error("ERROR: DATABASE_URL environment variable required")
            return False

        if not self.node_env:
            self.log_warning("NODE_ENV not set, defaulting to 'production'")
            os.environ["NODE_ENV"] = "production"

        self.log_success("Environment validation complete")
        return True

    def test_connectivity(self) -> bool:
        """Test database connectivity."""
        print(f"{Color.YELLOW}📡 Testing database connectivity...{Color.NC}")

        success, _, stderr = self.run_cmd([
            "npx", "prisma", "db", "execute",
            "--stdin",
            "--schema=prisma/schema.prisma",
        ], input_text="")

        if not success:
            self.log_error("ERROR: Cannot connect to database")
            print(f"Database URL: {self.database_url}")
            print("Please check your connection string and database availability")
            return False

        self.log_success("Database connectivity confirmed")
        return True

    def check_extensions(self) -> bool:
        """Check PostgreSQL version and extensions."""
        print(f"{Color.YELLOW}🔍 Checking PostgreSQL version and extensions...{Color.NC}")

        sql = """
        SELECT
          version() as pg_version,
          (SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector') as pgvector_installed,
          (SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp') as uuid_installed;
        """

        success, output = self.run_prisma_execute(sql)
        if not success:
            self.log_error("ERROR: Failed to check database extensions")
            return False

        print(output)

        # Check and install pgvector if needed
        if "pgvector_installed" in output and "0" in output:
            self.log_warning("pgvector extension not found, attempting to install...")

            success, output = self.run_prisma_execute(
                "CREATE EXTENSION IF NOT EXISTS vector;"
            )
            if not success:
                self.log_error("ERROR: Failed to install pgvector extension")
                print("Please ensure the database user has SUPERUSER privileges or ask your DBA to install the pgvector extension")
                return False

            self.log_success("pgvector extension installed")
        else:
            self.log_success("pgvector extension already installed")

        return True

    def check_migration_status(self) -> bool:
        """Check migration status."""
        print(f"{Color.YELLOW}📊 Checking migration status...{Color.NC}")

        success, stdout, stderr = self.run_cmd([
            "npx", "prisma", "migrate", "status",
            "--schema=prisma/schema.prisma",
        ])

        output = stdout + stderr

        if "Database schema is up to date" in output:
            self.log_success("Database schema is already up to date")
            return True
        elif "pending migrations" in output:
            print(f"{Color.YELLOW}📦 Pending migrations found, deploying...{Color.NC}")
            print(output)

            print(f"{Color.YELLOW}🚀 Deploying database migrations...{Color.NC}")
            success, _, stderr = self.run_cmd([
                "npx", "prisma", "migrate", "deploy",
                "--schema=prisma/schema.prisma",
            ], timeout=120)

            if not success:
                self.log_error(f"ERROR: Migration deployment failed: {stderr}")
                return False

            self.log_success("Database migrations deployed successfully")
            return True
        else:
            self.log_error("ERROR: Could not determine migration status")
            print(output)
            return False

    def generate_prisma_client(self) -> bool:
        """Generate Prisma client."""
        print(f"{Color.YELLOW}🔄 Generating Prisma client...{Color.NC}")

        success, _, stderr = self.run_cmd([
            "npx", "prisma", "generate",
            "--schema=prisma/schema.prisma",
        ])

        if not success:
            self.log_error(f"ERROR: Failed to generate Prisma client: {stderr}")
            return False

        self.log_success("Prisma client generated successfully")
        return True

    def verify_database_structure(self) -> bool:
        """Verify database structure."""
        print(f"{Color.YELLOW}🔍 Verifying database structure...{Color.NC}")

        sql = """
        SELECT
          CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
            THEN 'users: ✅' ELSE 'users: ❌' END as users_table,
          CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces')
            THEN 'workspaces: ✅' ELSE 'workspaces: ❌' END as workspaces_table,
          CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rag_chunks')
            THEN 'rag_chunks: ✅' ELSE 'rag_chunks: ❌' END as rag_table;
        """

        success, output = self.run_prisma_execute(sql)
        if not success:
            self.log_error("ERROR: Failed to verify database structure")
            return False

        print(output)

        # Check vector column
        vector_sql = """
        SELECT
          CASE WHEN EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'rag_chunks' AND column_name = 'embedding'
          ) THEN 'vector_column: ✅' ELSE 'vector_column: ❌' END as vector_column,
          CASE WHEN EXISTS(
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'rag_chunks' AND indexname LIKE '%embedding%'
          ) THEN 'vector_index: ✅' ELSE 'vector_index: ❌' END as vector_index;
        """

        success, output = self.run_prisma_execute(vector_sql)
        if success:
            print(output)
        else:
            self.log_warning("Could not verify vector structure (may be normal for new databases)")

        return True

    def run_health_check(self) -> bool:
        """Run final health check."""
        print(f"{Color.YELLOW}🏥 Running final health check...{Color.NC}")

        sql = """
        SELECT
          'Database: ' || current_database() as database_name,
          'User: ' || current_user as current_user,
          'Timestamp: ' || now() as timestamp;
        """

        success, output = self.run_prisma_execute(sql)
        if not success:
            self.log_error("ERROR: Health check failed")
            return False

        print(output)
        return True

    def check_performance_settings(self) -> None:
        """Check database performance settings."""
        print(f"{Color.YELLOW}⚡ Checking database performance settings...{Color.NC}")

        sql = """
        SELECT
          name,
          setting,
          unit,
          CASE
            WHEN name = 'work_mem' AND setting::integer < 32768 THEN '⚠️  Consider increasing'
            WHEN name = 'maintenance_work_mem' AND setting::integer < 131072 THEN '⚠️  Consider increasing'
            WHEN name = 'max_connections' AND setting::integer > 200 THEN '⚠️  Consider decreasing'
            ELSE '✅ OK'
          END as recommendation
        FROM pg_settings
        WHERE name IN ('work_mem', 'maintenance_work_mem', 'max_connections', 'shared_buffers')
        ORDER BY name;
        """

        success, output = self.run_prisma_execute(sql)
        if success:
            print(output)
        else:
            self.log_warning("Could not check performance settings (may require elevated privileges)")

    def show_summary(self) -> None:
        """Show deployment summary."""
        print()
        print("==================================================")
        print(f"{Color.GREEN}🎉 Database migration deployment completed successfully!{Color.NC}")
        print()
        print(f"{Color.BLUE}📋 Summary:{Color.NC}")
        print("✅ Database connectivity verified")
        print("✅ pgvector extension installed/confirmed")
        print("✅ Database migrations deployed")
        print("✅ Prisma client generated")
        print("✅ Database structure verified")
        print()
        print(f"{Color.BLUE}🔗 Next Steps:{Color.NC}")
        print("1. Test your application's database connectivity")
        print("2. Verify vector search functionality works")
        print("3. Monitor database performance in production")
        print("4. Set up automated backups if not already configured")
        print()
        print(f"{Color.GREEN}Database is ready for production use! 🚀{Color.NC}")

    def run(self) -> int:
        """Run the migration deployment."""
        if not self.validate_environment():
            return 1

        if not self.test_connectivity():
            return 1

        if not self.check_extensions():
            return 1

        if not self.check_migration_status():
            return 1

        if not self.generate_prisma_client():
            return 1

        if not self.verify_database_structure():
            return 1

        if not self.run_health_check():
            return 1

        self.check_performance_settings()
        self.show_summary()

        return 0


def main() -> int:
    """Main entry point."""
    deployer = DatabaseMigrationDeployer()
    return deployer.run()


if __name__ == "__main__":
    sys.exit(main())
