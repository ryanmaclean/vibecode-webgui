# Changelog Generation and Maintenance Workflow

## Overview

This document defines the changelog generation and maintenance workflow for the vibecode-webgui project. The workflow follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format and [Semantic Versioning](https://semver.org/spec/v2.0.0.html) principles.

## Table of Contents

- [Changelog Format](#changelog-format)
- [Version Numbering](#version-numbering)
- [Manual Release Process](#manual-release-process)
- [Automated Workflow](#automated-workflow)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Release Checklist](#release-checklist)
- [Example Entries](#example-entries)
- [Future Automation](#future-automation)

## Changelog Format

### Structure

The `CHANGELOG.md` follows the Keep a Changelog format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New features for upcoming release

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security improvements

## [1.2.0] - 2025-10-01

### Added
- Feature description with details

### Fixed
- Bug fix description
```

### Category Guidelines

**Added** - New features, capabilities, or functionality
- New API endpoints
- New UI components
- New integrations or tools
- New configuration options

**Changed** - Changes in existing functionality
- Modified behavior of existing features
- Updated dependencies (major versions)
- Refactored code with user-facing impact
- Performance improvements

**Deprecated** - Features planned for removal
- APIs marked for deprecation
- Configuration options being phased out
- Include migration path and timeline

**Removed** - Features that have been removed
- Deleted APIs or endpoints
- Removed dependencies
- Discontinued features

**Fixed** - Bug fixes and corrections
- Resolved issues
- Corrected behavior
- Fixed security vulnerabilities (non-critical)

**Security** - Security-related changes
- Critical security fixes
- Vulnerability patches
- Security enhancements
- Authentication/authorization improvements

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

### Format: MAJOR.MINOR.PATCH

**MAJOR** (1.x.x) - Increment when:
- Breaking API changes
- Incompatible functionality changes
- Major architectural changes
- Removal of deprecated features

**MINOR** (x.1.x) - Increment when:
- New features added (backward compatible)
- New API endpoints
- Significant enhancements
- Deprecating features

**PATCH** (x.x.1) - Increment when:
- Bug fixes (backward compatible)
- Security patches
- Documentation updates
- Minor improvements

### Pre-release Versions

Format: `1.2.0-alpha.1`, `1.2.0-beta.2`, `1.2.0-rc.1`

- **alpha**: Early development, unstable
- **beta**: Feature complete, testing phase
- **rc**: Release candidate, final testing

### Version Examples

```
1.0.0   → Initial stable release
1.1.0   → Added new workspace features
1.1.1   → Fixed Monaco editor bug
1.2.0   → Added AI completion support
2.0.0   → Breaking API changes, new auth system
```

## Manual Release Process

### Step 1: Prepare Release Branch

```bash
# Ensure you're on main with latest changes
git checkout main
git pull origin main

# Create release branch
git checkout -b release/v1.2.0
```

### Step 2: Update Version Numbers

```bash
# Update package.json version
npm version 1.2.0 --no-git-tag-version

# Update other version references
# - README.md
# - docker-compose.yml
# - Helm charts (if applicable)
```

### Step 3: Generate Changelog Entry

Use the helper script to generate changelog entry:

```bash
# Generate changelog for commits since last tag
./scripts/changelog-helper.sh v1.1.0 HEAD

# Or manually review commits
git log v1.1.0..HEAD --pretty=format:"%s (%h)" --no-merges
```

### Step 4: Update CHANGELOG.md

1. Copy generated content from script output
2. Open `CHANGELOG.md`
3. Add new release section above previous releases
4. Move items from `[Unreleased]` to the new version section
5. Update date: `## [1.2.0] - 2025-10-01`
6. Review and refine descriptions for clarity
7. Ensure proper categorization

### Step 5: Commit and Tag

```bash
# Commit changelog updates
git add CHANGELOG.md package.json
git commit -m "chore: Prepare release v1.2.0"

# Create annotated tag
git tag -a v1.2.0 -m "Release v1.2.0

Major features:
- Added workspace persistence
- Improved Monaco editor integration
- Enhanced AI completion support

See CHANGELOG.md for full details"

# Push changes and tags
git push origin release/v1.2.0
git push origin v1.2.0
```

### Step 6: Create GitHub Release

```bash
# Using gh CLI
gh release create v1.2.0 \
  --title "Release v1.2.0" \
  --notes-file .github/release-notes/v1.2.0.md \
  --draft

# Or manually through GitHub UI:
# 1. Go to Releases → Draft a new release
# 2. Choose tag: v1.2.0
# 3. Copy changelog content as release notes
# 4. Publish release
```

### Step 7: Merge Release Branch

```bash
# Create PR for release branch
gh pr create \
  --base main \
  --head release/v1.2.0 \
  --title "Release v1.2.0" \
  --body "Prepare release v1.2.0. See CHANGELOG.md for details."

# After approval, merge and delete branch
gh pr merge --merge
git branch -d release/v1.2.0
```

## Automated Workflow

The project includes automated changelog generation via GitHub Actions:

### Workflow File

`.github/workflows/changelog.yml` - Automated changelog generation

### Triggers

1. **On Release**: Automatically triggered when a GitHub Release is published
2. **Manual Dispatch**: Can be manually triggered with custom tags

### Manual Trigger

```bash
# Trigger workflow manually
gh workflow run changelog.yml \
  -f tag=v1.2.0 \
  -f previous_tag=v1.1.0
```

### What It Does

1. Detects current and previous tags
2. Extracts commits between tags
3. Categorizes commits by conventional commit type
4. Generates structured changelog entry
5. Updates `CHANGELOG.md` with new entry
6. Commits changes back to main branch
7. Provides summary with statistics

### Supported Commit Types

The automated workflow recognizes these conventional commit types:

| Type | Changelog Section | Example |
|------|------------------|---------|
| `feat` | Added | `feat: add workspace persistence` |
| `fix` | Fixed | `fix: resolve Monaco editor memory leak` |
| `security` | Security | `security: patch XSS vulnerability` |
| `perf` | Performance | `perf: optimize vector search queries` |
| `refactor` | Changed | `refactor: simplify auth middleware` |
| `docs` | Documentation | `docs: update API documentation` |
| `test` | Tests | `test: add E2E tests for chat` |
| `ci` | CI/CD | `ci: update GitHub Actions workflow` |
| `workflow` | Workflow | `workflow: improve deployment process` |
| `chore` | Maintenance | `chore: update dependencies` |
| `style` | Style | `style: format code with prettier` |
| `deprecate` | Deprecated | `deprecate: mark legacy API for removal` |

## Commit Message Guidelines

### Conventional Commit Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Examples

**Good commits:**
```
feat(workspace): add session persistence
fix(editor): resolve Monaco memory leak
security(auth): patch JWT validation vulnerability
docs(api): update REST API documentation
perf(search): optimize vector database queries
```

**Bad commits:**
```
update stuff              # Too vague
fix bug                   # No context
WIP                      # Not descriptive
Fixed the thing          # No type prefix
```

### Commit Guidelines

1. **Use lowercase** for type and description
2. **Use imperative mood** ("add" not "added" or "adds")
3. **Be specific** about what changed
4. **Include scope** when applicable (component, feature, module)
5. **Keep first line under 72 characters**
6. **Add body** for complex changes
7. **Reference issues** in footer: `Fixes #123`

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in footer or use `!` after type:

```
feat(api)!: change authentication endpoint response format

BREAKING CHANGE: Auth endpoint now returns `{ token, user }` instead of `{ accessToken }`

Migrate by updating client code to use `token` field.
```

## Release Checklist

### Pre-Release Checklist

- [ ] All CI/CD pipelines passing
- [ ] All tests passing locally and in CI
- [ ] Documentation updated
- [ ] Dependencies up to date (security patches)
- [ ] No blocking issues or critical bugs
- [ ] Code review completed for all changes
- [ ] Breaking changes documented and migration guide provided
- [ ] Version number determined (MAJOR.MINOR.PATCH)

### Release Preparation

- [ ] Create release branch: `release/vX.Y.Z`
- [ ] Update version in `package.json`
- [ ] Update version references in documentation
- [ ] Generate changelog entry (automated or manual)
- [ ] Update `CHANGELOG.md` with new version
- [ ] Review changelog for accuracy and clarity
- [ ] Commit version and changelog updates
- [ ] Create annotated git tag: `vX.Y.Z`

### Release Execution

- [ ] Push release branch and tag to remote
- [ ] Create GitHub Release from tag
- [ ] Verify automated workflow execution (if applicable)
- [ ] Verify Docker images built and pushed
- [ ] Verify deployment to staging environment
- [ ] Run smoke tests on staging
- [ ] Create PR to merge release branch to main

### Post-Release

- [ ] Merge release PR to main
- [ ] Deploy to production environment
- [ ] Verify production deployment
- [ ] Monitor error rates and performance metrics
- [ ] Announce release (team, changelog, social media)
- [ ] Close related GitHub issues
- [ ] Update project boards and milestones
- [ ] Archive release notes for future reference

### Rollback Plan

If issues are discovered post-release:

1. **Immediate**: Revert to previous version
   ```bash
   git revert v1.2.0
   git tag v1.2.1
   ```

2. **Create hotfix**: If fix is quick
   ```bash
   git checkout -b hotfix/v1.2.1
   # Apply fix
   git commit -m "fix: resolve critical issue"
   git tag v1.2.1
   ```

3. **Document in changelog**: Add entry for hotfix/rollback

## Example Entries

### Example 1: Feature Release (Minor Version)

```markdown
## [1.2.0] - 2025-10-01

### Added
- **Workspace Persistence**: Sessions now persist across browser restarts
- **AI Code Completion**: Integrated Monaco Pilot for intelligent completions
- **Terminal Multiplexing**: Support for multiple terminal sessions per workspace
- **Dark Mode**: User-selectable theme with system preference detection

### Changed
- **Editor Performance**: Improved Monaco editor startup time by 40%
- **API Response Format**: Standardized error responses across all endpoints
- **Docker Image**: Reduced image size from 1.2GB to 800MB

### Fixed
- **Memory Leak**: Resolved Monaco editor memory leak on workspace switch
- **Authentication**: Fixed token refresh race condition
- **File Upload**: Corrected max file size validation

### Security
- **XSS Protection**: Added Content Security Policy headers
- **Dependency Updates**: Updated all dependencies with known vulnerabilities
```

### Example 2: Bug Fix Release (Patch Version)

```markdown
## [1.1.1] - 2025-09-28

### Fixed
- **Monaco Editor**: Resolved syntax highlighting issue for TypeScript files
- **Terminal**: Fixed copy/paste functionality in terminal component
- **Workspace**: Corrected workspace deletion confirmation dialog

### Security
- **JWT Validation**: Patched JWT token validation vulnerability (CVE-2024-XXXX)
```

### Example 3: Breaking Change Release (Major Version)

```markdown
## [2.0.0] - 2025-11-15

### Added
- **Multi-user Workspaces**: Real-time collaboration with conflict resolution
- **Plugin System**: Extensible architecture for custom integrations
- **Advanced Search**: Full-text search across all workspace files

### Changed
- **BREAKING**: Authentication now requires OAuth 2.0 (removed basic auth)
- **BREAKING**: API endpoints now versioned under `/api/v2/`
- **BREAKING**: Workspace structure changed (automatic migration on first login)
- **Database**: Migrated from SQLite to PostgreSQL for better concurrency

### Removed
- **BREAKING**: Removed deprecated `/api/v1/workspaces/list` endpoint (use `/api/v2/workspaces`)
- **BREAKING**: Removed basic authentication support

### Deprecated
- `/api/v2/legacy/*` endpoints (will be removed in v3.0.0)

### Migration Guide

**Authentication Migration:**
1. Update client to use OAuth 2.0 flow
2. Obtain client credentials from admin panel
3. Update API calls to include Bearer token

**API Version Migration:**
1. Update all API calls from `/api/v1/` to `/api/v2/`
2. Review API documentation for response format changes
3. Test integration thoroughly before deploying

**Workspace Migration:**
Automatic - workspaces will be migrated on first v2.0.0 login
```

### Example 4: Pre-release Version

```markdown
## [1.3.0-beta.1] - 2025-10-10

### Added (Beta)
- **Experimental**: Live collaboration features (may have bugs)
- **Preview**: New terminal emulator (feedback requested)

### Known Issues
- Collaboration cursor position may lag on slow connections
- Terminal scrollback limited to 1000 lines

### Breaking Changes (Beta)
- WebSocket protocol updated (incompatible with v1.2.x clients)

**Note**: This is a beta release. Not recommended for production use.
```

## Future Automation

### Planned Improvements

1. **Conventional Commits Enforcement**
   - Add commitlint pre-commit hook
   - Configure commit message validation
   - Reject non-conventional commits

2. **Automated Release Management**
   - Implement release-please or semantic-release
   - Automatic version bumping based on commits
   - Automatic changelog generation on merge to main
   - Automatic GitHub Release creation

3. **PR Changelog Preview**
   - Bot comments on PRs with changelog impact
   - Preview of changelog entry before merge
   - Validation of commit message format

4. **Release Notes Generation**
   - Automated release notes from changelog
   - Contributor recognition
   - Statistics (commits, contributors, files changed)

5. **Multi-track Releases**
   - Support for LTS and current release tracks
   - Backport management for security fixes
   - Automatic changelog updates for all tracks

### Implementation Roadmap

**Phase 1**: Manual Process with Helper Script (Current)
- ✅ Keep a Changelog format
- ✅ Manual changelog updates
- ✅ Helper script for entry generation
- ✅ Automated workflow on release

**Phase 2**: Commit Message Validation (Next)
- [ ] Install commitlint and husky
- [ ] Configure conventional commit rules
- [ ] Add pre-commit hook
- [ ] Update contributing guidelines

**Phase 3**: Automated Changelog on PR
- [ ] Install changelog generation tool
- [ ] Configure GitHub Action for PRs
- [ ] Add changelog preview bot
- [ ] Validate commit messages in CI

**Phase 4**: Full Release Automation
- [ ] Implement release-please
- [ ] Automatic version bumping
- [ ] Automatic changelog generation
- [ ] Automatic GitHub Release creation
- [ ] Automatic npm package publishing

### Tools Consideration

**Commitlint**: Enforce conventional commit messages
- Pros: Lightweight, flexible, well-maintained
- Cons: Requires developer discipline

**Conventional Changelog**: Generate changelog from commits
- Pros: Works with existing commits, flexible
- Cons: Requires good commit messages

**Release Please**: Google's automated release management
- Pros: Fully automated, handles versioning and changelog
- Cons: Opinionated workflow, learning curve

**Semantic Release**: Automated versioning and changelog
- Pros: Popular, plugin ecosystem, flexible
- Cons: Complex configuration, npm-focused

### Recommendation

Start with **commitlint + conventional-changelog**, then migrate to **release-please** for full automation once the team is comfortable with conventional commits.

## Additional Resources

- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Commitlint Documentation](https://commitlint.js.org/)
- [Release Please Documentation](https://github.com/googleapis/release-please)

## Troubleshooting

### Common Issues

**Issue**: Changelog workflow fails to detect previous tag
```bash
# Solution: Manually specify previous tag
gh workflow run changelog.yml -f tag=v1.2.0 -f previous_tag=v1.1.0
```

**Issue**: Commits not categorized correctly
```bash
# Solution: Ensure commits follow conventional format
# Bad: "added new feature"
# Good: "feat: add workspace persistence"
```

**Issue**: Changelog entry duplicated
```bash
# Solution: Check CHANGELOG.md format
# Ensure [Unreleased] section exists
# Ensure proper version section formatting
```

## Support

For questions or issues with the changelog workflow:

1. Check existing documentation in `docs/workflows/`
2. Review GitHub Actions workflow logs
3. Open an issue with label `documentation` or `ci-cd`
4. Contact the DevOps team

---

**Last Updated**: 2025-10-01
**Maintained By**: DevOps Team
**Related Issues**: #437
