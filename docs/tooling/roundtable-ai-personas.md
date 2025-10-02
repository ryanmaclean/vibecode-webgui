# Roundtable-AI Multi-Persona Approach for Code-Server Build

**Status**: Documented (Roundtable-AI MCP not currently connected)  
**Date**: 2025-10-01  
**Problem**: Complete code-server v1.1.0 multi-profile build and deployment

## 🤖 The 5 Personas

### Persona 1: DevOps Engineer (@devops-agent)
**Specialty**: CI/CD, GitHub Actions, Docker, Kubernetes  
**Responsibility**: Fix and optimize build infrastructure

**Tasks**:
- [ ] Fix GitHub Actions workflow (Docker Hub credentials issue)
- [ ] Make Docker Hub push optional (use only GHCR if secrets missing)
- [ ] Optimize workflow caching strategy
- [ ] Set up build monitoring and alerts
- [ ] Create rollback procedures

**GitHub Issue**: #410 (Build infrastructure)

**Commands**:
```bash
# Fix workflow
vim .github/workflows/codeserver-profiles.yml

# Test workflow locally
act workflow_dispatch -W .github/workflows/codeserver-profiles.yml

# Trigger fixed workflow
gh workflow run codeserver-profiles.yml -f profiles="web,full" -f version="1.1.0" -f push_to_dockerhub=false
```

---

### Persona 2: Build Engineer (@build-agent)
**Specialty**: Docker, Multi-arch builds, BuildKit, Registry management  
**Responsibility**: Execute and monitor all builds

**Tasks**:
- [ ] Monitor current builds (web, full profiles)
- [ ] Retry failed builds with correct configuration
- [ ] Verify all images pushed to registries
- [ ] Check image sizes and layer optimization
- [ ] Generate build reports

**GitHub Issue**: #410 (Build execution)

**Commands**:
```bash
# Check build status
gh run list --workflow="codeserver-profiles.yml"

# Monitor specific run
gh run watch <run-id>

# Verify images
for profile in minimal standard ai web full; do
  docker manifest inspect ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-$profile
done
```

---

### Persona 3: QA Engineer (@qa-agent)
**Specialty**: Testing, Verification, Quality Assurance  
**Responsibility**: Verify all tools and create test suites

**Tasks**:
- [ ] Create comprehensive verification script
- [ ] Test all profiles on both architectures (amd64, arm64)
- [ ] Verify all CLI tools work correctly
- [ ] Test VS Code extensions load properly
- [ ] Create automated test suite for future builds

**GitHub Issue**: Create new issue for QA tasks

**Deliverable**: `scripts/verify-code-server-profiles.sh`

**Commands**:
```bash
# Create verification script
cat > scripts/verify-code-server-profiles.sh << 'EOF'
#!/bin/bash
# Comprehensive verification for all profiles
set -e

PROFILES=("minimal" "standard" "ai" "web" "full")
VERSION="1.1.0"

for profile in "${PROFILES[@]}"; do
  echo "=== Testing $profile profile ==="
  
  # Test amd64
  docker run --rm --platform linux/amd64 \
    ghcr.io/ryanmaclean/vibecode-codeserver:${VERSION}-${profile} \
    bash -c "
      aider --version && goose -version &&
      kubectl version --client && helm version
    "
  
  # Test arm64
  docker run --rm --platform linux/arm64 \
    ghcr.io/ryanmaclean/vibecode-codeserver:${VERSION}-${profile} \
    bash -c "
      aider --version && goose -version
    "
  
  echo "✅ $profile verified"
done
EOF

chmod +x scripts/verify-code-server-profiles.sh
./scripts/verify-code-server-profiles.sh
```

---

### Persona 4: Documentation Specialist (@docs-agent)
**Specialty**: Technical writing, Documentation, User guides  
**Responsibility**: Create comprehensive documentation

**Tasks**:
- [ ] Create CHANGELOG.md (v1.0.0 → v1.1.0)
- [ ] Update README.md with profile examples
- [ ] Write deployment guide
- [ ] Create troubleshooting runbook
- [ ] Document all fixed issues

**GitHub Issue**: #411 (Documentation)

**Files to Create/Update**:
```bash
# CHANGELOG.md
docker/code-server/CHANGELOG.md

# Deployment guide
docker/code-server/DEPLOYMENT_GUIDE.md

# Troubleshooting
docker/code-server/TROUBLESHOOTING.md

# Update README
README.md (add profile section)
```

**Template for CHANGELOG.md**:
```markdown
# Changelog

## [1.1.0] - 2025-10-01

### Added
- Multi-profile support (minimal, standard, ai, web, full)
- DevOps tools (kubectl, helm, k9s, stern, helmfile, sops, glab)
- Shell enhancements (nushell, delta, chezmoi, just)
- Multi-registry support (GHCR + Docker Hub)
- GitHub Actions workflow for automated builds

### Fixed
- Goose installation (GOBIN=/usr/local/bin)
- Tool tar extraction (find + cp approach)
- k9s version 404 error (0.50.13)
- glab version 404 error (1.22.0)
- KUBECTL_ARCH variable scoping
- Strict verification (build fails if tools missing)

### Changed
- Optimized Dockerfile (26 RUN → 1 RUN for extensions)
- Implemented BuildKit cache mounts
- Multi-arch builds (amd64 + arm64)

### Performance
- Build time reduced by ~40% with caching
- Image sizes optimized per profile
- Parallel builds via GitHub Actions
```

---

### Persona 5: Coordinator (@coordinator-agent)
**Specialty**: Project management, Integration, Communication  
**Responsibility**: Coordinate all personas and track progress

**Tasks**:
- [ ] Update TODO.md with all persona assignments
- [ ] Track progress via GitHub issues
- [ ] Coordinate handoffs between personas
- [ ] Resolve blockers and dependencies
- [ ] Create final deployment report

**GitHub Issue**: Create coordination issue

**Coordination Dashboard**: `docker/code-server/BUILD_STATUS.md`

**Commands**:
```bash
# Update TODO.md
vim TODO.md

# Check all issues
gh issue list --label "code-server"

# Update BUILD_STATUS.md
vim docker/code-server/BUILD_STATUS.md

# Generate final report
cat > docker/code-server/FINAL_REPORT.md << 'EOF'
# Code-Server v1.1.0 Final Deployment Report
...
EOF
```

---

## 🔄 Workflow with Roundtable-AI

### When Roundtable-AI is Connected:

```python
# Example usage (when MCP is available)
from roundtable_ai import create_session, assign_task

# Create session with 5 personas
session = create_session(
    agents=['codex', 'cursor', 'gemini'],
    personas=[
        {'name': 'devops-agent', 'role': 'DevOps Engineer'},
        {'name': 'build-agent', 'role': 'Build Engineer'},
        {'name': 'qa-agent', 'role': 'QA Engineer'},
        {'name': 'docs-agent', 'role': 'Documentation Specialist'},
        {'name': 'coordinator-agent', 'role': 'Coordinator'}
    ]
)

# Assign tasks in parallel
tasks = [
    assign_task(session, 'devops-agent', 'Fix GitHub Actions workflow'),
    assign_task(session, 'build-agent', 'Monitor and retry builds'),
    assign_task(session, 'qa-agent', 'Create verification scripts'),
    assign_task(session, 'docs-agent', 'Update documentation'),
    assign_task(session, 'coordinator-agent', 'Track progress')
]

# Wait for completion
results = await session.execute_parallel(tasks)

# Integrate results
final_report = session.integrate(results)
```

### Current Workaround (Without Roundtable-AI):

1. **GitHub Issues** for task distribution
2. **TODO.md** for progress tracking
3. **Sequential execution** with clear handoffs
4. **Documentation** for future agent pickup

---

## 📊 Progress Tracking

### Persona Status Matrix:

| Persona | Status | Progress | Blocker | ETA |
|---------|--------|----------|---------|-----|
| DevOps Engineer | 🔨 Active | Fixing workflow | Docker Hub secrets | 10 min |
| Build Engineer | ⏸️ Blocked | Waiting for fix | Workflow issue | After DevOps |
| QA Engineer | ✅ Ready | Can start now | None | 30 min |
| Docs Specialist | ✅ Ready | Can start now | None | 45 min |
| Coordinator | 🔨 Active | Tracking | None | Ongoing |

---

## 🎯 Success Criteria

- [ ] All 5 profiles built and pushed to GHCR
- [ ] All profiles verified on both architectures
- [ ] Complete documentation (CHANGELOG, guides, troubleshooting)
- [ ] Automated verification scripts created
- [ ] Final deployment report generated

---

## 🔗 Integration Points

### Between Personas:

1. **DevOps → Build**: Fixed workflow enables builds
2. **Build → QA**: Completed builds enable testing
3. **QA → Docs**: Test results inform documentation
4. **All → Coordinator**: Status updates for tracking

### Via GitHub:

- **Issues**: #410 (builds), #411 (docs), new QA issue
- **Pull Requests**: For workflow fixes and documentation
- **Actions**: Automated builds and tests
- **Projects**: Track overall progress

---

## 📝 Notes

- **Roundtable-AI Status**: Installed but not connected (requires IDE restart)
- **Current Approach**: Manual coordination via GitHub + TODO.md
- **Future Enhancement**: Enable roundtable-ai for true parallel execution
- **Lessons Learned**: Document for future multi-agent tasks

---

## 🚀 Quick Start (When Roundtable-AI Available)

```bash
# 1. Restart IDE to load roundtable-ai MCP
# 2. Verify connection
uvx --python python3.11 roundtable-ai@latest --version

# 3. Create session
roundtable-ai create-session --personas 5 --project "code-server-v1.1.0"

# 4. Assign tasks
roundtable-ai assign --persona devops-agent --task "Fix GitHub Actions"
roundtable-ai assign --persona build-agent --task "Monitor builds"
roundtable-ai assign --persona qa-agent --task "Create tests"
roundtable-ai assign --persona docs-agent --task "Update docs"
roundtable-ai assign --persona coordinator-agent --task "Track progress"

# 5. Execute
roundtable-ai execute --parallel

# 6. Get results
roundtable-ai report --format markdown > FINAL_REPORT.md
```
