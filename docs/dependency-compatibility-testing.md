# Dependency Compatibility Testing

This document describes the comprehensive dependency compatibility testing system implemented in VibeCode WebGUI.

## Overview

The dependency compatibility testing system helps maintain a stable and secure dependency ecosystem by:

- **Preventing dependency conflicts** before they reach production
- **Detecting security vulnerabilities** in dependencies
- **Identifying outdated packages** that need updates
- **Validating peer dependencies** are properly satisfied
- **Finding phantom dependencies** (used but not declared)
- **Ensuring TypeScript compatibility** across updates
- **Automating dependency update workflows**

## Components

### 1. GitHub Actions Workflow (`.github/workflows/dependency-compatibility.yml`)

**Triggers:**
- Pull requests modifying `package.json` or `package-lock.json`
- Pushes to main branch with dependency changes
- Weekly scheduled runs (Sundays at 2 AM UTC)
- Manual workflow dispatch

**Features:**
- Multi-Node.js version testing (18.x, 20.x, 22.x)
- Comprehensive dependency validation
- Security vulnerability scanning
- Automated issue creation for available updates
- Artifact uploads for debugging

### 2. Local Compatibility Checker (`scripts/check-dependency-compatibility.js`)

A comprehensive Node.js script that performs all compatibility checks locally.

**Usage:**
```bash
# Full compatibility check (includes phantom dependency detection)
npm run deps:check

# CI-friendly check (skips phantom dependency detection)
npm run deps:check:ci

# Direct script execution with options
node scripts/check-dependency-compatibility.js [--skip-phantom] [--no-exit]
```

**Checks Performed:**
- ✅ Dependency conflict detection
- 🔒 Security vulnerability scanning
- 📦 Outdated dependency identification
- 🔗 Peer dependency validation
- 👻 Phantom dependency detection (optional)
- 📝 TypeScript compatibility
- 🔒 Package-lock.json integrity

### 3. Pre-commit Hook (`.husky/pre-commit-deps`)

Automatically runs dependency compatibility checks when `package.json` or `package-lock.json` are modified in a commit.

### 4. NPM Scripts

```json
{
  "deps:check": "Full dependency compatibility check",
  "deps:check:ci": "CI-friendly check (no phantom detection)",
  "deps:audit": "Security vulnerability audit",
  "deps:update:check": "Check for outdated dependencies",
  "deps:update:patch": "Update patch versions and install",
  "deps:update:minor": "Update minor versions and install"
}
```

## Workflow Examples

### Adding New Dependencies

1. **Add dependency**: `npm install new-package`
2. **Pre-commit check**: Automatic validation on commit
3. **PR validation**: GitHub Actions runs full compatibility suite
4. **Merge**: Dependency changes are validated across multiple Node.js versions

### Weekly Maintenance

1. **Scheduled run**: Every Sunday, check for outdated dependencies
2. **Issue creation**: Automated GitHub issue with update recommendations
3. **Categorized updates**:
   - 🟢 **Patch updates**: Safe to apply immediately
   - 🟡 **Minor updates**: Review changelog, test thoroughly
   - 🔴 **Major updates**: Requires careful review and testing

### Resolving Issues

#### Dependency Conflicts
```bash
npm run deps:check
# Review conflicts in dependency-compatibility-report.json
npm ls --depth=0  # See conflict details
```

#### Security Vulnerabilities
```bash
npm audit
npm audit fix  # Apply automatic fixes
npm audit fix --force  # Apply breaking change fixes (use cautiously)
```

#### Outdated Dependencies
```bash
npm run deps:update:check  # See available updates
npm run deps:update:patch  # Safe patch updates
npm run deps:update:minor  # Minor updates (test required)
```

#### Phantom Dependencies
```bash
npm run deps:check  # Full check including phantom detection
# Review build errors to identify undeclared dependencies
npm install missing-package  # Add missing dependencies
```

## Configuration

### Customizing the Workflow

Edit `.github/workflows/dependency-compatibility.yml`:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # Modify Node.js versions
    
schedule:
  - cron: '0 2 * * 0'  # Change schedule (currently Sunday 2 AM)
```

### Adjusting Security Levels

```bash
# Change audit level in package.json scripts
"deps:audit": "npm audit --audit-level=high"  # More strict
"deps:audit": "npm audit --audit-level=low"   # Less strict
```

### Skipping Checks

```bash
# Skip phantom dependency detection (faster, less thorough)
npm run deps:check:ci

# Skip specific checks in CI by modifying the script
node scripts/check-dependency-compatibility.js --skip-phantom --no-exit
```

## Integration with Development Workflow

### Local Development
```bash
# Before starting work
npm run deps:check

# After adding dependencies
git add package*.json
git commit -m "feat: add new dependency"
# Pre-commit hook runs automatically
```

### CI/CD Pipeline
```bash
# In your CI scripts, add:
npm run deps:check:ci
npm run build  # Ensure compatibility doesn't break builds
npm test       # Run tests with new dependencies
```

### Monitoring
- **Weekly issues**: Automated dependency update notifications
- **PR checks**: Automatic validation on dependency changes
- **Security alerts**: Immediate notification of vulnerabilities
- **Reports**: Detailed JSON reports for debugging

## Troubleshooting

### Common Issues

**Build failures after dependency updates:**
```bash
# Check for phantom dependencies
npm run deps:check
# Review the generated report
cat dependency-compatibility-report.json
```

**Peer dependency warnings:**
```bash
npm ls --depth=1 | grep -E "(UNMET|missing)"
# Install missing peer dependencies
npm install missing-peer-dep
```

**TypeScript errors after updates:**
```bash
npm run type-check
# Update @types packages if needed
npm install --save-dev @types/updated-package
```

### Performance Optimization

**Faster local checks:**
```bash
# Skip phantom dependency detection (resource intensive)
npm run deps:check:ci
```

**Selective updates:**
```bash
# Update only specific packages
npx npm-check-updates --filter "package-name" -u
npm install
```

## Best Practices

### Dependency Management
1. **Regular updates**: Run weekly dependency checks
2. **Staged updates**: Apply patch → minor → major updates separately
3. **Test thoroughly**: Always test after dependency updates
4. **Security first**: Address security vulnerabilities immediately
5. **Document changes**: Include dependency rationale in commit messages

### CI/CD Integration
1. **Fail fast**: Dependency issues should fail builds early
2. **Cache wisely**: Use npm cache for faster CI runs
3. **Parallel testing**: Test multiple Node.js versions simultaneously
4. **Artifact storage**: Keep dependency reports for debugging

### Team Collaboration
1. **Automated issues**: Let the system notify about updates
2. **Review process**: Require review for major dependency changes
3. **Documentation**: Keep dependency decisions documented
4. **Training**: Ensure team understands the compatibility system

## Metrics and Reporting

The system generates detailed reports including:

- **Conflict count**: Number of dependency conflicts
- **Security status**: Vulnerability summary
- **Update availability**: Outdated package count
- **Compatibility score**: Overall health metrics
- **Performance impact**: Check execution times

Reports are saved as `dependency-compatibility-report.json` and uploaded as GitHub Actions artifacts.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run deps:check` | Full compatibility check |
| `npm run deps:check:ci` | CI-friendly check |
| `npm run deps:audit` | Security audit |
| `npm run deps:update:check` | Check for updates |
| `npm run deps:update:patch` | Apply patch updates |
| `npm run deps:update:minor` | Apply minor updates |

For more information, see the generated reports and GitHub Actions logs.
