---
name: datadog-code-security
description: Run Datadog Code Security scans on a codebase — SAST (rule-based static analysis), SAIST (AI-native SAST using LLMs for vulnerability detection), SCA (software composition analysis), secrets detection, and IaC scanning. Integrates via the Code Security MCP Server for real-time scanning in Claude Code, Cursor, and VS Code. Use when asked to scan code for vulnerabilities, run a security audit, find bugs via static analysis, or check dependencies for known CVEs.
---

# Datadog Code Security Skill

Scan codebases for security vulnerabilities using Datadog's Code Security suite. As of 2026, the primary developer integration is the **Code Security MCP Server** which runs all scanners locally and provides real-time feedback in AI coding assistants.

| Layer | What it does | How it works |
|-------|-------------|--------------|
| **SAST** | Rule-based static analysis | Deterministic rules scan first-party code for CWEs |
| **SAIST** | AI-native SAST | LLMs detect context-dependent vulns that rules miss |
| **SCA** | Software Composition Analysis | Scans dependencies for known CVEs via advisory DBs |
| **Secrets** | Hardcoded secret detection | Finds API keys, tokens, passwords in source code |
| **IaC** | Infrastructure-as-Code scanning | Detects misconfigurations in Terraform, CloudFormation, etc. |

## Code Security MCP Server (Recommended)

The MCP server is the fastest way to get all scanners running in your IDE. It downloads scanners on-demand, runs locally over STDIO, and provides immediate feedback with line numbers, rule references, and proposed fixes.

### Install

```bash
# Homebrew (macOS/Linux)
brew install datadog-labs/pack/datadog-code-security-mcp

# Or direct download
curl -L "https://github.com/datadog-labs/datadog-code-security-mcp/releases/latest/download/datadog-code-security-mcp-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m).tar.gz" | tar xz
sudo install -m 755 datadog-code-security-mcp /usr/local/bin/
```

Verify: `datadog-code-security-mcp version`

### Configure for Claude Code

```bash
claude mcp add datadog-code-security \
  -e DD_API_KEY=<your-api-key> \
  -e DD_APP_KEY=<your-app-key> \
  -e DD_SITE=datadoghq.com \
  -- datadog-code-security-mcp start
```

Verify: `claude mcp list | grep datadog-code-security`

### Configure for Cursor

Add to `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "datadog-code-security": {
      "command": "datadog-code-security-mcp",
      "args": ["start"],
      "env": {
        "DD_API_KEY": "<your-api-key>",
        "DD_APP_KEY": "<your-app-key>",
        "DD_SITE": "datadoghq.com"
      }
    }
  }
}
```

### Configure for VS Code

Add to `.vscode/settings.json`:
```json
{
  "mcp": {
    "servers": {
      "datadog-code-security": {
        "command": "datadog-code-security-mcp",
        "args": ["start"],
        "env": {
          "DD_API_KEY": "<your-api-key>",
          "DD_APP_KEY": "<your-app-key>",
          "DD_SITE": "datadoghq.com"
        }
      }
    }
  }
}
```

### MCP Tools Available

| Tool | Function | Auth Required |
|------|----------|--------------|
| `datadog_sast_scan` | Static analysis for code vulnerabilities | Yes |
| `datadog_secrets_scan` | Hardcoded secrets detection | Yes |
| `datadog_sca_scan` | Dependency vulnerability scanning (CVEs) | Yes |
| `datadog_iac_scan` | Infrastructure-as-Code security | Yes |
| `datadog_generate_sbom` | Software Bill of Materials generation | No |

### CLI Usage (without MCP)

```bash
# Scan everything
datadog-code-security-mcp scan all ./src

# Individual scan types
datadog-code-security-mcp scan sast ./src
datadog-code-security-mcp scan secrets ./config
datadog-code-security-mcp scan sca ./
datadog-code-security-mcp scan iac ./terraform

# Generate SBOM
datadog-code-security-mcp generate-sbom .

# JSON output
datadog-code-security-mcp scan all ./src --json
```

### Required Security Binaries

The MCP server wraps these binaries (auto-downloaded or install manually):

| Binary | Purpose | Install |
|--------|---------|---------|
| `datadog-static-analyzer` | SAST + Secrets | `brew install datadog-static-analyzer` |
| `datadog-sbom-generator` | SBOM + SCA | GitHub releases |
| `datadog-security-cli` | SCA | `brew install --cask datadog/tap/datadog-security-cli` |
| `datadog-iac-scanner` | IaC | GitHub releases |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DD_API_KEY` | Yes* | Datadog API key |
| `DD_APP_KEY` | Yes* | Datadog application key |
| `DD_SITE` | No | Datadog site (default: datadoghq.com) |

*SBOM generation works without auth. All other scans require both keys.

## SAIST — AI-Native SAST

Datadog SAIST uses LLMs to detect vulnerabilities that rule-based SAST misses. Open-source at `github.com/DataDog/datadog-saist`. It reasons about code semantics, execution context, and call stacks rather than relying on rigid pattern matching.

### How SAIST Works

1. **Identification** — Heuristics filter candidate files likely to contain risks
2. **Context Retrieval** — Gathers invoked functions and related files for full context
3. **Analysis** — LLM assesses code for vulnerabilities with execution context
4. **Post-Processing** — Heuristic + LLM-based false positive filtering

Uses two models: a **detection model** for finding vulns and a **validation model** for filtering false positives.

### OWASP Benchmark (SAIST vs Traditional SAST)

| Category | SAIST | Traditional SAST |
|----------|-------|-----------------|
| Command Injection | 90% | 59% |
| XSS | 93% | 65% |
| SQL Injection | 86% | 63% |
| Path Traversal | 90% | 64% |

### Run SAIST Standalone

```bash
git clone https://github.com/DataDog/datadog-saist.git
cd datadog-saist && make build

# Requires one LLM API key:
export ANTHROPIC_API_KEY="..."   # or OPENAI_API_KEY or GOOGLE_API_KEY

./bin/datadog-saist \
  --directory ./src \
  --output results.sarif \
  --detection-model claude-sonnet-4-6 \
  --validation-model claude-haiku-4-5
```

### SAIST CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--directory` | Code directory to scan | (required) |
| `--output` | SARIF output file path | (required) |
| `--detection-model` | LLM for detection | (required) |
| `--validation-model` | LLM for FP filtering | (required) |
| `--file-concurrency` | Parallel threads | 20 |
| `--request-timeout-sec` | LLM timeout | 30 |
| `--debug` | Verbose output | false |
| `--write-prompts` | Save prompts to files | false |

### Supported Languages (SAIST)

Java, Python, Go, C#

### Detected CWE Categories (15)

SQL Injection, Command Injection, XSS, Path Traversal, Insecure Deserialization, Broken Access Control, SSRF, XXE, LDAP Injection, Log Injection, Open Redirect, Weak Cryptography, Hardcoded Secrets, Information Exposure, Improper Input Validation

## SAST — Rule-Based Static Analysis

### Supported Languages

Python, JavaScript/TypeScript, Java, Go, Ruby, C#, PHP, Kotlin, Swift, Docker, Terraform

### CI Integration (GitHub Actions)

```yaml
- name: Datadog SAST
  uses: DataDog/datadog-static-analyzer-github-action@v1
  with:
    dd_api_key: ${{ secrets.DD_API_KEY }}
    dd_app_key: ${{ secrets.DD_APP_KEY }}
    dd_site: datadoghq.com
```

## SCA — Software Composition Analysis

### What SCA Checks

- Known CVEs in direct and transitive dependencies
- License compliance risks
- Outdated packages with available security patches
- Malicious package detection

### Supported Ecosystems

npm/yarn/pnpm, pip/poetry/pipenv, Maven/Gradle, Go modules, NuGet, RubyGems, Cargo, CocoaPods

## Workflow: Full Security Scan

```bash
# Option A: MCP Server (recommended — runs all scans in one command)
datadog-code-security-mcp scan all ./src

# Option B: Individual tools
# 1. SCA — check dependencies (fastest)
datadog-code-security-mcp scan sca .

# 2. Secrets — find hardcoded credentials
datadog-code-security-mcp scan secrets .

# 3. SAST — rule-based code scan
datadog-code-security-mcp scan sast ./src

# 4. IaC — infrastructure misconfigs
datadog-code-security-mcp scan iac ./terraform

# 5. SAIST — AI-native deep scan (uses LLM credits)
./bin/datadog-saist \
  --directory ./src \
  --output saist-results.sarif \
  --detection-model claude-sonnet-4-6 \
  --validation-model claude-haiku-4-5

# Upload SARIF to Datadog
datadog-ci sarif upload --service my-service --env production saist-results.sarif
```

## Remediation

- **Bits AI Dev Agent** — Auto-generates fixes for vulnerabilities, submits as PRs in GitHub
- **Bulk campaigns** — Fix multiple vulns at once with custom instructions and PR grouping
- **Malicious PR detection** (Preview) — LLM-powered detection of malicious code in incoming PRs

## Triage Workflow

1. **Critical/High** — Fix immediately, block PR merge
2. **Medium** — Fix in current sprint
3. **Low/Info** — Track, fix opportunistically
4. **False positive** — Mark in UI (SAIST auto-filters most)

## Platform Integration

- **IAST (Runtime Code Analysis)** — Validates SAST/SAIST findings with real production traffic
- **APM** — Correlates vulnerabilities with affected services and traces
- **Service Catalog** — Maps findings to service owners for routing
- **Monitors** — Alert on new critical vulnerabilities
- **Workflows** — Automate triage and notification pipelines
- **Bits AI Security Analyst** — Autonomously triages Cloud SIEM signals and investigates threats
