# Security Policy

## Vulnerability Reporting

### How to Report a Security Vulnerability

If you discover a security vulnerability in VibeCode WebGUI, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. **Email**: security@vibecode.dev with details:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)
3. **Response Time**: We aim to respond within 48 hours
4. **Disclosure Timeline**: We follow coordinated disclosure (90 days)

### Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 0.1.0 | :x:                |

### Security Best Practices

#### For Developers

1. **Authentication & Authorization**
   - Never hardcode credentials or API keys
   - Use environment variables for secrets
   - Implement proper session management
   - Always use HTTPS in production

2. **Cryptography**
   - Use `crypto.randomBytes()` for security-critical random values
   - Never use `Math.random()` for passwords, tokens, or session IDs
   - Use bcrypt/argon2 for password hashing (cost factor >= 12)
   - Implement proper key rotation policies

3. **Input Validation**
   - Validate and sanitize all user inputs
   - Use parameterized queries to prevent SQL injection
   - Implement proper CORS policies
   - Escape output to prevent XSS attacks

4. **Dependencies**
   - Keep dependencies up to date
   - Review Dependabot PRs promptly
   - Run `npm audit` regularly
   - Verify checksums for downloaded binaries

5. **Code Review**
   - All security-related changes require review
   - Use ESLint security plugins
   - Run SAST tools in CI/CD pipeline
   - Document security decisions in ADRs

---

# Supply Chain Security Checklist (Issue #416)

Sloane (Documentation) captured Maya's supply-chain verification plan in this checklist so the engineering and release teams can execute repeatable, auditable verification before promoting CLI tooling into any environment. Owners must keep this document current with every release cycle.

- [2025-10-02] Issue #445: Legacy WebGUI credentials now hashed with bcrypt; database-backed auth still pending for full migration.
- [2025-10-04] Issue #529: Replaced Math.random() with crypto.randomBytes() for password and session ID generation.

## Supply Chain Verification Overview

All downloads must be verified prior to installation or baking into container images. Record the command output from the verification scripts listed below inside CI job artifacts and quarterly audit notes.

| Tool      | Required cosign identity / issuer                                                                 | Verification script path                           | Last verification date |
|-----------|---------------------------------------------------------------------------------------------------|-----------------------------------------------------|------------------------|
| kubectl   | `krel-trusted-builder@k8s-releng-prod.iam.gserviceaccount.com` / `https://accounts.google.com`   | `scripts/security/verify-kubectl.sh`               | Pending — first verification window closes 2025-10-08 |
| helm      | `https://github.com/helm/helm/.github/workflows/release.yml@refs/tags/v<version>` / `https://token.actions.githubusercontent.com` | `scripts/security/verify-helm.sh`                 | Pending — first verification window closes 2025-10-10 |
| kubectx   | `supply-chain@vibecode.dev` (internal re-sign of upstream tarball) / `https://accounts.google.com` | `scripts/security/verify-kubectx.sh`               | Pending — first verification window closes 2025-10-11 |
| kubens    | `supply-chain@vibecode.dev` (internal re-sign of upstream tarball) / `https://accounts.google.com` | `scripts/security/verify-kubens.sh`                | Pending — first verification window closes 2025-10-11 |

> **Note:** If upstream publishes an official cosign identity, update the table and runbooks immediately, then notify Maya for risk review.

### Application Authentication Hardening (Issue #445)

- ✅ 2025-10-02: Legacy development credentials migrated to bcrypt (12-round) hashes with timing-safe comparisons. Plaintext passwords retained only in migration notes pending full database-backed auth rollout.

## Step-by-Step Runbooks

The steps below assume a Unix-like workstation or CI runner with `curl`, `sha256sum`, `cosign`, and `jq` available. Replace `<VERSION>` placeholders before running.

### cosign binary (checksums flow)

1. `export COSIGN_VERSION=v2.3.1` (or the desired release tag).
2. `curl -fsSLO https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64`
3. `curl -fsSLO https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign_checksums.txt`
4. `grep "cosign-linux-amd64" cosign_checksums.txt | sha256sum --check --ignore-missing`
5. Append the verification output and command transcript to `security/verifications/$(date +%F)-cosign.log` (for example, `security/verifications/2025-10-02-cosign.log`) using `tee -a` so auditors can review the checksum parsing results.

Store the downloaded checksum manifest with the verification logs, and if the checksum fails stop immediately and escalate to Maya. Successful runs should leave the full command history in the dated log for traceability.

### kubectl (deadline: 2025-10-08)

**Download**
1. `export KUBECTL_VERSION=v1.31.0` (or the required release).
2. `curl -fsSLO https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl`
3. `curl -fsSLO https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl.sha256`
4. `curl -fsSLO https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl.sig`

**SHA256 verification**
```
sha256sum --check kubectl.sha256
```
Ensure the output contains `kubectl: OK`. If it does not, stop immediately and follow remediation steps.

**Cosign verification**
```
cosign verify-blob kubectl \
  --certificate-identity-regexp "krel-trusted-builder@k8s-releng-prod.iam.gserviceaccount.com" \
  --certificate-oidc-issuer https://accounts.google.com \
  --bundle kubectl.sig
```
Store the cosign JSON summary in `artifacts/supply-chain/kubectl-${KUBECTL_VERSION}.json` for audits.

**Installation**
```
install -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client --output=yaml | tee artifacts/supply-chain/kubectl-${KUBECTL_VERSION}-postinstall.yaml
```

**Remediation if verification fails**
- Delete the downloaded files and re-fetch from the canonical URL; transient CDN issues can corrupt downloads.
- If SHA mismatch persists, open an incident in `#security-warroom`, attach command output, and block any rollout.
- If cosign fails while SHA passes, capture `COSIGN_EXPERIMENTAL=1 cosign verify-blob --verbose ...` output for Maya to inspect and halt the release pipeline until closed.

### helm (deadline: 2025-10-10)

**Download**
1. `export HELM_VERSION=v3.16.0` (or required release).
2. `curl -fsSLO https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz`
3. `curl -fsSLO https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz.sha256sum`
4. `curl -fsSLO https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz.sig`

**SHA256 verification**
```
sha256sum --check helm-${HELM_VERSION}-linux-amd64.tar.gz.sha256sum
```
If the checksum fails, stop and contact release engineering.

**Cosign verification**
```
cosign verify-blob helm-${HELM_VERSION}-linux-amd64.tar.gz \
  --certificate-identity "https://github.com/helm/helm/.github/workflows/release.yml@refs/tags/${HELM_VERSION}" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --bundle helm-${HELM_VERSION}-linux-amd64.tar.gz.sig
```
Archive the verification bundle alongside CI artifacts.

**Installation**
```
tar -xzf helm-${HELM_VERSION}-linux-amd64.tar.gz
install -m 0755 linux-amd64/helm /usr/local/bin/helm
helm version --short | tee artifacts/supply-chain/helm-${HELM_VERSION}-postinstall.txt
```

**Remediation if verification fails**
- Confirm the version tag exists on the official Helm GitHub release page.
- Retry with a new download; if still failing, escalate to Maya with cosign logs and do not land the update.
- For checksum-only failures, double-check no proxy or mirror rewrote the tarball. Switch to direct `get.helm.sh` endpoint and re-run.

### kubectx (deadline: 2025-10-11)

**Download**
1. `export KUBECTX_VERSION=v0.10.3`
2. `curl -fsSLO https://github.com/ahmetb/kubectx/releases/download/${KUBECTX_VERSION}/kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz`
3. `curl -fsSLO https://artifacts.vibecode.dev/kubectx/${KUBECTX_VERSION}/kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz.sha256`
4. `curl -fsSLO https://artifacts.vibecode.dev/kubectx/${KUBECTX_VERSION}/kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz.sig`

**SHA256 verification**
```
sha256sum --check kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz.sha256
```
Checksum artifacts are generated by our internal build pipeline that mirrors upstream source. Treat mismatches as potential supply-chain compromise.

**Cosign verification**
```
cosign verify-blob kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz \
  --certificate-identity supply-chain@vibecode.dev \
  --certificate-oidc-issuer https://accounts.google.com \
  --bundle kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz.sig
```
If upstream publishes signed releases, swap the identity/issuer pair and note the change in this file.

**Installation**
```
tar -xzf kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz
install -m 0755 kubectx /usr/local/bin/kubectx
kubectx --help > artifacts/supply-chain/kubectx-${KUBECTX_VERSION}-postinstall.txt
```

**Remediation if verification fails**
- Validate that the internal mirror job (`ci/mirror-kubectx.yml`) succeeded; re-run if needed.
- If cosign fails but SHA passes, rotate the signing key in `secrets/kms/kubectx-signer` and regenerate the attestation.
- Report unresolved issues to Maya within 4 business hours to evaluate replacing kubectx with an approved alternative.

### kubens (deadline: 2025-10-11)

**Download**
1. `export KUBENS_VERSION=v0.10.3`
2. `curl -fsSLO https://github.com/ahmetb/kubectx/releases/download/${KUBENS_VERSION}/kubens_${KUBENS_VERSION}_linux_x86_64.tar.gz`
3. `curl -fsSLO https://artifacts.vibecode.dev/kubens/${KUBENS_VERSION}/kubens_${KUBENS_VERSION}_linux_x86_64.tar.gz.sha256`
4. `curl -fsSLO https://artifacts.vibecode.dev/kubens/${KUBENS_VERSION}/kubens_${KUBENS_VERSION}_linux_x86_64.tar.gz.sig`

**SHA256 verification**
```
sha256sum --check kubens_${KUBENS_VERSION}_linux_x86_64.tar.gz.sha256
```

**Cosign verification**
```
cosign verify-blob kubens_${KUBENS_VERSION}_linux_x86_64.tar.gz \
  --certificate-identity supply-chain@vibecode.dev \
  --certificate-oidc-issuer https://accounts.google.com \
  --bundle kubens_${KUBENS_VERSION}_linux_x86_64.tar.gz.sig
```

**Installation**
```
tar -xzf kubens_${KUBENS_VERSION}_linux_x86_64.tar.gz
install -m 0755 kubens /usr/local/bin/kubens
kubens --help > artifacts/supply-chain/kubens-${KUBENS_VERSION}-postinstall.txt
```

**Remediation if verification fails**
- Verify that the mirrored artifact matches the upstream GitHub checksum available under the release assets.
- If cosign verification fails for internal signatures, rotate the `kubens` signer service account, invalidate the artifact in the registry, and re-run the mirror workflow.
- Document the failure in `reports/supply-chain/incidents/<date>-kubens.md` and pause any dependency upgrade tickets until resolved.

## Automation Milestones

- **Dockerfile updates status:** Draft PR `docker/verify-base-images` adds `scripts/security` checks to every multi-stage build. Awaiting image build time benchmarking (ETA 2025-09-20).
- **CI smoke job status:** The `ci/supply-chain-smoke.yml` workflow stub is merged with dry-run logging; enable `verify-*` scripts once signatures are live (target sprint 2025-09-4).
- **Bcrypt migration status:** Issue #445 introduced shared bcrypt helpers for legacy credentials; production rollout waits on database-backed user storage from Issue #438.
- **Quarterly review schedule:** Run end-to-end verification the first Tuesday of January, April, July, and October. Maya chairs the review; SRE logs minutes in `reports/supply-chain/<year>-Q<q>.md`.

## Policy & Evidence Requirements

- **Cosign policy reference:** Follow the Sigstore guidance at <https://docs.sigstore.dev/cosign/overview/> and internal guardrails in `docs/policies/cosign-policy.md` (update that doc if identities change).
- **Build log capture:** CI workflows must `tee` checksum and cosign outputs to `artifacts/supply-chain/` for a minimum of 400 days retention. Local runs attach logs to the change request before hand-off.
- **Artifact registry storage:** Verified tarballs and signatures live in `us-central1-docker.pkg.dev/vibecode-supply-chain/cli-mirror`, using immutable tags (`<tool>/<version>`). Do not promote builds lacking both checksum and cosign evidence.

---

**Action:** Owners must backfill the “Last verification date” column after each successful run and ping Maya in `#security-supply-chain` once the deadlines above are met.
