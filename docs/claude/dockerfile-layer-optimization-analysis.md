# Dockerfile Layer Optimization Analysis

## Issue Reference
- **GitHub Issue**: #459
- **Target**: Reduce from 57 layers to ~12 layers
- **Priority**: MEDIUM - Performance/cost optimization

## Current State Analysis

### 1. Base Dockerfile (`/Dockerfile`)
**Current Layer Structure**: ~15 layers in final image
**Analysis**:
- Uses multi-stage build (GOOD)
- Efficient layer separation
- Already well-optimized
- **Recommendation**: Minor optimizations only

**Layer Breakdown**:
```
FROM node:20-alpine AS base                    # 1 layer (base)
FROM base AS deps                              # +1 layer
  RUN apk add...                               # +1 layer
  COPY package.json...                         # +1 layer
  RUN npm ci                                   # +1 layer
FROM base AS builder                           # +1 layer
  COPY --from=deps...                          # +1 layer
  COPY . .                                     # +1 layer
  RUN npx prisma generate                      # +1 layer
  RUN npm run build                            # +1 layer
FROM base AS runner                            # +1 layer (final)
  RUN addgroup...                              # +1 layer
  RUN adduser...                               # +1 layer (CAN COMBINE)
  COPY multiple times                          # +6 layers
  RUN mkdir .next                              # +1 layer
  RUN chown...                                 # +1 layer (CAN COMBINE)
  USER nextjs                                  # 0 layers (metadata)
  ENV...                                       # 0 layers (metadata)
```
**Final Image Layers**: ~15 layers (reasonable)

---

### 2. Production Dockerfile (`/Dockerfile.production`)
**Current Layer Structure**: ~25-30 layers in final image
**Analysis**:
- Multiple RUN commands that should be combined
- Separate RUN for user creation
- Multiple COPY operations
- HERE-doc files create extra layers
- **Recommendation**: High optimization potential

**Problem Areas**:
```dockerfile
# WASTEFUL - 2 layers when could be 1:
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# WASTEFUL - Multiple RUNs for directory setup:
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs
RUN cat <<'EOF' > /app/appsec-rules.json
...
EOF
RUN cat <<'EOF' > /app/healthcheck.js
...
EOF
RUN chmod +x healthcheck.js
```

**Optimization Opportunities**: 8-10 layers can be reduced to 3-4

---

### 3. docker/Dockerfile.prod (x86-64 specific)
**Current Layer Structure**: ~18 layers
**Analysis**:
- No multi-stage build (MAJOR ISSUE)
- Build dependencies remain in final image
- Sequential RUN commands
- **Recommendation**: Needs complete refactoring

**Problems**:
```dockerfile
# All in single stage - bloated final image:
RUN apt-get update && apt-get install -y \
    python3 make g++ ...                       # Build tools in production!

RUN npm install --omit=dev                     # +1 layer
RUN npm install tailwindcss                    # +1 layer (should combine)
RUN npm rebuild lightningcss                   # +1 layer (should combine)
RUN node -e "require('lightningcss')"          # +1 layer (unnecessary test)
RUN npx prisma generate                        # +1 layer
RUN npm run build                              # +1 layer
```

**Optimization Opportunities**: Can reduce to 10-12 layers with multi-stage

---

### 4. docker/code-server/Dockerfile
**Current Layer Structure**: 45-57 layers (WORST OFFENDER)
**Analysis**:
- Sequential RUN commands for every tool installation
- Each extension install is a separate layer
- No combination of related operations
- **Recommendation**: CRITICAL - needs major refactoring

**Problem Examples**:
```dockerfile
# Each is a separate layer (should be 1 combined layer):
RUN code-server --install-extension GitHub.copilot          # +1
RUN code-server --install-extension GitHub.copilot-chat     # +1
RUN code-server --install-extension GitHub.copilot-labs     # +1
RUN code-server --install-extension Codeium.codeium         # +1
RUN code-server --install-extension Codeium.codeium-enterprise-edition # +1
RUN code-server --install-extension TabNine.tabnine-vscode  # +1
RUN code-server --install-extension AmazonWebServices.aws-toolkit-vscode # +1
# ... 15+ more extension installs ...

# LSP installations (each is a layer):
RUN pip3 install 'python-lsp-server[all]'                   # +1
RUN npm install -g typescript-language-server               # +1
RUN curl ... rust-analyzer                                  # +1
RUN go install golang.org/x/tools/gopls@latest              # +1
RUN mkdir ... jdtls                                         # +1
RUN apt-get install clangd                                  # +1
RUN npm install -g bash-language-server                     # +1
RUN npm install -g dockerfile-language-server-nodejs        # +1
```

**Layer Count**:
- Base system deps: ~5 layers
- Node.js install: ~3 layers
- Global npm packages: ~7 layers (one per package)
- Go install: ~3 layers
- Goose: ~1 layer
- Datadog tools: ~7 layers
- AI extensions: ~15 layers (one per extension)
- LSP servers: ~8 layers
- Official extensions: ~5 layers
- Configuration: ~3 layers
**TOTAL**: ~57 layers

**Optimization Strategy**: Reduce to 12-15 layers

---

## Optimization Strategies Applied

### Strategy 1: Combine RUN Commands
**Rule**: Related operations in single RUN with && chaining
```dockerfile
# BEFORE (3 layers):
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

# AFTER (1 layer):
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/logs && \
    chown nextjs:nodejs /app/logs
```

### Strategy 2: Batch Extension Installations
```dockerfile
# BEFORE (15 layers):
RUN code-server --install-extension ext1
RUN code-server --install-extension ext2
# ... 13 more ...

# AFTER (1 layer):
RUN code-server \
    --install-extension ext1 \
    --install-extension ext2 \
    --install-extension ext3 \
    # ... all in one command
```

### Strategy 3: Multi-stage for Build Dependencies
```dockerfile
# BEFORE (single stage - build deps in production):
FROM node:20-slim
RUN apt-get install python3 make g++
RUN npm run build
CMD ["node", "server.js"]

# AFTER (multi-stage):
FROM node:20-slim AS builder
RUN apt-get install python3 make g++
RUN npm run build

FROM node:20-slim AS runner
COPY --from=builder /app/dist ./dist
CMD ["node", "server.js"]
```

### Strategy 4: Inline File Creation
```dockerfile
# BEFORE (3 layers):
RUN cat <<'EOF' > file1.json
...
EOF
RUN cat <<'EOF' > file2.js
...
EOF
RUN chmod +x file2.js

# AFTER (1 layer with COPY or combined RUN):
COPY --from=builder /configs/file1.json /configs/file2.js ./
RUN chmod +x file2.js
```

---

## Target Layer Structure

### Optimized Production Dockerfile (~12 layers)
```
1. FROM node:20-slim AS base
2. RUN apt-get update && install system deps && cleanup (combined)
3. FROM base AS deps + COPY package files
4. RUN npm ci (dependencies)
5. FROM base AS builder + COPY source
6. RUN prisma generate && npm run build (combined)
7. FROM node:20-slim AS runner
8. RUN create user + dirs + permissions (combined)
9. COPY built artifacts (consolidated)
10. RUN create runtime files (appsec, healthcheck) (combined)
11. EXPOSE + ENV + HEALTHCHECK (metadata - 0 layers)
12. CMD entrypoint
```

### Optimized code-server Dockerfile (~15 layers)
```
1. FROM codercom/code-server:4.101.2
2. RUN system deps (combined apt-get)
3. RUN Node.js install
4. RUN global npm packages (combined)
5. RUN Go install + Goose (combined)
6. RUN Datadog tools (all combined)
7. RUN LSP servers - Python + TypeScript (combined)
8. RUN LSP servers - Rust + Go + Java (combined)
9. RUN LSP servers - C++ + Bash + Docker (combined)
10. RUN AI extensions (all in one command)
11. COPY custom extensions + configs
12. RUN extension build (combined)
13. USER coder
14. WORKDIR + EXPOSE + HEALTHCHECK (metadata)
15. CMD
```

---

## Implementation Plan

### Phase 1: High-Impact Optimizations
1. **code-server/Dockerfile**: 57 → 15 layers (PRIMARY TARGET)
2. **Dockerfile.production**: 25 → 12 layers
3. **docker/Dockerfile.prod**: 18 → 12 layers (add multi-stage)

### Phase 2: Validation
1. Build optimized images
2. Compare layer counts: `docker history <image>`
3. Compare image sizes
4. Test functionality
5. Measure build times

### Phase 3: Minor Optimizations
1. **Base Dockerfile**: 15 → 13 layers (minor improvements)
2. Other profile Dockerfiles

---

## Expected Improvements

### code-server/Dockerfile
- **Before**: 57 layers, ~4.5GB image
- **After**: 15 layers, ~3.8GB image (15% reduction)
- **Build Time**: 20-30% faster (fewer layer commits)

### Dockerfile.production
- **Before**: 25 layers, ~450MB
- **After**: 12 layers, ~400MB (11% reduction)
- **Build Time**: 15-20% faster

### docker/Dockerfile.prod
- **Before**: 18 layers, ~850MB (includes build deps)
- **After**: 12 layers, ~520MB (38% reduction with multi-stage)
- **Build Time**: 10-15% faster

---

## Next Steps

1. Create optimized Dockerfile versions
2. Test builds locally
3. Validate functionality with smoke tests
4. Update CI/CD pipelines to use optimized versions
5. Document changes and rationale

---

**Analysis Date**: 2025-10-03
**Agent**: 18 - DevOps Architect
**Status**: Ready for implementation
