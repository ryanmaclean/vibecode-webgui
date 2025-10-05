# GitHub Actions Workflows

Comprehensive documentation for all GitHub Actions workflows in the VibeCode project.

## Automated Monitoring Workflows

### Code-Server Release Monitor
**File:** `code-server-release-monitor.yml`
**Purpose:** Automatically monitors upstream code-server releases and creates GitHub issues when updates are available.

**Trigger:**
- Schedule: Daily at 00:00 UTC (`cron: '0 0 * * *'`)
- Manual: `workflow_dispatch` trigger available

**Behavior:**
1. Checks current code-server version in `docker/code-server/Dockerfile`
2. Fetches latest release from [coder/code-server](https://github.com/coder/code-server) GitHub repository
3. Compares versions and creates detailed GitHub issue if update is available
4. Includes release notes, changelog link, and comprehensive update checklist
5. Automatically labels issues: `enhancement`, `dependencies`, `automated`

**Issue Content Includes:**
- Release date and version information
- Full release notes (truncated if > 2000 chars with link to full notes)
- Changelog URL
- Comprehensive update action checklist:
  - All Dockerfile updates required
  - Build and test procedures
  - Documentation requirements
- Testing checklist for validation

**Permissions Required:**
- `issues: write` - Create and manage GitHub issues
- `contents: read` - Read repository content

**Manual Trigger:**
```bash
gh workflow run code-server-release-monitor.yml
```

**Configuration:**
- Monitors: `docker/code-server/Dockerfile`
- Update targets: `Dockerfile`, `Dockerfile.optimized`, `Dockerfile.kind`
- No authentication required (uses public GitHub API)

---

## CI/CD Workflows

### Main Branch CI
**File:** `main-branch-ci.yml`
**Purpose:** Continuous integration for main branch commits

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch

**Jobs:**
- Lint and format checking
- Unit tests
- Integration tests
- Build validation

### Release Branch CI
**File:** `release-branch-ci.yml`
**Purpose:** Pre-release validation and testing

**Triggers:**
- Push to `release/*` branches
- Tags matching version patterns

**Jobs:**
- Full test suite
- Security scanning
- Build artifacts
- Release preparation

---

## Container Workflows

### Code-Server Multi-Architecture Build
**File:** `codeserver-multiarch.yml`
**Purpose:** Build and push multi-architecture code-server images

**Triggers:**
- Manual dispatch
- Release tags

**Platforms:**
- linux/amd64
- linux/arm64

**Profiles:**
- minimal
- standard
- ai
- web
- full

### Code-Server Profiles
**File:** `codeserver-profiles.yml`
**Purpose:** Build profile-specific code-server images

**Profiles:**
- `minimal`: Essential tools only
- `standard`: Common development tools
- `ai`: AI assistant integrations
- `web`: Web development stack
- `full`: Complete toolset

---

## Deployment Workflows

### Azure App Service Deploy
**File:** `azure-appservice-deploy.yml`
**Purpose:** Deploy application to Azure App Service

### Azure WebGUI Deploy
**File:** `azure-webgui-deploy.yml`
**Purpose:** Deploy web interface to Azure

### Deploy AKS Monitoring
**File:** `deploy-aks-monitoring.yml`
**Purpose:** Deploy monitoring stack to Azure Kubernetes Service

---

## Security Workflows

### Security Audit
**File:** `security-audit.yml`
**Purpose:** Automated security scanning and vulnerability detection

**Scans:**
- Dependency vulnerabilities
- Container image scanning
- SAST (Static Application Security Testing)
- Secret scanning

**Triggers:**
- Schedule: Weekly
- Pull requests
- Manual dispatch

### Secret Scanning
**File:** `secret-scanning.yml`
**Purpose:** Detect accidentally committed secrets

**Detection:**
- API keys
- Passwords
- Tokens
- Certificates

---

## Testing Workflows

### Test Coverage
**File:** `test-coverage.yml`
**Purpose:** Generate and report code coverage metrics

**Metrics:**
- Line coverage
- Branch coverage
- Function coverage

### Kind Code-Server Smoke Test
**File:** `kind-code-server-smoke.yml`
**Purpose:** End-to-end testing in Kind (Kubernetes in Docker)

**Tests:**
- Pod deployment
- Service accessibility
- Extension loading
- Persistent volumes

---

## Documentation Workflows

### Deploy Docs
**File:** `deploy-docs.yml`
**Purpose:** Build and deploy project documentation

**Targets:**
- GitHub Pages
- Documentation site

### Deploy Next.js Docs
**File:** `deploy-next-docs.yml`
**Purpose:** Build and deploy Next.js documentation site

---

## Monitoring Workflows

### Cost Monitor
**File:** `cost-monitor.yml`
**Purpose:** Track and report cloud resource costs

**Reports:**
- Daily cost summary
- Resource usage trends
- Budget alerts

### Datadog Service Catalog
**File:** `datadog-service-catalog.yml`
**Purpose:** Sync service metadata to Datadog

---

## Maintenance Workflows

### Stale Issue Management
**File:** `stale.yml`
**Purpose:** Automatically manage stale issues and PRs

**Actions:**
- Label stale items after 60 days
- Close after 14 days of staleness
- Exempt labeled items

### Dependency Compatibility
**File:** `dependency-compatibility.yml`
**Purpose:** Verify dependency updates don't break compatibility

---

## Best Practices

### Workflow Development
1. Test workflows in feature branches before merging
2. Use `workflow_dispatch` for manual testing
3. Add comprehensive job descriptions
4. Include proper error handling
5. Set appropriate timeouts

### Security
1. Use minimal permissions (`permissions:` block)
2. Pin action versions to specific commits or tags
3. Never commit secrets to workflow files
4. Use GitHub secrets for sensitive data
5. Audit third-party actions before use

### Performance
1. Use caching for dependencies (`actions/cache`)
2. Parallelize independent jobs
3. Set appropriate timeouts
4. Use matrix strategies for multi-platform builds
5. Cache Docker layers with BuildKit

### Monitoring
1. Set up workflow status notifications
2. Monitor workflow run times
3. Track failure rates
4. Review workflow logs regularly
5. Use workflow badges in README

---

## Workflow Naming Conventions

- **CI/CD:** `*-ci.yml`, `*-deploy.yml`
- **Testing:** `test-*.yml`, `*-test.yml`
- **Security:** `security-*.yml`, `*-audit.yml`
- **Automation:** `*-monitor.yml`, `*-automation.yml`
- **Documentation:** `deploy-docs.yml`, `docs-*.yml`

---

## Manual Workflow Execution

Execute workflows manually using GitHub CLI:

```bash
# List all workflows
gh workflow list

# Run specific workflow
gh workflow run code-server-release-monitor.yml

# View workflow runs
gh run list --workflow=code-server-release-monitor.yml

# View run details
gh run view <run-id>

# Watch workflow execution
gh run watch
```

---

## Troubleshooting

### Common Issues

**Workflow not triggering:**
- Check branch filters in `on:` section
- Verify path filters if specified
- Check if workflow is disabled

**Permission denied:**
- Review `permissions:` block
- Check repository settings
- Verify GitHub token has required scopes

**Action version conflicts:**
- Pin to specific action versions
- Review breaking changes in action updates
- Test in isolated branch

**Timeout errors:**
- Increase job/step timeout
- Optimize long-running operations
- Split into smaller jobs

---

## Related Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [VibeCode Deployment Guide](../../docs/deployment.md)

---

## Contributing

When adding new workflows:

1. Create workflow in feature branch
2. Test with `workflow_dispatch` trigger
3. Add documentation to this README
4. Include inline comments in workflow file
5. Update related documentation
6. Submit PR with workflow description

---

*Last Updated: 2025-10-01*
*Maintained by: VibeCode DevOps Team*
