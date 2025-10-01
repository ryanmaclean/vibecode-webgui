# Workflow Dispatch Fix Plan

**Date**: 2025-10-01  
**Issue**: #418  
**File**: `.github/workflows/codeserver-profiles.yml`

## 🎯 Required Fixes

Based on reviewer feedback, the following issues need to be addressed:

### 1. Validation Tag Uniqueness

**Issue**: Tags may not be unique across runs  
**Current**: Uses version and profile only
```yaml
-t ghcr.io/${owner}/${IMAGE_NAME}:${version}-${profile}
```

**Fix Required**: Add run ID or commit SHA for uniqueness
```yaml
# Add unique validation tag
validation_tag="ghcr.io/${owner}/${IMAGE_NAME}:ci-${GITHUB_RUN_ID}-${profile}"
echo "validation_tag=$validation_tag" >> "$GITHUB_OUTPUT"

# Use in build
-t ${{ steps.tags.outputs.validation_tag }}
-t ghcr.io/${owner}/${IMAGE_NAME}:${version}-${profile}
```

### 2. Concurrency Guard

**Issue**: Current concurrency group may allow conflicts  
**Current**:
```yaml
concurrency:
  group: codeserver-profiles-${{ github.ref }}
  cancel-in-progress: false
```

**Problems**:
- Multiple workflow_dispatch runs on same ref will conflict
- No protection for simultaneous builds of same profile

**Fix Required**:
```yaml
concurrency:
  # Include workflow inputs in group to prevent conflicts
  group: codeserver-profiles-${{ github.ref }}-${{ github.event.inputs.version }}-${{ github.event.inputs.profiles }}
  cancel-in-progress: true  # Cancel old runs when new one starts
```

**Alternative** (per-profile concurrency):
```yaml
# In build-profile job
concurrency:
  group: build-${{ matrix.profile }}-${{ github.event.inputs.version }}
  cancel-in-progress: false  # Don't cancel in-progress builds
```

### 3. SBOM Fail-Fast

**Issue**: SBOM generation doesn't fail the build on error  
**Current** (line ~211):
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ghcr.io/${{ github.repository_owner }}/${{ env.IMAGE_NAME }}:${{ matrix.profile }}
    format: spdx-json
    output-file: sbom-${{ matrix.profile }}.spdx.json
```

**Fix Required**: Add continue-on-error and validation
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
    if [ ! -f "sbom-${{ matrix.profile }}.spdx.json" ]; then
      echo "ERROR: SBOM file not generated"
      exit 1
    fi
    # Validate SBOM is valid JSON
    jq empty "sbom-${{ matrix.profile }}.spdx.json"
    # Check SBOM has required fields
    jq -e '.name' "sbom-${{ matrix.profile }}.spdx.json"
```

### 4. Datadog Metrics Evidence

**Issue**: No Datadog metrics being emitted  
**Current**: No Datadog integration in workflow

**Fix Required**: Add Datadog metrics emission
```yaml
- name: Install Datadog CLI
  if: ${{ secrets.DD_API_KEY != '' }}
  run: npm install -g @datadog/datadog-ci

- name: Emit Datadog build metrics
  if: ${{ secrets.DD_API_KEY != '' }}
  env:
    DATADOG_API_KEY: ${{ secrets.DD_API_KEY }}
    DATADOG_SITE: ${{ secrets.DD_SITE || 'datadoghq.com' }}
  run: |
    # Calculate build duration
    start_time=$(date -d '${{ github.event.repository.updated_at }}' +%s 2>/dev/null || date +%s)
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    # Emit metrics
    datadog-ci metric submit codeserver.profile.build.duration "$duration" \
      --type gauge \
      --tags "profile:${{ matrix.profile }},version:${{ needs.prepare.outputs.version }},run:${{ github.run_id }}"
    
    datadog-ci metric submit codeserver.profile.build.success 1 \
      --type count \
      --tags "profile:${{ matrix.profile }},version:${{ needs.prepare.outputs.version }}"
    
    # Emit event
    datadog-ci event post \
      "Code-server profile built" \
      "Profile ${{ matrix.profile }} v${{ needs.prepare.outputs.version }} built successfully" \
      --tags "profile:${{ matrix.profile }},workflow:codeserver-profiles"

- name: Emit Datadog failure metrics
  if: ${{ failure() && secrets.DD_API_KEY != '' }}
  env:
    DATADOG_API_KEY: ${{ secrets.DD_API_KEY }}
    DATADOG_SITE: ${{ secrets.DD_SITE || 'datadoghq.com' }}
  run: |
    datadog-ci metric submit codeserver.profile.build.failure 1 \
      --type count \
      --tags "profile:${{ matrix.profile }},version:${{ needs.prepare.outputs.version }},run:${{ github.run_id }}"
```

## 📋 Complete Fix Implementation

### Updated Workflow Structure

```yaml
name: Build code-server multi-profile images

on:
  workflow_dispatch:
    inputs:
      profiles:
        description: 'Profiles to build'
        required: true
        default: 'all'
      version:
        description: 'Version tag'
        required: true
        default: '1.1.0'
      push_to_dockerhub:
        description: 'Push to Docker Hub'
        type: boolean
        default: true

env:
  REGISTRY_GHCR: ghcr.io
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
      
      # ... existing prepare steps ...

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
      - name: Checkout
        uses: actions/checkout@v4

      # ... existing setup steps ...

      # FIX 1: Add validation tag
      - name: Prepare tags with validation
        id: tags
        run: |
          version="${{ needs.prepare.outputs.version }}"
          profile="${{ matrix.profile }}"
          owner="${{ github.repository_owner }}"
          
          # Unique validation tag
          validation_tag="ghcr.io/${owner}/${IMAGE_NAME}:ci-${{ github.run_id }}-${profile}"
          echo "validation_tag=$validation_tag" >> "$GITHUB_OUTPUT"
          
          # Production tags
          tags="${validation_tag}"
          tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:${version}-${profile}"
          tags="${tags},ghcr.io/${owner}/${IMAGE_NAME}:${profile}"
          
          echo "tags=$tags" >> "$GITHUB_OUTPUT"

      - name: Build and push
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

      # FIX 3: SBOM with fail-fast
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
          if [ ! -f "sbom-${{ matrix.profile }}.spdx.json" ]; then
            echo "ERROR: SBOM not generated"
            exit 1
          fi
          jq empty "sbom-${{ matrix.profile }}.spdx.json"
          jq -e '.name' "sbom-${{ matrix.profile }}.spdx.json"

      # FIX 4: Datadog metrics
      - name: Install Datadog CLI
        if: ${{ secrets.DD_API_KEY != '' }}
        run: npm install -g @datadog/datadog-ci

      - name: Emit Datadog metrics
        if: ${{ secrets.DD_API_KEY != '' }}
        env:
          DATADOG_API_KEY: ${{ secrets.DD_API_KEY }}
          DATADOG_SITE: ${{ secrets.DD_SITE || 'datadoghq.com' }}
        run: |
          duration=$(($(date +%s) - ${{ github.event.repository.updated_at }}))
          datadog-ci metric submit codeserver.profile.build.duration "$duration" \
            --type gauge \
            --tags "profile:${{ matrix.profile }},version:${{ needs.prepare.outputs.version }}"
          datadog-ci metric submit codeserver.profile.build.success 1 \
            --type count \
            --tags "profile:${{ matrix.profile }}"

      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: sbom-${{ matrix.profile }}-${{ github.run_id }}
          path: sbom-${{ matrix.profile }}.spdx.json
          sbom: true
```

## ✅ Validation Checklist

Before merging:
- [ ] Validation tags are unique per run
- [ ] Concurrency prevents conflicts
- [ ] SBOM generation fails build on error
- [ ] SBOM validation checks pass
- [ ] Datadog metrics are emitted
- [ ] Datadog events are created
- [ ] Failure metrics are tracked
- [ ] All secrets are properly configured
- [ ] Workflow tested with manual dispatch
- [ ] Documentation updated

## 🧪 Testing Plan

1. **Test validation tag uniqueness**:
   - Trigger two builds with same version
   - Verify different validation tags

2. **Test concurrency guard**:
   - Trigger overlapping builds
   - Verify proper cancellation/queueing

3. **Test SBOM fail-fast**:
   - Simulate SBOM generation failure
   - Verify build fails

4. **Test Datadog metrics**:
   - Run build with DD_API_KEY
   - Verify metrics in Datadog UI

## 📊 Success Metrics

- Zero tag conflicts
- No concurrent build issues
- 100% SBOM generation success
- Datadog metrics visible for all builds
- Build duration tracked
- Failure rate tracked

## 🔗 Related

- Issue #418
- `.github/workflows/codeserver-profiles.yml`
- Datadog dashboard for code-server builds
