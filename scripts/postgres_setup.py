#!/usr/bin/env python3


"""PostgreSQL + pgvector setup helper for AKS clusters."""

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import argparse
import secrets
import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

DEFAULT_NAMESPACE = "vibecode-platform"
DEFAULT_STORAGE_CLASS = "managed-csi"
DEFAULT_STORAGE_SIZE = 50  # Gi
DEFAULT_IMAGE = "pgvector/pgvector:pg16"
DEFAULT_WAIT_TIMEOUT = 600


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, input_text: str | None = None, dry_run: bool = False) -> subprocess.CompletedProcess[str]:
    if dry_run:
        print(f"[DRY-RUN] {' '.join(cmd)}")
        if input_text:
            snippet = input_text if len(input_text) < 160 else f"{input_text[:157]}..."
            print(f"[DRY-RUN] with stdin:\n{snippet}")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    try:
        return subprocess.run(  # noqa: S603
            cmd,
            input=input_text,
            text=True,
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:  # pragma: no cover - delegated error
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def generate_password(length: int = 32) -> str:
    return secrets.token_urlsafe(length)  # >= length characters


def render_manifests(
    *,
    namespace: str,
    storage_class: str,
    storage_size: int,
    image: str,
    postgres_user: str,
    postgres_password: str,
    database: str,
    datadog_user: str,
    datadog_password: str,
) -> str:
    return dedent(
        f"""
        apiVersion: v1
        kind: Secret
        metadata:
          name: postgresql-secret
          namespace: {namespace}
        type: Opaque
        stringData:
          POSTGRES_USER: {postgres_user}
          POSTGRES_PASSWORD: {postgres_password}
          POSTGRES_DB: {database}
          DATADOG_USER: {datadog_user}
          DATADOG_PASSWORD: {datadog_password}
        ---
        apiVersion: v1
        kind: ConfigMap
        metadata:
          name: postgresql-init
          namespace: {namespace}
        data:
          init.sql: |
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
            CREATE USER {datadog_user} WITH PASSWORD '{datadog_password}';
            GRANT pg_monitor TO {datadog_user};
            GRANT pg_read_all_stats TO {datadog_user};
            GRANT pg_read_all_settings TO {datadog_user};
            GRANT SELECT ON pg_stat_database TO {datadog_user};
            CREATE SCHEMA IF NOT EXISTS app;
            GRANT USAGE ON SCHEMA app TO {datadog_user};
          postgresql.conf: |
            shared_preload_libraries = 'pg_stat_statements,vector'
            shared_buffers = 256MB
            work_mem = 64MB
            maintenance_work_mem = 128MB
            max_wal_size = 2GB
            checkpoint_completion_target = 0.9
            max_connections = 100
            log_statement = 'none'
            log_min_duration_statement = 1000
            log_checkpoints = on
            log_connections = on
            log_disconnections = on
            log_lock_waits = on
        ---
        apiVersion: apps/v1
        kind: StatefulSet
        metadata:
          name: postgresql
          namespace: {namespace}
          labels:
            app: postgresql
            component: database
        spec:
          serviceName: postgresql
          replicas: 1
          selector:
            matchLabels:
              app: postgresql
          template:
            metadata:
              labels:
                app: postgresql
                component: database
              annotations:
                ad.datadoghq.com/postgresql.instances: |
                  [{{
                    "host": "%%host%%",
                    "port": 5432,
                    "username": "{datadog_user}",
                    "password": "{datadog_password}",
                    "dbname": "{database}",
                    "dbm": true
                  }}]
            spec:
              containers:
              - name: postgresql
                image: {image}
                ports:
                - containerPort: 5432
                  name: postgres
                env:
                - name: POSTGRES_USER
                  valueFrom:
                    secretKeyRef:
                      name: postgresql-secret
                      key: POSTGRES_USER
                - name: POSTGRES_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgresql-secret
                      key: POSTGRES_PASSWORD
                - name: POSTGRES_DB
                  valueFrom:
                    secretKeyRef:
                      name: postgresql-secret
                      key: POSTGRES_DB
                volumeMounts:
                - name: postgres-data
                  mountPath: /var/lib/postgresql/data
                - name: postgres-init
                  mountPath: /docker-entrypoint-initdb.d
                - name: postgres-config
                  mountPath: /var/lib/postgresql/config
                readinessProbe:
                  exec:
                    command: ["/bin/sh", "-c", "pg_isready -U {postgres_user}"]
                  initialDelaySeconds: 20
                  periodSeconds: 10
              volumes:
              - name: postgres-init
                configMap:
                  name: postgresql-init
                  items:
                  - key: init.sql
                    path: init.sql
              - name: postgres-config
                configMap:
                  name: postgresql-init
                  items:
                  - key: postgresql.conf
                    path: postgresql.conf
          volumeClaimTemplates:
          - metadata:
              name: postgres-data
            spec:
              accessModes: ["ReadWriteOnce"]
              storageClassName: {storage_class}
              resources:
                requests:
                  storage: {storage_size}Gi
        ---
        apiVersion: v1
        kind: Service
        metadata:
          name: postgresql
          namespace: {namespace}
        spec:
          selector:
            app: postgresql
          ports:
          - name: postgres
            protocol: TCP
            port: 5432
            targetPort: 5432
        """
    )


def ensure_namespace(namespace: str, *, dry_run: bool) -> None:
    manifest = dedent(
        f"""
        apiVersion: v1
        kind: Namespace
        metadata:
          name: {namespace}
        """

# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

    )
    run(["kubectl", "apply", "-f", "-"], input_text=manifest, dry_run=dry_run)


def wait_for_statefulset(namespace: str, *, timeout: int, dry_run: bool) -> None:
    run(
        [
            "kubectl",
            "--namespace",
            namespace,
            "rollout",
            "status",
            "statefulset/postgresql",
            f"--timeout={timeout}s",
        ],
        dry_run=dry_run,
    )
    run(
        [
            "kubectl",
            "--namespace",
            namespace,
            "wait",
            "--for=condition=Ready",
            "pod",
            "-l",
            "app=postgresql",
            f"--timeout={timeout}s",
        ],
        dry_run=dry_run,
    )


def verify_pgvector(namespace: str, *, database: str, postgres_user: str, dry_run: bool) -> None:
    cmd = [
        "kubectl",
        "--namespace",
        namespace,
        "exec",
        "statefulset/postgresql",
        "--",
        "psql",
        "-U",
        postgres_user,
        "-d",
        database,
        "-c",
        "SELECT extname FROM pg_extension WHERE extname='vector';",
    ]
    run(cmd, dry_run=dry_run)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy PostgreSQL + pgvector to AKS")
    parser.add_argument("--namespace", default=DEFAULT_NAMESPACE)
    parser.add_argument("--storage-class", default=DEFAULT_STORAGE_CLASS)
    parser.add_argument("--storage-size", type=int, default=DEFAULT_STORAGE_SIZE)
    parser.add_argument("--image", default=DEFAULT_IMAGE)
    parser.add_argument("--postgres-user", default="postgres")
    parser.add_argument("--postgres-password")
    parser.add_argument("--database", default="vibecode")
    parser.add_argument("--datadog-user", default="datadog")
    parser.add_argument("--datadog-password")
    parser.add_argument("--wait", action="store_true")
    parser.add_argument("--wait-timeout", type=int, default=DEFAULT_WAIT_TIMEOUT)
    parser.add_argument("--verify", action="store_true", help="Check pgvector extension after rollout")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        require_tool("kubectl")
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    postgres_password = args.postgres_password or generate_password(24)
    datadog_password = args.datadog_password or generate_password(20)

    manifest = render_manifests(
        namespace=args.namespace,
        storage_class=args.storage_class,
        storage_size=args.storage_size,
        image=args.image,
        postgres_user=args.postgres_user,
        postgres_password=postgres_password,
        database=args.database,
        datadog_user=args.datadog_user,
        datadog_password=datadog_password,
    )

    try:
        ensure_namespace(args.namespace, dry_run=args.dry_run)
        run(["kubectl", "apply", "-f", "-"], input_text=manifest, dry_run=args.dry_run)
        if args.wait:
            wait_for_statefulset(args.namespace, timeout=args.wait_timeout, dry_run=args.dry_run)
            if args.verify:
                verify_pgvector(
                    args.namespace,
                    database=args.database,
                    postgres_user=args.postgres_user,
                    dry_run=args.dry_run,
                )
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    if not args.dry_run:
        print("PostgreSQL deployment applied successfully")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())