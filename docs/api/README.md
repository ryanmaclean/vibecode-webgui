# API Documentation

## Overview

This directory contains comprehensive API documentation for the VibeCode WebGUI backend architecture.

## Documents

### [api-organization.md](./api-organization.md)
Complete analysis of the current API route structure with recommendations for consolidation and reorganization.

**Contents**:
- Executive summary of API structure issues
- Current route inventory (75+ endpoints)
- Critical issues identification
- Naming convention analysis
- Recommended groupings and structure
- 5-phase migration plan
- Backwards compatibility strategy
- Testing requirements
- Risk assessment

**Key Findings**:
- 9 chat endpoints need consolidation
- Test routes in production structure (security risk)
- Inconsistent naming conventions (singular vs plural)
- Duplicate health check implementations
- 7-sprint migration plan with gradual deprecation

## Quick Links

- **GitHub Issue**: [#499 - API Route Organization](https://github.com/ryanmaclean/vibecode-webgui/issues/499)
- **Current API Routes**: See Appendix A in api-organization.md
- **Recommended Structure**: See Appendix B in api-organization.md

## API Architecture Principles

### REST Conventions
```
/api/{resource-plural}/           # Collection operations (list, create)
/api/{resource-plural}/[id]       # Individual operations (get, update, delete)
/api/{resource-plural}/[id]/{sub} # Sub-resource operations
```

### Service Endpoints
```
/api/{service-name}/{operation}   # Service-oriented operations
```

### Health & Status
```
/api/health                       # Standard health check
/api/healthz                      # Kubernetes liveness probe
/api/readyz                       # Kubernetes readiness probe
```

## Current State (2025-10-01)

### Route Categories
- **AI Services**: 14 endpoints (needs consolidation)
- **Authentication**: 6 endpoints (well-organized)
- **Chat**: 9 endpoints across multiple paths (HIGH PRIORITY consolidation needed)
- **Health Checks**: 10 endpoints (needs consolidation to 4)
- **Monitoring**: 13 endpoints (well-organized, minor cleanup)
- **Workspaces**: 4 endpoints split across singular/plural (needs unification)
- **Other Services**: 20+ endpoints (various)

### Critical Issues
1. **HIGH**: Chat route fragmentation (9 endpoints)
2. **MEDIUM**: Test routes in production structure
3. **MEDIUM**: Workspace singular/plural split
4. **LOW**: Health check duplication

## Migration Timeline

| Phase | Description | Sprints | Status |
|-------|-------------|---------|--------|
| Phase 1 | Remove test routes | 1 | Pending |
| Phase 2 | Chat consolidation | 2-3 | Pending |
| Phase 3 | Workspace unification | 2 | Pending |
| Phase 4 | Health check consolidation | 1 | Pending |
| Phase 5 | Template consolidation | 1 | Pending |

**Total Duration**: 7 sprints (14-21 weeks)

## Success Metrics

### Quantitative Goals
- Reduce chat endpoints from 9 to 2 (78% reduction)
- Reduce health endpoints from 10 to 4 (60% reduction)
- Zero test routes in production structure
- 100% consistent naming conventions
- Zero duplicate functionality

### Qualitative Goals
- Clear, intuitive API structure
- Single source of truth for each feature
- Easy to extend and modify
- Comprehensive documentation

## Contributing

When adding new API routes:

1. **Follow REST conventions**: Use plural resource names
2. **Group related endpoints**: Place under appropriate service namespace
3. **Add documentation**: Update api-organization.md with new routes
4. **Add tests**: Include integration tests for all endpoints
5. **Update OpenAPI spec**: Keep API specification current

## Getting Help

- **API Organization Questions**: See [api-organization.md](./api-organization.md)
- **Migration Questions**: See Phase details in api-organization.md
- **Implementation Help**: Comment on [Issue #499](https://github.com/ryanmaclean/vibecode-webgui/issues/499)

## Related Documentation

- [Architecture Documentation](/docs/ARCHITECTURE.md)
- [Testing Documentation](/docs/testing/)
- [Configuration Management](/docs/configuration/)

---

**Last Updated**: 2025-10-01
**Maintained By**: Backend Architecture Team
