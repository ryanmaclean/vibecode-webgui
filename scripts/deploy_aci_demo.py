#!/usr/bin/env python3
"""Provision a minimal Azure demo using Azure Container Instances and PostgreSQL Basic.

This script is intentionally lightweight and focuses on orchestration via the
Azure CLI so it can run from developer laptops or CI without extra SDKs.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass

import argparse
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable

DEFAULT_RESOURCE_GROUP = "rg-vibecode-demo"
DEFAULT_LOCATION = "eastus2"
DEFAULT_ACI_NAME = "aci-vibecode-demo"
DEFAULT_POSTGRES_NAME = "vibecode-demo"
DEFAULT_ENV_FILE = Path(".env.demo")
DEFAULT_CPU = 1.0
DEFAULT_MEMORY = 2.0  # GB
DEFAULT_PORT = 3000


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, dry_run: bool = False, env: Dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    if dry_run:
        printable = " ".join(shlex.quote(part) for part in cmd)
        print(f"[DRY-RUN] {printable}")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    try:
        return subprocess.run(  # noqa: S603
            cmd,
            text=True,
            capture_output=True,
            check=True,
            env=env,
        )
    except subprocess.CalledProcessError as exc:  # pragma: no cover - delegated error
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def load_env(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not path.exists():
        return env

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def build_env_arguments(env: Dict[str, str]) -> list[str]:
    env_args: list[str] = []
    if not env:
        return env_args

    # Prefer secrets env vars for anything that looks sensitive
    secrets = {k: v for k, v in env.items() if k.endswith("PASSWORD") or k.endswith("SECRET") or k.endswith("API_KEY")}
    normals = {k: v for k, v in env.items() if k not in secrets}

    for key, value in normals.items():
        env_args.extend(["--environment-variables", f"{key}={value}"])

    for key, value in secrets.items():
        env_args.extend(["--secrets-env-vars", f"{key}={value}"])

    return env_args


def create_resource_group(*, name: str, location: str, dry_run: bool) -> None:
    run(["az", "group", "create", "--name", name, "--location", location], dry_run=dry_run)


def create_postgres(
    *,
    name: str,
    resource_group: str,
    location: str,
    admin_user: str,
    admin_password: str,
    database: str,
    dry_run: bool,
) -> None:
    run(
        [
            "az",
            "postgres",
            "flexible-server",
            "create",
            "--resource-group",
            resource_group,
            "--name",
            name,
            "--location",
            location,
            "--tier",
            "Burstable",
            "--sku-name",
            "Standard_B1ms",
            "--storage-size",
            "32",
            "--admin-user",
            admin_user,
            "--admin-password",
            admin_password,
            "--public-access",
            "0.0.0.0",
            "--database-name",
            database,
        ],
        dry_run=dry_run,
    )


def deploy_aci(
    *,
    name: str,
    resource_group: str,
    image: str,
    location: str,
    cpu: float,
    memory: float,
    port: int,
    env_args: Iterable[str],
    dry_run: bool,
) -> None:
    cmd = [
        "az",
        "container",
        "create",
        "--name",
        name,
        "--resource-group",
        resource_group,
        "--image",
        image,
        "--location",
        location,
        "--restart-policy",
        "OnFailure",
        "--cpu",
        str(cpu),
        "--memory",
        str(memory),
        "--ports",
        str(port),
    ]
    cmd.extend(env_args)
    run(cmd, dry_run=dry_run)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Provision the minimal Azure demo")
    parser.add_argument("--resource-group", default=DEFAULT_RESOURCE_GROUP)
    parser.add_argument("--location", default=DEFAULT_LOCATION)
    parser.add_argument("--aci-name", default=DEFAULT_ACI_NAME)
    parser.add_argument("--postgres-name", default=DEFAULT_POSTGRES_NAME)
    parser.add_argument("--image", required=True, help="Container image (e.g. myregistry.azurecr.io/app:demo)")
    parser.add_argument("--postgres-user", default="aci_user")
    parser.add_argument("--postgres-password", help="Admin password (falls back to POSTGRES_PASSWORD in env file)")
    parser.add_argument("--database", default="vibecode_app")
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--cpu", type=float, default=DEFAULT_CPU)
    parser.add_argument("--memory", type=float, default=DEFAULT_MEMORY)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        require_tool("az")
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    env_values = load_env(args.env_file)

    postgres_password = (
        args.postgres_password
        or env_values.get("POSTGRES_PASSWORD")
        or os.getenv("POSTGRES_PASSWORD")
    )

    if not postgres_password:
        print("PostgreSQL admin password not provided (use --postgres-password or POSTGRES_PASSWORD)", file=sys.stderr)
        return 1

    env_args = build_env_arguments(env_values)

    try:
        create_resource_group(name=args.resource_group, location=args.location, dry_run=args.dry_run)
        create_postgres(
            name=args.postgres_name,
            resource_group=args.resource_group,
            location=args.location,
            admin_user=args.postgres_user,
            admin_password=postgres_password,
            database=args.database,
            dry_run=args.dry_run,
        )
        deploy_aci(
            name=args.aci_name,
            resource_group=args.resource_group,
            image=args.image,
            location=args.location,
            cpu=args.cpu,
            memory=args.memory,
            port=args.port,
            env_args=env_args,
            dry_run=args.dry_run,
        )
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    if not args.dry_run:
        print("Minimal Azure demo deployment initiated.")
        print(
            "Remember to run the provided teardown commands once testing is complete"
        )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
