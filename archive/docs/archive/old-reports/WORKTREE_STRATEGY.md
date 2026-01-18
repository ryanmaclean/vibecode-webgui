# Worktree Strategy - Multi-Agent Parallel Work

**Date**: October 24, 2025, 12:10 AM  
**Strategy**: Use worktrees to fix critical issues without blocking VM/Lima work

---

## Current Situation

### Active Work Streams

1. **VM/Lima/vfkit Development** (Multiple agents)
   - `scripts/initramfs-builder/` - 15+ scripts for VM management
   - `GENAI_VM_QUICK_REFERENCE.md` - GenAI VM setup
   - `docs/genai-vm-setup.md` - Documentation
   - Lima kernel testing and optimization
   - Alpine/Busybox VM builds

2. **Build Issues** (This agent)
   - Logger circular dependency breaking build
   - 57 unmerged commits across 4 branches
   - Need to consolidate without breaking VM work

---

## Worktree Architecture

### Main Workspace
**Path**: `/Users/studio/Documents/vibecode-webgui`  
**Branch**: `main`  
**Purpose**: Primary development, VM/Lima work continues here  
**Status**: Build failing, but VM scripts functional

### Fix Worktrees

#### 1. Build Fix Worktree ⭐
**Path**: `~/.code/working/vibecode-webgui/fixes/build-fix`  
**Branch**: `fix/logger-circular-dependency`  
**Purpose**: Fix the logger circular dependency  
**Tasks**:
- Run `npx madge --circular --extensions ts,tsx src/`
- Identify the exact circular dependency
- Break the cycle
- Test build succeeds
- Create PR to main

#### 2. Merge Consolidation Worktree
**Path**: `~/.code/working/vibecode-webgui/fixes/merge-branches`  
**Branch**: `fix/merge-all-branches`  
**Purpose**: Merge all 57 remaining commits  
**Tasks**:
- Merge `origin/chore/health-route-test-fix`
- Merge `origin/codex/salvage-2025-10-24`
- Merge `origin/fix/typescript-critical-errors` (remaining 3 commits)
- Merge `origin/preserve/type-safety-improvements`
- Resolve conflicts
- Test build
- Create PR to main

### Existing Agent Worktrees (Keep As-Is)

```
code-claude-must-integrate-all: 9b765cab4
code-claude-review-outstanding-repo: a8956cdf8
code-claude-second-wave-agents: a8956cdf8
code-claude-third-batch--continue: a8956cdf8
code-cloud-must-integrate-all: a8956cdf8
code-cloud-review-outstanding-repo: a8956cdf8
code-cloud-second-wave-agents: c46900578
code-code-must-integrate-all: c46900578
code-code-review-outstanding-repo: c46900578
code-code-second-wave-agents: c46900578
code-code-third-batch--continue: c46900578
code-gemini-must-integrate-all: c46900578
code-gemini-review-outstanding-repo: c46900578
code-gemini-second-wave-agents: c46900578
```

---

## Workflow

### Phase 1: Fix Logger (Parallel to VM work)

```bash
# In build-fix worktree
cd ~/.code/working/vibecode-webgui/fixes/build-fix

# Find circular dependency
npx madge --circular --extensions ts,tsx src/ > circular-deps.txt
cat circular-deps.txt

# Fix the identified cycle
# Most likely candidates:
# - src/lib/logger.ts
# - src/lib/db/connection-pool-alerts.ts
# - src/lib/monitoring.ts

# Test
npm run build

# If successful, commit and push
git add -A
git commit -m "fix: Break logger circular dependency"
git push origin fix/logger-circular-dependency

# Create PR to main
```

### Phase 2: Merge Remaining Branches (After logger fix)

```bash
# In merge-branches worktree
cd ~/.code/working/vibecode-webgui/fixes/merge-branches

# Pull latest main (with logger fix)
git pull origin main

# Merge remaining branches
git merge origin/chore/health-route-test-fix --no-ff -m "feat: Merge health route fixes"
git merge origin/codex/salvage-2025-10-24 --no-ff -m "feat: Merge salvaged work"
git merge origin/fix/typescript-critical-errors --no-ff -m "feat: Merge remaining TS fixes"
git merge origin/preserve/type-safety-improvements --no-ff -m "feat: Merge type safety improvements"

# Resolve conflicts if any
# Test build
npm run build

# Push
git push origin fix/merge-all-branches

# Create PR to main
```

### Phase 3: Update All Worktrees

```bash
# After both PRs merged to main
for worktree in ~/.code/working/vibecode-webgui/branches/code-*; do
  cd "$worktree"
  git fetch origin
  git rebase origin/main
done

# Clean up fix worktrees
cd /Users/studio/Documents/vibecode-webgui
git worktree remove ~/.code/working/vibecode-webgui/fixes/build-fix
git worktree remove ~/.code/working/vibecode-webgui/fixes/merge-branches
git branch -d fix/logger-circular-dependency
git branch -d fix/merge-all-branches
```

---

## Benefits

### ✅ Non-Blocking
- VM/Lima work continues in main workspace
- Build fixes happen in isolated worktree
- Merge consolidation happens in separate worktree
- No conflicts between agents

### ✅ Safe
- Each worktree is independent
- Can test builds without affecting main
- Easy to discard if approach doesn't work
- PRs provide review gate before merging

### ✅ Parallel
- Multiple agents can work simultaneously
- Build fix and merges can happen at same time
- VM work doesn't wait for build fixes
- Fast iteration cycles

---

## Quick Reference

### Create new fix worktree
```bash
git worktree add ~/.code/working/vibecode-webgui/fixes/my-fix -b fix/my-branch main
```

### List all worktrees
```bash
git worktree list
```

### Remove worktree
```bash
git worktree remove ~/.code/working/vibecode-webgui/fixes/my-fix
git branch -d fix/my-branch
```

### Check worktree status
```bash
cd ~/.code/working/vibecode-webgui/fixes/my-fix
git status
npm run build
```

---

## VM/Lima Work (Separate Track)

While fixes happen in worktrees, VM work continues:

### Active Scripts
- `scripts/initramfs-builder/01-setup-vfkit.sh` - vfkit installation
- `scripts/initramfs-builder/02-download-alpine-kernel.sh` - kernel download
- `scripts/initramfs-builder/03-create-alpine-rootfs.sh` - rootfs creation
- `scripts/initramfs-builder/04-launch-alpine-vm.sh` - VM launch
- `scripts/initramfs-builder/05-launch-vibecode-vm.sh` - VibeCode VM
- `scripts/initramfs-builder/06-create-vibecode-rootfs.sh` - Custom rootfs
- `scripts/initramfs-builder/07-create-persistent-vm.sh` - Persistent storage
- `scripts/initramfs-builder/build-ai-tools-vm.sh` - AI tools integration

### Documentation
- `GENAI_VM_QUICK_REFERENCE.md`
- `docs/genai-vm-setup.md`
- `scripts/initramfs-builder/README.md`
- `scripts/initramfs-builder/QUICK_START.md`
- `scripts/initramfs-builder/SETUP_SUMMARY.md`

**These continue development without waiting for build fixes.**

---

## Status Tracking

| Task | Worktree | Status | Next Action |
|------|----------|--------|-------------|
| Fix logger circular dependency | `fixes/build-fix` | 🟡 Created | Run madge, identify cycle |
| Merge 57 commits | `fixes/merge-branches` | 🟡 Created | Wait for logger fix |
| VM/Lima development | `main` | 🟢 Active | Continue work |
| Agent worktrees | `branches/code-*` | 🟡 Mixed | Update after fixes |

---

## Next Steps

1. **In build-fix worktree**: Run madge, fix circular dependency
2. **Test**: Ensure build succeeds
3. **PR**: Create PR from fix/logger-circular-dependency to main
4. **In merge-branches worktree**: Merge all remaining branches
5. **PR**: Create PR from fix/merge-all-branches to main
6. **Update**: Sync all 14 agent worktrees with latest main
7. **Verify**: Zero unmerged commits remain

---

**Timeline**: 2-3 hours total (parallel work possible)  
**Risk**: Low (isolated worktrees, PR review gates)  
**Benefit**: All code consolidated, build fixed, agents unblocked
