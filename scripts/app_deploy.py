#!/usr/bin/env python3
"""VibeCode WebGUI application deployment helper for AKS clusters.

This tool replaces the legacy `aks-app-deploy.sh` script and wraps the
Docker build/push and Helm deployment in a test-friendly Python module.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

DEFAULT_IMAGE_TAG = "latest"
DEFAULT_CHART_PATH = "charts/vibecode"


class CommandError(RuntimeError):
    """Raised when a shell command fails."""


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, input_text: str | None = None, dry_run: bool = False) -> subprocess.CompletedProcess[str]:
    if dry_run:
        print(f"[DRY-RUN] Would execute: {' '.join(cmd)}")
        if input_text:
            print(f"[DRY-RUN] With input: {input_text[:100]}...")
        return subprocess.CompletedProcess(cmd, 0, "", "")
    
    try:
        return subprocess.run(  # noqa: S603
            cmd,
            input=input_text,
            text=True,
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:  # pragma: no cover - passthrough
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def generate_secret_value() -> str:
    """Generate a secure random secret."""
    return subprocess.check_output(
        ["openssl", "rand", "-base64", "32"],
        text=True
    ).strip()


def ensure_namespace(namespace: str, dry_run: bool = False) -> None:
    """Create namespace if it doesn't exist."""
    manifest = dedent(
        f"""
        apiVersion: v1
        kind: Namespace
        metadata:
          name: {namespace}
        """
    )
    run(["kubectl", "apply", "-f", "-"], input_text=manifest, dry_run=dry_run)


def create_application_secrets(
    namespace: str,
    database_url: str | None = None,
    nextauth_secret: str | None = None,
    node_env: str = "production",
    dd_api_key: str = "",
    dd_app_key: str = "",
    openrouter_api_key: str = "",
    postgres_password: str = "changeme",
    dry_run: bool = False
) -> None:
    """Create application secrets."""
    database_url = database_url or f"postgresql://postgres:{postgres_password}@postgres-service:5432/vibecode"
    nextauth_secret = nextauth_secret or generate_secret_value()
    
    cmd = [
        "kubectl", "--namespace", namespace,
        "create", "secret", "generic", "vibecode-secrets",
        "--dry-run=client", "-o", "yaml",
        "--from-literal", f"DATABASE_URL={database_url}",
        "--from-literal", f"NEXTAUTH_SECRET={nextauth_secret}",
        "--from-literal", f"NODE_ENV={node_env}",
        "--from-literal", f"DD_API_KEY={dd_api_key}",
        "--from-literal", f"DD_APP_KEY={dd_app_key}",
        "--from-literal", f"OPENROUTER_API_KEY={openrouter_api_key}",
    ]
    
    render = run(cmd, dry_run=dry_run)
    if not dry_run:
        run(["kubectl", "apply", "-f", "-"], input_text=render.stdout)


def ensure_helm_chart(chart_path: Path, dry_run: bool = False) -> None:
    """Create Helm chart structure if it doesn't exist."""
    if chart_path.exists() and not dry_run:
        return
    
    if dry_run:
        print(f"[DRY-RUN] Would create Helm chart at: {chart_path}")
        return
    
    chart_path.mkdir(parents=True, exist_ok=True)
    templates_dir = chart_path / "templates"
    templates_dir.mkdir(exist_ok=True)
    
    # Create Chart.yaml
    chart_yaml = dedent("""
        apiVersion: v2
        name: vibecode
        description: VibeCode WebGUI - AI-Powered Development Platform
        type: application
        version: 0.1.0
        appVersion: "latest"
        keywords:
          - ai
          - development
          - platform
          - nextjs
        maintainers:
          - name: VibeCode Team
    """)
    (chart_path / "Chart.yaml").write_text(chart_yaml)
    
    # Create values.yaml
    values_yaml = dedent("""
        replicaCount: 1
        
        image:
          repository: vibecodecr.azurecr.io/vibecode-webgui
          tag: latest
          pullPolicy: Always
        
        service:
          type: ClusterIP
          port: 80
          targetPort: 3000
        
        ingress:
          enabled: true
          className: nginx
          hostname: vibecode.example.com
          tls: true
        
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        
        nodeSelector: {}
        tolerations: []
        affinity: {}
        
        env:
          NODE_ENV: production
          PORT: "3000"
    """)
    (chart_path / "values.yaml").write_text(values_yaml)
    
    # Create deployment template
    deployment_yaml = dedent("""
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: {{ include "vibecode.fullname" . }}
          labels:
            app.kubernetes.io/name: vibecode
            app.kubernetes.io/instance: {{ .Release.Name }}
        spec:
          replicas: {{ .Values.replicaCount }}
          selector:
            matchLabels:
              app.kubernetes.io/name: vibecode
              app.kubernetes.io/instance: {{ .Release.Name }}
          template:
            metadata:
              labels:
                app.kubernetes.io/name: vibecode
                app.kubernetes.io/instance: {{ .Release.Name }}
            spec:
              containers:
                - name: vibecode-webgui
                  image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
                  imagePullPolicy: {{ .Values.image.pullPolicy }}
                  ports:
                    - name: http
                      containerPort: {{ .Values.service.targetPort }}
                      protocol: TCP
                  env:
                    - name: NODE_ENV
                      valueFrom:
                        secretKeyRef:
                          name: vibecode-secrets
                          key: NODE_ENV
                    - name: DATABASE_URL
                      valueFrom:
                        secretKeyRef:
                          name: vibecode-secrets
                          key: DATABASE_URL
                    - name: NEXTAUTH_SECRET
                      valueFrom:
                        secretKeyRef:
                          name: vibecode-secrets
                          key: NEXTAUTH_SECRET
                    - name: DD_API_KEY
                      valueFrom:
                        secretKeyRef:
                          name: vibecode-secrets
                          key: DD_API_KEY
                    - name: DD_APP_KEY
                      valueFrom:
                        secretKeyRef:
                          name: vibecode-secrets
                          key: DD_APP_KEY
                    - name: OPENROUTER_API_KEY
                      valueFrom:
                        secretKeyRef:
                          name: vibecode-secrets
                          key: OPENROUTER_API_KEY
                    - name: PORT
                      value: "{{ .Values.service.targetPort }}"
                  livenessProbe:
                    httpGet:
                      path: /api/health
                      port: http
                    initialDelaySeconds: 30
                    periodSeconds: 10
                  readinessProbe:
                    httpGet:
                      path: /api/health
                      port: http
                    initialDelaySeconds: 10
                    periodSeconds: 5
                  resources:
                    {{- toYaml .Values.resources | nindent 12 }}
    """)
    (templates_dir / "deployment.yaml").write_text(deployment_yaml)
    
    # Create service template
    service_yaml = dedent("""
        apiVersion: v1
        kind: Service
        metadata:
          name: {{ include "vibecode.fullname" . }}
          labels:
            app.kubernetes.io/name: vibecode
            app.kubernetes.io/instance: {{ .Release.Name }}
        spec:
          type: {{ .Values.service.type }}
          ports:
            - port: {{ .Values.service.port }}
              targetPort: {{ .Values.service.targetPort }}
              protocol: TCP
              name: http
          selector:
            app.kubernetes.io/name: vibecode
            app.kubernetes.io/instance: {{ .Release.Name }}
    """)
    (templates_dir / "service.yaml").write_text(service_yaml)
    
    # Create helpers template
    helpers_tpl = dedent("""
        {{- define "vibecode.fullname" -}}
        {{- if .Values.fullnameOverride }}
        {{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
        {{- else }}
        {{- $name := default .Chart.Name .Values.nameOverride }}
        {{- if contains $name .Release.Name }}
        {{- .Release.Name | trunc 63 | trimSuffix "-" }}
        {{- else }}
        {{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
        {{- end }}
        {{- end }}
        {{- end }}
    """)
    (templates_dir / "_helpers.tpl").write_text(helpers_tpl)
    
    print(f"✅ Created Helm chart structure at: {chart_path}")


def build_and_push_image(
    acr_name: str,
    image_tag: str,
    dockerfile: str = "Dockerfile.production",
    dry_run: bool = False
) -> str:
    """Build and push Docker image to ACR."""
    if not Path(dockerfile).exists():
        if dry_run:
            print(f"[DRY-RUN] Would skip image build ({dockerfile} not found)")
            return f"{acr_name}.azurecr.io/vibecode-webgui:{image_tag}"
        else:
            print(f"⚠️ Skipping image build ({dockerfile} not found)")
            return f"{acr_name}.azurecr.io/vibecode-webgui:{image_tag}"
    
    image_name = f"{acr_name}.azurecr.io/vibecode-webgui:{image_tag}"
    
    # Build image
    print(f"Building Docker image: {image_name}")
    run(["docker", "build", "-f", dockerfile, "-t", image_name, "."], dry_run=dry_run)
    
    # Push to ACR
    print(f"Pushing image to ACR: {image_name}")
    run(["docker", "push", image_name], dry_run=dry_run)
    
    print(f"✅ Image built and pushed: {image_name}")
    return image_name


def deploy_with_helm(
    chart_path: Path,
    namespace: str,
    image_repository: str,
    image_tag: str,
    hostname: str | None = None,
    wait: bool = True,
    timeout: int = 600,
    dry_run: bool = False
) -> None:
    """Deploy application using Helm."""
    cmd = [
        "helm", "upgrade", "--install", "vibecode-app", str(chart_path),
        "--namespace", namespace,
        "--set", f"image.repository={image_repository}",
        "--set", f"image.tag={image_tag}",
    ]
    
    if hostname:
        cmd.extend(["--set", f"ingress.hostname={hostname}"])
    
    if wait and not dry_run:
        cmd.extend(["--wait", f"--timeout={timeout}s"])
    
    run(cmd, dry_run=dry_run)


def wait_for_deployment(namespace: str, timeout: int = 600, dry_run: bool = False) -> None:
    """Wait for deployment to be ready."""
    run([
        "kubectl", "--namespace", namespace,
        "rollout", "status", "deployment/vibecode-app",
        f"--timeout={timeout}s"
    ], dry_run=dry_run)


def get_deployment_status(namespace: str, dry_run: bool = False) -> None:
    """Get deployment status information."""
    print("📊 Deployment Status:")
    
    # Get pods
    run([
        "kubectl", "--namespace", namespace,
        "get", "pods", "-l", "app.kubernetes.io/name=vibecode", "-o", "wide"
    ], dry_run=dry_run)
    
    # Get services
    run([
        "kubectl", "--namespace", namespace,
        "get", "services", "-l", "app.kubernetes.io/name=vibecode"
    ], dry_run=dry_run)
    
    # Get ingress if exists
    try:
        run([
            "kubectl", "--namespace", namespace,
            "get", "ingress"
        ], dry_run=dry_run)
    except CommandError:
        pass  # Ingress might not exist


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy VibeCode WebGUI application to AKS")
    parser.add_argument("--namespace", default="vibecode-platform", help="Kubernetes namespace")
    parser.add_argument("--acr-name", required=True, help="Azure Container Registry name")
    parser.add_argument("--image-tag", default=DEFAULT_IMAGE_TAG, help="Docker image tag")
    parser.add_argument("--chart-path", default=DEFAULT_CHART_PATH, help="Helm chart path")
    parser.add_argument("--dockerfile", default="Dockerfile.production", help="Dockerfile path")
    parser.add_argument("--hostname", help="Ingress hostname")
    parser.add_argument("--location", default="eastus2", help="Azure location for hostname")
    
    # Environment variables
    parser.add_argument("--database-url", help="Database connection URL")
    parser.add_argument("--nextauth-secret", help="NextAuth secret")
    parser.add_argument("--node-env", default="production", help="Node environment")
    parser.add_argument("--dd-api-key", default="", help="Datadog API key")
    parser.add_argument("--dd-app-key", default="", help="Datadog APP key")
    parser.add_argument("--openrouter-api-key", default="", help="OpenRouter API key")
    parser.add_argument("--postgres-password", default="changeme", help="PostgreSQL password")
    
    # Control flags
    parser.add_argument("--skip-build", action="store_true", help="Skip Docker image build")
    parser.add_argument("--skip-deploy", action="store_true", help="Skip Helm deployment")
    parser.add_argument("--wait", action="store_true", help="Wait for deployment to be ready")
    parser.add_argument("--wait-timeout", type=int, default=600, help="Wait timeout in seconds")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without executing")
    
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    # Set hostname if not provided
    hostname = args.hostname or f"vibecode.{args.location}.cloudapp.azure.com"
    
    try:
        if not args.skip_build:
            require_tool("docker")
        if not args.skip_deploy:
            require_tool("helm")
        require_tool("kubectl")
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    chart_path = Path(args.chart_path)
    
    print(f"Deploying VibeCode WebGUI to AKS")
    print(f"Namespace: {args.namespace}")
    print(f"ACR: {args.acr_name}.azurecr.io")
    print(f"Image tag: {args.image_tag}")
    print(f"Hostname: {hostname}")
    if args.dry_run:
        print("🔍 DRY-RUN MODE: No actual changes will be made")

    try:
        # Ensure namespace exists
        ensure_namespace(args.namespace, args.dry_run)
        
        # Create application secrets
        create_application_secrets(
            args.namespace,
            args.database_url,
            args.nextauth_secret,
            args.node_env,
            args.dd_api_key,
            args.dd_app_key,
            args.openrouter_api_key,
            args.postgres_password,
            args.dry_run
        )
        
        # Ensure Helm chart exists
        ensure_helm_chart(chart_path, args.dry_run)
        
        # Build and push image
        image_name = f"{args.acr_name}.azurecr.io/vibecode-webgui"
        if not args.skip_build:
            image_name = build_and_push_image(
                args.acr_name,
                args.image_tag,
                args.dockerfile,
                args.dry_run
            ).split(':')[0]  # Remove tag
        
        # Deploy with Helm
        if not args.skip_deploy:
            deploy_with_helm(
                chart_path,
                args.namespace,
                image_name,
                args.image_tag,
                hostname,
                args.wait,
                args.wait_timeout,
                args.dry_run
            )
        
        # Wait for deployment if requested
        if args.wait and not args.skip_deploy:
            wait_for_deployment(args.namespace, args.wait_timeout, args.dry_run)
        
        # Show deployment status
        if not args.dry_run:
            get_deployment_status(args.namespace)
        
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    print("✅ VibeCode WebGUI application deployment complete!")
    if not args.dry_run:
        print(f"🔍 Access Application: https://{hostname}")
    
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
