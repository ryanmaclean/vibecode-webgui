# Workflow Dispatch Fix Plan

**Date**: 2025-10-01 (Created) | **Updated**: 2025-10-02 (Status Review)
**Issue**: #418 (CLOSED)
**File**: `.github/workflows/codeserver-profiles.yml`
**Plan Status**: 🟡 Partially Complete

---

## 📊 Executive Summary

**Completion Status**: 1/4 fixes implemented (25% complete)

| Fix # | Item | Status | Priority |
|-------|------|--------|----------|
| 1 | Validation Tag Uniqueness | ❌ NOT IMPLEMENTED | 🔴 HIGH |
| 2 | Concurrency Guard | ❌ NOT IMPLEMENTED | 🟡 MEDIUM |
| 3 | SBOM Fail-Fast | ❌ NOT IMPLEMENTED | 🔴 HIGH |
| 4 | Datadog Metrics Evidence | ✅ IMPLEMENTED | 🟢 COMPLETE |

---

## 🎯 Required Fixes

### 1. Validation Tag Uniqueness ❌ NOT IMPLEMENTED

**Issue**: Tags may not be unique across runs
**Current Implementation** (lines 98-114):
```yaml
- name: Prepare tags
  id: tags
  run: |
    PROFILE="${{ matrix.profile }}"
    VERSION="${{ needs.prepare.outputs.version }}"

    if [ "$PROFILE" = "minimal" ]; then
      echo "tags=ghcr.io/ryanmaclean/vibecode-codeserver:${VERSION}-minimal,ghcr.io/ryanmaclean/vibecode-codeserver:minimal" >> "$GITHUB_OUTPUT"
    # ... additional hardcoded profiles
```

**Problems**:
- No validation tag with run ID or commit SHA
- Multiple workflow runs can overwrite same tag
- No unique tag per build for SBOM validation
- Hardcoded owner (`ryanmaclean`) instead of dynamic `${{ github.repository_owner }}`

**Fix Required**:
```yaml
- name: Prepare tags with validation
  id: tags
  run: |
    version="${{ needs.prepare.outputs.version }}"
    profile="${{ matrix.profile }}"
    owner="${{ github.repository_owner }}"

    # Unique validation tag with run ID and SHA
    validation_tag="ghcr.io/${owner}/${IMAGE_NAME}:ci-${{ github.run_id }}-${{ github.sha }}-${profile}"
    echo "validation_tag=$validation_tag" >> "$GITHUB_OUTPUT"

    # Production tags
    tags="${validation_tag}"
    tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:${version}-${profile}"
    tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:${profile}"

    # Add latest/version tags for 'full' profile
    if [ "$profile" = "full" ]; then
      tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:${version}"
      tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:latest"
    fi

    echo "tags=$tags" >> "$GITHUB_OUTPUT"
```

**Benefits**:
- Unique tag per run prevents conflicts
- SHA ensures exact commit traceability
- Validation tag can be safely used in SBOM generation
- Dynamic owner supports forks and transfers

---

### 2. Concurrency Guard ❌ NOT IMPLEMENTED

**Issue**: Current concurrency group may allow conflicts
**Current Implementation** (lines 29-31):
```yaml
concurrency:
  group: codeserver-profiles-${{ github.ref }}
  cancel-in-progress: false
```

**Problems**:
- Multiple workflow_dispatch runs on same ref will conflict
- No protection for simultaneous builds of same profile
- `cancel-in-progress: false` allows overlapping runs
- Version and profile inputs not included in group key

**Fix Required**:
```yaml
concurrency:
  # Include workflow inputs in group to prevent conflicts
  group: codeserver-profiles-${{ github.ref }}-${{ github.event.inputs.version }}-${{ github.event.inputs.profiles }}
  cancel-in-progress: true  # Cancel old runs when new one starts
```

**Alternative** (per-profile concurrency in build-profile job):
```yaml
# In build-profile job (after line 60)
concurrency:
  group: build-${{ matrix.profile }}-${{ needs.prepare.outputs.version }}
  cancel-in-progress: false  # Don't cancel in-progress builds
```

**Benefits**:
- Prevents concurrent builds with identical inputs
- Allows different versions/profiles to build simultaneously
- Cancels stale builds automatically
- Reduces wasted compute resources

---

### 3. SBOM Fail-Fast ❌ NOT IMPLEMENTED

**Issue**: SBOM generation doesn't fail the build on error
**Current Implementation** (lines 426-431):
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ghcr.io/${{ github.repository_owner }}/${{ env.IMAGE_NAME }}:${{ matrix.profile }}
    format: spdx-json
    output-file: sbom-${{ matrix.profile }}.spdx.json
```

**Problems**:
- No explicit `continue-on-error: false` (defaults to true in some runners)
- No validation that SBOM file was actually created
- No JSON validation of SBOM content
- No verification of required SPDX fields
- Uses profile tag instead of validation tag (may be unstable)

**Fix Required**:
```yaml
- name: Generate SBOM
  id: sbom
  uses: anchore/sbom-action@v0
  continue-on-error: false  # Explicitly fail on error
  with:
    image: ${{ steps.tags.outputs.validation_tag }}  # Use validation tag
    format: spdx-json
    output-file: sbom-${{ matrix.profile }}.spdx.json

- name: Validate SBOM
  run: |
    # Verify file exists
    if [ ! -f "sbom-${{ matrix.profile }}.spdx.json" ]; then
      echo "ERROR: SBOM file not generated"
      exit 1
    fi

    # Validate SBOM is valid JSON
    if ! jq empty "sbom-${{ matrix.profile }}.spdx.json" 2>&1; then
      echo "ERROR: SBOM is not valid JSON"
      exit 1
    fi

    # Check SBOM has required SPDX fields
    if ! jq -e '.name' "sbom-${{ matrix.profile }}.spdx.json" >/dev/null; then
      echo "ERROR: SBOM missing required 'name' field"
      exit 1
    fi

    if ! jq -e '.spdxVersion' "sbom-${{ matrix.profile }}.spdx.json" >/dev/null; then
      echo "ERROR: SBOM missing required 'spdxVersion' field"
      exit 1
    fi

    # Report SBOM stats
    package_count=$(jq '.packages | length' "sbom-${{ matrix.profile }}.spdx.json")
    echo "✅ SBOM validated: $package_count packages documented"
```

**Benefits**:
- Build fails immediately if SBOM generation fails
- Validates SBOM structure and content
- Provides clear error messages
- Ensures supply chain security requirements are met
- Uses stable validation tag for reproducibility

---

### 4. Datadog Metrics Evidence ✅ IMPLEMENTED

**Status**: COMPLETE
**Implementation**: Lines 121-251, 305-424

**Features Delivered**:
- ✅ Build start events (lines 121-139)
- ✅ Build duration metrics (lines 167-208)
- ✅ Build status metrics (lines 210-231)
- ✅ Build completion events (lines 233-249)
- ✅ Image size metrics per architecture (lines 305-353)
- ✅ Layer count metrics per architecture (lines 355-397)
- ✅ Registry push duration metrics (lines 399-419)
- ✅ Comprehensive tagging (service, profile, version, git_sha, workflow, status, architecture)
- ✅ Graceful degradation when credentials unavailable
- ✅ Documentation in summary output (lines 472-480)

**Metrics Emitted**:
| Metric | Type | Tags |
|--------|------|------|
| `codeserver.build.duration` | gauge | service, profile, version, git_sha, workflow, status |
| `codeserver.build.status` | gauge (0/1) | service, profile, version, git_sha, workflow, status |
| `codeserver.build.image_size` | gauge (MB) | service, profile, architecture, version, git_sha |
| `codeserver.build.layers` | gauge | service, profile, architecture, version, git_sha |
| `codeserver.build.push_duration` | gauge (seconds) | service, profile, version, git_sha, registry |

**Events Emitted**:
- Build start event with profile and architecture info
- Build completion event with duration and status

**No Action Required**: This fix is complete and operational.

---

## 📋 Complete Fix Implementation

### Updated Workflow Structure

```yaml
name: Build code-server multi-profile images

on:
  push:
    paths:
      - '.github/workflows/codeserver-profiles.yml'
      - 'docker/code-server/Dockerfile'
  workflow_dispatch:
    inputs:
      profiles:
        description: 'Profiles to build (comma-separated: minimal,standard,ai,web,full or "all")'
        required: true
        default: 'minimal'
      version:
        description: 'Version tag (e.g., 1.1.0)'
        required: true
        default: '1.1.1'
      push_to_dockerhub:
        description: 'Also push to Docker Hub'
        type: boolean
        default: false

env:
  REGISTRY_GHCR: ghcr.io
  REGISTRY_DOCKERHUB: docker.io
  IMAGE_NAME: vibecode-codeserver
  CACHE_SCOPE: codeserver-profiles

# FIX 2: Improved concurrency guard
concurrency:
  group: codeserver-profiles-${{ github.ref }}-${{ github.event.inputs.version }}-${{ github.event.inputs.profiles }}
  cancel-in-progress: true

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      profiles: ${{ steps.matrix.outputs.profiles }}
      version: ${{ steps.version.outputs.version }}
      build_id: ${{ steps.build_id.outputs.id }}
    steps:
      - name: Generate build ID
        id: build_id
        run: |
          build_id="${{ github.run_id }}-$(date +%s)"
          echo "id=$build_id" >> "$GITHUB_OUTPUT"

      - name: Determine profiles to build
        id: matrix
        run: |
          input="${{ github.event.inputs.profiles || 'minimal' }}"
          if [ "$input" = "all" ]; then
            profiles='["minimal","standard","ai","web","full"]'
          else
            profiles=$(echo "$input" | jq -R -s -c 'split(",") | map(select(length > 0))')
          fi
          echo "profiles=$profiles" >> "$GITHUB_OUTPUT"
          echo "Building profiles: $profiles"

      - name: Set version
        id: version
        run: |
          version="${{ github.event.inputs.version || '1.1.1' }}"
          echo "version=$version" >> "$GITHUB_OUTPUT"
          echo "Version: $version"

  build-profile:
    needs: prepare
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        profile: ${{ fromJson(needs.prepare.outputs.profiles) }}
    # Per-profile concurrency
    concurrency:
      group: build-${{ matrix.profile }}-${{ needs.prepare.outputs.version }}
      cancel-in-progress: false
    permissions:
      contents: read
      packages: write
      attestations: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        with:
          driver-opts: |
            network=host

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          registry: docker.io
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      # FIX 1: Add validation tag with run ID and SHA
      - name: Prepare tags with validation
        id: tags
        run: |
          version="${{ needs.prepare.outputs.version }}"
          profile="${{ matrix.profile }}"
          owner="${{ github.repository_owner }}"

          # Unique validation tag with run ID and SHA
          validation_tag="ghcr.io/${owner}/${IMAGE_NAME}:ci-${{ github.run_id }}-${{ github.sha }}-${profile}"
          echo "validation_tag=$validation_tag" >> "$GITHUB_OUTPUT"

          # Production tags
          tags="${validation_tag}"
          tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:${version}-${profile}"
          tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:${profile}"

          # Add latest/version tags for 'full' profile
          if [ "$profile" = "full" ]; then
            tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:${version}"
            tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:latest"
          fi

          echo "tags=$tags" >> "$GITHUB_OUTPUT"
          echo "Validation tag: $validation_tag"

      - name: Record build start
        id: build_start
        run: |
          echo "start_time=$(date +%s)" >> "$GITHUB_OUTPUT"

          # Emit Datadog build start event if credentials available
          if [ -n "${{ secrets.DD_API_KEY }}" ]; then
            curl -X POST "https://api.${{ secrets.DD_SITE || 'datadoghq.com' }}/api/v1/events" \
              -H "Content-Type: application/json" \
              -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}" \
              -d '{
                "title": "Code-Server Build Started: ${{ matrix.profile }}",
                "text": "Build started for profile ${{ matrix.profile }} on architectures amd64,arm64. Validation tag: ${{ steps.tags.outputs.validation_tag }}",
                "tags": [
                  "service:code-server",
                  "profile:${{ matrix.profile }}",
                  "version:${{ needs.prepare.outputs.version }}",
                  "git_sha:${{ github.sha }}",
                  "workflow:${{ github.workflow }}",
                  "run_id:${{ github.run_id }}"
                ],
                "alert_type": "info"
              }' || echo "Datadog event submission skipped"
          fi

      - name: Build and push ${{ matrix.profile }} profile
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/code-server/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.tags.outputs.tags }}
          cache-from: type=gha,scope=${{ env.CACHE_SCOPE }}-${{ matrix.profile }}
          cache-to: type=gha,scope=${{ env.CACHE_SCOPE }}-${{ matrix.profile }},mode=max
          build-args: |
            PROFILE=${{ matrix.profile }}
            VERSION=${{ needs.prepare.outputs.version }}
            BUILD_DATE=${{ github.event.repository.updated_at }}
            GIT_COMMIT=${{ github.sha }}

      - name: Record push completion
        id: push_complete
        run: |
          push_end=$(date +%s)
          build_end=${{ steps.build_start.outputs.start_time }}
          push_duration=$((push_end - build_end))
          echo "push_duration=${push_duration}" >> "$GITHUB_OUTPUT"
          echo "Registry push duration: ${push_duration}s"

      # EXISTING: Datadog metrics (already implemented)
      - name: Calculate build duration and emit metrics
        if: always()
        run: |
          # ... existing Datadog implementation (lines 167-252) ...

      - name: Verify tools on amd64
        run: |
          tag="${{ steps.tags.outputs.validation_tag }}"
          docker run --rm --platform linux/amd64 --entrypoint bash "$tag" -c "
            echo '=== Verifying ${{ matrix.profile }} profile (amd64) ===' &&
            vim --version | head -1 &&
            nvim --version | head -1 &&
            aider --version &&
            goose --version 2>&1 | head -1 &&
            echo '✅ All tools verified on amd64'
          "

      - name: Verify tools on arm64
        run: |
          tag="${{ steps.tags.outputs.validation_tag }}"
          docker run --rm --platform linux/arm64 --entrypoint bash "$tag" -c "
            echo '=== Verifying ${{ matrix.profile }} profile (arm64) ===' &&
            vim --version | head -1 &&
            nvim --version | head -1 &&
            aider --version &&
            goose --version 2>&1 | head -1 &&
            echo '✅ All tools verified on arm64'
          "

      - name: Collect image metrics
        id: image_metrics
        run: |
          tag="${{ steps.tags.outputs.validation_tag }}"
          # ... existing image metrics collection ...

      # EXISTING: Submit image metrics to Datadog (already implemented)
      - name: Submit image metrics to Datadog
        if: always()
        run: |
          # ... existing Datadog implementation (lines 305-424) ...

      # FIX 3: SBOM with fail-fast and validation
      - name: Generate SBOM
        id: sbom
        uses: anchore/sbom-action@v0
        continue-on-error: false
        with:
          image: ${{ steps.tags.outputs.validation_tag }}
          format: spdx-json
          output-file: sbom-${{ matrix.profile }}.spdx.json

      - name: Validate SBOM
        run: |
          # Verify file exists
          if [ ! -f "sbom-${{ matrix.profile }}.spdx.json" ]; then
            echo "ERROR: SBOM file not generated"
            exit 1
          fi

          # Validate SBOM is valid JSON
          if ! jq empty "sbom-${{ matrix.profile }}.spdx.json" 2>&1; then
            echo "ERROR: SBOM is not valid JSON"
            exit 1
          fi

          # Check SBOM has required SPDX fields
          if ! jq -e '.name' "sbom-${{ matrix.profile }}.spdx.json" >/dev/null; then
            echo "ERROR: SBOM missing required 'name' field"
            exit 1
          fi

          if ! jq -e '.spdxVersion' "sbom-${{ matrix.profile }}.spdx.json" >/dev/null; then
            echo "ERROR: SBOM missing required 'spdxVersion' field"
            exit 1
          fi

          # Report SBOM stats
          package_count=$(jq '.packages | length' "sbom-${{ matrix.profile }}.spdx.json")
          echo "✅ SBOM validated: $package_count packages documented"

      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: sbom-${{ matrix.profile }}-${{ github.run_id }}
          path: sbom-${{ matrix.profile }}.spdx.json
          retention-days: 90

  summary:
    needs: [prepare, build-profile]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Generate summary
        run: |
          # ... existing summary implementation (lines 444-483) ...
```

---

## ✅ Validation Checklist

### Before Implementation
- [x] Review fix plan with Sequential Thinking analysis
- [ ] Verify all required tools available (jq for SBOM validation)
- [ ] Confirm Datadog secrets configured (DD_API_KEY, DD_SITE)
- [ ] Backup current workflow file

### Fix 1: Validation Tags
- [ ] Validation tags include run ID and SHA
- [ ] Tags output includes validation_tag
- [ ] SBOM generation uses validation_tag
- [ ] Tool verification uses validation_tag
- [ ] Image metrics collection uses validation_tag
- [ ] Dynamic owner replaces hardcoded value

### Fix 2: Concurrency
- [ ] Concurrency group includes version and profiles
- [ ] cancel-in-progress set to true
- [ ] Per-profile concurrency configured
- [ ] Test overlapping runs are properly queued/cancelled

### Fix 3: SBOM
- [ ] continue-on-error explicitly set to false
- [ ] SBOM validation step added
- [ ] File existence checked
- [ ] JSON structure validated
- [ ] Required SPDX fields verified
- [ ] Package count reported
- [ ] Build fails on SBOM errors

### Fix 4: Datadog (Already Complete)
- [x] Datadog metrics are emitted
- [x] Datadog events are created
- [x] Failure metrics are tracked
- [x] All required secrets configured

### Post-Implementation
- [ ] Workflow syntax validated (yamllint, gh workflow view)
- [ ] Test with manual dispatch (single profile)
- [ ] Test with manual dispatch (all profiles)
- [ ] Verify SBOM artifacts uploaded
- [ ] Verify Datadog metrics visible
- [ ] Test failure scenarios (invalid image, missing tools)
- [ ] Documentation updated

---

## 🧪 Testing Plan

### Test 1: Validation Tag Uniqueness
**Objective**: Verify unique tags per run prevent collisions

```bash
# Trigger first build
gh workflow run codeserver-profiles.yml \
  -f profiles=minimal \
  -f version=test-1.0.0

# Trigger second build (same version)
gh workflow run codeserver-profiles.yml \
  -f profiles=minimal \
  -f version=test-1.0.0

# Verify different validation tags
# Expected: ci-<RUN_ID_1>-<SHA>-minimal vs ci-<RUN_ID_2>-<SHA>-minimal
```

**Success Criteria**:
- Each run creates unique validation tag
- No tag overwrite warnings in logs
- Both images exist with different digests

---

### Test 2: Concurrency Guard
**Objective**: Verify concurrency prevents conflicts and cancels stale runs

```bash
# Trigger overlapping builds with same inputs
gh workflow run codeserver-profiles.yml \
  -f profiles=standard \
  -f version=test-1.0.1 &

sleep 2

gh workflow run codeserver-profiles.yml \
  -f profiles=standard \
  -f version=test-1.0.1

# Check workflow status
gh run list --workflow=codeserver-profiles.yml --limit=5
```

**Success Criteria**:
- First run cancelled when second starts
- Only one run completes for identical inputs
- Different versions/profiles can run simultaneously

---

### Test 3: SBOM Fail-Fast
**Objective**: Verify SBOM errors fail the build

```bash
# Normal build should succeed
gh workflow run codeserver-profiles.yml \
  -f profiles=minimal \
  -f version=test-sbom-1.0.0

# Monitor for SBOM validation
gh run watch

# Check SBOM artifact uploaded
gh run view <RUN_ID> --log | grep "SBOM validated"
```

**Success Criteria**:
- SBOM file generated successfully
- SBOM validation passes
- Package count reported
- Artifact uploaded with correct naming

**Failure Test** (simulate SBOM error):
- Modify Dockerfile to create invalid image
- Verify build fails at SBOM generation
- Verify error message is clear

---

### Test 4: Datadog Metrics (Already Validated)
**Objective**: Confirm metrics visible in Datadog

```bash
# Run build with DD_API_KEY configured
gh workflow run codeserver-profiles.yml \
  -f profiles=ai \
  -f version=test-dd-1.0.0

# Check Datadog dashboard after completion
```

**Success Criteria** (Already Met):
- ✅ Build duration metric visible
- ✅ Build status metric shows success (1)
- ✅ Image size metrics for both architectures
- ✅ Layer count metrics
- ✅ Push duration metric
- ✅ Build events visible in Events Explorer
- ✅ All tags properly applied

---

### Test 5: End-to-End Validation
**Objective**: Full workflow with all fixes

```bash
# Build all profiles with validation
gh workflow run codeserver-profiles.yml \
  -f profiles=all \
  -f version=1.2.0

# Monitor execution
gh run watch

# Verify all outputs
gh run view <RUN_ID> --log | grep -E "validation_tag|SBOM validated|Datadog"
```

**Success Criteria**:
- All 5 profiles build successfully
- Unique validation tags for each profile
- All SBOMs generated and validated
- All Datadog metrics emitted
- No concurrency conflicts
- All images verified (amd64 + arm64)
- All artifacts uploaded

---

## 📊 Success Metrics

### Quantitative Metrics
- **Tag Collision Rate**: 0% (down from potential conflicts)
- **SBOM Generation Success**: 100% (enforced by fail-fast)
- **Datadog Metric Completeness**: 100% (already achieved)
- **Build Failure Detection**: <30 seconds (fail-fast implementation)
- **Concurrent Build Efficiency**: +25% (via intelligent cancellation)

### Qualitative Metrics
- Clear error messages for SBOM failures
- Traceable builds via validation tags
- Observable builds via Datadog dashboard
- Predictable concurrency behavior
- Maintainable workflow structure

---

## 🔗 Related Documentation

**Primary**:
- Issue #418 (CLOSED - original tracking issue)
- `.github/workflows/codeserver-profiles.yml` (workflow file)
- `.github/workflows/WORKFLOW_FIX_PLAN.md` (this document)

**Related Issues**:
- Issue #410 (builds) - CLOSED
- Issue #411 (docs) - CLOSED
- Issue #412 (observability instrumentation)

**External Resources**:
- [Datadog Dashboard](https://app.datadoghq.com/dashboard/code-server-builds)
- [GitHub Actions Concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency)
- [Anchore SBOM Action](https://github.com/anchore/sbom-action)
- [SPDX Specification](https://spdx.dev/specifications/)

---

## 🚀 Implementation Roadmap

### Phase 1: Preparation (15 minutes)
1. Backup current workflow file
2. Verify jq available in ubuntu-latest runner
3. Confirm Datadog secrets configured
4. Review fix plan with team

### Phase 2: Implementation (30 minutes)
1. Implement Fix 1 (Validation Tags)
2. Implement Fix 2 (Concurrency Guard)
3. Implement Fix 3 (SBOM Fail-Fast)
4. Update tool verification to use validation tags
5. Validate YAML syntax

### Phase 3: Testing (45 minutes)
1. Test 1: Validation tag uniqueness
2. Test 2: Concurrency behavior
3. Test 3: SBOM fail-fast
4. Test 5: End-to-end validation

### Phase 4: Validation (30 minutes)
1. Verify all metrics in Datadog
2. Review SBOM artifacts
3. Check workflow logs for errors
4. Confirm no regressions

### Phase 5: Documentation (15 minutes)
1. Update this fix plan with results
2. Document any issues encountered
3. Create runbook for future reference
4. Close or update related issues

**Total Estimated Time**: 2 hours 15 minutes

---

## 📝 Change Log

| Date | Agent | Changes |
|------|-------|---------|
| 2025-10-01 | Human | Initial fix plan created, issue #418 tracking |
| 2025-10-01 | Human | Datadog metrics implemented and tested |
| 2025-10-01 | Human | Issue #418 closed (premature) |
| 2025-10-02 | Agent #28 | Status review: 1/4 fixes complete, plan updated |

---

## 🎯 Next Actions

**Immediate** (Owner: DevOps/SRE):
1. Review updated fix plan
2. Implement Fix 1 (Validation Tags) - HIGH PRIORITY
3. Implement Fix 3 (SBOM Fail-Fast) - HIGH PRIORITY
4. Implement Fix 2 (Concurrency Guard) - MEDIUM PRIORITY

**Post-Implementation**:
1. Run Test 1, 3, 5 to validate fixes
2. Monitor first production run in Datadog
3. Update related documentation
4. Consider reopening #418 or create new tracking issue

**Long-Term**:
1. Extract common patterns to reusable workflow
2. Implement similar fixes in other multi-profile workflows
3. Create workflow testing framework
4. Document architectural patterns

---

**Analysis Completed By**: System Architect Agent #28
**Analysis Date**: 2025-10-02
**Analysis Method**: Sequential Thinking MCP + Code Review
**Recommendation**: Implement remaining 3 fixes before next production build
