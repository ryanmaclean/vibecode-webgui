#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Datadog Configuration Script

Configures Datadog tools and creates configuration templates.

Usage:
    python configure_datadog.py
"""

import os
import sys
from pathlib import Path


def ensure_directory(path: Path) -> None:
    """Create directory if it doesn't exist."""
    path.mkdir(parents=True, exist_ok=True)


def write_agent_config(templates_dir: Path) -> None:
    """Write Datadog Agent configuration template."""
    config = """# Datadog Agent Configuration
api_key: ${DD_API_KEY:-"your_api_key_here"}
site: ${DD_SITE:-"datadoghq.com"}

# Enable APM
apm_config:
  enabled: true
  env: ${DD_ENV:-"development"}
  apm_non_local_traffic: true

# Logs configuration
logs_enabled: true

# Process monitoring
process_config:
  enabled: true
  process_collection:
    enabled: true
  container_collection:
    enabled: true

tags:
  - env:${DD_ENV:-"development"}
  - service:${DD_SERVICE:-"vibecode"}
  - version:${DD_VERSION:-"1.0.0"}
"""
    (templates_dir / "agent-config.yaml").write_text(config)


def write_ci_config(templates_dir: Path) -> None:
    """Write Datadog CI configuration template."""
    config = """{
  "apiKey": "${DD_API_KEY}",
  "appKey": "${DD_APP_KEY}",
  "site": "${DD_SITE:-"datadoghq.com"}",
  "env": "${DD_ENV:-"development"}",
  "service": "${DD_SERVICE:-"vibecode"}",
  "version": "${DD_VERSION:-"1.0.0"}"
}
"""
    (templates_dir / "datadog-ci.json").write_text(config)


def write_vector_config(templates_dir: Path) -> None:
    """Write Vector configuration template."""
    config = """[api]
enabled = true

[sources.logs]
type = "file"
include = [
  "/var/log/**/*.log",
  "/home/coder/workspace/logs/*.log"
]

[sinks.datadog_logs]
inputs = ["logs"]
type = "datadog_logs"
endpoint = "https://http-intake.logs.datadoghq.com"
api_key = "${DD_API_KEY}"
compression = "gzip"
"""
    (templates_dir / "vector.toml").write_text(config)


def write_verification_script(workspace_dir: Path) -> None:
    """Write Datadog tools verification script."""
    script = """#!/bin/bash
set -e

echo "=== Verifying Datadog Tools ==="

# Check Datadog Agent
if command -v datadog-agent &> /dev/null; then
  echo "✅ Datadog Agent is installed"
  datadog-agent version
else
  echo "❌ Datadog Agent is not installed"
fi

# Check Datadog CLI
if command -v dd-scm &> /dev/null; then
  echo -e "\\n✅ Datadog CLI is installed"
  dd-scm --version
else
  echo -e "\\n❌ Datadog CLI is not installed"
fi

# Check Vector
if command -v vector &> /dev/null; then
  echo -e "\\n✅ Vector is installed"
  vector --version
else
  echo -e "\\n❌ Vector is not installed"
fi

# Check KubeHound
if command -v kubehound &> /dev/null; then
  echo -e "\\n✅ KubeHound is installed"
  kubehound version
else
  echo -e "\\n❌ KubeHound is not installed"
fi

# Check Stratus Red Team
if command -v stratus &> /dev/null; then
  echo -e "\\n✅ Stratus Red Team is installed"
  stratus version
else
  echo -e "\\n❌ Stratus Red Team is not installed"
fi

echo -e "\\n=== Verification Complete ==="
"""
    script_path = workspace_dir / "verify-datadog-tools.sh"
    script_path.write_text(script)
    script_path.chmod(0o755)


def write_readme(datadog_dir: Path) -> None:
    """Write README with instructions."""
    readme = """# Datadog Tools Configuration

This directory contains configuration templates for various Datadog tools.

## Available Tools

1. **Datadog Agent**
   - Configuration: `.datadog/templates/agent-config.yaml`
   - Documentation: [Datadog Agent Docs](https://docs.datadoghq.com/agent/)

2. **Datadog CI**
   - Configuration: `.datadog/templates/datadog-ci.json`
   - Documentation: [Datadog CI Docs](https://docs.datadoghq.com/continuous_integration/)

3. **Vector** (Log Collection)
   - Configuration: `.datadog/templates/vector.toml`
   - Documentation: [Vector Docs](https://vector.dev/docs/)

4. **KubeHound** (Kubernetes Security)
   - Documentation: [KubeHound Docs](https://github.com/DataDog/kubehound)

5. **Stratus Red Team** (Security Testing)
   - Documentation: [Stratus Red Team Docs](https://stratus-red-team.cloud/)

## Verification

Run the verification script to check all tools:

```bash
./verify-datadog-tools.sh
```

## Environment Variables

Set these in your environment or `.env` file:

```bash
# Required for Datadog
DD_API_KEY=your_api_key_here
DD_APP_KEY=your_app_key_here
DD_SITE=datadoghq.com

# Optional
DD_ENV=development
DD_SERVICE=vibecode
DD_VERSION=1.0.0
```
"""
    (datadog_dir / "README.md").write_text(readme)


def configure_datadog(home_dir: str = "/home/coder") -> int:
    """Configure Datadog tools."""
    workspace_dir = Path(home_dir) / "workspace"
    datadog_dir = workspace_dir / ".datadog"
    templates_dir = datadog_dir / "templates"

    # Create directories
    ensure_directory(templates_dir)

    # Write configuration files
    write_agent_config(templates_dir)
    write_ci_config(templates_dir)
    write_vector_config(templates_dir)
    write_verification_script(workspace_dir)
    write_readme(datadog_dir)

    print("✅ Datadog tools configuration complete")
    return 0


def main() -> int:
    """Main entry point."""
    return configure_datadog()


if __name__ == "__main__":
    sys.exit(main())