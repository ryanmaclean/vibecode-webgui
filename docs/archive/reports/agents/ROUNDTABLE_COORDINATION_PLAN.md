# 🤖 Roundtable Multi-Agent Coordination Plan

**Date**: October 24, 2025, 1:40 AM  
**Strategy**: Coordinate Claude, Gemini, and Codex via MCP Roundtable  
**Method**: Parallel execution with persona assignment

---

## 🎯 Roundtable Session Overview

### **Session Goal**: Fix All Technical Debt Properly

**Issues**: #657-#661 (6 GitHub issues)  
**Agents**: Claude (Cascade), Gemini, Codex  
**Duration**: 6-8 hours  
**Method**: Roundtable-AI coordination via MCP

---

## 🤖 Agent-to-Persona Mapping

### **Track 1: Claude (Cascade) - Coordinator + Logger**
**Personas**: 
1. **Orchestrator** - Overall coordination
2. **Logger Specialist** - Issue #657

**Responsibilities**:
- Coordinate all agents via roundtable
- Design and implement proper logger (Pino)
- Restore logging to 316 files
- Integrate Datadog
- Monitor all tracks

**Worktrees**: 
- Main: `/Users/studio/Documents/vibecode-webgui`
- Logger: `/Users/studio/.code/working/vibecode-webgui/fixes/logger`

**Commands**:
```bash
cd /Users/studio/.code/working/vibecode-webgui/fixes/logger
gh issue view 657
# Implement Pino logger without circular deps
```

---

### **Track 2: Gemini - TypeScript + Testing**
**Personas**:
1. **TypeScript Specialist** - Issue #658
2. **Testing Specialist** - Issue #661

**Responsibilities**:
- Enable TypeScript validation
- Fix all type errors
- Merge test infrastructure
- Run full test suite

**Worktrees**:
- TypeScript: `/Users/studio/.code/working/vibecode-webgui/fixes/typescript`
- Tests: `/Users/studio/.code/working/vibecode-webgui/fixes/tests`

**Commands**:
```bash
# TypeScript track
cd /Users/studio/.code/working/vibecode-webgui/fixes/typescript
npm run build 2>&1 | grep error
# Fix each error

# Testing track
cd /Users/studio/.code/working/vibecode-webgui/fixes/tests
git show origin/codex/salvage-2025-10-24:tests/e2e/auth-flow.test.ts > tests/e2e/auth-flow.test.ts
```

---

### **Track 3: Codex - Features + Merge**
**Personas**:
1. **WebSocket Specialist** - Issue #658
2. **Merge Specialist** - Issue #661
3. **VSCode Specialist** - Issue #661

**Responsibilities**:
- Restore file sync route (374 lines)
- Debug console.log issue
- Merge TypeScript fix branches
- Verify VSCode extension

**Worktrees**:
- File Sync: `/Users/studio/.code/working/vibecode-webgui/fixes/filesync`
- Merge: `/Users/studio/.code/working/vibecode-webgui/fixes/merge-ts`
- VSCode: `/Users/studio/.code/working/vibecode-webgui/fixes/vscode`

**Commands**:
```bash
# File Sync track
cd /Users/studio/.code/working/vibecode-webgui/fixes/filesync
git show HEAD~10:src/app/api/files/sync/route.ts > src/app/api/files/sync/route.ts

# Merge track
cd /Users/studio/.code/working/vibecode-webgui/fixes/merge-ts
git merge origin/fix/typescript-critical-errors

# VSCode track
cd /Users/studio/.code/working/vibecode-webgui/fixes/vscode
cd extensions/vibecode-ai-assistant && npm run compile
```

---

## 📋 Roundtable Task Assignments

### **Phase 1: Setup (Orchestrator - Claude)**
```bash
# Create all worktrees
cd /Users/studio/.code/working/vibecode-webgui
git worktree add fixes/logger -b fix/restore-proper-logger origin/main
git worktree add fixes/typescript -b fix/enable-type-validation origin/main
git worktree add fixes/filesync -b fix/restore-file-sync origin/main
git worktree add fixes/tests -b feat/merge-test-infrastructure origin/main
git worktree add fixes/merge-ts -b feat/merge-typescript-fixes origin/main
git worktree add fixes/vscode -b feat/verify-vscode-extension origin/main

# Verify roundtable agents
./scripts/roundtable/run-roundtable.sh --agents codex,gemini
cat ~/.roundtable/availability_check.json
```

**Deliverable**: All worktrees created, agents verified

---

### **Phase 2: Parallel Execution**

#### **Task 1: Logger (Claude)** - Issue #657
**Priority**: 🔴 CRITICAL  
**Duration**: 4-6 hours  
**Dependencies**: None

**Steps**:
1. Design Pino logger architecture
   ```typescript
   // src/lib/logger-new.ts
   import pino from 'pino';
   
   export const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     transport: {
       target: 'pino-pretty'
     }
   });
   ```

2. Create migration script:
   ```bash
   # scripts/migrate-to-pino.sh
   find src -name "*.ts" -o -name "*.tsx" | while read file; do
     sed -i '' 's|// import { logger }|import { logger }|g' "$file"
   done
   ```

3. Test Datadog integration
4. Verify build compiles
5. Create PR

**Acceptance**: 316 files working, Datadog connected, build green

---

#### **Task 2: File Sync (Codex)** - Issue #658
**Priority**: 🟡 HIGH  
**Duration**: 3-4 hours  
**Dependencies**: Logger (soft)

**Steps**:
1. Restore route from git:
   ```bash
   git log --all --full-history -- "**/files/sync/route.ts"
   git show <commit>:src/app/api/files/sync/route.ts > src/app/api/files/sync/route.ts
   ```

2. Debug `console.log(...) is not a function`:
   - Check for console redefinition
   - Look for webpack issues
   - Test in isolation

3. Fix WebSocket initialization
4. Add tests
5. Create PR

**Acceptance**: Route restored, WebSockets working, tests pass

---

#### **Task 3: TypeScript Validation (Gemini)** - Issue #658
**Priority**: 🟡 HIGH  
**Duration**: 6-8 hours  
**Dependencies**: Logger (blocks some errors)

**Steps**:
1. Enable validation in `next.config.js`:
   ```javascript
   typescript: {
     ignoreBuildErrors: false  // Enable!
   }
   ```

2. Run build, collect errors:
   ```bash
   npm run build 2>&1 | grep "error TS" > typescript-errors.txt
   ```

3. Fix systematically:
   - Import errors first
   - Type mismatches second
   - Strict null checks third

4. Enable linting
5. Create PR

**Acceptance**: Zero type errors, lint passing, validation enabled

---

#### **Task 4: Test Infrastructure (Gemini)** - Issue #661
**Priority**: 🟢 MEDIUM  
**Duration**: 2-3 hours  
**Dependencies**: None

**Steps**:
1. Cherry-pick test files:
   ```bash
   for test in tests/e2e/auth-flow.test.ts tests/integration/*.test.ts; do
     git show origin/codex/salvage-2025-10-24:$test > $test
   done
   ```

2. Install dependencies:
   ```bash
   npm install --save-dev @playwright/test
   ```

3. Run tests:
   ```bash
   npm run test
   npm run test:e2e
   ```

4. Fix failures
5. Create PR

**Acceptance**: All tests pass, CI configured

---

#### **Task 5: Merge TS Fixes (Codex)** - Issue #661
**Priority**: 🟢 MEDIUM  
**Duration**: 2-3 hours  
**Dependencies**: None

**Steps**:
1. Merge first branch:
   ```bash
   git merge origin/fix/typescript-critical-errors
   ```

2. Resolve conflicts
3. Merge second branch:
   ```bash
   git merge origin/preserve/type-safety-improvements
   ```

4. Test build
5. Create PR

**Acceptance**: Both branches merged, build green

---

#### **Task 6: VSCode Extension (Codex)** - Issue #661
**Priority**: 🟢 MEDIUM  
**Duration**: 1-2 hours  
**Dependencies**: None

**Steps**:
1. Build extension:
   ```bash
   cd extensions/vibecode-ai-assistant
   npm install
   npm run compile
   ```

2. Package:
   ```bash
   npx vsce package
   ```

3. Test in VS Code:
   ```bash
   code --install-extension vibecode-ai-assistant-*.vsix
   ```

4. Document features
5. Create PR

**Acceptance**: Extension installs, all commands work

---

### **Phase 3: Integration (Orchestrator - Claude)**

**After all PRs complete**:

1. **Merge order**:
   ```bash
   # 1. Logger (unblocks everything)
   gh pr merge <logger-pr> --squash
   
   # 2. TypeScript (enables validation)
   gh pr merge <typescript-pr> --squash
   
   # 3. Tests (adds coverage)
   gh pr merge <tests-pr> --squash
   
   # 4. File Sync (restores features)
   gh pr merge <filesync-pr> --squash
   
   # 5. Merge TS (additional fixes)
   gh pr merge <merge-ts-pr> --squash
   
   # 6. VSCode (polish)
   gh pr merge <vscode-pr> --squash
   ```

2. **Final integration test**:
   ```bash
   cd /Users/studio/Documents/vibecode-webgui
   git pull origin main
   npm install
   npm run build
   npm run test
   npm run test:e2e
   ```

3. **Verify all features**:
   - ✅ Logging works
   - ✅ File sync operational
   - ✅ Type validation enabled
   - ✅ All tests pass
   - ✅ VSCode extension functional

4. **Create final report**

---

## 🔄 Communication Protocol

### **Roundtable Updates** (Every 2 Hours)

```bash
# Each agent runs
./scripts/roundtable/run-roundtable.sh --agents codex,gemini

# Check status
cat ~/.roundtable/availability_check.json

# Update progress in issues
gh issue comment <issue-num> --body "Status update: ..."
```

### **Blocker Resolution**

1. Post in issue comments
2. Tag relevant agents
3. Orchestrator (Claude) coordinates
4. Escalate to human if blocked > 30min

### **PR Review Process**

```bash
# Create PR
gh pr create --title "[Agent]: [Task]" --body "Fixes #<issue>"

# Request review from orchestrator
gh pr review <pr-num> --comment --body "@orchestrator Ready for review"

# After approval
gh pr merge <pr-num> --squash
```

---

## 📊 Progress Dashboard

| Track | Agent | Task | Status | PR | Merged |
|-------|-------|------|--------|-----|--------|
| 1 | Claude | Logger (#657) | 🟡 Starting | - | - |
| 2 | Codex | File Sync (#658) | 🟡 Starting | - | - |
| 3 | Gemini | TypeScript (#658) | 🟡 Starting | - | - |
| 4 | Gemini | Tests (#661) | 🟡 Starting | - | - |
| 5 | Codex | Merge TS (#661) | 🟡 Starting | - | - |
| 6 | Codex | VSCode (#661) | 🟡 Starting | - | - |

**Legend**:
- 🟡 Starting
- 🔵 In Progress  
- 🟢 PR Created
- ✅ Merged
- 🔴 Blocked

---

## 🎯 Success Criteria

### **Individual Tracks**
- [ ] Logger: 316 files functional, Datadog working
- [ ] File Sync: 374 lines restored, WebSockets operational
- [ ] TypeScript: Zero errors, validation enabled
- [ ] Tests: Full suite passing, CI configured
- [ ] Merge: Both branches integrated
- [ ] VSCode: Extension packaged and verified

### **Integration**
- [ ] All 6 PRs merged
- [ ] Build compiles with all fixes
- [ ] All tests pass
- [ ] Type validation enabled
- [ ] Linting passes
- [ ] Zero technical debt
- [ ] All features working

---

## 🚀 Quick Start Commands

### **For Orchestrator (Claude)**
```bash
# Setup
cd /Users/studio/Documents/vibecode-webgui
./scripts/roundtable/run-roundtable.sh --agents codex,gemini

# Monitor
watch -n 120 'gh pr list --json number,title,state'

# Integrate
./scripts/integrate-all-prs.sh
```

### **For Gemini**
```bash
# TypeScript track
cd /Users/studio/.code/working/vibecode-webgui/fixes/typescript
gh issue view 658
npm run build 2>&1 | tee typescript-errors.log
# Fix errors

# Testing track  
cd /Users/studio/.code/working/vibecode-webgui/fixes/tests
gh issue view 661
# Cherry-pick tests
```

### **For Codex**
```bash
# File Sync track
cd /Users/studio/.code/working/vibecode-webgui/fixes/filesync
gh issue view 658
git log --all -- "**/files/sync/route.ts"
# Restore route

# Merge track
cd /Users/studio/.code/working/vibecode-webgui/fixes/merge-ts
git merge origin/fix/typescript-critical-errors

# VSCode track
cd /Users/studio/.code/working/vibecode-webgui/fixes/vscode
cd extensions/vibecode-ai-assistant && npm run compile
```

---

## 📝 Roundtable Session Commands

### **Start Session**
```bash
cd /Users/studio/Documents/vibecode-webgui
export CLI_MCP_WORKING_DIR="$PWD"
export CLI_MCP_SUBAGENTS="codex,gemini"

uvx --python python3.13 roundtable-ai@latest --check
```

### **Assign Tasks**
```bash
# Via GitHub issues (already created)
gh issue view 657  # Logger - Claude
gh issue view 658  # File Sync - Codex
gh issue view 658  # TypeScript - Gemini
gh issue view 661  # Tests - Gemini
gh issue view 661  # Merge - Codex
gh issue view 661  # VSCode - Codex
```

### **Monitor Progress**
```bash
# Check worktrees
git worktree list

# Check PRs
gh pr list

# Check agent availability
cat ~/.roundtable/availability_check.json
```

---

## 🎊 We've Got This!

**6 parallel agents** × **6 critical issues** = **Fully fixed codebase**

**No shortcuts. No workarounds. Proper fixes coordinated via MCP Roundtable.**

Let's ship it! 🚀
