---
name: datadog-code-security
description: Run Datadog Code Security scans — SAST, SAIST (AI-native SAST), SCA, secrets, IaC scanning, plus supply-chain protection (GuardDog, Supply-Chain Firewall) and IDE runtime defense (IDE Shepherd). Integrates via Code Security MCP Server for real-time scanning in Claude Code, Cursor, and VS Code. Use when asked to scan code for vulnerabilities, run a security audit, find bugs via static analysis, check dependencies for known CVEs, or protect against supply-chain attacks.
---

# Datadog Code Security Skill

Full-stack application security from Datadog — from code analysis to supply-chain defense to IDE runtime protection.

## Tool Overview

### Code Analysis (find vulns in your code)

| Tool | What it does | How it works |
|------|-------------|--------------|
| **SAST** | Rule-based static analysis | Deterministic rules scan first-party code for CWEs |
| **SAIST** | AI-native SAST | LLMs detect context-dependent vulns that rules miss |
| **SCA** | Software Composition Analysis | Scans dependencies for known CVEs via advisory DBs |
| **Secrets** | Hardcoded secret detection | Finds API keys, tokens, passwords in source code |
| **IaC** | Infrastructure-as-Code scanning | Detects misconfigs in Terraform, CloudFormation, etc. |

### Supply-Chain Defense (block malicious packages)

| Tool | What it does | How it works |
|------|-------------|--------------|
| **[Supply-Chain Firewall](https://github.com/DataDog/supply-chain-firewall)** | Blocks malicious packages at install time | Wraps pip/npm/poetry, checks against malware DBs before install |
| **[GuardDog](https://github.com/DataDog/guarddog)** | Identifies malicious packages via heuristics | Semgrep + Yara rules on source code and metadata analysis |

### IDE Runtime Defense (protect your dev environment)

| Tool | What it does | How it works |
|------|-------------|--------------|
| **[IDE Shepherd](https://github.com/DataDog/IDE-Shepherd-extension)** | Blocks malicious VS Code/Cursor extensions in real-time | Hooks Node.js primitives (`http`, `child_process`, `fs`) to intercept attacks before execution |

---

## Code Security MCP Server (Recommended Entry Point)

The MCP server runs all code scanners locally with real-time feedback — line numbers, rule references, and proposed fixes.

### Install

```bash
# Homebrew (macOS/Linux)
brew install datadog-labs/pack/datadog-code-security-mcp

# Direct download
curl -L "https://github.com/datadog-labs/datadog-code-security-mcp/releases/latest/download/datadog-code-security-mcp-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m).tar.gz" | tar xz
sudo install -m 755 datadog-code-security-mcp /usr/local/bin/
```

### Configure for Claude Code

```bash
claude mcp add datadog-code-security \
  -e DD_API_KEY=<your-api-key> \
  -e DD_APP_KEY=<your-app-key> \
  -e DD_SITE=datadoghq.com \
  -- datadog-code-security-mcp start
```

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

### MCP Tools

| Tool | Function | Auth |
|------|----------|------|
| `datadog_sast_scan` | Static analysis for code vulnerabilities | Yes |
| `datadog_secrets_scan` | Hardcoded secrets detection | Yes |
| `datadog_sca_scan` | Dependency vulnerability scanning (CVEs) | Yes |
| `datadog_iac_scan` | Infrastructure-as-Code security | Yes |
| `datadog_generate_sbom` | Software Bill of Materials generation | No |

### CLI Usage (without MCP)

```bash
datadog-code-security-mcp scan all ./src          # Everything
datadog-code-security-mcp scan sast ./src          # SAST only
datadog-code-security-mcp scan secrets ./config    # Secrets only
datadog-code-security-mcp scan sca ./              # SCA only
datadog-code-security-mcp scan iac ./terraform     # IaC only
datadog-code-security-mcp generate-sbom .          # SBOM
datadog-code-security-mcp scan all ./src --json    # JSON output
```

### Required Binaries (auto-downloaded or install manually)

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

*SBOM generation works without auth.

---

## SAIST — AI-Native SAST

Open-source at [github.com/DataDog/datadog-saist](https://github.com/DataDog/datadog-saist). Uses LLMs to reason about code semantics, execution context, and call stacks — catches what rigid rules miss.

### How It Works

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

### Run SAIST

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

### Supported Languages: Java, Python, Go, C#

### Detected CWE Categories (15)

SQL Injection, Command Injection, XSS, Path Traversal, Insecure Deserialization, Broken Access Control, SSRF, XXE, LDAP Injection, Log Injection, Open Redirect, Weak Cryptography, Hardcoded Secrets, Information Exposure, Improper Input Validation

---

## Supply-Chain Firewall (SCFW)

Blocks malicious packages **before they install**. Drop-in wrapper around pip, npm, and poetry.

### Install

```bash
pipx install scfw    # or: pip install scfw
scfw configure       # interactive setup, optional Datadog logging
```

### Usage

```bash
# Wrap any install command — SCFW checks packages before proceeding
scfw run npm install react
scfw run pip install -r requirements.txt
scfw run poetry add flask

# Audit already-installed packages
scfw audit npm
scfw audit pip
scfw audit --executable venv/bin/python pip
```

### How It Works

1. Intercepts the package manager call
2. Collects all target packages
3. Verifies each against malware databases
4. **Blocks immediately** on critical findings, **prompts** on warnings
5. Proceeds only if clean

### Data Sources

| Verifier | What it checks |
|----------|---------------|
| Datadog Security Research Dataset | Known malicious packages |
| OSV.dev Advisories | Malicious packages + vulnerability data |
| Package Registry Metadata | Recently published / suspicious packages |
| Custom Findings | User-provided allowlists/blocklists |

### Supported Package Managers

| Manager | Min Version | Inspected Commands |
|---------|-------------|-------------------|
| npm | >= 7.0 | `install` (including aliases) |
| pip | >= 22.2 | `install` |
| poetry | >= 1.7 | `add`, `install`, `sync`, `update` |

### Datadog Integration

```bash
scfw configure   # enables optional HTTP API logging or local Agent logging
```

Logs all blocked/allowed decisions to Datadog for audit trails and incident response.

### Platforms: macOS (full), Linux (supported), Windows (not supported)

---

## GuardDog

Identifies malicious packages via heuristic analysis — Semgrep rules on source code + metadata checks. Covers 6 ecosystems with ~60 built-in heuristics.

### Install

```bash
pip install guarddog          # or: uvx guarddog pypi scan requests
# Windows: Docker only
docker pull ghcr.io/datadog/guarddog
```

### Usage

```bash
# Scan a specific package
guarddog pypi scan requests
guarddog npm scan express
guarddog pypi scan requests --version 2.28.1

# Verify dependencies from manifest files
guarddog pypi verify requirements.txt
guarddog npm verify package-lock.json
guarddog go verify go.mod
guarddog github_action verify .github/workflows/main.yml

# Output formats
guarddog pypi scan requests --output-format sarif    # for GitHub code scanning
guarddog pypi scan requests --output-format json     # machine-readable
```

### Supported Ecosystems

| Ecosystem | Source Code Rules | Metadata Rules |
|-----------|-----------------|----------------|
| PyPI | 14 | 12 |
| npm | 10 | 9 |
| Go | 4 | — |
| RubyGems | 7 | — |
| GitHub Actions | 10 | — |
| VS Code Extensions | 10 | — |

### What It Detects

**Source code heuristics:** exec-base64, code-execution, cmd-overwrite, clipboard-access, exfiltrate-sensitive-data, dll-hijacking, steganography, obfuscation, download-executable, silent-process-execution, reverse shells, suspicious links

**Metadata heuristics:** typosquatting, deceptive-author, empty-information, release-zero, single-python-file, potentially-compromised-email-domain, bundled-binary, repository-integrity-mismatch

### CI Integration (GitHub Actions)

```yaml
- run: uvx guarddog pypi verify requirements.txt --output-format sarif > guarddog.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: guarddog.sarif
```

### Custom Rules

Drop Semgrep (`.yml`) or Yara (`.yar`) rules into `guarddog/analyzer/sourcecode/` — auto-imported and available via CLI.

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `GUARDDOG_PARALLELISM` | Thread count | CPU count |
| `GUARDDOG_SEMGREP_TIMEOUT` | Rule timeout | 10s |
| `GUARDDOG_SEMGREP_MAX_TARGET_BYTES` | Max file size | 10MB |
| `GUARDDOG_MAX_UNCOMPRESSED_SIZE` | Archive bomb limit | 2GB |
| `GUARDDOG_MAX_COMPRESSION_RATIO` | Compression bomb detection | 100:1 |

---

## IDE Shepherd

VS Code/Cursor extension that detects and **blocks malicious extensions at runtime** — intercepts Node.js primitives before execution.

### Install

Search "IDE Shepherd" in VS Code/Cursor Extensions panel, or:
```bash
code --install-extension ide-shepherd-extension-2.1.0.vsix
```

### What It Detects

**Runtime interception** (hooks `http`, `child_process`, `fs` as modules load):

| Category | Examples |
|----------|---------|
| Network | Requests to malware domains, data exfiltration endpoints, tunneling services |
| Process execution | PowerShell with evasion flags, command injection, piping to shell interpreters, detached processes |
| File system | Reading SSH keys/AWS creds/kube configs/shell history, unauthorized SSH key writes, shell profile modification |
| Workspace tasks | Network downloads, encoded PowerShell, privilege escalation, recursive deletion |

**Static analysis** (scans all JS in extensions including `node_modules`):

| Rule | Pattern |
|------|---------|
| Download-and-execute | Network fetch + process spawn |
| Reverse shell | Raw sockets + exec calls |
| Dynamic payload | eval with decoded content |
| Detached process | Background process with silent stdio |
| Command injection | Shell command construction vectors |

**Metadata heuristics:** Void descriptions, generic categorization, wildcard activation, missing repo info

### Trust Controls

- Allowlist specific extension versions after manual review
- Trust entire publishers
- Mark workspaces as trusted (prevents build task interruption)

### Datadog Agent Integration

Sends security events to Datadog Agent for centralized logging and telemetry.

---

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

---

## SCA — Software Composition Analysis

### What SCA Checks

- Known CVEs in direct and transitive dependencies
- License compliance risks
- Outdated packages with available security patches
- Malicious package detection

### Supported Ecosystems

npm/yarn/pnpm, pip/poetry/pipenv, Maven/Gradle, Go modules, NuGet, RubyGems, Cargo, CocoaPods

---

## Workflow: Full Security Scan

```bash
# 1. Supply-chain defense — block malicious deps before install
scfw run npm install                    # firewall-wrapped install
guarddog npm verify package-lock.json   # heuristic scan of deps

# 2. MCP Server — run all code scanners
datadog-code-security-mcp scan all ./src

# 3. SAIST — AI-native deep scan (uses LLM credits)
./bin/datadog-saist \
  --directory ./src \
  --output saist-results.sarif \
  --detection-model claude-sonnet-4-6 \
  --validation-model claude-haiku-4-5

# 4. Upload all SARIF results to Datadog
datadog-ci sarif upload --service my-service --env production saist-results.sarif

# 5. IDE protection — install IDE Shepherd in VS Code/Cursor
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
