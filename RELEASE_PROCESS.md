# VibeCode Release Process

This document describes the complete procedure for creating, testing, and maintaining VibeCode releases. It serves as a checklist to prevent accidental data loss and ensure consistent, reproducible releases.

## Table of Contents

1. [Pre-Release Checklist](#pre-release-checklist)
2. [Release Versioning](#release-versioning)
3. [Release Creation Steps](#release-creation-steps)
4. [Asset Types and Build Procedures](#asset-types-and-build-procedures)
5. [Release Notes Template](#release-notes-template)
6. [CI/CD Integration](#cicd-integration)
7. [Release Verification](#release-verification)
8. [Maintenance and Updates](#maintenance-and-updates)
9. [Rollback Procedure](#rollback-procedure)
10. [Lessons Learned](#lessons-learned)

---

## Pre-Release Checklist

**CRITICAL: Complete these checks before creating a tag. A failed check means the release is not ready.**

- [ ] All tests pass: `npm test -- --maxWorkers=2` (OOM guard)
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] Production build succeeds: `npm run build`
- [ ] CLI binaries build successfully: `make cli-all`
- [ ] Docker build passes: `docker build -t vibecode:latest .`
- [ ] Tauri app builds (macOS): `npm run tauri:build` (if desktop release)
- [ ] Verify no uncommitted changes: `git status` (must be clean)
- [ ] Tag name follows versioning scheme (see [Release Versioning](#release-versioning))
- [ ] Release notes are accurate and comprehensive
- [ ] CHANGELOG.md is updated if applicable

### Memory Management

VibeCode background tasks can exit with status 137 (OOM kill). Always use `--maxWorkers=2` flag:

```bash
npm test -- --maxWorkers=2
```

### TypeScript Validation

Critical: If `tsconfig.json` is deleted, `tsc` uses parent directory config and reports incorrect errors. Verify file exists:

```bash
ls -la tsconfig.json
npx tsc --noEmit
```

### Build Cache Issues

Stale `.next` cache can mask real build errors with false `Cannot read properties of null (reading 'hash')`. Clean before diagnosing:

```bash
rm -rf .next
npm run build
```

---

## Release Versioning

VibeCode uses **Semantic Versioning (SemVer)** with the following scheme:

### Version Format: `v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>]`

**Examples:**
- `v4.1.0` - Release (stable)
- `v5.1.0-beta` - Pre-release (beta)
- `v4.0.1` - Patch release (bug fix)

### Versioning Rules

- **MAJOR**: Major features, architecture changes, or significant rewrites
- **MINOR**: New features, enhancements, non-breaking changes
- **PATCH**: Bug fixes, security patches, minor improvements
- **Pre-release**: Append `-beta`, `-alpha`, `-rc` (release candidate) for pre-releases

### Special Tags (Historical)

Some releases use descriptive tags for clarity:
- `v3.3.0-unified-services` - Indicates feature milestone
- `v1.8.0-tests-100-percent` - Indicates test coverage milestone
- `v2.0.0-phase1-complete` - Indicates project phase

**Modern releases should avoid descriptive suffixes and use clean SemVer.**

---

## Release Creation Steps

### Step 1: Commit Final Changes

Ensure all code is committed and pushed to main:

```bash
git status  # Must be clean
git log -1 --oneline
```

### Step 2: Create the Tag

Create an annotated tag (recommended over lightweight tags):

```bash
git tag -a v4.2.0 -m "Release v4.2.0: [Brief description]"
```

Or create from workflow dispatch (see [CI/CD Integration](#cicd-integration)).

### Step 3: Push Tag to GitHub

```bash
git push origin v4.2.0
```

**⚠️ CRITICAL:** The `release.yml` workflow triggers automatically on `v*` tags. Do NOT push a tag until you're ready to trigger the CI/CD pipeline.

### Step 4: Monitor CI/CD Workflow

- Watch GitHub Actions: `github.com/<repo>/actions`
- Verify all jobs succeed (create-release, build-macos, build-linux, publish-release)
- Check that release is marked as **Draft** initially
- Wait for build artifacts to upload

### Step 5: Review Generated Release

- [ ] Navigate to Releases page
- [ ] Verify release notes are accurate
- [ ] Verify all expected assets are present
- [ ] Verify checksums (SHA256SUMS.txt)

### Step 6: Publish Release

The `publish-release` job automatically removes draft status when all builds complete.

If manual publish is needed:

```bash
# Using GitHub CLI
gh release edit v4.2.0 --draft=false

# Or view the release
gh release view v4.2.0
```

---

## Asset Types and Build Procedures

VibeCode releases can include various artifact types. See [CI/CD Integration](#cicd-integration) for automated builds via GitHub Actions.

### Asset Type 1: DMG (macOS Application Bundle)

**File Pattern:** `VibeCode-v<VERSION>-macOS-*.dmg`

**Build via Tauri:**

```bash
npm run tauri:build -- --target aarch64-apple-darwin
npm run tauri:build -- --target x86_64-apple-darwin
```

**Manual Upload:**

```bash
gh release upload v4.2.0 \
  "platforms/tauri/target/aarch64-apple-darwin/release/bundle/dmg/VibeCode-v4.2.0-macOS-arm64.dmg"
```

### Asset Type 2: CLI Binaries

**File Pattern:** `vibecode-<os>-<arch>`

**Build all platforms:**

```bash
make cli-all
```

This generates:
- `bin/vibecode-darwin-arm64`
- `bin/vibecode-darwin-amd64`
- `bin/vibecode-linux-amd64`
- `bin/vibecode-linux-arm64`

**Upload to release:**

```bash
gh release upload v4.2.0 bin/vibecode-*
```

### Asset Type 3: Alpine Linux Kernel

**File Pattern:** `alpine-<version>-arm64-kernel`

**Download from Alpine CDN:**

```bash
wget https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64/alpine-virt-3.22.0-aarch64.iso
tar xzf alpine-virt-3.22.0-aarch64.iso boot/vmlinuz-virt -O > alpine-3.22-arm64-kernel
```

**Upload:**

```bash
gh release upload v4.2.0 alpine-3.22-arm64-kernel
```

### Asset Type 4: Initramfs

**File Pattern:** `*-openvscode-*.cpio.gz`

**Build custom initramfs:**

```bash
# Using the provided script
scripts/benchmarks/build-minimal-initramfs.sh
```

**Upload:**

```bash
gh release upload v4.2.0 bun-openvscode-*.cpio.gz
```

### Asset Type 5: Source Tarballs

**File Pattern:** `vibecode-src-v<VERSION>.tar.gz`

**Create tarball:**

```bash
git archive --format tar.gz \
  --prefix vibecode-v4.2.0/ \
  v4.2.0 > vibecode-src-v4.2.0.tar.gz
```

**Upload:**

```bash
gh release upload v4.2.0 vibecode-src-v4.2.0.tar.gz
```

### Generating Checksums

After collecting all assets, generate SHA256 checksums:

```bash
cd release-assets/
shasum -a 256 * > SHA256SUMS.txt
cat SHA256SUMS.txt
gh release upload v4.2.0 SHA256SUMS.txt
```

---

## Release Notes Template

Use this template for consistent, clear release notes:

```markdown
## VibeCode v4.2.0 - [Feature/Change Summary]

### Major Changes
- [Highlight 1]
- [Highlight 2]

### Features
- New feature X
- Enhanced feature Y
- Improved performance in Z

### Bug Fixes
- Fixed issue with [component]
- Resolved [problem]

### Dependencies
- Updated [dependency] to v[version]
- Removed [unused dependency]

### Breaking Changes (if applicable)
- [Describe breaking change]
- Migration path: [steps]

### Known Issues
- [Known issue 1]
- [Known issue 2]

### Downloads

- **macOS (Apple Silicon):** `VibeCode-v4.2.0-macOS-arm64.dmg`
- **macOS (Intel):** `VibeCode-v4.2.0-macOS-x64.dmg`
- **Linux (ARM64):** `vibecode-linux-arm64`
- **Linux (x86_64):** `vibecode-linux-amd64`
- **CLI (macOS ARM64):** `vibecode-darwin-arm64`
- **CLI (macOS Intel):** `vibecode-darwin-amd64`

### Checksums

SHA256 checksums are available in `SHA256SUMS.txt`.

### Installation

#### macOS
1. Download the `.dmg` file
2. Open the DMG in Finder
3. Drag VibeCode to Applications folder
4. Launch from Applications

#### Linux
Extract the binary to `/usr/local/bin/`:

\`\`\`bash
sudo install vibecode-linux-arm64 /usr/local/bin/vibecode
\`\`\`

### Contributors
- [List of contributors, if applicable]

---

*VibeCode v4.2.0 - Released [Date]*
```

---

## CI/CD Integration

### Automated Release Workflow

The `.github/workflows/release.yml` workflow automates release creation:

**Trigger 1: Git Tag Push**

```bash
git tag -a v4.2.0 -m "Release v4.2.0"
git push origin v4.2.0
```

**Trigger 2: Manual Workflow Dispatch**

```bash
gh workflow run release.yml \
  -f version=v4.2.0 \
  -f prerelease=false
```

### Workflow Jobs

1. **create-release**
   - Generates release notes from commits
   - Creates draft release on GitHub
   - Outputs `upload_url` for asset uploads

2. **build-macos**
   - Sets up Node.js and Rust
   - Builds Next.js application
   - Builds Tauri macOS bundle (DMG)
   - Uploads DMG to release

3. **build-linux** (disabled, placeholder)
   - Future Linux CI build

4. **build-windows** (disabled, placeholder)
   - Future Windows CI build

5. **publish-release**
   - Waits for build jobs
   - Removes draft status
   - Makes release public

### Workflow Environment

```yaml
DD_SERVICE: vibecode-webgui
DD_ENV: ci
DD_VERSION: <commit-hash>
DD_TAGS: team:platform,component:ci
```

Datadog traces CI/CD pipeline for monitoring and observability.

---

## Release Verification

### Checklist Before Publishing

- [ ] All workflow jobs succeeded (green checkmarks on Actions tab)
- [ ] Release assets are present and complete
- [ ] Release notes are accurate and contain no typos
- [ ] Checksums match uploaded assets
- [ ] Version tag matches workflow output
- [ ] Release date is reasonable
- [ ] No accidental secrets in release notes

### Manual Verification Commands

```bash
# List assets in release
gh release view v4.2.0 --json assets -q '.assets[] | .name'

# Download and verify a checksum
gh release download v4.2.0 -p "SHA256SUMS.txt"
shasum -a 256 -c SHA256SUMS.txt

# View full release details
gh release view v4.2.0
```

### Testing the Release

1. **Test CLI binary:**
   ```bash
   gh release download v4.2.0 -p "vibecode-linux-arm64"
   chmod +x vibecode-linux-arm64
   ./vibecode-linux-arm64 --version
   ```

2. **Test DMG (macOS):**
   - Download the DMG
   - Double-click to mount
   - Copy app to Applications
   - Launch and verify no crash on startup

3. **Test source tarball:**
   ```bash
   gh release download v4.2.0 -p "*.tar.gz"
   tar xzf vibecode-src-v4.2.0.tar.gz
   cd vibecode-v4.2.0
   npm install --legacy-peer-deps
   npm run build
   ```

---

## Maintenance and Updates

### Updating Release Notes After Publishing

To fix typos or add information after release is published:

```bash
gh release edit v4.2.0 --notes-file new-notes.md
```

Or use the web UI: https://github.com/<repo>/releases/edit/v4.2.0

### Adding Assets to Existing Release

```bash
gh release upload v4.2.0 new-asset.tar.gz --clobber
```

### Marking a Release as Pre-Release

If released as stable but needs to be marked pre-release:

```bash
gh release edit v4.2.0 --prerelease
```

### Deprecating Old Releases

To indicate a release is superseded:

1. Edit the release notes
2. Add at top:
   ```
   ⚠️ **DEPRECATED** - This release has been superseded by v4.3.0. Please upgrade.
   ```
3. Optionally remove from latest by editing release tag

### Release Retention Policy

- **Keep indefinitely:** All releases with binary assets
- **Keep for 1 year:** Code-only releases (code is in git history)
- **Document deprecated:** Mark superseded releases with deprecation notice

---

## Rollback Procedure

### Scenario 1: Release Was Broken (Published to GitHub)

**If discovered immediately (< 1 hour):**

1. Create patch release with fix
2. Publish new release
3. Edit old release to add deprecation notice
4. Update release notes to point to new version

**If discovered after publishing:**

1. Don't delete the broken release (assets may already be in use)
2. Create new patch release with fix
3. Add prominent deprecation notice to broken release
4. Update default release reference in docs

### Scenario 2: Need to Restore Deleted Release

Git tags provide recovery path:

```bash
# Verify tag still exists
git tag -l v4.2.0

# Recreate release from existing tag
gh release create v4.2.0 \
  --title "VibeCode v4.2.0" \
  --notes-file release-notes.md

# Re-upload assets
gh release upload v4.2.0 assets/*
```

### Scenario 3: Accidental Tag Push (Before Publishing)

If tag was pushed but you want to cancel the release:

1. Don't let the CI/CD complete
2. Delete the tag locally: `git tag -d v4.2.0`
3. Delete from remote: `git push origin :refs/tags/v4.2.0`
4. Cancel GitHub Actions workflow (if running)

**After cancellation**, recreate the tag when ready.

### Asset Recovery

**CRITICAL LESSON:** Always archive binary assets before deleting a release (learned in Wave 21).

If assets are lost:

1. Check local machine for old downloads
2. Check GitHub Actions build logs (artifacts retained ~90 days)
3. Rebuild assets from tag: `git checkout v4.2.0 && make cli-all`
4. Re-upload to release

---

## Lessons Learned

### Wave 21 - Destructive Release Cleanup

**Problem:** 37 releases were deleted without backing up assets first, causing permanent loss of ~60-80 binary artifacts.

**Solution:** Implement this checklist:
- [ ] Archive all binary assets before deletion
- [ ] Store backups in secondary location
- [ ] Document why release is being deleted
- [ ] Verify no customers link to that release

### Wave 21b - Release Recreation

**Problem:** 37 deleted releases were recreated by AI agents, resulting in release notes that were written from context, not verified against actual code.

**Solution:** Always verify release notes match actual repository state:

```bash
# Before publishing a release:
PREV_TAG=$(git tag -l --sort=-version:refname | grep -v "^v4.2.0$" | head -1)
git log $PREV_TAG..v4.2.0 --oneline
# Compare output to release notes
```

### Wave 22 - Binary Asset Management

**Problem:** Alpine kernel and initramfs assets were manually downloaded and built without clear documentation.

**Solution:** Document download sources and build procedures in RELEASE_PROCESS.md (this file).

### Wave 33 - ESLint 10 Compatibility

**Problem:** ESLint upgrade to 10.x broke with eslint-plugin-react 7.x due to getFilename API changes.

**Solution:** Pin eslint-plugin-react version and set explicit `react.version` in config.

**Implication for releases:** Always test ESLint and TypeScript compilation before tagging.

### Pre-Release Testing Critical

**Must verify before tagging:**
1. `npm test -- --maxWorkers=2` (OOM guard)
2. `npx tsc --noEmit` (TypeScript)
3. `npm run build` (Next.js build)
4. `make cli-all` (CLI binaries)
5. Manual smoke test of key features

---

## FAQ

**Q: How do I patch a released version?**
A: Create a new patch tag: `v4.2.1`. Follow the same release process.

**Q: Can I re-tag a version?**
A: No, never reuse version numbers. If you need to fix v4.2.0, create v4.2.1.

**Q: Should I delete failed releases?**
A: No, archive them. Edit to add deprecation notice instead.

**Q: How long do CI/CD artifacts last?**
A: GitHub Actions artifacts are retained ~90 days. GitHub Releases are permanent unless deleted.

**Q: Can I automate release notes?**
A: Partially. The workflow generates notes from commits, but you should review and edit for clarity.

**Q: What if the build succeeds but an asset is corrupt?**
A: Delete the corrupt asset and re-upload. GitHub Releases supports clobbering: `gh release upload v4.2.0 file.zip --clobber`

---

## See Also

- [CHANGELOG.md](./CHANGELOG.md) - Release history and changes
- [.github/workflows/release.yml](./.github/workflows/release.yml) - Automated release CI/CD
- [Makefile](./Makefile) - Build targets for CLI and assets
