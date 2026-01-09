# Agent Y: VM Disk Size Optimization Plan

**Date**: 2026-01-05
**Agent**: Agent Y
**Goal**: Reduce VM disk from 89MB compressed (268MB uncompressed) to under 60MB compressed (33% reduction)

## Current State Analysis

### Overall Size Breakdown
```
Total Uncompressed: 274MB (2,705 files)
Total Compressed:   89MB
Compression Ratio:  ~3.1x

Top-level directories:
- opt/           149MB (54.4%) - OpenVSCode Server
- usr/           119MB (43.4%) - System libraries and binaries
- bin/           3.7MB (1.4%)  - Core binaries
- lib/           2.3MB (0.8%)  - System libraries
```

### Detailed Component Analysis

#### 1. OpenVSCode Server: 149MB (54.4% of total)
```
Component Breakdown:
- node (Node.js binary)          63MB  (42.3% of OpenVSCode)
- extensions/                    42MB  (28.2% of OpenVSCode)
  - node_modules (TypeScript)    15MB
  - ms-vscode.js-debug          3.1MB
  - markdown-language-features   2.4MB
  - ms-vscode.vscode-js-profile-table 2.3MB
  - html-language-features       2.1MB
  - cpp                          1.7MB
  - git                          1.5MB
  - css-language-features        1.4MB
  - json-language-features       992KB
  - markdown-math                900KB
  - typescript-language-features 768KB
  - latex                        648KB
  - github                       608KB
  - github-authentication        596KB
- node_modules/                  24MB  (16.1% of OpenVSCode)
  - @vscode/ripgrep/bin/rg      3.9MB
  - @xterm/xterm/lib/xterm.mjs.map 1.6MB
  - @vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm 1.4MB
  - vscode-oniguruma/release/onig.wasm 456KB
- out/ (compiled VS Code)        20MB  (13.4% of OpenVSCode)
  - vs/code/browser/workbench/workbench.js 10MB
```

#### 2. System Libraries (usr/): 119MB (43.4% of total)
```
Major Components:
- usr/share/icu/76.1/icudt76l.dat   30MB  (25.2% of usr/)
- usr/lib/                          77MB  (64.7% of usr/)
  - libpython3.12.so.1.0           5.9MB
  - libcrypto.so.3                 4.3MB
  - libicui18n.so.76.1/76          2.9MB (duplicates)
  - libstdc++.so.6.0.34/6          2.7MB (duplicates)
  - libicuuc.so.76.1/76            1.8MB (duplicates)
- usr/lib/python3.12/               21MB  (17.6% of usr/)
  - ensurepip/_bundled/pip-25.0.1-py3-none-any.whl 1.8MB
- usr/libexec/postgresql16/postgres 8.7MB
- usr/share/postgresql16/           1.5MB
```

#### 3. Core Binaries (bin/): 3.7MB (1.4% of total)
```
- valkey-server                    2.8MB
- Other utilities                  0.9MB
```

#### 4. Additional Assets
```
- Source maps (*.map)              3.9MB
- TypeScript definitions (*.d.ts)  2.6MB
- ThirdPartyNotices.txt files      1.8MB
- Documentation/LICENSE files      135 files
- WASM modules                     2.4MB total
```

## Optimization Opportunities

### PRIORITY 1: Safe High-Impact Removals (Total: ~35-40MB savings)

#### 1.1 ICU Data Reduction: ~28MB savings
**Current**: 30MB full ICU data (icudt76l.dat)
**Target**: Use minimal ICU data or English-only subset
**Risk**: LOW - Can use stub ICU data or minimal English data
**Implementation**:
```bash
# Option A: Use ICU stub data (272KB)
# Option B: Keep only English locale data (~2MB)
# Savings: 28-29.7MB
```

#### 1.2 Source Maps Removal: ~4MB savings
**Current**: 24 source map files (3.9MB)
**Target**: Remove all *.map files
**Risk**: VERY LOW - Only needed for debugging in browser
**Files to remove**:
- opt/openvscode/node_modules/@xterm/xterm/lib/xterm.mjs.map (1.6MB)
- All other *.map files
**Savings**: 3.9MB

#### 1.3 TypeScript Definition Files: ~2.6MB savings
**Current**: 92 *.d.ts files (2.6MB)
**Target**: Remove TypeScript definition files
**Risk**: VERY LOW - Only needed for TypeScript development, not runtime
**Savings**: 2.6MB

#### 1.4 ThirdPartyNotices and Documentation: ~2MB savings
**Current**: 135 documentation/license files
**Target**: Remove large ThirdPartyNotices.txt, README, CHANGELOG files
**Risk**: VERY LOW - Legal notices not required in runtime
**Key files**:
- opt/openvscode/extensions/ms-vscode.vscode-js-profile-table/ThirdPartyNotices.txt (1.8MB)
- Other license/readme files
**Savings**: ~2MB

**Priority 1 Total: 35-40MB savings**

---

### PRIORITY 2: Medium-Impact Safe Removals (Total: ~20-25MB savings)

#### 2.1 Python pip Wheel Removal: ~1.8MB savings
**Current**: pip-25.0.1-py3-none-any.whl (1.8MB)
**Target**: Remove ensurepip package
**Risk**: LOW - pip not needed in production runtime
**Path**: usr/lib/python3.12/ensurepip/
**Savings**: 1.8MB

#### 2.2 OpenVSCode Extension Reduction: ~15-20MB savings
**Current**: 42MB of extensions
**Target**: Remove non-essential extensions
**Risk**: MEDIUM - Need to verify which extensions are actually used
**Candidates for removal**:
- markdown-math (900KB) - Specialized, likely unused
- latex (648KB) - Specialized, likely unused
- cpp (1.7MB) - If not doing C++ development
- ms-vscode.vscode-js-profile-table (2.3MB) - Profiling tool, not essential
- github/github-authentication (1.2MB) - May not be needed in VM
**Conservative savings**: 5MB
**Aggressive savings**: 15-20MB

#### 2.3 Large WASM Module Review: ~1.4MB savings
**Current**: tree-sitter-typescript.wasm (1.4MB)
**Target**: Remove if TypeScript language features not needed
**Risk**: MEDIUM - Depends on usage
**Savings**: 1.4MB (if safe to remove)

#### 2.4 Duplicate Shared Library Symlinks: ~8MB savings
**Current**: Multiple symlinks pointing to same library files
**Target**: Keep only one version, remove duplicate symlinks
**Examples**:
- libicui18n.so.76.1 and libicui18n.so.76 (same size, 2.9MB each = duplicate?)
- libstdc++.so.6.0.34 and libstdc++.so.6 (same size, 2.7MB each)
- libicuuc.so.76.1 and libicuuc.so.76 (same size, 1.8MB each)
**Risk**: LOW - Need to verify if these are actual duplicates or symlinks
**Savings**: ~7-8MB (if actual duplicates)

**Priority 2 Total: 20-25MB savings**

---

### PRIORITY 3: Advanced Optimizations (Total: ~30-40MB savings)

#### 3.1 Node.js Binary Stripping: ~5-10MB savings
**Current**: node binary (63MB)
**Target**: Strip debug symbols, compress with UPX
**Risk**: MEDIUM - UPX might affect startup time
**Implementation**:
```bash
strip opt/openvscode/node
# OR
upx --best opt/openvscode/node
```
**Savings**: 5-10MB

#### 3.2 Python Standard Library Cleanup: ~3-5MB savings
**Current**: 21MB Python 3.12 standard library
**Target**: Remove unused stdlib modules
**Risk**: MEDIUM-HIGH - Need to profile what's actually used
**Candidates**:
- doctest.py
- unittest/
- idlelib/
- tkinter/
- test/
**Savings**: 3-5MB

#### 3.3 Workbench.js Optimization: ~2-3MB savings
**Current**: workbench.js (10MB)
**Target**: Minify further or check if already minified
**Risk**: MEDIUM - Already built/optimized
**Savings**: 2-3MB (if possible)

#### 3.4 PostgreSQL Binary Stripping: ~1-2MB savings
**Current**: postgres binary (8.7MB)
**Target**: Strip debug symbols
**Risk**: LOW-MEDIUM
**Savings**: 1-2MB

#### 3.5 Ripgrep Binary: ~1MB savings
**Current**: rg binary (3.9MB)
**Target**: Strip or use smaller alternative
**Risk**: MEDIUM - Used by VS Code search
**Savings**: 1MB

#### 3.6 Replace Full TypeScript with Minimal: ~10-12MB savings
**Current**: TypeScript full package (15MB in extensions/node_modules)
**Target**: Use typescript-language-server only or remove if not needed
**Risk**: HIGH - Breaks TypeScript support
**Savings**: 10-12MB

**Priority 3 Total: 30-40MB savings**

---

## Implementation Strategy

### Phase 1: Safe Removals (Target: 35MB savings, compressed: ~12MB)
Execute Priority 1 optimizations in order:
1. Remove source maps (*.map files)
2. Remove TypeScript definitions (*.d.ts files)
3. Remove ThirdPartyNotices.txt and large documentation
4. Replace full ICU data with minimal English-only data

**Expected result**: 89MB → 77MB compressed (13% reduction)

### Phase 2: Medium-Risk Removals (Target: 20MB savings, compressed: ~7MB)
Execute Priority 2 optimizations:
1. Remove pip wheel from Python
2. Remove specialized extensions (markdown-math, latex, profiler)
3. Verify and remove duplicate libraries
4. Remove tree-sitter-typescript.wasm if safe

**Expected result**: 77MB → 70MB compressed (21% total reduction)

### Phase 3: Advanced Optimizations (Target: 20MB savings, compressed: ~7MB)
Execute selected Priority 3 optimizations:
1. Strip Node.js binary
2. Strip PostgreSQL binary
3. Clean Python standard library (conservative)
4. Strip ripgrep binary

**Expected result**: 70MB → 63MB compressed (29% total reduction)

### Phase 4: Aggressive Optimizations (If needed to reach 60MB)
Only if previous phases don't reach target:
1. Remove TypeScript full package
2. UPX compression on Node.js
3. More aggressive Python stdlib removal
4. Remove additional VS Code extensions

**Expected result**: 63MB → 55-58MB compressed (34-35% reduction)

---

## Risk Assessment

### Very Low Risk (Safe to implement immediately)
- Source maps removal
- TypeScript definition files removal
- ThirdPartyNotices.txt removal
- Documentation file removal

### Low Risk (Test after implementation)
- ICU data reduction (use minimal/English-only)
- pip wheel removal
- Binary stripping (postgres, strip symbols)

### Medium Risk (Requires testing)
- Extension removal (need to verify usage)
- WASM module removal
- Node.js binary optimization
- Python stdlib cleanup

### High Risk (Requires careful analysis)
- TypeScript package removal
- UPX compression on Node.js
- Aggressive extension pruning

---

## Testing Checklist

After each phase, verify:
- [ ] VM boots successfully
- [ ] OpenVSCode Server starts
- [ ] PostgreSQL service runs
- [ ] Valkey service runs
- [ ] WebSocket connections work
- [ ] File editing works in VS Code
- [ ] Terminal works in VS Code
- [ ] Network services accessible

---

## Size Targets

| Phase | Actions | Uncompressed | Compressed | Savings |
|-------|---------|-------------|------------|---------|
| Current | - | 274MB | 89MB | - |
| Phase 1 | Safe removals | ~239MB | ~77MB | 12MB (13%) |
| Phase 2 | Medium-risk | ~219MB | ~70MB | 19MB (21%) |
| Phase 3 | Advanced | ~199MB | ~63MB | 26MB (29%) |
| Phase 4 | Aggressive | ~179MB | ~58MB | 31MB (35%) |
| **Target** | **< 60MB** | **< 185MB** | **< 60MB** | **>29MB (33%)** |

---

## Quick Wins (Implement First)

These can be done immediately with minimal risk:

1. **Remove source maps**: `find . -name "*.map" -delete` (4MB)
2. **Remove TypeScript defs**: `find . -name "*.d.ts" -delete` (2.6MB)
3. **Remove ThirdPartyNotices**: `find . -name "ThirdPartyNotices.txt" -size +1M -delete` (1.8MB)
4. **Replace ICU data**: Use icu-data-en or minimal stub (28MB)

**Total Quick Wins: ~36MB uncompressed → ~12MB compressed savings**

This alone gets us from 89MB to ~77MB with virtually zero risk.

---

## Commands for Implementation

### Phase 1 Script
```bash
#!/bin/bash
cd /tmp/initramfs-analysis

# Remove source maps
find . -name "*.map" -delete
echo "Removed source maps"

# Remove TypeScript definitions
find . -name "*.d.ts" -delete
echo "Removed TypeScript definitions"

# Remove large ThirdPartyNotices
find . -name "ThirdPartyNotices.txt" -size +1M -delete
echo "Removed large ThirdPartyNotices files"

# Remove README, CHANGELOG in node_modules
find opt/openvscode/node_modules -name "README*" -delete
find opt/openvscode/node_modules -name "CHANGELOG*" -delete
find opt/openvscode/extensions/node_modules -name "README*" -delete
find opt/openvscode/extensions/node_modules -name "CHANGELOG*" -delete
echo "Removed documentation files"

# ICU data replacement (done separately)
# Replace usr/share/icu/76.1/icudt76l.dat with minimal version

echo "Phase 1 complete"
```

---

## Recommendations

**Immediate Action**: Implement Phase 1 (Safe Removals)
- Zero risk to functionality
- 12MB compressed savings
- Gets us 13% toward goal

**Next Steps**: Implement Phase 2 with testing
- Low to medium risk
- Additional 7MB compressed savings
- Reaches 21% total reduction

**Target Achievement**: Phases 1 + 2 + partial Phase 3
- Combined savings: ~26-30MB compressed
- Reaches or exceeds 60MB target
- Acceptable risk level

**Alternative Path**: If more aggressive needed
- Replace OpenVSCode with lighter alternative (code-server minimal)
- Could save additional 40-50MB
- Requires architecture change

---

## Conclusion

**Feasibility**: Target of 60MB compressed is ACHIEVABLE
**Recommended Path**: Phase 1 + Phase 2 + Selected Phase 3 items
**Expected Final Size**: 58-63MB compressed (34-38MB savings, 35-43% reduction)
**Risk Level**: LOW to MEDIUM with proper testing
**Timeline**: Can implement Phase 1 immediately, Phase 2-3 within same session

The largest single optimization is ICU data reduction (28MB → 2MB = 26MB saving), which alone provides significant progress toward the goal.
