#!/usr/bin/env python3
"""PostgreSQL + pgvector installation helper for AKS clusters.

This tool replaces the legacy `aks-postgresql-setup.sh` script and wraps the
kubectl orchestration in a test-friendly Python module.
"""

from __future__ import annotations

import argparse
import base64
import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

DEFAULT_STORAGE_CLASS = "managed-csi"
DEFAULT_STORAGE_SIZE = "50Gi"


class CommandError(RuntimeError):
    """Raised when a shell command fails."""


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(  # noqa: S603
            cmd,
            input_text=input_text,
            text=True,
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:  # pragma: no cover - passthrough
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def generate_password() -> str:
    """Generate a secure random password."""
    return base64.b64encode(secrets.token_bytes(24)).decode('ascii')


def ensure_namespace(namespace: str) -> None:
    """Create namespace if it doesn't exist."""
    manifest = dedent(
        f"""
        apiVersion: v1
        kind: Namespace
        metadata:
          name: {namespace}
        """
    )
    run(["kubectl", "apply", "-f", "-"], input_text=manifest)


def create_postgres_secret(namespace: str, postgres_password: str, datadog_password: str) -> None:
    """Create PostgreSQL secrets."""
    cmd = [
        "kubectl",
        "--namespace", namespace,
        "create", "secret", "generic", "postgres-secret",
        "--dry-run=client", "-o", "yaml",
        "--from-literal", f"postgres-password={postgres_password}",
        "--from-literal", f"datadog-password={datadog_password}",
    ]
    
    render = run(cmd)
    run(["kubectl", "apply", "-f", "-"], input_text=render.stdout)


def create_postgres_configmap(namespace: str) -> None:
    """Create PostgreSQL configuration ConfigMap."""
    config = dedent("""
        # PostgreSQL 16 configuration optimized for pgvector
        shared_preload_libraries = 'pg_stat_statements,pg_cron'
        max_connections = 200
        shared_buffers = 256MB
        effective_cache_size = 1GB
        maintenance_work_mem = 64MB
        checkpoint_completion_target = 0.9
        wal_buffers = 16MB
        default_statistics_target = 100
        random_page_cost = 1.1
        effective_io_concurrency = 200
        work_mem = 4MB
        min_wal_size = 1GB
        max_wal_size = 4GB
        max_worker_processes = 8
        max_parallel_workers_per_gather = 4
        max_parallel_workers = 8
        max_parallel_maintenance_workers = 4
        
        # Logging configuration
        log_destination = 'stderr'
        logging_collector = on
        log_directory = 'log'
        log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
        log_truncate_on_rotation = on
        log_rotation_age = 1d
        log_rotation_size = 10MB
        log_min_duration_statement = 1000
        log_checkpoints = on
        log_connections = on
        log_disconnections = on
        log_lock_waits = on
        log_temp_files = 0
        log_autovacuum_min_duration = 0
        log_error_verbosity = default
        
        # pgvector specific settings
        max_wal_size = 2GB
    """)
    
    cmd = [
        "kubectl",
        "--namespace", namespace,
        "create", "configmap", "postgres-config",
        "--dry-run=client", "-o", "yaml",
        "--from-literal", f"postgresql.conf={config}",
    ]
    
    render = run(cmd)
    run(["kubectl", "apply", "-f", "-"], input_text=render.stdout)


def create_postgres_init_script(namespace: str) -> None:
    """Create PostgreSQL initialization script."""
    init_script = dedent("""
        #!/bin/bash
        set -e
        
        # Create datadog user for monitoring
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
            CREATE USER datadog WITH PASSWORD '$DATADOG_PASSWORD';
            GRANT SELECT ON pg_stat_database TO datadog;
            GRANT SELECT ON pg_stat_activity TO datadog;
            GRANT SELECT ON pg_stat_replication TO datadog;
            GRANT USAGE ON SCHEMA public TO datadog;
            GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;
            
            -- Install pgvector extension
            CREATE EXTENSION IF NOT EXISTS vector;
            
            -- Verify pgvector installation
            SELECT extname FROM pg_extension WHERE extname='vector';
        EOSQL
        
        echo "PostgreSQL initialization complete with pgvector extension"
    """)
    
    cmd = [
        "kubectl",
        "--namespace", namespace,
        "create", "configmap", "postgres-init",
        "--dry-run=client", "-o", "yaml",
        "--from-literal", f"init-pgvector.sh={init_script}",
    ]
    
    render = run(cmd)
    run(["kubectl", "apply", "-f", "-"], input_text=render.stdout)


def create_postgres_statefulset(namespace: str, storage_class: str, storage_size: str) -> None:
    """Create PostgreSQL StatefulSet with pgvector."""
    manifest = dedent(f"""
        apiVersion: apps/v1
        kind: StatefulSet
        metadata:
          name: postgresql
          namespace: {namespace}
          labels:
            app: postgresql
        spec:
          serviceName: postgres-service
          replicas: 1
          selector:
            matchLabels:
              app: postgresql
          template:
            metadata:
              labels:
                app: postgresql
            spec:
              containers:
              - name: postgresql
                image: pgvector/pgvector:pg16
                ports:
                - containerPort: 5432
                  name: postgres
                env:
                - name: POSTGRES_DB
                  value: "vibecode"
                - name: POSTGRES_USER
                  value: "postgres"
                - name: POSTGRES_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgres-secret
                      key: postgres-password
                - name: DATADOG_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgres-secret
                      key: datadog-password
                - name: PGDATA
                  value: /var/lib/postgresql/data/pgdata
                volumeMounts:
                - name: postgres-storage
                  mountPath: /var/lib/postgresql/data
                - name: postgres-config
                  mountPath: /etc/postgresql/postgresql.conf
                  subPath: postgresql.conf
                - name: postgres-init
                  mountPath: /docker-entrypoint-initdb.d/init-pgvector.sh
                  subPath: init-pgvector.sh
                resources:
                  requests:
                    memory: "512Mi"
                    cpu: "250m"
                  limits:
                    memory: "2Gi"
                    cpu: "1000m"
                livenessProbe:
                  exec:
                    command:
                    - /bin/bash
                    - -c
                    - pg_isready -U postgres -d vibecode
                  initialDelaySeconds: 30
                  periodSeconds: 10
                  timeoutSeconds: 5
                  failureThreshold: 3
                readinessProbe:
                  exec:
                    command:
                    - /bin/bash
                    - -c
                    - pg_isready -U postgres -d vibecode
                  initialDelaySeconds: 15
                  periodSeconds: 5
                  timeoutSeconds: 3
                  failureThreshold: 3
              volumes:
              - name: postgres-config
                configMap:
                  name: postgres-config
                  defaultMode: 0644
              - name: postgres-init
                configMap:
                  name: postgres-init
                  defaultMode: 0755
          volumeClaimTemplates:
          - metadata:
              name: postgres-storage
            spec:
              accessModes: [ "ReadWriteOnce" ]
              storageClassName: {storage_class}
              resources:
                requests:
                  storage: {storage_size}
        ---
        apiVersion: v1
        kind: Service
        metadata:
          name: postgres-service
          namespace: {namespace}
          labels:
            app: postgresql
        spec:
          selector:
            app: postgresql
          ports:
          - port: 5432
            targetPort: 5432
            protocol: TCP
            name: postgres
          type: ClusterIP
    """)
    
    run(["kubectl", "apply", "-f", "-"], input_text=manifest)


def wait_for_postgres(namespace: str, timeout: int) -> None:
    """Wait for PostgreSQL to be ready."""
    run([
        "kubectl", "--namespace", namespace,
        "rollout", "status", "statefulset/postgresql",
        f"--timeout={timeout}s"
    ])
    
    run([
        "kubectl", "--namespace", namespace,
        "wait", "--for=condition=Ready", "pod", "-l", "app=postgresql",
        f"--timeout={timeout}s"
    ])


def verify_pgvector(namespace: str) -> None:
    """Verify that pgvector extension is installed."""
    cmd = [
        "kubectl", "--namespace", namespace,
        "exec", "postgresql-0", "--",
        "psql", "-U", "postgres", "-d", "vibecode",
        "-c", "SELECT extname FROM pg_extension WHERE extname='vector';"
    ]
    
    result = run(cmd)
    if "vector" not in result.stdout:
        raise CommandError("pgvector extension not found in database")
    
    print("✅ pgvector extension verified successfully")


def test_database_connectivity(namespace: str) -> None:
    """Test database connectivity."""
    cmd = [
        "kubectl", "--namespace", namespace,
        "exec", "postgresql-0", "--",
        "pg_isready", "-U", "postgres", "-d", "vibecode"
    ]
    
    run(cmd)
    print("✅ Database connectivity test passed")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install PostgreSQL + pgvector on AKS")
    parser.add_argument("--namespace", default="vibecode-platform", help="Kubernetes namespace")
    parser.add_argument("--storage-class", default=DEFAULT_STORAGE_CLASS, help="Storage class for PVC")
    parser.add_argument("--storage-size", default=DEFAULT_STORAGE_SIZE, help="Storage size for PVC")
    parser.add_argument("--postgres-password", help="PostgreSQL password (auto-generated if not provided)")
    parser.add_argument("--datadog-password", help="Datadog user password (auto-generated if not provided)")
    parser.add_argument("--wait", action="store_true", help="Wait for rollout to complete")
    parser.add_argument(
        "--wait-timeout",
        type=int,
        default=600,
        help="Rollout wait timeout in seconds",
    )
    parser.add_argument("--verify", action="store_true", help="Verify pgvector extension after deployment")
    parser.add_argument("--test-connectivity", action="store_true", help="Test database connectivity")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        require_tool("kubectl")
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    # Generate passwords if not provided
    postgres_password = args.postgres_password or generate_password()
    datadog_password = args.datadog_password or generate_password()

    print(f"Installing PostgreSQL + pgvector in namespace: {args.namespace}")
    print(f"Storage class: {args.storage_class}, Size: {args.storage_size}")

    try:
        ensure_namespace(args.namespace)
        create_postgres_secret(args.namespace, postgres_password, datadog_password)
        create_postgres_configmap(args.namespace)
        create_postgres_init_script(args.namespace)
        create_postgres_statefulset(args.namespace, args.storage_class, args.storage_size)
        
        if args.wait:
            print("Waiting for PostgreSQL to be ready...")
            wait_for_postgres(args.namespace, args.wait_timeout)
        
        if args.verify:
            print("Verifying pgvector extension...")
            verify_pgvector(args.namespace)
        
        if args.test_connectivity:
            print("Testing database connectivity...")
            test_database_connectivity(args.namespace)
            
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    print("✅ PostgreSQL + pgvector installation complete")
    if not args.postgres_password:
        print(f"Generated PostgreSQL password: {postgres_password}")
    if not args.datadog_password:
        print(f"Generated Datadog password: {datadog_password}")
    
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
