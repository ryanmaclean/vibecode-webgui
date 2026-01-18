# API Route Consolidation Documentation

**Issue**: #499 - API Route Consolidation
**Status**: Planning Complete - Ready for Implementation
**Priority**: HIGH

## Overview

This directory contains comprehensive documentation for the API route consolidation project, which aims to reduce the number of routes from 74 to ~45 while improving organization, consistency, and maintainability.

## Documents

### 📋 [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md)
**The master plan document** - Comprehensive consolidation strategy including:
- Complete route inventory and analysis
- Current state problems and inconsistencies
- Proposed new structure with REST conventions
- 5-phase migration strategy (13 weeks)
- Backward compatibility approach
- Risk mitigation strategies
- Success metrics and testing strategy
- Timeline and rollout plan

**Read this first** for complete understanding of the consolidation project.

### 🗺️ [ROUTE_MAPPING.md](./ROUTE_MAPPING.md)
**Quick reference guide** - Practical migration mapping including:
- Before/after route comparisons
- Phase-by-phase consolidation checklist
- Backward compatibility matrix
- Implementation checklist by week
- Frontend impact assessment
- Testing requirements
- Support resources

**Use this** during implementation for quick lookups and progress tracking.

### 📊 [CONSOLIDATION_VISUAL.md](./CONSOLIDATION_VISUAL.md)
**Visual guide** - Diagrams and visual representations including:
- Before/after directory structure comparison
- Consolidation flow diagrams
- Impact heatmap
- Timeline visualization
- Success metrics dashboard
- Key principles applied

**Reference this** for understanding the big picture and communicating changes.

## Quick Stats

| Metric | Current | Proposed | Change |
|--------|---------|----------|--------|
| **Total Routes** | 74 | ~45 | -40% |
| **Test Endpoints** | 2 | 0 | -100% |
| **Duplicate Routes** | 15+ | 0 | -100% |
| **Organized Domains** | Scattered | 13 domains | +100% |
| **AI Routes** | 23 (scattered) | 11 (organized) | -52% |
| **Health Routes** | 10 (duplicates) | 4 (consolidated) | -60% |
| **Monitoring Routes** | 13 (scattered) | 8 (organized) | -38% |

## Key Problems Solved

### 1. Naming Inconsistencies ✅
- **Before**: `/workspace` vs `/workspaces`, `generate-project` vs `model-selection`
- **After**: Consistent plural nouns, standardized verb placement

### 2. Functional Duplication ✅
- **Before**: 4 chat endpoints, 2 health/database routes, duplicate templates
- **After**: Single source of truth for each function

### 3. Domain Boundaries ✅
- **Before**: AI/Claude/Chat confusion, health vs monitoring overlap
- **After**: Clear 13-domain structure with distinct responsibilities

### 4. Security Concerns ✅
- **Before**: Test endpoints in production code
- **After**: Test endpoints removed, all routes authenticated

## Proposed Structure

```
/api/
├── auth/              # Authentication & Authorization (6 routes)
├── ai/                # AI Services consolidated (11 routes)
├── workspaces/        # Workspace Management (4 routes)
├── files/             # File Operations (3 routes)
├── storage/           # Data Storage (2 routes - NEW)
├── health/            # Health Checks consolidated (4 routes)
├── monitoring/        # Observability (8 routes)
├── terminal/          # Terminal Services (2 routes)
├── projects/          # Project Management (2 routes)
├── users/             # User Management (1 route)
├── integrations/      # External Integrations (5 routes - NEW)
├── docs/              # Documentation (1 route)
└── experiments/       # Feature Flags (1 route)
```

## Implementation Timeline

```
Week 1:    Critical fixes & deletions
Weeks 2-3: Domain reorganization
Week 4:    Naming standardization
Week 5:    Middleware & polish
Weeks 6-12: Deprecation period
Week 13+:  Cleanup & post-mortem
```

## Breaking Changes

### Minimal Breaking Changes
Most routes will maintain backward compatibility through proxies during the 8-week deprecation period.

### K8s Configuration Updates Required
- `/api/healthz` → `/api/health/live`
- `/api/readyz` → `/api/health/ready`

Update deployment YAML files in Week 1.

## Migration Strategy

### Phase 1: Critical (Week 1)
1. Delete test endpoints
2. Consolidate health check duplicates
3. Merge connection pool monitoring
4. Update K8s configurations

### Phase 2: Domains (Weeks 2-3)
1. AI domain consolidation
2. Workspace standardization
3. Files & storage separation
4. Integrations organization

### Phase 3: Standards (Week 4)
1. Apply REST naming conventions
2. Standardize response formats
3. Generate API documentation

### Phase 4: Quality (Week 5)
1. Implement shared middleware
2. Add comprehensive error handling
3. Final testing and validation

### Phase 5: Deprecation (Weeks 6-12)
1. Monitor proxy usage
2. Support API consumers
3. Track migration progress

### Phase 6: Cleanup (Week 13+)
1. Remove deprecated routes
2. Delete old code
3. Final documentation
4. Post-implementation review

## Testing Requirements

### Must Pass Before Merge
- [ ] All new routes have integration tests
- [ ] Backward compatibility proxies tested
- [ ] Deprecation headers verified
- [ ] Performance benchmarks meet targets (<100ms proxy overhead)
- [ ] Security audit passed
- [ ] OpenAPI spec generated and validated
- [ ] Frontend integration tests updated

### Continuous Monitoring
- Proxy usage metrics
- Error rates on new routes
- Response time comparisons
- API consumer feedback

## Success Criteria

### Quantitative
- ✅ 40% route reduction (74 → 45)
- ✅ 100% test coverage on new routes
- ✅ <100ms proxy latency
- ✅ Zero breaking changes for critical endpoints
- ✅ 95%+ API consumer migration rate

### Qualitative
- ✅ Clear, predictable URL structure
- ✅ Consistent naming conventions
- ✅ Improved developer experience
- ✅ Better API discoverability
- ✅ Reduced maintenance burden

## Communication Plan

### Internal
- **Slack**: `#api-consolidation` channel
- **Standups**: Daily progress updates during implementation
- **Docs**: Continuous documentation updates

### External (API Consumers)
- **Week 0**: Announcement of planned changes
- **Week 5**: Migration guide published
- **Weeks 6-8**: Weekly deprecation notices
- **Weeks 9-12**: Urgent migration reminders
- **Week 13**: Final cutover notification

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes | Medium | High | Extensive proxy layer, testing |
| Frontend failures | Medium | High | Staged rollout, feature flags |
| Performance regression | Low | Medium | Benchmarking, monitoring |
| Incomplete migration | Medium | Medium | Usage tracking, direct support |
| K8s deployment issues | Low | High | Test environment validation |

## Resources

### Documentation
- Full plan: [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md)
- Route mapping: [ROUTE_MAPPING.md](./ROUTE_MAPPING.md)
- Visual guide: [CONSOLIDATION_VISUAL.md](./CONSOLIDATION_VISUAL.md)

### Tools
- Route inventory script: `scripts/api-route-audit.sh` (TBD)
- Proxy generator: `scripts/generate-route-proxies.ts` (TBD)
- Migration validator: `scripts/validate-migration.ts` (TBD)

### Monitoring
- Datadog dashboard: API Route Consolidation (TBD)
- Proxy usage metrics: Grafana panel (TBD)
- Error tracking: Sentry project (TBD)

## Team

### Ownership
- **Lead**: Backend Architecture Team
- **Implementation**: 2-3 backend engineers
- **Review**: Engineering leads, product managers
- **Support**: Frontend team for integration updates

### Stakeholders
- Engineering leadership (approval required)
- Product team (timeline alignment)
- Frontend team (integration planning)
- DevOps team (K8s configuration)
- QA team (testing validation)

## Getting Started

### For Reviewers
1. Read [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md) for complete context
2. Review proposed structure in [CONSOLIDATION_VISUAL.md](./CONSOLIDATION_VISUAL.md)
3. Check [ROUTE_MAPPING.md](./ROUTE_MAPPING.md) for specific changes
4. Provide feedback in GitHub issue #499

### For Implementers
1. Create feature branch: `feature/api-consolidation`
2. Follow weekly checklist in [ROUTE_MAPPING.md](./ROUTE_MAPPING.md)
3. Reference [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md) for patterns
4. Update progress in daily standups

### For API Consumers
1. Review [ROUTE_MAPPING.md](./ROUTE_MAPPING.md) for affected endpoints
2. Check deprecation timeline in [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md)
3. Plan frontend updates during deprecation period
4. Contact team with questions via Slack

## FAQ

### Q: Will this break existing integrations?
**A**: No. Backward compatibility proxies will maintain all existing endpoints for 8 weeks during the deprecation period. Only K8s health probes require immediate updates.

### Q: How long will migration take?
**A**: 13 weeks total - 5 weeks active development, 8 weeks deprecation monitoring, followed by cleanup.

### Q: What if I can't migrate in 8 weeks?
**A**: Contact the backend team. We can extend the deprecation period for critical integrations.

### Q: How do I know which routes are affected?
**A**: Check the route mapping table in [ROUTE_MAPPING.md](./ROUTE_MAPPING.md). Any route you use that has a "New Route" entry will be deprecated.

### Q: Will performance be affected?
**A**: Minimal impact. Proxy overhead targets <100ms. New consolidated routes may actually be faster due to reduced code duplication.

### Q: Can I start using new routes immediately?
**A**: Yes, once implemented in Week 5. Old routes will continue working during deprecation.

### Q: What about API documentation?
**A**: OpenAPI spec will be generated in Week 4. Documentation will be continuously updated throughout the project.

### Q: How can I track progress?
**A**: GitHub issue #499 has real-time updates. Check the implementation checklist in [ROUTE_MAPPING.md](./ROUTE_MAPPING.md).

## Next Steps

1. **Review Period** (Current)
   - Team review of consolidation plan
   - Stakeholder sign-off on timeline
   - Resource allocation confirmation

2. **Preparation** (Week 0)
   - Create feature branch
   - Set up testing environment
   - Prepare monitoring dashboards

3. **Implementation** (Weeks 1-5)
   - Execute consolidation plan
   - Daily progress tracking
   - Continuous testing

4. **Deprecation** (Weeks 6-12)
   - Monitor usage metrics
   - Support API consumers
   - Track migration progress

5. **Completion** (Week 13+)
   - Remove deprecated code
   - Final documentation update
   - Post-implementation review

## Status Updates

- **2025-10-01**: Initial planning complete, documentation published
- **TBD**: Team review scheduled
- **TBD**: Implementation start date
- **TBD**: Deprecation period begins
- **TBD**: Final cutover date

---

**Last Updated**: 2025-10-01
**Status**: Planning Complete - Awaiting Approval
**Next Review**: Team meeting TBD
**Contact**: Backend Architecture Team
