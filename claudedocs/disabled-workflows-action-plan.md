# Disabled Workflows Action Plan
**Quick Reference Guide**

## TL;DR
- **37 workflows** analyzed in `disabled-expensive/` directory
- **26 workflows (70%)** → Remove permanently
- **6 workflows (16%)** → Re-enable with 50-65% cost optimization
- **5 workflows (14%)** → Consolidate logic then remove
- **Expected Savings:** $107-119/month (71-79% reduction)

---

## Immediate Actions (This Week)

### 1. Remove Duplicates (11 workflows)
```bash
cd /Users/ryan.maclean/vibecode-webgui/.github/workflows/disabled-expensive

# CI/CD duplicates (active ci-simplified.yml exists)
rm ci.yml ci-cd.yml ci-complex.yml ci-enhancements.yml

# Build duplicates (active build workflows exist)
rm working-ci.yml test-simple.yml test-ci-simplified.yml build-and-push-image.yml

# Deployment duplicates (active azure-appservice-deploy.yml exists)
rm azure-appservice-deploy.yml

# Documentation duplicates (integrated into main CI)
rm docs-ci-cd.yml docs-automation.yml
```

### 2. Remove Low-Value Workflows (15 workflows)
```bash
# Meta-workflows without value
rm cost-monitor.yml stale.yml standup-report.yml claude.yml claude-code-review.yml

# Redundant deployments
rm azure-webgui-deploy.yml k8s-deploy.yml production-deployment.yml gitops-deployment.yml

# Security variants (consolidated in main CI)
rm secret-scanning.yml trufflehog-on-demand.yml ethicalcheck.yml

# Performance variants (not currently used)
rm kind-testing.yml synthetic-test.yml performance-gates.yml
```

**Commit:**
```bash
git commit -m "chore: remove 26 disabled workflows with duplicates or low value

- Remove 11 CI/CD duplicates (active ci-simplified.yml covers needs)
- Remove 15 low-value workflows superseded by current strategy
- Maintains $85-110/month cost avoidance
- See claudedocs/disabled-workflows-cost-benefit-analysis.md for details"
```

---

## Strategic Re-Enablement (Next 2-4 Weeks)

### Priority 1: Infrastructure & Monitoring

#### Infrastructure Tests
```bash
# Location: .github/workflows/disabled-expensive/infrastructure-tests.yml
# Value: Validates Terraform/OpenTofu IaC
# Cost: $12-15/month → Optimized: $4-6/month
# Action: Apply path filters + weekly schedule
```

**Optimization:**
```yaml
on:
  push:
    branches: [main]
    paths: ['tofu/**', 'scripts/deploy-aks.py']
  pull_request:
    paths: ['tofu/**', 'scripts/deploy-aks.py']
  schedule:
    - cron: '0 9 * * MON'  # Weekly
  workflow_dispatch:
```

#### Database Monitoring
```bash
# Location: .github/workflows/disabled-expensive/db-monitoring-deployment.yml
# Value: PostgreSQL + pgvector monitoring with Datadog DBM
# Cost: $20-25/month → Optimized: $8-10/month
# Action: Switch to scheduled + manual dispatch
```

**Optimization:**
```yaml
on:
  workflow_dispatch:
    inputs:
      environment: [development, staging, production]
  schedule:
    - cron: '0 2 * * 1'  # Weekly 2am Monday
  push:
    branches: [main]
    paths: ['monitoring/dashboards/**', 'src/lib/datadog-database.ts']
```

#### Multi-Architecture Builds
```bash
# Location: .github/workflows/disabled-expensive/docker-multiarch.yml
# Value: AMD64 + ARM64 builds (Apple Silicon support)
# Cost: $30-40/month → Optimized: $10-15/month
# Action: Release-only + weekly validation
```

**Optimization:**
```yaml
on:
  push:
    tags: ['v*']  # Only on version tags
  schedule:
    - cron: '0 3 * * 0'  # Weekly Sunday 3am
  workflow_dispatch:

jobs:
  detect-changes:
    # Only build changed Dockerfiles
  build-matrix:
    needs: detect-changes
    # Conditional execution
```

### Priority 2: Validation Workflows

#### Demo Validation
```bash
# Cost: $6-8/month → Optimized: $3-4/month
# Action: Add path filters + reduce frequency
```

#### Error Tracking Integration
```bash
# Cost: $8-10/month → Optimized: $4-5/month
# Action: Deployment-driven + daily validation
```

#### Datadog Service Catalog
```bash
# Cost: $4-5/month → Optimized: $2-3/month
# Action: Path-specific triggers only
```

---

## Consolidation Tasks

### 1. Dependency Compatibility
**Source:** `dependency-compatibility.yml`
**Target:** `ci-simplified.yml`
**Logic to Preserve:** Dependency update testing, compatibility matrix

```yaml
# Add to ci-simplified.yml:
jobs:
  dependency-check:
    if: github.event_name == 'schedule' || contains(github.event.head_commit.message, '[deps]')
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - name: Test dependency compatibility
      - name: Generate compatibility report
```

### 2. DBM Verifier
**Source:** `dbm-verifier-run.yml`
**Target:** `db-monitoring-deployment.yml`
**Logic to Preserve:** Post-deployment verification checks

```yaml
# Add as final job in db-monitoring-deployment.yml:
jobs:
  verify-deployment:
    needs: deploy-monitoring
    runs-on: ubuntu-latest
    steps:
      - name: Run DBM verification
      - name: Validate monitoring integration
```

---

## Implementation Timeline

### Week 1: Immediate Cleanup
- [ ] Remove 11 duplicate workflows
- [ ] Remove 15 low-value workflows
- [ ] Commit changes with detailed message
- [ ] Update documentation

### Week 2: Consolidation
- [ ] Merge dependency-compatibility logic into ci-simplified.yml
- [ ] Merge dbm-verifier logic into db-monitoring-deployment.yml
- [ ] Test consolidated workflows
- [ ] Remove source workflows after validation

### Week 3: Optimize High-Priority Workflows
- [ ] Optimize infrastructure-tests.yml (path filters + schedule)
- [ ] Optimize db-monitoring-deployment.yml (schedule + manual)
- [ ] Test optimizations in feature branch
- [ ] Validate cost reduction

### Week 4: Re-Enable High-Priority
- [ ] Move infrastructure-tests.yml to active workflows
- [ ] Move db-monitoring-deployment.yml to active workflows
- [ ] Monitor execution and costs for 1 week

### Week 5: Optimize and Re-Enable Remaining
- [ ] Optimize docker-multiarch.yml (release + weekly)
- [ ] Optimize demo-validation.yml (path filters)
- [ ] Optimize error-tracking-integration.yml (deployment-driven)
- [ ] Optimize datadog-service-catalog.yml (path-specific)

### Week 6: Final Re-Enablement
- [ ] Move remaining 4 workflows to active
- [ ] Remove disabled-expensive directory
- [ ] Update CHANGELOG.md
- [ ] Document quarterly review process

---

## Quick Commands

### Remove All Low-Value Workflows (One Command)
```bash
cd /Users/ryan.maclean/vibecode-webgui/.github/workflows/disabled-expensive

rm ci.yml ci-cd.yml ci-complex.yml ci-enhancements.yml \
   working-ci.yml test-simple.yml test-ci-simplified.yml \
   build-and-push-image.yml azure-appservice-deploy.yml \
   docs-ci-cd.yml docs-automation.yml \
   cost-monitor.yml stale.yml standup-report.yml \
   claude.yml claude-code-review.yml \
   azure-webgui-deploy.yml k8s-deploy.yml \
   production-deployment.yml gitops-deployment.yml \
   secret-scanning.yml trufflehog-on-demand.yml ethicalcheck.yml \
   kind-testing.yml synthetic-test.yml performance-gates.yml \
   main-branch-ci.yml release-branch-ci.yml

git add -A
git commit -m "chore: remove 26 disabled workflows

Removed:
- 11 duplicates with active replacements
- 15 low-value workflows superseded by current strategy

Cost avoidance: $85-110/month maintained
See: claudedocs/disabled-workflows-cost-benefit-analysis.md"
```

### Move Strategic Workflow to Active (Template)
```bash
WORKFLOW="infrastructure-tests"
mv .github/workflows/disabled-expensive/${WORKFLOW}.yml \
   .github/workflows/${WORKFLOW}.yml

# Edit workflow to apply optimizations
# Test in feature branch
# Merge to main after validation
```

---

## Success Criteria

### Cost Metrics
- [ ] GitHub Actions monthly cost: <$50
- [ ] Re-enabled workflows cost: $31-43/month
- [ ] Total savings: $107-119/month (71-79% reduction)

### Quality Metrics
- [ ] Infrastructure test pass rate: >90%
- [ ] Multi-arch build success: >95%
- [ ] Monitoring coverage: 100% of critical paths

### Process Metrics
- [ ] All duplicates removed: 11/11
- [ ] All low-value removed: 15/15
- [ ] Strategic re-enabled with optimization: 6/6
- [ ] Workflows consolidated: 5/5
- [ ] Quarterly review process documented

---

## Risk Mitigation

### Before Removing Workflows
- ✅ Verify active replacement exists
- ✅ Check git history for recent usage
- ✅ Validate no unique functionality lost

### Before Re-Enabling Workflows
- ✅ Apply cost optimizations
- ✅ Test in feature branch
- ✅ Monitor first week of execution
- ✅ Validate cost within budget

### If Issues Arise
1. **Workflow breaks after removal:** Restore from git history
2. **Cost exceeds budget:** Increase optimization (longer schedules)
3. **Quality regression:** Temporarily re-enable validation
4. **Missing functionality:** Extract from git history and consolidate

---

## Quarterly Review Checklist

**Schedule:** Last week of each quarter

### Review Actions
- [ ] Download GitHub Actions usage report
- [ ] Calculate actual monthly costs
- [ ] Compare to budget ($31-43/month target)
- [ ] Review workflow execution logs
- [ ] Identify optimization opportunities
- [ ] Update workflow documentation
- [ ] Adjust schedules based on actual needs

### Review Template
```markdown
## Q[X] 2025 Workflow Cost Review

**Execution Summary:**
- Infrastructure Tests: X runs, Y% success, $Z cost
- DB Monitoring: X runs, Y% success, $Z cost
- Multi-Arch Builds: X runs, Y% success, $Z cost
- Demo Validation: X runs, Y% success, $Z cost
- Error Tracking: X runs, Y% success, $Z cost
- Datadog Catalog: X runs, Y% success, $Z cost

**Cost Analysis:**
- Target: $31-43/month
- Actual: $XX/month
- Variance: YY%

**Recommendations:**
- [List adjustments]
```

---

## Contact and Escalation

### Questions About Specific Workflows
- Review full analysis: `claudedocs/disabled-workflows-cost-benefit-analysis.md`
- Check git history: `git log --follow -- .github/workflows/disabled-expensive/[workflow].yml`
- Review active workflows: `ls -la .github/workflows/`

### Cost Concerns
- Monitor GitHub Actions dashboard
- Set budget alerts at $50/month threshold
- Escalate if costs exceed $60/month

### Quality Concerns
- Review workflow execution logs
- Check for degraded test coverage
- Validate critical path monitoring

---

## Additional Resources

### Documentation
- Full analysis report: `claudedocs/disabled-workflows-cost-benefit-analysis.md`
- GitHub Actions pricing: https://docs.github.com/en/billing/managing-billing-for-github-actions
- Workflow optimization guide: https://docs.github.com/en/actions/using-workflows/best-practices-for-actions

### Related Files
- Active workflows: `.github/workflows/*.yml`
- CI configuration: `package.json` (scripts)
- Infrastructure code: `tofu/` directory

---

**Last Updated:** 2025-10-02
**Next Review:** End of Q4 2025
