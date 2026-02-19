# Security Audit Report: vibecode-webgui

**Date:** 2026-02-19
**Branch:** `claude/install-trusted-skills-bPxQK`
**Scope:** Full codebase (TypeScript 1297, Go 1126, Python 393, TSX 244, JS 185 files)
**Tools:** npm audit, code review, differential review, secrets scan

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 6 |
| HIGH | 10 |
| MEDIUM | 7 |
| LOW | 5 |
| Dependency (HIGH) | 39 |

**Top risks:** Command injection in VM providers, arbitrary code execution in workflow engine, committed private keys, and 39 HIGH-severity npm dependency vulnerabilities.

---

## CRITICAL Findings

### C1. Arbitrary Code Execution via `new Function()` in Workflow Engine
- **File:** `src/lib/workflow/engine.ts:171`
- **Issue:** `new Function(...Object.keys(contextVars), \`return ${expression}\`)` executes arbitrary JavaScript from user-supplied workflow expressions with no sandboxing.
- **Remediation:** Use a safe expression evaluator (e.g., `expr-eval`, `mathjs`) or a sandboxed VM context.

### C2. Arbitrary Python Code Execution via Gradio API
- **File:** `src/app/api/gradio/run/route.ts:72-94`
- **Issue:** Unvalidated Python code directly executed with no sandboxing or authorization.
- **Remediation:** Add allowlisting, sandbox execution, require authentication.

### C3. Command Injection Across VM Providers
- **Files:** `src/lib/vm/providers/wsl2.ts:144,222`, `lima.ts:38-64`, `docker.ts`, `native-vm.ts:570-571`
- **Issue:** Shell string interpolation of `vmId`, `command`, and `provision.script` without escaping. Example: `exec(\`wsl -d ${vmId} -- ${command}\`)`
- **Attack:** `vmId = "test; rm -rf /"` achieves arbitrary command execution.
- **Remediation:** Use `execFile()` with argument arrays instead of `exec()` with string interpolation. The fix was partially applied to `qemu.ts` and `vfkit.ts` but not completed across all providers.

### C4. SAML Response Parsing Without Signature Verification
- **File:** `src/lib/auth/saml-provider.ts:343-388`
- **Issue:** Regex-based XML parsing with no cryptographic signature validation enables complete authentication bypass.
- **Remediation:** Use a proper SAML library (e.g., `saml2-js`, `passport-saml`) with signature verification.

### C5. XSS via `innerHTML` in Monitoring Dashboard
- **File:** `src/app/monitoring/page.tsx:242-259`
- **Issue:** Trace data fields (`trace.traceId`, `trace.service`, `trace.operation`) interpolated unsanitized into `modal.innerHTML`.
- **Attack:** Malicious trace data could inject scripts into the monitoring UI.
- **Remediation:** Use React components instead of DOM manipulation, or sanitize with DOMPurify.

### C6. Command Injection via Goose Migration Name
- **File:** `src/app/api/workspace/[id]/init-goose/route.ts:88`
- **Issue:** `execAsync(\`goose -dir migrations create ${migrationName} sql\`)` - though Zod-validated, template string in shell context is risky.
- **Remediation:** Use `execFile()` with argument arrays.

---

## HIGH Findings

### H1. Committed Private Keys (Real Credentials)
- **File:** `fast-openvscode-vm/certs/openvscode-local-key.pem` - RSA private key
- **File:** `gitea/data/jwt/private.pem` - 4096-bit RSA JWT signing key
- **Remediation:** Remove immediately, rotate keys, scrub git history with `git filter-repo`.

### H2. Hardcoded PostgreSQL Password
- **File:** `config/vfkit/postgresql-pgvector-vm.yaml:423`
- **Issue:** Password `"postgres_admin_2024"` hardcoded in version control.
- **Remediation:** Use environment variables or secrets management.

### H3. SQL Injection via Unparameterized Table Names
- **File:** `src/lib/db/pgvector-client.ts`
- **Issue:** Table names constructed via string interpolation in SQL queries.
- **Remediation:** Use allowlisted table names, never interpolate user input into SQL.

### H4. `shell=True` in Python Subprocess
- **File:** `scripts/security_updates.py:120-126`
- **Issue:** `subprocess.Popen()` with `shell=True` using user-provided commands.
- **Remediation:** Use `subprocess.run()` with argument lists, never `shell=True` with external input.

### H5. Server-Side Request Forgery in Webhook Execution
- **File:** `src/lib/workflow/engine.ts:609-627`
- **Issue:** Webhook URLs not validated, allowing requests to internal services.
- **Remediation:** Validate URLs against an allowlist, block private IP ranges.

### H6. Unbounded Resource Creation (DoS)
- `src/app/api/gradio/run/route.ts:22` - Unbounded Gradio process spawning
- `src/app/api/workspace/files/sync/route.ts:37` - Unbounded WebSocket connections
- `src/app/api/workspace/terminal/session/route.ts:31` - Unbounded PTY processes
- `src/lib/rate-limiting.ts:45-62` - In-memory rate limiter with no cleanup (memory leak)
- **Remediation:** Add per-user limits, TTL-based cleanup, connection pooling.

### H7. Committed `node_modules` Directory
- **File:** `daemon/kafka-dsm/node_modules/` (5,829 files)
- **Issue:** Bypasses lockfile integrity checks, supply chain risk.
- **Remediation:** Add to `.gitignore`, remove from repo.

### H8. Incomplete Shell Injection Remediation
- **Issue:** A prior security fix migrated `exec()` to `execFile()` in `qemu.ts` and `vfkit.ts`, but `wsl2.ts`, `lima.ts`, `docker.ts`, and `native-vm.ts` were missed.
- **Remediation:** Complete the migration across all VM providers.

### H9. Bypassable Regex Validation in Calculator Tool
- **File:** `src/lib/agent-framework/tools/index.ts:24-29`
- **Issue:** Regex `/^[\d\s+\-*/().,]+$/` used before `new Function()` is insufficient for preventing code injection.
- **Remediation:** Use a safe math expression parser.

### H10. 39 HIGH npm Dependency Vulnerabilities
- **Root causes:** `minimatch` (ReDoS), `fast-xml-parser` (XXE), outdated `jest`, `eslint-config-next`, `testcontainers`
- **Remediation:** `npm audit fix` or update root packages. See Datadog SCA recommendation below.

---

## MEDIUM Findings

### M1. Committed `.env` Files Leaking Infrastructure
- 9 `.env` files under `daemon/kafka-dsm/` and `daemon/gitea-kafka-bridge/` expose internal IPs (`10.0.3.70`), hostnames, Kafka topics, and service topology.
- **Remediation:** Move to `.env.example` pattern, remove from repo.

### M2. CORS Wildcard in Development Mode
- **File:** `src/middleware/security-middleware.ts:430`
- **Issue:** Falls back to `Access-Control-Allow-Origin: *` in test/dev mode.
- **Remediation:** Use explicit origins even in dev.

### M3. Deleted Security Test Coverage
- **Commit:** `9b24827d` removed `tests/security/penetration-testing.test.ts`, `monitoring-security.test.ts`, and `test_security_scripts.py`.
- **Remediation:** Restore penetration test coverage.

### M4. Test Bypass Function Exported Globally
- **File:** `src/middleware/security-middleware.ts:376-384`
- **Issue:** `__TEST__bypassSecurityChecks()` disables all security checks when called.
- **Remediation:** Gate behind `NODE_ENV === 'test'` check inside the function, or use dependency injection.

### M5. Authentication Bypass Pattern
- **File:** `src/middleware.ts:43-46`
- **Issue:** Middleware excludes all `/api/` routes from authentication checks.
- **Remediation:** Explicitly list public API routes.

### M6. Workflow Execution Store Memory Leak
- **File:** `src/lib/workflow/engine.ts:183`
- **Issue:** `executions` Map grows unbounded, never cleaned.
- **Remediation:** Add TTL-based cleanup or size limits.

### M7. Verbose Error Messages Exposing Internals
- **File:** `src/app/api/upload/route.ts:334`
- **Issue:** Internal error details returned to clients.
- **Remediation:** Return generic errors, log details server-side.

---

## LOW Findings

- **L1.** Missing Content-Security-Policy header in middleware
- **L2.** Placeholder secrets in `OneClickDeploy.tsx:119-126`
- **L3.** SSH StrictHostKeyChecking disabled in QEMU provider (`qemu.ts:160`)
- **L4.** Incomplete log sanitization (`src/lib/logger.ts:246`)
- **L5.** Default SSH password "vibecode" in VM launch script (`vibecode:475`)

---

## Dependency Vulnerability Summary (npm audit)

| Package | Severity | Root Cause | Fix |
|---------|----------|------------|-----|
| minimatch < 10.2.1 | HIGH | ReDoS via cascading deps | Update eslint, jest, glob |
| fast-xml-parser 4.1.3-5.3.5 | HIGH | XXE/injection | Update to latest |
| jest (outdated) | HIGH | Vulnerable transitive deps | Update to latest |
| eslint-config-next | HIGH | Vulnerable typescript-eslint chain | Update to latest |
| testcontainers | HIGH | archiver chain | Update to 7.0.1 |

**Total:** 39 HIGH, 6 MODERATE, 1 LOW across 2,353 dependencies.

---

## Recommendations

### Immediate (P0)
1. Remove committed private keys and scrub git history
2. Complete `exec()` to `execFile()` migration across all VM providers
3. Replace `new Function()` in workflow engine with safe expression evaluator
4. Fix SAML authentication bypass

### Short-term (P1)
5. Enable Datadog SCA (free) for continuous dependency scanning
6. Run `npm audit fix` to address the 39 HIGH dependency vulns
7. Remove committed `node_modules` from `daemon/kafka-dsm/`
8. Sanitize `innerHTML` XSS in monitoring dashboard
9. Add SSRF protection to webhook execution

### Medium-term (P2)
10. Restore deleted security test coverage
11. Add Content-Security-Policy headers
12. Implement bounded resource pools for WebSockets, PTY sessions, Gradio processes
13. Move infrastructure `.env` files to `.env.example` pattern

### Datadog SCA Setup
Since you're already on Datadog, enable SCA for free continuous monitoring:
- **GitHub integration:** Datadog > Software Composition Analysis > Setup > GitHub
- **CI pipeline:** `npm install -g @datadog/datadog-ci && datadog-ci sbom upload --service vibecode-webgui --source .`

---

*Report generated by Claude Code audit using: code-review, differential-review, secrets-scan, and npm audit skills.*
