# ARM64 Build Workflow Test Plan

**Date**: 2025-10-02
**Agent**: Quality Engineer #26
**Workflow**: `.github/workflows/test-arm64-build.yml`

## Test Objectives

1. Verify ARM64 cross-compilation workflow functionality
2. Validate build profile configurations
3. Ensure proper cache utilization
4. Confirm artifact handling and diagnostics
5. Test quality gates and validation steps

## Pre-Test Requirements

### Critical Blockers

- [ ] **Dockerfile architecture fixes applied** (CRITICAL)
  - Fix Go installation (lines 40-42)
  - Fix Rust analyzer (line 136)
  - Fix Vector package (line 65)
  - Add TARGETARCH declarations

### Environment Setup

- [ ] GitHub Actions environment available
- [ ] GHCR access configured
- [ ] Docker Buildx with QEMU enabled
- [ ] Sufficient storage for multi-arch builds (>20GB)

## Test Cases

### TC-001: Dockerfile Validation

**Objective**: Verify pre-build architecture validation

**Steps**:
1. Run validation script: `./scripts/validate-arm64-dockerfile.sh`
2. Review output for critical issues
3. Verify TARGETARCH usage detection
4. Confirm hardcoded architecture detection

**Expected Results**:
- ✅ All architecture checks pass
- ✅ TARGETARCH declared and used
- ✅ No hardcoded amd64/x86_64 references
- ✅ Script exits with code 0

**Current Status**: ❌ BLOCKED - Dockerfile fixes required

### TC-002: Minimal Profile Build

**Objective**: Test basic ARM64 build with minimal tooling

**Steps**:
1. Trigger workflow: `workflow_dispatch` with `profile=minimal`
2. Monitor build progress
3. Verify image push to GHCR
4. Check diagnostics artifact

**Expected Results**:
- ✅ Build completes in <20 minutes
- ✅ Image tagged: `test-arm64-minimal-{run_id}`
- ✅ Architecture verified: `linux/arm64`
- ✅ code-server binary functional
- ✅ Node.js and Python functional
- ✅ Diagnostics artifact uploaded

**Success Criteria**:
- Build duration: <20 minutes
- Image size: <800MB
- Cache hit rate: >70% (after first build)

### TC-003: Standard Profile Build

**Objective**: Test ARM64 build with Go toolchain

**Steps**:
1. Trigger workflow: `workflow_dispatch` with `profile=standard`
2. Verify Go installation and architecture
3. Test Go binary execution
4. Validate GOARCH environment

**Expected Results**:
- ✅ Build completes in <35 minutes
- ✅ Go toolchain installed
- ✅ `go version` executes successfully
- ✅ `go env GOARCH` returns `arm64`
- ✅ Goose migration tool functional

**Success Criteria**:
- Build duration: <35 minutes
- Image size: <1.2GB
- Go GOARCH: `arm64`

### TC-004: AI Profile Build

**Objective**: Test ARM64 build with AI extensions

**Steps**:
1. Trigger workflow: `workflow_dispatch` with `profile=ai`
2. Verify AI extensions installed
3. Check LSP server availability
4. Test extension loading

**Expected Results**:
- ✅ Build completes in <60 minutes
- ✅ AI extensions installed (Copilot, Codeium, etc.)
- ✅ LSP servers functional
- ✅ Extension count matches specification

**Success Criteria**:
- Build duration: <60 minutes
- Image size: <1.5GB
- AI extensions: ≥10 installed

### TC-005: Full Profile Build

**Objective**: Test complete ARM64 build with all tooling

**Steps**:
1. Trigger workflow: `workflow_dispatch` with `profile=full`
2. Verify all tools and extensions
3. Test comprehensive functionality
4. Validate build time

**Expected Results**:
- ✅ Build completes in <90 minutes
- ✅ All tooling installed
- ✅ All tests pass
- ✅ Complete diagnostics collected

**Success Criteria**:
- Build duration: <90 minutes
- Image size: <2GB
- All validation tests pass

### TC-006: Dry-Run Mode

**Objective**: Test build without registry push

**Steps**:
1. Trigger workflow: `skip_push=true`
2. Verify build completes
3. Confirm no image push
4. Check diagnostics still collected

**Expected Results**:
- ✅ Build completes successfully
- ✅ Image not pushed to GHCR
- ✅ Image inspection skipped
- ✅ Build diagnostics collected
- ✅ Local build artifacts available

**Success Criteria**:
- Build succeeds without push
- All validation steps completed
- Diagnostics artifact created

### TC-007: Cache Functionality

**Objective**: Verify GitHub Actions cache utilization

**Steps**:
1. Run initial build (cache miss)
2. Note build duration
3. Run second build (cache hit)
4. Compare build durations

**Expected Results**:
- ✅ First build: Full layer builds
- ✅ Second build: Cache hits for unchanged layers
- ✅ Build time reduction: >40%
- ✅ Cache scope: `arm64-test-{profile}`

**Success Criteria**:
- Cache hit rate: >70%
- Build time reduction: >40%
- Cache key uniqueness maintained

### TC-008: Image Inspection

**Objective**: Verify image architecture and metadata

**Steps**:
1. Complete successful build
2. Run image inspection step
3. Verify platform information
4. Check image labels and annotations

**Expected Results**:
- ✅ Platform: `linux/arm64`
- ✅ Architecture: `arm64`
- ✅ OS: `linux`
- ✅ Build metadata present
- ✅ Image digest available

**Success Criteria**:
- Architecture matches target
- All metadata fields populated
- Inspection output in artifacts

### TC-009: Binary Functionality Tests

**Objective**: Validate installed binaries work on ARM64

**Steps**:
1. Build completes successfully
2. Run code-server version check
3. Test Node.js execution
4. Test Python execution
5. Test Go execution (standard+ profiles)

**Expected Results**:
- ✅ code-server: version displayed
- ✅ Node.js: version displayed
- ✅ Python: version displayed
- ✅ Go: version + GOARCH=arm64

**Success Criteria**:
- All binaries execute without error
- Architecture matches target
- Versions match expectations

### TC-010: Error Handling

**Objective**: Verify workflow handles failures gracefully

**Steps**:
1. Introduce intentional build failure
2. Verify error detection
3. Check diagnostic collection
4. Validate failure reporting

**Expected Results**:
- ✅ Build failure detected
- ✅ Diagnostics collected on failure
- ✅ GitHub Actions summary shows error
- ✅ Artifact uploaded with failure info
- ✅ Notification job reports failure

**Success Criteria**:
- Failures detected and reported
- Diagnostics always collected
- Clear error messaging

### TC-011: Concurrency Control

**Objective**: Test workflow concurrency management

**Steps**:
1. Trigger build for profile A
2. Trigger build for profile B (same ref)
3. Trigger build for profile A again
4. Verify cancellation behavior

**Expected Results**:
- ✅ Profile A build 1: cancelled
- ✅ Profile A build 2: runs
- ✅ Profile B build: runs (different profile)
- ✅ Builds isolated by profile

**Success Criteria**:
- Duplicate builds cancelled
- Different profiles run concurrently
- Resources not wasted

### TC-012: Build Diagnostics

**Objective**: Verify diagnostic artifact completeness

**Steps**:
1. Complete any build
2. Download diagnostics artifact
3. Verify contents
4. Check information completeness

**Expected Results**:
- ✅ build-info.txt present
- ✅ buildx-info.txt present
- ✅ image-layers.txt present (if pushed)
- ✅ All metadata accurate

**Success Criteria**:
- All diagnostic files present
- Information complete and accurate
- Artifact downloadable for 7 days

## Integration Tests

### INT-001: Multi-Profile Sequence

**Objective**: Test sequential builds across profiles

**Steps**:
1. Build minimal profile
2. Build standard profile
3. Build AI profile
4. Build full profile

**Expected Results**:
- ✅ All builds succeed
- ✅ Cache shared across profiles
- ✅ No resource conflicts
- ✅ Progressive build times

**Success Criteria**:
- All profiles build successfully
- Cache efficiency improves
- Total time <3 hours

### INT-002: Workflow Integration

**Objective**: Test with other workflows

**Steps**:
1. Trigger ARM64 test workflow
2. Trigger codeserver-multiarch workflow
3. Verify no conflicts
4. Check resource usage

**Expected Results**:
- ✅ Both workflows run
- ✅ No concurrency issues
- ✅ Independent cache scopes
- ✅ No resource exhaustion

**Success Criteria**:
- Workflows run independently
- No cache conflicts
- Resources managed properly

## Performance Benchmarks

### Benchmark Targets

| Profile  | Target Duration | Max Duration | Expected Size |
|----------|----------------|--------------|---------------|
| Minimal  | 15 minutes     | 20 minutes   | <800MB        |
| Standard | 30 minutes     | 35 minutes   | <1.2GB        |
| AI       | 50 minutes     | 60 minutes   | <1.5GB        |
| Full     | 75 minutes     | 90 minutes   | <2GB          |

### Cache Performance

| Build Type    | Expected Cache Hit | Build Time Reduction |
|--------------|-------------------|---------------------|
| First Build  | 0%                | Baseline            |
| Second Build | 70-90%            | >40%                |
| Cross-Profile| 40-60%            | >25%                |

## Quality Gates

### Pre-Build Gates

- [ ] Dockerfile validation passes
- [ ] TARGETARCH declared
- [ ] No hardcoded architectures
- [ ] Base image supports ARM64

### Build Gates

- [ ] Build completes without errors
- [ ] Image pushed successfully (unless skip_push)
- [ ] Cache utilization functional
- [ ] Build time within targets

### Post-Build Gates

- [ ] Architecture verified: linux/arm64
- [ ] code-server binary functional
- [ ] Node.js functional
- [ ] Python functional
- [ ] Go functional (standard+)
- [ ] Diagnostics collected

### Failure Gates

- [ ] Build errors reported clearly
- [ ] Diagnostics collected on failure
- [ ] Artifacts uploaded
- [ ] Notifications sent

## Risk Assessment

### High Risk Areas

1. **Dockerfile Architecture Issues** (CRITICAL)
   - Risk: ARM64 builds fail due to wrong binaries
   - Mitigation: Validation script, pre-build checks
   - Status: BLOCKED until fixes applied

2. **QEMU Performance**
   - Risk: Builds timeout due to slow emulation
   - Mitigation: 90-minute timeout, cache optimization
   - Status: Monitored

3. **Cache Invalidation**
   - Risk: Excessive cache misses slow builds
   - Mitigation: Proper cache scope management
   - Status: Implemented

### Medium Risk Areas

1. **GitHub Actions Quota**
   - Risk: Resource limits reached
   - Mitigation: Concurrency controls, efficient caching
   - Status: Monitored

2. **Image Size Growth**
   - Risk: Images exceed size targets
   - Mitigation: Layer optimization, profile separation
   - Status: Monitored

## Test Execution Schedule

### Phase 1: Validation (Day 1)
- [ ] TC-001: Dockerfile validation
- [ ] Apply Dockerfile fixes
- [ ] Re-validate

### Phase 2: Basic Functionality (Day 1-2)
- [ ] TC-002: Minimal profile
- [ ] TC-006: Dry-run mode
- [ ] TC-007: Cache functionality

### Phase 3: Profile Testing (Day 2-3)
- [ ] TC-003: Standard profile
- [ ] TC-004: AI profile
- [ ] TC-005: Full profile

### Phase 4: Advanced Testing (Day 3-4)
- [ ] TC-008: Image inspection
- [ ] TC-009: Binary functionality
- [ ] TC-010: Error handling
- [ ] TC-011: Concurrency control
- [ ] TC-012: Build diagnostics

### Phase 5: Integration (Day 4-5)
- [ ] INT-001: Multi-profile sequence
- [ ] INT-002: Workflow integration
- [ ] Performance benchmarking

## Test Environment

### GitHub Actions Configuration

```yaml
Runner: ubuntu-latest
Timeout: 90 minutes
Permissions:
  contents: read
  packages: write
Resources:
  CPU: 2 cores
  Memory: 7GB
  Storage: 14GB
```

### Docker Configuration

```bash
Buildx: latest
QEMU: v3
Platforms: linux/arm64
Cache: GitHub Actions cache
```

## Success Criteria

### Must Have (P0)
- ✅ All critical issues fixed
- ✅ Minimal profile builds successfully
- ✅ Architecture correctly verified
- ✅ Binary functionality tests pass

### Should Have (P1)
- ✅ All profiles build successfully
- ✅ Cache utilization >70%
- ✅ Build times within targets
- ✅ Diagnostics comprehensive

### Nice to Have (P2)
- ✅ Performance benchmarks met
- ✅ Integration tests pass
- ✅ Documentation complete
- ✅ Monitoring in place

## Sign-Off Criteria

Before marking workflow as production-ready:

1. [ ] All P0 test cases pass
2. [ ] All P1 test cases pass
3. [ ] Performance benchmarks met
4. [ ] Documentation complete
5. [ ] Code review approved
6. [ ] Stakeholder approval

## Test Results Template

```markdown
## Test Execution Results

**Date**: YYYY-MM-DD
**Tester**: Name
**Environment**: GitHub Actions

### Test Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X
- Pass Rate: X%

### Critical Findings
1. [Finding description]
2. [Finding description]

### Performance Metrics
| Profile  | Duration | Size  | Cache Hit |
|----------|----------|-------|-----------|
| Minimal  | Xm Ys    | XMB   | X%        |
| Standard | Xm Ys    | XMB   | X%        |
| AI       | Xm Ys    | XMB   | X%        |
| Full     | Xm Ys    | XMB   | X%        |

### Recommendations
1. [Recommendation]
2. [Recommendation]

### Sign-Off
- [ ] Quality Engineer
- [ ] DevOps Lead
- [ ] Platform Owner
```

## Appendix

### Useful Commands

```bash
# Validate Dockerfile
./scripts/validate-arm64-dockerfile.sh

# Trigger workflow via GitHub CLI
gh workflow run test-arm64-build.yml -f profile=minimal

# Check workflow status
gh run list --workflow=test-arm64-build.yml

# Download diagnostics
gh run download <run-id> -n arm64-build-diagnostics-minimal-<run-id>

# Inspect image
docker buildx imagetools inspect ghcr.io/owner/vibecode-codeserver:test-arm64-minimal-<run-id>

# Pull and test image
docker pull --platform linux/arm64 ghcr.io/owner/vibecode-codeserver:test-arm64-minimal-<run-id>
docker run --rm --platform linux/arm64 ghcr.io/owner/vibecode-codeserver:test-arm64-minimal-<run-id> code-server --version
```

### Reference Documentation

- Docker Buildx: https://docs.docker.com/build/buildx/
- QEMU Setup: https://github.com/docker/setup-qemu-action
- GitHub Actions Cache: https://docs.github.com/en/actions/using-workflows/caching-dependencies
- Multi-Architecture Builds: https://docs.docker.com/build/building/multi-platform/

---

**Next Steps**:
1. Apply Dockerfile architecture fixes (CRITICAL)
2. Execute Phase 1 validation tests
3. Proceed with Phase 2-5 testing
4. Document results and sign-off
