#!/usr/bin/env python3


"""VibeCode WebGUI deployment helper for AKS."""

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
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable

DEFAULT_NAMESPACE = "vibecode-platform"
DEFAULT_IMAGE_NAME = "vibecode-webgui"
DEFAULT_IMAGE_TAG = "latest"
DEFAULT_CHART = "charts/vibecode"
DEFAULT_RELEASE = "vibecode-webgui"
DEFAULT_WAIT_TIMEOUT = 600


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""

# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass



def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, dry_run: bool = False, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
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


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
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


def build_and_push_image(
    *,
    acr_name: str,
    image_name: str,
    image_tag: str,
    context: Path,
    dockerfile: Path,
    dry_run: bool,
) -> str:
    full_image = f"{acr_name}.azurecr.io/{image_name}:{image_tag}"

    run(["az", "acr", "login", "--name", acr_name], dry_run=dry_run)
    run(
        [
            "docker",
            "build",
            "-t",
            full_image,
            "-f",
            str(dockerfile),
            str(context),
        ],
        dry_run=dry_run,
    )
    run(["docker", "push", full_image], dry_run=dry_run)
    return full_image


def helm_upgrade(
    *,
    release: str,
    chart: Path,
    namespace: str,
    image: str,
    values: Iterable[Path],
    set_values: list[str],
    set_string_values: list[str],
    wait: bool,
    timeout: int,
    dry_run: bool,
) -> None:
    cmd = [
        "helm",
        "upgrade",
        "--install",
        release,
        str(chart),
        "--namespace",
        namespace,
        "--create-namespace",
        "--set",
        f"image.repository={image.rsplit(':', 1)[0]}",
        "--set",
        f"image.tag={image.rsplit(':', 1)[1]}",
    ]

    for value_path in values:
        cmd.extend(["--values", str(value_path)])

    for item in set_values:
        cmd.extend(["--set", item])

    for item in set_string_values:
        cmd.extend(["--set-string", item])

    if wait:
        cmd.extend(["--wait", f"--timeout={timeout}s"])

    run(cmd, dry_run=dry_run)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy the VibeCode WebGUI to AKS")
    parser.add_argument("--namespace", default=DEFAULT_NAMESPACE)
    parser.add_argument("--acr-name", required=True)
    parser.add_argument("--image-name", default=DEFAULT_IMAGE_NAME)
    parser.add_argument("--image-tag", default=DEFAULT_IMAGE_TAG)
    parser.add_argument("--dockerfile", default="Dockerfile")
    parser.add_argument("--context", default=".")
    parser.add_argument("--chart", default=DEFAULT_CHART)
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--values", action="append", type=Path, default=[])
    parser.add_argument("--set", dest="set_values", action="append", default=list())
    parser.add_argument("--set-string", dest="set_string_values", action="append", default=list())
    parser.add_argument("--fullname-override")
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--wait", action="store_true")
    parser.add_argument("--wait-timeout", type=int, default=DEFAULT_WAIT_TIMEOUT)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        require_tool("az")
        require_tool("helm")
        require_tool("kubectl")
        if not args.skip_build:
            require_tool("docker")
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    env_overrides: dict[str, str] = {}
    if args.env_file:
        env_overrides = load_env_file(args.env_file)
        if env_overrides:
            set_env = [f"envSecrets.{key}={value}" for key, value in env_overrides.items()]
            args.set_values.extend(set_env)

    if args.fullname_override:
        args.set_values.append(f"fullnameOverride={args.fullname_override}")

    try:
        if args.skip_build:
            image = f"{args.acr_name}.azurecr.io/{args.image_name}:{args.image_tag}"
        else:
            image = build_and_push_image(
                acr_name=args.acr_name,
                image_name=args.image_name,
                image_tag=args.image_tag,
                context=Path(args.context),
                dockerfile=Path(args.dockerfile),
                dry_run=args.dry_run,
            )

        helm_values = [Path(p) for p in args.values]
        helm_upgrade(
            release=args.release,
            chart=Path(args.chart),
            namespace=args.namespace,
            image=image,
            values=helm_values,
            set_values=args.set_values,
            set_string_values=args.set_string_values,
            wait=args.wait,
            timeout=args.wait_timeout,
            dry_run=args.dry_run,
        )
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    if not args.dry_run:
        print("Application deployment triggered successfully")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())