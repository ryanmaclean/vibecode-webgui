---
name: datadog-code-security
description: Run Datadog Code Security scans on a codebase — SAST (rule-based static analysis), SAIST (AI-native SAST using LLMs for vulnerability detection), and SCA (software composition analysis for dependency vulnerabilities). Use when asked to scan code for vulnerabilities, run a security audit, find bugs via static analysis, or check dependencies for known CVEs.
---

# Datadog Code Security Skill

Scan codebases for security vulnerabilities using Datadog's three-layer Code Security suite:

| Layer | What it does | How it works |
|-------|-------------|--------------|
| **SAST** | Rule-based static analysis | Deterministic rules scan first-party code for CWEs |
| **SAIST** | AI-native SAST (preview) | LLMs detect context-dependent vulns that rules miss |
| **SCA** | Software Composition Analysis | Scans dependencies for known CVEs via advisory DBs |

## When to Use

- User asks to "scan for vulnerabilities", "run security analysis", "check for CVEs"
- Before a release or PR merge as a security gate
- After adding new dependencies (SCA)
- For deep analysis of complex code paths (SAIST)

## SAST — Static Code Analysis

Datadog's rule-based SAST scans first-party code using the `datadog-ci` CLI.

### Setup

```bash
npm install -g @datadog/datadog-ci
# or
pip install datadog-ci
```

### Run SAST

```bash
# Scan current directory
datadog-ci sarif upload --service <service-name> --env <env> <sarif-file>

# Via Datadog UI: Security > Code Security > Static Analysis
# Configure in CI: add datadog-ci static-analysis to your pipeline
```

### CI Integration (GitHub Actions)

```yaml
- name: Datadog SAST
  uses: DataDog/datadog-static-analyzer-github-action@v1
  with:
    dd_api_key: ${{ secrets.DD_API_KEY }}
    dd_app_key: ${{ secrets.DD_APP_KEY }}
    dd_site: datadoghq.com
```

### Supported Languages

Python, JavaScript/TypeScript, Java, Go, Ruby, C#, PHP, Kotlin, Swift, Docker, Terraform

## SAIST — AI-Native SAST (Preview)

Datadog SAIST uses LLMs for vulnerability detection. Open-source at `github.com/DataDog/datadog-saist`.

Unlike rule-based SAST, SAIST reasons about code semantics, execution context, and call stacks to detect vulnerabilities that rigid rules miss.

### How SAIST Works

1. **Identification** — Heuristics filter candidate files likely to contain risks
2. **Context Retrieval** — Gathers invoked functions and related files for full context
3. **Analysis** — LLM assesses code for vulnerabilities with execution context
4. **Post-Processing** — Heuristic + LLM-based false positive filtering

Architecture uses two models: a **detection model** for finding vulns and a **validation model** for filtering false positives.

### OWASP Benchmark (SAIST vs Traditional SAST)

| Category | SAIST | Traditional SAST |
|----------|-------|-----------------|
| Command Injection | 90% | 59% |
| XSS | 93% | 65% |
| SQL Injection | 86% | 63% |
| Path Traversal | 90% | 64% |

### Setup (Open Source)

```bash
git clone https://github.com/DataDog/datadog-saist.git
cd datadog-saist
make build
```

Requires an LLM API key (one of):
```bash
export ANTHROPIC_API_KEY="..."   # Claude
export OPENAI_API_KEY="..."      # GPT
export GOOGLE_API_KEY="..."      # Gemini
```

### Run SAIST

```bash
./bin/datadog-saist \
  --directory ./src \
  --output results.sarif \
  --detection-model claude-sonnet-4-6 \
  --validation-model claude-haiku-4-5
```

### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--directory` | Code directory to scan | (required) |
| `--output` | SARIF output file path | (required) |
| `--detection-model` | LLM for vulnerability detection | (required) |
| `--validation-model` | LLM for false-positive filtering | (required) |
| `--file-concurrency` | Parallel file analysis threads | 20 |
| `--request-timeout-sec` | LLM request timeout | 30 |
| `--debug` | Verbose output | false |
| `--write-prompts` | Save generated prompts to files | false |

### Supported Languages (SAIST)

Java, Python, Go (C# coming soon)

### Detected CWE Categories (15)

SQL Injection, Command Injection, XSS, Path Traversal, Insecure Deserialization, Broken Access Control, SSRF, XXE, LDAP Injection, Log Injection, Open Redirect, Weak Cryptography, Hardcoded Secrets, Information Exposure, Improper Input Validation

## SCA — Software Composition Analysis

Scans open-source dependencies for known vulnerabilities using Datadog's advisory database.

### Run SCA

```bash
# Via Datadog UI: Security > Code Security > Vulnerabilities
# Filter by: Library Vulnerabilities

# CI integration
datadog-ci sbom upload --service <service-name> --env <env> <sbom-file>
```

### What SCA Checks

- Known CVEs in direct and transitive dependencies
- License compliance risks
- Outdated packages with available security patches
- Malicious package detection

### Supported Ecosystems

npm/yarn/pnpm, pip/poetry/pipenv, Maven/Gradle, Go modules, NuGet, RubyGems, Cargo, CocoaPods

## Workflow: Full Security Scan

For a comprehensive scan, run all three layers:

```bash
# 1. SCA — check dependencies first (fastest)
# Review: Security > Code Security > Library Vulnerabilities

# 2. SAST — rule-based scan (fast, deterministic)
# Review: Security > Code Security > Code Vulnerabilities

# 3. SAIST — AI-native deep scan (thorough, uses LLM credits)
./bin/datadog-saist \
  --directory ./src \
  --output saist-results.sarif \
  --detection-model claude-sonnet-4-6 \
  --validation-model claude-haiku-4-5

# Upload SARIF results to Datadog
datadog-ci sarif upload \
  --service my-service \
  --env production \
  saist-results.sarif
```

## Triage Workflow

When findings come in:

1. **Critical/High severity** — Fix immediately, block PR merge
2. **Medium severity** — Fix in current sprint
3. **Low/Info** — Track, fix opportunistically
4. **False positive** — Mark as false positive in Datadog UI (SAIST auto-filters most of these)

Use Datadog's "Fix with Bits" feature for AI-assisted remediation suggestions directly in the UI.

## Integration with Datadog Platform

SAIST findings integrate with the broader Datadog ecosystem:
- **IAST (Runtime Code Analysis)** — Validates SAST/SAIST findings with real traffic in production
- **APM** — Correlates vulnerabilities with affected services and traces
- **Service Catalog** — Maps findings to service owners for routing
- **Monitors** — Alert on new critical vulnerabilities
- **Workflows** — Automate triage and notification pipelines
