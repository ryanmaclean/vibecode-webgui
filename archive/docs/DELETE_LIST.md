# DELETE LIST - Files to Remove Permanently

**Generated:** 2026-01-14
**Purpose:** Files that should be deleted and added to .gitignore

---

## Summary

These files are **generated artifacts** or **runtime data** that should never be in version control. They will be:
1. Deleted from git history (if committed)
2. Added to `.gitignore` to prevent re-addition
3. Regenerated as needed during builds

**Total Space to Recover:** ~4GB

---

## Build Artifacts

### Node.js (2.2GB)
```
node_modules/                    # npm dependencies - regenerate with npm install
package-lock.json                # Keep in git, but can regenerate
```

### Rust/Tauri
```
src-tauri/target/                # Cargo build artifacts
src-tauri/.cargo/                # Cargo cache
```

### Swift
```
platforms/macos/vm/.build/       # Swift build artifacts
azure/SwiftUI-Apps/.build/       # Swift build artifacts
*.swiftmodule                    # Compiled Swift modules
*.swiftdoc                       # Swift documentation
DerivedData/                     # Xcode derived data
```

### General
```
build/                           # Build output
releases/                        # Release artifacts
bin/                             # Compiled binaries
*.dylib                          # Dynamic libraries
*.so                             # Shared objects
*.a                              # Static libraries
```

---

## Test Output (635MB)

```
test-results/                    # Playwright test results (5MB)
playwright-report/               # HTML reports
coverage/                        # Jest coverage (130MB)
.nyc_output/                     # Coverage data
*.lcov                           # Coverage files
```

---

## Runtime Data (500MB+)

### Application Data
```
data/uploads/                    # User uploaded files
data/workspaces/                 # Workspace data
data/cache/                      # Application cache
*.db                             # SQLite databases (if runtime)
*.sqlite                         # SQLite databases
```

### Logs
```
logs/                            # Application logs (20MB)
*.log                            # Individual log files
npm-debug.log*                   # npm debug logs
yarn-debug.log*                  # yarn debug logs
yarn-error.log*                  # yarn error logs
```

### Database Backups
```
db_backup_*/                     # Database backups (should use external backup)
prisma/migrations/.migrate/      # Migration artifacts
```

---

## IDE & OS Files

### macOS
```
.DS_Store                        # Finder metadata
._*                              # macOS resource forks
.Spotlight-V100/                 # Spotlight indexing
.Trashes/                        # Trash
```

### IDEs
```
.vscode/                         # VSCode settings (optional - team preference)
.idea/                           # IntelliJ IDEA
*.swp                            # Vim swap files
*.swo                            # Vim swap files
*~                               # Backup files
.project                         # Eclipse
.classpath                       # Eclipse
```

### Editors
```
.cursor/                         # Cursor editor
.cline/                          # Cline editor
.aider*                          # Aider files
```

---

## Temporary Files

```
tmp/                             # Temporary directory
temp/                            # Temporary directory
*.tmp                            # Temporary files
.cache/                          # Cache directory
__pycache__/                     # Python bytecode
*.pyc                            # Python compiled
*.pyo                            # Python optimized
```

---

## Submodule Artifacts

```
vendor/vfkit/.git/               # Submodule git data (handled by git)
```

---

## Updated .gitignore

Create a clean `.gitignore` with only essentials:

```gitignore
# Build artifacts
node_modules/
target/
.build/
build/
releases/
bin/
DerivedData/
*.dylib
*.so
*.a
*.swiftmodule
*.swiftdoc

# Test output
test-results/
playwright-report/
coverage/
.nyc_output/
*.lcov

# Runtime data
data/uploads/
data/workspaces/
data/cache/
logs/
*.log
npm-debug.log*
yarn-debug.log*
db_backup_*/

# IDE
.DS_Store
._*
.vscode/
.idea/
*.swp
*.swo
*~

# Temporary
tmp/
temp/
*.tmp
.cache/
__pycache__/
*.pyc
*.pyo
```

---

## Execution Commands

### 1. Remove from Git History (if committed)
```bash
# Remove large directories from git
git rm -r --cached node_modules/
git rm -r --cached test-results/
git rm -r --cached coverage/
git rm -r --cached logs/
git rm -r --cached data/uploads/
git rm -r --cached build/
git rm -r --cached bin/
git rm -r --cached releases/

# Commit removals
git commit -m "chore: remove generated files from git"
```

### 2. Delete from Filesystem
```bash
# Delete build artifacts
rm -rf node_modules/
rm -rf src-tauri/target/
rm -rf platforms/macos/vm/.build/
rm -rf azure/SwiftUI-Apps/.build/
rm -rf build/
rm -rf releases/
rm -rf bin/

# Delete test output
rm -rf test-results/
rm -rf playwright-report/
rm -rf coverage/

# Delete runtime data
rm -rf data/uploads/
rm -rf logs/
rm -rf db_backup_*/

# Delete IDE files
find . -name ".DS_Store" -delete
find . -name "._*" -delete
```

### 3. Update .gitignore
```bash
# Replace .gitignore with clean version
cat > .gitignore << 'EOF'
# Build artifacts
node_modules/
target/
.build/
build/
releases/
bin/
DerivedData/
*.dylib
*.so
*.a

# Test output
test-results/
playwright-report/
coverage/

# Runtime data
data/uploads/
logs/
*.log
db_backup_*/

# IDE
.DS_Store
._*
.vscode/
.idea/
*.swp

# Temporary
tmp/
temp/
*.tmp
.cache/
__pycache__/
*.pyc
EOF
```

---

## Verification

After deletion, verify:

```bash
# Check git status
git status

# Verify no large files remain
du -sh * | sort -rh | head -20

# Verify .gitignore works
git add .
git status  # Should show no ignored files
```

**Expected Result:**
- No `node_modules/` in git
- No test output in git
- No runtime data in git
- Clean `git status`
- Repo size reduced by ~4GB

---

## Regeneration Instructions

### Node modules
```bash
npm install
```

### Swift build
```bash
swift build --package-path platforms/macos/vm
```

### Menubar app
```bash
cd azure/SwiftUI-Apps
./build-unified-menubar.sh
```

---

## Notes

- These files are **safe to delete** - they're all regenerated automatically
- After deletion, repo will be ~4GB smaller
- Build times will be the same (artifacts regenerate)
- No functionality is lost
- Git history remains intact (just removes files from tracking)

---

*End of DELETE_LIST.md*
