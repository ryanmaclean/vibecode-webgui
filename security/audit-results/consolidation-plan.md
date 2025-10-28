# Documentation Consolidation Plan

## Current State Analysis
- Total markdown files:      480
- Root-level files:        2
- Wiki directory files:        0
- Content/wiki files:        0

## Recommended Actions

### Phase 1: Immediate Cleanup
1. **Root-level consolidation**: Move root .md files to docs/src/content/docs/
2. **Wiki merge**: Consolidate /wiki/ and /content/wiki/ directories
3. **Remove empty files**: Delete files with <10 lines of content
4. **Archive old files**: Move outdated documentation to archive/

### Phase 2: Content Organization
1. **Category-based structure**: Organize by testing, API, infrastructure, etc.
2. **Remove duplicates**: Merge similar content
3. **Update navigation**: Reflect new structure in Astro site
4. **Link validation**: Ensure all internal links work

### Phase 3: Maintenance
1. **Documentation standards**: Create contribution guidelines
2. **Automated checks**: Prevent future scatter
3. **Regular audits**: Monthly documentation health checks

## Priority Files for Review

### Large files (>10KB):
- ./docs/src/content/docs/wiki-archive/reports/VALIDATION_REPORT.md (110KB)
- ./TODO.md (69KB)
- ./docs/src/content/docs/wiki-archive/API.md (64KB)
- ./code-server/CHANGELOG.md (29KB)
- ./docs/src/content/docs/mcp-context7.md (29KB)
- ./docs/src/content/docs/mcp-serena.md (26KB)
- ./docs/src/content/docs/mcp-playwright.md (24KB)
- ./docs/src/content/docs/wiki-archive/CONSOLIDATED_DOCUMENTATION.md (21KB)
- ./code-server/docs/FAQ.md (21KB)
- ./docs/src/content/docs/wiki-archive/project-todo.md (21KB)

### Minimal files (<10 lines):
- ./.pytest_cache/README.md (8 lines)
- ./archive/CLAUDE.md (6 lines)
- ./code-server/docs/ios.md (9 lines)
- ./code-server/docs/upgrade.md (5 lines)
- ./docs/src/content/docs/wiki-archive/AI_PROVIDER_NOTES.md (8 lines)
- ./playwright-report/data/28ef858c5f48ba3e54e3ee23e92a1c34d9eebd16.md (4 lines)
- ./playwright-report/data/f828e5d793d89fb0261938b9531fb7c0b8ed7b5d.md (9 lines)
