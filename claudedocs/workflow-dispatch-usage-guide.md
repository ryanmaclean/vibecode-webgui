# GitHub Actions Manual Workflow Trigger Guide

## Overview

This guide explains how to manually trigger GitHub Actions workflows using workflow_dispatch for the VibeCode WebGUI project.

## Prerequisites

- GitHub account with write access to the repository
- GitHub CLI (gh) installed for command-line triggers
- Access to GitHub Actions tab in the repository

## Available Workflows with Manual Triggers

### Infrastructure & Deployment

1. **infrastructure-tests.yml** - Run infrastructure validation tests
   - Inputs: environment (dev/staging), cleanup (boolean)

2. **azure-appservice-deploy.yml** - Deploy AI Gateway to Azure
   - Inputs: image_tag (string, optional)

3. **azure-webgui-deploy.yml** - Deploy WebGUI to Azure
   - Inputs: image_tag (string, optional)

4. **deploy-aks-monitoring.yml** - Deploy AKS monitoring stack
   - Inputs: environment (choice), cleanup (boolean)

5. **gitops-deployment.yml** - GitOps deployment pipeline
   - Inputs: environment (staging/production), force_deploy (boolean)

### Build & Release

6. **rebuild-codeserver.yml** - Rebuild code-server multi-arch images
   - Inputs: enable_nightly (boolean), skip_tests (boolean), update_docs (boolean)

7. **build-and-push-image.yml** - Build and push container image
   - Inputs: force_build (boolean)

8. **build-agentapi.yml** - Build AgentAPI multi-arch images
   - Inputs: push_to_registry (boolean), run_smoke_tests (boolean)

9. **codeserver-multiarch.yml** - Build code-server multi-profile images
   - Inputs: promote_canary (boolean), promote_latest (boolean)

10. **helm-package.yaml** - Package Helm charts
    - Inputs: chart_version (string), app_version (string)

### Testing & Quality

11. **test-amd64-ai.yml** - Run AMD64 AI profile tests
    - No inputs required

12. **test-arm64-full.yml** - Run ARM64 full profile tests
    - No inputs required

13. **test-coverage.yml** - Generate test coverage reports
    - Inputs: upload_codecov (boolean)

14. **dependency-compatibility.yml** - Check dependency compatibility
    - Inputs: check_type (choice: all/security/updates)

### Monitoring & Reporting

15. **standup-report.yml** - Generate daily standup report
    - Inputs: create_issue (boolean), post_to_slack (boolean)

16. **cost-monitor.yml** - Monitor GitHub Actions costs
    - No inputs required

17. **datadog-trace-verify.yml** - Verify Datadog trace collection
    - Inputs: environment (choice), trace_count (number)

### Documentation

18. **docs-ci-cd.yml** - Build and deploy documentation
    - Inputs: deploy_to_production (boolean)

19. **deploy-next-docs.yml** - Deploy Next.js documentation site
    - Inputs: environment (choice)

## How to Trigger Workflows

### Method 1: GitHub Web UI

1. Navigate to your repository on GitHub
2. Click the "Actions" tab
3. Select the workflow from the left sidebar
4. Click the "Run workflow" button (top right)
5. Select the branch (usually `main`)
6. Fill in any required/optional input parameters
7. Click "Run workflow"

**Visual Steps:**
```
Repository → Actions Tab → Select Workflow → Run workflow ▼ → Fill inputs → Run workflow
```

### Method 2: GitHub CLI (Recommended for Automation)

#### Installation
```bash
# macOS
brew install gh

# Linux
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list
sudo apt update && sudo apt install gh

# Windows
winget install --id GitHub.cli
```

#### Authentication
```bash
gh auth login
# Follow prompts to authenticate
```

#### List Available Workflows
```bash
gh workflow list

# Filter active workflows
gh workflow list --all | grep active
```

#### View Workflow Details
```bash
# View workflow configuration
gh workflow view rebuild-codeserver.yml

# View workflow with YAML
gh workflow view rebuild-codeserver.yml --yaml

# View recent runs
gh workflow view rebuild-codeserver.yml --runs
```

#### Trigger Workflow
```bash
# Basic trigger (no inputs)
gh workflow run cost-monitor.yml

# Trigger with inputs
gh workflow run rebuild-codeserver.yml \
  --ref main \
  -f enable_nightly=false \
  -f skip_tests=false \
  -f update_docs=true

# Trigger on different branch
gh workflow run infrastructure-tests.yml \
  --ref feature/my-branch \
  -f environment=dev \
  -f cleanup=true
```

#### Monitor Workflow Run
```bash
# List recent runs
gh run list --workflow=rebuild-codeserver.yml --limit 5

# Watch workflow run in real-time
gh run watch

# View specific run
gh run view <run-id>

# View run logs
gh run view <run-id> --log
```

## Common Workflow Trigger Examples

### Infrastructure Testing
```bash
# Run dev environment tests
gh workflow run infrastructure-tests.yml \
  -f environment=dev \
  -f cleanup=true

# Run staging environment tests without cleanup
gh workflow run infrastructure-tests.yml \
  -f environment=staging \
  -f cleanup=false
```

### Code-Server Rebuild
```bash
# Full rebuild with all options
gh workflow run rebuild-codeserver.yml \
  -f enable_nightly=false \
  -f skip_tests=false \
  -f update_docs=true

# Quick rebuild without docs update
gh workflow run rebuild-codeserver.yml \
  -f skip_tests=true \
  -f update_docs=false
```

### Deployment
```bash
# Deploy AI Gateway with specific tag
gh workflow run azure-appservice-deploy.yml \
  -f image_tag=v1.2.3

# Deploy to staging with GitOps
gh workflow run gitops-deployment.yml \
  -f environment=staging \
  -f force_deploy=false

# Force deploy to production
gh workflow run gitops-deployment.yml \
  -f environment=production \
  -f force_deploy=true
```

### Testing
```bash
# Run test coverage with Codecov upload
gh workflow run test-coverage.yml \
  -f upload_codecov=true

# Run dependency compatibility checks
gh workflow run dependency-compatibility.yml \
  -f check_type=security
```

### Monitoring & Reporting
```bash
# Generate standup report
gh workflow run standup-report.yml \
  -f create_issue=true \
  -f post_to_slack=false

# Verify Datadog traces
gh workflow run datadog-trace-verify.yml \
  -f environment=production \
  -f trace_count=100
```

## Troubleshooting

### Issue: Workflow not listed
**Solution:**
- Ensure workflow file is on the default branch (main)
- Check workflow has `workflow_dispatch:` in the `on:` block
- Verify YAML syntax is correct

**Validation:**
```bash
# Check workflow exists
gh workflow view <workflow-name>

# Validate YAML locally
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/<workflow>.yml'))"
```

### Issue: CLI command fails
**Error:** `could not find workflow`

**Solutions:**
1. Use exact workflow filename: `rebuild-codeserver.yml` (not just `rebuild-codeserver`)
2. Ensure authenticated: `gh auth status`
3. Check repository context: `gh repo view`

### Issue: Inputs not working
**Error:** `invalid input value`

**Solutions:**
1. Check input type matches (boolean, string, choice)
2. For boolean: use `true`/`false` (lowercase)
3. For choice: use exact option value from workflow definition

### Issue: Permission denied
**Error:** `Resource not accessible by personal access token`

**Solutions:**
1. Check repository permissions: need write access
2. Re-authenticate: `gh auth refresh -h github.com -s write:packages,workflow`
3. Verify token has `workflow` scope

## Advanced Usage

### Scripted Workflows
```bash
#!/bin/bash
# deploy-all.sh - Deploy to all environments

environments=("dev" "staging" "production")

for env in "${environments[@]}"; do
  echo "Deploying to $env..."
  gh workflow run gitops-deployment.yml \
    -f environment=$env \
    -f force_deploy=false
  
  # Wait for completion
  sleep 10
  
  # Check status
  run_id=$(gh run list --workflow=gitops-deployment.yml --limit 1 --json databaseId -q '.[0].databaseId')
  gh run watch $run_id
done
```

### CI/CD Integration
```yaml
# .github/workflows/trigger-downstream.yml
name: Trigger Downstream Workflows

on:
  push:
    branches: [main]

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger infrastructure tests
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            await github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'infrastructure-tests.yml',
              ref: 'main',
              inputs: {
                environment: 'staging',
                cleanup: 'true'
              }
            });
```

### Monitoring Workflow Status
```bash
#!/bin/bash
# monitor-workflow.sh - Monitor workflow run status

workflow_name="$1"
max_wait=300  # 5 minutes
interval=10

# Trigger workflow
gh workflow run "$workflow_name"
sleep 5

# Get latest run
run_id=$(gh run list --workflow="$workflow_name" --limit 1 --json databaseId -q '.[0].databaseId')

echo "Monitoring run: $run_id"

elapsed=0
while [ $elapsed -lt $max_wait ]; do
  status=$(gh run view $run_id --json status -q '.status')
  conclusion=$(gh run view $run_id --json conclusion -q '.conclusion')
  
  echo "Status: $status | Conclusion: $conclusion"
  
  if [ "$status" = "completed" ]; then
    if [ "$conclusion" = "success" ]; then
      echo "✅ Workflow succeeded"
      exit 0
    else
      echo "❌ Workflow failed: $conclusion"
      exit 1
    fi
  fi
  
  sleep $interval
  elapsed=$((elapsed + interval))
done

echo "⏱️ Timeout waiting for workflow"
exit 2
```

## Best Practices

1. **Always specify branch**: Use `--ref main` to ensure consistency
2. **Validate inputs**: Check workflow definition for required inputs
3. **Monitor runs**: Use `gh run watch` for real-time feedback
4. **Document triggers**: Keep track of manual triggers in runbooks
5. **Automate common patterns**: Create scripts for frequent workflows
6. **Test in dev first**: Always test in development before production
7. **Check permissions**: Ensure proper workflow and secret access
8. **Use meaningful inputs**: Provide clear descriptions for workflow inputs

## Security Considerations

1. **Secrets**: Never pass secrets as workflow inputs (use repository secrets)
2. **Permissions**: Limit workflow permissions to minimum required
3. **Branch protection**: Protect main branch from accidental dispatches
4. **Audit logs**: Review Actions audit logs regularly
5. **Environment protection**: Use environment protection rules for production

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [workflow_dispatch Event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [VibeCode CI/CD Architecture](./ci-pipeline-architecture-fix.md)

---

**Last Updated**: 2025-10-02  
**Maintained By**: DevOps Team  
**Questions**: Create issue with label `ci/cd`
