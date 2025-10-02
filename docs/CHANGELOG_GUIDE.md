# Changelog Generation Guide

This guide explains how to generate and maintain the project changelog using automated tools and conventional commits.

## Table of Contents

- [Overview](#overview)
- [Conventional Commits](#conventional-commits)
- [Automated Generation](#automated-generation)
- [Manual Generation](#manual-generation)
- [Versioning Strategy](#versioning-strategy)
- [Best Practices](#best-practices)

## Overview

This project uses [git-cliff](https://git-cliff.org/) to automatically generate changelogs from conventional commit messages. Changelogs follow the [Keep a Changelog](https://keepachangelog.com/) format and the project follows [Semantic Versioning](https://semver.org/).

### Workflow Integration

- **Automated**: Changelog is generated automatically on release creation
- **Manual**: Use `scripts/generate-changelog.sh` for manual generation
- **CI/CD**: GitHub Actions workflow handles changelog updates

## Conventional Commits

### Format

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Category | Description | Version Impact |
|------|----------|-------------|----------------|
| `feat` | Features | New feature | Minor |
| `fix` | Bug Fixes | Bug fix | Patch |
| `perf` | Performance | Performance improvement | Patch |
| `security` | Security | Security fix | Patch |
| `docs` | Documentation | Documentation changes | None |
| `style` | Styling | Code style changes | None |
| `refactor` | Refactoring | Code refactoring | None |
| `test` | Testing | Test additions/changes | None |
| `build` | Build System | Build system changes | None |
| `ci` | CI/CD | CI/CD changes | None |
| `chore` | Miscellaneous | Other changes | None |
| `revert` | Reverts | Revert previous commit | Depends |

### Breaking Changes

Mark breaking changes with `!` after type or `BREAKING CHANGE:` in footer:

```bash
# Method 1: Exclamation mark
feat!: remove deprecated API endpoints

# Method 2: Footer
feat: update authentication flow

BREAKING CHANGE: JWT tokens now expire after 1 hour instead of 24 hours
```

Breaking changes trigger a **major version** bump.

### Examples

```bash
# Feature with scope
feat(auth): add two-factor authentication support

# Bug fix
fix: resolve race condition in workspace provisioning

# Performance improvement
perf(api): optimize database queries for user dashboard

# Security fix
security: sanitize user input to prevent XSS attacks

# Breaking change
feat(api)!: redesign REST API endpoints

BREAKING CHANGE: All API endpoints now require authentication
Previous /public/* endpoints moved to /api/v2/public/*

# Documentation
docs: update deployment guide with new environment variables

# Refactoring
refactor(database): migrate from MongoDB to PostgreSQL

# Multiple scopes
feat(ui,api): implement real-time collaboration features
```

## Automated Generation

### On Release

Changelog is automatically generated when you create a GitHub release:

1. Create and push a tag:
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```

2. Create release on GitHub:
   ```bash
   gh release create v1.2.0 --generate-notes
   ```

3. Workflow automatically:
   - Generates changelog from commits since last tag
   - Updates `CHANGELOG.md`
   - Updates release notes
   - Commits changes to main branch

### Manual Trigger

Trigger workflow manually via GitHub Actions UI:

1. Go to Actions → Changelog Generation
2. Click "Run workflow"
3. Configure options:
   - **Starting tag**: Leave empty for last tag
   - **Ending tag**: Leave empty for HEAD
   - **Update file**: Check to update CHANGELOG.md

## Manual Generation

### Install git-cliff

**Using Cargo:**
```bash
cargo install git-cliff
```

**Using Homebrew (macOS):**
```bash
brew install git-cliff
```

**Using Binary:**
Download from [git-cliff releases](https://github.com/orhun/git-cliff/releases)

### Generate Changelog

#### Preview Changes

Preview without updating the file:

```bash
./scripts/generate-changelog.sh --preview
```

#### Generate for Specific Range

```bash
# From last tag to HEAD
./scripts/generate-changelog.sh

# From specific tag to HEAD
./scripts/generate-changelog.sh --from v1.0.0

# Between specific tags
./scripts/generate-changelog.sh --from v1.0.0 --to v1.1.0

# With custom version tag
./scripts/generate-changelog.sh --tag v1.2.0

# Custom output file
./scripts/generate-changelog.sh --output RELEASE_NOTES.md
```

#### Full Options

```bash
./scripts/generate-changelog.sh \
  --from v1.0.0 \
  --to v1.1.0 \
  --tag v1.1.0 \
  --output CHANGELOG.md
```

## Versioning Strategy

This project follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

### Version Increments

| Change Type | Version Impact | Example |
|-------------|----------------|---------|
| Breaking changes | Major (X.0.0) | 1.0.0 → 2.0.0 |
| New features | Minor (0.X.0) | 1.0.0 → 1.1.0 |
| Bug fixes | Patch (0.0.X) | 1.0.0 → 1.0.1 |

### Version Detection

The script automatically detects the next version:

1. **Breaking changes** (`feat!:`, `BREAKING CHANGE:`) → Major bump
2. **Features** (`feat:`) → Minor bump
3. **Fixes/others** (`fix:`, `perf:`, etc.) → Patch bump

### Pre-release Versions

For pre-release versions, use:

```bash
git tag v1.2.0-alpha.1
git tag v1.2.0-beta.1
git tag v1.2.0-rc.1
```

## Best Practices

### Commit Message Guidelines

1. **Be concise**: Keep subject line under 72 characters
2. **Use imperative mood**: "add feature" not "added feature"
3. **Provide context**: Explain why, not just what
4. **Reference issues**: Include issue numbers (#123)
5. **Group related changes**: Use the same type for related commits

### Good Examples

```bash
feat(workspace): add GPU support for ML workspaces

Enables users to provision workspaces with GPU acceleration for
machine learning and data science workflows.

Closes #123

---

fix(terminal): prevent command injection vulnerability

Sanitize user input before executing shell commands to prevent
arbitrary code execution.

Fixes #456
Security advisory: GHSA-xxxx-yyyy-zzzz

---

perf(database): optimize user query with indexing

Add composite index on (user_id, created_at) to improve dashboard
load times by 60%.

Benchmark results:
- Before: 1200ms
- After: 480ms
```

### Bad Examples

```bash
# Too vague
fix: bug fix

# Wrong format
Fixed the login page

# Missing scope
feat: added stuff

# No description
chore: updates
```

### Squashing Commits

When squashing commits in PRs, ensure the final commit message follows conventional format:

```bash
# Before squash (multiple commits):
- add authentication logic
- fix typo
- update tests

# After squash:
feat(auth): implement JWT authentication

Added JWT-based authentication with refresh token support
and comprehensive test coverage.

Closes #123
```

## Configuration

### Customizing git-cliff

Edit `cliff.toml` to customize:

- Commit grouping rules
- Changelog format
- Included/excluded commit types
- Tag patterns

Example customization:

```toml
[git]
commit_parsers = [
  { message = "^feat", group = "Features" },
  { message = "^fix", group = "Bug Fixes" },
  # Add custom types
  { message = "^hotfix", group = "Hotfixes" },
]
```

### GitHub Workflow

Edit `.github/workflows/changelog.yml` to customize:

- Trigger conditions
- Branch protection
- Automation behavior

## Troubleshooting

### No commits found

If git-cliff reports no commits:

1. Check commit message format: `git log --oneline`
2. Verify conventional commit format is used
3. Check date range: `git log --since="2024-01-01"`

### Wrong version detected

Override automatic version detection:

```bash
./scripts/generate-changelog.sh --tag v2.0.0
```

### Commits missing from changelog

1. Verify commit follows conventional format
2. Check if commit type is excluded in `cliff.toml`
3. Ensure commit is in the specified range

### Merge conflicts

If CHANGELOG.md has conflicts:

1. Keep both versions
2. Manually merge sections
3. Ensure chronological order (newest first)

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [git-cliff Documentation](https://git-cliff.org/docs/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)

## Contributing

When contributing:

1. Follow conventional commit format
2. Run `./scripts/generate-changelog.sh --preview` to verify your commits
3. Ensure commit messages are clear and descriptive
4. Reference relevant issues

## Support

For questions or issues:

- Check this guide
- Review `cliff.toml` configuration
- Run with `--help` flag
- Create an issue on GitHub
