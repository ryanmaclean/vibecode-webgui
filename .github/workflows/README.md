# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the VibeCode WebGUI project.

## Changelog Generation

The `changelog.yml` workflow automates changelog generation using git-cliff:

### Automatic Triggers
- **On Release**: Automatically generates and updates changelog when a new release is created
- **Manual Dispatch**: Can be triggered manually via GitHub Actions UI

### Features
- Parses conventional commits to generate structured changelog
- Categorizes changes: Features, Bug Fixes, Performance, Security, Breaking Changes
- Automatically detects version increments based on commit types
- Updates CHANGELOG.md and release notes
- Creates PR if direct push to main fails

### Usage

**Automatic (Recommended):**
```bash
# Create and push tag
git tag v1.2.0
git push origin v1.2.0

# Create release
gh release create v1.2.0 --generate-notes
```

**Manual Trigger:**
1. Go to Actions → Changelog Generation
2. Click "Run workflow"
3. Configure options as needed

**Local Generation:**
```bash
./scripts/generate-changelog.sh --preview
```

For detailed information, see [docs/CHANGELOG_GUIDE.md](../../docs/CHANGELOG_GUIDE.md)

## Other Workflows

See individual workflow files for documentation on:
- CI/CD pipelines
- Deployment automation
- Testing and validation
- Documentation generation
